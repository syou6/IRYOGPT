import { readSheet, appendToSheet, updateSheet } from './google-sheets';
import { format, parse, addMinutes, isAfter, isBefore, isSameDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { TIMEZONE, DEFAULT_SETTINGS, SHEET_NAMES, SHEET_RANGES, CACHE_CONFIG } from './constants';

// 設定キャッシュ（スプレッドシートIDごと）
interface CacheEntry {
  settings: ClinicSettings;
  cachedAt: number;
}
const settingsCache = new Map<string, CacheEntry>();

// 型定義
export interface ClinicSettings {
  clinicName: string;
  startTime: string;      // "09:00"
  endTime: string;        // "18:00"
  breakStart: string;     // "12:00"
  breakEnd: string;       // "14:00"
  slotDuration: number;   // 30 (分)
  maxAdvanceDays: number; // 30 (日)
  closedDays: string[];   // ["日", "祝"] - 終日休診
  closedDaysMorning: string[];  // ["水"] - 午前休診
  closedDaysAfternoon: string[]; // ["火", "土"] - 午後休診
  maxPatientsPerSlot: number; // 同時間帯の予約可能数（デフォルト1）
  // オプション項目
  usePatientCardNumber: boolean;  // 診察券番号を使用するか
  useDoctorSelection: boolean;    // 担当医選択を使用するか
  doctorList: string[];           // 担当医リスト ["田中先生", "山田先生"]
}

export interface TimeSlot {
  time: string;           // "09:00"
  available: boolean;
  patientName?: string;   // 予約済みの場合
  bookedCount: number;    // この時間帯の予約数
  remainingSlots: number; // 残り予約可能数
}

export interface Appointment {
  date: string;           // "2025/1/25"
  time: string;           // "10:00"
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  patientCardNumber?: string;  // 診察券番号（任意）
  doctor?: string;             // 担当医（任意）
  symptom?: string;
  status: string;         // "確定" | "キャンセル"
  bookedVia: string;      // "Bot" | "電話" | "Web"
}

/**
 * 設定シートから医院設定を取得（5分間キャッシュ）
 */
export async function getClinicSettings(spreadsheetId: string): Promise<ClinicSettings> {
  // キャッシュを確認
  const cached = settingsCache.get(spreadsheetId);
  if (cached && Date.now() - cached.cachedAt < CACHE_CONFIG.SETTINGS_TTL_MS) {
    return cached.settings;
  }

  let data: any[][];
  try {
    data = await readSheet(spreadsheetId, SHEET_RANGES.SETTINGS);
  } catch (error) {
    console.error('[getClinicSettings] Failed to read settings sheet:', error);
    // デフォルト設定を返す（キャッシュはしない）
    return {
      clinicName: '医院',
      startTime: DEFAULT_SETTINGS.START_TIME,
      endTime: DEFAULT_SETTINGS.END_TIME,
      breakStart: DEFAULT_SETTINGS.BREAK_START,
      breakEnd: DEFAULT_SETTINGS.BREAK_END,
      slotDuration: DEFAULT_SETTINGS.SLOT_DURATION,
      maxAdvanceDays: DEFAULT_SETTINGS.MAX_ADVANCE_DAYS,
      closedDays: [],
      closedDaysMorning: [],
      closedDaysAfternoon: [],
      maxPatientsPerSlot: DEFAULT_SETTINGS.MAX_PATIENTS_PER_SLOT,
      usePatientCardNumber: false,
      useDoctorSelection: false,
      doctorList: [],
    };
  }

  const settings: Record<string, string> = {};
  for (const row of data) {
    if (row[0] && row[1]) {
      // キーと値の両方から余分な空白を除去
      const key = row[0].toString().trim();
      const value = row[1].toString().trim();
      settings[key] = value;
    }
  }

  // デバッグログ
  console.log('[ClinicSettings] Raw settings:', JSON.stringify(settings, null, 2));

  // 曜日文字列をパースするヘルパー（「火曜日の午後」→「火」に正規化）
  const parseDays = (str: string): string[] => {
    if (!str) return [];
    return str.split(',').map(s => {
      const trimmed = s.trim();
      // 「火曜日の午後」「火曜」「火」などから曜日1文字を抽出
      const match = trimmed.match(/^(日|月|火|水|木|金|土)/);
      return match ? match[1] : trimmed;
    }).filter(s => s.length > 0);
  };

  // 後方互換性: 「休診曜日」に「〜の午後」「〜の午前」が含まれている場合は分離
  const rawClosedDays = settings['休診曜日'] || '';
  let closedDays: string[] = [];
  let closedDaysMorning: string[] = [];
  let closedDaysAfternoon: string[] = [];

  // 新しいフィールドがある場合はそちらを優先
  if (settings['休診曜日（終日）'] || settings['休診曜日（午前）'] || settings['休診曜日（午後）']) {
    closedDays = parseDays(settings['休診曜日（終日）'] || '');
    closedDaysMorning = parseDays(settings['休診曜日（午前）'] || '');
    closedDaysAfternoon = parseDays(settings['休診曜日（午後）'] || '');
  } else {
    // 後方互換: 旧形式をパース
    const parts = rawClosedDays.split(',').map(s => s.trim());
    for (const part of parts) {
      if (part.includes('午後')) {
        const match = part.match(/^(日|月|火|水|木|金|土)/);
        if (match) closedDaysAfternoon.push(match[1]);
      } else if (part.includes('午前')) {
        const match = part.match(/^(日|月|火|水|木|金|土)/);
        if (match) closedDaysMorning.push(match[1]);
      } else {
        const match = part.match(/^(日|月|火|水|木|金|土|祝)/);
        if (match) closedDays.push(match[1]);
        else if (part) closedDays.push(part); // 「祝」などそのまま
      }
    }
  }

  console.log('[ClinicSettings] closedDays:', closedDays);
  console.log('[ClinicSettings] closedDaysMorning:', closedDaysMorning);
  console.log('[ClinicSettings] closedDaysAfternoon:', closedDaysAfternoon);

  const result: ClinicSettings = {
    clinicName: settings['医院名'] || '',
    startTime: settings['診療開始時間'] || '09:00',
    endTime: settings['診療終了時間'] || '18:00',
    breakStart: settings['昼休み開始'] || '12:00',
    breakEnd: settings['昼休み終了'] || '14:00',
    slotDuration: parseInt(settings['1枠の時間（分）'] || '30', 10),
    maxAdvanceDays: parseInt(settings['予約可能日数（何日先まで）'] || '30', 10),
    closedDays,
    closedDaysMorning,
    closedDaysAfternoon,
    maxPatientsPerSlot: parseInt(settings['同時間帯の予約可能数'] || '1', 10),
    // オプション項目（「はい」「あり」「する」「true」などを許容）
    usePatientCardNumber: ['はい', 'あり', 'する', 'true', 'yes', 'TRUE', 'YES'].includes(settings['診察券番号を使用'] || ''),
    useDoctorSelection: ['はい', 'あり', 'する', 'true', 'yes', 'TRUE', 'YES'].includes(settings['担当医選択を使用'] || ''),
    doctorList: settings['担当医リスト']
      ? settings['担当医リスト'].split(',').map(s => s.trim())
      : [],
  };

  // キャッシュに保存
  settingsCache.set(spreadsheetId, {
    settings: result,
    cachedAt: Date.now(),
  });

  return result;
}

/**
 * 休診日リストを取得
 */
export async function getHolidays(spreadsheetId: string): Promise<Date[]> {
  const data = await readSheet(spreadsheetId, SHEET_RANGES.HOLIDAYS);
  const holidays: Date[] = [];

  for (const row of data) {
    if (row[0]) {
      try {
        const date = parse(row[0], 'yyyy/M/d', new Date());
        holidays.push(date);
      } catch {
        // パースできない日付はスキップ
      }
    }
  }

  return holidays;
}

/**
 * 予約表から指定日の予約を取得
 * カラム順: 日付, 時間, 患者名, 電話番号, メール, 診察券番号, 担当医, 症状, ステータス, 予約経由
 */
export async function getAppointmentsByDate(
  spreadsheetId: string,
  targetDate: string
): Promise<Appointment[]> {
  const data = await readSheet(spreadsheetId, SHEET_RANGES.APPOINTMENTS);
  const appointments: Appointment[] = [];

  for (const row of data) {
    if (row[0] === targetDate && row[8] !== 'キャンセル') {
      appointments.push({
        date: row[0],
        time: row[1],
        patientName: row[2] || '',
        patientPhone: row[3] || '',
        patientEmail: row[4] || '',
        patientCardNumber: row[5] || '',
        doctor: row[6] || '',
        symptom: row[7] || '',
        status: row[8] || '確定',
        bookedVia: row[9] || '',
      });
    }
  }

  return appointments;
}

/**
 * 予約表から全予約を取得（日付範囲でフィルタ可能）
 * カラム順: 日付, 時間, 患者名, 電話番号, メール, 診察券番号, 担当医, 症状, ステータス, 予約経由
 */
export async function getAllAppointments(
  spreadsheetId: string,
  options?: {
    startDate?: string; // YYYY/M/D
    endDate?: string;   // YYYY/M/D
    includeCancel?: boolean;
  }
): Promise<Appointment[]> {
  const data = await readSheet(spreadsheetId, SHEET_RANGES.APPOINTMENTS);
  const appointments: Appointment[] = [];

  for (const row of data) {
    if (!row[0]) continue; // 日付がない行はスキップ

    const appointment: Appointment = {
      date: row[0],
      time: row[1] || '',
      patientName: row[2] || '',
      patientPhone: row[3] || '',
      patientEmail: row[4] || '',
      patientCardNumber: row[5] || '',
      doctor: row[6] || '',
      symptom: row[7] || '',
      status: row[8] || '確定',
      bookedVia: row[9] || '',
    };

    // キャンセル済みをフィルタ
    if (!options?.includeCancel && appointment.status === 'キャンセル') {
      continue;
    }

    // 日付範囲でフィルタ
    if (options?.startDate || options?.endDate) {
      const appointmentDate = parse(appointment.date, 'yyyy/M/d', new Date());

      if (options.startDate) {
        const start = parse(options.startDate, 'yyyy/M/d', new Date());
        if (isBefore(appointmentDate, start)) continue;
      }

      if (options.endDate) {
        const end = parse(options.endDate, 'yyyy/M/d', new Date());
        if (isAfter(appointmentDate, end)) continue;
      }
    }

    appointments.push(appointment);
  }

  // 日付・時間でソート
  appointments.sort((a, b) => {
    const dateA = parse(a.date, 'yyyy/M/d', new Date());
    const dateB = parse(b.date, 'yyyy/M/d', new Date());
    if (!isSameDay(dateA, dateB)) {
      return dateA.getTime() - dateB.getTime();
    }
    return a.time.localeCompare(b.time);
  });

  return appointments;
}

/**
 * 指定日の空き枠を取得
 */
export async function getAvailableSlots(
  spreadsheetId: string,
  targetDate: string
): Promise<TimeSlot[]> {
  const settings = await getClinicSettings(spreadsheetId);
  const holidays = await getHolidays(spreadsheetId);
  const existingAppointments = await getAppointmentsByDate(spreadsheetId, targetDate);

  // 日付をパース
  const date = parse(targetDate, 'yyyy/M/d', new Date());

  // 休診日チェック
  const isHoliday = holidays.some(h => isSameDay(h, date));
  if (isHoliday) {
    return []; // 休診日は空き枠なし
  }

  // 曜日チェック（日曜=0, 月曜=1, ...）
  const dayOfWeek = date.getDay();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dayName = dayNames[dayOfWeek];

  if (settings.closedDays.includes(dayName)) {
    return []; // 終日休診は空き枠なし
  }

  // 午前/午後休診チェック用フラグ
  const isMorningClosed = settings.closedDaysMorning.includes(dayName);
  const isAfternoonClosed = settings.closedDaysAfternoon.includes(dayName);

  // 時間を正規化する関数（秒を除去: "9:00:00" → "9:00", "09:00" → "9:00"）
  const normalizeTime = (t: string) => {
    const parts = t.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parts[1] || '00';
    return `${hour}:${minute}`;
  };

  // 各時間帯の予約数をカウント
  const bookingCountByTime = new Map<string, number>();
  for (const appointment of existingAppointments) {
    const normalizedTime = normalizeTime(appointment.time);
    const currentCount = bookingCountByTime.get(normalizedTime) || 0;
    bookingCountByTime.set(normalizedTime, currentCount + 1);
  }

  // 全時間枠を生成
  const slots: TimeSlot[] = [];
  const startTime = parse(settings.startTime, 'HH:mm', new Date());
  const endTime = parse(settings.endTime, 'HH:mm', new Date());
  const breakStart = parse(settings.breakStart, 'HH:mm', new Date());
  const breakEnd = parse(settings.breakEnd, 'HH:mm', new Date());

  let currentTime = startTime;

  while (isBefore(currentTime, endTime)) {
    // スプレッドシートの形式に合わせる（ゼロパディングなし: "9:00" 形式）
    const timeStr = format(currentTime, 'H:mm');

    // 昼休み中はスキップ
    const isBreakTime =
      (isAfter(currentTime, breakStart) || format(currentTime, 'H:mm') === format(breakStart, 'H:mm')) &&
      isBefore(currentTime, breakEnd);

    // 午前/午後の判定（昼休み開始前 = 午前、昼休み終了後 = 午後）
    const isMorningTime = isBefore(currentTime, breakStart);
    const isAfternoonTime = !isBefore(currentTime, breakEnd);

    // 午前休診で午前の時間帯 → スキップ
    if (isMorningClosed && isMorningTime) {
      currentTime = addMinutes(currentTime, settings.slotDuration);
      continue;
    }

    // 午後休診で午後の時間帯 → スキップ
    if (isAfternoonClosed && isAfternoonTime) {
      currentTime = addMinutes(currentTime, settings.slotDuration);
      continue;
    }

    if (!isBreakTime) {
      const bookedCount = bookingCountByTime.get(timeStr) || 0;
      const remainingSlots = settings.maxPatientsPerSlot - bookedCount;
      const isAvailable = remainingSlots > 0;

      // 予約者名リスト（複数予約可能な場合）
      const appointmentsAtTime = existingAppointments.filter(a => normalizeTime(a.time) === timeStr);
      const patientNames = appointmentsAtTime.map(a => a.patientName).join('、');

      slots.push({
        time: timeStr,
        available: isAvailable,
        patientName: bookedCount > 0 ? patientNames : undefined,
        bookedCount,
        remainingSlots: Math.max(0, remainingSlots),
      });
    }

    currentTime = addMinutes(currentTime, settings.slotDuration);
  }

  return slots;
}

/**
 * 予約を作成
 */
export async function createAppointment(
  spreadsheetId: string,
  appointment: Omit<Appointment, 'status' | 'bookedVia'> & { bookedVia?: string }
): Promise<{ success: boolean; message: string }> {
  // 空き枠を再確認（競合防止）
  const slots = await getAvailableSlots(spreadsheetId, appointment.date);
  const targetSlot = slots.find(s => s.time === appointment.time);

  if (!targetSlot) {
    return { success: false, message: 'この時間帯は予約できません' };
  }

  if (!targetSlot.available) {
    return { success: false, message: 'この枠は既に予約されています' };
  }

  // 予約を追加（カラム: 日付, 時間, 患者名, 電話番号, メール, 診察券番号, 担当医, 症状, ステータス, 予約経由）
  await appendToSheet(spreadsheetId, SHEET_RANGES.APPOINTMENTS_APPEND, [
    [
      appointment.date,
      appointment.time,
      appointment.patientName,
      appointment.patientPhone,
      appointment.patientEmail || '',
      appointment.patientCardNumber || '',
      appointment.doctor || '',
      appointment.symptom || '',
      '確定',
      appointment.bookedVia || 'Bot',
    ],
  ]);

  return { success: true, message: '予約が完了しました' };
}

/**
 * 予約をキャンセル（ステータスを「キャンセル」に更新）
 * カラム順: 日付, 時間, 患者名, 電話番号, メール, 診察券番号, 担当医, 症状, ステータス, 予約経由
 */
export async function cancelAppointment(
  spreadsheetId: string,
  targetDate: string,
  targetTime: string
): Promise<{ success: boolean; message: string; rowIndex?: number }> {
  // 予約表を全件取得して該当行を探す
  const data = await readSheet(spreadsheetId, SHEET_RANGES.APPOINTMENTS);

  let rowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === targetDate && data[i][1] === targetTime && data[i][8] !== 'キャンセル') {
      rowIndex = i + 2; // ヘッダー行を考慮
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, message: '該当する予約が見つかりません' };
  }

  // ステータスを「キャンセル」に更新（I列 = index 8）
  await updateSheet(spreadsheetId, `${SHEET_NAMES.APPOINTMENTS}!I${rowIndex}`, [['キャンセル']]);

  return { success: true, message: '予約をキャンセルしました', rowIndex };
}
