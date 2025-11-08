export {};

/**
 * STEP 2 テスト用スクリプト
 * /api/train/url をテストするためのスクリプト
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const API_BASE_URL = 'http://localhost:3005'; // Next.jsの開発サーバーURL

async function testTrainAPI() {
  console.log('🚀 STEP 2 テスト開始\n');

  try {
    // 1. テスト用サイトを作成
    console.log('1. テスト用サイトを作成中...');
    const createSiteResponse = await fetch(`${API_BASE_URL}/api/sites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'STRIX 総合型選抜塾（テスト）',
        baseUrl: 'https://strix-sougougata.com/',
        sitemapUrl: null,
      }),
    });

    if (!createSiteResponse.ok) {
      const error = await createSiteResponse.text();
      throw new Error(`Failed to create site: ${error}`);
    }

    const site = await createSiteResponse.json();
    console.log('✅ サイト作成成功:', site.id);
    console.log('   サイト名:', site.name);
    console.log('   URL:', site.base_url);
    console.log('   ステータス:', site.status);
    console.log('');

    // 2. 学習を開始
    console.log('2. 学習を開始中...');
    const trainResponse = await fetch(`${API_BASE_URL}/api/train/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        site_id: site.id,
        baseUrl: site.base_url,
      }),
    });

    if (!trainResponse.ok) {
      const error = await trainResponse.text();
      throw new Error(`Failed to start training: ${error}`);
    }

    const trainResult = await trainResponse.json();
    console.log('✅ 学習開始成功');
    console.log('   ジョブID:', trainResult.job_id);
    console.log('   ステータス:', trainResult.status);
    console.log('   メッセージ:', trainResult.message);
    console.log('');

    console.log('📝 次のステップ:');
    console.log('   - Supabaseでtraining_jobsテーブルを確認');
    console.log('   - sites.statusが"ready"になるまで待つ');
    console.log('   - documentsテーブルにsite_idが設定されているか確認');
    console.log('');

    // 3. ジョブの状態を確認（5秒待ってから）
    console.log('3. 5秒後にジョブ状態を確認します...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 注意: 実際のジョブ状態確認APIはまだ作成していないので、
    // ここではSupabaseを直接確認する必要があります
    console.log('   ⚠️  ジョブ状態確認APIは未実装のため、Supabaseで直接確認してください');
    console.log('   SQL: SELECT * FROM training_jobs WHERE id = \'' + trainResult.job_id + '\';');

  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

// 実行
testTrainAPI();
