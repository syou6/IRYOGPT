"""
ステルス対策込みの基底スクレイパー（zendriver版）

zendriver = nodriverのアクティブfork（2026年3月現在も活発にメンテナンス）
- CDP直接通信（Selenium/WebDriver不要）→ bot検知回避力が最も高い
- 完全async/awaitネイティブ → run_in_executor不要
- Cookie保存/読込のビルトインサポート
- VPSでは Xvfb + headless=False で運用（headless=Trueは検知される）
"""

import asyncio
import logging
import random
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import zendriver as uc

from scrapers.config import (
    SCREENSHOTS_DIR,
    USER_AGENTS,
)

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))


class BaseScraper(ABC):
    """全スクレイパーの基底クラス（zendriver版）"""

    SESSION_MAX_AGE_HOURS = 12

    def __init__(self, name: str, cookies_path: Path):
        self.name = name
        self.cookies_path = cookies_path
        self._browser = None
        self._page = None
        self._captcha_detected = False
        self._last_login_time: Optional[datetime] = None
        self._consecutive_failures = 0
        self._max_retries = 3
        self._scrape_count = 0

    # ------------------------------------------------------------------
    # ブラウザ起動・終了
    # ------------------------------------------------------------------

    async def start_browser(self) -> None:
        """zendriver でブラウザを起動（Xvfb環境前提、headless=False）"""
        user_agent = random.choice(USER_AGENTS)
        logger.info(f"[{self.name}] UA: {user_agent}")

        # headless=False が必須（headless=True は検知される）
        # VPSでは Xvfb で仮想ディスプレイを提供
        self._browser = await uc.start(
            headless=False,
            lang="ja-JP",
            browser_args=[
                f"--user-agent={user_agent}",
                "--window-size=1280,1024",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-infobars",
            ],
        )

        # Cookie読み込み
        await self._load_cookies()

        logger.info(f"[{self.name}] ブラウザ起動完了 (zendriver)")

    async def close_browser(self) -> None:
        """ブラウザを安全に終了"""
        try:
            if self._browser:
                await self._save_cookies()
                self._browser.stop()
        except Exception as e:
            logger.error(f"[{self.name}] ブラウザ終了エラー: {e}")
        finally:
            self._page = None
            self._browser = None

    async def maybe_restart_browser(self) -> None:
        """メモリリーク対策: 20回に1回ブラウザを再起動"""
        self._scrape_count += 1
        if self._scrape_count % 20 == 0:
            logger.info(f"[{self.name}] 定期再起動（{self._scrape_count}回目）")
            await self.close_browser()
            await self.start_browser()

    # ------------------------------------------------------------------
    # Cookie 管理
    # ------------------------------------------------------------------

    async def _save_cookies(self) -> None:
        """Cookieを保存"""
        try:
            self.cookies_path.parent.mkdir(parents=True, exist_ok=True)
            await self._browser.cookies.save(file=str(self.cookies_path))
            logger.info(f"[{self.name}] Cookie保存: {self.cookies_path}")
        except Exception as e:
            logger.error(f"[{self.name}] Cookie保存失敗: {e}")

    async def _load_cookies(self) -> bool:
        """保存済みCookieを読み込み"""
        if not self.cookies_path.exists():
            return False
        try:
            await self._browser.cookies.load(file=str(self.cookies_path))
            logger.info(f"[{self.name}] Cookie読込: {self.cookies_path}")
            return True
        except Exception as e:
            logger.error(f"[{self.name}] Cookie読込失敗: {e}")
            return False

    def clear_cookies(self) -> None:
        """Cookie削除（再ログイン強制）"""
        if self.cookies_path.exists():
            self.cookies_path.unlink()
            logger.info(f"[{self.name}] Cookie削除")

    # ------------------------------------------------------------------
    # 人間的な操作の模倣
    # ------------------------------------------------------------------

    async def human_delay(self, min_sec: float = 0.5, max_sec: float = 2.0) -> None:
        """ランダムな待機時間"""
        await asyncio.sleep(random.uniform(min_sec, max_sec))

    async def human_click(self, element) -> None:
        """要素をクリック（遅延付き）"""
        await self.human_delay(0.1, 0.4)
        await element.click()

    async def human_type(self, element, text: str) -> None:
        """1文字ずつタイプ"""
        await element.click()
        await self.human_delay(0.2, 0.5)
        await element.clear_input()
        for char in text:
            await element.send_keys(char)
            await asyncio.sleep(random.uniform(0.05, 0.15))

    async def random_scroll(self) -> None:
        """ランダムなスクロール"""
        scroll_y = random.randint(100, 400)
        await self._page.evaluate(f"window.scrollBy(0, {scroll_y})")
        await self.human_delay(0.3, 1.0)

    # ------------------------------------------------------------------
    # 要素検索ヘルパー
    # ------------------------------------------------------------------

    async def find(self, selector: str, timeout: int = 10):
        """CSS セレクタ or テキストで要素を検索"""
        try:
            element = await self._page.find(selector, timeout=timeout)
            return element
        except Exception:
            return None

    async def find_all(self, selector: str) -> list:
        """CSSセレクタで複数要素を検索"""
        try:
            return await self._page.select_all(selector)
        except Exception:
            return []

    async def query(self, selector: str):
        """CSSセレクタで要素を検索（見つからなければNone、タイムアウトなし）"""
        try:
            return await self._page.query_selector(selector)
        except Exception:
            return None

    # ------------------------------------------------------------------
    # CAPTCHA 検知
    # ------------------------------------------------------------------

    async def detect_captcha(self) -> bool:
        """CAPTCHAが表示されているか検知"""
        captcha_selectors = [
            "iframe[src*='recaptcha']",
            "iframe[src*='captcha']",
            ".g-recaptcha",
            "#captcha",
            "[class*='captcha']",
            "[id*='captcha']",
            "img[src*='captcha']",
            "iframe[title*='reCAPTCHA']",
        ]

        for selector in captcha_selectors:
            try:
                element = await self.query(selector)
                if element:
                    self._captcha_detected = True
                    logger.warning(f"[{self.name}] CAPTCHA検知: {selector}")
                    await self.screenshot("captcha_detected")
                    return True
            except Exception:
                continue

        # ページテキストからも検知
        try:
            body_text = await self._page.evaluate("document.body.innerText")
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
        """ログイン状態を保証"""
        if self._is_session_expired():
            logger.info(f"[{self.name}] セッション期限切れ → 再ログイン")
            self.clear_cookies()
        elif await self.is_logged_in():
            logger.info(f"[{self.name}] セッション有効")
            await self._save_cookies()
            return True

        logger.info(f"[{self.name}] ログイン実行...")
        success = await self.login()

        if success:
            self._last_login_time = datetime.now(JST)
            await self._save_cookies()
            if await self.detect_captcha():
                return False

        return success

    def _is_session_expired(self) -> bool:
        """セッション有効期限チェック"""
        now = datetime.now(JST)
        if self._last_login_time is None:
            if self.cookies_path.exists():
                import os
                mtime = datetime.fromtimestamp(
                    os.path.getmtime(self.cookies_path), tz=JST
                )
                return (now - mtime).total_seconds() / 3600 > self.SESSION_MAX_AGE_HOURS
            return False
        return (now - self._last_login_time).total_seconds() / 3600 > self.SESSION_MAX_AGE_HOURS

    # ------------------------------------------------------------------
    # セッション切れ検知と自動復旧
    # ------------------------------------------------------------------

    async def detect_session_expired(self) -> bool:
        """セッション切れを検知"""
        try:
            current_url = self._page.url
            if "/login" in current_url.lower():
                logger.warning(f"[{self.name}] セッション切れ（ログインページにリダイレクト）")
                return True

            body_text = await self._page.evaluate("document.body.innerText")
            for keyword in ["ログインの有効期限が切れました", "一定時間操作されなかった", "セッションが切れ", "再度ログイン"]:
                if keyword in body_text:
                    logger.warning(f"[{self.name}] セッション切れ: {keyword}")
                    return True
        except Exception:
            pass
        return False

    async def recover_session(self) -> bool:
        """セッション切れからの自動復旧"""
        logger.info(f"[{self.name}] セッション復旧開始...")
        self.clear_cookies()

        try:
            await self.close_browser()
            await self.start_browser()

            success = await self.login()
            if success:
                self._last_login_time = datetime.now(JST)
                await self._save_cookies()
                self._consecutive_failures = 0
                logger.info(f"[{self.name}] セッション復旧成功")
            return success
        except Exception as e:
            logger.error(f"[{self.name}] セッション復旧失敗: {e}")
            return False

    # ------------------------------------------------------------------
    # データ取得（サブクラスで実装）
    # ------------------------------------------------------------------

    @abstractmethod
    async def fetch_reservations(self, target_date: str) -> list[dict]:
        """指定日の予約一覧を取得。target_date: 'YYYY-MM-DD'"""
        ...

    async def fetch_reservations_safe(self, target_date: str) -> list[dict]:
        """予約取得（セッション切れ自動復旧 + メモリリーク対策付き）"""
        await self.maybe_restart_browser()

        for attempt in range(self._max_retries):
            try:
                reservations = await self.fetch_reservations(target_date)

                if await self.detect_session_expired():
                    logger.warning(f"[{self.name}] セッション切れ → 復旧 ({attempt + 1}/{self._max_retries})")
                    if await self.recover_session():
                        continue
                    else:
                        break

                self._consecutive_failures = 0
                return reservations

            except Exception as e:
                self._consecutive_failures += 1
                logger.error(f"[{self.name}] 予約取得エラー ({attempt + 1}/{self._max_retries}): {e}")
                if attempt < self._max_retries - 1:
                    wait = (2 ** attempt) + random.uniform(0, 1)
                    logger.info(f"[{self.name}] {wait:.1f}秒後にリトライ")
                    await asyncio.sleep(wait)

        return []

    # ------------------------------------------------------------------
    # ユーティリティ
    # ------------------------------------------------------------------

    async def screenshot(self, name: str) -> Path:
        """スクリーンショット保存"""
        timestamp = datetime.now(JST).strftime("%Y%m%d_%H%M%S")
        filename = f"{self.name}_{name}_{timestamp}.png"
        path = SCREENSHOTS_DIR / filename
        try:
            await self._page.save_screenshot(str(path))
            logger.info(f"[{self.name}] スクショ保存: {path}")
        except Exception as e:
            logger.error(f"[{self.name}] スクショ失敗: {e}")
        return path

    async def safe_goto(self, url: str, timeout: int = 30) -> bool:
        """安全なページ遷移"""
        try:
            self._page = await self._browser.get(url, new_tab=False)
            await self.human_delay(0.5, 1.5)
            return True
        except Exception as e:
            logger.error(f"[{self.name}] ページ遷移失敗 {url}: {e}")
            await self.screenshot("goto_failed")
            return False

    async def wait_for_url(self, condition, timeout: int = 15) -> bool:
        """URLが条件を満たすまで待つ"""
        import time
        end_time = time.time() + timeout
        while time.time() < end_time:
            try:
                if condition(self._page.url):
                    return True
            except Exception:
                pass
            await asyncio.sleep(0.5)
        return False
