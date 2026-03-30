"""
デモ用モック予約データ
サロンボード実アカウント不要でデモフロー全体を見せるためのモックデータ
"""

from datetime import datetime, timedelta
import random

# スタッフ定義
STAFF_LIST = [
    {"id": "staff_1", "name": "田中 美咲", "color": "#FF6B9D"},
    {"id": "staff_2", "name": "鈴木 健太", "color": "#4ECDC4"},
    {"id": "staff_3", "name": "佐藤 あゆみ", "color": "#45B7D1"},
    {"id": "staff_4", "name": "山田 拓也", "color": "#96CEB4"},
]

# メニュー定義
MENU_LIST = [
    {"name": "カット", "price": 4400, "duration_min": 60},
    {"name": "カット+カラー", "price": 8800, "duration_min": 120},
    {"name": "パーマ", "price": 7700, "duration_min": 150},
    {"name": "トリートメント", "price": 3300, "duration_min": 60},
    {"name": "カラー", "price": 5500, "duration_min": 90},
    {"name": "縮毛矯正", "price": 12100, "duration_min": 180},
]

# デモ用顧客名リスト
CUSTOMER_NAMES = [
    "伊藤 花子", "渡辺 恵", "中村 由美", "小林 さくら", "加藤 真奈美",
    "松本 智子", "井上 美穂", "木村 奈緒", "林 友美", "清水 千夏",
    "山本 裕子", "池田 麻衣", "橋本 愛", "山口 理恵", "石川 みな",
    "前田 莉奈", "藤田 彩", "後藤 桃子", "岡田 舞", "村田 希",
]

# 時間スロット（9:00〜20:00、30分刻み）
def _generate_time_slots() -> list[str]:
    slots = []
    hour = 9
    minute = 0
    while hour < 20:
        slots.append(f"{hour:02d}:{minute:02d}")
        minute += 30
        if minute >= 60:
            minute = 0
            hour += 1
    return slots

TIME_SLOTS = _generate_time_slots()


def _seed_from_date(date_str: str) -> int:
    """日付文字列から決定論的シードを生成（同じ日付は常に同じデータ）"""
    return int(date_str.replace("-", "")) % 100000


def _make_reservation(
    date_str: str,
    staff: dict,
    start_time: str,
    duration_min: int,
    customer_name: str,
    menu: dict,
) -> dict:
    """予約データ辞書を生成（salonboard_scraper.pyの返却形式に準拠）"""
    start_dt = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")
    end_dt = start_dt + timedelta(minutes=duration_min)
    end_time = end_dt.strftime("%H:%M")

    return {
        "date": date_str,
        "staff_id": staff["id"],
        "staff_name": staff["name"],
        "start_time": start_time,
        "end_time": end_time,
        "customer_name": customer_name,
        "menu": menu["name"],
        "price": menu["price"],
        "duration_min": duration_min,
        "status": "confirmed",
        "source": "demo_mock",
    }


def _is_slot_occupied(reservations: list[dict], staff_id: str, slot_time: str) -> bool:
    """指定スタッフのスロットが予約で埋まっているか判定"""
    for res in reservations:
        if res["staff_id"] != staff_id:
            continue
        if res["start_time"] <= slot_time < res["end_time"]:
            return True
    return False


def generate_mock_reservations(target_date: str) -> list[dict]:
    """
    指定日のモック予約データを生成（リアルなサロン予約パターン）

    Args:
        target_date: "YYYY-MM-DD" 形式の日付文字列

    Returns:
        予約データのリスト（salonboard_scraper.pyの返却形式に準拠）
    """
    rng = random.Random(_seed_from_date(target_date))
    reservations = []

    for staff in STAFF_LIST:
        # 各スタッフの予約を時間軸で組み立てる
        current_slot_idx = 0  # 9:00から開始

        while current_slot_idx < len(TIME_SLOTS):
            slot_time = TIME_SLOTS[current_slot_idx]

            # 昼休み（12:00〜13:00）は予約なし
            if slot_time in ("12:00", "12:30"):
                current_slot_idx += 1
                continue

            # 約65%の確率で予約が入っている（人気サロンの稼働率）
            is_booked = rng.random() < 0.65

            if is_booked:
                menu = rng.choice(MENU_LIST)
                customer = rng.choice(CUSTOMER_NAMES)

                # 時間が足りる場合のみ予約を入れる
                start_dt = datetime.strptime(
                    f"{target_date} {slot_time}", "%Y-%m-%d %H:%M"
                )
                end_dt = start_dt + timedelta(minutes=menu["duration_min"])

                if end_dt.hour < 20 or (end_dt.hour == 20 and end_dt.minute == 0):
                    reservation = _make_reservation(
                        date_str=target_date,
                        staff=staff,
                        start_time=slot_time,
                        duration_min=menu["duration_min"],
                        customer_name=customer,
                        menu=menu,
                    )
                    reservations.append(reservation)

                    # 予約時間分のスロットを進める
                    slots_used = menu["duration_min"] // 30
                    current_slot_idx += slots_used
                else:
                    current_slot_idx += 1
            else:
                current_slot_idx += 1

    return reservations


