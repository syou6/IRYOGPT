import type { NextApiRequest, NextApiResponse } from 'next';
import { sendContactInquiryEmail } from '@/utils/send-email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { name, email, message } = req.body as { name?: string; email?: string; message?: string };
  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Invalid request' });
  }

  try {
    await sendContactInquiryEmail({ name, email, message });
  } catch (error) {
    console.error('[Contact] failed to send email', error);
    return res.status(500).json({ message: 'Failed to send' });
  }

  return res.status(200).json({ message: 'ok' });
}
