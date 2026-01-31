/**
 * ハイブリッドモード用のチャットチェーン
 * RAG検索 + 予約機能（OpenAI Function Calling）を組み合わせる
 */

import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { supabaseClient } from './supabase-client';
import { APPOINTMENT_TOOLS } from './prompts/medical-appointment';
import {
  getAvailableSlots,
  createAppointment,
  cancelAppointment,
  getClinicSettings,
  getAppointmentsByDate,
  TimeSlot,
  ClinicSettings,
} from './appointment';
import { sendAppointmentConfirmationEmail } from './email';
import { RAG_CONFIG, DAY_NAMES } from './constants';
import {
  validateDateFormat,
  validateTimeFormat,
  validatePhone,
  validateEmail,
  validatePatientName,
  validateSymptom,
} from './validators';
import {
  sanitizeForSheet,
  sanitizeForPrompt,
  normalizeOptionalValue,
} from './sanitizers';

// RAG検索の設定
const RAG_MAX_CHUNKS = RAG_CONFIG.MAX_CHUNKS;
const RAG_MATCH_COUNT = RAG_CONFIG.MATCH_COUNT;

export interface HybridChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface HybridChatResult {
  message: string;
  toolCalls?: any[];
  appointmentCreated?: boolean;
  ragContext?: string;
}

/**
 * RAG検索を実行してコンテキストを取得
 */
async function searchRAG(siteId: string, query: string): Promise<string> {
  try {
    console.log(`[Hybrid] RAG search query: "${query}", siteId: ${siteId}`);

    // クエリの埋め込みを生成
    const embeddings = new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      dimensions: 512,
    });
    const queryEmbedding = await embeddings.embedQuery(query);
    console.log(`[Hybrid] Query embedding length: ${queryEmbedding.length}`);

    // ベクトル検索（通常RAGと同じ設定）
    const { data, error } = await supabaseClient.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: RAG_MATCH_COUNT,
      filter: {},
      match_site_id: siteId,
    });

    if (error) {
      console.error('[Hybrid] RAG search error:', error);
      return 'WEBサイト情報は見つかりませんでした';
    }

    if (!data || data.length === 0) {
      console.log('[Hybrid] RAG search: no documents found');
      return 'WEBサイト情報は見つかりませんでした';
    }

    console.log(`[Hybrid] RAG retrieved ${data.length} documents, similarities: ${data.slice(0, 5).map((d: any) => d.similarity.toFixed(2)).join(', ')}`);

    // キーワードブースティング（通常RAGと同様）
    const queryKeywords = query
      .toLowerCase()
      .split(/[^\p{Letter}\p{Number}]+/u)
      .filter((token: string) => token.length >= 2);

    const boostedRows = data.map((row: any) => {
      let keywordHits = 0;
      const haystacks = [
        (row.metadata?.title || '').toLowerCase(),
        row.content?.toLowerCase() || '',
      ];
      for (const keyword of queryKeywords) {
        if (!keyword) continue;
        for (const text of haystacks) {
          if (text && text.includes(keyword)) {
            keywordHits += 1;
            break;
          }
        }
      }
      const boost = keywordHits * 0.03;
      return { ...row, keywordHits, customScore: row.similarity + boost };
    });

    // スコア順にソート
    boostedRows.sort((a: any, b: any) => b.customScore - a.customScore);

    // 閾値フィルタリングを削除（RAGモードと同様に、低類似度でも使用）
    const filteredDocs = boostedRows.slice(0, RAG_MAX_CHUNKS);

    if (filteredDocs.length === 0) {
      console.log('[Hybrid] RAG search: no documents found');
      return 'WEBサイト情報は見つかりませんでした';
    }

    // コンテキストを構築
    const context = filteredDocs
      .map((doc: any) => doc.content)
      .join('\n\n---\n\n');

    console.log(`[Hybrid] RAG using ${filteredDocs.length} chunks, scores: ${filteredDocs.map((d: any) => d.customScore.toFixed(2)).join(', ')}`);

    return context;
  } catch (error) {
    console.error('[Hybrid] RAG search exception:', error);
    return 'WEBサイト情報は見つかりませんでした';
  }
}

