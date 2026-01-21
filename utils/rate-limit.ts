/**
 * レートリミット ユーティリティ
 *
 * Upstash Redisを使用したレートリミット
 * 環境変数が設定されていない場合はスキップ
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextApiRequest, NextApiResponse } from 'next';

// Upstash Redis クライアント（環境変数がある場合のみ初期化）
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// レートリミッターの種類
export const rateLimiters = {
  // 通常のAPI: 1分間に30リクエスト
  standard: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        analytics: true,
        prefix: 'ratelimit:standard',
      })
    : null,

  // チャットAPI: 1分間に10リクエスト（コストが高い）
  chat: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
        prefix: 'ratelimit:chat',
      })
    : null,

  // 埋め込みチャット: 1分間に20リクエスト
  embedChat: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        analytics: true,
        prefix: 'ratelimit:embed',
      })
    : null,

  // 学習API: 1時間に5リクエスト（非常にコストが高い）
  training: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 h'),
        analytics: true,
        prefix: 'ratelimit:training',
      })
    : null,

  // お問い合わせ: 1時間に5リクエスト（スパム防止）
  contact: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 h'),
        analytics: true,
        prefix: 'ratelimit:contact',
      })
    : null,

  // 予約API: 1分間に10リクエスト
  appointment: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
        prefix: 'ratelimit:appointment',
      })
    : null,
};

type RateLimiterType = keyof typeof rateLimiters;

/**
 * クライアントのIPアドレスを取得
 */
function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * レートリミットをチェック
 *
 * @param req - NextApiRequest
 * @param res - NextApiResponse
 * @param type - レートリミッターの種類
 * @returns true: 許可, false: 制限超過
 */
export async function checkRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  type: RateLimiterType = 'standard'
): Promise<boolean> {
  const limiter = rateLimiters[type];

  // Redisが設定されていない場合はスキップ
  if (!limiter) {
    console.warn('[RateLimit] Redis not configured, skipping rate limit');
    return true;
  }

  const ip = getClientIp(req);
  const identifier = `${type}:${ip}`;

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    // レスポンスヘッダーにレートリミット情報を追加
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', reset.toString());

    if (!success) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'リクエスト数が上限に達しました。しばらく待ってから再度お試しください。',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('[RateLimit] Error:', error);
    // エラー時はリクエストを許可（フェイルオープン）
    return true;
  }
}

/**
 * レートリミットミドルウェアを作成
 */
export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  type: RateLimiterType = 'standard'
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const allowed = await checkRateLimit(req, res, type);
    if (!allowed) return;
    return handler(req, res);
  };
}
