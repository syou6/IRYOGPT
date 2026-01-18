/**
 * 学習ジョブワーカー
 * 
 * Redisキューから学習ジョブを取得して処理する
 * 既存のAPIエンドポイントの処理ロジックを再利用
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { Document } from '@langchain/core/documents';
import { CustomWebLoader } from '../utils/custom_web_loader';
import { OpenAIEmbeddings } from '@langchain/openai';
// @ts-ignore - LangChain 1.x module resolution issue
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const MAX_TRAINING_PAGES = 60;

// Redis接続
// Upstash RedisはTLS接続が必要
const isUpstash = process.env.REDIS_HOST?.includes('upstash.io');
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(isUpstash && {
    tls: {
      rejectUnauthorized: false, // Upstashの証明書を信頼
    },
  }),
});

// Supabaseクライアント（サービスロールキー使用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ジョブデータの型定義
interface TrainingJobData {
  site_id: string;
  baseUrl: string;
  sitemapUrl?: string;
  urlList?: string[];
  ownerUserId: string;
  requestedBy?: string;
  forceRetrain?: boolean;
}

// SitemapからURLリストを取得（サイトマップインデックス対応）
async function getUrlsFromSitemap(sitemapUrl: string): Promise<string[]> {
  try {
    const response = await fetch(sitemapUrl);
    const xml = await response.text();
    
    // サイトマップインデックス（sitemapindex.xml）かどうかを確認
    if (xml.includes('<sitemapindex')) {
      // サイトマップインデックスの場合、各サイトマップのURLを取得
      const sitemapMatches = xml.match(/<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/g);
      if (!sitemapMatches) return [];
      
      const sitemapUrls = sitemapMatches.map((match) => {
        const locMatch = match.match(/<loc>(.*?)<\/loc>/);
        if (!locMatch) return null;
        let url = locMatch[1];
        // CDATAセクションを処理
        url = url.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
        return url.trim();
      }).filter((url): url is string => url !== null && url.length > 0);
      
      // 各サイトマップからURLを取得（並列処理）
      const urlPromises = sitemapUrls.map((url) => getUrlsFromSitemap(url));
      const urlArrays = await Promise.all(urlPromises);
      
      // 重複を除去して返す
      const allUrls = urlArrays.flat();
      return Array.from(new Set(allUrls));
    } else {
      // 通常のサイトマップの場合
      const urlMatches = xml.match(/<url>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/url>/g);
      if (!urlMatches) {
        // <url>タグがない場合、<loc>タグを直接検索（後方互換性）
        const simpleMatches = xml.match(/<loc>(.*?)<\/loc>/g);
        if (!simpleMatches) return [];
        return simpleMatches
          .map((match) => {
            const url = match.replace(/<\/?loc>/g, '');
            // CDATAセクションを処理
            return url.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
          })
          .filter((url) => url.length > 0);
      }
      
      // <url>タグ内の<loc>を抽出
      const urls = urlMatches.map((match) => {
        const locMatch = match.match(/<loc>(.*?)<\/loc>/);
        if (!locMatch) return null;
        let url = locMatch[1];
        // CDATAセクションを処理
        url = url.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
        return url.trim();
      }).filter((url): url is string => url !== null && url.length > 0);
      
      return urls;
    }
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    return [];
  }
}

// BaseURLからURLリストを生成（サイトマップの自動検出を試行）
async function getUrlsFromBaseUrl(baseUrl: string): Promise<{
  urls: string[];
  detectedSitemapUrl?: string;
  detectionMethod?: string;
}> {
  const commonSitemapPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-index.xml',
    '/sitemap1.xml',
    '/sitemap.txt',
  ];
  
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const attemptedPaths: string[] = [];
  
  for (const path of commonSitemapPaths) {
    try {
      const sitemapUrl = `${normalizedBaseUrl}${path}`;
      attemptedPaths.push(sitemapUrl);
      const response = await fetch(sitemapUrl, { method: 'HEAD' });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('xml')) {
          const urls = await getUrlsFromSitemap(sitemapUrl);
          if (urls.length > 0) {
            return {
              urls,
              detectedSitemapUrl: sitemapUrl,
              detectionMethod: `自動検出（${path}）`,
            };
          }
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  // robots.txtを確認
  try {
    const robotsUrl = `${normalizedBaseUrl}/robots.txt`;
    const robotsResponse = await fetch(robotsUrl);
    
    if (robotsResponse.ok) {
      const robotsText = await robotsResponse.text();
      const sitemapMatches = robotsText.match(/Sitemap:\s*(.+)/gi);
      
      if (sitemapMatches) {
        for (const match of sitemapMatches) {
          const sitemapUrl = match.replace(/Sitemap:\s*/i, '').trim();
          const urls = await getUrlsFromSitemap(sitemapUrl);
          if (urls.length > 0) {
            return {
              urls,
              detectedSitemapUrl: sitemapUrl,
              detectionMethod: '自動検出（robots.txt）',
            };
          }
        }
      }
    }
  } catch (error) {
    // エラーは無視
  }
  
  return {
    urls: [baseUrl],
    detectionMethod: 'サイトマップ未検出（ベースURLのみ）',
  };
}

