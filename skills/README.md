# Claude Skills セットアップ

このディレクトリには、Claude に読み込ませる専用スキルを配置します。使い方の例:

1. Claude (cli / デスクトップ) を開いた状態で、`/read` コマンドでファイルを読み込む。
   ```
   /read skills/green-frontend.skill.md
   ```
2. そのまま「LP をデザインして」と指示すると、読み込んだスキルのガイドラインに従ったUIが生成されます。

`docs/GREEN_FRONTEND_SKILL.md` は背景となる仕様書で、`skills/green-frontend.skill.md` は実際に Claude が読み込むコンパクトなプロンプトです。

