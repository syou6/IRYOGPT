#!/bin/bash
# 重複ドキュメントを全削除して再学習するスクリプト

SITE_ID="64301a5f-50e2-4bd4-8268-b682633a0857"
FOLDER_PATH="docs/blogs-20251115T024613"

echo "🧹 重複ドキュメントの削除と再学習を開始します..."
echo ""
echo "サイトID: $SITE_ID"
echo "フォルダ: $FOLDER_PATH"
echo ""

# 確認
read -p "既存のドキュメントを全削除して再学習しますか？ (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "キャンセルしました。"
    exit 1
fi

echo ""
echo "1. 既存のドキュメントを削除中..."
echo "   SQL: DELETE FROM documents WHERE site_id = '$SITE_ID';"
echo ""
echo "   ⚠️  このSQLをSupabaseのSQLエディタで実行してください"
echo "   または、以下のコマンドで実行できます（Supabase CLIが必要）:"
echo ""
echo "   supabase db execute \"DELETE FROM documents WHERE site_id = '$SITE_ID'::uuid;\""
echo ""

read -p "SQLを実行しましたか？ (y/N): " sql_done
if [[ ! $sql_done =~ ^[Yy]$ ]]; then
    echo "SQLの実行を確認できませんでした。処理を中断します。"
    exit 1
fi

echo ""
echo "2. 再学習を開始します..."
echo "   コマンド: pnpm run train:markdown $SITE_ID $FOLDER_PATH"
echo ""

pnpm run train:markdown "$SITE_ID" "$FOLDER_PATH"

echo ""
echo "✅ 処理が完了しました！"
echo ""
echo "3. 結果を確認してください:"
echo "   - ドキュメント数が約500-800件になっているか"
echo "   - 1ファイルあたり3-5チャンクになっているか"
echo "   - チャットで正常に動作するか"

