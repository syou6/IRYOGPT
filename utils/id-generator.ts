/**
 * 安全なID生成ユーティリティ
 *
 * Math.random()ではなく、cryptoを使用して暗号学的に安全なIDを生成
 */

import crypto from 'crypto';

/**
 * セッションIDを生成
 * @returns 暗号学的に安全なセッションID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * 一意のIDを生成
 * @param prefix プレフィックス
 * @returns 暗号学的に安全な一意のID
 */
export function generateUniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(12).toString('hex')}`;
}