def get_available_slots(target_date: str) -> list[dict]:
    """
    指定日の空き枠を返す（チャットボットが参照する）

    Args:
        target_date: "YYYY-MM-DD" 形式の日付文字列

    Returns:
        空き枠データのリスト（スタッフ・時間帯ごと）
    """
    reservations = generate_mock_reservations(target_date)
    available_slots = []

    for staff in STAFF_LIST:
        for slot_time in TIME_SLOTS:
            # 昼休みは除外
            if slot_time in ("12:00", "12:30"):
                continue

            if not _is_slot_occupied(reservations, staff["id"], slot_time):
                available_slots.append({
                    "date": target_date,
                    "staff_id": staff["id"],
                    "staff_name": staff["name"],
                    "start_time": slot_time,
                    "available": True,
                })

    return available_slots


def get_staff_list() -> list[dict]:
    """スタッフ一覧を返す"""
    return [{"id": s["id"], "name": s["name"]} for s in STAFF_LIST]


def get_menu_list() -> list[dict]:
    """メニュー一覧を返す"""
    return [
        {
            "name": m["name"],
            "price": m["price"],
            "duration_min": m["duration_min"],
            "price_display": f"¥{m['price']:,}",
        }
        for m in MENU_LIST
    ]


def build_schedule_grid(target_date: str) -> dict:
    """
    フロントエンド表示用のスケジュールグリッドデータを構築

    Returns:
        {
          "date": "2026-03-30",
          "staff": [...],
          "time_slots": [...],
          "grid": { "staff_id": { "HH:MM": cell_data } }
        }
    """
    reservations = generate_mock_reservations(target_date)
    grid: dict[str, dict[str, dict]] = {}

    for staff in STAFF_LIST:
        grid[staff["id"]] = {}
        occupied_until: str | None = None

        for slot_time in TIME_SLOTS:
            # このスロットを占有する予約を探す
            res_here = next(
                (r for r in reservations
                 if r["staff_id"] == staff["id"] and r["start_time"] == slot_time),
                None,
            )

            is_lunch = slot_time in ("12:00", "12:30")
            is_occupied = _is_slot_occupied(reservations, staff["id"], slot_time)

            if is_lunch:
                grid[staff["id"]][slot_time] = {
                    "status": "lunch",
                    "label": "昼休み",
                    "customer_name": None,
                    "menu": None,
                    "is_start": False,
                }
            elif res_here:
                grid[staff["id"]][slot_time] = {
                    "status": "booked",
                    "label": res_here["customer_name"],
                    "customer_name": res_here["customer_name"],
                    "menu": res_here["menu"],
                    "start_time": res_here["start_time"],
                    "end_time": res_here["end_time"],
                    "duration_min": res_here["duration_min"],
                    "is_start": True,
                }
            elif is_occupied:
                grid[staff["id"]][slot_time] = {
                    "status": "booked_continuation",
                    "label": None,
                    "customer_name": None,
                    "menu": None,
                    "is_start": False,
                }
            else:
                grid[staff["id"]][slot_time] = {
                    "status": "available",
                    "label": "空き",
                    "customer_name": None,
                    "menu": None,
                    "is_start": False,
                }

    return {
        "date": target_date,
        "staff": STAFF_LIST,
        "time_slots": TIME_SLOTS,
        "grid": grid,
        "reservations": reservations,
    }
