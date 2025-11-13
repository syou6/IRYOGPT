# 🚀 Parole 機能実装ガイド

## 📋 実装の進め方

このガイドでは、Parole 機能を段階的に実装する方法を説明します。

---

## 🎯 Phase 1: MVP 実装（1-2 週間）

### **Step 1: データベーススキーマの作成**

1. **マイグレーションファイルを実行**

```bash
# Supabaseダッシュボードで実行、またはCLIで実行
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/20241201_add_chat_logs.sql
```

または、Supabase ダッシュボードの SQL Editor で実行してください。

2. **動作確認**

```sql
-- テーブルが作成されたか確認
SELECT * FROM chat_logs LIMIT 1;

-- 関数が作成されたか確認
SELECT proname FROM pg_proc WHERE proname LIKE 'get_question%';
```

---

### **Step 2: チャット API の修正**

既存の`/api/chat`と`/api/embed/chat`に、ログ保存機能を追加します。

#### **修正箇所**

1. **`pages/api/embed/chat.ts`** の修正例：

```typescript
// ストリーミング完了後、ログを保存
try {
  // ... 既存のコード ...

  // ログを保存（Parole機能）
  try {
    // セッションIDを生成（クライアントから送られてくるか、サーバーで生成）
    const sessionId =
      req.body.session_id ||
      `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await supabaseClient.from('chat_logs').insert({
      user_id: userId,
      site_id: site_id,
      question: sanitizedQuestion,
      answer: outputText,
      session_id: sessionId,
      source: 'embed',
      user_agent: req.headers['user-agent'] || null,
      referrer: req.headers['referer'] || null,
    });
  } catch (logError) {
    // ログ保存のエラーは無視（チャット機能には影響しない）
    console.error('[Embed Chat API] Failed to save chat log:', logError);
  }
} catch (error) {
  // ... エラーハンドリング ...
}
```

2. **`pages/api/chat.ts`** も同様に修正

---

### **Step 3: 分析 API の動作確認**

作成した API エンドポイントをテストします。

```bash
# 質問ランキングを取得
curl -X GET "http://localhost:3000/api/insights/questions?site_id=YOUR_SITE_ID&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# キーワード出現頻度を取得
curl -X GET "http://localhost:3000/api/insights/keywords?site_id=YOUR_SITE_ID&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 時系列データを取得
curl -X GET "http://localhost:3000/api/insights/timeline?site_id=YOUR_SITE_ID&interval=day" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### **Step 4: ダッシュボード UI の作成**

新しいページ `/dashboard/[siteId]/insights` を作成します。

#### **基本的な構造**

```typescript
// pages/dashboard/[siteId]/insights.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { createSupabaseClient } from '@/utils/supabase-auth';

export default function InsightsPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const [questions, setQuestions] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseClient();

  useEffect(() => {
    if (!siteId) return;

    const fetchInsights = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // 質問ランキングを取得
      const questionsRes = await fetch(
        `/api/insights/questions?site_id=${siteId}&limit=10`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      const questionsData = await questionsRes.json();
      setQuestions(questionsData.questions || []);

      // キーワードを取得
      const keywordsRes = await fetch(
        `/api/insights/keywords?site_id=${siteId}&limit=20`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      const keywordsData = await keywordsRes.json();
      setKeywords(keywordsData.keywords || []);

      // 時系列データを取得
      const timelineRes = await fetch(
        `/api/insights/timeline?site_id=${siteId}&interval=day`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      const timelineData = await timelineRes.json();
      setTimeline(timelineData.timeline || []);

      setLoading(false);
    };

    fetchInsights();
  }, [siteId, supabase]);

  if (loading) {
    return <Layout>読み込み中...</Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">質問インサイト</h1>

        {/* 質問ランキング */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">よくある質問 TOP 10</h2>
          <div className="space-y-2">
            {questions.map((q: any, index: number) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">#{index + 1}</span>
                  <span className="text-sm text-gray-500">{q.count}回</span>
                </div>
                <p className="mt-2">{q.question}</p>
              </div>
            ))}
          </div>
        </section>

        {/* キーワード */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            よく使われるキーワード
          </h2>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw: any, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 rounded-full text-sm"
              >
                {kw.keyword} ({kw.count})
              </span>
            ))}
          </div>
        </section>

        {/* 時系列グラフ（簡易版） */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">質問数の推移</h2>
          <div className="space-y-1">
            {timeline.map((item: any, index: number) => (
              <div key={index} className="flex items-center gap-4">
                <span className="text-sm w-32">
                  {new Date(item.period_start).toLocaleDateString('ja-JP')}
                </span>
                <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                  <div
                    className="bg-blue-500 h-6 rounded-full"
                    style={{
                      width: `${
                        (item.question_count /
                          Math.max(
                            ...timeline.map((t: any) => t.question_count),
                          )) *
                        100
                      }%`,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white">
                    {item.question_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
```

