import { readSheet, appendToSheet, updateSheet } from './google-sheets';
import { format, parse, addMinutes, isAfter, isBefore, isSameDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'Asia/Tokyo';

// 型定義
export interface ClinicSettings {
  clinicName: string;
  startTime: string;      // "09:00"
  endTime: string;        // "18:00"
  breakStart: string;     // "12:00"
  breakEnd: string;       // "14:00"
  slotDuration: number;   // 30 (分)
  maxAdvanceDays: number; // 30 (日)
  closedDays: string[];   // ["日", "祝"]
}

export interface TimeSlot {
  time: string;           // "09:00"
  available: boolean;
  patientName?: string;   // 予約済みの場合
}

export interface Appointment {
  date: string;           // "2025/1/25"
  time: string;           // "10:00"
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  symptom?: string;
  status: string;         // "確定" | "キャンセル"
  bookedVia: string;      // "Bot" | "電話" | "Web"
}

/**
 * 設定シートから医院設定を取得
 */
export async function getClinicSettings(spreadsheetId: string): Promise<ClinicSettings> {
  const data = await readSheet(spreadsheetId, '設定!A2:B10');

  const settings: Record<string, string> = {};
  for (const row of data) {
    if (row[0] && row[1]) {
      settings[row[0]] = row[1];
    }
  }

  return {
    clinicName: settings['医院名'] || '',
    startTime: settings['診療開始時間'] || '09:00',
    endTime: settings['診療終了時間'] || '18:00',
    breakStart: settings['昼休み開始'] || '12:00',
    breakEnd: settings['昼休み終了'] || '14:00',
    slotDuration: parseInt(settings['1枠の時間（分）'] || '30', 10),
    maxAdvanceDays: parseInt(settings['予約可能日数（何日先まで）'] || '30', 10),
    closedDays: (settings['休診曜日'] || '日,祝').split(',').map(s => s.trim()),
  };
}

/**
 * 休診日リストを取得
 */
export async function getHolidays(spreadsheetId: string): Promise<Date[]> {
  const data = await readSheet(spreadsheetId, '休診日!A2:A100');
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
 */
export async function getAppointmentsByDate(
  spreadsheetId: string,
  targetDate: string
): Promise<Appointment[]> {
  const data = await readSheet(spreadsheetId, '予約表!A2:H1000');
  const appointments: Appointment[] = [];

  for (const row of data) {
    if (row[0] === targetDate && row[6] !== 'キャンセル') {
      appointments.push({
        date: row[0],
        time: row[1],
        patientName: row[2] || '',
        patientPhone: row[3] || '',
        patientEmail: row[4] || '',
        symptom: row[5] || '',
        status: row[6] || '確定',
        bookedVia: row[7] || '',
      });
    }
  }

  return appointments;
}

/**
 * 予約表から全予約を取得（日付範囲でフィルタ可能）
 */
export async function getAllAppointments(
  spreadsheetId: string,
  options?: {
    startDate?: string; // YYYY/M/D
    endDate?: string;   // YYYY/M/D
    includeCancel?: boolean;
  }
): Promise<Appointment[]> {
  const data = await readSheet(spreadsheetId, '予約表!A2:H1000');
  const appointments: Appointment[] = [];

  for (const row of data) {
    if (!row[0]) continue; // 日付がない行はスキップ

    const appointment: Appointment = {
      date: row[0],
      time: row[1] || '',
      patientName: row[2] || '',
      patientPhone: row[3] || '',
      patientEmail: row[4] || '',
      symptom: row[5] || '',
      status: row[6] || '確定',
      bookedVia: row[7] || '',
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
  if (settings.closedDays.includes(dayNames[dayOfWeek])) {
    return []; // 定休日は空き枠なし
  }

  // 予約済みの時間をセットに
  const bookedTimes = new Set(existingAppointments.map(a => a.time));

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

    if (!isBreakTime) {
      const isBooked = bookedTimes.has(timeStr);
      const appointment = existingAppointments.find(a => a.time === timeStr);

      slots.push({
        time: timeStr,
        available: !isBooked,
        patientName: isBooked ? appointment?.patientName : undefined,
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

  // 予約を追加
  await appendToSheet(spreadsheetId, '予約表!A:H', [
    [
      appointment.date,
      appointment.time,
      appointment.patientName,
      appointment.patientPhone,
      appointment.patientEmail || '',
      appointment.symptom || '',
      '確定',
      appointment.bookedVia || 'Bot',
    ],
  ]);

  return { success: true, message: '予約が完了しました' };
}

/**
 * 予約をキャンセル（ステータスを「キャンセル」に更新）
 */
export async function cancelAppointment(
  spreadsheetId: string,
  targetDate: string,
  targetTime: string
): Promise<{ success: boolean; message: string; rowIndex?: number }> {
  // 予約表を全件取得して該当行を探す
  const data = await readSheet(spreadsheetId, '予約表!A2:H1000');

  let rowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === targetDate && data[i][1] === targetTime && data[i][6] !== 'キャンセル') {
      rowIndex = i + 2; // ヘッダー行を考慮
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, message: '該当する予約が見つかりません' };
  }

  // ステータスを「キャンセル」に更新
  await updateSheet(spreadsheetId, `予約表!G${rowIndex}`, [['キャンセル']]);

  return { success: true, message: '予約をキャンセルしました', rowIndex };
}
