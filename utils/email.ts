/**
 * メール送信ユーティリティ（Resend使用）
 */

import { Resend } from 'resend';

// Resendクライアント（APIキーがない場合はnull）
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// デフォルトの送信元
const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || 'info@amorjp.com';

/**
 * 予約確認メールのデータ
 */
export interface AppointmentEmailData {
  patientName: string;
  patientEmail: string;
  date: string; // "2025/1/30"
  time: string; // "10:00"
  clinicName: string;
  clinicPhone?: string;
  clinicAddress?: string;
  symptom?: string;
}

/**
 * 予約確認メールを送信
 */
export async function sendAppointmentConfirmationEmail(
  data: AppointmentEmailData
): Promise<{ success: boolean; message: string; id?: string }> {
  // APIキーがない場合はスキップ
  if (!resend) {
    console.log('[Email] Resend API key not configured, skipping email');
    return {
      success: true,
      message: 'Email sending skipped (no API key configured)',
    };
  }

  // メールアドレスがない場合はスキップ
  if (!data.patientEmail) {
    console.log('[Email] No patient email provided, skipping');
    return {
      success: true,
      message: 'Email sending skipped (no email provided)',
    };
  }

  try {
    const subject = `【${data.clinicName}】ご予約確認`;
    const htmlContent = generateConfirmationEmailHtml(data);
    const textContent = generateConfirmationEmailText(data);

    const result = await resend.emails.send({
      from: `${data.clinicName} <${DEFAULT_FROM_EMAIL}>`,
      to: data.patientEmail,
      subject,
      html: htmlContent,
      text: textContent,
    });

    if (result.error) {
      console.error('[Email] Failed to send:', result.error);
      return {
        success: false,
        message: result.error.message,
      };
    }

    console.log('[Email] Sent successfully:', result.data?.id);
    return {
      success: true,
      message: 'Email sent successfully',
      id: result.data?.id,
    };
  } catch (error: any) {
    console.error('[Email] Error:', error);
    return {
      success: false,
      message: error.message || 'Failed to send email',
    };
  }
}

/**
 * 確認メールのHTMLを生成
 */
function generateConfirmationEmailHtml(data: AppointmentEmailData): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ご予約確認</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Hiragino Sans', 'Meiryo', sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(120deg, #34d399, #22d3ee); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                ${escapeHtml(data.clinicName)}
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                ご予約確認
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #333; font-size: 16px;">
                ${escapeHtml(data.patientName)} 様
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 14px; line-height: 1.8;">
                この度はご予約いただきありがとうございます。<br>
                以下の内容でご予約を承りました。
              </p>

              <!-- Appointment Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <span style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">日時</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0 20px; font-size: 18px; font-weight: bold; color: #1e293b;">
                          ${escapeHtml(data.date)} ${escapeHtml(data.time)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <span style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">お名前</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0 20px; font-size: 16px; color: #1e293b;">
                          ${escapeHtml(data.patientName)} 様
                        </td>
                      </tr>
                      ${
                        data.symptom
                          ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                          <span style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">ご相談内容</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-size: 14px; color: #475569;">
                          ${escapeHtml(data.symptom)}
                        </td>
                      </tr>
                      `
                          : ''
                      }
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <strong>ご来院時のお願い</strong><br>
                  ・保険証をご持参ください<br>
                  ・ご予約時間の5分前までにお越しください<br>
                  ・キャンセル・変更の場合はお電話でご連絡ください
                </p>
              </div>

              <!-- Clinic Info -->
              ${
                data.clinicPhone || data.clinicAddress
                  ? `
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <p style="margin: 0 0 10px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                  医院情報
                </p>
                <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.8;">
                  <strong>${escapeHtml(data.clinicName)}</strong><br>
                  ${data.clinicAddress ? `${escapeHtml(data.clinicAddress)}<br>` : ''}
                  ${data.clinicPhone ? `TEL: ${escapeHtml(data.clinicPhone)}` : ''}
                </p>
              </div>
              `
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                このメールは自動送信されています。<br>
                ご不明な点がございましたら、医院まで直接お問い合わせください。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * 確認メールのプレーンテキストを生成
 */
function generateConfirmationEmailText(data: AppointmentEmailData): string {
  let text = `
【${data.clinicName}】ご予約確認

${data.patientName} 様

この度はご予約いただきありがとうございます。
以下の内容でご予約を承りました。

━━━━━━━━━━━━━━━━━━━━━━
■ ご予約内容
━━━━━━━━━━━━━━━━━━━━━━
日時: ${data.date} ${data.time}
お名前: ${data.patientName} 様
`;

  if (data.symptom) {
    text += `ご相談内容: ${data.symptom}\n`;
  }

  text += `
━━━━━━━━━━━━━━━━━━━━━━
■ ご来院時のお願い
━━━━━━━━━━━━━━━━━━━━━━
・保険証をご持参ください
・ご予約時間の5分前までにお越しください
・キャンセル・変更の場合はお電話でご連絡ください
`;

  if (data.clinicPhone || data.clinicAddress) {
    text += `
━━━━━━━━━━━━━━━━━━━━━━
■ 医院情報
━━━━━━━━━━━━━━━━━━━━━━
${data.clinicName}
`;
    if (data.clinicAddress) {
      text += `${data.clinicAddress}\n`;
    }
    if (data.clinicPhone) {
      text += `TEL: ${data.clinicPhone}\n`;
    }
  }

  text += `
━━━━━━━━━━━━━━━━━━━━━━
このメールは自動送信されています。
ご不明な点がございましたら、医院まで直接お問い合わせください。
`;

  return text.trim();
}

/**
 * HTMLエスケープ
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
