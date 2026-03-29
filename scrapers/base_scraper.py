"""
ステルス対策込みの基底スクレイパー（undetected-chromedriver版）

playwright-bot-bypass スキルの知見を反映:
- undetected-chromedriver: ChromeDriverをバイナリレベルでパッチ
- 本物のGPU使用（SwiftShaderではない）→ WebGL検知を完全回避
- navigator.webdriver 自動除去
- CDP検知も回避

全てのBot検知対策をここに集約:
- undetected-chromedriver による自動ステルス
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
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    WebDriverException,
)

from scrapers.config import (
    HEADLESS,
    SCREENSHOTS_DIR,
    USER_AGENTS,
)

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))


class BaseScraper(ABC):
    """全スクレイパーの基底クラス（undetected-chromedriver版）"""

    # セッション有効期限（サロンボード: 15時間、安全マージンで12時間）
    SESSION_MAX_AGE_HOURS = 12

    def __init__(self, name: str, cookies_path: Path):
        self.name = name
        self.cookies_path = cookies_path
        self._driver: Optional[uc.Chrome] = None
        self._captcha_detected = False
        self._last_login_time: Optional[datetime] = None
        self._consecutive_failures = 0
        self._max_retries = 3

    # ------------------------------------------------------------------
    # ブラウザ起動・終了
    # ------------------------------------------------------------------

    async def start_browser(self) -> None:
        """undetected-chromedriver でブラウザを起動"""
        user_agent = random.choice(USER_AGENTS)
        logger.info(f"[{self.name}] UA: {user_agent}")

        options = uc.ChromeOptions()

        if HEADLESS:
            options.add_argument("--headless=new")

        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-infobars")
        options.add_argument("--window-size=1280,1024")
        options.add_argument("--lang=ja-JP")
        options.add_argument(f"--user-agent={user_agent}")
        options.add_argument("--disable-blink-features=AutomationControlled")

        # Cookie再利用のためuser-data-dirを指定
        user_data_dir = self.cookies_path.parent / f"{self.name}_profile"
        user_data_dir.mkdir(parents=True, exist_ok=True)
        options.add_argument(f"--user-data-dir={user_data_dir}")

        # undetected-chromedriver は自動でChromeバージョンを検出・パッチ
        self._driver = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: uc.Chrome(options=options, use_subprocess=True),
        )

        # 追加のステルス: chrome.runtime を補完
        self._driver.execute_script("""
            if (!window.chrome) { window.chrome = {}; }
            if (!window.chrome.runtime) {
                window.chrome.runtime = {
                    PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
                    PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
                    PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
                    RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
                    OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
                    OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' }
                };
            }
        """)

        logger.info(f"[{self.name}] ブラウザ起動完了 (undetected-chromedriver)")

    async def close_browser(self) -> None:
        """ブラウザを安全に終了"""
        try:
            if self._driver:
                await asyncio.get_event_loop().run_in_executor(
                    None, self._driver.quit
                )
        except Exception as e:
            logger.error(f"[{self.name}] ブラウザ終了エラー: {e}")
        finally:
            self._driver = None

    # ------------------------------------------------------------------
    # Cookie 管理
    # ------------------------------------------------------------------

    async def _save_cookies(self) -> None:
        """Cookieを保存（次回ログインスキップ用）"""
        try:
            cookies = await asyncio.get_event_loop().run_in_executor(
                None, self._driver.get_cookies
            )
            self.cookies_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cookies_path, "w") as f:
                json.dump(cookies, f, ensure_ascii=False)
            logger.info(f"[{self.name}] Cookie保存: {self.cookies_path}")
        except Exception as e:
            logger.error(f"[{self.name}] Cookie保存失敗: {e}")

    async def _load_cookies(self) -> bool:
        """保存済みCookieを読み込んで適用"""
        if not self.cookies_path.exists():
            return False
        try:
            with open(self.cookies_path) as f:
                cookies = json.load(f)
            for cookie in cookies:
                # Selenium用にCookieのキーを調整
                cookie.pop("sameSite", None)
                cookie.pop("storeId", None)
                try:
                    await asyncio.get_event_loop().run_in_executor(
                        None, lambda c=cookie: self._driver.add_cookie(c)
                    )
                except Exception:
                    continue
            logger.info(f"[{self.name}] Cookie読込: {len(cookies)}件")
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
        """ランダムな待機時間（人間っぽく）"""
        delay = random.uniform(min_sec, max_sec)
        await asyncio.sleep(delay)

    async def human_click(self, selector: str) -> None:
        """マウスを移動してからクリック（いきなりクリックしない）"""
        element = await self._find_element(selector)
        if element:
            actions = ActionChains(self._driver)
            # ランダムなオフセットを加える
            offset_x = random.randint(-3, 3)
            offset_y = random.randint(-3, 3)
            actions.move_to_element_with_offset(element, offset_x, offset_y)
            actions.pause(random.uniform(0.1, 0.4))
            actions.click()
            await asyncio.get_event_loop().run_in_executor(
                None, actions.perform
            )

    async def human_type(self, selector: str, text: str) -> None:
        """1文字ずつタイプ（人間っぽい速度で）"""
        element = await self._find_element(selector)
        if element:
            await asyncio.get_event_loop().run_in_executor(
                None, element.click
            )
            await self.human_delay(0.2, 0.5)
            for char in text:
                await asyncio.get_event_loop().run_in_executor(
                    None, lambda c=char: element.send_keys(c)
                )
                await asyncio.sleep(random.uniform(0.05, 0.15))

    async def random_scroll(self) -> None:
        """ランダムなスクロール（人間の行動を模倣）"""
        scroll_y = random.randint(100, 400)
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._driver.execute_script(f"window.scrollBy(0, {scroll_y})")
        )
        await self.human_delay(0.3, 1.0)

    # ------------------------------------------------------------------
    # 要素検索ヘルパー
    # ------------------------------------------------------------------

    async def _find_element(self, selector: str, timeout: int = 10):
        """CSSセレクタで要素を検索（Playwright互換のセレクタを変換）"""
        # Playwright の :has-text() や :visible をSeleniumに変換
        if ":has-text(" in selector:
            # a:has-text("ログイン"):visible → XPathに変換
            text_match = selector.split(':has-text("')[1].split('")')[0]
            tag = selector.split(":has-text(")[0] or "*"
            xpath = f'//{tag}[contains(text(), "{text_match}")]'
            try:
                wait = WebDriverWait(self._driver, timeout)
                return await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: wait.until(EC.presence_of_element_located((By.XPATH, xpath)))
                )
            except TimeoutException:
                return None

        # 通常のCSSセレクタ
        try:
            wait = WebDriverWait(self._driver, timeout)
            return await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
            )
        except TimeoutException:
            return None

    async def _find_elements(self, selector: str) -> list:
        """CSSセレクタで複数要素を検索"""
        try:
            return await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._driver.find_elements(By.CSS_SELECTOR, selector)
            )
        except Exception:
            return []

    async def _query_selector(self, selector: str):
        """要素を検索（見つからなければNone）。タイムアウトなし。"""
        try:
            return await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._driver.find_element(By.CSS_SELECTOR, selector)
            )
        except NoSuchElementException:
            return None

    async def _get_text(self, element) -> str:
        """要素のテキストを取得"""
        return await asyncio.get_event_loop().run_in_executor(
            None, lambda: element.text.strip()
        )

    async def _get_attribute(self, element, attr: str) -> str:
        """要素の属性値を取得"""
        return await asyncio.get_event_loop().run_in_executor(
            None, lambda: element.get_attribute(attr) or ""
        )

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
                element = await self._query_selector(selector)
                if element:
                    self._captcha_detected = True
                    logger.warning(f"[{self.name}] CAPTCHA検知: {selector}")
                    await self.screenshot("captcha_detected")
                    return True
            except Exception:
                continue

        # ページ全体のテキストからも検知
        try:
            body = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._driver.find_element(By.TAG_NAME, "body").text
            )
            captcha_keywords = ["画像認証", "captcha", "ロボットではない", "確認してください"]
            for keyword in captcha_keywords:
                if keyword.lower() in body.lower():
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
        if self._is_session_expired():
            logger.info(f"[{self.name}] セッション期限切れ（{self.SESSION_MAX_AGE_HOURS}時間超過）→ 再ログイン")
            self.clear_cookies()
        elif await self.is_logged_in():
            logger.info(f"[{self.name}] セッション有効（Cookie再利用）")
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
        """セッション有効期限を超過しているか"""
        now = datetime.now(JST)
        if self._last_login_time is None:
            if self.cookies_path.exists():
                import os
                mtime = datetime.fromtimestamp(
                    os.path.getmtime(self.cookies_path), tz=JST
                )
                age_hours = (now - mtime).total_seconds() / 3600
                return age_hours > self.SESSION_MAX_AGE_HOURS
            return False
        age_hours = (now - self._last_login_time).total_seconds() / 3600
        return age_hours > self.SESSION_MAX_AGE_HOURS

    # ------------------------------------------------------------------
    # セッション切れ検知と自動復旧
    # ------------------------------------------------------------------

    async def detect_session_expired(self) -> bool:
        """ページ遷移後にセッション切れを検知"""
        try:
            current_url = await asyncio.get_event_loop().run_in_executor(
                None, lambda: self._driver.current_url
            )
            if "/login" in current_url.lower():
                logger.warning(f"[{self.name}] セッション切れ検知（ログインページにリダイレクト）")
                return True

            body = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._driver.find_element(By.TAG_NAME, "body").text
            )
            expired_keywords = [
                "ログインの有効期限が切れました",
                "一定時間操作されなかった",
                "セッションが切れ",
                "再度ログイン",
            ]
            for keyword in expired_keywords:
                if keyword in body:
                    logger.warning(f"[{self.name}] セッション切れ検知: {keyword}")
                    return True

        except Exception:
            pass
        return False

    async def recover_session(self) -> bool:
        """セッション切れからの自動復旧"""
        logger.info(f"[{self.name}] セッション復旧開始...")
        self.clear_cookies()

        try:
            # ブラウザ再起動
            await self.close_browser()
            await self.start_browser()

            # 再ログイン
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
        """予約取得（セッション切れ自動復旧付き）"""
        for attempt in range(self._max_retries):
            try:
                reservations = await self.fetch_reservations(target_date)

                if await self.detect_session_expired():
                    logger.warning(
                        f"[{self.name}] セッション切れ → 復旧試行 "
                        f"({attempt + 1}/{self._max_retries})"
                    )
                    if await self.recover_session():
                        continue
                    else:
                        break

                self._consecutive_failures = 0
                return reservations

            except Exception as e:
                self._consecutive_failures += 1
                logger.error(
                    f"[{self.name}] 予約取得エラー "
                    f"({attempt + 1}/{self._max_retries}): {e}"
                )
                if attempt < self._max_retries - 1:
                    wait = (2 ** attempt) + random.uniform(0, 1)
                    logger.info(f"[{self.name}] {wait:.1f}秒後にリトライ")
                    await asyncio.sleep(wait)

        return []

    # ------------------------------------------------------------------
    # ユーティリティ
    # ------------------------------------------------------------------

    async def screenshot(self, name: str) -> Path:
        """スクリーンショット保存（デバッグ用）"""
        timestamp = datetime.now(JST).strftime("%Y%m%d_%H%M%S")
        filename = f"{self.name}_{name}_{timestamp}.png"
        path = SCREENSHOTS_DIR / filename
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._driver.save_screenshot(str(path))
            )
            logger.info(f"[{self.name}] スクショ保存: {path}")
        except Exception as e:
            logger.error(f"[{self.name}] スクショ失敗: {e}")
        return path

    async def safe_goto(self, url: str, timeout: int = 30000) -> bool:
        """安全なページ遷移（タイムアウト対応）"""
        try:
            # Selenium のタイムアウトは秒単位
            timeout_sec = timeout // 1000
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._driver.set_page_load_timeout(timeout_sec)
            )
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._driver.get(url)
            )
            await self.human_delay(0.5, 1.5)
            return True
        except Exception as e:
            logger.error(f"[{self.name}] ページ遷移失敗 {url}: {e}")
            await self.screenshot("goto_failed")
            return False

    async def execute_script(self, script: str, *args):
        """JavaScript実行のヘルパー"""
        return await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._driver.execute_script(script, *args)
        )

    async def get_current_url(self) -> str:
        """現在のURLを取得"""
        return await asyncio.get_event_loop().run_in_executor(
            None, lambda: self._driver.current_url
        )

    async def wait_for_url_change(self, condition, timeout: int = 15) -> bool:
        """URLが条件を満たすまで待つ"""
        try:
            end_time = time.time() + timeout
            while time.time() < end_time:
                current_url = await self.get_current_url()
                if condition(current_url):
                    return True
                await asyncio.sleep(0.5)
            return False
        except Exception:
            return False
