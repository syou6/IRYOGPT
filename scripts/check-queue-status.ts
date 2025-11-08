#!/usr/bin/env tsx
/**
 * キュー統計確認スクリプト
 * 
 * Redisキューに登録されているジョブの状態を確認します
 */

import 'dotenv/config';
import { trainingQueue } from '../lib/queue';

async function checkQueueStatus() {
  console.log('📊 キュー統計確認\n');

  try {
    const stats = await trainingQueue.getJobCounts();
    
    console.log('ジョブ統計:');
    console.log(`  待機中 (waiting): ${stats.waiting}`);
    console.log(`  実行中 (active): ${stats.active}`);
    console.log(`  完了 (completed): ${stats.completed}`);
    console.log(`  失敗 (failed): ${stats.failed}`);
    console.log(`  遅延 (delayed): ${stats.delayed}`);
    console.log(`  合計: ${stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed}\n`);

    // 待機中のジョブを取得
    if (stats.waiting > 0) {
      console.log('⏳ 待機中のジョブ:');
      const waitingJobs = await trainingQueue.getWaiting();
      waitingJobs.slice(0, 5).forEach((job, index) => {
        console.log(`  ${index + 1}. Job ID: ${job.id}`);
        console.log(`     Site ID: ${job.data.site_id}`);
        console.log(`     Base URL: ${job.data.baseUrl}`);
      });
      if (waitingJobs.length > 5) {
        console.log(`  ... 他 ${waitingJobs.length - 5} 件`);
      }
      console.log('');
    }

    // 実行中のジョブを取得
    if (stats.active > 0) {
      console.log('🔄 実行中のジョブ:');
      const activeJobs = await trainingQueue.getActive();
      activeJobs.forEach((job, index) => {
        console.log(`  ${index + 1}. Job ID: ${job.id}`);
        console.log(`     Site ID: ${job.data.site_id}`);
        console.log(`     Base URL: ${job.data.baseUrl}`);
        console.log(`     進捗: ${JSON.stringify(job.progress || {})}`);
      });
      console.log('');
    }

    // 失敗したジョブを取得
    if (stats.failed > 0) {
      console.log('❌ 失敗したジョブ:');
      const failedJobs = await trainingQueue.getFailed();
      failedJobs.slice(0, 5).forEach((job, index) => {
        console.log(`  ${index + 1}. Job ID: ${job.id}`);
        console.log(`     Site ID: ${job.data.site_id}`);
        console.log(`     試行回数: ${job.attemptsMade}`);
        console.log(`     エラー: ${job.failedReason || 'Unknown'}`);
      });
      if (failedJobs.length > 5) {
        console.log(`  ... 他 ${failedJobs.length - 5} 件`);
      }
      console.log('');
    }

    // ワーカーの状態を推測
    if (stats.waiting > 0 && stats.active === 0) {
      console.log('⚠️  警告: 待機中のジョブがありますが、実行中のジョブがありません');
      console.log('   ワーカーが起動していない可能性があります');
      console.log('   別のターミナルで以下を実行してください:');
      console.log('   npm run worker\n');
    } else if (stats.active > 0) {
      console.log('✅ ワーカーが動作中です\n');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

checkQueueStatus();