/**
 * 日付を日本語フォーマットで返す
 */
function formatDateJP(date: Date): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}（${dayNames[date.getDay()]}）`;
}

/**
 * 休診日情報をフォーマット
 */
function formatClosedDaysForHybrid(settings: ClinicSettings): string {
  const parts: string[] = [];

  if (settings.closedDays.length > 0) {
    parts.push(settings.closedDays.join('・'));
  }
  if (settings.closedDaysMorning && settings.closedDaysMorning.length > 0) {
    parts.push(`${settings.closedDaysMorning.join('・')}の午前`);
  }
  if (settings.closedDaysAfternoon && settings.closedDaysAfternoon.length > 0) {
    parts.push(`${settings.closedDaysAfternoon.join('・')}の午後`);
  }

  return parts.length > 0 ? parts.join('、') : 'なし';
}

/**
 * ハイブリッド用システムプロンプトを生成（設定情報を埋め込み）
 */
function getHybridSystemPrompt(ragContext: string, settings: ClinicSettings): string {
  const today = new Date();
  const todayStr = today.toISOString();

  // RAG情報があるかどうかを判定
  const hasRagInfo = ragContext && !ragContext.includes('WEBサイト情報は見つかりませんでした');

  // 担当医リスト
  const doctorList = settings.useDoctorSelection && settings.doctorList.length > 0
    ? settings.doctorList.join('、')
    : null;

  return `あなたは${settings.clinicName || '医療機関'}の予約受付・案内アシスタントです。以下のガイドラインに従ってください。

---

⚠️ **【最重要ルール】絶対に守れ**
1. **曜日**: 患者が日付を言ったら → get_date_info を呼ぶ → その結果の曜日を使う（自分で計算するな）
2. **空き状況**: 患者が日時を言ったら → **必ず get_available_slots を呼ぶ** → その結果だけを信じる
   - ツールが返した「空き枠」= 予約可能
   - ツールが返した「予約済み」= 予約不可
   - **ツールを呼ばずに「休診かもしれない」「空いてないかも」と推測するな**
   - **ツールが空き枠を返したら、その時間は確実に予約できる**
3. **禁止ワード**: 「少々お待ちください」「お待ちください」「確認中です」「確認いたします」「〜の場合があるため」は言うな。待たせる表現は全て禁止。
4. **ツール結果は即座に伝えよ**: ツールの実行結果（空き枠情報など）が会話に含まれている場合、**その結果を即座にユーザーに伝えよ**。「確認します」「お待ちください」は絶対に言うな。結果は既に手元にある。

---

## 1. 挨拶とトーン
- 患者さんには丁寧な敬語で対応する
- 共感的で親しみやすい態度を保つ
- 痛みや不安を訴える患者には特に配慮する

## 2. 対応の使い分け
- **医院情報の質問**（料金、診療時間、アクセス、診療内容など） → **WEBサイト情報を参照して回答**
- **予約関連の質問** → 予約ツールを使用
- **WEBサイト情報にない質問** → 「直接お問い合わせください」と案内

## 3. 情報収集
以下の情報を**必ず全て**収集してから予約を確定する：
- 患者が複数の情報を一度に伝えてきた場合は、**それを活用して効率的に進める**
- 不足している情報だけを聞く（既に伝えられた情報を再度聞かない）
- 希望日時
- お名前（**カタカナで**とお願いする）
  - 漢字やひらがなで入力されたら「カタカナで教えていただけますか？」と再度聞く
  - 例: 「山田太郎」→「ヤマダタロウ様ですね。カタカナでの表記を確認させてください」
