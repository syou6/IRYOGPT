"""
サロンボード 予約データ読み取り

TODO: アカウント取得後にセレクタを特定して実装
"""

from datetime import date, timedelta
from salonboard.login import get_authenticated_page, SCREENSHOTS_DIR


# サロンボードの予約一覧URL（推定）
# TODO: 実際のURLに置き換え
RESERVATION_URL = "https://salonboard.com/KLP/reserve/reserveList/"


def get_reservations(target_date=None):
    """
    指定日の予約一覧を取得

    Returns:
        list[dict]: 予約データのリスト
        [
            {
                "time": "10:00",
                "customer_name": "山田太郎",
                "menu": "カット",
                "staff": "スタイリストA",
                "status": "confirmed"
            },
            ...
        ]
    """
    if target_date is None:
        target_date = date.today()

    pw, browser, context, page = get_authenticated_page(headless=True)

    try:
        # 予約一覧ページへ遷移
        # TODO: 日付パラメータの渡し方を確認
        url = f"{RESERVATION_URL}?date={target_date.isoformat()}"
        page.goto(url, wait_until="networkidle", timeout=30000)

        # デバッグ用スクショ
        page.screenshot(
            path=str(SCREENSHOTS_DIR / f"reservations_{target_date}.png"),
            full_page=True,
        )

        # TODO: 実際のセレクタで予約データを抽出
        # 以下はプレースホルダー
        reservations = []

        # 例: テーブル行から予約を抽出
        # rows = page.query_selector_all("table.reserve-list tr")
        # for row in rows:
        #     cols = row.query_selector_all("td")
        #     if len(cols) >= 4:
        #         reservations.append({
        #             "time": cols[0].inner_text().strip(),
        #             "customer_name": cols[1].inner_text().strip(),
        #             "menu": cols[2].inner_text().strip(),
        #             "staff": cols[3].inner_text().strip(),
        #             "status": "confirmed",
        #         })

        print(f"{target_date} の予約: {len(reservations)}件")
        return reservations

    finally:
        browser.close()
        pw.stop()


def get_available_slots(target_date=None, staff_id=None):
    """
    指定日の空き枠を取得

    Returns:
        list[str]: 空き時間のリスト ["10:00", "11:00", "14:00", ...]
    """
    # TODO: 実装
    pass


if __name__ == "__main__":
    reservations = get_reservations()
    for r in reservations:
        print(r)
