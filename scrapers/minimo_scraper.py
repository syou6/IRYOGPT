"""
ミニモ サロンツール スクレイパー（zendriver版）

SPA構造（AngularJS 1.x推定、ハッシュルーティング）
ログイン: https://minimodel.jp/salontool/login
ホーム: https://minimodel.jp/salontool/home
スケジュール: home#/schedule

スケジュール画面の構造（DOM調査より推定）:
- 日付ナビゲーション: .schedule-header, [ng-model="selectedDate"]
- スタッフカラム: .schedule-staff-column, .staff-column, [ng-repeat*="staff"]
- 予約ブロック: .reservation, .schedule-item, [ng-repeat*="reservation"]
- 顧客名: .customer-name, .reservation-name, .guest-name
- 時間: .reservation-time, .start-time, time 要素

アカウント取得後に実際のセレクタを確認し調整してください。
"""

import logging
import re
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
MINIMO_SCHEDULE_HASH = "#/schedule"


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

            if logger.isEnabledFor(logging.DEBUG):
                await self._dump_form_structure()

            # サロンID入力
            id_input = None
            for selector in [
                'input[name="salon_id"]',
                'input[name="salonId"]',
                'input[name="login_id"]',
                'input[name="loginId"]',
                'input[name="userId"]',
                'input[type="text"]',
            ]:
                id_input = await self.query(selector)
                if id_input:
                    logger.debug(f"[minimo] ID入力セレクタ: {selector}")
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
        """デバッグ用: ログインフォームの構造をログ出力"""
        try:
            form_info = await self._page.evaluate("""
                () => Array.from(document.querySelectorAll('input, button, a')).map(el => ({
                    tag: el.tagName, type: el.type || '', name: el.name || '',
                    id: el.id || '', className: el.className || '',
                    placeholder: el.placeholder || '',
                    text: el.textContent?.trim()?.substring(0, 50) || '',
                }))
            """)
            logger.debug(f"[minimo] フォーム構造: {form_info}")
        except Exception as e:
            logger.debug(f"[minimo] フォーム構造取得エラー: {e}")

    # ------------------------------------------------------------------
    # スケジュール画面ナビゲーション
    # ------------------------------------------------------------------

    async def _navigate_to_schedule(self, target_date: str) -> bool:
        """
        スケジュール画面に遷移する。

        1. まずスケジュールリンクをクリック（自然な動線）
        2. 失敗時はハッシュURLに直接遷移
        3. 対象日付を選択

        Returns:
            True: 遷移成功, False: 失敗
        """
        current_url = self._page.url if self._page else ""

        # 既にホーム画面にいる場合のみ自然なリンククリックを試みる
        if "salontool/home" in current_url:
            navigated = await self._click_schedule_link()
            if navigated:
                await self.human_delay(2.0, 3.0)
        else:
            # ホームに戻ってからナビゲート
            if not await self.safe_goto(MINIMO_HOME_URL):
                return False
            await self.human_delay(1.5, 2.5)
            navigated = await self._click_schedule_link()
            if navigated:
                await self.human_delay(2.0, 3.0)

        # ハッシュルーティングのフォールバック
        if not navigated or "schedule" not in (self._page.url if self._page else "").lower():
            try:
                await self._page.evaluate(
                    f"window.location.hash = '{MINIMO_SCHEDULE_HASH}'"
                )
                await self.human_delay(2.0, 3.5)
            except Exception as e:
                logger.error(f"[minimo] ハッシュナビゲーション失敗: {e}")
                return False

        # 日付選択
        await self._select_date(target_date)

        # SPAのレンダリング完了を待つ
        await self.human_delay(1.5, 2.5)

        return True

    async def _click_schedule_link(self) -> bool:
        """サイドメニューまたはナビからスケジュールリンクをクリック"""
        selectors = [
            'a[href*="schedule"]',
            'a[href*="#/schedule"]',
            '[ng-click*="schedule"]',
            '[ui-sref*="schedule"]',
        ]
        for selector in selectors:
            link = await self.query(selector)
            if link:
                await self.human_click(link)
                return True

        # テキストで検索
        try:
            link = await self._page.find("スケジュール", timeout=5)
            if link:
                await self.human_click(link)
                return True
        except Exception:
            pass

        return False

    async def _select_date(self, target_date: str) -> None:
        """
        スケジュール画面で対象日付を選択する。

        ミニモのSPAは URLクエリパラメータまたはカレンダーUIで日付を制御する。
        今日以外の日付は前後ナビゲーションボタンで移動する。
        """
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            if target_date == today:
                return

            target_dt = datetime.strptime(target_date, "%Y-%m-%d")
            today_dt = datetime.strptime(today, "%Y-%m-%d")
            delta_days = (target_dt - today_dt).days

            # URLパラメータで日付指定を試みる（SPAによっては有効）
            try:
                await self._page.evaluate(f"""
                    () => {{
                        const url = new URL(window.location.href);
                        url.searchParams.set('date', '{target_date}');
                        window.history.pushState(null, '', url.toString());
                        // Angularのdigestサイクルをトリガー
                        if (window.angular) {{
                            const $rootScope = angular.element(document).injector()?.get('$rootScope');
                            if ($rootScope) $rootScope.$apply();
                        }}
                    }}
                """)
                await self.human_delay(0.5, 1.0)
            except Exception:
                pass

            # 「次の日」ボタンで移動（翌日の場合）
            if delta_days == 1:
                for selector in [
                    'button[class*="next"]', 'a[class*="next"]',
                    '.fc-next-button', '[ng-click*="next"]',
                    'button:has(> .fa-chevron-right)', '.date-next',
                ]:
                    next_btn = await self.query(selector)
                    if next_btn:
                        await self.human_click(next_btn)
                        await self.human_delay(0.8, 1.5)
                        break

        except Exception as e:
            logger.debug(f"[minimo] 日付選択エラー（続行）: {e}")

    # ------------------------------------------------------------------
    # 予約データ取得
    # ------------------------------------------------------------------

    async def fetch_reservations(self, target_date: str) -> list[dict]:
        reservations = []

        try:
            if not await self.ensure_logged_in():
                return []

            if not await self._navigate_to_schedule(target_date):
                logger.error("[minimo] スケジュール画面への遷移失敗")
                return []

            await self.random_scroll()
            await self.random_idle()
            await self.screenshot(f"schedule_{target_date}")

            if await self.detect_captcha():
                return []

            if await self.detect_session_expired():
                return []

            # DOM構造を確認してパース戦略を選択
            page_info = await self._inspect_schedule_page()
            logger.info(f"[minimo] スケジュールページ構造: {page_info}")

            if page_info.get("has_reservations"):
                reservations = await self._parse_schedule_page(target_date)
            else:
                logger.info(f"[minimo] {target_date}: 予約なし（空のスケジュール）")

        except Exception as e:
            logger.error(f"[minimo] 予約取得エラー: {e}")
            await self.screenshot("fetch_error")

        logger.info(f"[minimo] {target_date} の予約: {len(reservations)}件")
        return reservations

    async def _inspect_schedule_page(self) -> dict:
        """
        スケジュールページのDOM構造を調査し、パースに必要な情報を返す。

        ミニモのSPA（AngularJS推定）は実装バージョンによってクラス名が異なる。
        複数の候補セレクタを試して実際の構造を特定する。
        """
        try:
            info = await self._page.evaluate("""
                () => {
                    const candidates = {
                        // スケジュールコンテナ候補
                        container: [
                            '#schedule', '.schedule', '[class*="schedule"]',
                            '.calendar', '[class*="calendar"]',
                            '[ng-controller*="schedule" i]', '[ng-controller*="Schedule"]',
                        ],
                        // 予約ブロック候補
                        reservation: [
                            '.reservation', '[class*="reservation"]',
                            '.schedule-item', '[class*="scheduleItem"]',
                            '[ng-repeat*="reservation"]', '[ng-repeat*="booking"]',
                            '.booking', '[class*="booking"]',
                            '.event', '.fc-event',
                        ],
                        // スタッフ列候補
                        staff: [
                            '[class*="staff"]', '[ng-repeat*="staff"]',
                            '.column', '[class*="column"]',
                            '.fc-resource',
                        ],
                    };

                    const result = {
                        url: location.href,
                        hash: location.hash,
                        title: document.title,
                        has_reservations: false,
                        reservation_count: 0,
                        found_container: null,
                        found_reservation_selector: null,
                        found_staff_selector: null,
                        tables: document.querySelectorAll('table').length,
                        angular_version: window.angular?.version?.full || null,
                    };

                    // コンテナ特定
                    for (const sel of candidates.container) {
                        if (document.querySelector(sel)) {
                            result.found_container = sel;
                            break;
                        }
                    }

                    // 予約ブロック特定
                    for (const sel of candidates.reservation) {
                        const els = document.querySelectorAll(sel);
                        if (els.length > 0) {
                            result.found_reservation_selector = sel;
                            result.reservation_count = els.length;
                            result.has_reservations = true;
                            break;
                        }
                    }

                    // スタッフ列特定
                    for (const sel of candidates.staff) {
                        if (document.querySelectorAll(sel).length > 0) {
                            result.found_staff_selector = sel;
                            break;
                        }
                    }

                    // ページ内のng-repeatをサンプリング（AngularJS)
                    const ngRepeats = Array.from(
                        document.querySelectorAll('[ng-repeat]')
                    ).slice(0, 10).map(el => ({
                        tag: el.tagName,
                        repeat: el.getAttribute('ng-repeat'),
                        class: el.className,
                    }));
                    result.ng_repeats = ngRepeats;

                    return result;
                }
            """)
            return info
        except Exception as e:
            logger.debug(f"[minimo] ページ構造調査エラー: {e}")
            return {"has_reservations": False}

    async def _parse_schedule_page(self, target_date: str) -> list[dict]:
        """
        スケジュール画面から予約データを抽出する。

        複数のDOM構造パターンに対応する多段フォールバック戦略:
        1. AngularJS ng-repeat ベースのデータ抽出（最も信頼性が高い）
        2. CSSクラスベースのDOM解析
        3. テーブル構造解析
        4. 全テキスト解析（最終手段）
        """
        reservations = []

        # 戦略1: AngularJS スコープからデータ直接取得（最優先）
        angular_data = await self._try_angular_scope_extraction(target_date)
        if angular_data:
            logger.info(f"[minimo] Angular scope からデータ取得: {len(angular_data)}件")
            return angular_data

        # 戦略2: DOM構造解析（CSSクラスベース）
        dom_data = await self._try_dom_extraction(target_date)
        if dom_data:
            logger.info(f"[minimo] DOM解析からデータ取得: {len(dom_data)}件")
            return dom_data

        # 戦略3: テーブル解析
        table_data = await self._try_table_extraction(target_date)
        if table_data:
            logger.info(f"[minimo] テーブル解析からデータ取得: {len(table_data)}件")
            return table_data

        logger.warning(
            "[minimo] 全パース戦略失敗。スクリーンショットを確認してDOMセレクタを調整してください。"
        )
        return reservations

    async def _try_angular_scope_extraction(self, target_date: str) -> list[dict]:
        """
        AngularJS の $scope から予約データを直接取得する。

        AngularJS SPAでは $scope にモデルデータが格納されている。
        angular.element().scope() でアクセス可能。
        """
        try:
            raw = await self._page.evaluate("""
                () => {
                    if (!window.angular) return null;

                    // 全要素のscopeを試して予約データを探す
                    const candidates = document.querySelectorAll(
                        '[ng-controller], [ng-repeat], .schedule, #schedule, [class*="schedule"]'
                    );

                    for (const el of candidates) {
                        try {
                            const scope = angular.element(el).scope();
                            if (!scope) continue;

                            // 予約データらしいプロパティを探す
                            const keys = Object.keys(scope).filter(k =>
                                !k.startsWith('$') && (
                                    k.toLowerCase().includes('reservation') ||
                                    k.toLowerCase().includes('booking') ||
                                    k.toLowerCase().includes('appointment') ||
                                    k.toLowerCase().includes('schedule') ||
                                    Array.isArray(scope[k])
                                )
                            );

                            for (const key of keys) {
                                const val = scope[key];
                                if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
                                    // 予約データっぽい配列を発見
                                    return { key, data: val.slice(0, 100) };
                                }
                            }
                        } catch(e) {}
                    }
                    return null;
                }
            """)

            if not raw or not raw.get("data"):
                return []

            logger.debug(f"[minimo] Angular scope キー: {raw.get('key')}")
            return self._normalize_angular_reservations(raw["data"], target_date)

        except Exception as e:
            logger.debug(f"[minimo] Angular scope 抽出失敗: {e}")
            return []

    def _normalize_angular_reservations(
        self, raw_list: list[dict], target_date: str
    ) -> list[dict]:
        """AngularJS スコープから取得した生データを標準形式に変換"""
        reservations = []

        for item in raw_list:
            if not isinstance(item, dict):
                continue

            # 各フィールドを推測（実際のキー名はアカウント取得後に確認）
            customer_name = (
                item.get("customerName") or item.get("customer_name") or
                item.get("guestName") or item.get("name") or
                item.get("clientName") or ""
            )
            staff_name = (
                item.get("staffName") or item.get("staff_name") or
                item.get("stylistName") or item.get("staff", {}).get("name", "") or ""
            )
            start_time = (
                item.get("startTime") or item.get("start_time") or
                item.get("start") or item.get("time") or ""
            )
            end_time = (
                item.get("endTime") or item.get("end_time") or
                item.get("end") or ""
            )
            menu = (
                item.get("menuName") or item.get("menu_name") or
                item.get("menu") or item.get("service") or ""
            )
            status = item.get("status", "confirmed")
            external_id = (
                str(item.get("id") or item.get("reservationId") or
                    item.get("bookingId") or
                    f"MINIMO-{target_date}-{start_time}-{staff_name}")
            )

            # 時刻を HH:MM 形式に正規化
            start_time = _normalize_time(str(start_time))
            end_time = _normalize_time(str(end_time))

            if not customer_name and not start_time:
                continue

            reservations.append({
                "source": "minimo",
                "date": target_date,
                "start_time": start_time,
                "end_time": end_time,
                "staff_name": str(staff_name),
                "customer_name": str(customer_name),
                "menu": str(menu),
                "status": str(status) if str(status) in ("confirmed", "cancelled") else "confirmed",
                "external_id": f"MINIMO-{external_id}",
                "raw_data": {"source_item": item},
            })

        return reservations

    async def _try_dom_extraction(self, target_date: str) -> list[dict]:
        """
        CSSクラスベースのDOM解析で予約データを取得する。

        ミニモの既知のDOM構造パターンに基づくセレクタを試す。
        アカウント取得後に実際のセレクタを _RESERVATION_SELECTORS に追加してください。
        """
        # 予約ブロックのセレクタ候補（優先度順）
        reservation_selectors = [
            ".reservation-item",
            ".schedule-reservation",
            ".booking-item",
            "[class*='reservation']",
            "[class*='booking']",
            ".fc-event",       # FullCalendar使用時
            ".event-item",
        ]

        for res_selector in reservation_selectors:
            try:
                blocks = await self.find_all(res_selector)
                if not blocks:
                    continue

                reservations = []
                for block in blocks:
                    parsed = await self._parse_reservation_block(
                        block, target_date, res_selector
                    )
                    if parsed:
                        reservations.append(parsed)

                if reservations:
                    return reservations

            except Exception as e:
                logger.debug(f"[minimo] セレクタ {res_selector} 失敗: {e}")
                continue

        return []

    async def _parse_reservation_block(
        self, block, target_date: str, res_selector: str
    ) -> dict | None:
        """
        1つの予約ブロック要素から予約情報を抽出する。

        顧客名・スタッフ名・時間・メニューを複数のセレクタパターンで取得。
        """
        try:
            data = await self._page.evaluate("""
                (el) => {
                    const getText = (parent, selectors) => {
                        for (const sel of selectors) {
                            const found = parent.querySelector(sel);
                            if (found && found.textContent.trim()) {
                                return found.textContent.trim();
                            }
                        }
                        return '';
                    };

                    const customer_name = getText(el, [
                        '.customer-name', '.guest-name', '.client-name',
                        '.reservation-name', '.booking-name',
                        '[class*="customer"]', '[class*="guest"]', '[class*="client"]',
                        'h3', 'h4', '.name',
                    ]);

                    const staff_name = getText(el, [
                        '.staff-name', '.stylist-name', '.therapist-name',
                        '[class*="staff"]', '[class*="stylist"]',
                    ]);

                    const time_text = getText(el, [
                        '.time', '.reservation-time', '.start-time',
                        '[class*="time"]', 'time',
                    ]);

                    const menu = getText(el, [
                        '.menu', '.service', '.course',
                        '[class*="menu"]', '[class*="service"]',
                    ]);

                    const external_id = el.getAttribute('data-id') ||
                        el.getAttribute('data-reservation-id') ||
                        el.getAttribute('id') || '';

                    return {
                        customer_name,
                        staff_name,
                        time_text,
                        menu,
                        external_id,
                        class_name: el.className,
                        full_text: el.textContent.trim().substring(0, 200),
                    };
                }
            """, block)

            if not data:
                return None

            customer_name = data.get("customer_name", "")
            if not customer_name:
                return None

            # 時刻テキストをパース（例: "10:00〜11:00", "10:00-11:00", "10:00"）
            time_text = data.get("time_text", "")
            start_time, end_time = _parse_time_range(time_text)

            if not start_time and not end_time:
                # full_text から時刻を抽出
                start_time, end_time = _extract_time_from_text(data.get("full_text", ""))

            staff_name = data.get("staff_name", "")
            menu = data.get("menu", "")
            raw_id = data.get("external_id", "")
            external_id = (
                f"MINIMO-{raw_id}"
                if raw_id
                else f"MINIMO-{target_date}-{start_time}-{staff_name or customer_name}"
            )

            return {
                "source": "minimo",
                "date": target_date,
                "start_time": start_time,
                "end_time": end_time,
                "staff_name": staff_name,
                "customer_name": customer_name,
                "menu": menu,
                "status": "confirmed",
                "external_id": external_id,
                "raw_data": {
                    "selector": res_selector,
                    "class_name": data.get("class_name", ""),
                },
            }

        except Exception as e:
            logger.debug(f"[minimo] 予約ブロックパースエラー: {e}")
            return None

    async def _try_table_extraction(self, target_date: str) -> list[dict]:
        """
        テーブル構造から予約データを取得する（最終フォールバック）。

        スケジュールがHTMLテーブルで実装されている場合に対応。
        """
        try:
            tables = await self.find_all("table")
            if not tables:
                return []

            all_reservations = []

            for table in tables:
                rows_data = await self._page.evaluate("""
                    (table) => {
                        const rows = Array.from(table.querySelectorAll('tr'));
                        return rows.map(row => ({
                            cells: Array.from(row.querySelectorAll('td, th')).map(cell =>
                                cell.textContent.trim()
                            ),
                        }));
                    }
                """, table)

                if not rows_data:
                    continue

                parsed = _parse_table_rows(rows_data, target_date)
                all_reservations.extend(parsed)

            return all_reservations

        except Exception as e:
            logger.debug(f"[minimo] テーブル抽出エラー: {e}")
            return []