- 電話番号
- メールアドレス（「確認メールをお送りしますので、メールアドレスを教えていただけますか？（任意です）」と聞く）
${doctorList ? `- 担当医の希望（${doctorList}から選択、または「特になし」）` : ''}${settings.usePatientCardNumber ? '\n- 診察券番号（初診や不明の場合は「なし」でOK）' : ''}
- 症状・来院理由（「どのようなご症状ですか？」と必ず聞く）

## 4. 日時の確認
- 患者が日付を言ったら → **まず get_date_info を呼ぶ** → その結果で応答
- 「○月○日（△曜日）」の形式で復唱（曜日はツール結果から取得）
- **「1時」〜「6時」と言われたら、午前か午後か必ず確認する**（例:「2時は14時のことでしょうか？」）

## 5. 空き状況の確認
- 希望日の空き枠を確認し、**全ての空き枠を提示**する
- 希望時間が埋まっている場合は「その時間は予約が入っております」と伝え、他の空き時間を提案
- **空き状況は確認結果をそのまま伝える（推測しない）**

## 6. 予約確定前の最終確認
- 全ての情報が揃ったら、内容を箇条書きで表示
- 「この内容でよろしいですか？」と**必ず確認を取る**
- 患者が「はい」と答えてから予約を確定する
- **「いいえ」の場合**: 「どの部分を修正しますか？」と聞き、変更したい項目のみ再確認する

## 7. 予約完了後
- 完了メッセージを即座に表示
- 「ご来院をお待ちしております」で締める

## 8. 予約キャンセル
- 患者がキャンセルを希望した場合、以下の情報を確認する：
  - キャンセルしたい日時
  - 予約時に登録した電話番号（本人確認用）
- 確認後、cancel_appointment ツールを使用してキャンセルを実行

## 9. 医療アドバイスの禁止
- 症状の診断や治療法の提案は絶対にしない
- 「それについては医師にご相談ください」と案内する

## 10. 内部処理の非公開
- ツール名やシステムの内部処理をユーザーに見せない
- ⚠️ **「少々お待ちください」「しばらくお待ちください」は絶対に言うな**
- 代わりに以下の表現を使う：
  - 空き状況確認時: 「○月○日ですね」→ そのまま空き枠を提示
  - 情報確認時: 「確認しますね」→ そのまま結果を伝える
  - 処理中の前置きは不要。結果を即座に返す

## 11. 応答は簡潔に
- **1回の応答は2〜3文を目安**に収める
- 不要な説明・前置き・注意書きは省略する
- 同じことを繰り返し言わない
- 箇条書きを活用して読みやすくする

---

**医院情報**
- 医院名: ${settings.clinicName}
- 診療時間: ${settings.startTime}〜${settings.endTime}（昼休み ${settings.breakStart}〜${settings.breakEnd}）
- 休診: ${formatClosedDaysForHybrid(settings)}
- 1枠: ${settings.slotDuration}分
- 同時間帯予約可能数: ${settings.maxPatientsPerSlot}名
${doctorList ? `- 担当医: ${doctorList}` : ''}

**現在日時**: ${todayStr}

---

