"""
サロンボード スクレイパー（zendriver版）

確認済みセレクタ情報（GitHub 9リポジトリ調査より）:

ログイン:
- ユーザーID: input[name="userId"]
- パスワード: #jsiPwInput (fallback: input[name="password"])
- ログインボタン: a.common-CNCcommon__primaryBtn.loginBtnSize

スケジュール画面 (/KLP/schedule/salonSchedule/):
- メインコンテナ: #schedule
- スタッフヘッダー: .scheduleMainHeadList.isStaff > li.scheduleMainHead
- スタッフ名: .scheduleLinkInner
- スケジュール本体: .scheduleMainTable.isStaff > li.scheduleMainTableLine
- 予約ブロック: .staffTask
- 顧客名: .scheduleReserveName / .todoTitle
- 時間帯: .scheduleTimeZoneSetting ("開始,終了")
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
        if SALONBOARD_TYPE == "kls":
            return SALONBOARD_SCHEDULE_URL_KLS
        return SALONBOARD_SCHEDULE_URL

    # ------------------------------------------------------------------
    # ログイン
    # ------------------------------------------------------------------

    async def login(self) -> bool:
        if not SALONBOARD_ID or not SALONBOARD_PASSWORD:
            logger.error("[salonboard] SALONBOARD_ID/PASSWORD が未設定")
            return False

        try:
            if not await self.safe_goto(SALONBOARD_LOGIN_URL):
                return False

            await self.human_delay(1.0, 2.0)

            if await self.detect_captcha():
                logger.error("[salonboard] ログインページでCAPTCHA検知")
                return False

            # ID 入力
            id_input = await self.find('input[name="userId"]')
            if not id_input:
                logger.error("[salonboard] ユーザーIDフィールドが見つからない")
                await self.screenshot("login_no_id")
                return False
            await self.human_type(id_input, SALONBOARD_ID)
            await self.human_delay(0.3, 0.8)

            # PW 入力
            pw_input = None
            for selector in ['#jsiPwInput', 'input[name="password"]']:
                pw_input = await self.query(selector)
                if pw_input:
                    break

            if not pw_input:
                logger.error("[salonboard] パスワードフィールドが見つからない")
                await self.screenshot("login_no_pw")
                return False
            await self.human_type(pw_input, SALONBOARD_PASSWORD)
            await self.human_delay(0.5, 1.0)

            # ログインボタン
            btn = None
            for selector in [
                'a.common-CNCcommon__primaryBtn.loginBtnSize',
                'a.input_area_btn_01',
            ]:
                btn = await self.query(selector)
                if btn:
                    break

            if not btn:
                # テキストで検索
                try:
                    btn = await self._page.find("ログイン", timeout=5)
                except Exception:
                    pass

            if not btn:
                logger.error("[salonboard] ログインボタンが見つからない")
                await self.screenshot("login_no_button")
                return False

            await self.human_click(btn)

            # ページ遷移を待つ
            if not await self.wait_for_url(lambda url: "/login" not in url.lower()):
                logger.error("[salonboard] ログイン後の遷移タイムアウト")
                await self.screenshot("login_timeout")
                return False

            await self.human_delay(1.0, 2.0)

            await self._handle_store_selection()

            if await self.detect_captcha():
                logger.error("[salonboard] ログイン後にCAPTCHA検知")
                return False

            await self._hide_karte_widget()

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

    async def _navigate_to_schedule_naturally(self, date_param: str) -> None:
        """
        自然なナビゲーション動線でスケジュールページに到達

        直接URLアクセスはRefererが不自然でAkamaiに検知されやすい。
        実際のユーザーの動線を再現:
        1. 現在のページ（トップ or 前回のページ）を確認
        2. サイドメニューの「スケジュール」リンクをクリック
        3. 日付指定
        """
        current_url = self._page.url if self._page else ""
        schedule_url = f"{self.schedule_url}?date={date_param}"

        # 既にスケジュールページにいる場合は日付だけ変更
        if "schedule" in current_url.lower():
            if not await self.safe_goto(schedule_url):
                return
            return

        # トップページにいない場合はまずトップへ
        if "top" not in current_url.lower() and "schedule" not in current_url.lower():
            await self.safe_goto(SALONBOARD_TOP_URL)
            await self.human_delay(1.0, 2.0)
            await self.random_scroll()

        # サイドメニューからスケジュールリンクを探す
        schedule_link = None
        for selector in [
            'a[href*="schedule"]',
            'a[href*="salonSchedule"]',
            'a[href*="calendar"]',
        ]:
            schedule_link = await self.query(selector)
            if schedule_link:
                break

        if schedule_link:
            # リンクをクリックして遷移（自然な動線）
            await self.human_click(schedule_link)
            await self.human_delay(1.5, 3.0)

            # 日付が違う場合はURLで指定
            if date_param not in (self._page.url or ""):
                await self.safe_goto(schedule_url)
        else:
            # フォールバック: 直接URLアクセス
            logger.debug("[salonboard] スケジュールリンク未検出 → 直接アクセス")
            if not await self.safe_goto(schedule_url):
                return

    async def _handle_store_selection(self) -> None:
        """マルチ店舗アカウント対応"""
        try:
            store_table = await self.query("#biyouStoreInfoArea")
            if store_table:
                logger.info("[salonboard] 店舗選択画面を検知")
                first_link = await self.query("#biyouStoreInfoArea a")
                if first_link:
                    await self.human_click(first_link)
                    await self.human_delay(1.0, 2.0)
        except Exception:
            pass

    async def _hide_karte_widget(self) -> None:
        """Karteチャットウィジェットを非表示"""
        try:
            await self._page.evaluate("""
                ['.karte-widget__container', '[class*="_reception-Skin"]', '[id^="karte-"]']
                    .forEach(sel => document.querySelectorAll(sel).forEach(el => el.style.display = 'none'))
            """)
        except Exception:
            pass

    async def is_logged_in(self) -> bool:
        try:
            if not await self.safe_goto(SALONBOARD_TOP_URL):
                return False
            return "/login" not in self._page.url.lower()
        except Exception:
            return False

    # ------------------------------------------------------------------
    # 予約データ取得
    # ------------------------------------------------------------------

    async def fetch_reservations(self, target_date: str) -> list[dict]:
        reservations = []

        try:
            if not await self.ensure_logged_in():
                return []

            date_obj = datetime.strptime(target_date, "%Y-%m-%d")
            date_param = date_obj.strftime("%Y%m%d")

            # 自然なナビゲーション動線を再現
            # いきなりスケジュールURLに飛ぶのは不自然（Akamai行動解析対策）
            # 実際のユーザー: トップページ → サイドメニュー → スケジュール
            await self._navigate_to_schedule_naturally(date_param)

            # #schedule の読み込み待ち
            await self.find("#schedule", timeout=15)
            await self.human_delay(1.0, 2.0)

            if await self.detect_captcha():
                return []

            if await self.detect_session_expired():
                return []

            await self._hide_karte_widget()

            # 人間的な行動: スクロールして全体を確認するような動き
            await self.random_scroll()
            await self.random_idle()

            await self.screenshot(f"schedule_{target_date}")

            reservations = await self._parse_schedule_page(target_date)

        except Exception as e:
            logger.error(f"[salonboard] 予約取得エラー: {e}")
            await self.screenshot("fetch_error")

        logger.info(f"[salonboard] {target_date} の予約: {len(reservations)}件")
        return reservations

    async def _parse_schedule_page(self, target_date: str) -> list[dict]:
        """スケジュール画面から予約データを抽出"""
        reservations = []

        try:
            # スタッフ名取得
            staff_names = []
            staff_elements = await self.find_all(
                ".scheduleMainHeadList.isStaff li.scheduleMainHead"
            )
            for el in staff_elements:
                name = ""
                try:
                    name_el = await el.query_selector(".scheduleLinkInner")
                    if name_el:
                        name = name_el.text.strip()
                except Exception:
                    try:
                        link_el = await el.query_selector("a.scheduleLink")
                        if link_el:
                            name = link_el.text.strip()
                    except Exception:
                        pass
                staff_names.append(name)

            logger.info(f"[salonboard] スタッフ: {len(staff_names)}名 {staff_names}")

            if not staff_names:
                logger.warning("[salonboard] スタッフ名が取得できない")
                await self._dump_page_structure()
                return []

            # 各スタッフの予約を取得
            columns = await self.find_all(
                ".scheduleMainTable.isStaff li.scheduleMainTableLine"
            )

            for col_idx, column in enumerate(columns):
                staff_name = staff_names[col_idx] if col_idx < len(staff_names) else f"スタッフ{col_idx + 1}"

                try:
                    tasks = await column.query_selector_all(".staffTask")
                except Exception:
                    tasks = []

                for task in tasks:
                    try:
                        # 顧客名
                        customer_name = ""
                        try:
                            name_el = await task.query_selector(".scheduleReserveName")
                            if name_el:
                                customer_name = name_el.text.strip()
                        except Exception:
                            pass

                        if not customer_name:
                            try:
                                todo_el = await task.query_selector(".todoTitle")
                                if todo_el:
                                    customer_name = todo_el.text.strip()
                            except Exception:
                                pass

                        if customer_name.startswith("CP ") or not customer_name:
                            continue

                        # 時間帯
                        start_time = ""
                        end_time = ""
                        try:
                            time_el = await task.query_selector(".scheduleTimeZoneSetting")
                            if time_el:
                                time_text = time_el.text.strip()
                                parts = time_text.split(",")
                                if len(parts) >= 1:
                                    start_time = parts[0].strip()
                                if len(parts) >= 2:
                                    end_time = parts[1].strip()
                        except Exception:
                            pass

                        task_class = await task.get_attribute("class") or ""
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
                            "raw_data": {"task_class": task_class},
                        })

                    except Exception as e:
                        logger.debug(f"[salonboard] タスクパースエラー: {e}")

        except Exception as e:
            logger.error(f"[salonboard] パースエラー: {e}")
            await self._dump_page_structure()

        return reservations

    async def _dump_page_structure(self) -> None:
        try:
            structure = await self._page.evaluate("""
                () => ({
                    url: location.href,
                    title: document.title,
                    schedule: !!document.querySelector('#schedule'),
                    staffHeaders: document.querySelectorAll('.scheduleMainHeadList.isStaff li.scheduleMainHead').length,
                    columns: document.querySelectorAll('.scheduleMainTable.isStaff li.scheduleMainTableLine').length,
                    tasks: document.querySelectorAll('.staffTask').length,
                    names: document.querySelectorAll('.scheduleReserveName').length,
                    times: document.querySelectorAll('.scheduleTimeZoneSetting').length,
                })
            """)
            logger.info(f"[salonboard] ページ構造: {structure}")
        except Exception as e:
            logger.debug(f"[salonboard] ページ構造取得エラー: {e}")

    async def fetch_available_slots(self, target_date: str) -> list[dict]:
        # TODO: アカウント取得後に実装
        return []
