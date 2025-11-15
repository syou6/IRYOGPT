# サイトIDの確認方法

特定のサイトにマークダウンファイルを学習させる際に必要なサイトIDを確認する方法を説明します。

## 方法1: ダッシュボードから確認（推奨）

1. ダッシュボード（`/dashboard`）にログインします
2. サイトカードに「サイトID」が表示されています
3. サイトIDは以下のような形式です：
   ```
   abc123def456...
   ```

## 方法2: URLから確認

サイトのチャットページやインサイトページのURLから確認できます：

- チャットページ: `/dashboard/[siteId]`
- インサイトページ: `/dashboard/[siteId]/insights`
- 埋め込み設定: `/dashboard/sites/[siteId]/embed`

URLの `[siteId]` の部分がサイトIDです。

**例：**
```
https://your-domain.com/dashboard/abc123def456
```
この場合、サイトIDは `abc123def456` です。

## 方法3: ブラウザの開発者ツールから確認

1. ダッシュボードを開きます
2. ブラウザの開発者ツール（F12）を開きます
3. Consoleタブで以下を実行：

```javascript
// サイト一覧を取得してIDを表示
fetch('/api/sites', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('sb-access-token') || 'YOUR_TOKEN'}`
  }
})
.then(res => res.json())
.then(sites => {
  console.table(sites.map(s => ({ id: s.id, name: s.name, url: s.base_url })));
});
```

## 方法4: APIから直接取得

認証トークンを使用してAPIから直接取得：

```bash
# 認証トークンを取得（ブラウザの開発者ツールのApplication > Local Storageから）
TOKEN="your-auth-token"

# サイト一覧を取得
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/sites
```

レスポンス例：
```json
[
  {
    "id": "abc123def456",
    "name": "マイサイト",
    "base_url": "https://example.com",
    "status": "ready",
    ...
  }
]
```

## 方法5: データベースから直接確認

SupabaseのSQLエディタで以下を実行：

```sql
-- すべてのサイトを表示
SELECT id, name, base_url, status, created_at 
FROM sites 
ORDER BY created_at DESC;

-- 特定のユーザーのサイトのみ表示
SELECT id, name, base_url, status 
FROM sites 
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC;
```

## 方法6: コマンドラインツールで確認

Node.jsスクリプトを作成：

```typescript
// scripts/get-site-ids.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSiteIds() {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, base_url, status');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.table(data);
}

getSiteIds();
```

実行：
```bash
tsx -r dotenv/config scripts/get-site-ids.ts
```

## よくある質問

### Q: サイトIDはどこで使われますか？

A: 以下の場面で使用します：
- マークダウンファイルの学習: `npm run train:markdown <site_id> <folder_path>`
- APIリクエスト: `/api/sites/[siteId]`
- チャットページ: `/dashboard/[siteId]`

### Q: サイトIDは変更できますか？

A: いいえ、サイトIDはUUIDで自動生成されるため、変更できません。新しいサイトを作成する場合は、新しいサイトIDが割り当てられます。

### Q: サイトIDが表示されない場合は？

A: ダッシュボードのコードを最新版に更新してください。サイトIDは各サイトカードに表示されるようになっています。

