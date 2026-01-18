#!/usr/bin/env tsx
/**
 * 学習ジョブワーカー起動スクリプト
 *
 * 使用方法:
 *   npm run worker
 *
 * または:
 *   tsx scripts/start-worker.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.local を明示的に読み込む（Next.js プロジェクト用）
config({ path: resolve(process.cwd(), '.env.local') });

// 環境変数を先に読み込んでから動的importする
async function main() {
  await import('../workers/training-worker');
}

main().catch(console.error);

