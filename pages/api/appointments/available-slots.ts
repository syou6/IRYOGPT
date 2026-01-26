import type { NextApiRequest, NextApiResponse } from 'next';
import { getAvailableSlots, getClinicSettings } from '@/utils/appointment';
import { supabaseClient } from '@/utils/supabase-client';
import { getSafeErrorMessage } from '@/utils/error-handler';
import { setCorsHeaders, handlePreflight } from '@/utils/cors';

/**
 * 空き枠取得API
 *
 * GET /api/appointments/available-slots?site_id=xxx&date=2025/1/25
 *
 * Response:
 * {
 *   date: "2025/1/25",
 *   clinicName: "さくら歯科",
 *   slots: [
 *     { time: "09:00", available: true },
 *     { time: "09:30", available: false, patientName: "山田" },
 *     ...
 *   ]
 * }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // OPTIONSリクエスト（プリフライト）
  if (handlePreflight(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { site_id, date } = req.query;

    if (!site_id || typeof site_id !== 'string') {
      return res.status(400).json({ error: 'site_id is required' });
    }

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'date is required (format: 2025/1/25)' });
    }

    // サイト情報を取得（spreadsheet_id, base_url）
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('spreadsheet_id, base_url')
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // CORS検証
    const corsAllowed = setCorsHeaders(req, res, site.base_url);
    if (!corsAllowed) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    if (!site.spreadsheet_id) {
      return res.status(400).json({ error: 'Spreadsheet not configured for this site' });
    }

    const settings = await getClinicSettings(site.spreadsheet_id);
    const slots = await getAvailableSlots(site.spreadsheet_id, date);

    return res.status(200).json({
      date,
      clinicName: settings.clinicName,
      slotDuration: settings.slotDuration,
      slots,
    });
  } catch (error: any) {
    console.error('Error getting available slots:', error);
    return res.status(500).json({
      error: 'Failed to get available slots',
      message: getSafeErrorMessage(error),
    });
  }
}
