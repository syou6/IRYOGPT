"""
ミニモ サロンツール スクレイパー

ミニモのサロン管理画面（サロンツール）から予約データを取得する。

既知情報:
- ログインURL: https://minimodel.jp/salontool/login
- 管理画面: https://minimodel.jp/salontool/
- Chrome専用のWebアプリ
- 無料で利用可能
- スタッフごとのスケジュール管理が可能

セレクタ情報:
- TODO: アカウント取得後にスクリーンショットで特定する
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


class MinimoScraper(BaseScraper):
    def __init__(self):
        super().__init__(name="minimo", cookies_path=MINIMO_COOKIES_PATH)

    # ------------------------------------------------------------------
    # ログイン
    # ------------------------------------------------------------------

    async def login(self) -> bool:
        """ミニモ サロンツールにログイン"""
        if not MINIMO_ID or not MINIMO_PASSWORD:
            logger.error("[minimo] MINIMO_ID/PASSWORD が未設定")
            return False

        try:
            if not await self.safe_goto(MINIMO_LOGIN_URL):
                return False

            await self.human_delay(1.0, 2.0)

            # CAPTCHA チェック
            if await self.detect_captcha():
                logger.error("[minimo] ログインページでCAPTCHA検知")
                return False

            # スクリーンショットでフォーム構造を確認
            await self.screenshot("login_page")

            # -------------------------------------------------------
            # ログインフォーム入力
            #
            # TODO: アカウント取得後に実際のセレクタを特定する。
            #       以下は一般的なパターンからの推定。
            #       スクリーンショットを確認して修正する。
            # -------------------------------------------------------

            # ID入力 - 一般的なセレクタ候補
            id_selectors = [
                'input[name="email"]',
                'input[name="login_id"]',
                'input[name="userId"]',
                'input[type="email"]',
                'input[type="text"]:first-of-type',
            ]
            id_filled = False
            for selector in id_selectors:
                try:
                    element = await self._page.query_selector(selector)
                    if element:
                        await self.human_type(selector, MINIMO_ID)
                        id_filled = True
                        logger.info(f"[minimo] ID入力セレクタ: {selector}")
                        break
                except Exception:
                    continue

            if not id_filled:
                logger.error("[minimo] ID入力フィールドが見つからない")
                await self.screenshot("login_no_id_field")
                return False

            await self.human_delay(0.3, 0.8)

            # PW入力
            pw_selectors = [
                'input[name="password"]',
                'input[type="password"]',
            ]
            pw_filled = False
            for selector in pw_selectors:
                try:
                    element = await self._page.query_selector(selector)
                    if element:
                        await self.human_type(selector, MINIMO_PASSWORD)
                        pw_filled = True
                        logger.info(f"[minimo] PW入力セレクタ: {selector}")
                        break
                except Exception:
                    continue

            if not pw_filled:
                logger.error("[minimo] パスワードフィールドが見つからない")
                await self.screenshot("login_no_pw_field")
                return False

            await self.human_delay(0.5, 1.0)

            # ログインボタン
            login_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'a:has-text("ログイン"):visible',
                'button:has-text("ログイン"):visible',
            ]
            clicked = False
            for selector in login_selectors:
                try:
                    element = await self._page.query_selector(selector)
                    if element:
                        await self.human_click(selector)
                        clicked = True
                        logger.info(f"[minimo] ログインボタン: {selector}")
                        break
                except Exception:
                    continue

            if not clicked:
                logger.error("[minimo] ログインボタンが見つからない")
                await self.screenshot("login_no_button")
                return False

            # ページ遷移を待つ
            try:
                await self._page.wait_for_url(
                    lambda url: "/login" not in url.lower(),
                    timeout=15000,
                )
            except Exception:
                logger.error("[minimo] ログイン後の遷移タイムアウト")
                await self.screenshot("login_timeout")
                return False

            await self.human_delay(1.0, 2.0)

            # CAPTCHA チェック
            if await self.detect_captcha():
                logger.error("[minimo] ログイン後にCAPTCHA検知")
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
        """Cookie再利用でログイン状態か確認"""
        try:
            if not await self.safe_goto(MINIMO_TOP_URL, timeout=15000):
                return False

            current_url = self._page.url
            if "/login" in current_url.lower():
                logger.info("[minimo] セッション切れ")
                return False

            return True
        except Exception:
            return False

    # ------------------------------------------------------------------
    # 予約データ取得
    # ------------------------------------------------------------------

    async def fetch_reservations(self, target_date: str) -> list[dict]:
        """
        指定日の予約一覧を取得

        Args:
            target_date: 'YYYY-MM-DD' 形式

        Returns:
            予約データのリスト（salonboard_scraper.pyと同じフォーマット）
        """
        reservations = []

        try:
            if not await self.ensure_logged_in():
                logger.error("[minimo] ログイン失敗、予約取得中止")
                return []

            # -------------------------------------------------------
            # 予約一覧ページへ遷移
            #
            # TODO: アカウント取得後にURLパターンを特定する。
            #       サロンツールの予約管理画面のURLを確認する。
            #       以下は推定。
            # -------------------------------------------------------
            schedule_url = f"{MINIMO_TOP_URL}schedule/"
            if not await self.safe_goto(schedule_url):
                # トップページから予約管理に遷移を試みる
                if not await self.safe_goto(MINIMO_TOP_URL):
                    return []

                # ナビゲーションから予約管理へ遷移を試みる
                nav_selectors = [
                    'a:has-text("予約管理")',
                    'a:has-text("スケジュール")',
                    'a:has-text("予約")',
                    'a[href*="schedule"]',
                    'a[href*="reservation"]',
                    'a[href*="booking"]',
                ]
                for selector in nav_selectors:
                    try:
                        element = await self._page.query_selector(selector)
                        if element:
                            await self.human_click(selector)
                            await self.human_delay(1.0, 2.0)
                            logger.info(f"[minimo] ナビゲーション: {selector}")
                            break
                    except Exception:
                        continue

            await self.human_delay(1.0, 2.0)
            await self.screenshot(f"schedule_{target_date}")

            # CAPTCHA チェック
            if await self.detect_captcha():
                logger.error("[minimo] 予約ページでCAPTCHA検知")
                return []

            reservations = await self._parse_schedule_page(target_date)

        except Exception as e:
            logger.error(f"[minimo] 予約取得エラー: {e}")
            await self.screenshot("fetch_error")

        logger.info(f"[minimo] {target_date} の予約: {len(reservations)}件")
        return reservations

    async def _parse_schedule_page(self, target_date: str) -> list[dict]:
        """
        予約ページから予約データを抽出

        TODO: アカウント取得後に実際のセレクタで実装する。
        """
        reservations = []

        try:
            # ページ構造をログに記録（セレクタ特定用）
            tables = await self._page.query_selector_all("table")
            logger.info(f"[minimo] テーブル数: {len(tables)}")

            # 予約っぽい要素を探す
            candidate_selectors = [
                ".reservation-item",
                ".booking-item",
                ".schedule-item",
                "tr[class*='reservation']",
                "tr[class*='booking']",
                "div[class*='reservation']",
                "div[class*='booking']",
                "li[class*='reservation']",
            ]

            for selector in candidate_selectors:
                elements = await self._page.query_selector_all(selector)
                if elements:
                    logger.info(
                        f"[minimo] セレクタ '{selector}' で {len(elements)} 要素発見"
                    )

            # -------------------------------------------------------
            # 実装例（アカウント取得後に有効化）:
            #
            # items = await self._page.query_selector_all("実際のセレクタ")
            # for item in items:
            #     reservations.append({
            #         "source": "minimo",
            #         "date": target_date,
            #         "start_time": ...,
            #         "end_time": ...,
            #         "staff_name": ...,
            #         "customer_name": ...,
            #         "menu": ...,
            #         "status": "confirmed",
            #         "external_id": ...,
            #         "raw_data": {},
            #     })
            # -------------------------------------------------------

        except Exception as e:
            logger.error(f"[minimo] パースエラー: {e}")

        return reservations
