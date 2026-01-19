/**
 * 入力バリデーション関数
 */

import { LIMITS } from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * 日付形式をバリデーション (YYYY/M/D)
 */
export function validateDateFormat(date: string): ValidationResult {
  if (!date || typeof date !== 'string') {
    return { valid: false, error: '日付を入力してください。' };
  }

  const trimmed = date.trim();
  const parts = trimmed.split('/');

  if (parts.length !== 3) {
    return { valid: false, error: '日付はYYYY/M/D形式で入力してください（例: 2026/1/27）' };
  }

  const [yearStr, monthStr, dayStr] = parts;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return { valid: false, error: '日付は数字で入力してください。' };
  }

  if (year < 2000 || year > 2100) {
    return { valid: false, error: '年は2000〜2100の範囲で入力してください。' };
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: '月は1〜12の範囲で入力してください。' };
  }

  if (day < 1 || day > 31) {
    return { valid: false, error: '日は1〜31の範囲で入力してください。' };
  }

  // 月ごとの日数チェック
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return { valid: false, error: `${month}月は${daysInMonth}日までです。` };
  }

  return { valid: true, normalized: `${year}/${month}/${day}` };
}

/**
 * 時刻形式をバリデーション (H:mm)
 */
export function validateTimeFormat(time: string): ValidationResult {
  if (!time || typeof time !== 'string') {
    return { valid: false, error: '時刻を入力してください。' };
  }

  const trimmed = time.trim();
  // 秒がある場合は除去
  const timePart = trimmed.split(':').slice(0, 2).join(':');

  const match = timePart.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return { valid: false, error: '時刻はH:mm形式で入力してください（例: 9:30）' };
  }

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);

  if (hour < 0 || hour > 23) {
    return { valid: false, error: '時は0〜23の範囲で入力してください。' };
  }

  if (minute < 0 || minute > 59) {
    return { valid: false, error: '分は0〜59の範囲で入力してください。' };
  }

  return { valid: true, normalized: `${hour}:${minute.toString().padStart(2, '0')}` };
}

/**
 * 電話番号をバリデーション（国際形式対応）
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: '電話番号を入力してください。' };
  }

  // ハイフン、スペース、括弧を除去
  let normalized = phone.replace(/[-\s()]/g, '');

  // +81 を 0 に変換
  if (normalized.startsWith('+81')) {
    normalized = '0' + normalized.slice(3);
  }

  // 数字のみかチェック
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, error: '電話番号は数字で入力してください。' };
  }

  // 桁数チェック（日本の電話番号: 10〜11桁）
  if (normalized.length < LIMITS.PHONE_MIN_DIGITS || normalized.length > LIMITS.PHONE_MAX_DIGITS) {
    return {
      valid: false,
      error: `電話番号は${LIMITS.PHONE_MIN_DIGITS}〜${LIMITS.PHONE_MAX_DIGITS}桁で入力してください。`
    };
  }

  // 0始まりチェック
  if (!normalized.startsWith('0')) {
    return { valid: false, error: '電話番号は0から始まる番号を入力してください。' };
  }

  return { valid: true, normalized };
}

/**
 * メールアドレスをバリデーション
 */
export function validateEmail(email: string): ValidationResult {
  // 空の場合は許可（任意項目）
  if (!email || email.trim() === '') {
    return { valid: true, normalized: '' };
  }

  const trimmed = email.trim();

  if (trimmed.length > LIMITS.EMAIL_MAX) {
    return { valid: false, error: `メールアドレスは${LIMITS.EMAIL_MAX}文字以内で入力してください。` };
  }

  // 基本的なメールアドレス形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'メールアドレスの形式が正しくありません。' };
  }

  return { valid: true, normalized: trimmed.toLowerCase() };
}

/**
 * 患者名をバリデーション
 */
export function validatePatientName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'お名前を入力してください。' };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'お名前を入力してください。' };
  }

  if (trimmed.length > LIMITS.PATIENT_NAME_MAX) {
    return { valid: false, error: `お名前は${LIMITS.PATIENT_NAME_MAX}文字以内で入力してください。` };
  }

  // 改行文字チェック
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    return { valid: false, error: 'お名前に改行は使用できません。' };
  }

  return { valid: true, normalized: trimmed };
}

/**
 * 症状・来院理由をバリデーション
 */
export function validateSymptom(symptom: string): ValidationResult {
  // 空の場合は許可（任意項目）
  if (!symptom || symptom.trim() === '') {
    return { valid: true, normalized: '' };
  }

  const trimmed = symptom.trim();

  if (trimmed.length > LIMITS.SYMPTOM_MAX) {
    return { valid: false, error: `ご来院の目的は${LIMITS.SYMPTOM_MAX}文字以内で入力してください。` };
  }

  return { valid: true, normalized: trimmed };
}