# ------------------------------------------------------------------
# ユーティリティ関数
# ------------------------------------------------------------------

def _normalize_time(time_str: str) -> str:
    """
    時刻文字列を HH:MM 形式に正規化する。

    入力例: "10:00:00", "10時00分", "1000", "10:00 AM"
    """
    if not time_str:
        return ""

    # 既に HH:MM 形式
    m = re.match(r"^(\d{1,2}):(\d{2})(?::\d{2})?$", time_str.strip())
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}"

    # "10時00分" 形式
    m = re.match(r"(\d{1,2})時(\d{2})分", time_str)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}"

    # "HHMM" 形式（4桁）
    m = re.match(r"^(\d{2})(\d{2})$", time_str.strip())
    if m:
        return f"{m.group(1)}:{m.group(2)}"

    # ISO datetime から時刻抽出
    m = re.search(r"T(\d{2}:\d{2})", time_str)
    if m:
        return m.group(1)

    # HH:MM を含む文字列から抽出
    m = re.search(r"(\d{1,2}):(\d{2})", time_str)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}"

    return ""


def _parse_time_range(time_text: str) -> tuple[str, str]:
    """
    時刻範囲テキストから開始・終了時刻を抽出する。

    入力例: "10:00〜11:00", "10:00-11:00", "10:00 ~ 11:00", "10:00 to 11:00"
    """
    if not time_text:
        return ("", "")

    # 区切り文字で分割
    for sep in ["〜", "～", " - ", "~", " to ", "ー", "→"]:
        if sep in time_text:
            parts = time_text.split(sep, 1)
            start = _normalize_time(parts[0].strip())
            end = _normalize_time(parts[1].strip()) if len(parts) > 1 else ""
            return (start, end)

    # 単一時刻
    single = _normalize_time(time_text.strip())
    return (single, "")