---

## 🎯 Phase 2: クラスタリング機能（3-4 週間）

### **Step 1: ベクトル拡張機能の追加**

1. **pgvector 拡張機能の有効化**

```sql
-- Supabaseでpgvectorが有効になっているか確認
CREATE EXTENSION IF NOT EXISTS vector;
```

2. **ベクトルインデックスの追加**

```sql
-- 既存のchat_logsテーブルにベクトルインデックスを追加
CREATE INDEX IF NOT EXISTS idx_chat_logs_embedding
ON chat_logs USING ivfflat (question_embedding vector_cosine_ops)
WITH (lists = 100);
```

3. **質問のベクトル化処理**

新しい API エンドポイント `/api/insights/cluster` を作成して、質問をベクトル化し、クラスタリングを実行します。

---

## 📊 実装の優先順位

### **今すぐ実装可能（1-2 週間）**

1. ✅ **データベーススキーマ作成** - 1 日
2. ✅ **チャット API 修正（ログ保存）** - 2-3 日
3. ✅ **分析 API 作成** - 3-5 日
4. ✅ **基本的なダッシュボード UI** - 5-7 日

**合計: 約 2 週間**

### **1-2 ヶ月で実装可能**

5. ✅ **類似質問クラスタリング** - 2-3 週間
6. ✅ **購入前/購入後分析** - 1-2 週間
7. ✅ **CSV エクスポート** - 3-5 日

**合計: 約 1-2 ヶ月**

### **3-6 ヶ月で実装可能**

8. ✅ **AI 改善提案** - 1-2 ヶ月
9. ✅ **外部連携（Slack/Notion）** - 2-4 週間
10. ✅ **マルチユーザー共有** - 2-3 週間

**合計: 約 3-6 ヶ月**

---

## 🛠️ 技術的な注意点

### **パフォーマンス**

- **大量データ対応**: 10 万件以上のログが蓄積される可能性があるため、パーティション化を検討
- **インデックス最適化**: よく使われるクエリに合わせてインデックスを調整
- **キャッシュ**: Redis を使用して頻繁にアクセスされるデータをキャッシュ

### **コスト**

- **OpenAI Embeddings**: 質問 1 件あたり約$0.00002（512 次元）
- **ストレージ**: Supabase の無料プランで約 500MB（約 10 万件のログ）
- **計算リソース**: クラスタリングはバッチ処理で実行し、リアルタイム処理を避ける

### **セキュリティ**

- **RLS**: Row Level Security でユーザー間のデータ分離を徹底
- **個人情報**: 必要に応じて個人情報をマスキング
- **アクセスログ**: 誰がいつデータにアクセスしたかを記録

---

## 🚦 次のステップ

1. **データベーススキーマの作成**から始める
2. **チャット API の修正**でログ保存機能を追加
3. **基本的な分析 API**を作成
4. **ダッシュボード UI**を実装

実装を開始する準備ができたら、まずデータベーススキーマの作成から始めましょう！
