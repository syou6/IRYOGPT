# 🔴 Redis セットアップガイド

Upstash Redisの設定手順

## 📋 必要な情報

Upstashダッシュボードから以下を取得：

1. **Redis Protocol URL**（例: `pleasing-frog-34743.upstash.io`）
2. **Port**（通常: `6379`）
3. **Password**（REST Tokenと同じか、別途確認）

## 🔧 環境変数の設定

`.env.local` に以下を追加：

```env
# Upstash Redis設定
REDIS_HOST=pleasing-frog-34743.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=AYe3AAIncDI1ZDczZjEyMDc3N2Q0YjFhOGU1NjFhZTQ5ZmNkZWIzYXAyMzQ3NDM
```

**注意**: 
- `REDIS_HOST`は、REST URLから `https://` を除いたもの
- `REDIS_PASSWORD`は、REST Tokenと同じか、Upstashダッシュボードで確認

## ✅ 接続テスト

```bash
npm run test:redis
```

成功すると以下のように表示されます：

```
🔍 Redis接続テスト開始

接続情報:
  Host: pleasing-frog-34743.upstash.io
  Port: 6379
  Password: ***設定済み***

📡 Redisに接続中...
✅ 接続成功！

🧪 操作テスト:
  SET/GET: ✅ 成功
  Queue操作: ✅ 成功
  クリーンアップ: ✅ 完了

📊 Redis情報:
  Redis Version: 7.x.x
  Host: pleasing-frog-34743.upstash.io:6379
  Status: ✅ 正常

🎉 すべてのテストが成功しました！
```

## 🚀 次のステップ

1. **接続テスト**: `npm run test:redis`
2. **ワーカー起動**: `npm run worker`
3. **学習ジョブ送信**: ダッシュボードから学習を開始

## 🔍 トラブルシューティング

### エラー: ENOTFOUND

**原因**: ホスト名が間違っている

**解決方法**:
- Upstashダッシュボードで「Redis Protocol URL」を確認
- `REDIS_HOST`を正しい値に設定

### エラー: NOAUTH / invalid password

**原因**: パスワードが間違っている

**解決方法**:
- Upstashダッシュボードでパスワードを確認
- `REDIS_PASSWORD`を正しい値に設定

### エラー: ECONNREFUSED

**原因**: ポート番号が間違っている、またはファイアウォール設定

**解決方法**:
- ポート番号が`6379`か確認
- Upstashダッシュボードで接続情報を再確認

## 📚 参考リンク

- [Upstash Redis ドキュメント](https://docs.upstash.com/redis)
- [BullMQ ドキュメント](https://docs.bullmq.io/)

