import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/dist/vectorstores/supabase';
import { openai } from '@/utils/openai-client';
import { supabaseClient } from '@/utils/supabase-client';
import { makeChain } from '@/utils/makechain';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
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

  // site_idが指定されている場合、カスタムRetrieverを作成
  let retriever;
  if (site_id) {
    // カスタムRetrieverでsite_idフィルタを適用
    const { BaseRetriever } = await import('@langchain/core/dist/retrievers/index.js');
    const { Document } = await import('@langchain/core/dist/documents/index.js');
    
    retriever = new (class extends BaseRetriever {
      lc_namespace = ['langchain', 'retrievers', 'supabase'];
      
      async _getRelevantDocuments(query: string) {
        // クエリの埋め込みを生成
        const queryEmbedding = await embeddings.embedQuery(query);
        
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

        // Document形式に変換
        return (data || []).map((row: any) => 
          new Document({
            pageContent: row.content,
            metadata: row.metadata || {},
          })
        );
      }
    })();
  } else {
    retriever = (vectorStore as any).asRetriever();
  }

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
    sendData(JSON.stringify({ data: token }));
  }, retriever);

  try {
    //Ask a question with streaming (onTokenStream callback will handle streaming)
    await chain.invoke({
      question: sanitizedQuestion,
      chat_history: history || [],
    });
  } catch (error) {
    console.log('error', error);
    sendData(JSON.stringify({ error: String(error) }));
  } finally {
    sendData('[DONE]');
    res.end();
  }
}
