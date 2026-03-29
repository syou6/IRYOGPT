#!/bin/bash
# ============================================================
# よやくらく スクレイパー VPSセットアップスクリプト
#
# 対象: ConoHa VPS (Ubuntu 22.04/24.04)
# ブラウザ自動化: zendriver + Xvfb（headless=False）
#
# 使い方:
#   1. VPSにSSHで入る
#      ssh root@133.88.120.151
#
#   2. このスクリプトを実行
#      cd /home/IRYOGPT && bash scrapers/setup-vps.sh
#
#   3. .env を編集
#      nano /home/IRYOGPT/scrapers/.env
#
#   4. サービス起動
#      sudo systemctl start yoyakuraku-scraper
#
# ============================================================

set -e

echo "=========================================="
echo " よやくらく スクレイパー セットアップ"
echo " (zendriver + Xvfb)"
echo "=========================================="

# --- 1. システム更新 & 依存パッケージ ---
echo ""
echo "[1/6] システム更新 & 依存パッケージインストール..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
    python3 python3-pip python3-venv \
    git wget curl unzip \
    xvfb \
    fonts-ipafont fonts-ipaexfont

# Google Chrome インストール（zendriverが使用）
if ! command -v google-chrome &> /dev/null; then
    echo "[1/6] Google Chrome インストール..."
    wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    sudo dpkg -i /tmp/chrome.deb || sudo apt -f install -y
    rm /tmp/chrome.deb
fi

echo "Chrome version: $(google-chrome --version)"

# --- 2. リポジトリ取得 ---
echo ""
echo "[2/6] リポジトリ取得..."
cd /home

if [ -d "IRYOGPT" ]; then
    echo "IRYOGPT ディレクトリが既に存在。pull..."
    cd IRYOGPT && git pull origin main
else
    git clone git@github.com:syou6/IRYOGPT.git
    cd IRYOGPT
fi

# --- 3. Python仮想環境 & 依存パッケージ ---
echo ""
echo "[3/6] Python仮想環境セットアップ..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r scrapers/requirements.txt

# --- 4. 環境変数ファイル ---
echo ""
echo "[4/6] 環境変数ファイル..."
if [ ! -f scrapers/.env ]; then
    cp scrapers/.env.example scrapers/.env
    echo ""
    echo "================================================"
    echo " scrapers/.env を編集してください！"
    echo ""
    echo "   nano /home/IRYOGPT/scrapers/.env"
    echo ""
    echo " 必須項目:"
    echo "   - SALONBOARD_ID / PASSWORD"
    echo "   - SUPABASE_URL / SERVICE_KEY"
    echo "   - SITE_ID"
    echo "   - LINE_CHANNEL_ACCESS_TOKEN / ADMIN_USER_ID"
    echo "   - SCRAPER_API_SECRET"
    echo "================================================"
    echo ""
else
    echo ".env は既に存在。スキップ。"
fi

# --- 5. systemdサービス登録 ---
echo ""
echo "[5/6] systemdサービス登録..."
sudo cp scrapers/yoyakuraku-scraper.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable yoyakuraku-scraper

echo "サービス登録完了。"

# --- 6. ファイアウォール設定 ---
echo ""
echo "[6/6] ファイアウォール設定..."
sudo ufw allow 8000/tcp 2>/dev/null || true
sudo ufw allow 22/tcp 2>/dev/null || true

echo ""
echo "=========================================="
echo " セットアップ完了！"
echo "=========================================="
echo ""
echo " 次のステップ:"
echo ""
echo " 1. .env を編集:"
echo "    nano /home/IRYOGPT/scrapers/.env"
echo ""
echo " 2. サービス起動:"
echo "    sudo systemctl start yoyakuraku-scraper"
echo ""
echo " 3. 動作確認:"
echo "    sudo journalctl -u yoyakuraku-scraper -f"
echo ""
echo " 4. ヘルスチェック:"
echo "    curl http://localhost:8000/health"
echo ""
echo " 5. 手動テスト:"
echo "    source venv/bin/activate"
echo "    Xvfb :99 -screen 0 1920x1080x24 &"
echo "    export DISPLAY=:99"
echo "    python -m scrapers.main --screenshot salonboard"
echo ""
echo " API URL（Vercelに設定）:"
echo "    http://133.88.120.151:8000"
echo ""