**WEBサイト情報**
${hasRagInfo ? ragContext : 'WEBサイト情報は現在取得できませんでした。予約関連の質問には対応できます。'}
`;
}

/**
 * ハイブリッドチャットを実行
 */
export async function runHybridChat(
  siteId: string,
  spreadsheetId: string,
  messages: HybridChatMessage[],
  onToken?: (token: string) => void
): Promise<HybridChatResult> {
  // ① 設定を取得（AIがget_clinic_infoを呼ばなくても設定を知れるように）
  const settings = await getClinicSettings(spreadsheetId);

  // ② RAG検索を実行（最新のユーザーメッセージで検索）
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  const query = lastUserMessage?.content || '';

  let ragContext = 'WEBサイト情報は見つかりませんでした';
  try {
    ragContext = await searchRAG(siteId, query);
  } catch (error) {
    console.error('[Hybrid] RAG search failed, continuing with appointment only:', error);
  }

  // ③ システムプロンプトを生成（RAG情報 + 医院設定を含む）
  const systemPrompt = getHybridSystemPrompt(ragContext, settings);

  const fullMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages,
  ];

  // ③ 最初の呼び出し（ツール判定用、ストリーミングなし）
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    streaming: false,
  });

  let response;
  try {
    response = await model.invoke(fullMessages as any, {
      tools: APPOINTMENT_TOOLS,
      tool_choice: 'required',
    });
  } catch (error) {
    console.error('[Hybrid] LLM invoke error:', error);
    throw error;
  }

  // ④ ツール呼び出しを処理
  if (!response.tool_calls || response.tool_calls.length === 0) {
    // tool_choice: required なのにツール呼び出しがない場合（通常起きない）
    console.error('[Hybrid] No tool calls despite tool_choice=required');
    return {
      message: 'ご質問にお答えできませんでした。もう一度お試しください。',
      ragContext,
    };
  }

  // send_message と他のツールを分離
  const sendMessageCall = response.tool_calls.find((tc: any) => tc.name === 'send_message');
  const otherToolCalls = response.tool_calls.filter((tc: any) => tc.name !== 'send_message');

  // 他のツールがある場合 → 他のツールを優先実行
  if (otherToolCalls.length > 0) {
    const toolResults: HybridChatMessage[] = [];
    let appointmentCreated = false;

    for (const toolCall of otherToolCalls) {
      let result: string;
      try {
        result = await executeToolCall(spreadsheetId, toolCall);
      } catch (error) {
        console.error('[Hybrid] Tool call failed:', error);
        result = 'ツールの実行に失敗しました。しばらくしてからお試しください。';
      }

      if (toolCall.name === 'create_appointment' && result.startsWith('予約が完了しました')) {
        appointmentCreated = true;
      }

      toolResults.push({
        role: 'tool',
        content: result,
        tool_call_id: toolCall.id,
      });
    }

    // send_message が同時に呼ばれていた場合、ダミーの結果を返す（APIエラー防止）
    if (sendMessageCall) {
      toolResults.push({
        role: 'tool',
        content: '（メッセージ送信はスキップ。ツール結果を基に応答してください）',
        tool_call_id: sendMessageCall.id,
      });
    }

    // ツール結果を含めて再度実行（ストリーミングあり）
    const newMessages = [
      ...fullMessages,
      {
        role: 'assistant' as const,
        content: '',
        tool_calls: response.tool_calls,
      },
      ...toolResults,
      {
        role: 'system' as const,
        content: '【重要】ツールの実行結果が上記にあります。「お待ちください」「確認します」は絶対に言わず、結果を即座にユーザーに伝えてください。',
      },
    ];

    const streamingModel = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      streaming: Boolean(onToken),
    });

    const finalResponse = await streamingModel.invoke(newMessages as any, {
      callbacks: onToken
        ? [
            {
              handleLLMNewToken: (token: string) => {
                onToken(token);
              },
            },
          ]
        : undefined,
    });

    return {
      message: finalResponse.content as string,
      toolCalls: otherToolCalls,
      appointmentCreated,
      ragContext,
    };
  }

  // send_message のみの場合
  const messageText = sendMessageCall!.args?.message || '';

  // 禁止ワードチェック：「お待ちください」「確認いたします」等が含まれていたらget_available_slotsを強制呼び出し
  const hasForbiddenPhrase = /お待ちください|確認いたします|確認します|お調べします/.test(messageText);
  const userMentionedDate = /\d+日|\d+時|明日|明後日|来週/.test(query);

  if (hasForbiddenPhrase && userMentionedDate) {
    console.log('[Hybrid] Forbidden phrase detected, forcing get_available_slots');
    // 日付を抽出して強制的にget_available_slotsを呼ぶ
    const dateMatch = query.match(/(\d+)月(\d+)日/) || query.match(/(\d+)日/);
    if (dateMatch) {
      const today = new Date();
      const month = dateMatch.length === 3 ? parseInt(dateMatch[1]) : today.getMonth() + 1;
      const day = dateMatch.length === 3 ? parseInt(dateMatch[2]) : parseInt(dateMatch[1]);
      const year = today.getFullYear();
      const targetDate = `${year}/${month}/${day}`;

      // get_available_slotsを直接実行
      const toolResult = await executeToolCall(spreadsheetId, {
        name: 'get_available_slots',
        args: { date: targetDate },
      });

      // 結果を含めて再度LLM呼び出し
      const retryMessages = [
        ...fullMessages,
        {
          role: 'assistant' as const,
          content: '',
          tool_calls: [{ id: 'forced_slots', name: 'get_available_slots', args: { date: targetDate } }],
        },
        {
          role: 'tool' as const,
          content: toolResult,
          tool_call_id: 'forced_slots',
        },
        {
          role: 'system' as const,
          content: '【重要】上記の空き状況を即座にユーザーに伝えてください。「お待ちください」は絶対に言うな。',
        },
      ];

      const retryModel = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        streaming: Boolean(onToken),
      });

      const retryResponse = await retryModel.invoke(retryMessages as any, {
        callbacks: onToken
          ? [{ handleLLMNewToken: (token: string) => onToken(token) }]
          : undefined,
      });

      return {
        message: retryResponse.content as string,
        toolCalls: [{ name: 'get_available_slots', args: { date: targetDate } }],
        ragContext,
      };
    }
  }

  if (onToken) {
    for (const char of messageText) {
      onToken(char);
    }
  }

  return {
    message: messageText,
    ragContext,
  };
}

/**
 * ツール呼び出しを実行
 */
async function executeToolCall(
  spreadsheetId: string,
  toolCall: { name: string; args: any }
): Promise<string> {
  const { name, args } = toolCall;

  switch (name) {
    case 'get_date_info': {
      // 日付をパースして曜日を返す
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      try {
        const [year, month, day] = args.date.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        const dayOfWeek = dayNames[date.getDay()];

        // 今日との差分も計算
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let relativeInfo = '';
        if (diffDays === 0) relativeInfo = '（今日）';
        else if (diffDays === 1) relativeInfo = '（明日）';
        else if (diffDays === 2) relativeInfo = '（明後日）';
        else if (diffDays > 0) relativeInfo = `（${diffDays}日後）`;
        else relativeInfo = '（過去の日付）';

        return `${args.date}は${dayOfWeek}曜日です${relativeInfo}`;
      } catch (e) {
        return `日付の形式が正しくありません。YYYY/M/D形式で指定してください（例: 2026/1/27）`;
      }
    }

    case 'get_available_slots': {
      // 日付のバリデーション（厳密）
      const dateValidation = validateDateFormat(args.date);
      if (!dateValidation.valid) {
        return dateValidation.error || '日付の形式が正しくありません。';
      }

      const settings = await getClinicSettings(spreadsheetId);
      const [year, month, day] = dateValidation.normalized!.split('/').map(Number);
      const targetDate = new Date(year, month - 1, day);
      targetDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 過去の日付チェック
      if (targetDate < today) {
        return `${args.date}は過去の日付です。本日以降の日付をお選びください。`;
      }

      // 予約可能日数チェック
      const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > settings.maxAdvanceDays) {
        const maxDate = new Date(today.getTime() + settings.maxAdvanceDays * 24 * 60 * 60 * 1000);
        return `${args.date}は予約可能期間外です。${settings.maxAdvanceDays}日先（${formatDateJP(maxDate)}）までの日付をお選びください。`;
      }

      const slots = await getAvailableSlots(spreadsheetId, args.date);
      console.log(`[Tool] get_available_slots for ${args.date}:`, JSON.stringify(slots, null, 2));

      // 曜日を計算（AIが間違えないように結果に含める）
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const [y, m, d] = dateValidation.normalized!.split('/').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayOfWeek = dayNames[dateObj.getDay()];
      const dateWithDay = `${args.date}（${dayOfWeek}）`;

      if (slots.length === 0) {
        return `【${dateWithDay}】休診日のため予約枠がありません。別の日をお選びください。`;
      }
      const availableSlots = slots.filter((s: TimeSlot) => s.available);
      const bookedSlots = slots.filter((s: TimeSlot) => !s.available);

      if (availableSlots.length === 0) {
        return `【${dateWithDay}】全ての枠が予約済みです。別の日をお選びください。`;
      }

      // 残り枠数を含めた情報を返す（例: "9:00(残2)", "10:00(残1)"）
      const timeListWithSlots = availableSlots.map((s: TimeSlot) =>
        s.remainingSlots > 1 ? `${s.time}(残${s.remainingSlots})` : s.time
      ).join(', ');

      // 予約済みの枠がある場合は明示
      if (bookedSlots.length > 0) {
        const bookedTimeList = bookedSlots.map((s: TimeSlot) => s.time).join(', ');
        return `【${dateWithDay}の予約状況】\n空き枠: ${timeListWithSlots}\n予約済み: ${bookedTimeList}`;
      }
      return `【${dateWithDay}の予約状況】\n空き枠: ${timeListWithSlots}\n予約済み: なし`;
    }

    case 'create_appointment': {
      // 設定を取得してバリデーション
      const settings = await getClinicSettings(spreadsheetId);

      // 日付バリデーション
      const dateVal = validateDateFormat(args.date);
      if (!dateVal.valid) {
        return dateVal.error || '日付の形式が正しくありません。';
      }

      // 時刻バリデーション
      const timeVal = validateTimeFormat(args.time);
      if (!timeVal.valid) {
        return timeVal.error || '時刻の形式が正しくありません。';
      }

      // 電話番号バリデーション（国際形式対応）
      const phoneVal = validatePhone(args.patient_phone);
      if (!phoneVal.valid) {
        return phoneVal.error || '電話番号の形式が正しくありません。';
      }
      const phoneDigits = phoneVal.normalized!;

      // 患者名バリデーション
      const nameVal = validatePatientName(args.patient_name);
      if (!nameVal.valid) {
        return nameVal.error || 'お名前を入力してください。';
      }

      // メールバリデーション（任意）
      if (args.patient_email) {
        const emailVal = validateEmail(args.patient_email);
        if (!emailVal.valid) {
          return emailVal.error || 'メールアドレスの形式が正しくありません。';
        }
      }

      // 症状バリデーション（任意）
      if (args.symptom) {
        const symptomVal = validateSymptom(args.symptom);
        if (!symptomVal.valid) {
          return symptomVal.error || 'ご来院の目的が長すぎます。';
        }
      }

      // 同一患者（電話番号）の同日重複チェック
      const existingAppointments = await getAppointmentsByDate(spreadsheetId, args.date);
      const duplicateAppointment = existingAppointments.find(
        (apt) => apt.patientPhone.replace(/[-\s]/g, '') === phoneDigits
      );
      if (duplicateAppointment) {
        return `同じ電話番号（${args.patient_phone}）で${args.date}に既に${duplicateAppointment.time}のご予約があります。別の日程をご希望ですか？`;
      }

      // 担当医選択が有効なのに doctor が未入力ならエラー
      const normalizedDoctor = normalizeOptionalValue(args.doctor || '');
      if (settings.useDoctorSelection && settings.doctorList.length > 0 && !args.doctor) {
        return `担当医の確認が必要です。「${settings.doctorList.join('、')}」の中からご希望を確認するか、特にご希望がなければ「なし」と入力してください。`;
      }

      // 診察券番号が有効なのに未入力ならエラー
      const normalizedCardNumber = normalizeOptionalValue(args.patient_card_number || '');
      if (settings.usePatientCardNumber && !args.patient_card_number) {
        return `診察券番号の確認が必要です。「診察券番号をお持ちでしたらお伝えください。初診の方や番号がわからない場合は『なし』で大丈夫です」と確認してください。`;
      }

      // サニタイズしてから保存
      const result = await createAppointment(spreadsheetId, {
        date: dateVal.normalized!,
        time: timeVal.normalized!,
        patientName: sanitizeForSheet(nameVal.normalized!),
        patientPhone: phoneDigits,
        patientEmail: args.patient_email ? sanitizeForSheet(args.patient_email) : '',
        patientCardNumber: normalizedCardNumber,
        doctor: normalizedDoctor,
        symptom: args.symptom ? sanitizeForSheet(args.symptom) : '',
        bookedVia: 'ChatBot',
      });

      if (result.success) {
        // メール送信（患者にメールアドレスがある場合）
        let emailSent = false;
        if (args.patient_email) {
          try {
            await sendAppointmentConfirmationEmail({
              patientName: args.patient_name,
              patientEmail: args.patient_email,
              date: args.date,
              time: args.time,
              clinicName: settings.clinicName,
              symptom: args.symptom,
            });
            emailSent = true;
          } catch (err) {
            console.error('[Hybrid] Email send error:', err);
          }
        }
        // 結果メッセージを組み立て
        let confirmMsg = `予約が完了しました。日時: ${args.date} ${args.time}、患者名: ${args.patient_name}`;
        if (normalizedDoctor) {
          confirmMsg += `、担当医: ${normalizedDoctor}`;
        }
        if (args.patient_email && !emailSent) {
          confirmMsg += `（確認メールの送信に失敗しました）`;
        }
        return confirmMsg;
      } else {
        return `予約に失敗しました: ${result.message}`;
      }
    }

    case 'get_clinic_info': {
      const settings = await getClinicSettings(spreadsheetId);
      let info = `医院名: ${settings.clinicName}
