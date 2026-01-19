/**
 * サニタイズ（無害化）関数
 */

/**
 * スプレッドシート用サニタイズ
 * 計算式インジェクションを防止
 */
export function sanitizeForSheet(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();

  // 計算式として解釈される可能性のある先頭文字を無力化
  // =, @, +, -, 数字で始まる場合に ' を先頭に追加
  if (/^[=@+\-]/.test(trimmed)) {
    return `'${trimmed}`;
  }

  return trimmed;
}

/**
 * プロンプト用サニタイズ
 * プロンプトインジェクションを防止
 */
export function sanitizeForPrompt(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value
    // 改行を半角スペースに置換
    .replace(/[\r\n]+/g, ' ')
    // バッククォートを除去（テンプレートリテラル対策）
    .replace(/`/g, '')
    // ${ を除去（テンプレートリテラル対策）
    .replace(/\$\{/g, '')
    // 制御文字を除去
    .replace(/[\x00-\x1F\x7F]/g, '')
    // 連続スペースを単一に
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 日付を正規化 (YYYY/M/D形式)
 */
export function normalizeDate(date: string): string {
  if (!date || typeof date !== 'string') {
    return '';
  }

  const trimmed = date.trim();

  // すでにYYYY/M/D形式の場合
  const match = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    return `${year}/${month}/${day}`;
  }

  // YYYY-MM-DD形式の場合
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return `${year}/${month}/${day}`;
  }

  return trimmed;
}

/**
 * 時刻を正規化 (H:mm形式)
 */
export function normalizeTime(time: string): string {
  if (!time || typeof time !== 'string') {
    return '';
  }

  const trimmed = time.trim();

  // H:mm:ss形式の場合、秒を除去
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    return `${hour}:${minute.toString().padStart(2, '0')}`;
  }

  return trimmed;
}

/**
 * 電話番号を正規化（ハイフンなしの数字のみ）
 */
export function normalizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // ハイフン、スペース、括弧を除去
  let normalized = phone.replace(/[-\s()]/g, '');

  // +81 を 0 に変換
  if (normalized.startsWith('+81')) {
    normalized = '0' + normalized.slice(3);
  }

  return normalized;
}

/**
 * 「なし」「特になし」などの正規化
 */
export function normalizeOptionalValue(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim().toLowerCase();

  // 「なし」と同等の表現を正規化
  const noneValues = [
    'なし',
    '無し',
    'ナシ',
    '特になし',
    '特にない',
    '特にありません',
    'ない',
    'ありません',
    'なし。',
    '-',
    '',
  ];

  if (noneValues.includes(trimmed)) {
    return '';
  }

  return value.trim();
}

/**
 * 予約データ全体をサニタイズ
 */
export interface AppointmentData {
  date: string;
  time: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  patientCardNumber?: string;
  doctor?: string;
  symptom?: string;
}

export function sanitizeAppointmentData(data: AppointmentData): AppointmentData {
  return {
    date: normalizeDate(data.date),
    time: normalizeTime(data.time),
    patientName: sanitizeForSheet(data.patientName),
    patientPhone: normalizePhone(data.patientPhone),
    patientEmail: data.patientEmail ? sanitizeForSheet(data.patientEmail) : '',
    patientCardNumber: normalizeOptionalValue(data.patientCardNumber || ''),
    doctor: normalizeOptionalValue(data.doctor || ''),
    symptom: data.symptom ? sanitizeForSheet(data.symptom) : '',
  };
}