def _extract_time_from_text(text: str) -> tuple[str, str]:
    """
    テキスト全体から時刻パターンを探して開始・終了時刻を抽出する。
    """
    matches = re.findall(r"\d{1,2}:\d{2}", text)
    if len(matches) >= 2:
        return (_normalize_time(matches[0]), _normalize_time(matches[1]))
    if len(matches) == 1:
        return (_normalize_time(matches[0]), "")
    return ("", "")


def _parse_table_rows(
    rows_data: list[dict], target_date: str
) -> list[dict]:
    """
    テーブル行データから予約情報を抽出する。

    時刻・顧客名・スタッフ名が含まれる行を予約として認識。
    """
    reservations = []
    time_pattern = re.compile(r"\d{1,2}:\d{2}")

    for row in rows_data:
        cells = row.get("cells", [])
        if len(cells) < 2:
            continue

        # 時刻を含むセルを探す
        time_cells = [c for c in cells if time_pattern.search(c)]
        name_cells = [c for c in cells if c and not time_pattern.search(c) and len(c) > 1]

        if not time_cells or not name_cells:
            continue

        start_time, end_time = _parse_time_range(time_cells[0])
        customer_name = name_cells[0] if name_cells else ""
        staff_name = name_cells[1] if len(name_cells) > 1 else ""

        if not customer_name or not start_time:
            continue

        reservations.append({
            "source": "minimo",
            "date": target_date,
            "start_time": start_time,
            "end_time": end_time,
            "staff_name": staff_name,
            "customer_name": customer_name,
            "menu": "",
            "status": "confirmed",
            "external_id": f"MINIMO-{target_date}-{start_time}-{customer_name}",
            "raw_data": {"cells": cells},
        })

    return reservations
