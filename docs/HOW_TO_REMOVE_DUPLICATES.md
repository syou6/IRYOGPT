# 重複ドキュメントの削除方法

同じMarkdownファイルを2回学習させてしまった場合の重複削除方法です。

## 確認手順

### 1. 重複を確認

SupabaseのSQLエディタで以下を実行：

```sql
-- ファイル名ごとのドキュメント数を確認
SELECT 
  metadata->>'fileName' as file_name,
  COUNT(*) as document_count
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
GROUP BY metadata->>'fileName'
HAVING COUNT(*) > 5  -- 通常は1ファイルあたり3-5チャンク程度
ORDER BY document_count DESC;
```

**期待される結果**: 1ファイルあたり3-5チャンク程度
**問題がある場合**: 1ファイルあたり6-10チャンク以上（重複の可能性）

## 削除方法

### 方法1: SQLで重複を削除（推奨）

#### 1-1. 内容が完全に同じものを削除

`scripts/remove-duplicates.sql`を実行：

```sql
-- 同じファイル名で、同じ内容のドキュメントの2つ目以降を削除
DELETE FROM documents
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          site_id,
          metadata->>'fileName',
          content
        ORDER BY created_at ASC
      ) as rn
    FROM documents
    WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  ) t
  WHERE rn > 1
);
```

**メリット**: 
- 内容が完全に同じものだけを削除
- チャンクが異なる場合は保持される

**デメリット**: 
- チャンクサイズが異なる場合、両方残る可能性がある

#### 1-2. ファイル名だけで判定（より確実）

`scripts/remove-duplicates-by-filename.sql`を実行：

```sql
-- 同じファイル名の2つ目以降を削除（最新のものを残す）
DELETE FROM documents
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          site_id,
          metadata->>'fileName'
        ORDER BY created_at DESC
      ) as rn
    FROM documents
    WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  ) t
  WHERE rn > 1
);
```

**メリット**: 
- 確実に重複を削除できる
- 最新の学習結果を保持

**デメリット**: 
- チャンクサイズが異なる場合でも、古い方を削除する

### 方法2: 全削除して再学習（最も確実）

1. **既存のドキュメントを削除**

```sql
DELETE FROM documents 
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;
```

2. **再学習を実行**

```bash
pnpm run train:markdown 64301a5f-50e2-4bd4-8268-b682633a0857 docs/blogs-20251115T024613
```

**メリット**: 
- 確実にきれいな状態になる
- チャンクサイズなどの設定を変更できる

**デメリット**: 
- 再学習に時間がかかる（172ファイルで数分）
- コストが発生する（約$0.0032）

## 推奨される手順

### ステップ1: 重複を確認

```sql
-- scripts/check-duplicates.sql を実行
```

### ステップ2: 重複が確認できた場合

**軽微な重複（1ファイルあたり6-10チャンク）の場合**:
→ 方法1-1（内容が完全に同じものを削除）を推奨

**大幅な重複（1ファイルあたり10チャンク以上）の場合**:
→ 方法2（全削除して再学習）を推奨

### ステップ3: 削除後の確認

```sql
-- 削除後の統計を確認
SELECT 
  COUNT(*) as total_documents,
  COUNT(DISTINCT metadata->>'fileName') as unique_files,
  COUNT(*) / NULLIF(COUNT(DISTINCT metadata->>'fileName'), 0) as avg_chunks_per_file
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;
```

**期待される結果**:
- `total_documents`: 約500-800（172ファイル × 3-5チャンク）
- `unique_files`: 172
- `avg_chunks_per_file`: 3-5

## 注意事項

⚠️ **削除前に必ずバックアップを取ってください**

```sql
-- バックアップ（オプション）
CREATE TABLE documents_backup AS 
SELECT * FROM documents 
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;
```

## トラブルシューティング

### 削除後にドキュメント数が0になった場合

バックアップから復元：

```sql
INSERT INTO documents 
SELECT * FROM documents_backup;
```

### 削除後も重複が残る場合

方法2（全削除して再学習）を実行してください。

