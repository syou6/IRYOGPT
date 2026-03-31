"""
デモサーバー
サロンボード実アカウント不要で予約フロー全体をデモするFastAPIサーバー。

エンドポイント:
  GET  /demo                        - デモUIページ（HTML）
  GET  /demo/reservations/{date}    - 指定日の予約一覧
  GET  /demo/available-slots/{date} - 指定日の空き枠一覧
  GET  /demo/schedule-grid/{date}   - スケジュールグリッド（UI用）
  GET  /demo/staff                  - スタッフ一覧
  GET  /demo/menus                  - メニュー一覧
  POST /demo/chat                   - チャットボットシミュレーション

起動:
  python -m scrapers.demo_server
  または
  uvicorn scrapers.demo_server:app --port 8001 --reload
"""

import asyncio
import logging
import re
import sys
from datetime import datetime, timedelta, timezone
from textwrap import dedent

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from scrapers.demo_mock_data import (
    add_demo_booking,
    build_schedule_grid,
    clear_demo_bookings,
    generate_mock_reservations,
    get_available_slots,
    get_demo_bookings_count,
    get_menu_list,
    get_staff_list,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))


app = FastAPI(
    title="よやくらく デモサーバー",
    version="1.0.0",
    description="モックデータで予約フローをデモするサーバー（認証不要）",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

def _today_jst() -> str:
    return datetime.now(JST).strftime("%Y-%m-%d")


def _validate_date(date_str: str) -> str:
    """日付形式を検証して返す（無効なら今日の日付）"""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return date_str
    except ValueError:
        return _today_jst()


# ---------------------------------------------------------------------------
# チャットボットロジック
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    date: str | None = None
    session_state: dict | None = None


class ChatResponse(BaseModel):
    reply: str
    available_slots: list[dict] | None = None
    booking_confirmed: bool = False
    next_state: dict | None = None


def _extract_date_from_message(message: str, fallback: str) -> str:
    """メッセージから日付を抽出する（シンプルなルールベース）"""
    today = datetime.now(JST)

    # 「今日」「本日」
    if re.search(r"今日|本日", message):
        return today.strftime("%Y-%m-%d")

    # 「明日」
    if re.search(r"明日", message):
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")

    # 「明後日」
    if re.search(r"明後日", message):
        return (today + timedelta(days=2)).strftime("%Y-%m-%d")

    # 「来週」
    if re.search(r"来週", message):
        return (today + timedelta(weeks=1)).strftime("%Y-%m-%d")

    # 「3月30日」「3/30」などの日付パターン
    match = re.search(r"(\d{1,2})[月/](\d{1,2})", message)
    if match:
        month = int(match.group(1))
        day = int(match.group(2))
        year = today.year
        try:
            candidate = datetime(year, month, day, tzinfo=JST)
            if candidate < today:
                candidate = datetime(year + 1, month, day, tzinfo=JST)
            return candidate.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return fallback


def _extract_time_from_message(message: str) -> str | None:
    """メッセージから時刻を抽出する"""
    match = re.search(r"(\d{1,2})[時:](\d{2})?", message)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        return f"{hour:02d}:{minute:02d}"

    match = re.search(r"(\d{1,2})時", message)
    if match:
        hour = int(match.group(1))
        return f"{hour:02d}:00"

    return None


def _extract_staff_from_message(message: str) -> str | None:
    """メッセージからスタッフ名を抽出する"""
    staff_list = get_staff_list()
    for staff in staff_list:
        # 苗字または名前で検索
        name_parts = staff["name"].replace(" ", "").replace("\u3000", "")
        surname = staff["name"].split()[0]
        given = staff["name"].split()[1] if len(staff["name"].split()) > 1 else ""

        if surname in message or given in message or name_parts in message:
            return staff["name"]
    return None


def _format_available_slots_summary(slots: list[dict]) -> str:
    """空き枠を人間が読みやすい形式にフォーマット"""
    if not slots:
        return "申し訳ありませんが、その日は空き枠がございません。"

    # スタッフ別にグループ化
    by_staff: dict[str, list[str]] = {}
    for slot in slots:
        name = slot["staff_name"]
        if name not in by_staff:
            by_staff[name] = []
        by_staff[name].append(slot["start_time"])

    lines = []
    for staff_name, times in by_staff.items():
        # 最大5件まで表示
        shown = times[:5]
        suffix = f"（他 {len(times) - 5} 枠）" if len(times) > 5 else ""
        lines.append(f"・{staff_name}： {', '.join(shown)}{suffix}")

    return "\n".join(lines)


def _chatbot_reply(message: str, state: dict) -> tuple[str, dict, list[dict] | None, bool]:
    """
    ルールベースのチャットボット返答ロジック

    Returns:
        (reply_text, next_state, available_slots_or_None, booking_confirmed)
    """
    msg_lower = message.lower()
    step = state.get("step", "greeting")
    target_date = state.get("date", _today_jst())
    selected_staff = state.get("staff")
    selected_time = state.get("time")

    # ---- ステップ: 挨拶・初回 ----
    if step == "greeting" or re.search(r"予約|空き|取りたい|したい", message):
        # 日付を抽出
        extracted_date = _extract_date_from_message(message, target_date)
        extracted_time = _extract_time_from_message(message)
        extracted_staff = _extract_staff_from_message(message)

        new_state = {
            "step": "show_slots",
            "date": extracted_date,
            "staff": extracted_staff,
            "time": extracted_time,
        }

        date_display = datetime.strptime(extracted_date, "%Y-%m-%d").strftime("%-m月%-d日")
        slots = get_available_slots(extracted_date)

        if extracted_staff:
            slots = [s for s in slots if s["staff_name"] == extracted_staff]

        if extracted_time:
            slots = [s for s in slots if s["start_time"] == extracted_time]

        summary = _format_available_slots_summary(slots)
        reply = (
            f"{date_display}の空き状況をお調べしました。\n\n"
            f"{summary}\n\n"
            "ご希望のスタッフと時間帯をお教えください。"
        )
        return reply, new_state, slots[:20], False

    # ---- ステップ: スロット表示済み → スタッフ・時間確認 ----
    if step == "show_slots":
        extracted_staff = _extract_staff_from_message(message) or selected_staff
        extracted_time = _extract_time_from_message(message) or selected_time
        extracted_date = _extract_date_from_message(message, target_date)

        if extracted_staff and extracted_time:
            # 両方揃ったので確認に進む
            new_state = {
                "step": "confirm",
                "date": extracted_date,
                "staff": extracted_staff,
                "time": extracted_time,
            }
            date_display = datetime.strptime(extracted_date, "%Y-%m-%d").strftime("%-m月%-d日")
            reply = (
                f"以下の内容で予約を取りますね。\n\n"
                f"日時: {date_display} {extracted_time}〜\n"
                f"担当: {extracted_staff}\n\n"
                "こちらでよろしいでしょうか？（はい / いいえ）"
            )
            return reply, new_state, None, False

        elif extracted_time and not extracted_staff:
            new_state = {**state, "step": "show_slots", "time": extracted_time, "date": extracted_date}
            slots = get_available_slots(extracted_date)
            slots = [s for s in slots if s["start_time"] == extracted_time]
            if slots:
                staff_options = "、".join(set(s["staff_name"] for s in slots))
                reply = (
                    f"{extracted_time}は {staff_options} が対応可能です。\n"
                    "どのスタッフをご希望ですか？"
                )
            else:
                reply = f"{extracted_time}は残念ながら空きがございません。別の時間帯はいかがでしょうか？"
            return reply, new_state, slots, False

        elif extracted_staff and not extracted_time:
            new_state = {**state, "step": "show_slots", "staff": extracted_staff, "date": extracted_date}
            slots = get_available_slots(extracted_date)
            slots = [s for s in slots if s["staff_name"] == extracted_staff]
            summary = _format_available_slots_summary(slots)
            reply = f"{extracted_staff}の空き時間帯です。\n\n{summary}\n\nご希望の時間帯をお知らせください。"
            return reply, new_state, slots, False

        else:
            # まだ情報が揃っていない
            slots = get_available_slots(target_date)
            summary = _format_available_slots_summary(slots)
            reply = (
                "ご希望のスタッフと時間帯をお教えください。\n\n"
                f"本日の空き状況：\n{summary}"
            )
            return reply, state, slots[:20], False

    # ---- ステップ: 確認待ち ----
    if step == "confirm":
        if re.search(r"はい|yes|お願い|確定|いいです|大丈夫", message, re.IGNORECASE):
            # 実際にインメモリストアに予約を書き込む
            booking = add_demo_booking(
                date=target_date,
                staff_name=selected_staff,
                start_time=selected_time,
                customer_name="WEB予約（AI受付）",
                menu="初診・検診",
                duration_min=30,
            )

            date_display = datetime.strptime(target_date, "%Y-%m-%d").strftime("%-m月%-d日")

            if booking:
                reply = (
                    f"ご予約が確定しました！\n\n"
                    f"📅 日時: {date_display} {selected_time}〜{booking['end_time']}\n"
                    f"👨‍⚕️ 担当: {selected_staff}\n"
                    f"📋 内容: 初診・検診\n\n"
                    "左のスケジュール表にも反映されましたのでご確認ください。\n"
                    "ご来院をお待ちしております。"
                )
            else:
                reply = (
                    f"申し訳ありません。{date_display} {selected_time}〜の{selected_staff}の枠は"
                    "ちょうど埋まってしまったようです。\n\n"
                    "別の時間帯をお選びいただけますか？"
                )
                new_state = {"step": "show_slots", "date": target_date}
                return reply, new_state, get_available_slots(target_date)[:20], False

            new_state = {"step": "done"}
            return reply, new_state, None, True

        elif re.search(r"いいえ|no|違う|変更|やめ", message, re.IGNORECASE):
            new_state = {"step": "show_slots", "date": target_date}
            slots = get_available_slots(target_date)
            summary = _format_available_slots_summary(slots)
            reply = (
                "承知しました。改めてご希望の日時をお知らせください。\n\n"
                f"本日の空き状況：\n{summary}"
            )
            return reply, new_state, slots[:20], False

        else:
            date_display = datetime.strptime(target_date, "%Y-%m-%d").strftime("%-m月%-d日")
            reply = (
                f"日時: {date_display} {selected_time}〜\n"
                f"担当: {selected_staff}\n\n"
                "こちらでよろしいでしょうか？（はい / いいえ）"
            )
            return reply, state, None, False

    # ---- ステップ: 完了済み ----
    if step == "done":
        new_state = {"step": "greeting"}
        return (
            "他にご不明な点はございますか？\n"
            "追加のご予約や診療内容のご確認など、いつでもお申し付けください。",
            new_state,
            None,
            False,
        )

    # ---- フォールバック ----
    return (
        "ご予約のご希望でしょうか？\n"
        "「明日の午後に予約したい」のようにお気軽にお申し付けください。\n"
        "急なお痛みなど緊急の場合はお電話でもご対応いたします。",
        {"step": "greeting"},
        None,
        False,
    )


# ---------------------------------------------------------------------------
# APIエンドポイント
# ---------------------------------------------------------------------------

@app.get("/demo/reservations/{date}")
async def get_reservations(date: str):
    """指定日の予約一覧を返す"""
    validated_date = _validate_date(date)
    reservations = generate_mock_reservations(validated_date)
    return {
        "date": validated_date,
        "count": len(reservations),
        "reservations": reservations,
    }


@app.get("/demo/available-slots/{date}")
async def get_available_slots_api(date: str):
    """指定日の空き枠一覧を返す"""
    validated_date = _validate_date(date)
    slots = get_available_slots(validated_date)
    return {
        "date": validated_date,
        "count": len(slots),
        "slots": slots,
    }


@app.get("/demo/schedule-grid/{date}")
async def get_schedule_grid(date: str):
    """フロントエンド表示用スケジュールグリッドを返す"""
    validated_date = _validate_date(date)
    return build_schedule_grid(validated_date)


@app.get("/demo/staff")
async def get_staff():
    """スタッフ一覧を返す"""
    return {"staff": get_staff_list()}


@app.get("/demo/menus")
async def get_menus():
    """メニュー一覧を返す"""
    return {"menus": get_menu_list()}


@app.post("/demo/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """チャットボットのシミュレーション"""
    state = req.session_state or {"step": "greeting"}
    if req.date:
        state["date"] = _validate_date(req.date)
    elif "date" not in state:
        state["date"] = _today_jst()

    reply, next_state, slots, confirmed = _chatbot_reply(req.message, state)
    return ChatResponse(
        reply=reply,
        available_slots=slots,
        booking_confirmed=confirmed,
        next_state=next_state,
    )


class BookingRequest(BaseModel):
    date: str
    staff_name: str
    start_time: str
    customer_name: str = "WEB予約"
    menu: str = "初診・検診"
    duration_min: int = 30


@app.post("/demo/book")
async def book_slot(req: BookingRequest):
    """デモ予約を直接作成（グリッドの空き枠クリック用）"""
    booking = add_demo_booking(
        date=_validate_date(req.date),
        staff_name=req.staff_name,
        start_time=req.start_time,
        customer_name=req.customer_name,
        menu=req.menu,
        duration_min=req.duration_min,
    )
    if booking is None:
        raise HTTPException(status_code=409, detail="この枠は既に予約済みです")
    return {"success": True, "booking": booking}


@app.post("/demo/reset")
async def reset_demo():
    """デモ予約をリセット（プレゼンやり直し用）"""
    clear_demo_bookings()
    return {"success": True, "message": "デモ予約をリセットしました"}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "mode": "demo",
        "demo_bookings": get_demo_bookings_count(),
        "timestamp": datetime.now(JST).isoformat(),
    }


# ---------------------------------------------------------------------------
# デモHTML（シングルページUI）
# ---------------------------------------------------------------------------

DEMO_HTML = """<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>よやくらく AIデモ - 〇〇歯科クリニック</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --brand-blue:    #2a7fc1;
      --brand-teal:    #1a9f8a;
      --brand-light:   #e8f4fb;
      --available-bg:  #e6f7f4;
      --available-fg:  #0e7b68;
      --available-bd:  #9fd8ce;
      --booked-bg:     #fce9e9;
      --booked-fg:     #b83232;
      --booked-bd:     #f0b8b8;
      --lunch-bg:      #fef9ec;
      --lunch-fg:      #c27a00;
      --lunch-bd:      #f5d98a;
      --sidebar-w:     400px;
      --header-h:      64px;
      --footer-h:      36px;
      --radius:        10px;
      --shadow-sm:     0 1px 4px rgba(0,0,0,.08);
      --shadow-md:     0 4px 16px rgba(0,0,0,.10);
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI",
                   "Meiryo", sans-serif;
      background: #f0f4f8;
      color: #1e2e3d;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ===== TOP HEADER ===== */
    .top-header {
      height: var(--header-h);
      background: linear-gradient(100deg, var(--brand-blue) 0%, var(--brand-teal) 100%);
      color: white;
      padding: 0 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 10px rgba(0,0,0,.18);
      flex-shrink: 0;
      position: relative;
      z-index: 10;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .header-logo {
      width: 38px;
      height: 38px;
      background: rgba(255,255,255,.18);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    .header-titles { display: flex; flex-direction: column; }

    .header-brand {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: .12em;
      opacity: .85;
      text-transform: uppercase;
    }

    .header-clinic {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: .04em;
      line-height: 1.2;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .demo-badge {
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.35);
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .08em;
    }

    .status-pill {
      background: rgba(255,255,255,.15);
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #6ef079;
      box-shadow: 0 0 6px #6ef079;
    }

    /* ===== MAIN LAYOUT ===== */
    .main-layout {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr var(--sidebar-w);
      min-height: 0;
      overflow: hidden;
    }

    /* ===== SCHEDULE PANEL ===== */
    .schedule-panel {
      background: white;
      border-right: 1px solid #d8e4ee;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .schedule-toolbar {
      padding: 14px 20px 10px;
      border-bottom: 1px solid #e8eef4;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
      background: #f7fafd;
    }

    .schedule-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--brand-blue);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .date-nav-block {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 0;
      border: 1px solid #c8d8e8;
      border-radius: 8px;
      overflow: hidden;
      background: white;
      box-shadow: var(--shadow-sm);
    }

    .date-nav-btn {
      background: transparent;
      border: none;
      padding: 7px 14px;
      cursor: pointer;
      font-size: 15px;
      color: var(--brand-blue);
      transition: background .15s;
      line-height: 1;
    }
    .date-nav-btn:hover { background: var(--brand-light); }

    .date-display-block {
      padding: 7px 16px;
      font-size: 13px;
      font-weight: 700;
      color: #1e2e3d;
      border-left: 1px solid #c8d8e8;
      border-right: 1px solid #c8d8e8;
      min-width: 130px;
      text-align: center;
      white-space: nowrap;
    }

    .legend-row {
      padding: 8px 20px;
      display: flex;
      align-items: center;
      gap: 18px;
      font-size: 11.5px;
      color: #5a6a7a;
      flex-shrink: 0;
      border-bottom: 1px solid #eef2f6;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .legend-swatch {
      width: 13px;
      height: 13px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .schedule-scroll {
      flex: 1;
      overflow: auto;
      padding: 0 16px 16px;
    }

    /* --- Grid Table --- */
    .schedule-table {
      border-collapse: separate;
      border-spacing: 0;
      font-size: 12px;
      width: 100%;
      min-width: 560px;
    }

    .schedule-table thead th {
      position: sticky;
      top: 0;
      z-index: 3;
      background: #f0f5fb;
      padding: 10px 10px 8px;
      text-align: center;
      font-weight: 700;
      font-size: 12px;
      border-bottom: 2px solid #c8d8e8;
      white-space: nowrap;
    }

    .th-time {
      min-width: 58px;
      color: #7a8fa0;
      font-weight: 600;
      text-align: left !important;
    }

    .schedule-table tbody td {
      padding: 0;
      border: 1px solid #edf1f5;
      height: 30px;
    }

    .time-label {
      padding: 0 10px;
      color: #8aa0b4;
      font-size: 11.5px;
      font-weight: 600;
      background: #f7fafd;
      white-space: nowrap;
      position: sticky;
      left: 0;
      z-index: 2;
      border-right: 2px solid #dde8f0 !important;
    }

    .slot-cell {
      display: block;
      width: 100%;
      height: 100%;
      padding: 4px 7px;
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: filter .12s, opacity .12s;
      line-height: 1.5;
    }

    .slot-cell.available {
      background: var(--available-bg);
      color: var(--available-fg);
      cursor: pointer;
      font-weight: 600;
    }
    .slot-cell.available:hover {
      filter: brightness(.93);
    }

    .slot-cell.booked {
      background: var(--booked-bg);
      color: var(--booked-fg);
      cursor: default;
    }

    .slot-cell.new-booking {
      background: linear-gradient(135deg, #d4f5e9, #b0eed6);
      color: #0a6847;
      border: 2px solid #2ec486;
      font-weight: 700;
      animation: pulseNew 2s ease-in-out 3;
    }

    @keyframes pulseNew {
      0%, 100% { box-shadow: none; }
      50% { box-shadow: inset 0 0 8px rgba(46,196,134,.35), 0 0 12px rgba(46,196,134,.25); }
    }

    .slot-cell.booked-continuation {
      background: var(--booked-bg);
      opacity: .45;
      cursor: default;
    }

    .slot-cell.lunch {
      background: var(--lunch-bg);
      color: var(--lunch-fg);
      font-size: 10.5px;
      font-style: italic;
      cursor: default;
    }

    /* ===== CHAT SIDEBAR ===== */
    .chat-panel {
      display: flex;
      flex-direction: column;
      background: #f4f7fa;
      overflow: hidden;
    }

    .chat-header {
      padding: 14px 16px;
      background: white;
      border-bottom: 1px solid #dce8f0;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
      box-shadow: var(--shadow-sm);
    }

    .chat-avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-blue), var(--brand-teal));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(42,127,193,.35);
    }

    .chat-header-info { flex: 1; }
    .chat-header-info h3 {
      font-size: 14px;
      font-weight: 700;
      color: #1e2e3d;
    }
    .chat-header-info p {
      font-size: 11px;
      color: var(--brand-teal);
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 1px;
    }

    .chat-online-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--brand-teal);
      display: inline-block;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      scroll-behavior: smooth;
    }

    .message { display: flex; gap: 8px; max-width: 100%; }
    .message.bot { align-items: flex-start; }
    .message.user { flex-direction: row-reverse; }

    .msg-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-blue), var(--brand-teal));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 15px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .msg-body { display: flex; flex-direction: column; gap: 4px; max-width: 82%; }
    .message.user .msg-body { align-items: flex-end; }

    .message-bubble {
      padding: 10px 14px;
      border-radius: 4px 16px 16px 16px;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      box-shadow: var(--shadow-sm);
    }

    .message.bot .message-bubble {
      background: white;
      color: #1e2e3d;
      border: 1px solid #dce8f0;
    }

    .message.user .message-bubble {
      background: linear-gradient(135deg, var(--brand-blue), var(--brand-teal));
      color: white;
      border-radius: 16px 4px 16px 16px;
    }

    .confirmed-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: linear-gradient(90deg, #0e9e7e, #16b99b);
      color: white;
      border-radius: 20px;
      padding: 4px 12px;
      font-size: 11.5px;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(14,158,126,.3);
    }

    .slots-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }

    .slot-chip {
      background: var(--available-bg);
      color: var(--available-fg);
      border: 1px solid var(--available-bd);
      border-radius: 20px;
      padding: 4px 11px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s, color .15s, transform .1s;
    }
    .slot-chip:hover {
      background: var(--brand-teal);
      color: white;
      border-color: var(--brand-teal);
      transform: translateY(-1px);
    }

    /* Typing animation */
    .typing-indicator {
      display: inline-flex;
      gap: 4px;
      padding: 10px 14px;
      background: white;
      border: 1px solid #dce8f0;
      border-radius: 4px 16px 16px 16px;
      box-shadow: var(--shadow-sm);
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #a0b4c4;
      animation: typingBounce 1.3s infinite ease-in-out;
    }
    .typing-dot:nth-child(2) { animation-delay: .2s; }
    .typing-dot:nth-child(3) { animation-delay: .4s; }

    @keyframes typingBounce {
      0%, 55%, 100% { transform: translateY(0); opacity: .5; }
      28% { transform: translateY(-7px); opacity: 1; }
    }

    /* Quick replies */
    .quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 14px;
      border-top: 1px solid #e4edf5;
      background: white;
      flex-shrink: 0;
    }

    .quick-reply {
      background: var(--brand-light);
      color: var(--brand-blue);
      border: 1px solid #b8d4e8;
      border-radius: 16px;
      padding: 5px 13px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s, color .15s;
      font-family: inherit;
    }
    .quick-reply:hover { background: var(--brand-blue); color: white; border-color: var(--brand-blue); }

    /* Chat input */
    .chat-input-area {
      padding: 10px 14px 12px;
      background: white;
      border-top: 1px solid #dce8f0;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }

    .chat-input {
      flex: 1;
      border: 1.5px solid #c8d8e8;
      border-radius: 22px;
      padding: 9px 16px;
      font-size: 13px;
      outline: none;
      font-family: inherit;
      background: #f7fafd;
      color: #1e2e3d;
      transition: border-color .2s, box-shadow .2s;
    }
    .chat-input:focus {
      border-color: var(--brand-blue);
      box-shadow: 0 0 0 3px rgba(42,127,193,.12);
      background: white;
    }
    .chat-input::placeholder { color: #9ab0c0; }

    .send-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-blue), var(--brand-teal));
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(42,127,193,.4);
      transition: transform .15s, box-shadow .15s;
    }
    .send-btn:hover {
      transform: scale(1.07);
      box-shadow: 0 4px 12px rgba(42,127,193,.5);
    }
    .send-btn:active { transform: scale(.96); }

    /* ===== FOOTER ===== */
    .footer {
      height: var(--footer-h);
      background: #1a2a3a;
      color: rgba(255,255,255,.55);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11.5px;
      letter-spacing: .04em;
      flex-shrink: 0;
    }

    .footer strong { color: rgba(255,255,255,.85); font-weight: 600; }

    /* ===== SCROLLBAR ===== */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #c0d0dc; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #a0b4c4; }
  </style>
