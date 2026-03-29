"""
ミニモ サロンツール スクレイパー（zendriver版）

SPA構造（AngularJS 1.x推定、ハッシュルーティング）
ログイン: https://minimodel.jp/salontool/login
ホーム: https://minimodel.jp/salontool/home
スケジュール: home#/schedule

TODO: テストアカウント取得後にスケジュールパース実装
"""

import logging
from datetime import datetime

from scrapers.base_scraper import BaseScraper
from scrapers.config import (
    MINIMO_COOKIES_PATH,
    MINIMO_ID,
    MINIMO_LOGIN_URL,
    MINIMO_PASSWORD,
    MINIMO_TOP_URL,
)

logger = logging.getLogger(__name__)

MINIMO_HOME_URL = "https://minimodel.jp/salontool/home"


class MinimoScraper(BaseScraper):
    def __init__(self):
        super().__init__(name="minimo", cookies_path=MINIMO_COOKIES_PATH)

    # ------------------------------------------------------------------
    # ログイン
    # ------------------------------------------------------------------

    async def login(self) -> bool:
        if not MINIMO_ID or not MINIMO_PASSWORD:
            logger.error("[minimo] MINIMO_ID/PASSWORD が未設定")
            return False

        try:
            if not await self.safe_goto(MINIMO_LOGIN_URL):
                return False

            await self.human_delay(1.0, 2.0)

            if await self.detect_captcha():
                return False

            await self.screenshot("login_page")
            await self._dump_form_structure()

            # サロンID入力
            id_input = None
            for selector in [
                'input[name="salon_id"]', 'input[name="salonId"]',
                'input[name="login_id"]', 'input[name="loginId"]',
                'input[name="userId"]', 'input[type="text"]',
            ]:
                id_input = await self.query(selector)
                if id_input:
                    logger.info(f"[minimo] ID入力セレクタ: {selector}")
                    break

            if not id_input:
                logger.error("[minimo] サロンID入力フィールドが見つからない")
                await self.screenshot("login_no_id_field")
                return False

            await self.human_type(id_input, MINIMO_ID)
            await self.human_delay(0.3, 0.8)

            # PW入力
            pw_input = None
            for selector in ['input[name="password"]', 'input[type="password"]']:
                pw_input = await self.query(selector)
                if pw_input:
                    break

            if not pw_input:
                logger.error("[minimo] パスワードフィールドが見つからない")
                await self.screenshot("login_no_pw_field")
                return False

            await self.human_type(pw_input, MINIMO_PASSWORD)
            await self.human_delay(0.5, 1.0)

            # ログインボタン
            btn = None
            for selector in ['button[type="submit"]', 'input[type="submit"]']:
                btn = await self.query(selector)
                if btn:
                    break

            if not btn:
                try:
                    btn = await self._page.find("ログイン", timeout=5)
                except Exception:
                    pass

            if not btn:
                logger.error("[minimo] ログインボタンが見つからない")
                await self.screenshot("login_no_button")
                return False

            await self.human_click(btn)

            if not await self.wait_for_url(lambda url: "/login" not in url.lower()):
                logger.error("[minimo] ログイン後の遷移タイムアウト")
                await self.screenshot("login_timeout")
                return False

            await self.human_delay(1.0, 2.0)

            if await self.detect_captcha():
                return False

            current_url = self._page.url
            if "/login" in current_url.lower():
                logger.error(f"[minimo] ログイン失敗。URL: {current_url}")
                await self.screenshot("login_failed")
                return False

            logger.info(f"[minimo] ログイン成功。URL: {current_url}")
            return True

        except Exception as e:
            logger.error(f"[minimo] ログインエラー: {e}")
            await self.screenshot("login_error")
            return False

    async def is_logged_in(self) -> bool:
        try:
            if not await self.safe_goto(MINIMO_HOME_URL):
                return False
            return "/login" not in self._page.url.lower()
        except Exception:
            return False

    async def _dump_form_structure(self) -> None:
        try:
            form_info = await self._page.evaluate("""
                () => Array.from(document.querySelectorAll('input, button, a')).map(el => ({
                    tag: el.tagName, type: el.type || '', name: el.name || '',
                    id: el.id || '', className: el.className || '',
                    placeholder: el.placeholder || '',
                    text: el.textContent?.trim()?.substring(0, 50) || '',
                }))
            """)
            logger.info(f"[minimo] フォーム構造: {form_info}")
        except Exception as e:
            logger.debug(f"[minimo] フォーム構造取得エラー: {e}")

    # ------------------------------------------------------------------
    # 予約データ取得
    # ------------------------------------------------------------------

    async def fetch_reservations(self, target_date: str) -> list[dict]:
        reservations = []

        try:
            if not await self.ensure_logged_in():
                return []

            if "salontool/home" not in self._page.url:
                if not await self.safe_goto(MINIMO_HOME_URL):
                    return []

            await self.human_delay(1.0, 2.0)

            # SPA内ナビゲーション
            navigated = False
            try:
                schedule_link = await self._page.find("スケジュール", timeout=5)
                if schedule_link:
                    await self.human_click(schedule_link)
                    await self.human_delay(2.0, 3.0)
                    navigated = True
            except Exception:
                pass

            if not navigated:
                try:
                    await self._page.evaluate("window.location.hash = '#/schedule'")
                    await self.human_delay(2.0, 3.0)
                    navigated = True
                except Exception:
                    pass

            if not navigated:
                logger.error("[minimo] スケジュール画面への遷移失敗")
                await self.screenshot("nav_failed")
                return []

            await self.screenshot(f"schedule_{target_date}")

            if await self.detect_captcha():
                return []

            # TODO: テストアカウント取得後にパース実装
            page_structure = await self._page.evaluate("""
                () => ({
                    url: location.href, hash: location.hash, title: document.title,
                    tables: document.querySelectorAll('table').length,
                    divIds: Array.from(document.querySelectorAll('div[id]')).slice(0, 20).map(d => d.id),
                })
            """)
            logger.info(f"[minimo] ページ構造: {page_structure}")

        except Exception as e:
            logger.error(f"[minimo] 予約取得エラー: {e}")
            await self.screenshot("fetch_error")

        logger.info(f"[minimo] {target_date} の予約: {len(reservations)}件")
        return reservations
