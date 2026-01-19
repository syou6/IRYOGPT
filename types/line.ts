/**
 * LINE Messaging API 関連の型定義
 */

/**
 * LINE チャネル設定
 */
export interface LineChannelConfig {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
}

/**
 * LINE ユーザー情報（DBに保存）
 */
export interface LineUser {
  id: string;
  siteId: string;
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * サイトの LINE 設定（sites テーブルから取得）
 */
export interface SiteLineConfig {
  id: string;
  userId: string;
  lineChannelId: string | null;
  lineChannelSecret: string | null;
  lineChannelAccessToken: string | null;
  lineEnabled: boolean;
  spreadsheetId: string | null;
  chatMode: 'rag_only' | 'appointment_only' | 'hybrid' | null;
}

/**
 * LINE Webhook イベント共通
 */
export interface LineWebhookEvent {
  type: string;
  timestamp: number;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
}

/**
 * LINE テキストメッセージイベント
 */
export interface LineMessageEvent extends LineWebhookEvent {
  type: 'message';
  message: {
    type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
    id: string;
    text?: string; // text タイプの場合のみ
  };
}

/**
 * LINE フォローイベント
 */
export interface LineFollowEvent extends LineWebhookEvent {
  type: 'follow';
}

/**
 * LINE アンフォローイベント
 */
export interface LineUnfollowEvent extends LineWebhookEvent {
  type: 'unfollow';
}

/**
 * LINE プロフィール情報（API レスポンス）
 */
export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

/**
 * LINE 返信メッセージ
 */
export interface LineReplyMessage {
  type: 'text';
  text: string;
}

/**
 * LINE Push メッセージ
 */
export interface LinePushMessage {
  to: string;
  messages: LineReplyMessage[];
}

/**
 * LINE API エラーレスポンス
 */
export interface LineApiError {
  message: string;
  details?: Array<{
    message: string;
    property: string;
  }>;
}

/**
 * LINE Webhook リクエストボディ
 */
export interface LineWebhookBody {
  destination: string;
  events: Array<LineMessageEvent | LineFollowEvent | LineUnfollowEvent>;
}
