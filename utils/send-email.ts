const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'WEBGPT <heartssh@gmail.com>';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set. Skipping mail send.');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: DEFAULT_FROM,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[Email] Failed to send: ${response.status} ${text}`);
  }
}

export async function sendSiteRegistrationEmail(options: {
  to: string;
  siteName: string;
  baseUrl: string;
}) {
  const { to, siteName, baseUrl } = options;
  await sendEmail({
    to,
    subject: `WEBGPT: 「${siteName}」の登録を受け付けました`,
    html: `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #0f172a;">
        <h2 style="margin-bottom: 8px;">サイト受付完了のお知らせ</h2>
        <p>以下の情報でチャットボット化のご依頼を受け付けました。</p>
        <ul>
          <li><strong>サイト名:</strong> ${siteName}</li>
          <li><strong>URL:</strong> <a href="${baseUrl}">${baseUrl}</a></li>
        </ul>
        <p>WEBGPT チームが順次学習・セットアップを行い、完了次第ご連絡いたします。</p>
        <p style="margin-top: 24px; font-size: 12px; color: #64748b;">
          このメールに心当たりがない場合は heartssh@gmail.com までお問い合わせください。
        </p>
      </div>
    `,
  });
}