</head>
<body>

<!-- ===== TOP HEADER ===== -->
<header class="top-header">
  <div class="header-left">
    <div class="header-logo">&#x1F9B7;</div>
    <div class="header-titles">
      <span class="header-brand">よやくらく AI Demo</span>
      <span class="header-clinic">〇〇歯科クリニック</span>
    </div>
  </div>
  <div class="header-right">
    <div class="status-pill">
      <span class="status-dot"></span>
      <span>24時間対応中</span>
    </div>
    <span class="demo-badge" onclick="resetDemo()" style="cursor:pointer;" title="デモ予約をリセット">&#x21BB; RESET</span>
  </div>
</header>

<!-- ===== MAIN LAYOUT ===== -->
<div class="main-layout">

  <!-- ===== SCHEDULE PANEL ===== -->
  <div class="schedule-panel">
    <div class="schedule-toolbar">
      <div class="schedule-title">
        <span>&#x1F4C5;</span>
        <span>診療スケジュール</span>
      </div>
      <div class="date-nav-block">
        <button class="date-nav-btn" onclick="changeDate(-1)" title="前日">&#8249;</button>
        <div class="date-display-block" id="dateDisplay">読み込み中...</div>
        <button class="date-nav-btn" onclick="changeDate(1)" title="翌日">&#8250;</button>
      </div>
    </div>

    <div class="legend-row">
      <div class="legend-item">
        <div class="legend-swatch" style="background:var(--available-bg);border:1px solid var(--available-bd);"></div>
        <span>空き枠（クリックで予約）</span>
      </div>
      <div class="legend-item">
        <div class="legend-swatch" style="background:var(--booked-bg);border:1px solid var(--booked-bd);"></div>
        <span>予約済み</span>
      </div>
      <div class="legend-item">
        <div class="legend-swatch" style="background:linear-gradient(135deg,#d4f5e9,#b0eed6);border:2px solid #2ec486;"></div>
        <span>今回の予約（AI受付）</span>
      </div>
      <div class="legend-item">
        <div class="legend-swatch" style="background:var(--lunch-bg);border:1px solid var(--lunch-bd);"></div>
        <span>昼休み</span>
      </div>
    </div>

    <div class="schedule-scroll">
      <table class="schedule-table" id="scheduleTable">
        <thead id="scheduleHead"></thead>
        <tbody id="scheduleBody"></tbody>
      </table>
    </div>
  </div>

  <!-- ===== CHAT SIDEBAR ===== -->
  <div class="chat-panel">
    <div class="chat-header">
      <div class="chat-avatar">&#x1FA7A;</div>
      <div class="chat-header-info">
        <h3>〇〇歯科 AI 受付</h3>
        <p><span class="chat-online-dot"></span> オンライン対応中</p>
      </div>
    </div>

    <div class="chat-messages" id="chatMessages"></div>

    <div class="quick-replies" id="quickReplies">
      <button class="quick-reply" onclick="sendQuick('今日の空きを教えてください')">今日の空きを確認</button>
      <button class="quick-reply" onclick="sendQuick('明日予約したい')">明日予約したい</button>
      <button class="quick-reply" onclick="sendQuick('田中さんの空き時間は？')">田中先生の空き</button>
      <button class="quick-reply" onclick="sendQuick('10時に予約したい')">10時に予約</button>
    </div>

    <div class="chat-input-area">
      <input
        type="text"
        class="chat-input"
        id="chatInput"
        placeholder="ご希望の日時をお知らせください…"
        onkeydown="if(event.key==='Enter')sendMessage()"
        autocomplete="off"
      >
      <button class="send-btn" onclick="sendMessage()" title="送信">&#10148;</button>
    </div>
  </div>

