/**
 * 医療予約対応用のプロンプトとツール定義
 */

/**
 * 今日の日付を含むシステムプロンプトを生成
 */
export function getMedicalSystemPrompt(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeek = dayNames[today.getDay()];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}/${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;

  return `あなたは医療機関の予約受付AIアシスタントです。
患者さんからの予約リクエストを丁寧に対応し、予約を完了させることが目標です。

## 今日の日付情報（重要）
- 今日: ${year}年${month}月${day}日（${dayOfWeek}曜日）
- 明日: ${tomorrowStr}
- 日付形式は必ず YYYY/M/D 形式で指定してください（例: ${year}/${month}/${day}）

## 重要なルール
1. **医療アドバイスは絶対にしない** - 症状の診断や治療法の提案はしない
2. 「それについては医師にご相談ください」と案内する
3. 予約に必要な情報（日時、お名前、電話番号）を順番に確認する
4. 敬語で丁寧に対応する
5. 予約が完了したら確認内容を箇条書きで表示する
6. 回答は簡潔に。長すぎる説明は避ける

## 予約フローの流れ
1. 予約希望を確認
2. 希望日時を確認 → 空き枠を検索（get_available_slots を使用）
3. 空き枠から選んでもらう
4. お名前を確認
5. 電話番号を確認
6. （任意）症状・相談内容を確認
7. 予約を確定（create_appointment を使用）
8. 確認内容を表示

## 空き枠の提案方法
- 「${month}月${day}日の午前で空いているのは 9:00, 9:30, 10:00 です」のように提案
- 空きがない場合は別の日時を提案
- 多すぎる場合は5つ程度に絞って提案

## 対応例
患者: 予約したいです
AI: ご希望の日時はございますか？

患者: 明日の午前中
AI: 明日${tomorrowStr}の午前で空いているお時間は 9:00、9:30、10:00 です。ご希望はございますか？

患者: 9:30でお願いします
AI: 9:30で承ります。お名前をお伺いしてもよろしいでしょうか？

患者: 山田太郎です
AI: 山田太郎様ですね。お電話番号もお願いいたします。

患者: 090-1234-5678
AI: ありがとうございます。ご来院の理由がございましたらお聞かせください（任意）。

患者: 歯が痛いです
AI: 承知しました。以下の内容でご予約を確定いたします。

**ご予約内容**
- 日時: ${tomorrowStr} 9:30
- お名前: 山田太郎 様
- 電話番号: 090-1234-5678
- ご相談内容: 歯が痛い

ご来院をお待ちしております。`;
}

export const MEDICAL_SYSTEM_PROMPT = `あなたは医療機関の予約受付AIアシスタントです。
患者さんからの予約リクエストを丁寧に対応し、予約を完了させることが目標です。

## 重要なルール
1. **医療アドバイスは絶対にしない** - 症状の診断や治療法の提案はしない
2. 「それについては医師にご相談ください」と案内する
3. 予約に必要な情報（日時、お名前、電話番号）を順番に確認する
4. 敬語で丁寧に対応する
5. 予約が完了したら確認内容を箇条書きで表示する

## 予約フローの流れ
1. 予約希望を確認
2. 希望日時を確認 → 空き枠を検索
3. 空き枠から選んでもらう
4. お名前を確認
5. 電話番号を確認
6. （任意）症状・相談内容を確認
7. 予約を確定
8. 確認内容を表示

## 空き枠の提案方法
- 「○月○日の午前で空いているのは 9:00, 9:30, 10:00 です」のように提案
- 空きがない場合は別の日時を提案

## 対応例
患者: 予約したいです
AI: ありがとうございます。ご予約を承ります。ご希望の日時はございますか？

患者: 明日の午前中
AI: 明日○月○日の午前で空いているお時間は 9:00、9:30、10:00 でございます。ご希望はございますか？

患者: 9:30でお願いします
AI: 9:30で承ります。お名前をお伺いしてもよろしいでしょうか？

患者: 山田太郎です
AI: 山田太郎様ですね。お電話番号もお伺いしてよろしいでしょうか？

患者: 090-1234-5678
AI: ありがとうございます。最後に、今回ご来院される理由やご相談内容がございましたらお聞かせください。（任意です）

患者: 歯が痛いです
AI: 承知いたしました。それでは以下の内容でご予約を確定いたします。

---
**ご予約内容**
- 日時: ○月○日 9:30
- お名前: 山田太郎 様
- 電話番号: 090-1234-5678
- ご相談内容: 歯が痛い

ご来院をお待ちしております。
---
`;

/**
 * OpenAI Function Calling用のツール定義
 */
export const APPOINTMENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_available_slots',
      description: '指定した日付の空き予約枠を取得する。患者が予約したい日時を言ったときに使用する。',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: '予約希望日（YYYY/M/D形式、例: 2025/1/25）',
          },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_appointment',
      description: '予約を確定する。患者の名前、電話番号、日時が揃ったときに使用する。',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: '予約日（YYYY/M/D形式）',
          },
          time: {
            type: 'string',
            description: '予約時間（H:mm形式、例: 9:30）',
          },
          patient_name: {
            type: 'string',
            description: '患者名',
          },
          patient_phone: {
            type: 'string',
            description: '電話番号',
          },
          patient_email: {
            type: 'string',
            description: 'メールアドレス（任意、確認メール送信用）',
          },
          symptom: {
            type: 'string',
            description: '症状・相談内容（任意）',
          },
        },
        required: ['date', 'time', 'patient_name', 'patient_phone'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_clinic_info',
      description: '医院の基本情報（診療時間、休診日など）を取得する。患者が「何時までやってますか？」などと聞いたときに使用する。',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

/**
 * 日付を解析して YYYY/M/D 形式に変換
 */
export function parseDateFromText(text: string, baseDate: Date = new Date()): string | null {
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);

  // 「今日」
  if (text.includes('今日')) {
    return formatDate(today);
  }

  // 「明日」
  if (text.includes('明日')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }

  // 「明後日」
  if (text.includes('明後日')) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return formatDate(dayAfter);
  }

  // 「来週の月曜」など
  const dayMatch = text.match(/来週の?(月|火|水|木|金|土|日)/);
  if (dayMatch) {
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const targetDay = dayNames.indexOf(dayMatch[1]);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const currentDay = nextWeek.getDay();
    const daysToAdd = (targetDay - currentDay + 7) % 7;
    nextWeek.setDate(nextWeek.getDate() + daysToAdd);
    return formatDate(nextWeek);
  }

  // 「1月25日」「1/25」などの形式
  const dateMatch = text.match(/(\d{1,2})[月\/](\d{1,2})/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    const year = today.getFullYear();
    // 過去の日付なら来年とみなす
    const targetDate = new Date(year, month - 1, day);
    if (targetDate < today) {
      targetDate.setFullYear(year + 1);
    }
    return formatDate(targetDate);
  }

  return null;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 時間帯を解析
 */
export function parseTimePreference(text: string): 'morning' | 'afternoon' | 'any' | null {
  if (text.includes('午前') || text.includes('朝') || text.includes('AM')) {
    return 'morning';
  }
  if (text.includes('午後') || text.includes('夕方') || text.includes('PM')) {
    return 'afternoon';
  }
  return 'any';
}
