/**
 * マークダウンファイルを特定のサイトに学習させるスクリプト
 * 
 * 使用方法:
 * tsx -r dotenv/config scripts/train-markdown-files.ts <site_id> <markdown_folder_path>
 * 
 * 例:
 * tsx -r dotenv/config scripts/train-markdown-files.ts abc123 docs/blogs-20251115T024613
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Document } from '@langchain/core/documents';
import { MarkdownLoader } from '../utils/markdown_loader';
import { OpenAIEmbeddings } from '@langchain/openai';
// @ts-ignore - LangChain 1.x module resolution issue
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { supabaseClient } from '../utils/supabase-client';

// コマンドライン引数から取得
const args = process.argv.slice(2);
const siteId = args[0];
const folderPath = args[1];

if (!siteId || !folderPath) {
  console.error('使用方法: tsx scripts/train-markdown-files.ts <site_id> <markdown_folder_path>');
  console.error('例: tsx scripts/train-markdown-files.ts abc123 docs/blogs-20251115T024613');
  process.exit(1);
}

// トークン数の概算計算（文字数から概算、1トークン ≈ 4文字）
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// マークダウンファイルからデータを抽出
async function extractDataFromMarkdownFiles(
  folderPath: string,
): Promise<Document[]> {
  console.log(`[Training] Loading markdown files from: ${folderPath}`);
  
  const documents: Document[] = [];
  const files = await fs.readdir(folderPath);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  console.log(`[Training] Found ${markdownFiles.length} markdown files`);

  for (const file of markdownFiles) {
    try {
      const filePath = path.join(folderPath, file);
      console.log(`[Training] Loading: ${file}`);
      
      const loader = new MarkdownLoader(filePath);
      const docs = await loader.load();
      documents.push(...docs);
      
      console.log(`[Training] ✅ Loaded: ${file} (${docs.length} document(s))`);
    } catch (error) {
      console.error(`[Training] ❌ Error loading ${file}:`, error);
    }
  }

  console.log(`[Training] Total documents loaded: ${documents.length}`);
  return documents;
}

// ドキュメントをチャンクに分割
async function splitDocsIntoChunks(docs: Document[]): Promise<Document[]> {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 650,
    chunkOverlap: 150,
  });
  return await textSplitter.splitDocuments(docs);
}

// 埋め込みを生成してSupabaseに保存（site_id付き）
async function embedDocumentsWithSiteId(
  siteId: string,
  docs: Document[],
  embeddings: OpenAIEmbeddings,
): Promise<number> {
  console.log(`[Training] Creating embeddings for ${docs.length} documents...`);
  
  // 保存前のタイムスタンプを記録
  const beforeInsertTime = new Date();
  
  // 各ドキュメントに一意の識別子をmetadataに追加
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
  
  // 使用したembeddingトークン数を計算
  const totalTokens = docs.reduce((sum, doc) => sum + estimateTokens(doc.pageContent), 0);
  return totalTokens;
}

// メイン処理
async function main() {
  try {
    console.log(`[Training] Starting training for site_id: ${siteId}`);
    console.log(`[Training] Markdown folder: ${folderPath}`);

    // サイトの存在確認
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('id, name, user_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      console.error(`[Training] ❌ Site not found: ${siteId}`);
      process.exit(1);
    }

    console.log(`[Training] ✅ Site found: ${site.name} (user_id: ${site.user_id})`);

    // フォルダの存在確認
    try {
      await fs.access(folderPath);
    } catch (error) {
      console.error(`[Training] ❌ Folder not found: ${folderPath}`);
      process.exit(1);
    }

    // 1. マークダウンファイルからデータを抽出
    const rawDocs = await extractDataFromMarkdownFiles(folderPath);

    if (rawDocs.length === 0) {
      console.error('[Training] ❌ No documents found in markdown files');
      process.exit(1);
    }

    // 2. チャンク分割
    console.log('[Training] Splitting documents into chunks...');
    const docs = await splitDocsIntoChunks(rawDocs);
    console.log(`[Training] ✅ Split into ${docs.length} chunks`);

    // 3. 埋め込み生成と保存
    const embeddings = new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      dimensions: 512,
    });

    const embeddingTokens = await embedDocumentsWithSiteId(siteId, docs, embeddings);

    // 4. コスト計算
    const estimatedCostUsd = (embeddingTokens / 1_000_000) * 0.02;

    // 5. サイトステータスを更新
    await supabaseClient
      .from('sites')
      .update({ 
        status: 'ready',
        last_trained_at: new Date().toISOString(),
      })
      .eq('id', siteId);

    console.log('\n[Training] ✅ Training completed successfully!');
    console.log(`[Training] - Documents processed: ${rawDocs.length}`);
    console.log(`[Training] - Chunks created: ${docs.length}`);
    console.log(`[Training] - Embedding tokens used: ${embeddingTokens.toLocaleString()}`);
    console.log(`[Training] - Estimated cost: $${estimatedCostUsd.toFixed(4)}`);

  } catch (error) {
    console.error('[Training] ❌ Error:', error);
    process.exit(1);
  }
}

main();
