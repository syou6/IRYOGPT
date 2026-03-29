"""
ステルス対策込みの基底スクレイパー

全てのBot検知対策をここに集約:
- navigator.webdriver 隠蔽
- User-Agent ローテーション
- Cookie/セッション再利用
- 人間的な操作の模倣（ランダム遅延、マウス移動）
- CAPTCHA検知 → 通知
- スクリーンショットによるデバッグ
"""

import asyncio
import json
import logging
import random
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Optional

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from scrapers.config import (
    HEADLESS,
    SCREENSHOTS_DIR,
    USER_AGENTS,
)

logger = logging.getLogger(__name__)


# navigator.webdriver を隠すスクリプト
STEALTH_INIT_SCRIPT = """
() => {
    // webdriver プロパティを隠す
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
    });

    // Chrome自動化プロパティを隠す
    window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
    };

    // Permissions API を偽装
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);

    // plugins を偽装（ヘッドレスは空になりがち）
    Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
    });

    // languages を偽装
    Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'ja', 'en-US', 'en']
    });

    // platform を偽装
    Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32'
    });

    // WebGL vendor/renderer を偽装
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
            return 'Intel Inc.';
        }
        if (parameter === 37446) {
            return 'Intel Iris OpenGL Engine';
        }
        return getParameter.call(this, parameter);
    };
}
"""


