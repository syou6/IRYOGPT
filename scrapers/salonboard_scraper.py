"""
サロンボード スクレイパー

セレクタ情報:
- ログインフォーム: input[name="userId"], input[name="password"]
- ログインボタン: a:has-text("ログイン")（<a>タグ、buttonではない）
- ログイン後URL: /KLP/top/ または /CNB/
- 予約カレンダー: /KLP/schedule/salonSchedule/

参考: yukihamada/salonboard-uploader (実セレクタ確認済み)
"""

import logging
from datetime import datetime

from scrapers.base_scraper import BaseScraper
from scrapers.config import (
    SALONBOARD_COOKIES_PATH,
    SALONBOARD_ID,
    SALONBOARD_LOGIN_URL,
    SALONBOARD_PASSWORD,
    SALONBOARD_SCHEDULE_URL,
    SALONBOARD_TOP_URL,
)

logger = logging.getLogger(__name__)


class SalonBoardScraper(BaseScraper):
    def __init__(self):
        super().__init__(name="salonboard", cookies_path=SALONBOARD_COOKIES_PATH)

    # ------------------------------------------------------------------
    # ログイン
    # ------------------------------------------------------------------

    async def login(self) -> bool:
        """サロンボードにID/PWでログイン"""
        if not SALONBOARD_ID or not SALONBOARD_PASSWORD:
            logger.error("[salonboard] SALONBOARD_ID/PASSWORD が未設定")
            return False

        try:
            if not await self.safe_goto(SALONBOARD_LOGIN_URL):
                return False

            await self.human_delay(1.0, 2.0)

            # CAPTCHA チェック（ログインページ表示時点）
            if await self.detect_captcha():
                logger.error("[salonboard] ログインページでCAPTCHA検知")
                return False

            # ID 入力
            await self.human_type('input[name="userId"]', SALONBOARD_ID)
            await self.human_delay(0.3, 0.8)

            # PW 入力
            await self.human_type('input[name="password"]', SALONBOARD_PASSWORD)
            await self.human_delay(0.5, 1.0)

            # ログインボタンクリック（<a>タグ）
            await self.human_click('a:has-text("ログイン"):visible')

            # ページ遷移を待つ
            try:
                await self._page.wait_for_url(
                    lambda url: "/login" not in url.lower(),
                    timeout=15000,
                )
            except Exception:
                logger.error("[salonboard] ログイン後の遷移タイムアウト")
                await self.screenshot("login_timeout")
                return False

            await self.human_delay(1.0, 2.0)

            # ログイン後のCAPTCHAチェック
            if await self.detect_captcha():
                logger.error("[salonboard] ログイン後にCAPTCHA検知")
                return False

            # ログイン成功判定
            current_url = self._page.url
            if "/login" in current_url.lower():
                logger.error(f"[salonboard] ログイン失敗。URL: {current_url}")
                await self.screenshot("login_failed")
                return False

            logger.info(f"[salonboard] ログイン成功。URL: {current_url}")
            return True

        except Exception as e:
            logger.error(f"[salonboard] ログインエラー: {e}")
            await self.screenshot("login_error")
            return False

    async def is_logged_in(self) -> bool:
        """Cookie再利用でログイン状態か確認"""
        try:
            if not await self.safe_goto(SALONBOARD_TOP_URL, timeout=15000):
                return False

            current_url = self._page.url
            if "/login" in current_url.lower():
                logger.info("[salonboard] セッション切れ")
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
            予約データのリスト:
            [
                {
                    "source": "salonboard",
                    "date": "2026-03-29",
                    "start_time": "10:00",
                    "end_time": "11:00",
                    "staff_name": "スタイリストA",
                    "customer_name": "山田太郎",
                    "menu": "カット",
                    "status": "confirmed",
                    "external_id": "SB-12345",
                    "raw_data": {}
                },
            ]
        """
        reservations = []

        try:
            if not await self.ensure_logged_in():
                logger.error("[salonboard] ログイン失敗、予約取得中止")
                return []

            # 予約カレンダーページへ遷移
            # NOTE: 日付パラメータの渡し方はアカウント取得後に確認が必要
            # サロンボードのURLパターン例:
            #   /KLP/schedule/salonSchedule/?date=20260329
            #   /KLP/schedule/salonSchedule/?targetDate=2026-03-29
            date_obj = datetime.strptime(target_date, "%Y-%m-%d")
            date_param = date_obj.strftime("%Y%m%d")
            schedule_url = f"{SALONBOARD_SCHEDULE_URL}?date={date_param}"

            if not await self.safe_goto(schedule_url):
                # パラメータなしでも試行
                if not await self.safe_goto(SALONBOARD_SCHEDULE_URL):
                    return []

            await self.human_delay(1.0, 2.0)
            await self.screenshot(f"schedule_{target_date}")

            # CAPTCHA チェック
            if await self.detect_captcha():
                logger.error("[salonboard] 予約ページでCAPTCHA検知")
                return []

            # ---------------------------------------------------------
            # 予約データの抽出
            #
            # !! 重要 !!
            # 以下のセレクタはアカウント取得後に実際のページを見て修正する。
            # スクリーンショットを確認してセレクタを特定する。
            #
            # サロンボードの予約カレンダーは通常テーブル形式で、
            # 行=時間帯、列=スタッフ の構造になっている。
            # ---------------------------------------------------------

            reservations = await self._parse_schedule_page(target_date)

        except Exception as e:
            logger.error(f"[salonboard] 予約取得エラー: {e}")
            await self.screenshot("fetch_error")

        logger.info(
            f"[salonboard] {target_date} の予約: {len(reservations)}件"
        )
        return reservations

    async def _parse_schedule_page(self, target_date: str) -> list[dict]:
        """
        予約カレンダーページから予約データを抽出

        TODO: アカウント取得後に実際のセレクタで実装する。
              現在はページのHTML構造を取得してログに出力する。
        """
        reservations = []

        try:
            # ページのHTML構造をログに記録（セレクタ特定用）
            page_html = await self._page.content()

            # テーブル要素を探す
            tables = await self._page.query_selector_all("table")
            logger.info(f"[salonboard] テーブル数: {len(tables)}")

            # 予約っぽい要素を探す（汎用的なセレクタで試行）
            # サロンボードの一般的なパターン:
            candidate_selectors = [
                "table.scheduleTable tr",
                "table.schedule tr",
                ".reserveFrame",
                ".reserveItem",
                ".schedule-cell",
                "td[class*='reserve']",
                "td[class*='schedule']",
                "div[class*='reserve']",
                "div[class*='booking']",
            ]

            for selector in candidate_selectors:
                elements = await self._page.query_selector_all(selector)
                if elements:
                    logger.info(
                        f"[salonboard] セレクタ '{selector}' で {len(elements)} 要素発見"
                    )

            # -------------------------------------------------------
            # 実装例（アカウント取得後に有効化）:
            #
            # rows = await self._page.query_selector_all("実際のセレクタ")
            # for row in rows:
            #     time_text = await row.query_selector(".time")
            #     staff_text = await row.query_selector(".staff")
            #     customer_text = await row.query_selector(".customer")
            #     menu_text = await row.query_selector(".menu")
            #
            #     if time_text and customer_text:
            #         reservations.append({
            #             "source": "salonboard",
            #             "date": target_date,
            #             "start_time": await time_text.inner_text(),
            #             "end_time": "",
            #             "staff_name": await staff_text.inner_text() if staff_text else "",
            #             "customer_name": await customer_text.inner_text(),
            #             "menu": await menu_text.inner_text() if menu_text else "",
            #             "status": "confirmed",
            #             "external_id": "",
            #             "raw_data": {},
            #         })
            # -------------------------------------------------------

        except Exception as e:
            logger.error(f"[salonboard] パースエラー: {e}")

        return reservations

    # ------------------------------------------------------------------
    # 空き枠取得（よやくらく連携用）
    # ------------------------------------------------------------------

    async def fetch_available_slots(self, target_date: str) -> list[dict]:
        """
        指定日の空き枠を取得（スタッフ別）

        Returns:
            [
                {
                    "staff_name": "スタイリストA",
                    "available_times": ["10:00", "11:00", "14:00", "15:00"]
                },
            ]
        """
        # 予約データから空き枠を逆算
        # TODO: アカウント取得後に実装
        return []
