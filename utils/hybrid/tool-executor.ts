/**
 * ハイブリッドモード用のツール実行ロジック
 */

import {
  getAvailableSlots,
  createAppointment,
  cancelAppointment,
  getClinicSettings,
  getAppointmentsByDate,
  TimeSlot,
} from '../appointment';
import { sendAppointmentConfirmationEmail } from '../email';
import {
  validateDateFormat,
  validateTimeFormat,
  validatePhone,
  validateEmail,
  validatePatientName,
  validateSymptom,
} from '../validators';
import {
  sanitizeForSheet,
  normalizeOptionalValue,
} from '../sanitizers';
import { formatDateJP } from './prompt-builder';
import { supabaseClient } from '../supabase-client';

export interface ToolExecutorContext {
  lineUserId?: string;
  source?: string;
  siteId?: string;
}

/**
 * ツール呼び出しを実行
 */
export async function executeToolCall(
  spreadsheetId: string,
  toolCall: { name: string; args: any },
  context?: ToolExecutorContext
): Promise<string> {
  const { name, args } = toolCall;

  switch (name) {
    case 'get_date_info':
      return executeDateInfo(args);

    case 'get_available_slots':
      return executeGetAvailableSlots(spreadsheetId, args, context?.siteId);

    case 'create_appointment':
      return executeCreateAppointment(spreadsheetId, args, context);

    case 'get_clinic_info':
      return executeGetClinicInfo(spreadsheetId);

    case 'cancel_appointment':
      return executeCancelAppointment(spreadsheetId, args);

    default:
      return `Unknown tool: ${name}`;
  }
}

function executeDateInfo(args: any): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  try {
    const [year, month, day] = args.date.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = dayNames[date.getDay()];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let relativeInfo = '';
    if (diffDays === 0) relativeInfo = '（今日）';
    else if (diffDays === 1) relativeInfo = '（明日）';
    else if (diffDays === 2) relativeInfo = '（明後日）';
    else if (diffDays > 0) relativeInfo = `（${diffDays}日後）`;
    else relativeInfo = '（過去の日付）';

    return `${args.date}は${dayOfWeek}曜日です${relativeInfo}`;
  } catch (e) {
    return `日付の形式が正しくありません。YYYY/M/D形式で指定してください（例: 2026/1/27）`;
  }
}

async function executeGetAvailableSlots(spreadsheetId: string, args: any, siteId?: string): Promise<string> {
  const dateValidation = validateDateFormat(args.date);
  if (!dateValidation.valid) {
    return dateValidation.error || '日付の形式が正しくありません。';
  }

  const settings = await getClinicSettings(spreadsheetId);
  const [year, month, day] = dateValidation.normalized!.split('/').map(Number);
  const targetDate = new Date(year, month - 1, day);
  targetDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (targetDate < today) {
    return `${args.date}は過去の日付です。本日以降の日付をお選びください。`;
  }

  const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > settings.maxAdvanceDays) {
    const maxDate = new Date(today.getTime() + settings.maxAdvanceDays * 24 * 60 * 60 * 1000);
    return `${args.date}は予約可能期間外です。${settings.maxAdvanceDays}日先（${formatDateJP(maxDate)}）までの日付をお選びください。`;
  }

  const slots = await getAvailableSlots(spreadsheetId, args.date, siteId);
  console.log(`[Tool] get_available_slots for ${args.date}:`, JSON.stringify(slots, null, 2));

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const [y, m, d] = dateValidation.normalized!.split('/').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayOfWeek = dayNames[dateObj.getDay()];
  const dateWithDay = `${args.date}（${dayOfWeek}）`;

  if (slots.length === 0) {
    return `【${dateWithDay}】休診日のため予約枠がありません。別の日をお選びください。`;
  }

  const availableSlots = slots.filter((s: TimeSlot) => s.available);
  const bookedSlots = slots.filter((s: TimeSlot) => !s.available);

  if (availableSlots.length === 0) {
    return `【${dateWithDay}】全ての枠が予約済みです。別の日をお選びください。`;
  }

  const timeListWithSlots = availableSlots.map((s: TimeSlot) =>
    s.remainingSlots > 1 ? `${s.time}(残${s.remainingSlots})` : s.time
  ).join(', ');

  if (bookedSlots.length > 0) {
    const bookedTimeList = bookedSlots.map((s: TimeSlot) => s.time).join(', ');
    return `【${dateWithDay}の予約状況】\n空き枠: ${timeListWithSlots}\n予約済み: ${bookedTimeList}`;
  }
  return `【${dateWithDay}の予約状況】\n空き枠: ${timeListWithSlots}\n予約済み: なし`;
}

