/**
 * 埋め込み検索のテストスクリプト
 * 
 * 使用方法:
 * tsx -r dotenv/config scripts/test-embedding-search.ts
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { supabaseClient } from '../utils/supabase-client';

const SITE_ID = '64301a5f-50e2-4bd4-8268-b682633a0857';
const TEST_QUESTION = 'Zettelkastenとは何ですか？';

async function testEmbeddingSearch() {
  console.log('🔍 埋め込み検索のテストを開始します...\n');

  try {
    // 1. 埋め込みベクトルを生成
    console.log('1. 質問の埋め込みベクトルを生成中...');
    const embeddings = new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      dimensions: 512,
    });

    const queryEmbedding = await embeddings.embedQuery(TEST_QUESTION);
    console.log(`   ✅ 埋め込みベクトル生成完了 (${queryEmbedding.length}次元)\n`);

    // 2. match_documents関数を呼び出し
    console.log('2. match_documents関数を実行中...');
    const { data, error } = await supabaseClient.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 10,
      filter: {},
      match_site_id: SITE_ID,
    });

    if (error) {
      console.error('   ❌ エラー:', error);
      return;
    }

    console.log(`   ✅ ${data?.length || 0}件のドキュメントを取得\n`);

    // 3. 結果を表示
    if (data && data.length > 0) {
      console.log('3. 検索結果:');
      console.log('─'.repeat(80));
      
      data.forEach((doc: any, index: number) => {
        console.log(`\n[${index + 1}] Similarity: ${doc.similarity.toFixed(4)}`);
        console.log(`    File: ${doc.metadata?.fileName || 'N/A'}`);
        console.log(`    Title: ${doc.metadata?.title || 'N/A'}`);
        console.log(`    Content Preview: ${doc.content.substring(0, 150)}...`);
      });

      // 4. Similarityスコアの統計
      const similarities = data.map((d: any) => d.similarity);
      const avgSimilarity = similarities.reduce((a: number, b: number) => a + b, 0) / similarities.length;
      const maxSimilarity = Math.max(...similarities);
      const minSimilarity = Math.min(...similarities);

      console.log('\n─'.repeat(80));
      console.log('4. Similarityスコアの統計:');
      console.log(`   最大値: ${maxSimilarity.toFixed(4)}`);
      console.log(`   最小値: ${minSimilarity.toFixed(4)}`);
      console.log(`   平均値: ${avgSimilarity.toFixed(4)}`);
      console.log(`   0.7以上のドキュメント: ${similarities.filter((s: number) => s >= 0.7).length}件`);
      console.log(`   0.5以上のドキュメント: ${similarities.filter((s: number) => s >= 0.5).length}件`);

      // 5. 推奨事項
      console.log('\n─'.repeat(80));
      console.log('5. 推奨事項:');
      if (maxSimilarity < 0.7) {
        console.log('   ⚠️  Similarityスコアが低いです。');
        console.log('   → プロンプトの閾値を下げるか、再学習を検討してください。');
      } else {
        console.log('   ✅ Similarityスコアは良好です。');
      }
    } else {
      console.log('   ⚠️  ドキュメントが見つかりませんでした。');
      console.log('   → site_idが正しいか、埋め込みベクトルが保存されているか確認してください。');
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  }
}

testEmbeddingSearch();

