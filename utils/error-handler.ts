/**
 * エラーハンドリング ユーティリティ
 *
 * 本番環境では内部エラー情報を隠蔽し、
 * 開発環境では詳細なエラー情報を表示
 */

/**
 * APIレスポンス用のエラーメッセージを取得
 * 本番環境では汎用メッセージを返し、開発環境では詳細を返す
 */
export function getSafeErrorMessage(
  error: unknown,
  fallbackMessage = 'An unexpected error occurred'
): string {
  if (process.env.NODE_ENV === 'production') {
    return fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * ストリーミングレスポンス用のエラーメッセージを取得
 */
export function getSafeStreamingError(error: unknown): string {
  if (process.env.NODE_ENV === 'production') {
    return 'エラーが発生しました。しばらく経ってからお試しください。';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * エラーオブジェクトからメッセージを抽出（内部ログ用）
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * 認証エラーかどうかを判定
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message === 'Unauthorized';
  }
  return false;
}

/**
 * 管理者未設定エラーかどうかを判定
 */
export function isAdminNotConfiguredError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message === 'AdminNotConfigured';
  }
  return false;
}

/**
 * 権限エラーかどうかを判定
 */
export function isForbiddenError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message === 'Forbidden';
  }
  return false;
}
