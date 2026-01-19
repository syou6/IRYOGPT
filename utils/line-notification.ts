/**
 * LINE 通知ユーティリティ
 *
 * 予約完了時などにLINEユーザーにプッシュメッセージを送信する
 */

import { messagingApi } from '@line/bot-sdk';
import { supabaseClient } from './supabase-client';

interface AppointmentNotificationData {
  date: string;
  time: string;
  patientName: string;
  clinicName?: string;
  symptom?: string;
}

/**
 * LINE ユーザーに予約完了通知を送信
 *
 * @param siteId サイトID
 * @param lineUserId LINE ユーザーID
 * @param appointmentData 予約データ
 */
export async function sendAppointmentNotification(
  siteId: string,
  lineUserId: string,
  appointmentData: AppointmentNotificationData
): Promise<boolean> {
  try {
    // サイトの LINE 設定を取得
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('line_channel_access_token, line_enabled')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      console.error('[LINE Notification] Site not found:', siteError);
      return false;
    }

    if (!site.line_enabled || !site.line_channel_access_token) {
      console.log('[LINE Notification] LINE is not enabled or token missing');
      return false;
    }

    // LINE クライアントを作成
    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: site.line_channel_access_token,
    });

    // 予約完了メッセージを作成
    const message = createAppointmentConfirmationMessage(appointmentData);

    // プッシュメッセージを送信
    await client.pushMessage({
      to: lineUserId,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    });

    console.log(`[LINE Notification] Sent appointment notification to ${lineUserId}`);
    return true;
  } catch (error) {
    console.error('[LINE Notification] Failed to send notification:', error);
    return false;
  }
}

/**
 * 予約完了メッセージを生成
 */
function createAppointmentConfirmationMessage(data: AppointmentNotificationData): string {
  let message = `ご予約が完了しました。\n\n`;
  message += `【予約内容】\n`;
  message += `日時: ${data.date} ${data.time}\n`;
  message += `お名前: ${data.patientName}\n`;
  if (data.symptom) {
    message += `ご来院の目的: ${data.symptom}\n`;
  }
  message += `\nご来院をお待ちしております。`;

  if (data.clinicName) {
    message += `\n\n${data.clinicName}`;
  }

  return message;
}

/**
 * LINE ユーザーにリマインド通知を送信
 *
 * @param siteId サイトID
 * @param lineUserId LINE ユーザーID
 * @param appointmentData 予約データ
 */
export async function sendAppointmentReminder(
  siteId: string,
  lineUserId: string,
  appointmentData: AppointmentNotificationData
): Promise<boolean> {
  try {
    // サイトの LINE 設定を取得
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('line_channel_access_token, line_enabled')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      console.error('[LINE Notification] Site not found:', siteError);
      return false;
    }

    if (!site.line_enabled || !site.line_channel_access_token) {
      console.log('[LINE Notification] LINE is not enabled or token missing');
      return false;
    }

    // LINE クライアントを作成
    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: site.line_channel_access_token,
    });

    // リマインドメッセージを作成
    const message = createReminderMessage(appointmentData);

    // プッシュメッセージを送信
    await client.pushMessage({
      to: lineUserId,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    });

    console.log(`[LINE Notification] Sent reminder to ${lineUserId}`);
    return true;
  } catch (error) {
    console.error('[LINE Notification] Failed to send reminder:', error);
    return false;
  }
}

/**
 * リマインドメッセージを生成
 */
function createReminderMessage(data: AppointmentNotificationData): string {
  let message = `【予約リマインド】\n\n`;
  message += `明日のご予約をお知らせします。\n\n`;
  message += `日時: ${data.date} ${data.time}\n`;
  message += `お名前: ${data.patientName}\n`;
  message += `\nお気をつけてお越しください。`;

  if (data.clinicName) {
    message += `\n\n${data.clinicName}`;
  }

  return message;
}

/**
 * LINE ユーザーにカスタムメッセージを送信
 *
 * @param siteId サイトID
 * @param lineUserId LINE ユーザーID
 * @param message 送信するメッセージ
 */
export async function sendCustomMessage(
  siteId: string,
  lineUserId: string,
  message: string
): Promise<boolean> {
  try {
    // サイトの LINE 設定を取得
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('line_channel_access_token, line_enabled')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      console.error('[LINE Notification] Site not found:', siteError);
      return false;
    }

    if (!site.line_enabled || !site.line_channel_access_token) {
      console.log('[LINE Notification] LINE is not enabled or token missing');
      return false;
    }

    // LINE クライアントを作成
    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: site.line_channel_access_token,
    });

    // プッシュメッセージを送信
    await client.pushMessage({
      to: lineUserId,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    });

    console.log(`[LINE Notification] Sent custom message to ${lineUserId}`);
    return true;
  } catch (error) {
    console.error('[LINE Notification] Failed to send custom message:', error);
    return false;
  }
}
