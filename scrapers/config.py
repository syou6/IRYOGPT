"""
スクレイパー設定管理

全ての環境変数をここで一元管理する。
各モジュールは config からインポートして使う。

マルチテナント:
  StoreConfig でストアごとの資格情報を保持。
  環境変数は単一ストア用のデフォルト値として残す（後方互換）。
"""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# .env を明示的にこのファイルと同じディレクトリから読む
BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

# --- ディレクトリ ---
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
SALONBOARD_SCHEDULE_URL_KLS = "https://salonboard.com/KLS/schedule/calendar/"
SALONBOARD_TYPE = os.getenv("SALONBOARD_TYPE", "klp").lower()
SALONBOARD_COOKIES_PATH = COOKIES_DIR / "salonboard_cookies.dat"

# --- ミニモ ---
MINIMO_ID = os.getenv("MINIMO_ID", "")
MINIMO_PASSWORD = os.getenv("MINIMO_PASSWORD", "")
MINIMO_LOGIN_URL = "https://minimodel.jp/salontool/login"
MINIMO_TOP_URL = "https://minimodel.jp/salontool/"
MINIMO_COOKIES_PATH = COOKIES_DIR / "minimo_cookies.dat"

# --- Supabase ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# --- よやくらくサイトID ---
SITE_ID = os.getenv("SITE_ID", "")

# --- 通知（LINE Messaging API）---
LINE_CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
LINE_ADMIN_USER_ID = os.getenv("LINE_ADMIN_USER_ID", "")

# --- APIサーバー ---
SCRAPER_API_SECRET = os.getenv("SCRAPER_API_SECRET", "")

# --- スケジューラー ---
SYNC_INTERVAL_MIN = int(os.getenv("SYNC_INTERVAL_MIN", "150"))  # 秒（2.5分）
SYNC_INTERVAL_MAX = int(os.getenv("SYNC_INTERVAL_MAX", "240"))  # 秒（4分）

# --- レート制限クリーンアップ間隔 ---
RATE_LIMIT_CLEANUP_INTERVAL = 300  # 秒


# --- ストア設定（マルチテナント）---
@dataclass(frozen=True)
class StoreConfig:
    """1店舗分の資格情報・設定を保持"""
    store_id: str
    site_id: str
    salonboard_id: str = ""
    salonboard_password: str = ""
    salonboard_type: str = "klp"
    minimo_id: str = ""
    minimo_password: str = ""
    business_hours_start: int = 9
    business_hours_end: int = 20
    label: str = ""


def load_store_configs(config_path: Optional[str] = None) -> list[StoreConfig]:
    """
    ストア設定をロード。

    1) config_path が指定されていればJSONから読み込み
    2) なければ環境変数から単一ストアとして生成（後方互換）
    """
    path = config_path or os.getenv("STORES_CONFIG_PATH", "")
    if path and Path(path).exists():
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        return [StoreConfig(**entry) for entry in raw]

    # 後方互換: 環境変数から単一ストアを生成
    if SITE_ID:
        return [
            StoreConfig(
                store_id="default",
                site_id=SITE_ID,
                salonboard_id=SALONBOARD_ID,
                salonboard_password=SALONBOARD_PASSWORD,
                salonboard_type=SALONBOARD_TYPE,
                minimo_id=MINIMO_ID,
                minimo_password=MINIMO_PASSWORD,
                label="default (env)",
            )
        ]
    return []


# --- User-Agent（2026年3月時点のChrome最新版に合わせる）---
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
]
