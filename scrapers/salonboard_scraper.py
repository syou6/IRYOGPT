"""
サロンボード スクレイパー（undetected-chromedriver版）

確認済みセレクタ情報（GitHub 9リポジトリ調査より）:

ログイン:
- ユーザーID: input[name="userId"]
- パスワード: #jsiPwInput
- ログインボタン: a.common-CNCcommon__primaryBtn.loginBtnSize
  （旧: a.input_area_btn_01）
- ログインボタン代替: a:has-text("ログイン"):visible

スケジュール画面 (/KLP/schedule/salonSchedule/):
- 構造: テーブルではなく ul/li ベース
- メインコンテナ: #schedule
- スタッフヘッダー: .scheduleMainHeadList.isStaff > li.scheduleMainHead
- スタッフ名: .scheduleLinkInner
- スケジュール本体: .scheduleMainTable.isStaff > li.scheduleMainTableLine
- 予約ブロック: .staffTask
- 顧客名: .scheduleReserveName（通常予約）、.todoTitle（Todo予約）
- 時間帯: .scheduleTimeZoneSetting（値: "開始時間,終了時間"）
- 「CP 」で始まる顧客名はキャンペーン枠 → 除外

予約詳細ポップアップ:
- クリック対象: div.scheduleReservation
- ポップアップ: div.mod_popup_02 > table.mod_table03
- 予約日時: #rsvDate
- 予約番号: td.w277

URL構造:
- ログイン: /login/
- トップ: /CntrSalonTop/SalonTop/ or /KLP/top/
- スケジュール: /KLP/schedule/salonSchedule/?date=YYYYMMDD
- KLS系: /KLS/schedule/calendar/（ネイル・リラク・エステ向け）
- 予約登録: /KLP/reserve/ext/extReserveRegist/
- 顧客検索: /KLP/customer/customerSearch/
- スタッフ設定: /CNK/set/staffSetup/

店舗選択（マルチ店舗時）:
- テーブル: #biyouStoreInfoArea
- 店舗名: td.storeName
- 店舗ID: td.mod_center

注意:
- Karteチャットウィジェットが邪魔する場合あり: .karte-widget__container
- ページ読み込み完了検知: #headerNavigationBar

参考リポジトリ:
- xcrystal627/salon-board-scraping-tool (Selenium, 予約・顧客全般)
- peachup/webscrapper (Playwright, スケジュール→GoogleCalendar)
- yukihamada/salonboard-uploader (Playwright, ログインセレクタ確認)
- mnhrk15/salonboard-style-poster (Playwright, selectors.yaml付き)
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

            # PW 入力（#jsiPwInput が確認済みだが、name="password" もフォールバック）
            pw_filled = False
            for selector in ['#jsiPwInput', 'input[name="password"]']:
                try:
                    element = await self._query_selector(selector)
                    if element:
                        await self.human_type(selector, SALONBOARD_PASSWORD)
                        pw_filled = True
                        break
                except Exception:
                    continue

            if not pw_filled:
                logger.error("[salonboard] パスワードフィールドが見つからない")
                await self.screenshot("login_no_pw")
                return False

            await self.human_delay(0.5, 1.0)

            # ログインボタンクリック
            clicked = False
            for selector in [
                'a.common-CNCcommon__primaryBtn.loginBtnSize',
                'a.input_area_btn_01',
                'a:has-text("ログイン"):visible',
            ]:
                try:
                    element = await self._find_element(selector, timeout=5)
                    if element:
                        await self.human_click(selector)
                        clicked = True
                        logger.info(f"[salonboard] ログインボタン: {selector}")
                        break
                except Exception:
                    continue

            if not clicked:
                logger.error("[salonboard] ログインボタンが見つからない")
                await self.screenshot("login_no_button")
                return False

            # ページ遷移を待つ
            success = await self.wait_for_url_change(
                lambda url: "/login" not in url.lower(),
                timeout=15,
            )
            if not success:
                logger.error("[salonboard] ログイン後の遷移タイムアウト")
                await self.screenshot("login_timeout")
                return False

            await self.human_delay(1.0, 2.0)

            # 店舗選択が必要な場合（マルチ店舗アカウント）
            await self._handle_store_selection()

            # ログイン後のCAPTCHAチェック
            if await self.detect_captcha():
                logger.error("[salonboard] ログイン後にCAPTCHA検知")
                return False

            # Karteウィジェットを非表示にする（邪魔になる場合）
            await self._hide_karte_widget()

            # ログイン成功判定
            current_url = await self.get_current_url()
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

    async def _handle_store_selection(self) -> None:
        """マルチ店舗アカウントの場合、最初の店舗を選択"""
        try:
            store_table = await self._query_selector("#biyouStoreInfoArea")
            if store_table:
                logger.info("[salonboard] 店舗選択画面を検知")
                first_link = await self._query_selector("#biyouStoreInfoArea a")
                if first_link:
                    await self.human_click("#biyouStoreInfoArea a")
                    await self.human_delay(1.0, 2.0)
                    logger.info("[salonboard] 店舗を選択しました")
        except Exception:
            pass

    async def _hide_karte_widget(self) -> None:
        """Karteチャットウィジェットを非表示にする"""
        try:
            await self.execute_script("""
                const selectors = [
                    '.karte-widget__container',
                    '[class*="_reception-Skin"]',
                    '[id^="karte-"]'
                ];
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        el.style.display = 'none';
                    });
                });
            """)
        except Exception:
            pass

    async def is_logged_in(self) -> bool:
        """Cookie再利用でログイン状態か確認"""
        try:
            if not await self.safe_goto(SALONBOARD_TOP_URL, timeout=15000):
                return False

            current_url = await self.get_current_url()
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
        """指定日の予約一覧を取得。target_date: 'YYYY-MM-DD' 形式"""
        reservations = []

        try:
            if not await self.ensure_logged_in():
                logger.error("[salonboard] ログイン失敗、予約取得中止")
                return []

            # スケジュール画面へ遷移（日付パラメータはYYYYMMDD形式）
            date_obj = datetime.strptime(target_date, "%Y-%m-%d")
            date_param = date_obj.strftime("%Y%m%d")
            schedule_url = f"{self.schedule_url}?date={date_param}"

            if not await self.safe_goto(schedule_url):
                return []

            # #schedule コンテナの読み込みを待つ
            try:
                await self._find_element("#schedule", timeout=15)
            except Exception:
                logger.warning("[salonboard] #schedule が見つからない")

            await self.human_delay(1.0, 2.0)

            # CAPTCHA チェック
            if await self.detect_captcha():
                logger.error("[salonboard] 予約ページでCAPTCHA検知")
                return []

            # セッション切れチェック
            if await self.detect_session_expired():
                logger.warning("[salonboard] スケジュール画面でセッション切れ検知")
                return []

            # Karteウィジェット非表示
            await self._hide_karte_widget()

            await self.screenshot(f"schedule_{target_date}")

            reservations = await self._parse_schedule_page(target_date)

        except Exception as e:
            logger.error(f"[salonboard] 予約取得エラー: {e}")
            await self.screenshot("fetch_error")

        logger.info(
            f"[salonboard] {target_date} の予約: {len(reservations)}件"
        )
        return reservations

    async def _parse_schedule_page(self, target_date: str) -> list[dict]:
        """スケジュール画面から予約データを抽出"""
        reservations = []

        try:
            # ---- スタッフ名の取得 ----
            staff_names = []
            staff_elements = await self._find_elements(
                ".scheduleMainHeadList.isStaff li.scheduleMainHead"
            )
            for el in staff_elements:
                try:
                    name_el = el.find_element("css selector", ".scheduleLinkInner")
                    name = name_el.text.strip()
                    staff_names.append(name)
                except Exception:
                    try:
                        link_el = el.find_element("css selector", "a.scheduleLink")
                        name = link_el.text.strip()
                        staff_names.append(name)
                    except Exception:
                        staff_names.append("")

            logger.info(f"[salonboard] スタッフ数: {len(staff_names)}, 名前: {staff_names}")

            if not staff_names:
                logger.warning("[salonboard] スタッフ名が取得できない。ページ構造をダンプ")
                await self._dump_page_structure()
                return []

            # ---- 各スタッフの予約を取得 ----
            schedule_columns = await self._find_elements(
                ".scheduleMainTable.isStaff li.scheduleMainTableLine"
            )

            for col_idx, column in enumerate(schedule_columns):
                staff_name = staff_names[col_idx] if col_idx < len(staff_names) else f"スタッフ{col_idx + 1}"

                # 予約ブロックを取得
                try:
                    tasks = column.find_elements("css selector", ".staffTask")
                except Exception:
                    tasks = []

                for task in tasks:
                    try:
                        # 顧客名を取得
                        customer_name = ""
                        try:
                            name_el = task.find_element("css selector", ".scheduleReserveName")
                            customer_name = name_el.text.strip()
                        except Exception:
                            try:
                                todo_el = task.find_element("css selector", ".todoTitle")
                                customer_name = todo_el.text.strip()
                            except Exception:
                                pass

                        # キャンペーン枠は除外
                        if customer_name.startswith("CP "):
                            continue

                        # 顧客名が空なら予約ではない
                        if not customer_name:
                            continue

                        # 時間帯を取得（"10:00,11:30" 形式）
                        start_time = ""
                        end_time = ""
                        try:
                            time_el = task.find_element("css selector", ".scheduleTimeZoneSetting")
                            time_text = time_el.text.strip()
                            time_parts = time_text.split(",")
                            if len(time_parts) >= 1:
                                start_time = time_parts[0].strip()
                            if len(time_parts) >= 2:
                                end_time = time_parts[1].strip()
                        except Exception:
                            pass

                        # CSSクラスから予約種別を判定
                        task_class = task.get_attribute("class") or ""

                        # 予約IDを生成
                        external_id = f"SB-{target_date}-{start_time}-{staff_name}"

                        reservations.append({
                            "source": "salonboard",
                            "date": target_date,
                            "start_time": start_time,
                            "end_time": end_time,
                            "staff_name": staff_name,
                            "customer_name": customer_name,
                            "menu": "",
                            "status": "confirmed",
                            "external_id": external_id,
                            "raw_data": {
                                "task_class": task_class,
                            },
                        })

                    except Exception as e:
                        logger.debug(f"[salonboard] タスクパースエラー: {e}")
                        continue

        except Exception as e:
            logger.error(f"[salonboard] パースエラー: {e}")
            await self._dump_page_structure()

        return reservations

    async def _dump_page_structure(self) -> None:
        """ページ構造をダンプ（デバッグ・セレクタ修正用）"""
        try:
            structure = await self.execute_script("""
                return {
                    url: window.location.href,
                    title: document.title,
                    scheduleContainer: !!document.querySelector('#schedule'),
                    staffHeaders: document.querySelectorAll('.scheduleMainHeadList.isStaff li.scheduleMainHead').length,
                    scheduleColumns: document.querySelectorAll('.scheduleMainTable.isStaff li.scheduleMainTableLine').length,
                    staffTasks: document.querySelectorAll('.staffTask').length,
                    reserveNames: document.querySelectorAll('.scheduleReserveName').length,
                    timeSettings: document.querySelectorAll('.scheduleTimeZoneSetting').length,
                    tables: document.querySelectorAll('table').length,
                    divIds: Array.from(document.querySelectorAll('div[id]')).slice(0, 15).map(d => d.id),
                };
            """)
            logger.info(f"[salonboard] ページ構造: {structure}")
        except Exception as e:
            logger.debug(f"[salonboard] ページ構造取得エラー: {e}")

    # ------------------------------------------------------------------
    # 空き枠取得（よやくらく連携用）
    # ------------------------------------------------------------------

    async def fetch_available_slots(self, target_date: str) -> list[dict]:
        """指定日の空き枠を取得（スタッフ別）"""
        # 予約データから空き枠を逆算
        # TODO: アカウント取得後に実装
        return []
