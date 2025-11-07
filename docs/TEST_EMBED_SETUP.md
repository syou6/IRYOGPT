# 🧪 埋め込みAPIテスト用サイトの準備方法

## 📋 手順

### 1. 既存のサイトを確認

Supabase SQL Editorで以下のクエリを実行して、既存のサイトを確認します：

```sql
-- すべてのサイトを確認
SELECT 
  id,
  name,
  base_url,
  status,
  is_embed_enabled,
  user_id,
  created_at,
  last_trained_at
FROM sites
ORDER BY created_at DESC;
```

### 2. サイトの状態を確認

特定のサイトIDがある場合、そのサイトの詳細を確認：

```sql
-- サイトIDを指定して確認（YOUR_SITE_IDを実際のIDに置き換える）
SELECT 
  id,
  name,
  base_url,
  status,
  is_embed_enabled,
  user_id,
  created_at,
  last_trained_at
FROM sites
WHERE id = 'YOUR_SITE_ID'::uuid;
```

### 3. 学習済みドキュメントの確認

サイトに学習済みのドキュメントがあるか確認：

```sql
-- サイトIDを指定してドキュメント数を確認
SELECT 
  site_id,
  COUNT(*) as document_count
FROM documents
WHERE site_id = 'YOUR_SITE_ID'::uuid
GROUP BY site_id;
```

### 4. サイトの設定を更新

テスト用にサイトを設定する場合、以下のSQLを実行：

```sql
-- 1. is_embed_enabled を true に設定
UPDATE sites
SET is_embed_enabled = true
WHERE id = 'YOUR_SITE_ID'::uuid;

-- 2. status が 'ready' でない場合、'ready' に設定
UPDATE sites
SET status = 'ready'
WHERE id = 'YOUR_SITE_ID'::uuid AND status != 'ready';

-- 3. 確認
SELECT 
  id,
  name,
  status,
  is_embed_enabled
FROM sites
WHERE id = 'YOUR_SITE_ID'::uuid;
```

### 5. 学習済みドキュメントがない場合

サイトにドキュメントがない場合、学習を実行する必要があります：

#### 方法A: ダッシュボードから学習を開始
1. http://localhost:3000/dashboard にアクセス
2. サイトを選択
3. 「学習を開始」ボタンをクリック
4. 学習が完了するまで待つ（`status`が`'ready'`になるまで）

#### 方法B: APIから学習を開始
```bash
# 認証トークンが必要（ブラウザの開発者ツールで取得）
curl -X POST http://localhost:3000/api/train/url \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_AUTH_COOKIE" \
  -d '{
    "site_id": "YOUR_SITE_ID",
    "baseUrl": "https://example.com"
  }'
```

### 6. 完全な確認クエリ（一括チェック）

すべての条件を一度に確認するクエリ：

```sql
-- テスト可能なサイトを一覧表示
SELECT 
  s.id,
  s.name,
  s.status,
  s.is_embed_enabled,
  COUNT(d.id) as document_count,
  CASE 
    WHEN s.status = 'ready' AND s.is_embed_enabled = true AND COUNT(d.id) > 0 
    THEN '✅ テスト可能'
    ELSE '❌ 設定が必要'
  END as test_status
FROM sites s
LEFT JOIN documents d ON s.id = d.site_id
GROUP BY s.id, s.name, s.status, s.is_embed_enabled
ORDER BY s.created_at DESC;
```

### 7. テスト用サイトを新規作成する場合

既存のサイトがない場合、新規作成：

#### 方法A: ダッシュボードから作成
1. http://localhost:3000/dashboard にアクセス
2. 「新規サイトを作成」をクリック
3. サイト情報を入力して作成
4. 学習を開始
5. 学習完了後、`is_embed_enabled`を`true`に設定

#### 方法B: SQLから直接作成（開発用）
```sql
-- 注意: user_idは実際のユーザーIDに置き換えること
INSERT INTO sites (user_id, name, base_url, status, is_embed_enabled)
VALUES (
  'YOUR_USER_ID'::uuid,
  'テストサイト',
  'https://example.com',
  'idle',
  false
)
RETURNING id, name, status, is_embed_enabled;
```

## ✅ テスト前の最終チェックリスト

テストを実行する前に、以下を確認：

- [ ] サイトが存在する
- [ ] `sites.status = 'ready'`
- [ ] `sites.is_embed_enabled = true`
- [ ] `documents`テーブルに`site_id`が一致するレコードが存在する
- [ ] 開発サーバーが起動している（`npm run dev`）

## 🚀 テスト実行

準備ができたら、以下のコマンドでテストを実行：

```bash
npm run test:embed YOUR_SITE_ID
```

## 🔍 トラブルシューティング

### エラー: "Site not found"
- サイトIDが正しいか確認
- サイトが存在するかSQLで確認

### エラー: "Embedding is not enabled"
- `is_embed_enabled`が`true`か確認
- SQL: `UPDATE sites SET is_embed_enabled = true WHERE id = 'YOUR_SITE_ID'::uuid;`

### エラー: "Site is not ready"
- `status`が`'ready'`か確認
- 学習が完了しているか確認

### エラー: チャットが動作しない
- ドキュメントが存在するか確認
- 学習が完了しているか確認

