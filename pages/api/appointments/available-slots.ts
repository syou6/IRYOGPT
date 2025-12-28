import type { NextApiRequest, NextApiResponse } from 'next';
import { getAvailableSlots, getClinicSettings } from '@/utils/appointment';

/**
 * 空き枠取得API
 *
 * GET /api/appointments/available-slots?spreadsheet_id=xxx&date=2025/1/25
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { spreadsheet_id, date } = req.query;

    if (!spreadsheet_id || typeof spreadsheet_id !== 'string') {
      return res.status(400).json({ error: 'spreadsheet_id is required' });
    }

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'date is required (format: 2025/1/25)' });
    }

    const settings = await getClinicSettings(spreadsheet_id);
    const slots = await getAvailableSlots(spreadsheet_id, date);

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
      message: error.message,
    });
  }
}
