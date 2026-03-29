"""
ミニモ サロンツール スクレイパー（undetected-chromedriver版）

確認済み情報（公式サイト・ヘルプ・集客ノート・利用規約・SalonConnect FAQ より）:

基本情報:
- 提供元: 株式会社MIXI（旧ミクシィ）
- 料金: 完全無料
- 推奨ブラウザ: Google Chrome

URL構造:
- ログイン: https://minimodel.jp/salontool/login
- ログイン後: https://minimodel.jp/salontool/home
- SPA内ルーティング: home#/schedule, home#/reservation 等（ハッシュベース）
- お問い合わせ: home#/menu/inquiry（確認済み）

ログイン:
- サロンID: 半角英数字6文字（メールアドレスではない）、大文字小文字区別
- パスワード: 利用申請時にメールで発行
- 推定セレクタ: input[name="salon_id"] or input[name="salonId"]

管理画面構造:
- SPAフレームワーク（AngularJS 1.x 推定、ハッシュルーティング）
- メニュー: スケジュール、予約管理、メッセージ、レポート、掲載内容編集、設定、外部連携

スケジュール画面:
- レイアウト: スタッフごとに24時間タイムテーブル（横並びカラム）
- 上段: 予約可能な空き時間管理（赤=受付中、白=受付なし、グレー=営業時間外）
- 下段: 予約詳細（顧客名 + 省略メニューコード Ｃ=カット, Ｌ=カラー, Ｐ=パーマ）
- 時間枠: メニューの施術時間に連動、15分単位（07:00〜23:30）

重要:
- SPA構造のため page.goto() でのダイレクトナビゲーションが効かない
  → メニューのクリックによるSPA内遷移が必要
- SPAなのでJSON APIを内部で叩いている可能性が高い
  → Network監視でAPIエンドポイントを特定できる可能性あり
- GitHub上にミニモのスクレイパーは存在しない（サロンボードとは対照的）
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

# ログイン後のリダイレクト先
MINIMO_HOME_URL = "https://minimodel.jp/salontool/home"


class MinimoScraper(BaseScraper):
    def __init__(self):
        super().__init__(name="minimo", cookies_path=MINIMO_COOKIES_PATH)
        self._api_endpoints: list[str] = []

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

            if await self.detect_captcha():
                logger.error("[minimo] ログインページでCAPTCHA検知")
                return False

            await self.screenshot("login_page")
            await self._dump_form_structure()

            # サロンID入力
            id_selectors = [
                'input[name="salon_id"]',
                'input[name="salonId"]',
                'input[name="login_id"]',
                'input[name="loginId"]',
                'input[name="userId"]',
            ]
            id_filled = False
            for selector in id_selectors:
                try:
                    element = await self._query_selector(selector)
                    if element:
                        await self.human_type(selector, MINIMO_ID)
                        id_filled = True
                        logger.info(f"[minimo] サロンID入力セレクタ: {selector}")
                        break
                except Exception:
                    continue

            if not id_filled:
                # フォールバック: 最初のテキスト入力を探す
                first_input = await self._find_element('input[type="text"]', timeout=5)
                if first_input:
                    await self.human_type('input[type="text"]', MINIMO_ID)
                    id_filled = True
                    logger.info("[minimo] サロンID入力: フォールバック(最初のtext input)")

            if not id_filled:
                logger.error("[minimo] サロンID入力フィールドが見つからない")
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
                    element = await self._query_selector(selector)
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
                'button:has-text("ログイン"):visible',
                'a:has-text("ログイン"):visible',
            ]
            clicked = False
            for selector in login_selectors:
                try:
                    element = await self._find_element(selector, timeout=5)
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
            success = await self.wait_for_url_change(
                lambda url: "/login" not in url.lower(),
                timeout=15,
            )
            if not success:
                logger.error("[minimo] ログイン後の遷移タイムアウト")
                await self.screenshot("login_timeout")
                return False

            await self.human_delay(1.0, 2.0)

            if await self.detect_captcha():
                logger.error("[minimo] ログイン後にCAPTCHA検知")
                return False

            current_url = await self.get_current_url()
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
            if not await self.safe_goto(MINIMO_HOME_URL, timeout=15000):
                return False

            current_url = await self.get_current_url()
            if "/login" in current_url.lower():
                logger.info("[minimo] セッション切れ")
                return False

            return True
        except Exception:
            return False

    # ------------------------------------------------------------------
    # フォーム構造ダンプ
    # ------------------------------------------------------------------

    async def _dump_form_structure(self) -> None:
        """ログインページのフォーム構造をダンプ（セレクタ特定用）"""
        try:
            form_info = await self.execute_script("""
                const inputs = document.querySelectorAll('input, button, a');
                return Array.from(inputs).map(el => ({
                    tag: el.tagName,
                    type: el.type || '',
                    name: el.name || '',
                    id: el.id || '',
                    className: el.className || '',
                    placeholder: el.placeholder || '',
                    text: el.textContent?.trim()?.substring(0, 50) || '',
                }));
            """)
            logger.info(f"[minimo] フォーム構造: {form_info}")
        except Exception as e:
            logger.debug(f"[minimo] フォーム構造取得エラー: {e}")

    # ------------------------------------------------------------------
    # 予約データ取得
    # ------------------------------------------------------------------

    async def fetch_reservations(self, target_date: str) -> list[dict]:
        """指定日の予約一覧を取得。target_date: 'YYYY-MM-DD' 形式"""
        reservations = []

        try:
            if not await self.ensure_logged_in():
                logger.error("[minimo] ログイン失敗、予約取得中止")
                return []

            # SPA内ナビゲーション
            current_url = await self.get_current_url()
            if "salontool/home" not in current_url:
                if not await self.safe_goto(MINIMO_HOME_URL):
                    return []

            await self.human_delay(1.0, 2.0)

            # スケジュールメニューへ遷移（SPA内ナビゲーション）
            schedule_navigated = False
            nav_selectors = [
                'a:has-text("スケジュール"):visible',
                'a[href*="#/schedule"]',
                'a:has-text("予約管理"):visible',
                'a:has-text("予約"):visible',
            ]

            for selector in nav_selectors:
                try:
                    element = await self._find_element(selector, timeout=5)
                    if element:
                        await self.human_click(selector)
                        await self.human_delay(2.0, 3.0)
                        schedule_navigated = True
                        logger.info(f"[minimo] スケジュール遷移: {selector}")
                        break
                except Exception:
                    continue

            if not schedule_navigated:
                # ハッシュナビゲーションを直接試す
                try:
                    await self.execute_script("window.location.hash = '#/schedule'")
                    await self.human_delay(2.0, 3.0)
                    schedule_navigated = True
                    logger.info("[minimo] ハッシュナビゲーションで遷移")
                except Exception:
                    pass

            if not schedule_navigated:
                logger.error("[minimo] スケジュール画面への遷移失敗")
                await self.screenshot("nav_failed")
                return []

            await self.screenshot(f"schedule_{target_date}")

            if await self.detect_captcha():
                logger.error("[minimo] 予約ページでCAPTCHA検知")
                return []

            # 日付切り替え
            await self._navigate_to_date(target_date)

            reservations = await self._parse_schedule_page(target_date)

        except Exception as e:
            logger.error(f"[minimo] 予約取得エラー: {e}")
            await self.screenshot("fetch_error")

        logger.info(f"[minimo] {target_date} の予約: {len(reservations)}件")
        return reservations

    async def _navigate_to_date(self, target_date: str) -> None:
        """スケジュール画面で指定日に移動する。TODO: 実際のUI要素を確認して修正。"""
        try:
            date_selectors = [
                'input[type="date"]',
                '.datepicker',
                '[class*="date"]',
                '[class*="calendar"]',
            ]
            for selector in date_selectors:
                element = await self._query_selector(selector)
                if element:
                    logger.info(f"[minimo] 日付セレクタ発見: {selector}")
                    break

            arrow_selectors = [
                'button:has-text(">")',
                'button:has-text("<")',
                'a:has-text("翌日")',
                'a:has-text("前日")',
                '[class*="next"]',
                '[class*="prev"]',
            ]
            for selector in arrow_selectors:
                elements = await self._find_elements(selector)
                if elements:
                    logger.info(f"[minimo] 日付ナビゲーション発見: {selector} ({len(elements)}個)")

        except Exception as e:
            logger.debug(f"[minimo] 日付ナビゲーションエラー: {e}")

    async def _parse_schedule_page(self, target_date: str) -> list[dict]:
        """スケジュール画面から予約データを抽出。TODO: テストアカウント取得後に実装。"""
        reservations = []

        try:
            page_structure = await self.execute_script("""
                const body = document.body;
                const result = {
                    url: window.location.href,
                    hash: window.location.hash,
                    title: document.title,
                    tables: [],
                    divIds: [],
                    staffElements: [],
                    timeElements: [],
                    reserveElements: [],
                };

                const tables = body.querySelectorAll('table');
                tables.forEach((t, i) => {
                    result.tables.push({
                        index: i, id: t.id, className: t.className,
                        rows: t.rows ? t.rows.length : 0,
                        cols: t.rows && t.rows[0] ? t.rows[0].cells.length : 0,
                    });
                });

                const staffSelectors = [
                    '[class*="staff"]', '[class*="Staff"]',
                    '[class*="stylist"]', '[class*="Stylist"]',
                    '[class*="member"]', '[class*="Member"]',
                ];
                staffSelectors.forEach(sel => {
                    const els = body.querySelectorAll(sel);
                    if (els.length > 0) {
                        result.staffElements.push({
                            selector: sel, count: els.length,
                            firstText: els[0].textContent?.trim()?.substring(0, 30),
                        });
                    }
                });

                const timeSelectors = [
                    '[class*="time"]', '[class*="Time"]',
                    '[class*="hour"]', '[class*="Hour"]',
                    '[class*="slot"]', '[class*="Slot"]',
                ];
                timeSelectors.forEach(sel => {
                    const els = body.querySelectorAll(sel);
                    if (els.length > 0) {
                        result.timeElements.push({ selector: sel, count: els.length });
                    }
                });

                const reserveSelectors = [
                    '[class*="reserve"]', '[class*="Reserve"]',
                    '[class*="booking"]', '[class*="Booking"]',
                    '[class*="appointment"]', '[class*="Appointment"]',
                    '[class*="event"]', '[class*="Event"]',
                ];
                reserveSelectors.forEach(sel => {
                    const els = body.querySelectorAll(sel);
                    if (els.length > 0) {
                        result.reserveElements.push({
                            selector: sel, count: els.length,
                            firstText: els[0].textContent?.trim()?.substring(0, 50),
                        });
                    }
                });

                const divs = body.querySelectorAll('div[id]');
                const seen = new Set();
                divs.forEach(d => {
                    if (d.id && seen.size < 20) {
                        seen.add(d.id);
                        result.divIds.push(d.id);
                    }
                });

                return result;
            """)
            logger.info(f"[minimo] ページ構造: {page_structure}")

        except Exception as e:
            logger.error(f"[minimo] パースエラー: {e}")

        return reservations
