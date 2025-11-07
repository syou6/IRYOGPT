import type { NextApiRequest, NextApiResponse } from 'next';
import { Document } from '@langchain/core/documents';
import { CustomWebLoader } from '@/utils/custom_web_loader';
import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { supabaseClient } from '@/utils/supabase-client';
import { requireAuth } from '@/utils/supabase-auth';

interface TrainRequest {
  site_id: string;
  baseUrl: string;
  sitemapUrl?: string;
}

// SitemapからURLリストを取得
async function getUrlsFromSitemap(sitemapUrl: string): Promise<string[]> {
  try {
    const response = await fetch(sitemapUrl);
    const xml = await response.text();
    const urlMatches = xml.match(/<loc>(.*?)<\/loc>/g);
    if (!urlMatches) return [];
    return urlMatches.map((match) => match.replace(/<\/?loc>/g, ''));
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    return [];
  }
}

// BaseURLからURLリストを生成（簡易版：最初はbaseUrlのみ）
async function getUrlsFromBaseUrl(baseUrl: string): Promise<string[]> {
  // 将来的にはクローラーでリンクを辿る実装も可能
  // 今はbaseUrlのみを返す
  return [baseUrl];
}

// URLリストからデータを抽出
async function extractDataFromUrls(urls: string[]): Promise<Document[]> {
  console.log('extracting data from urls...');
  const documents: Document[] = [];
  for (const url of urls) {
    try {
      const loader = new CustomWebLoader(url);
      const docs = await loader.load();
      documents.push(...docs);
    } catch (error) {
      console.error(`Error while extracting data from ${url}:`, error);
    }
  }
  console.log(`data extracted from ${documents.length} documents`);
  return documents;
}

// ドキュメントをチャンクに分割
async function splitDocsIntoChunks(docs: Document[]): Promise<Document[]> {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 200,
  });
  return await textSplitter.splitDocuments(docs);
}

// 埋め込みを生成してSupabaseに保存（site_id付き）
async function embedDocumentsWithSiteId(
  siteId: string,
  docs: Document[],
  embeddings: OpenAIEmbeddings,
  onProgress?: (processed: number, total: number) => void,
): Promise<void> {
  console.log('creating embeddings...');
  
  // SupabaseVectorStore.fromDocumentsはsite_idを直接指定できないため、
  // カスタム実装が必要
  // 一旦、既存の方法で保存してからsite_idを更新する方法を使う
  
  // 各ドキュメントにsite_idをmetadataに追加
  const docsWithSiteId = docs.map((doc) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      site_id: siteId,
    },
  }));

  // SupabaseVectorStoreで保存
  await SupabaseVectorStore.fromDocuments(docsWithSiteId, embeddings, {
    client: supabaseClient,
    tableName: 'documents',
  });

  // site_idをmetadataから実際のカラムに更新
  const { error } = await supabaseClient
    .from('documents')
    .update({ site_id: siteId })
    .eq('metadata->>site_id', siteId);

  if (error) {
    console.error('Error updating site_id:', error);
    throw error;
  }

  console.log('embeddings successfully stored in supabase');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // 認証チェック
    const userId = await requireAuth(req);

    const { site_id, baseUrl, sitemapUrl } = req.body as TrainRequest;

    if (!site_id || !baseUrl) {
      return res.status(400).json({ 
        message: 'site_id and baseUrl are required' 
      });
    }

    // サイトの所有者を確認
    const { data: site, error: siteCheckError } = await supabaseClient
      .from('sites')
      .select('user_id')
      .eq('id', site_id)
      .single();

    if (siteCheckError || !site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (site.user_id !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 1. sites.status を 'training' に更新
    const { error: siteUpdateError } = await supabaseClient
      .from('sites')
      .update({ status: 'training' })
      .eq('id', site_id);

    if (siteUpdateError) {
      throw siteUpdateError;
    }

    // 2. training_jobs に新規ジョブ作成
    const { data: job, error: jobError } = await supabaseClient
      .from('training_jobs')
      .insert({
        site_id,
        status: 'pending',
        total_pages: 0,
        processed_pages: 0,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw jobError || new Error('Failed to create training job');
    }

    const jobId = job.id;

    // 3. ジョブステータスを 'running' に更新
    await supabaseClient
      .from('training_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId);

    // 4. レスポンスを即座に返す（非同期処理を開始）
    res.status(200).json({
      job_id: jobId,
      status: 'running',
      message: `Training started for site_id ${site_id}`,
    });

    // 5. バックグラウンド処理を開始（非同期）
    (async () => {
      try {
        // URLリストを取得
        let urls: string[] = [];
        if (sitemapUrl) {
          urls = await getUrlsFromSitemap(sitemapUrl);
        } else {
          urls = await getUrlsFromBaseUrl(baseUrl);
        }

        // ジョブのtotal_pagesを更新
        await supabaseClient
          .from('training_jobs')
          .update({ total_pages: urls.length })
          .eq('id', jobId);

        // データ抽出
        const rawDocs = await extractDataFromUrls(urls);
        
        // チャンク分割
        const docs = await splitDocsIntoChunks(rawDocs);

        // 埋め込み生成と保存
        const embeddings = new OpenAIEmbeddings({
          model: 'text-embedding-3-small',
          dimensions: 512,
        });

        await embedDocumentsWithSiteId(site_id, docs, embeddings, (processed, total) => {
          // 進捗更新（オプション）
          supabaseClient
            .from('training_jobs')
            .update({ processed_pages: processed })
            .eq('id', jobId);
        });

        // 6. 完了処理
        await supabaseClient
          .from('sites')
          .update({ 
            status: 'ready',
            last_trained_at: new Date().toISOString(),
          })
          .eq('id', site_id);

        await supabaseClient
          .from('training_jobs')
          .update({
            status: 'completed',
            finished_at: new Date().toISOString(),
            processed_pages: docs.length,
          })
          .eq('id', jobId);

        console.log(`Training completed for site_id ${site_id}`);
      } catch (error) {
        console.error('Training error:', error);
        
        // エラー処理
        await supabaseClient
          .from('sites')
          .update({ status: 'error' })
          .eq('id', site_id);

        await supabaseClient
          .from('training_jobs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq('id', jobId);
      }
    })();

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return res.status(401).json({
        message: 'Unauthorized',
        error: '認証が必要です',
      });
    }

    console.error('API error:', error);
    return res.status(500).json({
      message: 'Failed to start training',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

