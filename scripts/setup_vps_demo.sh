#!/usr/bin/env bash
# =============================================================================
# setup_vps_demo.sh
#
# ConoHa VPS (133.88.120.151) セットアップスクリプト
# IryoGPT デモサーバー (FastAPI on port 8001) を systemd サービスとして登録する。
#
# 構成:
#   - xvfb.service       : 仮想ディスプレイ (Xvfb :99)
#                          ステルステスト実行時のブラウザ用。デモサーバー起動前に開始する。
#   - iryogpt-demo.service: デモサーバー本体
#                          python -m scrapers.demo_server (ポート 8001)
#                          nginx が 80 番でリバースプロキシする。
#
# 使い方:
#   1. VPS に SSH ログイン: ssh root@133.88.120.151
#   2. このファイルを /root/IRYOGPT/scripts/setup_vps_demo.sh に配置
#   3. 実行権限を付与して実行:
#        chmod +x /root/IRYOGPT/scripts/setup_vps_demo.sh
#        sudo /root/IRYOGPT/scripts/setup_vps_demo.sh
# =============================================================================
set -euo pipefail

# --- 定数 -------------------------------------------------------------------
APP_DIR="/root/IRYOGPT"
PYTHON_BIN="/root/IRYOGPT/.venv/bin/python"   # venv を使っている場合
# venv が無ければシステム python3 にフォールバック
if [ ! -f "$PYTHON_BIN" ]; then
  PYTHON_BIN="$(command -v python3)"
fi

SERVICE_USER="root"   # VPS が root 運用の場合。別ユーザーにする場合はここを変更
DEMO_PORT="8001"
XVFB_DISPLAY=":99"
XVFB_RESOLUTION="1920x1080x24"

echo "==> Python: $PYTHON_BIN"
echo "==> App dir: $APP_DIR"

# --- 依存パッケージ確認 (Xvfb) ---------------------------------------------
if ! command -v Xvfb &>/dev/null; then
  echo "==> Xvfb が見つかりません。インストールします..."
  apt-get update -qq
  apt-get install -y -qq xvfb
else
  echo "==> Xvfb は既にインストール済み"
fi

# =============================================================================
# 1. xvfb.service
#    Xvfb が systemd に標準登録されていない環境向けに手動で作成する。
# =============================================================================
XVFB_SERVICE_FILE="/etc/systemd/system/xvfb.service"

echo "==> xvfb.service を作成: $XVFB_SERVICE_FILE"
cat > "$XVFB_SERVICE_FILE" <<EOF
[Unit]
Description=X Virtual Frame Buffer (Xvfb) for display ${XVFB_DISPLAY}
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
ExecStart=/usr/bin/Xvfb ${XVFB_DISPLAY} -screen 0 ${XVFB_RESOLUTION} -ac +extension GLX +render -noreset
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# =============================================================================
# 2. iryogpt-demo.service
#    デモサーバー本体。Xvfb の起動後に開始する。
#    DISPLAY 環境変数を設定することでヘッドレスブラウザが利用可能になる。
# =============================================================================
DEMO_SERVICE_FILE="/etc/systemd/system/iryogpt-demo.service"

echo "==> iryogpt-demo.service を作成: $DEMO_SERVICE_FILE"
cat > "$DEMO_SERVICE_FILE" <<EOF
[Unit]
Description=IryoGPT Demo Server (FastAPI port ${DEMO_PORT})
Documentation=https://github.com/yourusername/IRYOGPT
After=network.target xvfb.service
Wants=xvfb.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}

# 仮想ディスプレイ (Xvfb が必要なブラウザ操作用)
Environment="DISPLAY=${XVFB_DISPLAY}"
# Python パスを通す (venv)
Environment="PATH=${APP_DIR}/.venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ExecStart=${PYTHON_BIN} -m scrapers.demo_server

# 失敗時に自動再起動 (最大10回試行、30秒クールダウン)
Restart=on-failure
RestartSec=10
StartLimitBurst=10
StartLimitIntervalSec=300

# ログをジャーナルへ
StandardOutput=journal
StandardError=journal
SyslogIdentifier=iryogpt-demo

[Install]
WantedBy=multi-user.target
EOF

# =============================================================================
# 3. systemd リロード & サービス有効化 / 起動
# =============================================================================
echo "==> systemd をリロード..."
systemctl daemon-reload

echo "==> xvfb.service を有効化して起動..."
systemctl enable xvfb.service
systemctl restart xvfb.service

echo "==> iryogpt-demo.service を有効化して起動..."
systemctl enable iryogpt-demo.service
systemctl restart iryogpt-demo.service

# --- 起動確認 ---------------------------------------------------------------
echo ""
echo "==> サービス状態確認..."
sleep 2
systemctl status xvfb.service --no-pager || true
echo ""
systemctl status iryogpt-demo.service --no-pager || true

echo ""
echo "==> ポート ${DEMO_PORT} の待ち受け確認..."
ss -tlnp | grep ":${DEMO_PORT}" || echo "   (まだ起動中の可能性あり。数秒後に再確認してください)"

# =============================================================================
# 4. nginx リバースプロキシ設定 (任意)
#    nginx がインストール済みの場合、/etc/nginx/conf.d/iryogpt-demo.conf を作成する。
#    既に設定済みであればスキップされる。
# =============================================================================
NGINX_CONF="/etc/nginx/conf.d/iryogpt-demo.conf"

if command -v nginx &>/dev/null && [ ! -f "$NGINX_CONF" ]; then
  echo ""
  echo "==> nginx リバースプロキシ設定を作成: $NGINX_CONF"
  cat > "$NGINX_CONF" <<'NGINX'
# IryoGPT デモサーバー リバースプロキシ
# 80番 → 8001番 に転送する
server {
    listen 80;
    server_name _;  # ドメインがある場合は書き換える (例: demo.iryogpt.com)

    location / {
        proxy_pass         http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
NGINX

  nginx -t && systemctl reload nginx \
    && echo "==> nginx 設定を適用しました" \
    || echo "   nginx 設定テスト失敗。$NGINX_CONF を確認してください"

elif command -v nginx &>/dev/null && [ -f "$NGINX_CONF" ]; then
  echo "==> nginx 設定は既に存在します ($NGINX_CONF)。スキップします"
else
  echo "==> nginx が見つかりません。必要であれば手動でインストール・設定してください"
fi

# =============================================================================
# 完了メッセージ
# =============================================================================
echo ""
echo "============================================================"
echo "  セットアップ完了"
echo "============================================================"
echo ""
echo "  サービス確認コマンド:"
echo "    systemctl status iryogpt-demo.service"
echo "    journalctl -u iryogpt-demo.service -f"
echo ""
echo "  デモサーバー直接確認:"
echo "    curl http://localhost:${DEMO_PORT}/demo"
echo ""
echo "  nginx 経由確認 (80番):"
echo "    curl http://133.88.120.151/demo"
echo ""
echo "  サービス停止/起動:"
echo "    systemctl stop  iryogpt-demo.service"
echo "    systemctl start iryogpt-demo.service"
echo "============================================================"
