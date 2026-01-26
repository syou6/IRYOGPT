/**
 * CORS ユーティリティ
 *
 * 埋め込みチャット用のCORS設定を管理
 */

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * URLからオリジン（プロトコル + ドメイン）を抽出
 */
export function extractOriginFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * リクエストのOriginがサイトのbase_urlと一致するか検証
 *
 * @param requestOrigin リクエストのOriginヘッダー
 * @param siteBaseUrl サイトのbase_url
 * @returns 許可されたオリジン、または null
 */
export function validateOrigin(
  requestOrigin: string | undefined,
  siteBaseUrl: string | null | undefined
): string | null {
  // Originヘッダーがない場合（同一オリジンリクエストなど）
  if (!requestOrigin) {
    return null;
  }

  // base_urlが設定されていない場合は許可しない（セキュリティ優先）
  // ただし、開発環境ではlocalhostを許可
  if (!siteBaseUrl) {
    if (isLocalhost(requestOrigin) && process.env.NODE_ENV === 'development') {
      return requestOrigin;
    }
    return null;
  }

  // base_urlからオリジンを抽出
  const allowedOrigin = extractOriginFromUrl(siteBaseUrl);
  if (!allowedOrigin) {
    return null;
  }

  // オリジンが一致するか確認
  if (requestOrigin === allowedOrigin) {
    return requestOrigin;
  }

  // localhostからのリクエストは開発環境のみ許可
  if (isLocalhost(requestOrigin) && process.env.NODE_ENV === 'development') {
    return requestOrigin;
  }

  return null;
}

/**
 * localhostかどうかを判定
 */
function isLocalhost(origin: string): boolean {
  return (
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('https://127.0.0.1')
  );
}

/**
 * CORSヘッダーを設定
 *
 * @param req NextApiRequest
 * @param res NextApiResponse
 * @param siteBaseUrl サイトのbase_url
 * @returns 許可された場合はtrue、拒否された場合はfalse
 */
export function setCorsHeaders(
  req: NextApiRequest,
  res: NextApiResponse,
  siteBaseUrl: string | null | undefined
): boolean {
  const requestOrigin = req.headers.origin;
  const allowedOrigin = validateOrigin(requestOrigin, siteBaseUrl);

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (requestOrigin) {
    // オリジンがあるが許可されていない場合
    // CORSヘッダーを設定しない（ブラウザがブロックする）
    console.warn(`[CORS] Origin not allowed: ${requestOrigin}`);
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  return !!allowedOrigin || !requestOrigin;
}

/**
 * プリフライトリクエスト（OPTIONS）を処理
 */
export function handlePreflight(
  req: NextApiRequest,
  res: NextApiResponse,
  siteBaseUrl?: string | null
): boolean {
  if (req.method === 'OPTIONS') {
    const requestOrigin = req.headers.origin;
    const allowedOrigin = validateOrigin(requestOrigin, siteBaseUrl);

    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24時間キャッシュ
    res.status(204).end();
    return true;
  }
  return false;
}