診療時間: ${settings.startTime}〜${settings.endTime}
昼休み: ${settings.breakStart}〜${settings.breakEnd}
1枠: ${settings.slotDuration}分
休診曜日: ${settings.closedDays.join('、')}`;

      // 担当医リストがある場合は追加
      if (settings.useDoctorSelection && settings.doctorList.length > 0) {
        info += `\n担当医: ${settings.doctorList.join('、')}`;
      }
      // 診察券番号使用の案内
      if (settings.usePatientCardNumber) {
        info += `\n※再診の方は診察券番号をお伝えください`;
      }
      return info;
    }

    case 'cancel_appointment': {
      // 日付バリデーション
      const cancelDateVal = validateDateFormat(args.date);
      if (!cancelDateVal.valid) {
        return cancelDateVal.error || '日付の形式が正しくありません。';
      }

      // 時刻バリデーション
      const cancelTimeVal = validateTimeFormat(args.time);
      if (!cancelTimeVal.valid) {
        return cancelTimeVal.error || '時刻の形式が正しくありません。';
      }

      // 電話番号バリデーション（国際形式対応）
      const cancelPhoneVal = validatePhone(args.patient_phone);
      if (!cancelPhoneVal.valid) {
        return `ご予約時にお伝えいただいた電話番号を再度ご確認ください。${cancelPhoneVal.error || ''}`;
      }
      const phoneDigits = cancelPhoneVal.normalized!;

      // 予約を検索して本人確認
      const appointments = await getAppointmentsByDate(spreadsheetId, cancelDateVal.normalized!);
      const targetAppointment = appointments.find(
        (apt) => apt.time === cancelTimeVal.normalized && apt.patientPhone.replace(/[-\s]/g, '') === phoneDigits
      );

      if (!targetAppointment) {
        return `${args.date} ${args.time}のご予約が見つかりません。日時と電話番号をご確認ください。`;
      }

      // キャンセル実行
      const result = await cancelAppointment(spreadsheetId, args.date, args.time);
      if (result.success) {
        return `${args.date} ${args.time}のご予約をキャンセルしました。またのご利用をお待ちしております。`;
      } else {
        return `キャンセルに失敗しました: ${result.message}`;
      }
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
