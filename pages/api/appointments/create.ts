import type { NextApiRequest, NextApiResponse } from 'next';
import { createAppointment } from '@/utils/appointment';
import { checkRateLimit } from '@/utils/rate-limit';
import { requireSiteWithSpreadsheet } from '@/utils/supabase-auth';

/**
 * 予約作成API
 *
 * POST /api/appointments/create
 *
 * Body:
 * {
 *   site_id: "uuid",                       // 必須: サイトID（これからspreadsheet_idを取得）
 *   date: "2025/1/25",
 *   time: "10:00",
 *   patient_name: "山田太郎",
 *   patient_phone: "090-1234-5678",
 *   patient_email: "yamada@example.com",  // optional
 *   symptom: "歯が痛い",                   // optional
 *   booked_via: "Bot"                      // optional, default: "Bot"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "予約が完了しました",
 *   appointment: { date, time, patient_name }
 * }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // レートリミットチェック（1分間に10リクエストまで）
  const allowed = await checkRateLimit(req, res, 'appointment');
  if (!allowed) return;

  try {
    const {
      site_id,
      date,
      time,
      patient_name,
      patient_phone,
      patient_email,
      symptom,
      booked_via,
    } = req.body;

    // site_idからspreadsheet_idを取得（認証）
    if (!site_id) {
      return res.status(400).json({ error: 'site_id is required' });
    }

    let spreadsheet_id: string;
    try {
      spreadsheet_id = await requireSiteWithSpreadsheet(site_id);
    } catch {
      return res.status(403).json({ error: 'Invalid site_id or spreadsheet not configured' });
    }
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    if (!time) {
      return res.status(400).json({ error: 'time is required' });
    }
    if (!patient_name) {
      return res.status(400).json({ error: 'patient_name is required' });
    }
    if (!patient_phone) {
      return res.status(400).json({ error: 'patient_phone is required' });
    }

    const result = await createAppointment(spreadsheet_id, {
      date,
      time,
      patientName: patient_name,
      patientPhone: patient_phone,
      patientEmail: patient_email,
      symptom,
      bookedVia: booked_via || 'Bot',
    });

    if (!result.success) {
      return res.status(409).json({
        success: false,
        error: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      appointment: {
        date,
        time,
        patient_name,
      },
    });
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    return res.status(500).json({
      error: 'Failed to create appointment',
      message: error.message,
    });
  }
}
