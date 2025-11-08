#!/usr/bin/env tsx
/**
 * 学習ジョブワーカー起動スクリプト
 * 
 * 使用方法:
 *   npm run worker
 * 
 * または:
 *   tsx -r dotenv/config scripts/start-worker.ts
 */

import 'dotenv/config';
import '../workers/training-worker';

// ワーカーは training-worker.ts で自動起動される
// このファイルは環境変数を読み込むためのエントリーポイント

