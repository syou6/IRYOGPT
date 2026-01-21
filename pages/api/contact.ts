import type { NextApiRequest, NextApiResponse } from 'next';
import { sendContactInquiryEmail } from '@/utils/send-email';
import { checkRateLimit } from '@/utils/rate-limit';

// メールアドレスの正規表現
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // レートリミットチェック（1時間に5リクエストまで）
  const allowed = await checkRateLimit(req, res, 'contact');
  if (!allowed) return;

  const { name, email, message } = req.body as { name?: string; email?: string; message?: string };

  // バリデーション強化
  if (!name || typeof name !== 'string' || name.length > 100) {
    return res.status(400).json({ message: 'お名前は100文字以内で入力してください' });
  }
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: '有効なメールアドレスを入力してください' });
  }
  if (!message || typeof message !== 'string' || message.length > 5000) {
    return res.status(400).json({ message: 'メッセージは5000文字以内で入力してください' });
  }

  try {
    await sendContactInquiryEmail({ name: name.trim(), email: email.trim(), message: message.trim() });
  } catch (error) {
    console.error('[Contact] failed to send email', error);
    return res.status(500).json({ message: 'Failed to send' });
  }

  return res.status(200).json({ message: 'ok' });
}
