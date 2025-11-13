import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from '@langchain/openai';
// @ts-ignore - LangChain 1.x module resolution issue
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { openai } from '@/utils/openai-client';
import { supabaseClient } from '@/utils/supabase-client';
import { makeChain } from '@/utils/makechain';

function sanitizeChunk(raw: string) {
  if (!raw) return '';
  const withoutBold = raw.replace(/\*\*(.*?)\*\*/g, '$1');
  return withoutBold
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ');
}
import { requireAuth } from '@/utils/supabase-auth';

// トークン数の概算計算（文字数から概算、1トークン ≈ 4文字）
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// コスト計算（gpt-4o-mini: $0.15 per 1M input tokens, $0.60 per 1M output tokens）
function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 0.15;
  const outputCost = (outputTokens / 1_000_000) * 0.60;
  return inputCost + outputCost;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // 認証チェック
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // ユーザーが存在しない場合はusersテーブルに作成
  const { data: user, error: userError } = await supabaseClient
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    // ユーザーが存在しない場合は作成
    await supabaseClient
      .from('users')
      .insert({
        id: userId,
        plan: 'starter',
        chat_quota: 1000,
        embedding_quota: 100000,
      })
      .select()
      .single();
  }

  // クォータチェック
  const { data: quotaCheck, error: quotaError } = await supabaseClient.rpc('check_quota', {
    p_user_id: userId,
    p_action: 'chat',
  });

  if (quotaError || !quotaCheck) {
    console.error('[Chat API] Quota check error:', quotaError);
    return res.status(500).json({ message: 'Failed to check quota' });
  }

  if (!quotaCheck) {
    // クォータ超過
    const { data: usage } = await supabaseClient.rpc('get_monthly_usage', {
      p_user_id: userId,
    });
    
    return res.status(403).json({
      message: 'Quota exceeded',
      error: '月間チャット上限に達しました。プランのアップグレードをご検討ください。',
      usage: usage?.[0] || null,
    });
  }

  const { question, history, site_id } = req.body;

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }
  // OpenAI recommends replacing newlines with spaces for best results
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  /* create vectorstore*/
  const embeddings = new OpenAIEmbeddings({ 
    model: 'text-embedding-3-small',
    dimensions: 512 
  });
  const vectorStore = await SupabaseVectorStore.fromExistingIndex(
    embeddings,
    {
      client: supabaseClient,
      tableName: 'documents',
      queryName: 'match_documents',
    }
  );

  // ストリーミング用の変数（retriever内でも使用）
  let outputText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  const usageTracker = {
    contextText: '',
    embeddingTokens: 0,
  };

  // site_idが指定されている場合、カスタムRetrieverを作成
  let retriever;
  if (site_id) {
    // カスタムRetrieverでsite_idフィルタを適用
    const { BaseRetriever } = await import('@langchain/core/retrievers');
    const { Document } = await import('@langchain/core/documents');
    
    retriever = new (class extends BaseRetriever {
      lc_namespace = ['langchain', 'retrievers', 'supabase'];
      
      async _getRelevantDocuments(query: string) {
        // クエリの埋め込みを生成（embeddingトークン数に加算）
        const queryEmbedding = await embeddings.embedQuery(query);
        // text-embedding-3-smallは512次元、概算で512トークン相当
        usageTracker.embeddingTokens += 512;
        
        // match_documents関数を直接呼び出し（site_idフィルタ付き）
        // ベクトルは配列形式で渡す（Supabaseが自動的にvector型に変換）
        const { data, error } = await supabaseClient.rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_count: 10, // 5→10に増やして精度向上
          filter: {},
          match_site_id: site_id,
        });
        
        // デバッグログ：取得されたドキュメント数とsimilarityスコア
        console.log(`[RAG] Retrieved ${data?.length || 0} documents for site_id: ${site_id}`);
        if (data && data.length > 0) {
          const similarities = data.map((d: any) => d.similarity);
          console.log(`[RAG] Similarity scores:`, similarities);
          console.log(`[RAG] Average similarity:`, similarities.reduce((a: number, b: number) => a + b, 0) / similarities.length);
        } else {
          console.warn(`[RAG] No documents found for site_id: ${site_id}`);
        }

        if (error) {
          throw error;
        }

        // コンテキストテキストを保存（トークン数計算用）
        const documents = (data || []).map((row: any) => {
          usageTracker.contextText += row.content + '\n\n';
          return new Document({
            pageContent: row.content,
            metadata: row.metadata || {},
          });
        });
        
        return documents;
      }
    })();
  } else {
    retriever = (vectorStore as any).asRetriever();
  }

  // ストリーミングレスポンスの開始（クォータチェック後に実行）
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const sendData = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  sendData(JSON.stringify({ data: '' }));

  const model = openai;
  // create the chain with streaming callback
    const chain = makeChain(vectorStore, (token: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Chat API] Streaming token:', token.substring(0, 50));
      }
      const clean = sanitizeChunk(token);
      outputText += clean;
      if (clean) {
        sendData(JSON.stringify({ data: clean }));
      }
    }, retriever);

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Chat API] Starting chain invoke for question:', sanitizedQuestion.substring(0, 100));
    }
    //Ask a question with streaming (onTokenStream callback will handle streaming)
    await chain.invoke({
      question: sanitizedQuestion,
      chat_history: history || [],
    });
    
    // 入力トークン数の概算（質問 + 履歴 + コンテキスト）
    const questionTokens = estimateTokens(sanitizedQuestion);
    const historyTokens = history
      ? history.reduce((sum: number, [q, a]: [string, string]) => sum + estimateTokens(q) + estimateTokens(a), 0)
      : 0;
    const contextTokens = estimateTokens(usageTracker.contextText);
    inputTokens = questionTokens + historyTokens + contextTokens;
    
    // 出力トークン数の概算
    outputTokens = estimateTokens(outputText);
    
    // コスト計算（チャットのみ、embeddingは別途記録）
    const chatCostUsd = calculateCost(inputTokens, outputTokens);
    
    // usage_logsに記録（チャット）- エラーが発生してもストリーミングは続行
    try {
      await supabaseClient.from('usage_logs').insert({
        user_id: userId,
        site_id: site_id || null,
        action: 'chat',
        model_name: 'gpt-4o-mini',
        tokens_consumed: inputTokens + outputTokens,
        cost_usd: chatCostUsd,
        metadata: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          question_length: sanitizedQuestion.length,
        },
      });
    } catch (logError) {
      console.error('[Chat API] Failed to log usage (chat):', logError);
    }

    // usage_logsに記録（embedding）- エラーが発生してもストリーミングは続行
    if (usageTracker.embeddingTokens > 0) {
      try {
        const embeddingCostUsd = (usageTracker.embeddingTokens / 1_000_000) * 0.02; // text-embedding-3-small: $0.02 per 1M tokens
        await supabaseClient.from('usage_logs').insert({
          user_id: userId,
          site_id: site_id || null,
          action: 'embedding',
          model_name: 'text-embedding-3-small',
          tokens_consumed: usageTracker.embeddingTokens,
          cost_usd: embeddingCostUsd,
          metadata: {
            query_length: sanitizedQuestion.length,
          },
        });
      } catch (logError) {
        console.error('[Chat API] Failed to log usage (embedding):', logError);
      }
    }

    // Parole機能: chat_logsに質問と回答を保存
    try {
      // セッションIDを生成（クライアントから送られてくるか、サーバーで生成）
      const sessionId =
        req.body.session_id ||
        `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await supabaseClient.from('chat_logs').insert({
        user_id: userId,
        site_id: site_id || null,
        question: sanitizedQuestion,
        answer: outputText,
        session_id: sessionId,
        source: 'dashboard',
        user_agent: req.headers['user-agent'] || null,
        referrer: req.headers['referer'] || null,
      });
    } catch (logError) {
      // ログ保存のエラーは無視（チャット機能には影響しない）
      console.error('[Chat API] Failed to save chat log:', logError);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[Chat API] Chain invoke completed', {
        inputTokens,
        outputTokens,
        chatCostUsd,
        embeddingTokens: usageTracker.embeddingTokens,
      });
    }
  } catch (error) {
    console.error('[Chat API] Error:', error);
    sendData(JSON.stringify({ error: String(error) }));
  } finally {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Chat API] Sending [DONE]');
    }
    sendData('[DONE]');
    res.end();
  }
}
