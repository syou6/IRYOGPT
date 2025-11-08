import type { NextApiRequest, NextApiResponse } from 'next';
import { Document } from '@langchain/core/documents';
import { CustomWebLoader } from '@/utils/custom_web_loader';
import { OpenAIEmbeddings } from '@langchain/openai';
// @ts-ignore - LangChain 1.x module resolution issue
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { supabaseClient } from '@/utils/supabase-client';
import { requireAuth } from '@/utils/supabase-auth';
import { trainingQueue } from '@/lib/queue';

interface TrainRequest {
  site_id: string;
  baseUrl: string;
  sitemapUrl?: string;
  urlList?: string;
  forceRetrain?: boolean;
}

const MAX_TRAINING_PAGES = 20;

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
// 戻り値: { urls: string[], detectedSitemapUrl?: string, detectionMethod?: string }
async function getUrlsFromBaseUrl(baseUrl: string): Promise<{
  urls: string[];
  detectedSitemapUrl?: string;
  detectionMethod?: string;
}> {
  // 一般的なサイトマップのパスを試行
  const commonSitemapPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-index.xml',
    '/sitemap1.xml',
    '/sitemap.txt',
  ];
  
  // ベースURLを正規化（末尾のスラッシュを削除）
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const attemptedPaths: string[] = [];
  
  // 各サイトマップパスを試行
  for (const path of commonSitemapPaths) {
    try {
      const sitemapUrl = `${normalizedBaseUrl}${path}`;
      attemptedPaths.push(sitemapUrl);
      const response = await fetch(sitemapUrl, { method: 'HEAD' });
      
      console.log(`[Sitemap Detection] Trying: ${sitemapUrl} - Status: ${response.status}`);
      
      // 200 OK または Content-Type が XML の場合
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        console.log(`[Sitemap Detection] Content-Type: ${contentType}`);
        
        if (contentType && contentType.includes('xml')) {
          console.log(`[Sitemap Detection] Found sitemap at: ${sitemapUrl}`);
          const urls = await getUrlsFromSitemap(sitemapUrl);
          console.log(`[Sitemap Detection] Extracted ${urls.length} URLs from sitemap`);
          
          if (urls.length > 0) {
            return {
              urls,
              detectedSitemapUrl: sitemapUrl,
              detectionMethod: `自動検出（${path}）`,
            };
          } else {
            console.log(`[Sitemap Detection] Sitemap found but no URLs extracted from: ${sitemapUrl}`);
          }
        } else {
          console.log(`[Sitemap Detection] Content-Type is not XML: ${contentType}`);
        }
      } else {
        console.log(`[Sitemap Detection] HTTP ${response.status} for: ${sitemapUrl}`);
      }
    } catch (error) {
      console.log(`[Sitemap Detection] Error fetching ${normalizedBaseUrl}${path}:`, error);
      // 次のパスを試行
      continue;
    }
  }
  
  console.log(`[Sitemap Detection] Attempted paths: ${attemptedPaths.join(', ')}`);
  
  // サイトマップが見つからない場合、robots.txtを確認
  try {
    const robotsUrl = `${normalizedBaseUrl}/robots.txt`;
    console.log(`[Sitemap Detection] Checking robots.txt: ${robotsUrl}`);
    const robotsResponse = await fetch(robotsUrl);
    
    if (robotsResponse.ok) {
      const robotsText = await robotsResponse.text();
      console.log(`[Sitemap Detection] robots.txt found, content length: ${robotsText.length}`);
      const sitemapMatches = robotsText.match(/Sitemap:\s*(.+)/gi);
      
      if (sitemapMatches) {
        console.log(`[Sitemap Detection] Found ${sitemapMatches.length} Sitemap entries in robots.txt`);
        for (const match of sitemapMatches) {
          const sitemapUrl = match.replace(/Sitemap:\s*/i, '').trim();
          console.log(`[Sitemap Detection] Trying sitemap from robots.txt: ${sitemapUrl}`);
          const urls = await getUrlsFromSitemap(sitemapUrl);
          console.log(`[Sitemap Detection] Extracted ${urls.length} URLs from robots.txt sitemap`);
          
          if (urls.length > 0) {
            return {
              urls,
              detectedSitemapUrl: sitemapUrl,
              detectionMethod: '自動検出（robots.txt）',
            };
          }
        }
      } else {
        console.log(`[Sitemap Detection] No Sitemap entries found in robots.txt`);
      }
    } else {
      console.log(`[Sitemap Detection] robots.txt not found (HTTP ${robotsResponse.status})`);
    }
  } catch (error) {
    console.log(`[Sitemap Detection] Error checking robots.txt:`, error);
  }
  
  // サイトマップが見つからない場合、baseUrlのみを返す
  console.log(`[Sitemap Detection] No sitemap found after checking ${attemptedPaths.length} paths and robots.txt, using baseUrl only`);
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
    chunkSize: 1000, // 2000→1000に縮小してより細かく分割（精度向上）
    chunkOverlap: 200, // オーバーラップは維持
  });
  return await textSplitter.splitDocuments(docs);
}

