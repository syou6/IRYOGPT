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
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeek = dayNames[today.getDay()];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}/${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;

  // RAG情報があるかどうかを判定
  const hasRagInfo = ragContext && !ragContext.includes('WEBサイト情報は見つかりませんでした');

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

  return `あなたは${settings.clinicName || '医療機関'}のAIアシスタントです。
患者さんからの質問や予約リクエストに丁寧に対応します。

## 医院情報（スプレッドシートより）
- 医院名: ${settings.clinicName}
- 診療時間: ${settings.startTime}〜${settings.endTime}
- 昼休み: ${settings.breakStart}〜${settings.breakEnd}
- 1枠: ${settings.slotDuration}分
- 休診曜日: ${settings.closedDays.join('、')}
${doctorSection}${cardNumberSection}

## 医院のWEBサイト情報
${hasRagInfo ? `以下の情報を**必ず参照して**回答してください。この情報に含まれる内容は正確に伝えてください。
---
${ragContext}
---` : `WEBサイト情報は現在取得できませんでした。予約関連の質問には対応できます。`}

## 今日の日付情報
- 今日: ${year}年${month}月${day}日（${dayOfWeek}曜日）
- 明日: ${tomorrowStr}
- 日付形式は必ず YYYY/M/D 形式で指定してください（例: ${year}/${month}/${day}）

## 重要なルール
1. **WEBサイト情報に記載がある内容は、その情報を使って回答する**（料金、診療時間、アクセス、診療内容など）
2. **医療アドバイスは絶対にしない** - 症状の診断や治療法の提案はしない
3. **お名前は必ずカタカナで入力してもらう**（漢字の表記揺れ防止のため）
4. 敬語で丁寧に対応する
5. 回答は簡潔に

## 対応の使い分け
- **医院情報の質問**（料金、診療時間、アクセス、診療内容など） → **WEBサイト情報を参照して回答**
- **予約関連の質問** → 予約ツール（get_available_slots, create_appointment）を使用
- **WEBサイト情報に記載がない場合のみ**「直接お問い合わせください」と案内

## 予約フローの流れ
1. 予約希望を確認
2. 希望日時を確認 → 空き枠を検索（get_available_slots を使用）
3. 空き枠から選んでもらう
${settings.useDoctorSelection && settings.doctorList.length > 0 ? `4. 担当医のご希望を確認 → 「${settings.doctorList.join('、')}がおります。特にご希望がなければ『なし』でも大丈夫です」
5. ` : '4. '}お名前を確認（**カタカナで**と伝える）
${settings.useDoctorSelection && settings.doctorList.length > 0 ? '6' : '5'}. 電話番号を確認
${settings.usePatientCardNumber ? (settings.useDoctorSelection && settings.doctorList.length > 0 ? '7' : '6') + '. 診察券番号を確認（任意）\n' : ''}${settings.useDoctorSelection && settings.doctorList.length > 0 ? (settings.usePatientCardNumber ? '8' : '7') : (settings.usePatientCardNumber ? '7' : '6')}. （任意）症状・相談内容を確認
${settings.useDoctorSelection && settings.doctorList.length > 0 ? (settings.usePatientCardNumber ? '9' : '8') : (settings.usePatientCardNumber ? '8' : '7')}. 予約を確定（create_appointment を使用）
${settings.useDoctorSelection && settings.doctorList.length > 0 ? (settings.usePatientCardNumber ? '10' : '9') : (settings.usePatientCardNumber ? '9' : '8')}. 確認内容を表示`;
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
    case 'get_available_slots': {
      const slots = await getAvailableSlots(spreadsheetId, args.date);
      if (slots.length === 0) {
        return `${args.date}は休診日のため、予約枠がありません。別の日をお選びください。`;
      }
      const availableSlots = slots.filter((s: TimeSlot) => s.available);
      if (availableSlots.length === 0) {
        return `${args.date}は予約が埋まっています。別の日をお選びください。`;
      }
      const timeList = availableSlots.map((s: TimeSlot) => s.time).join(', ');
      return `${args.date}の空き枠: ${timeList}`;
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