// URLリストからデータを抽出
async function extractDataFromUrls(
  urls: string[],
  onProgress?: (processed: number, total: number) => Promise<void> | void,
): Promise<Document[]> {
  console.log('extracting data from urls...');
  const documents: Document[] = [];
  const total = urls.length;
  let processed = 0;
  for (const url of urls) {
    try {
      const loader = new CustomWebLoader(url);
      const docs = await loader.load();
      documents.push(...docs);
    } catch (error) {
      console.error(`Error while extracting data from ${url}:`, error);
    }
    processed += 1;
    if (onProgress) {
      await onProgress(processed, total);
    }
  }
  console.log(`data extracted from ${documents.length} documents`);
  return documents;
}

// ドキュメントをチャンクに分割
async function splitDocsIntoChunks(docs: Document[]): Promise<Document[]> {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  return await textSplitter.splitDocuments(docs);
}

// トークン数の概算計算
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// 埋め込みを生成してSupabaseに保存（site_id付き）
async function embedDocumentsWithSiteId(
  siteId: string,
  docs: Document[],
  embeddings: OpenAIEmbeddings,
  onProgress?: (processed: number, total: number) => void,
): Promise<number> {
  console.log(`[Worker] Creating embeddings for ${docs.length} documents...`);
  
  const uniqueId = `site_${siteId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const docsWithMarker = docs.map((doc) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      _training_marker: uniqueId,
    },
  }));

  // SupabaseVectorStoreで保存
  await SupabaseVectorStore.fromDocuments(docsWithMarker, embeddings, {
    client: supabase,
    tableName: 'documents',
  });

  // site_idを設定
  const { data: updatedDocs, error: updateError } = await supabase
    .from('documents')
    .update({ site_id: siteId })
    .eq('metadata->>_training_marker', uniqueId)
    .is('site_id', null)
    .select('id, metadata');

  if (updateError) {
    console.error('[Worker] Error updating site_id:', updateError);
    throw updateError;
  }

  // _training_markerを削除
  if (updatedDocs && updatedDocs.length > 0) {
    const updatePromises = updatedDocs.map(async (doc) => {
      if (doc.metadata && typeof doc.metadata === 'object') {
        const { _training_marker, ...cleanMetadata } = doc.metadata as any;
        return supabase
          .from('documents')
          .update({ metadata: cleanMetadata })
          .eq('id', doc.id);
      }
      return Promise.resolve();
    });
    await Promise.all(updatePromises);
  }

  const totalTokens = docs.reduce((sum, doc) => sum + estimateTokens(doc.pageContent), 0);
  return totalTokens;
}

// ワーカーを作成
const worker = new Worker<TrainingJobData>(
  'training-jobs',
  async (job: Job<TrainingJobData>) => {
    const {
      site_id,
      baseUrl,
      sitemapUrl,
      urlList,
      ownerUserId,
      requestedBy,
      forceRetrain = false,
    } = job.data;

    console.log(`[Worker] Processing job ${job.id} for site ${site_id}`);

    try {
      // 1. ステータスを 'running' に更新
      await supabase
        .from('training_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // 2. サイト情報を取得
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('id', site_id)
        .single();

      if (siteError || !site) {
        throw new Error(`Site not found: ${site_id}`);
      }

      // 3. 再学習の場合、既存のドキュメントを削除
      if (forceRetrain) {
        console.log(`[Worker] Deleting existing documents for site_id: ${site_id}`);
        await supabase
          .from('documents')
          .delete()
          .eq('site_id', site_id);
      }

      // 4. URLリストを取得
      let urls: string[] = [];
      let detectedSitemapUrl: string | undefined;
      let detectionMethod: string | undefined;
      
      if (urlList && urlList.length > 0) {
        urls = urlList;
        detectionMethod = `URLリスト（${urls.length}件）`;
      } else if (sitemapUrl) {
        urls = await getUrlsFromSitemap(sitemapUrl);
        detectionMethod = '手動指定（サイトマップ）';
      } else {
        const result = await getUrlsFromBaseUrl(baseUrl);
        urls = result.urls;
        detectedSitemapUrl = result.detectedSitemapUrl;
        detectionMethod = result.detectionMethod;
      }

      const originalUrlCount = urls.length;
      let wasTruncated = false;
      if (urls.length > MAX_TRAINING_PAGES) {
        urls = urls.slice(0, MAX_TRAINING_PAGES);
        wasTruncated = true;
      }

      // 5. ジョブのtotal_pagesとmetadataを更新
      await supabase
        .from('training_jobs')
        .update({ 
          total_pages: urls.length,
          metadata: {
            detected_sitemap_url: detectedSitemapUrl || sitemapUrl || null,
            detection_method: detectionMethod || '不明',
            url_count: urls.length,
            original_url_count: originalUrlCount,
            page_limit: {
              max_pages: MAX_TRAINING_PAGES,
              truncated: wasTruncated,
            },
            urls: urls,
          },
        })
        .eq('id', job.id);

      // 6. データ抽出
      const rawDocs = await extractDataFromUrls(urls, async (processed, total) => {
        await supabase
          .from('training_jobs')
          .update({ processed_pages: processed })
          .eq('id', job.id);
        
        // 進捗を更新
        await job.updateProgress({
          processed,
          total,
        });
      });
      
      // 7. チャンク分割
      const docs = await splitDocsIntoChunks(rawDocs);

      // 8. 埋め込み生成と保存
      const embeddings = new OpenAIEmbeddings({
        model: 'text-embedding-3-small',
        dimensions: 512,
      });

      const embeddingTokens = await embedDocumentsWithSiteId(site_id, docs, embeddings);

      // 9. コスト計算
      const estimatedCostUsd = (embeddingTokens / 1_000_000) * 0.02;

      // 10. 完了処理
      await supabase
        .from('sites')
        .update({ 
          status: 'ready',
          last_trained_at: new Date().toISOString(),
        })
        .eq('id', site_id);

      await supabase
        .from('training_jobs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          processed_pages: urls.length,
          estimated_cost_usd: estimatedCostUsd,
        })
        .eq('id', job.id);

      // 11. usage_logsに記録
      try {
        await supabase.from('usage_logs').insert({
          user_id: ownerUserId,
          site_id: site_id,
          action: 'training',
          model_name: 'text-embedding-3-small',
          tokens_consumed: embeddingTokens,
          cost_usd: estimatedCostUsd,
          metadata: {
            document_count: docs.length,
            url_count: urls.length,
            job_id: job.id,
            requested_by: requestedBy || ownerUserId,
          },
        });
      } catch (logError) {
        console.error('[Worker] Failed to log usage:', logError);
      }

      console.log(`[Worker] Job ${job.id} completed successfully`);
      return {
        success: true,
        processedPages: urls.length,
        totalPages: urls.length,
      };
    } catch (error: any) {
      console.error(`[Worker] Job ${job.id} failed:`, error);

      // エラー処理
      await supabase
        .from('training_jobs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: error.message || 'Unknown error',
          attempt: job.attemptsMade + 1,
        })
        .eq('id', job.id);

      await supabase
        .from('sites')
        .update({ status: 'error' })
        .eq('id', site_id);

      throw error;
    }
  },
  {
    connection,
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 1000,
    },
  }
);

// イベントハンドラー
worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

// シグナルハンドリング
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

console.log('🚀 Training worker started');
console.log(`Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
