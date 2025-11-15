# 学習結果の確認方法

マークダウンファイルの学習が完了した後、正しく保存されているか確認する方法を説明します。

## 確認方法

### 方法1: ダッシュボードで確認（最も簡単）

1. **ダッシュボードにアクセス**
   - `/dashboard` にログインします

2. **サイトの状態を確認**
   - サイトカードのステータスが `ready` になっているか確認
   - 「最終学習」の日時が更新されているか確認

3. **チャットでテスト**
   - サイトカードの「チャット開始」ボタンをクリック
   - 学習した内容に関する質問をしてみる
   - 例：「100日チャレンジについて教えて」

### 方法2: データベースで確認（詳細）

SupabaseのSQLエディタで以下のクエリを実行：

#### 基本的な確認

```sql
-- サイト情報とドキュメント数を確認
SELECT 
  s.id as site_id,
  s.name as site_name,
  s.status,
  COUNT(d.id) as document_count
FROM sites s
LEFT JOIN documents d ON s.id = d.site_id
WHERE s.id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
GROUP BY s.id, s.name, s.status;
```

**期待される結果：**
- `document_count`: 737（チャンク数）
- `status`: `ready`

#### ドキュメントの詳細確認

```sql
-- 保存されたドキュメントのサンプルを確認
SELECT 
  id,
  LEFT(content, 200) as content_preview,
  metadata->>'title' as title,
  metadata->>'fileName' as file_name
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
ORDER BY created_at DESC
LIMIT 10;
```

#### 統計情報の確認

```sql
-- ドキュメントの統計情報
SELECT 
  COUNT(*) as total_chunks,
  COUNT(DISTINCT metadata->>'fileName') as unique_files,
  AVG(LENGTH(content)) as avg_content_length
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;
```

**期待される結果：**
- `total_chunks`: 約737
- `unique_files`: 約172（マークダウンファイル数）

### 方法3: APIで確認

#### チャットAPIでテスト

```bash
# 認証トークンを取得（ブラウザの開発者ツールから）
TOKEN="your-auth-token"
SITE_ID="64301a5f-50e2-4bd4-8268-b682633a0857"

# チャットAPIでテスト
curl -X POST https://your-domain.com/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "100日チャレンジについて教えて",
    "site_id": "'$SITE_ID'"
  }'
```

#### サイト一覧APIで確認

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/sites
```

### 方法4: スクリプトで確認

`scripts/check-site-documents.sql` ファイルを使用：

1. SupabaseのSQLエディタを開く
2. `scripts/check-site-documents.sql` の内容をコピー＆ペースト
3. 実行して結果を確認

## 確認チェックリスト

- [ ] サイトのステータスが `ready` になっている
- [ ] ドキュメント数が約737件（チャンク数）になっている
- [ ] ファイル数が約172件（マークダウンファイル数）になっている
- [ ] チャットで質問して、学習した内容が返ってくる
- [ ] `last_trained_at` が更新されている

## トラブルシューティング

### ドキュメント数が0の場合

1. スクリプトの実行ログを確認
2. エラーが発生していないか確認
3. サイトIDが正しいか確認

### チャットで回答が返ってこない場合

1. サイトのステータスが `ready` になっているか確認
2. ドキュメントが正しく保存されているか確認（方法2）
3. 質問内容が学習した内容に関連しているか確認

### サイトのステータスが `ready` にならない場合

手動でステータスを更新：

```sql
UPDATE sites 
SET status = 'ready' 
WHERE id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;
```

## 次のステップ

学習が確認できたら：

1. **チャットでテスト**: `/dashboard/64301a5f-50e2-4bd4-8268-b682633a0857` でチャットを試す
2. **埋め込みコードを取得**: `/dashboard/sites/64301a5f-50e2-4bd4-8268-b682633a0857/embed` で埋め込みコードを確認
3. **インサイトを確認**: `/dashboard/64301a5f-50e2-4bd4-8268-b682633a0857/insights` で質問の分析を確認

