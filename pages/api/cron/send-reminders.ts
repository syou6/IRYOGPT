/**
 * 予約リマインドメール送信 Cron Job
 * 毎朝8時に実行し、翌日の予約にリマインドメールを送信
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { getAppointmentsByDate, getClinicSettings } from '@/utils/appointment';
import { sendAppointmentReminderEmail } from '@/utils/email';

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
    // 明日の日付を計算
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}/${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;

    console.log(`[Cron] Sending reminders for ${tomorrowStr}`);

    // スプレッドシートが設定されているサイトを取得
    const { data: sites, error: sitesError } = await supabaseClient
      .from('sites')
      .select('id, spreadsheet_id, name')
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
    const results: { site: string; sent: number; failed: number }[] = [];

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

        for (const apt of appointments) {
          // メールアドレスがない予約はスキップ
          if (!apt.patientEmail) continue;

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
            console.error(`[Cron] Failed to send to ${apt.patientEmail}:`, result.message);
          }
        }

        results.push({ site: site.name || site.id, sent, failed });
        console.log(`[Cron] Site ${site.name}: ${sent} sent, ${failed} failed`);
      } catch (siteError) {
        console.error(`[Cron] Error processing site ${site.id}:`, siteError);
        results.push({ site: site.name || site.id, sent: 0, failed: -1 });
      }
    }

    console.log(`[Cron] Completed: ${totalSent} sent, ${totalFailed} failed`);

    return res.status(200).json({
      message: 'Reminders processed',
      date: tomorrowStr,
      totalSent,
      totalFailed,
      results,
    });
  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