</div>

<!-- ===== FOOTER ===== -->
<footer class="footer">
  Powered by <strong>&nbsp;よやくらく&nbsp;</strong> ── 医療機関向け AI 予約システム
</footer>

<script>
  const API_BASE = '';
  let currentDate = new Date().toISOString().slice(0, 10);
  let sessionState = { step: 'greeting' };
  let isTyping = false;

  // --- Date helpers ---
  function changeDate(delta) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta);
    currentDate = d.toISOString().slice(0, 10);
    loadSchedule(currentDate);
  }

  function formatDateJP(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayColors = { 0: '#e05050', 6: '#3a7fcc' };
    const day = d.getDay();
    const dayLabel = days[day];
    const color = dayColors[day] || '';
    const colorAttr = color ? ` style="color:${color}"` : '';
    return `${d.getMonth() + 1}月${d.getDate()}日<span${colorAttr}>（${dayLabel}）</span>`;
  }

  // --- Schedule ---
  async function loadSchedule(date) {
    document.getElementById('dateDisplay').innerHTML = formatDateJP(date);
    try {
      const res = await fetch(`${API_BASE}/demo/schedule-grid/${date}`);
      const data = await res.json();
      renderSchedule(data);
    } catch (e) {
      document.getElementById('scheduleBody').innerHTML =
        '<tr><td colspan="99" style="text-align:center;padding:20px;color:#a0b4c4;">読み込みに失敗しました</td></tr>';
    }
  }

  function renderSchedule(data) {
    const head = document.getElementById('scheduleHead');
    const body = document.getElementById('scheduleBody');

    // Header row
    head.innerHTML = '<tr>' +
      '<th class="th-time">時刻</th>' +
      data.staff.map(s =>
        `<th style="color:${s.color}">${s.name.replace(' ', '<br>')}</th>`
      ).join('') +
      '</tr>';

    // Data rows
    body.innerHTML = data.time_slots.map(slot => {
      const cells = data.staff.map(s => {
        const cell = data.grid[s.id] && data.grid[s.id][slot];
        if (!cell) return '<td></td>';

        let cls = 'available';
        let label = '● 空き';
        let titleAttr = '';

        if (cell.status === 'booked') {
          cls = cell.is_new_booking ? 'new-booking' : 'booked';
          label = cell.customer_name || '予約済み';
          const menu = cell.menu || '';
          const end  = cell.end_time || '';
          titleAttr = menu ? ` title="${menu}  〜${end}"` : '';
          if (cell.is_new_booking) {
            label = '★ ' + label;
          } else if (menu) {
            label += ` (${menu})`;
          }
        } else if (cell.status === 'booked_continuation') {
          cls = 'booked-continuation';
          label = '';
        } else if (cell.status === 'lunch') {
          cls = 'lunch';
          label = '─ 休憩 ─';
        }

        const onclick = cell.status === 'available'
          ? `onclick="slotClicked('${s.name}', '${slot}')"`
          : '';

        return `<td><span class="slot-cell ${cls}" ${onclick}${titleAttr}>${label}</span></td>`;
      }).join('');

      return `<tr><td class="time-label">${slot}</td>${cells}</tr>`;
    }).join('');
  }

  function slotClicked(staffName, time) {
    const msg = `${staffName}さんの${time}に予約したいです`;
    document.getElementById('chatInput').value = msg;
    sendMessage();
  }

  // --- Chat ---
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function addMessage(role, text, slots, confirmed) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message ${role}`;

    if (role === 'bot') {
      div.innerHTML = `
        <div class="msg-avatar">&#x1FA7A;</div>
        <div class="msg-body">
          <div class="message-bubble">${escapeHtml(text)}</div>
          ${confirmed ? '<div class="confirmed-badge">&#x2713;&nbsp;予約が確定しました</div>' : ''}
          ${slots && slots.length > 0 ? renderSlotChips(slots) : ''}
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="msg-body">
          <div class="message-bubble">${escapeHtml(text)}</div>
        </div>
      `;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function renderSlotChips(slots) {
    const byStaff = {};
    for (const s of slots) {
      if (!byStaff[s.staff_name]) byStaff[s.staff_name] = [];
      if (byStaff[s.staff_name].length < 3) byStaff[s.staff_name].push(s);
    }
    const chips = Object.values(byStaff).flat().slice(0, 9);
    if (chips.length === 0) return '';

    return '<div class="slots-chips">' +
      chips.map(s =>
        `<span class="slot-chip" onclick="slotChipClicked('${s.staff_name}', '${s.start_time}')">` +
        `${s.staff_name} ${s.start_time}</span>`
      ).join('') +
      '</div>';
  }

  function slotChipClicked(staffName, time) {
    const msg = `${staffName}さんの${time}でお願いします`;
    document.getElementById('chatInput').value = msg;
    sendMessage();
  }

  function showTyping() {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'message bot';
    div.id = 'typingIndicator';
    div.innerHTML = `
      <div class="msg-avatar">&#x1FA7A;</div>
      <div class="msg-body">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || isTyping) return;

    input.value = '';
    addMessage('user', text);
    isTyping = true;
    showTyping();

    await new Promise(r => setTimeout(r, 500 + Math.random() * 350));

    try {
      const res = await fetch(`${API_BASE}/demo/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          date: currentDate,
          session_state: sessionState,
        }),
      });
      const data = await res.json();
      hideTyping();
      addMessage('bot', data.reply, data.available_slots, data.booking_confirmed);
      sessionState = data.next_state || sessionState;
      if (data.booking_confirmed) {
        setTimeout(() => loadSchedule(currentDate), 900);
      }
    } catch (_) {
      hideTyping();
      addMessage('bot', '通信エラーが発生しました。もう一度お試しください。');
    } finally {
      isTyping = false;
    }
  }

  function sendQuick(text) {
    document.getElementById('chatInput').value = text;
    sendMessage();
  }

  // --- Reset demo bookings ---
  async function resetDemo() {
    if (!confirm('デモ予約をリセットしますか？')) return;
    try {
      await fetch(`${API_BASE}/demo/reset`, { method: 'POST' });
      sessionState = { step: 'greeting' };
      document.getElementById('chatMessages').innerHTML = '';
      addMessage('bot',
        'デモ予約をリセットしました。\\n新しいご予約をお試しください。',
        null, false
      );
      loadSchedule(currentDate);
    } catch(_) {}
  }

  // --- Init ---
  window.addEventListener('load', () => {
    loadSchedule(currentDate);
    addMessage('bot',
      'こんにちは！〇〇歯科クリニックのAI受付です。\\n\\n' +
      '診察のご予約を24時間365日承っております。\\n' +
      'ご希望の日時・担当医師をお気軽にお知らせください。\\n\\n' +
      '左のスケジュール表の「空き枠」をクリックしてもご予約いただけます。',
      null, false
    );
  });
</script>

</body>
</html>"""


@app.get("/demo", response_class=HTMLResponse)
async def demo_page():
    """デモUIページ（シングルページHTML）"""
    return HTMLResponse(content=DEMO_HTML)


# ---------------------------------------------------------------------------
# エントリーポイント
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "scrapers.demo_server:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
    )