// トークン数の概算計算（文字数から概算、1トークン ≈ 4文字）
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// 埋め込みを生成してSupabaseに保存（site_id付き）
// 戻り値: 使用したembeddingトークン数
async function embedDocumentsWithSiteId(
  siteId: string,
  docs: Document[],
  embeddings: OpenAIEmbeddings,
  onProgress?: (processed: number, total: number) => void,
): Promise<number> {
  console.log(`[Training] Creating embeddings for ${docs.length} documents...`);
  
  // 保存前のタイムスタンプを記録（この時点以降に保存されたドキュメントを特定するため）
  const beforeInsertTime = new Date();
  
  // 各ドキュメントに一意の識別子をmetadataに追加
  const uniqueId = `site_${siteId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const docsWithMarker = docs.map((doc) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      _training_marker: uniqueId, // 一意の識別子
    },
  }));

  // SupabaseVectorStoreで保存
  await SupabaseVectorStore.fromDocuments(docsWithMarker, embeddings, {
    client: supabaseClient,
    tableName: 'documents',
  });

  console.log(`[Training] Documents inserted, updating site_id with marker: ${uniqueId}`);

  // 保存直後に、_training_markerが一致し、site_idがNULLのドキュメントにsite_idを設定
  const { data: updatedDocs, error: updateError } = await supabaseClient
    .from('documents')
    .update({ site_id: siteId })
    .eq('metadata->>_training_marker', uniqueId)
    .is('site_id', null)
    .select('id, metadata');

  if (updateError) {
    console.error('[Training] Error updating site_id:', updateError);
    throw updateError;
  }

  const updatedCount = updatedDocs?.length || 0;
  console.log(`[Training] Updated ${updatedCount} documents with site_id`);

  if (updatedCount !== docs.length) {
    console.warn(`[Training] Warning: Expected to update ${docs.length} documents, but updated ${updatedCount}`);
  }

  // _training_markerをmetadataから削除（クリーンアップ）
  if (updatedDocs && updatedDocs.length > 0) {
    // バッチ更新で効率化
    const updatePromises = updatedDocs.map(async (doc) => {
      if (doc.metadata && typeof doc.metadata === 'object') {
        const { _training_marker, ...cleanMetadata } = doc.metadata as any;
        return supabaseClient
          .from('documents')
          .update({ metadata: cleanMetadata })
          .eq('id', doc.id);
      }
      return Promise.resolve();
    });

    await Promise.all(updatePromises);
  }

  console.log('[Training] Embeddings successfully stored in supabase');
  
  // 使用したembeddingトークン数を計算（各ドキュメントのテキスト長から概算）
  const totalTokens = docs.reduce((sum, doc) => sum + estimateTokens(doc.pageContent), 0);
  return totalTokens;
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

    const { site_id, baseUrl, sitemapUrl, urlList, forceRetrain } = req.body as TrainRequest;

    console.log(`[Training] Request body:`, { site_id, baseUrl, sitemapUrl, urlList: urlList ? `${urlList.substring(0, 100)}...` : null, forceRetrain });

    if (!site_id || !baseUrl) {
      return res.status(400).json({ 
        message: 'site_id and baseUrl are required' 
      });
    }

    // URLリストを事前に処理（キューに渡すため）
    const processedUrlList = urlList && urlList.trim() 
      ? urlList.split('\n')
          .map((url) => url.trim())
          .filter((url) => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')))
      : undefined;

    console.log(`[Training] Processed URL list:`, { 
      hasUrlList: !!urlList, 
      urlListLength: urlList?.length || 0,
      processedCount: processedUrlList?.length || 0,
      processedUrls: processedUrlList?.slice(0, 3) || []
    });

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

    // 3. キューにジョブを追加
    try {
      const queueJob = await trainingQueue.add(
        'train-site',
        {
          site_id,
          baseUrl,
          sitemapUrl,
          urlList: processedUrlList,
          userId,
          forceRetrain: forceRetrain || false,
        },
        {
          jobId, // training_jobs.id を使用してジョブIDを統一
          priority: 1,
        }
      );

      console.log(`[Training] Job ${jobId} added to queue`);

      // 4. レスポンスを即座に返す
      res.status(200).json({
        job_id: jobId,
        status: 'pending',
        message: `Training job queued for site_id ${site_id}`,
        page_limit_max: MAX_TRAINING_PAGES,
      });
    } catch (queueError) {
      console.error('[Training] Failed to add job to queue:', queueError);
      
      // キュー追加に失敗した場合、既存の同期処理にフォールバック
      console.log('[Training] Falling back to synchronous processing');
      
      // ジョブステータスを 'running' に更新
      await supabaseClient
        .from('training_jobs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', jobId);

      // レスポンスを返す
      res.status(200).json({
        job_id: jobId,
        status: 'running',
        message: `Training started for site_id ${site_id} (fallback mode)`,
        page_limit_max: MAX_TRAINING_PAGES,
      });

      // バックグラウンド処理を開始（既存の同期処理）
      (async () => {
      try {
        // 再学習の場合、既存のドキュメントを削除（重複を防ぐため）
        console.log(`[Training] Deleting existing documents for site_id: ${site_id}`);
        const { error: deleteError } = await supabaseClient
          .from('documents')
          .delete()
          .eq('site_id', site_id);
        
        if (deleteError) {
          console.error('[Training] Error deleting existing documents:', deleteError);
          // 削除エラーは警告のみ（初回学習の場合は問題ない）
        } else {
          console.log(`[Training] Deleted existing documents for site_id: ${site_id}`);
        }
        
        // URLリストを取得（優先順位: URLリスト > サイトマップURL > 自動検出 > ベースURLのみ）
        let urls: string[] = [];
        let detectedSitemapUrl: string | undefined;
        let detectionMethod: string | undefined;
        
        if (processedUrlList && processedUrlList.length > 0) {
          // URLリストが指定されている場合（最優先、サイトマップは無視）
          urls = processedUrlList;
          console.log(`[Training] Using URL list: ${urls.length} URLs (sitemap detection skipped)`);
          detectionMethod = `URLリスト（${urls.length}件）`;
        } else if (sitemapUrl) {
          // サイトマップURLが手動指定されている場合
          urls = await getUrlsFromSitemap(sitemapUrl);
          detectionMethod = '手動指定（サイトマップ）';
        } else {
          // URLリストもサイトマップURLもない場合のみ、自動検出を試行
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
          console.log(`[Training] Page limit applied: keeping first ${MAX_TRAINING_PAGES} URLs out of ${originalUrlCount}`);
        }

        // ジョブのtotal_pagesとmetadataを更新
        console.log(`[Training] Detection result:`, {
          detectionMethod,
          detectedSitemapUrl,
          urlCount: urls.length,
          originalUrlCount,
          wasTruncated,
        });
        
        await supabaseClient
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
              urls: urls, // 実際に学習されたURLのリストを保存
            },
          })
          .eq('id', jobId);

        // データ抽出
        const rawDocs = await extractDataFromUrls(urls, async (processed, total) => {
          await supabaseClient
            .from('training_jobs')
            .update({ processed_pages: processed })
            .eq('id', jobId);
        });
        
        // チャンク分割
        const docs = await splitDocsIntoChunks(rawDocs);

        // 埋め込み生成と保存
        const embeddings = new OpenAIEmbeddings({
          model: 'text-embedding-3-small',
          dimensions: 512,
        });

        const embeddingTokens = await embedDocumentsWithSiteId(site_id, docs, embeddings, (processed, total) => {
          // 進捗更新（オプション）
          supabaseClient
            .from('training_jobs')
            .update({ processed_pages: processed })
            .eq('id', jobId);
        });

        // コスト計算（text-embedding-3-small: $0.02 per 1M tokens）
        const estimatedCostUsd = (embeddingTokens / 1_000_000) * 0.02;

        // 6. 完了処理
        await supabaseClient
          .from('sites')
          .update({ 
            status: 'ready',
            last_trained_at: new Date().toISOString(),
          })
          .eq('id', site_id);

        // training_jobsにestimated_cost_usdを記録
        await supabaseClient
          .from('training_jobs')
          .update({
            status: 'completed',
            finished_at: new Date().toISOString(),
            processed_pages: urls.length,
            estimated_cost_usd: estimatedCostUsd,
          })
          .eq('id', jobId);

        // usage_logsに訓練の記録を追加
        try {
          await supabaseClient.from('usage_logs').insert({
            user_id: userId,
            site_id: site_id,
            action: 'training',
            model_name: 'text-embedding-3-small',
            tokens_consumed: embeddingTokens,
            cost_usd: estimatedCostUsd,
            metadata: {
              document_count: docs.length,
              url_count: urls.length,
              job_id: jobId,
            },
          });
        } catch (logError) {
          console.error('[Training] Failed to log usage:', logError);
          // ログ記録の失敗は警告のみ（訓練自体は成功）
        }

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
    }

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
