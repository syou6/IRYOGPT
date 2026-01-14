/**
 * 医療予約対応用のプロンプトとツール定義
 */

// ClinicSettings型の定義（appointment.tsからインポートすると循環参照になる可能性があるため）
interface ClinicSettingsForPrompt {
  clinicName: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  slotDuration: number;
  closedDays: string[];
  usePatientCardNumber: boolean;
  useDoctorSelection: boolean;
  doctorList: string[];
}

/**
 * 医院設定を含むシステムプロンプトを生成（推奨）
 * AIがget_clinic_infoを呼ばなくても設定を知れる
 */
export function getMedicalSystemPromptWithSettings(settings: ClinicSettingsForPrompt): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeek = dayNames[today.getDay()];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}/${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;

  // 担当医セクション
  const doctorSection = settings.useDoctorSelection && settings.doctorList.length > 0
    ? `\n## 担当医情報（必須確認）
- 担当医選択: **有効**
- 担当医リスト: ${settings.doctorList.join('、')}
- **必ず確認すること**: 「担当医のご希望はございますか？${settings.doctorList.join('、')}がおります。特にご希望がなければ『なし』でも大丈夫です」と聞く
- 患者が「誰でもいい」「特にない」「お任せ」と言った場合 → doctor に「なし」と入力する
- 患者が特定の先生を指名した場合 → その先生名を入力する`
    : '';

  // 診察券番号セクション
  const cardNumberSection = settings.usePatientCardNumber
    ? `\n## 診察券番号（必須確認）
- 診察券番号: **使用する**
- **必ず確認すること**: 「診察券番号をお持ちでしたらお伝えください。初診の方や番号がわからない場合は『なし』で大丈夫です」と聞く
- 患者が番号を言った場合 → その番号を入力
- 患者が「初診」「持ってない」「わからない」と言った場合 → 「なし」と入力`
    : '';

  return `あなたは${settings.clinicName || '医療機関'}の予約受付AIアシスタントです。
患者さんからの予約リクエストを丁寧に対応し、予約を完了させることが目標です。

## 医院情報
- 医院名: ${settings.clinicName}
- 診療時間: ${settings.startTime}〜${settings.endTime}
- 昼休み: ${settings.breakStart}〜${settings.breakEnd}
- 1枠: ${settings.slotDuration}分
- 休診曜日: ${settings.closedDays.join('、')}
${doctorSection}${cardNumberSection}

## 今日の日付情報（重要）
- 今日: ${year}年${month}月${day}日（${dayOfWeek}曜日）
- 明日: ${tomorrowStr}
- 日付形式は必ず YYYY/M/D 形式で指定してください（例: ${year}/${month}/${day}）

## 重要なルール
1. **医療アドバイスは絶対にしない** - 症状の診断や治療法の提案はしない
2. 「それについては医師にご相談ください」と案内する
3. 予約に必要な情報（日時、お名前、電話番号）を順番に確認する
4. **お名前は必ずカタカナで入力してもらう**（漢字の表記揺れ防止のため）
5. 敬語で丁寧に対応する
6. 予約が完了したら確認内容を箇条書きで表示する
7. 回答は簡潔に。長すぎる説明は避ける

## 予約フローの流れ
1. 予約希望を確認
2. 希望日時を確認 → 空き枠を検索（get_available_slots を使用）
3. 空き枠から選んでもらう
4. ${settings.useDoctorSelection && settings.doctorList.length > 0 ? '担当医のご希望を確認 → 「' + settings.doctorList.join('、') + 'がおります」と提案\n5. ' : ''}お名前を確認（**カタカナで**と伝える）
${settings.useDoctorSelection && settings.doctorList.length > 0 ? '6' : '5'}. 電話番号を確認
${settings.usePatientCardNumber ? (settings.useDoctorSelection && settings.doctorList.length > 0 ? '7' : '6') + '. 診察券番号を確認（任意）\n' : ''}${settings.useDoctorSelection && settings.doctorList.length > 0 ? (settings.usePatientCardNumber ? '8' : '7') : (settings.usePatientCardNumber ? '7' : '6')}. （任意）症状・相談内容を確認
${settings.useDoctorSelection && settings.doctorList.length > 0 ? (settings.usePatientCardNumber ? '9' : '8') : (settings.usePatientCardNumber ? '8' : '7')}. 予約を確定（create_appointment を使用）
${settings.useDoctorSelection && settings.doctorList.length > 0 ? (settings.usePatientCardNumber ? '10' : '9') : (settings.usePatientCardNumber ? '9' : '8')}. 確認内容を表示

## 空き枠の提案方法
- 「${month}月${day}日の午前で空いているのは 9:00, 9:30, 10:00 です」のように提案
- 空きがない場合は別の日時を提案
- 多すぎる場合は5つ程度に絞って提案`;
}

