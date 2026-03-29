"""
サロンボード スクレイパー

確認済み情報（GitHub調査・公式サイト・WordPressプラグイン解析より）:

URL構造:
- ログイン: /login/ (PC版)、/login_sp/ (スマホ版)
- 認証POST: /CNC/login/doLogin/
- KLP系 (ヘアサロン): /KLP/top/, /KLP/schedule/salonSchedule/
- KLS系 (ネイル・リラク・エステ): /KLS/schedule/calendar/

スケジュール画面:
- 日付パラメータ: ?date=YYYYMMDD（ハイフンなし）
- 構造: 横=スタッフ列、縦=時間行
- 表示: 5分/10分/15分/30分刻み（医院設定による）
- PCでは最大14日分表示可

予約登録パラメータ:
- ?staffId={id}&date={YYYYMMDD}&rsvHour={HH}&rsvMinute={MM}

セレクタ:
- ログインフォーム: input[name="userId"], input[name="password"]
- ログインボタン: a:has-text("ログイン")（<a>タグ、buttonではない）
- ログイン後URL: /KLP/top/ または /KLS/

参考:
- yukihamada/salonboard-uploader (実セレクタ確認済み)
- xcrystal627/salon-board-scraping-tool (Selenium, KLP系URL確認)
- peachup/webscrapper (Playwright, login + salonSchedule確認)
- common-repository/salon-booking (WordPress, CLP/bt系API確認)
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
    SALONBOARD_SCHEDULE_URL_KLS,
    SALONBOARD_TOP_URL,
    SALONBOARD_TYPE,
)

logger = logging.getLogger(__name__)


class SalonBoardScraper(BaseScraper):
    def __init__(self):
        super().__init__(name="salonboard", cookies_path=SALONBOARD_COOKIES_PATH)

    @property
    def schedule_url(self) -> str:
        """業種タイプに応じたスケジュールURLを返す"""
        if SALONBOARD_TYPE == "kls":
            return SALONBOARD_SCHEDULE_URL_KLS
        return SALONBOARD_SCHEDULE_URL

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
            予約データのリスト
        """
        reservations = []

        try:
            if not await self.ensure_logged_in():
                logger.error("[salonboard] ログイン失敗、予約取得中止")
                return []

            # 予約カレンダーページへ遷移
            # 日付パラメータはYYYYMMDD形式（ハイフンなし）
            date_obj = datetime.strptime(target_date, "%Y-%m-%d")
            date_param = date_obj.strftime("%Y%m%d")
            schedule_url = f"{self.schedule_url}?date={date_param}"

            if not await self.safe_goto(schedule_url):
                return []

            await self.human_delay(1.0, 2.0)
            await self.screenshot(f"schedule_{target_date}")

            # CAPTCHA チェック
            if await self.detect_captcha():
                logger.error("[salonboard] 予約ページでCAPTCHA検知")
                return []

            # セッション切れチェック
            if await self.detect_session_expired():
                logger.warning("[salonboard] スケジュール画面でセッション切れ検知")
                return []

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

        サロンボードの予約カレンダーは通常テーブル形式:
        - ヘッダー行: スタッフ名が列として並ぶ
        - データ行: 時間帯ごとの予約状態
        - 予約セル: クリックすると予約詳細モーダルが表示される

        TODO: テストアカウント取得後に実際のセレクタを確認・修正する。
              以下は GitHub 上の複数リポジトリから推定したセレクタ候補。
        """
        reservations = []

        try:
            # ---- ページ構造の調査（セレクタ特定用） ----

            # テーブル要素を探す
            tables = await self._page.query_selector_all("table")
            logger.info(f"[salonboard] テーブル数: {len(tables)}")

            # スケジュール系の汎用セレクタ候補
            # xcrystal627/salon-board-scraping-tool で確認されたパターンを優先
            candidate_selectors = [
                # テーブルベースのスケジュール
                "table.scheduleTable",
                "table.schedule",
                "#scheduleTable",
                "table[class*='schedule']",
                # スタッフヘッダー
                "th[class*='staff']",
                "td[class*='staff']",
                ".staffName",
                # 予約セル
                ".reserveFrame",
                ".reserveItem",
                ".reserve",
                "td[class*='reserve']",
                "div[class*='reserve']",
                # 時間軸
                ".timeCell",
                "td[class*='time']",
                "th[class*='time']",
                # カレンダー系（KLS用）
                ".calendarCell",
                ".calendar-event",
            ]

            found_selectors = {}
            for selector in candidate_selectors:
                try:
                    elements = await self._page.query_selector_all(selector)
                    if elements:
                        found_selectors[selector] = len(elements)
                        logger.info(
                            f"[salonboard] セレクタ '{selector}' で {len(elements)} 要素発見"
                        )
                except Exception:
                    continue

            # ---- HTML構造のダンプ（初回デバッグ用） ----
            # メインコンテンツ領域のHTML構造を取得してログに記録
            try:
                # body直下の主要なdiv/table構造を取得
                main_structure = await self._page.evaluate("""
                    () => {
                        const body = document.body;
                        const tables = body.querySelectorAll('table');
                        const result = {
                            tableCount: tables.length,
                            tables: [],
                            mainDivIds: [],
                            mainDivClasses: [],
                        };
                        tables.forEach((t, i) => {
                            result.tables.push({
                                index: i,
                                id: t.id,
                                className: t.className,
                                rows: t.rows ? t.rows.length : 0,
                                cols: t.rows && t.rows[0] ? t.rows[0].cells.length : 0,
                            });
                        });
                        // 主要なdiv要素のIDとクラスを収集
                        const divs = body.querySelectorAll('div[id], div[class]');
                        const seen = new Set();
                        divs.forEach(d => {
                            const key = d.id || d.className.split(' ')[0];
                            if (key && !seen.has(key) && seen.size < 30) {
                                seen.add(key);
                                if (d.id) result.mainDivIds.push(d.id);
                                else result.mainDivClasses.push(d.className.split(' ')[0]);
                            }
                        });
                        return result;
                    }
                """)
                logger.info(f"[salonboard] ページ構造: {main_structure}")
            except Exception as e:
                logger.debug(f"[salonboard] ページ構造取得エラー: {e}")

            # -------------------------------------------------------
            # 実装例（テストアカウント取得後に有効化）:
            #
            # スケジュールテーブルの構造:
            #   <table class="scheduleTable">
            #     <thead>
            #       <tr>
            #         <th>時間</th>
            #         <th class="staffName">スタイリストA</th>
            #         <th class="staffName">スタイリストB</th>
            #       </tr>
            #     </thead>
            #     <tbody>
            #       <tr>
            #         <td class="timeCell">10:00</td>
            #         <td class="reserve">予約データ</td>
            #         <td class="empty">空き</td>
            #       </tr>
            #     </tbody>
            #   </table>
            #
            # 1. スタッフ名を取得（ヘッダー行）
            # staff_headers = await self._page.query_selector_all("実際のセレクタ")
            # staff_names = [await h.inner_text() for h in staff_headers]
            #
            # 2. 各行（時間帯）を走査
            # rows = await self._page.query_selector_all("実際のセレクタ")
            # for row in rows:
            #     time_cell = await row.query_selector("実際のセレクタ")
            #     time_text = await time_cell.inner_text() if time_cell else ""
            #     cells = await row.query_selector_all("td")
            #     for i, cell in enumerate(cells[1:]):  # 0番目は時間列
            #         cell_class = await cell.get_attribute("class") or ""
            #         if "reserve" in cell_class or "booking" in cell_class:
            #             # 予約セルをクリックして詳細を取得するか、
            #             # セル内のテキストから情報を抽出
            #             cell_text = await cell.inner_text()
            #             reservations.append({
            #                 "source": "salonboard",
            #                 "date": target_date,
            #                 "start_time": time_text,
            #                 "end_time": "",
            #                 "staff_name": staff_names[i] if i < len(staff_names) else "",
            #                 "customer_name": cell_text,
            #                 "menu": "",
            #                 "status": "confirmed",
            #                 "external_id": f"SB-{target_date}-{time_text}-{i}",
            #                 "raw_data": {"cell_class": cell_class},
            #             })
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
