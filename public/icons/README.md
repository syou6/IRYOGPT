# アイコン画像

埋め込みチャットボットのFABボタンに表示するアイコン画像をここに配置してください。

## 使い方

1. アイコン画像（PNG、SVG、JPGなど）をこのフォルダに配置
2. ファイル名を `chat-icon.png` などに設定
3. データベースで `icon_url` に以下のパスを設定：
   - 本番環境: `https://webgpt-dun.vercel.app/icons/chat-icon.png`
   - ローカル環境: `http://localhost:3000/icons/chat-icon.png`

## 推奨サイズ

- 推奨: 64px × 64px 以上
- 最小: 32px × 32px
- 形式: PNG（透明背景対応）または SVG

## 例

```
public/icons/
  ├── chat-icon.png      # デフォルトのチャットアイコン
  ├── custom-icon.png    # カスタムアイコン
  └── README.md          # このファイル
```

