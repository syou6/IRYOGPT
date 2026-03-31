/**
 * 予約リマインドメール送信 Cron Job
 * 毎朝8時に実行し、翌日の予約にリマインドメールを送信
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { getAppointmentsByDate, getClinicSettings } from '@/utils/appointment';
import { sendAppointmentReminderEmail } from '@/utils/email';
import { findLineUserForAppointment, sendAppointmentReminder } from '@/utils/line-notification';

// Vercel Cron の認証トークン
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Cron認証チェック（Vercel Cronからの呼び出しを検証）
  if (CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 明日の日付を計算（日本時間 JST: UTC+9 で計算）
    const nowUtcMs = Date.now();
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const tomorrowJst = new Date(nowUtcMs + jstOffsetMs);
    tomorrowJst.setUTCDate(tomorrowJst.getUTCDate() + 1);
    const tomorrowStr = `${tomorrowJst.getUTCFullYear()}/${tomorrowJst.getUTCMonth() + 1}/${tomorrowJst.getUTCDate()}`;

    console.log(`[Cron] Sending reminders for ${tomorrowStr}`);

    // スプレッドシートが設定されているサイトを取得
    const { data: sites, error: sitesError } = await supabaseClient
      .from('sites')
      .select('id, spreadsheet_id, name, line_enabled, line_channel_access_token')
      .not('spreadsheet_id', 'is', null)
      .neq('spreadsheet_id', '');

    if (sitesError) {
      console.error('[Cron] Failed to fetch sites:', sitesError);
      return res.status(500).json({ error: 'Failed to fetch sites' });
    }

    if (!sites || sites.length === 0) {
      console.log('[Cron] No sites with spreadsheet configured');
      return res.status(200).json({ message: 'No sites to process', sent: 0 });
    }

    let totalSent = 0;
    let totalFailed = 0;
    let totalLineSent = 0;
    let totalLineFailed = 0;
    const results: { site: string; sent: number; failed: number; lineSent: number; lineFailed: number }[] = [];

    // 各サイトの予約を処理
    for (const site of sites) {
      if (!site.spreadsheet_id) continue;

      try {
        // 医院設定を取得
        const settings = await getClinicSettings(site.spreadsheet_id);

        // 明日の予約を取得
        const appointments = await getAppointmentsByDate(site.spreadsheet_id, tomorrowStr);

        let sent = 0;
        let failed = 0;
        let lineSent = 0;
        let lineFailed = 0;

        for (const apt of appointments) {
          // メールリマインド
          if (apt.patientEmail) {
            const result = await sendAppointmentReminderEmail({
              patientName: apt.patientName,
              patientEmail: apt.patientEmail,
              date: apt.date,
              time: apt.time,
              clinicName: settings.clinicName,
              symptom: apt.symptom,
            });

            if (result.success && result.id) {
              sent++;
              totalSent++;
            } else if (!result.success) {
              failed++;
              totalFailed++;
              console.error(`[Cron] Failed to send email to ${apt.patientEmail}:`, result.message);
            }
          }

          // LINEリマインド（LINE連携が有効なサイトのみ）
          if (site.line_enabled && site.line_channel_access_token) {
            try {
              const lineUserId = await findLineUserForAppointment(site.id, {
                date: apt.date,
                time: apt.time,
                patientName: apt.patientName,
                patientPhone: apt.patientPhone,
                lineUserId: apt.lineUserId,
              });

              if (lineUserId) {
                const lineResult = await sendAppointmentReminder(site.id, lineUserId, {
                  date: apt.date,
                  time: apt.time,
                  patientName: apt.patientName,
                  clinicName: settings.clinicName,
                });

                if (lineResult) {
                  lineSent++;
                  totalLineSent++;
                } else {
                  lineFailed++;
                  totalLineFailed++;
                }
              }
            } catch (lineErr) {
              console.error(`[Cron] LINE reminder error for ${apt.patientName}:`, lineErr);
              lineFailed++;
              totalLineFailed++;
            }
          }
        }

        results.push({ site: site.name || site.id, sent, failed, lineSent, lineFailed });
        console.log(`[Cron] Site ${site.name}: email ${sent} sent, ${failed} failed | LINE ${lineSent} sent, ${lineFailed} failed`);
      } catch (siteError) {
        console.error(`[Cron] Error processing site ${site.id}:`, siteError);
        results.push({ site: site.name || site.id, sent: 0, failed: -1, lineSent: 0, lineFailed: 0 });
      }
    }

    console.log(`[Cron] Completed: email ${totalSent} sent, ${totalFailed} failed | LINE ${totalLineSent} sent, ${totalLineFailed} failed`);

    return res.status(200).json({
      message: 'Reminders processed',
      date: tomorrowStr,
      totalSent,
      totalFailed,
      totalLineSent,
      totalLineFailed,
      results,
    });
  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
