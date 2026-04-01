"""
SalonBoard 予約書き込みスクレイパー

チャットボットで確定した予約を SalonBoard のスケジュール画面に書き込む。
SalonBoardには「スロット保留」機能がないため、フル予約を作成する。

フロー:
  1. スケジュール画面に遷移（対象日）
  2. 対象スタッフの空きセルをクリック
  3. 予約フォームに顧客情報を入力
  4. 確認ダイアログで「登録」を押す
  5. 成功を確認して write_back_queue を更新

注意:
  - SBアカウント取得後にセレクタを実機確認すること
  - CAPTCHA出現時はフォールバック（管理者通知）
  - 予約フォームのPOSTエンドポイントは非公開（ブラウザ操作必須）

セレクタ情報（推定、要実機確認）:
  - スケジュール画面: /KLP/schedule/salonSchedule/
  - 空きセルクリック → 予約登録モーダル表示
  - フォームフィールド: 顧客名, 電話番号, メニュー, 時間
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from scrapers.salonboard_scraper import SalonBoardScraper

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))


@dataclass
class BookingRequest:
    """SalonBoardに書き込む予約情報"""
    date: str             # YYYY-MM-DD
    start_time: str       # HH:MM
    end_time: str         # HH:MM
    staff_name: str
    customer_name: str
    customer_phone: str = ""
    menu: str = ""
    duration_min: int = 30


@dataclass
class BookingResult:
    """書き込み結果"""
    success: bool
    error: str | None = None
    screenshot_path: str | None = None


class SalonBoardWriter(SalonBoardScraper):
    """SalonBoard に予約を書き込む（chatbot → SB 方向の同期）"""

    async def create_reservation(self, req: BookingRequest) -> BookingResult:
        """
        SalonBoardのスケジュール画面に予約を作成する。

        1. ログイン確認
        2. スケジュール画面へ遷移（対象日）
        3. 対象スタッフの時間セルをクリック
        4. 予約フォームに入力
        5. 確認・登録

        Returns:
            BookingResult(success=True/False, error=エラー詳細)
        """
        try:
            # 1. ログイン確認
            if not await self.ensure_logged_in():
                return BookingResult(
                    success=False,
                    error="SalonBoardへのログインに失敗",
                )

            # 2. スケジュール画面へ遷移
            schedule_url = self._build_schedule_url(req.date)
            if not await self.safe_goto(schedule_url):
                return BookingResult(
                    success=False,
                    error=f"スケジュール画面への遷移失敗: {schedule_url}",
                )
            await self.human_delay(2.0, 3.0)

            # CAPTCHA チェック
            if await self.detect_captcha():
                await self.screenshot(f"write_captcha_{req.date}")
                return BookingResult(
                    success=False,
                    error="CAPTCHA検知 — 手動対応が必要",
                )

            # 3. スタッフの空きセルをクリック
            cell_clicked = await self._click_empty_cell(
                req.staff_name, req.start_time
            )
            if not cell_clicked:
                path = await self.screenshot(f"write_no_cell_{req.date}_{req.start_time}")
                return BookingResult(
                    success=False,
                    error=f"空きセルが見つからない: {req.staff_name} {req.start_time}",
                    screenshot_path=str(path) if path else None,
                )

            # 4. 予約フォームに入力
            form_filled = await self._fill_reservation_form(req)
            if not form_filled:
                path = await self.screenshot(f"write_form_error_{req.date}")
                return BookingResult(
                    success=False,
                    error="予約フォームの入力に失敗",
                    screenshot_path=str(path) if path else None,
                )

            # 5. 確認・登録
            submitted = await self._submit_reservation()
            if not submitted:
                path = await self.screenshot(f"write_submit_error_{req.date}")
                return BookingResult(
                    success=False,
                    error="予約の送信に失敗",
                    screenshot_path=str(path) if path else None,
                )

            logger.info(
                f"[{self.name}] SB書き込み成功: "
                f"{req.date} {req.start_time} {req.staff_name} {req.customer_name}"
            )
            return BookingResult(success=True)

        except Exception as e:
            logger.error(f"[{self.name}] SB書き込みエラー: {e}")
            await self.screenshot(f"write_exception_{req.date}")
            return BookingResult(success=False, error=str(e))

    def _build_schedule_url(self, date: str) -> str:
        """日付指定のスケジュールURL を構築"""
        # SalonBoardのURL形式は実機確認が必要
        # 一般的なパターン: ?targetDate=20260405 or ?date=2026-04-05
        date_compact = date.replace("-", "")
        return f"{self.schedule_url}?targetDate={date_compact}"

    async def _click_empty_cell(
        self, staff_name: str, start_time: str
    ) -> bool:
        """
        スケジュールグリッドでスタッフの空きセルをクリック。

        TODO: 実機確認後に実装
        - スタッフヘッダーからカラムインデックスを特定
        - 時間行と交差するセルを特定
        - 空きセル（予約ブロックがない）をクリック
        """
        logger.info(
            f"[{self.name}] 空きセルクリック: {staff_name} {start_time}"
        )

        # --- スタッフカラムの特定 ---
        # セレクタ: .scheduleMainHeadList.isStaff > li.scheduleMainHead
        staff_headers = await self.query_all(
            ".scheduleMainHeadList.isStaff > li.scheduleMainHead"
        )
        if not staff_headers:
            # フォールバックセレクタ
            staff_headers = await self.query_all(".scheduleMainHead")

        if not staff_headers:
            logger.error(f"[{self.name}] スタッフヘッダーが見つからない")
            return False

        target_col_idx = None
        for idx, header in enumerate(staff_headers):
            try:
                text = await self._page.evaluate(
                    "(el) => el.textContent", header
                )
                if text and staff_name in text.strip():
                    target_col_idx = idx
                    break
            except Exception:
                continue

        if target_col_idx is None:
            logger.error(
                f"[{self.name}] スタッフ '{staff_name}' がスケジュールに見つからない"
            )
            return False

        # --- 時間セルのクリック ---
        # SalonBoardのスケジュールは時間軸 x スタッフ軸のグリッド
        # 具体的なセレクタは実機で確認が必要
        # 推定: .scheduleMainTable の中の li[data-time="HH:MM"]
        # または時間ラベルから行を特定

        # TODO: 実機確認後に正確なセレクタで実装
        logger.warning(
            f"[{self.name}] _click_empty_cell は実機確認後に実装が必要"
        )
        return False

    async def _fill_reservation_form(self, req: BookingRequest) -> bool:
        """
        予約登録フォームに顧客情報を入力。

        TODO: 実機確認後に実装
        - 顧客名
        - 電話番号
        - メニュー選択
        - 開始・終了時間
        """
        logger.info(
            f"[{self.name}] フォーム入力: {req.customer_name} {req.menu}"
        )

        # 推定セレクタ（実機確認が必要）
        form_selectors = {
            "customer_name": [
                'input[name="customerName"]',
                'input[name="guestName"]',
                '#customerName',
            ],
            "phone": [
                'input[name="tel"]',
                'input[name="phone"]',
                'input[type="tel"]',
            ],
        }

        # 顧客名入力
        for selector in form_selectors["customer_name"]:
            name_input = await self.query(selector)
            if name_input:
                await self.human_type(name_input, req.customer_name)
                break
        else:
            logger.error(f"[{self.name}] 顧客名フィールドが見つからない")
            return False

        await self.human_delay(0.3, 0.6)

        # 電話番号入力（任意）
        if req.customer_phone:
            for selector in form_selectors["phone"]:
                phone_input = await self.query(selector)
                if phone_input:
                    await self.human_type(phone_input, req.customer_phone)
                    break

        await self.human_delay(0.3, 0.6)

        # TODO: メニュー選択、時間設定（ドロップダウン操作）
        logger.warning(
            f"[{self.name}] _fill_reservation_form は実機確認後に完全実装が必要"
        )
        return False

    async def _submit_reservation(self) -> bool:
        """
        予約フォームの送信ボタンを押す。

        TODO: 実機確認後に実装
        - 「登録」ボタンをクリック
        - 確認ダイアログの「OK」をクリック
        - 成功メッセージを確認
        """
        # 推定セレクタ
        submit_selectors = [
            'button[type="submit"]',
            'a.common-CNCcommon__primaryBtn',
            'input[type="submit"]',
        ]

        for selector in submit_selectors:
            btn = await self.query(selector)
            if btn:
                await self.human_click(btn)
                await self.human_delay(1.0, 2.0)

                # 確認ダイアログ対応
                try:
                    confirm = await self._page.find("登録", timeout=5)
                    if confirm:
                        await self.human_click(confirm)
                except Exception:
                    pass

                # 成功確認（URLやメッセージで判定）
                await self.human_delay(2.0, 3.0)
                logger.info(f"[{self.name}] 送信完了（成功確認は実機テストで検証）")
                return True

        logger.error(f"[{self.name}] 送信ボタンが見つからない")
        return False

    async def query_all(self, selector: str) -> list:
        """複数要素を取得するヘルパー"""
        try:
            elements = await self._page.query_selector_all(selector)
            return elements or []
        except Exception:
            return []