class BaseScraper(ABC):
    """全スクレイパーの基底クラス"""

    def __init__(self, name: str, cookies_path: Path):
        self.name = name
        self.cookies_path = cookies_path
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._captcha_detected = False

    # ------------------------------------------------------------------
    # ブラウザ起動・終了
    # ------------------------------------------------------------------

    async def start_browser(self) -> None:
        """ステルス設定済みのブラウザを起動"""
        self._playwright = await async_playwright().start()

        user_agent = random.choice(USER_AGENTS)
        logger.info(f"[{self.name}] UA: {user_agent}")

        self._browser = await self._playwright.chromium.launch(
            headless=HEADLESS,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-infobars",
                "--window-size=1280,1024",
                "--lang=ja-JP",
            ],
        )

        # Cookie が存在すればセッション再利用
        context_options = {
            "viewport": {"width": 1280, "height": 1024},
            "user_agent": user_agent,
            "locale": "ja-JP",
            "timezone_id": "Asia/Tokyo",
            "color_scheme": "light",
        }

        if self.cookies_path.exists():
            logger.info(f"[{self.name}] Cookie再利用: {self.cookies_path}")
            context_options["storage_state"] = str(self.cookies_path)

        self._context = await self._browser.new_context(**context_options)

        # ステルススクリプト注入
        await self._context.add_init_script(STEALTH_INIT_SCRIPT)

        self._page = await self._context.new_page()

        # コンソールエラーの監視
        self._page.on("console", self._on_console)

    async def close_browser(self) -> None:
        """ブラウザを安全に終了"""
        try:
            if self._context:
                await self._save_cookies()
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
        except Exception as e:
            logger.error(f"[{self.name}] ブラウザ終了エラー: {e}")
        finally:
            self._page = None
            self._context = None
            self._browser = None
            self._playwright = None

    # ------------------------------------------------------------------
    # Cookie 管理
    # ------------------------------------------------------------------

    async def _save_cookies(self) -> None:
        """Cookieを保存（次回ログインスキップ用）"""
        try:
            storage = await self._context.storage_state()
            self.cookies_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cookies_path, "w") as f:
                json.dump(storage, f, ensure_ascii=False)
            logger.info(f"[{self.name}] Cookie保存: {self.cookies_path}")
        except Exception as e:
            logger.error(f"[{self.name}] Cookie保存失敗: {e}")

    def clear_cookies(self) -> None:
        """Cookie削除（再ログイン強制）"""
        if self.cookies_path.exists():
            self.cookies_path.unlink()
            logger.info(f"[{self.name}] Cookie削除")

    # ------------------------------------------------------------------
    # 人間的な操作の模倣
    # ------------------------------------------------------------------

    async def human_delay(self, min_sec: float = 0.5, max_sec: float = 2.0) -> None:
        """ランダムな待機時間（人間っぽく）"""
        delay = random.uniform(min_sec, max_sec)
        await asyncio.sleep(delay)

    async def human_click(self, selector: str) -> None:
        """マウスを移動してからクリック（いきなりクリックしない）"""
        element = await self._page.wait_for_selector(selector, timeout=10000)
        box = await element.bounding_box()
        if box:
            # 要素の中心付近にランダムなオフセットを加える
            x = box["x"] + box["width"] / 2 + random.uniform(-3, 3)
            y = box["y"] + box["height"] / 2 + random.uniform(-3, 3)
            await self._page.mouse.move(x, y, steps=random.randint(5, 15))
            await self.human_delay(0.1, 0.4)
            await self._page.mouse.click(x, y)
        else:
            await element.click()

    async def human_type(self, selector: str, text: str) -> None:
        """1文字ずつタイプ（人間っぽい速度で）"""
        await self._page.click(selector)
        await self.human_delay(0.2, 0.5)
        for char in text:
            await self._page.keyboard.type(char, delay=random.randint(50, 150))

    async def random_scroll(self) -> None:
        """ランダムなスクロール（人間の行動を模倣）"""
        scroll_y = random.randint(100, 400)
        await self._page.mouse.wheel(0, scroll_y)
        await self.human_delay(0.3, 1.0)

    # ------------------------------------------------------------------
    # CAPTCHA 検知
    # ------------------------------------------------------------------

    async def detect_captcha(self) -> bool:
        """CAPTCHAが表示されているか検知"""
        captcha_indicators = [
            "iframe[src*='recaptcha']",
            "iframe[src*='captcha']",
            ".g-recaptcha",
            "#captcha",
            "[class*='captcha']",
            "[id*='captcha']",
            "img[src*='captcha']",
            "iframe[title*='reCAPTCHA']",
        ]

        for selector in captcha_indicators:
            try:
                element = await self._page.query_selector(selector)
                if element:
                    self._captcha_detected = True
                    logger.warning(f"[{self.name}] CAPTCHA検知: {selector}")
                    await self.screenshot("captcha_detected")
                    return True
            except Exception:
                continue

        # ページ全体のテキストからも検知
        try:
            body_text = await self._page.inner_text("body")
            captcha_keywords = ["画像認証", "captcha", "ロボットではない", "確認してください"]
            for keyword in captcha_keywords:
                if keyword.lower() in body_text.lower():
                    self._captcha_detected = True
                    logger.warning(f"[{self.name}] CAPTCHA検知(テキスト): {keyword}")
                    await self.screenshot("captcha_detected_text")
                    return True
        except Exception:
            pass

        return False

    @property
    def captcha_detected(self) -> bool:
        return self._captcha_detected

    def reset_captcha_flag(self) -> None:
        self._captcha_detected = False

    # ------------------------------------------------------------------
    # ログイン（サブクラスで実装）
    # ------------------------------------------------------------------

    @abstractmethod
    async def login(self) -> bool:
        """ログイン処理。成功でTrue"""
        ...

    @abstractmethod
    async def is_logged_in(self) -> bool:
        """現在ログイン状態かチェック"""
        ...

    async def ensure_logged_in(self) -> bool:
        """ログイン状態を保証。必要ならログインする"""
        if await self.is_logged_in():
            logger.info(f"[{self.name}] セッション有効（Cookie再利用）")
            return True

        logger.info(f"[{self.name}] ログイン実行...")
        success = await self.login()

        if success:
            await self._save_cookies()

            # ログイン後にCAPTCHAチェック
            if await self.detect_captcha():
                return False

        return success

    # ------------------------------------------------------------------
    # データ取得（サブクラスで実装）
    # ------------------------------------------------------------------

    @abstractmethod
    async def fetch_reservations(self, target_date: str) -> list[dict]:
        """指定日の予約一覧を取得。target_date: 'YYYY-MM-DD'"""
        ...

    # ------------------------------------------------------------------
    # ユーティリティ
    # ------------------------------------------------------------------

    async def screenshot(self, name: str) -> Path:
        """スクリーンショット保存（デバッグ用）"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.name}_{name}_{timestamp}.png"
        path = SCREENSHOTS_DIR / filename
        await self._page.screenshot(path=str(path), full_page=True)
        logger.info(f"[{self.name}] スクショ保存: {path}")
        return path

    async def safe_goto(self, url: str, timeout: int = 30000) -> bool:
        """安全なページ遷移（タイムアウト対応）"""
        try:
            await self._page.goto(url, wait_until="networkidle", timeout=timeout)
            await self.human_delay(0.5, 1.5)
            return True
        except Exception as e:
            logger.error(f"[{self.name}] ページ遷移失敗 {url}: {e}")
            await self.screenshot("goto_failed")
            return False

    def _on_console(self, msg) -> None:
        """ブラウザコンソールログの監視"""
        if msg.type == "error":
            logger.debug(f"[{self.name}] Console Error: {msg.text}")