async function executeCreateAppointment(
  spreadsheetId: string,
  args: any,
  context?: ToolExecutorContext
): Promise<string> {
  const settings = await getClinicSettings(spreadsheetId);

  const dateVal = validateDateFormat(args.date);
  if (!dateVal.valid) {
    return dateVal.error || '日付の形式が正しくありません。';
  }

  const timeVal = validateTimeFormat(args.time);
  if (!timeVal.valid) {
    return timeVal.error || '時刻の形式が正しくありません。';
  }

  const phoneVal = validatePhone(args.patient_phone);
  if (!phoneVal.valid) {
    return phoneVal.error || '電話番号の形式が正しくありません。';
  }
  const phoneDigits = phoneVal.normalized!;

  const nameVal = validatePatientName(args.patient_name);
  if (!nameVal.valid) {
    return nameVal.error || 'お名前を入力してください。';
  }

  if (args.patient_email) {
    const emailVal = validateEmail(args.patient_email);
    if (!emailVal.valid) {
      return emailVal.error || 'メールアドレスの形式が正しくありません。';
    }
  }

  if (args.symptom) {
    const symptomVal = validateSymptom(args.symptom);
    if (!symptomVal.valid) {
      return symptomVal.error || 'ご来院の目的が長すぎます。';
    }
  }

  const existingAppointments = await getAppointmentsByDate(spreadsheetId, args.date);
  const duplicateAppointment = existingAppointments.find(
    (apt) => apt.patientPhone.replace(/[-\s]/g, '') === phoneDigits
  );
  if (duplicateAppointment) {
    return `同じ電話番号（${args.patient_phone}）で${args.date}に既に${duplicateAppointment.time}のご予約があります。別の日程をご希望ですか？`;
  }

  const normalizedDoctor = normalizeOptionalValue(args.doctor || '');
  if (settings.useDoctorSelection && settings.doctorList.length > 0 && !args.doctor) {
    return `担当医の確認が必要です。「${settings.doctorList.join('、')}」の中からご希望を確認するか、特にご希望がなければ「なし」と入力してください。`;
  }

  const normalizedCardNumber = normalizeOptionalValue(args.patient_card_number || '');
  if (settings.usePatientCardNumber && !args.patient_card_number) {
    return `診察券番号の確認が必要です。「診察券番号をお持ちでしたらお伝えください。初診の方や番号がわからない場合は『なし』で大丈夫です」と確認してください。`;
  }

  const isLineSource = context?.source === 'line' && Boolean(context?.lineUserId);
  const bookedVia = isLineSource ? 'LINE' : 'ChatBot';

  const result = await createAppointment(spreadsheetId, {
    date: dateVal.normalized!,
    time: timeVal.normalized!,
    patientName: sanitizeForSheet(nameVal.normalized!),
    patientPhone: phoneDigits,
    patientEmail: args.patient_email ? sanitizeForSheet(args.patient_email) : '',
    patientCardNumber: normalizedCardNumber,
    doctor: normalizedDoctor,
    symptom: args.symptom ? sanitizeForSheet(args.symptom) : '',
    bookedVia,
    lineUserId: context?.lineUserId,
  }, context?.siteId);

  if (result.success) {
    // LINE予約の場合、phone_numberをline_usersテーブルに保存（リマインド用）
    if (isLineSource && context?.lineUserId) {
      try {
        // site_idとline_user_idの両方で絞り込み（クロスサイトの誤更新防止）
        // siteIdがない場合はline_user_idのみで更新（後方互換性のため）
        let updateQuery = supabaseClient
          .from('line_users')
          .update({ phone_number: phoneDigits, updated_at: new Date().toISOString() })
          .eq('line_user_id', context.lineUserId);

        if (context.siteId) {
          updateQuery = updateQuery.eq('site_id', context.siteId);
        }

        const { error: updateErr } = await updateQuery;
        if (updateErr) {
          console.error('[Hybrid] Failed to update line_users phone_number:', updateErr);
        }
      } catch (upsertErr) {
        console.error('[Hybrid] Failed to update line_users phone_number:', upsertErr);
      }
    }

    let emailSent = false;
    if (args.patient_email) {
      try {
        await sendAppointmentConfirmationEmail({
          patientName: args.patient_name,
          patientEmail: args.patient_email,
          date: args.date,
          time: args.time,
          clinicName: settings.clinicName,
          symptom: args.symptom,
        });
        emailSent = true;
      } catch (err) {
        console.error('[Hybrid] Email send error:', err);
      }
    }

    let confirmMsg = `予約が完了しました。日時: ${args.date} ${args.time}、患者名: ${args.patient_name}`;
    if (normalizedDoctor) {
      confirmMsg += `、担当医: ${normalizedDoctor}`;
    }
    if (args.patient_email && !emailSent) {
      confirmMsg += `（確認メールの送信に失敗しました）`;
    }
    return confirmMsg;
  } else {
    return `予約に失敗しました: ${result.message}`;
  }
}

