/**
 * ハイブリッドモード用のプロンプト構築・RAG検索
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { supabaseClient } from '../supabase-client';
import { RAG_CONFIG } from '../constants';
import { ClinicSettings } from '../appointment';

const RAG_MAX_CHUNKS = RAG_CONFIG.MAX_CHUNKS;
const RAG_MATCH_COUNT = RAG_CONFIG.MATCH_COUNT;

/**
 * RAG検索を実行してコンテキストを取得
 */
export async function searchRAG(siteId: string, query: string): Promise<string> {
  try {
    console.log(`[Hybrid] RAG search query: "${query}", siteId: ${siteId}`);

    const embeddings = new OpenAIEmbeddings({
      model: 'text-embedding-3-small',
      dimensions: 512,
    });
    const queryEmbedding = await embeddings.embedQuery(query);
    console.log(`[Hybrid] Query embedding length: ${queryEmbedding.length}`);

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

    boostedRows.sort((a: any, b: any) => b.customScore - a.customScore);

    const filteredDocs = boostedRows.slice(0, RAG_MAX_CHUNKS);

    if (filteredDocs.length === 0) {
      console.log('[Hybrid] RAG search: no documents found');
      return 'WEBサイト情報は見つかりませんでした';
    }

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
export function formatDateJP(date: Date): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}（${dayNames[date.getDay()]}）`;
}

/**
 * 休診日情報をフォーマット
 */
export function formatClosedDaysForHybrid(settings: ClinicSettings): string {
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
export function getHybridSystemPrompt(ragContext: string, settings: ClinicSettings): string {
  const today = new Date();
  const todayStr = today.toISOString();

  const hasRagInfo = ragContext && !ragContext.includes('WEBサイト情報は見つかりませんでした');

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
