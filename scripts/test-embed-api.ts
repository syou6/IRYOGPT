/**
 * 埋め込みAPIのテストスクリプト
 * /api/embed/script と /api/embed/chat をテスト
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3005';

async function testEmbedScript(siteId: string) {
  console.log('📝 1. /api/embed/script のテスト');
  console.log(`   GET ${API_BASE_URL}/api/embed/script?site_id=${siteId}\n`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/embed/script?site_id=${siteId}`, {
      method: 'GET',
    });

    console.log(`   ステータス: ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type');
    console.log(`   Content-Type: ${contentType}`);

    if (!response.ok) {
      const error = await response.text();
      console.log(`   ❌ エラー: ${error}`);
      return false;
    }

    const script = await response.text();
    console.log(`   ✅ スクリプト取得成功 (${script.length} bytes)`);
    
    // スクリプトの内容を確認
    if (script.includes('SiteGPTEmbed')) {
      console.log('   ✅ スクリプトにSiteGPTEmbedが含まれています');
    } else {
      console.log('   ⚠️  スクリプトにSiteGPTEmbedが含まれていません（無効なサイトの可能性）');
    }

    if (script.includes('sitegpt-widget')) {
      console.log('   ✅ ウィジェットHTMLが含まれています');
    }

    console.log('');
    return true;
  } catch (error) {
    console.error(`   ❌ エラー:`, error);
    console.log('');
    return false;
  }
}

async function testEmbedChat(siteId: string) {
  console.log('📝 2. /api/embed/chat のテスト');
  console.log(`   POST ${API_BASE_URL}/api/embed/chat\n`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/embed/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'こんにちは',
        site_id: siteId,
        history: [],
      }),
    });

    console.log(`   ステータス: ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type');
    console.log(`   Content-Type: ${contentType}`);

    if (!response.ok) {
      const error = await response.text();
      console.log(`   ❌ エラー: ${error}`);
      return false;
    }

    // SSE形式のレスポンスを処理
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let receivedData = false;
    let done = false;

    console.log('   📡 ストリーミングレスポンスを受信中...');

    while (!done && reader) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;

      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data === '[DONE]') {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.data) {
                receivedData = true;
                process.stdout.write(parsed.data);
              }
              if (parsed.error) {
                console.log(`\n   ❌ エラー: ${parsed.error}`);
                return false;
              }
            } catch (e) {
              // JSONパースエラーは無視
            }
          }
        }
      }
    }

    console.log('\n');
    if (receivedData) {
      console.log('   ✅ チャット応答取得成功');
    } else {
      console.log('   ⚠️  データを受信できませんでした');
    }

    console.log('');
    return receivedData;
  } catch (error) {
    console.error(`   ❌ エラー:`, error);
    console.log('');
    return false;
  }
}

async function main() {
  console.log('🚀 埋め込みAPIテスト開始\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  // site_idを引数から取得、または環境変数から取得
  const siteId = process.argv[2] || process.env.TEST_SITE_ID;

  if (!siteId) {
    console.error('❌ site_idが必要です');
    console.log('使用方法:');
    console.log('  npm run test:embed <site_id>');
    console.log('または:');
    console.log('  TEST_SITE_ID=<site_id> npm run test:embed');
    console.log('\n例:');
    console.log('  npm run test:embed 123e4567-e89b-12d3-a456-426614174000');
    process.exit(1);
  }

  console.log(`テスト対象サイトID: ${siteId}\n`);
  console.log('='.repeat(60));
  console.log('');

  // テスト1: /api/embed/script
  const scriptTestResult = await testEmbedScript(siteId);

  // テスト2: /api/embed/chat
  const chatTestResult = await testEmbedChat(siteId);

  // 結果サマリー
  console.log('='.repeat(60));
  console.log('📊 テスト結果サマリー\n');
  console.log(`   /api/embed/script: ${scriptTestResult ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`   /api/embed/chat:   ${chatTestResult ? '✅ 成功' : '❌ 失敗'}`);
  console.log('');

  if (scriptTestResult && chatTestResult) {
    console.log('🎉 すべてのテストが成功しました！');
    process.exit(0);
  } else {
    console.log('⚠️  一部のテストが失敗しました');
    console.log('\n確認事項:');
    console.log('  - サイトが存在するか');
    console.log('  - sites.is_embed_enabled が true か');
    console.log('  - sites.status が "ready" か');
    console.log('  - サイトに学習済みのドキュメントがあるか');
    process.exit(1);
  }
}

main();

