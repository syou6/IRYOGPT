"""
スクレイパー設定管理

環境変数から設定を読み込み、各スクレイパー・サービスに提供する。
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ディレクトリ
BASE_DIR = Path(__file__).parent
COOKIES_DIR = BASE_DIR / "cookies"
SCREENSHOTS_DIR = BASE_DIR / "screenshots"
LOGS_DIR = BASE_DIR / "logs"

COOKIES_DIR.mkdir(exist_ok=True)
SCREENSHOTS_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)

# --- サロンボード ---
SALONBOARD_ID = os.getenv("SALONBOARD_ID", "")
SALONBOARD_PASSWORD = os.getenv("SALONBOARD_PASSWORD", "")
SALONBOARD_LOGIN_URL = "https://salonboard.com/login/"
SALONBOARD_TOP_URL = "https://salonboard.com/KLP/top/"
SALONBOARD_SCHEDULE_URL = "https://salonboard.com/KLP/schedule/salonSchedule/"
SALONBOARD_COOKIES_PATH = COOKIES_DIR / "salonboard_cookies.json"

# --- ミニモ ---
MINIMO_ID = os.getenv("MINIMO_ID", "")
MINIMO_PASSWORD = os.getenv("MINIMO_PASSWORD", "")
MINIMO_LOGIN_URL = "https://minimodel.jp/salontool/login"
MINIMO_TOP_URL = "https://minimodel.jp/salontool/"
MINIMO_COOKIES_PATH = COOKIES_DIR / "minimo_cookies.json"

# --- Supabase ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# --- 通知 ---
NOTIFY_LINE_TOKEN = os.getenv("NOTIFY_LINE_TOKEN", "")  # LINE Notify
NOTIFY_EMAIL = os.getenv("NOTIFY_EMAIL", "")

# --- スケジューラー ---
SYNC_INTERVAL_MIN = int(os.getenv("SYNC_INTERVAL_MIN", "150"))  # 秒（2.5分）
SYNC_INTERVAL_MAX = int(os.getenv("SYNC_INTERVAL_MAX", "240"))  # 秒（4分）

# --- ブラウザ ---
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
]