async function executeGetClinicInfo(spreadsheetId: string): Promise<string> {
  const settings = await getClinicSettings(spreadsheetId);
  let info = `医院名: ${settings.clinicName}
診療時間: ${settings.startTime}〜${settings.endTime}
昼休み: ${settings.breakStart}〜${settings.breakEnd}
1枠: ${settings.slotDuration}分
休診曜日: ${settings.closedDays.join('、')}`;

  if (settings.useDoctorSelection && settings.doctorList.length > 0) {
    info += `\n担当医: ${settings.doctorList.join('、')}`;
  }
  if (settings.usePatientCardNumber) {
    info += `\n※再診の方は診察券番号をお伝えください`;
  }
  return info;
}

async function executeCancelAppointment(spreadsheetId: string, args: any): Promise<string> {
  const cancelDateVal = validateDateFormat(args.date);
  if (!cancelDateVal.valid) {
    return cancelDateVal.error || '日付の形式が正しくありません。';
  }

  const cancelTimeVal = validateTimeFormat(args.time);
  if (!cancelTimeVal.valid) {
    return cancelTimeVal.error || '時刻の形式が正しくありません。';
  }

  const cancelPhoneVal = validatePhone(args.patient_phone);
  if (!cancelPhoneVal.valid) {
    return `ご予約時にお伝えいただいた電話番号を再度ご確認ください。${cancelPhoneVal.error || ''}`;
  }
  const phoneDigits = cancelPhoneVal.normalized!;

  const appointments = await getAppointmentsByDate(spreadsheetId, cancelDateVal.normalized!);
  const targetAppointment = appointments.find(
    (apt) => apt.time === cancelTimeVal.normalized && apt.patientPhone.replace(/[-\s]/g, '') === phoneDigits
  );

  if (!targetAppointment) {
    return `${args.date} ${args.time}のご予約が見つかりません。日時と電話番号をご確認ください。`;
  }

  const result = await cancelAppointment(spreadsheetId, args.date, args.time);
  if (result.success) {
    return `${args.date} ${args.time}のご予約をキャンセルしました。またのご利用をお待ちしております。`;
  } else {
    return `キャンセルに失敗しました: ${result.message}`;
  }
}
