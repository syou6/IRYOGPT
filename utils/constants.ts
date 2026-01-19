/**
 * 予約システム共通定数
 */

// 日付・時刻フォーマット
export const DATE_FORMAT = {
  /** スプレッドシート保存用 (例: 2026/1/27) */
  SHEET: 'yyyy/M/d',
  /** 時刻形式 (例: 9:30) */
  TIME: 'H:mm',
  /** 表示用 (例: 2026年1月27日) */
  DISPLAY: 'yyyy年M月d日',
  /** フル表示用 */
  FULL_DATETIME: 'yyyy/M/d H:mm',
} as const;

// タイムゾーン
export const TIMEZONE = 'Asia/Tokyo';

// スプレッドシートのシート名
export const SHEET_NAMES = {
  SETTINGS: '設定',
  APPOINTMENTS: '予約表',
  HOLIDAYS: '休診日',
} as const;

// スプレッドシートの範囲
export const SHEET_RANGES = {
  SETTINGS: `${SHEET_NAMES.SETTINGS}!A2:B20`,
  APPOINTMENTS: `${SHEET_NAMES.APPOINTMENTS}!A2:J1000`,
  APPOINTMENTS_APPEND: `${SHEET_NAMES.APPOINTMENTS}!A:J`,
  HOLIDAYS: `${SHEET_NAMES.HOLIDAYS}!A2:A100`,
} as const;

// 入力制限
export const LIMITS = {
  /** 患者名の最大文字数 */
  PATIENT_NAME_MAX: 50,
  /** 症状・来院理由の最大文字数 */
  SYMPTOM_MAX: 500,
  /** 電話番号の最小桁数（ハイフンなし） */
  PHONE_MIN_DIGITS: 10,
  /** 電話番号の最大桁数（ハイフンなし） */
  PHONE_MAX_DIGITS: 11,
  /** メールアドレスの最大文字数 */
  EMAIL_MAX: 254,
} as const;

// RAG検索設定
export const RAG_CONFIG = {
  /** 使用するチャンク数 */
  MAX_CHUNKS: 6,
  /** 初期検索時の取得数 */
  MATCH_COUNT: 6,
} as const;

// キャッシュ設定
export const CACHE_CONFIG = {
  /** 設定キャッシュのTTL（ミリ秒） */
  SETTINGS_TTL_MS: 5 * 60 * 1000, // 5分
} as const;

// デフォルト設定値
export const DEFAULT_SETTINGS = {
  SLOT_DURATION: 30,
  MAX_PATIENTS_PER_SLOT: 1,
  MAX_ADVANCE_DAYS: 30,
  START_TIME: '09:00',
  END_TIME: '18:00',
  BREAK_START: '12:00',
  BREAK_END: '13:00',
} as const;

// 曜日名
export const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const;
