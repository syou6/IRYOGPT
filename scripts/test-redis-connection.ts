#!/usr/bin/env tsx
/**
 * Redis接続テストスクリプト
 * 
 * Upstash Redisへの接続をテストします
 */

import 'dotenv/config';
import Redis from 'ioredis';

async function testRedisConnection() {
  console.log('🔍 Redis接続テスト開始\n');

  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379');
  const password = process.env.REDIS_PASSWORD;

  console.log('接続情報:');
  console.log(`  Host: ${host}`);
  console.log(`  Port: ${port}`);
  console.log(`  Password: ${password ? '***設定済み***' : '未設定'}\n`);

  if (!password) {
    console.error('❌ REDIS_PASSWORDが設定されていません');
    console.log('\n.env.localに以下を追加してください:');
    console.log('REDIS_HOST=pleasing-frog-34743.upstash.io');
    console.log('REDIS_PORT=6379');
    console.log('REDIS_PASSWORD=AYe3AAIncDI1ZDczZjEyMDc3N2Q0YjFhOGU1NjFhZTQ5ZmNkZWIzYXAyMzQ3NDM');
    process.exit(1);
  }

  // Upstash RedisはTLS接続が必要
  const isUpstash = host.includes('upstash.io');
  const redis = new Redis({
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(isUpstash && {
      tls: {
        rejectUnauthorized: false, // Upstashの証明書を信頼
      },
    }),
    retryStrategy: (times) => {
      if (times > 3) {
        return null; // リトライを停止
      }
      return Math.min(times * 200, 2000);
    },
  });

  try {
    // 接続テスト
    console.log('📡 Redisに接続中...');
    await redis.ping();
    console.log('✅ 接続成功！\n');

    // 簡単な操作テスト
    console.log('🧪 操作テスト:');
    
    // SET/GETテスト
    await redis.set('test:connection', 'success', 'EX', 10);
    const value = await redis.get('test:connection');
    console.log(`  SET/GET: ${value === 'success' ? '✅ 成功' : '❌ 失敗'}`);

    // キュー操作テスト（BullMQで使用する形式）
    await redis.lpush('test:queue', 'test-job-1');
    const queueLength = await redis.llen('test:queue');
    console.log(`  Queue操作: ${queueLength > 0 ? '✅ 成功' : '❌ 失敗'}`);
    
    // クリーンアップ
    await redis.del('test:connection', 'test:queue');
    console.log('  クリーンアップ: ✅ 完了\n');

    // 接続情報の確認
    const info = await redis.info('server');
    console.log('📊 Redis情報:');
    const redisVersion = info.match(/redis_version:([^\r\n]+)/)?.[1];
    if (redisVersion) {
      console.log(`  Redis Version: ${redisVersion}`);
    }
    console.log(`  Host: ${host}:${port}`);
    console.log('  Status: ✅ 正常\n');

    console.log('🎉 すべてのテストが成功しました！');
    console.log('\n次のステップ:');
    console.log('  1. ワーカーを起動: npm run worker');
    console.log('  2. 学習ジョブを送信して動作確認');

    await redis.quit();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ 接続エラー:');
    console.error(`  ${error.message}\n`);

    if (error.message.includes('ENOTFOUND')) {
      console.log('💡 解決方法:');
      console.log('  - REDIS_HOSTが正しいか確認してください');
      console.log('  - UpstashダッシュボードでRedis Protocol URLを確認してください');
    } else if (error.message.includes('NOAUTH') || error.message.includes('invalid password')) {
      console.log('💡 解決方法:');
      console.log('  - REDIS_PASSWORDが正しいか確認してください');
      console.log('  - Upstashダッシュボードでパスワードを確認してください');
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET')) {
      console.log('💡 解決方法:');
      console.log('  - Redisサーバーが起動しているか確認してください');
      console.log('  - ポート番号が正しいか確認してください');
      if (host.includes('upstash.io')) {
        console.log('  - Upstash RedisはTLS接続が必要です（既に設定済み）');
        console.log('  - Upstashダッシュボードで「Redis Protocol」の接続情報を確認してください');
      }
    }

    await redis.quit();
    process.exit(1);
  }
}

testRedisConnection();

