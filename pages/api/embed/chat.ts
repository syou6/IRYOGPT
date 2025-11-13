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

/**
 * POST /api/embed/chat
 * 
 * 埋め込み用チャットAPI（認証不要）
 * site_idとis_embed_enabledのチェックでセキュリティを確保
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { question, history, site_id } = req.body;

    if (!question) {
      return res.status(400).json({ message: 'No question in the request' });
    }

    if (!site_id) {
      return res.status(400).json({ message: 'site_id is required' });
    }

    // サイト情報を取得（is_embed_enabled と status を確認）
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('id, user_id, is_embed_enabled, status')
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    // is_embed_enabled が false の場合はエラー
    if (!site.is_embed_enabled) {
      return res.status(403).json({ 
        message: 'Embedding is not enabled for this site' 
      });
    }

    // status が 'ready' でない場合はエラー
    if (site.status !== 'ready') {
      return res.status(403).json({ 
        message: 'Site is not ready for embedding' 
      });
    }

    const userId = site.user_id;

    // クォータチェック（サイトの所有者に対して）
    const { data: quotaCheck, error: quotaError } = await supabaseClient.rpc('check_quota', {
      p_user_id: userId,
      p_action: 'chat',
    });

    if (quotaError || !quotaCheck) {
      console.error('[Embed Chat API] Quota check error:', quotaError);
      return res.status(500).json({ message: 'Failed to check quota' });
    }

    if (!quotaCheck) {
      // クォータ超過
      return res.status(403).json({
        message: 'Quota exceeded',
        error: 'このサイトのチャット上限に達しました。',
      });
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

    // site_idでフィルタしたカスタムRetrieverを作成
    const { BaseRetriever } = await import('@langchain/core/retrievers');
    const { Document } = await import('@langchain/core/documents');
    
    const retriever = new (class extends BaseRetriever {
      lc_namespace = ['langchain', 'retrievers', 'supabase'];
      
      async _getRelevantDocuments(query: string) {
        // クエリの埋め込みを生成（embeddingトークン数に加算）
        const queryEmbedding = await embeddings.embedQuery(query);
        // text-embedding-3-smallは512次元、概算で512トークン相当
        usageTracker.embeddingTokens += 512;
        
        // match_documents関数を直接呼び出し（site_idフィルタ付き）
        const { data, error } = await supabaseClient.rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_count: 10,
          filter: {},
          match_site_id: site_id,
        });

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

    // ストリーミングレスポンスの開始
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*', // CORS対応（埋め込み用）
    });

    const sendData = (data: string) => {
      res.write(`data: ${data}\n\n`);
    };

    sendData(JSON.stringify({ data: '' }));

    const model = openai;
    // create the chain with streaming callback
    const chain = makeChain(vectorStore, (token: string) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Embed Chat API] Streaming token:', token.substring(0, 50));
      }
      const clean = sanitizeChunk(token);
      outputText += clean;
      if (clean) {
        sendData(JSON.stringify({ data: clean }));
      }
    }, retriever);

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Embed Chat API] Starting chain invoke for question:', sanitizedQuestion.substring(0, 100));
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
          site_id: site_id,
          action: 'chat',
          model_name: 'gpt-4o-mini',
          tokens_consumed: inputTokens + outputTokens,
          cost_usd: chatCostUsd,
          metadata: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            question_length: sanitizedQuestion.length,
            source: 'embed', // 埋め込みからの呼び出しであることを記録
          },
        });
      } catch (logError) {
        console.error('[Embed Chat API] Failed to log usage (chat):', logError);
      }

      // usage_logsに記録（embedding）- エラーが発生してもストリーミングは続行
      if (usageTracker.embeddingTokens > 0) {
        try {
          const embeddingCostUsd = (usageTracker.embeddingTokens / 1_000_000) * 0.02; // text-embedding-3-small: $0.02 per 1M tokens
          await supabaseClient.from('usage_logs').insert({
            user_id: userId,
            site_id: site_id,
            action: 'embedding',
            model_name: 'text-embedding-3-small',
            tokens_consumed: usageTracker.embeddingTokens,
            cost_usd: embeddingCostUsd,
            metadata: {
              query_length: sanitizedQuestion.length,
              source: 'embed', // 埋め込みからの呼び出しであることを記録
            },
          });
        } catch (logError) {
          console.error('[Embed Chat API] Failed to log usage (embedding):', logError);
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
          site_id: site_id,
          question: sanitizedQuestion,
          answer: outputText,
          session_id: sessionId,
          source: 'embed',
          user_agent: req.headers['user-agent'] || null,
          referrer: req.headers['referer'] || null,
        });
      } catch (logError) {
        // ログ保存のエラーは無視（チャット機能には影響しない）
        console.error('[Embed Chat API] Failed to save chat log:', logError);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[Embed Chat API] Chain invoke completed', {
          inputTokens,
          outputTokens,
          chatCostUsd,
          embeddingTokens: usageTracker.embeddingTokens,
        });
      }
    } catch (error) {
      console.error('[Embed Chat API] Error:', error);
      sendData(JSON.stringify({ error: String(error) }));
    } finally {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Embed Chat API] Sending [DONE]');
      }
      sendData('[DONE]');
      res.end();
    }
  } catch (error) {
    console.error('[Embed Chat API] Error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}


