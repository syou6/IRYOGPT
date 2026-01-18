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
  getClinicSettings,
  TimeSlot,
  ClinicSettings,
} from './appointment';
import { sendAppointmentConfirmationEmail } from './email';

// RAG検索の設定（通常RAGに合わせる）
const RAG_MAX_CHUNKS = 6;
const RAG_MATCH_COUNT = 15;

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

## 1. 挨拶とトーン
- 患者さんには丁寧な敬語で対応する
- 共感的で親しみやすい態度を保つ
- 痛みや不安を訴える患者には特に配慮する

## 2. 対応の使い分け
- **医院情報の質問**（料金、診療時間、アクセス、診療内容など） → **WEBサイト情報を参照して回答**
- **予約関連の質問** → 予約ツールを使用
- **WEBサイト情報にない質問** → 「直接お問い合わせください」と案内

## 3. 情報収集（必ず1つずつ順番に確認）
以下の情報を**必ず全て**収集してから予約を確定する：
- 希望日時
- お名前（**カタカナで**とお願いする）
- 電話番号
${doctorList ? `- 担当医の希望（${doctorList}から選択、または「特になし」）` : ''}${settings.usePatientCardNumber ? '\n- 診察券番号（初診や不明の場合は「なし」でOK）' : ''}
- 症状・来院理由（「どのようなご症状ですか？」と必ず聞く）

## 4. 日時の確認
- 患者が日付を言ったら、**必ず get_date_info ツールで曜日を確認**してから応答する
- 絶対に自分で曜日を計算しない
- 「○月○日（△曜日）」の形式で復唱する

## 5. 空き状況の確認
- 希望日の空き枠を確認し、**5つ以内**で提案する
- 希望時間が埋まっている場合は「その時間は予約が入っております」と伝え、近い時間を提案
- **空き状況は確認結果をそのまま伝える（推測しない）**

## 6. 予約確定前の最終確認
- 全ての情報が揃ったら、内容を箇条書きで表示
- 「この内容でよろしいですか？」と**必ず確認を取る**
- 患者が「はい」と答えてから予約を確定する

## 7. 予約完了後
- 完了メッセージを即座に表示
- 「ご来院をお待ちしております」で締める

## 8. 医療アドバイスの禁止
- 症状の診断や治療法の提案は絶対にしない
- 「それについては医師にご相談ください」と案内する

## 9. 内部処理の非公開
- ツール名やシステムの内部処理をユーザーに見せない
- 「確認しますね」「お調べします」など自然な表現を使う
- 「少々お待ちください」は言わない

---

**医院情報**
- 医院名: ${settings.clinicName}
- 診療時間: ${settings.startTime}〜${settings.endTime}（昼休み ${settings.breakStart}〜${settings.breakEnd}）
- 休診: ${settings.closedDays.join('、')}
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
      tool_choice: 'auto',
    });
  } catch (error) {
    console.error('[Hybrid] LLM invoke error:', error);
    throw error;
  }

  // ④ ツール呼び出しがある場合
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolResults: HybridChatMessage[] = [];
    let appointmentCreated = false;

    for (const toolCall of response.tool_calls) {
      let result: string;
      try {
        result = await executeToolCall(spreadsheetId, toolCall);
      } catch (error) {
        console.error('[Hybrid] Tool call failed:', error);
        result = 'ツールの実行に失敗しました。しばらくしてからお試しください。';
      }

      if (toolCall.name === 'create_appointment' && result.includes('完了')) {
        appointmentCreated = true;
      }

      toolResults.push({
        role: 'tool',
        content: result,
        tool_call_id: toolCall.id,
      });
    }

    // ツール結果を含めて再度実行（ストリーミングあり）
    const newMessages = [
      ...fullMessages,
      {
        role: 'assistant' as const,
        content: response.content || '',
        tool_calls: response.tool_calls,
      },
      ...toolResults,
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
      toolCalls: response.tool_calls,
      appointmentCreated,
      ragContext,
    };
  }

  // ⑤ ツール呼び出しがない場合（通常の応答）
  if (onToken) {
    const streamingModel = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      streaming: true,
    });

    const streamingResponse = await streamingModel.invoke(fullMessages as any, {
      callbacks: [
        {
          handleLLMNewToken: (token: string) => {
            onToken(token);
          },
        },
      ],
    });

    return {
      message: streamingResponse.content as string,
      ragContext,
    };
  }

  return {
    message: response.content as string,
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
      const slots = await getAvailableSlots(spreadsheetId, args.date);
      console.log(`[Tool] get_available_slots for ${args.date}:`, JSON.stringify(slots, null, 2));

      if (slots.length === 0) {
        return `【${args.date}】休診日のため予約枠がありません。別の日をお選びください。`;
      }
      const availableSlots = slots.filter((s: TimeSlot) => s.available);
      const bookedSlots = slots.filter((s: TimeSlot) => !s.available);

      if (availableSlots.length === 0) {
        return `【${args.date}】全ての枠が予約済みです。別の日をお選びください。`;
      }

      // 残り枠数を含めた情報を返す（例: "9:00(残2)", "10:00(残1)"）
      const timeListWithSlots = availableSlots.map((s: TimeSlot) =>
        s.remainingSlots > 1 ? `${s.time}(残${s.remainingSlots})` : s.time
      ).join(', ');

      // 予約済みの枠がある場合は明示
      if (bookedSlots.length > 0) {
        const bookedTimeList = bookedSlots.map((s: TimeSlot) => s.time).join(', ');
        return `【${args.date}の予約状況】\n空き枠: ${timeListWithSlots}\n予約済み: ${bookedTimeList}`;
      }
      return `【${args.date}の予約状況】\n空き枠: ${timeListWithSlots}\n予約済み: なし`;
    }

    case 'create_appointment': {
      // 設定を取得してバリデーション
      const settings = await getClinicSettings(spreadsheetId);

      // 担当医選択が有効なのに doctor が未入力ならエラー
      if (settings.useDoctorSelection && settings.doctorList.length > 0 && !args.doctor) {
        return `担当医の確認が必要です。「${settings.doctorList.join('、')}」の中からご希望を確認するか、特にご希望がなければ「なし」と入力してください。`;
      }

      // 診察券番号が有効なのに未入力ならエラー
      if (settings.usePatientCardNumber && !args.patient_card_number) {
        return `診察券番号の確認が必要です。「診察券番号をお持ちでしたらお伝えください。初診の方や番号がわからない場合は『なし』で大丈夫です」と確認してください。`;
      }

      const result = await createAppointment(spreadsheetId, {
        date: args.date,
        time: args.time,
        patientName: args.patient_name,
        patientPhone: args.patient_phone,
        patientEmail: args.patient_email || '',
        patientCardNumber: args.patient_card_number || '',
        doctor: args.doctor || '',
        symptom: args.symptom || '',
        bookedVia: 'ChatBot',
      });

      if (result.success) {
        // メール送信（患者にメールアドレスがある場合）
        if (args.patient_email) {
          sendAppointmentConfirmationEmail({
            patientName: args.patient_name,
            patientEmail: args.patient_email,
            date: args.date,
            time: args.time,
            clinicName: settings.clinicName,
            symptom: args.symptom,
          }).catch((err) => {
            console.error('[Hybrid] Email send error:', err);
          });
        }
        // 結果メッセージを組み立て
        let confirmMsg = `予約が完了しました。日時: ${args.date} ${args.time}、患者名: ${args.patient_name}`;
        if (args.doctor) {
          confirmMsg += `、担当医: ${args.doctor}`;
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

    default:
      return `Unknown tool: ${name}`;
  }
}