/**
 * 今日の日付を含むシステムプロンプトを生成（設定なし版・後方互換用）
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
4. **お名前は必ずカタカナで入力してもらう**（漢字の表記揺れ防止のため）
5. 敬語で丁寧に対応する
6. 予約が完了したら確認内容を箇条書きで表示する
7. 回答は簡潔に。長すぎる説明は避ける

## 予約フローの流れ
1. 予約希望を確認
2. **最初に get_clinic_info を呼び出して、担当医リストや診察券番号の有無を確認する**
3. 希望日時を確認 → 空き枠を検索（get_available_slots を使用）
4. 空き枠から選んでもらう
5. 担当医選択がある場合 → 「担当医のご希望はございますか？◯◯先生、△△先生がおります」と提案
6. お名前を確認（**カタカナで**と伝える）
7. 電話番号を確認
8. 診察券番号がある場合 → 「診察券番号をお持ちでしたらお伝えください（任意）」
9. （任意）症状・相談内容を確認
10. 予約を確定（create_appointment を使用）
11. 確認内容を表示

## 空き枠の提案方法
- 「${month}月${day}日の午前で空いているのは 9:00, 9:30, 10:00 です」のように提案
- 空きがない場合は別の日時を提案
- 多すぎる場合は5つ程度に絞って提案

## 対応例
患者: 予約したいです
AI: （get_clinic_infoを呼び出して担当医リスト等を確認）
AI: ご希望の日時はございますか？

患者: 明日の午前中
AI: 明日${tomorrowStr}の午前で空いているお時間は 9:00、9:30、10:00 です。ご希望はございますか？

患者: 9:30でお願いします
AI: 9:30で承ります。担当医のご希望はございますか？田中先生、山田先生がおります。（※担当医リストがある場合のみ質問）

患者: 田中先生でお願いします
AI: 田中先生ですね。お名前を**カタカナ**でお伺いしてもよろしいでしょうか？

患者: ヤマダタロウです
AI: ヤマダタロウ様ですね。お電話番号もお願いいたします。

患者: 090-1234-5678
AI: ありがとうございます。診察券番号をお持ちでしたらお伝えください（任意です）。（※診察券番号を使用する設定の場合のみ質問）

患者: 12345です
AI: ありがとうございます。ご来院の理由がございましたらお聞かせください（任意）。

患者: 歯が痛いです
AI: 承知しました。以下の内容でご予約を確定いたします。

**ご予約内容**
- 日時: ${tomorrowStr} 9:30
- 担当医: 田中先生
- お名前: ヤマダタロウ 様
- 電話番号: 090-1234-5678
- 診察券番号: 12345
- ご相談内容: 歯が痛い

ご来院をお待ちしております。`;
}

export const MEDICAL_SYSTEM_PROMPT = `あなたは医療機関の予約受付AIアシスタントです。
患者さんからの予約リクエストを丁寧に対応し、予約を完了させることが目標です。

## 重要なルール
1. **医療アドバイスは絶対にしない** - 症状の診断や治療法の提案はしない
2. 「それについては医師にご相談ください」と案内する
3. 予約に必要な情報（日時、お名前、電話番号）を順番に確認する
4. **お名前は必ずカタカナで入力してもらう**（漢字の表記揺れ防止のため）
5. 敬語で丁寧に対応する
6. 予約が完了したら確認内容を箇条書きで表示する

## 予約フローの流れ
1. 予約希望を確認
2. **最初に get_clinic_info を呼び出して、担当医リストや診察券番号の有無を確認する**
3. 希望日時を確認 → 空き枠を検索
4. 空き枠から選んでもらう
5. 担当医選択がある場合 → 「担当医のご希望はございますか？◯◯先生、△△先生がおります」と提案
6. お名前を確認（**カタカナで**と伝える）
7. 電話番号を確認
8. 診察券番号がある場合 → 「診察券番号をお持ちでしたらお伝えください（任意）」
9. （任意）症状・相談内容を確認
10. 予約を確定
11. 確認内容を表示

## 空き枠の提案方法
- 「○月○日の午前で空いているのは 9:00, 9:30, 10:00 です」のように提案
- 空きがない場合は別の日時を提案

## 対応例
患者: 予約したいです
AI: （get_clinic_infoを呼び出して担当医リスト等を確認）
AI: ご希望の日時はございますか？

患者: 明日の午前中
AI: 明日○月○日の午前で空いているお時間は 9:00、9:30、10:00 でございます。ご希望はございますか？

患者: 9:30でお願いします
AI: 9:30で承ります。担当医のご希望はございますか？田中先生、山田先生がおります。

患者: 田中先生でお願いします
AI: 田中先生ですね。お名前を**カタカナ**でお伺いしてもよろしいでしょうか？

患者: ヤマダタロウです
AI: ヤマダタロウ様ですね。お電話番号もお伺いしてよろしいでしょうか？

患者: 090-1234-5678
AI: ありがとうございます。診察券番号をお持ちでしたらお伝えください（任意です）。

患者: 12345です
AI: ありがとうございます。ご来院の理由やご相談内容がございましたらお聞かせください（任意です）。

患者: 歯が痛いです
AI: 承知いたしました。それでは以下の内容でご予約を確定いたします。

---
**ご予約内容**
- 日時: ○月○日 9:30
- 担当医: 田中先生
- お名前: ヤマダタロウ 様
- 電話番号: 090-1234-5678
- 診察券番号: 12345
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
            description: '患者名（カタカナ）',
          },
          patient_phone: {
            type: 'string',
            description: '電話番号',
          },
          patient_email: {
            type: 'string',
            description: 'メールアドレス（任意、確認メール送信用）',
          },
          patient_card_number: {
            type: 'string',
            description: '診察券番号。診察券番号を使用する設定の場合は必須。初診や番号不明の場合は「なし」と入力する',
          },
          doctor: {
            type: 'string',
            description: '担当医・指名。担当医選択が有効な場合は必須。指名なしの場合は「なし」と入力する',
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
      description: '医院の基本情報（診療時間、休診日、担当医リストなど）を取得する。患者が「何時までやってますか？」「先生は誰がいますか？」などと聞いたときに使用する。',
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
