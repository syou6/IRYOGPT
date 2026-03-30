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
    build_schedule_grid,
    generate_mock_reservations,
    get_available_slots,
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
            date_display = datetime.strptime(target_date, "%Y-%m-%d").strftime("%-m月%-d日")
            reply = (
                f"予約が完了しました！\n\n"
                f"日時: {date_display} {selected_time}〜\n"
                f"担当: {selected_staff}\n\n"
                "ご来店をお待ちしております。\n"
                "変更・キャンセルのご連絡はお電話にてお願いいたします。"
            )
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
            "新たに予約のご希望がございましたら、いつでもお申し付けください。",
            new_state,
            None,
            False,
        )

    # ---- フォールバック ----
    return (
        "ご予約のご希望でしょうか？\n"
        "「明日の午後に予約したい」のようにお気軽にお申し付けください。",
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


@app.get("/health")
async def health():
    return {"status": "ok", "mode": "demo", "timestamp": datetime.now(JST).isoformat()}


# ---------------------------------------------------------------------------
# デモHTML（シングルページUI）
# ---------------------------------------------------------------------------

DEMO_HTML = """<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>よやくらく デモ - サロン予約AIチャット</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic Pro", sans-serif;
      background: #f5f6fa;
      color: #2d3436;
      min-height: 100vh;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    header h1 { font-size: 20px; font-weight: 700; letter-spacing: 0.05em; }
    header .badge {
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 12px;
      padding: 4px 12px;
      font-size: 12px;
    }

    .container {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 0;
      height: calc(100vh - 60px);
    }

    /* --- Schedule Panel --- */
    .schedule-panel {
      overflow-y: auto;
      padding: 20px;
      background: white;
      border-right: 1px solid #e0e0e0;
    }

    .schedule-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .schedule-header h2 { font-size: 16px; font-weight: 600; }

    .date-nav {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    .date-nav button {
      background: #f0f0f0;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.2s;
    }
    .date-nav button:hover { background: #ddd; }

    .date-display {
      font-weight: 600;
      font-size: 14px;
      min-width: 100px;
      text-align: center;
    }

    .legend {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
      font-size: 12px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    /* --- Schedule Table --- */
    .schedule-table-wrapper { overflow-x: auto; }

    .schedule-table {
      border-collapse: collapse;
      min-width: 600px;
      font-size: 12px;
    }

    .schedule-table th {
      padding: 8px 12px;
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      font-weight: 600;
      white-space: nowrap;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .schedule-table td {
      padding: 0;
      border: 1px solid #e8e8e8;
      height: 28px;
      min-width: 120px;
    }

    .time-cell {
      padding: 4px 8px;
      background: #f8f9fa;
      font-weight: 500;
      color: #666;
      white-space: nowrap;
      min-width: 60px;
      position: sticky;
      left: 0;
      z-index: 1;
    }

    .slot {
      display: block;
      width: 100%;
      height: 100%;
      padding: 3px 6px;
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: opacity 0.15s;
    }

    .slot.available {
      background: #e8f8f0;
      color: #2d7a4f;
      cursor: pointer;
    }
    .slot.available:hover { background: #c8f0d8; opacity: 0.9; }

    .slot.booked {
      background: #ffeaea;
      color: #c0392b;
      cursor: default;
    }

    .slot.booked-continuation {
      background: #ffeaea;
      opacity: 0.5;
    }

    .slot.lunch {
      background: #fff8e1;
      color: #f39c12;
      font-size: 10px;
    }

    /* --- Chat Panel --- */
    .chat-panel {
      display: flex;
      flex-direction: column;
      background: #fafafa;
    }

    .chat-header {
      padding: 14px 16px;
      background: white;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .chat-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
    }

    .chat-header-info h3 { font-size: 14px; font-weight: 600; }
    .chat-header-info p { font-size: 11px; color: #27ae60; }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      display: flex;
      gap: 8px;
      max-width: 100%;
    }

    .message.bot { align-items: flex-start; }
    .message.user { flex-direction: row-reverse; }

    .message-bubble {
      max-width: 78%;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message.bot .message-bubble {
      background: white;
      border: 1px solid #e8e8e8;
      border-radius: 4px 16px 16px 16px;
    }

    .message.user .message-bubble {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border-radius: 16px 4px 16px 16px;
    }

    .message-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      flex-shrink: 0;
    }

    .slots-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .slot-chip {
      background: #e8f8f0;
      color: #2d7a4f;
      border: 1px solid #a8d8b8;
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .slot-chip:hover {
      background: #2d7a4f;
      color: white;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 10px 14px;
      background: white;
      border: 1px solid #e8e8e8;
      border-radius: 4px 16px 16px 16px;
      width: fit-content;
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #aaa;
      animation: typing 1.2s infinite;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
      30% { transform: translateY(-6px); opacity: 1; }
    }

    .chat-input-area {
      padding: 12px 16px;
      background: white;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 8px;
    }

    .chat-input {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 13px;
      outline: none;
      font-family: inherit;
      transition: border-color 0.2s;
    }
    .chat-input:focus { border-color: #667eea; }

    .send-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: transform 0.15s;
    }
    .send-btn:hover { transform: scale(1.08); }

    .quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 16px;
      border-top: 1px solid #f0f0f0;
      background: white;
    }

    .quick-reply {
      background: #f0f0f8;
      color: #667eea;
      border: 1px solid #d0d0f0;
      border-radius: 16px;
      padding: 4px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .quick-reply:hover { background: #667eea; color: white; }

    .confirmed-badge {
      display: inline-block;
      background: #27ae60;
      color: white;
      border-radius: 12px;
      padding: 3px 10px;
      font-size: 11px;
      margin-top: 6px;
    }
  </style>
</head>
<body>

<header>
  <h1>よやくらく ── サロン予約AIデモ</h1>
  <span class="badge">DEMO MODE</span>
</header>

<div class="container">

  <!-- Schedule Panel -->
  <div class="schedule-panel">
    <div class="schedule-header">
      <h2>スタッフスケジュール</h2>
      <div class="date-nav">
        <button onclick="changeDate(-1)">&#8249; 前日</button>
        <span class="date-display" id="dateDisplay">読み込み中...</span>
        <button onclick="changeDate(1)">翌日 &#8250;</button>
      </div>
    </div>

    <div class="legend">
      <div class="legend-item">
        <div class="legend-dot" style="background:#e8f8f0;border:1px solid #a8d8b8;"></div>
        <span>空き</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background:#ffeaea;border:1px solid #f5c6c6;"></div>
        <span>予約済み</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background:#fff8e1;border:1px solid #ffe082;"></div>
        <span>昼休み</span>
      </div>
    </div>

    <div class="schedule-table-wrapper">
      <table class="schedule-table" id="scheduleTable">
        <thead id="scheduleHead"></thead>
        <tbody id="scheduleBody"></tbody>
      </table>
    </div>
  </div>

  <!-- Chat Panel -->
  <div class="chat-panel">
    <div class="chat-header">
      <div class="chat-avatar">&#x1F916;</div>
      <div class="chat-header-info">
        <h3>よやくらく AI</h3>
        <p>● オンライン</p>
      </div>
    </div>

    <div class="chat-messages" id="chatMessages"></div>

    <div class="quick-replies" id="quickReplies">
      <button class="quick-reply" onclick="sendQuick('今日の空きを教えて')">今日の空きを見る</button>
      <button class="quick-reply" onclick="sendQuick('明日予約したい')">明日予約したい</button>
      <button class="quick-reply" onclick="sendQuick('田中さんの空き時間は？')">田中さんの空き</button>
      <button class="quick-reply" onclick="sendQuick('10時に予約したい')">10時に予約</button>
    </div>

    <div class="chat-input-area">
      <input
        type="text"
        class="chat-input"
        id="chatInput"
        placeholder="メッセージを入力..."
        onkeydown="if(event.key==='Enter')sendMessage()"
      >
      <button class="send-btn" onclick="sendMessage()">&#10148;</button>
    </div>
  </div>

</div>

<script>
  const API_BASE = '';
  let currentDate = new Date().toISOString().slice(0, 10);
  let sessionState = { step: 'greeting' };
  let isTyping = false;

  // --- Date navigation ---
  function changeDate(delta) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta);
    currentDate = d.toISOString().slice(0, 10);
    loadSchedule(currentDate);
  }

  function formatDateJP(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
  }

  // --- Schedule table ---
  async function loadSchedule(date) {
    document.getElementById('dateDisplay').textContent = formatDateJP(date);
    try {
      const res = await fetch(`${API_BASE}/demo/schedule-grid/${date}`);
      const data = await res.json();
      renderSchedule(data);
    } catch (e) {
      console.error('スケジュール取得失敗', e);
    }
  }

  function renderSchedule(data) {
    const head = document.getElementById('scheduleHead');
    const body = document.getElementById('scheduleBody');

    // Header
    head.innerHTML = '<tr>' +
      '<th>時刻</th>' +
      data.staff.map(s => `<th style="color:${s.color}">${s.name}</th>`).join('') +
      '</tr>';

    // Body
    body.innerHTML = data.time_slots.map(slot => {
      const cells = data.staff.map(s => {
        const cell = data.grid[s.id][slot];
        if (!cell) return '<td></td>';

        let cls = 'available';
        let label = '空き';

        if (cell.status === 'booked') {
          cls = 'booked';
          label = cell.customer_name || '予約済み';
          if (cell.menu) label += ` (${cell.menu})`;
        } else if (cell.status === 'booked_continuation') {
          cls = 'booked-continuation';
          label = '';
        } else if (cell.status === 'lunch') {
          cls = 'lunch';
          label = '昼休み';
        }

        const onclick = cell.status === 'available'
          ? `onclick="slotClicked('${s.name}', '${slot}')"`
          : '';

        return `<td><span class="slot ${cls}" ${onclick} title="${cell.menu || ''}">${label}</span></td>`;
      }).join('');

      return `<tr><td class="time-cell">${slot}</td>${cells}</tr>`;
    }).join('');
  }

  function slotClicked(staffName, time) {
    const msg = `${staffName}さんの${time}に予約したい`;
    document.getElementById('chatInput').value = msg;
    sendMessage();
  }

  // --- Chat ---
  function addMessage(role, text, slots, confirmed) {
    const messages = document.getElementById('chatMessages');

    const div = document.createElement('div');
    div.className = `message ${role}`;

    if (role === 'bot') {
      div.innerHTML = `
        <div class="message-avatar">&#x1F916;</div>
        <div>
          <div class="message-bubble">${escapeHtml(text)}</div>
          ${confirmed ? '<div class="confirmed-badge">&#x2713; 予約確定</div>' : ''}
          ${slots && slots.length > 0 ? renderSlotChips(slots) : ''}
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="message-bubble">${escapeHtml(text)}</div>
      `;
    }

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function renderSlotChips(slots) {
    // スタッフ別に最初の3枠だけ表示
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
    const messages = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'message bot';
    div.id = 'typingIndicator';
    div.innerHTML = `
      <div class="message-avatar">&#x1F916;</div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
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

    // 500ms の疑似ディレイ（UXのため）
    await new Promise(r => setTimeout(r, 500 + Math.random() * 400));

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

      // 予約確定したらスケジュールを再読み込み
      if (data.booking_confirmed) {
        setTimeout(() => loadSchedule(currentDate), 800);
      }
    } catch (e) {
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

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- Init ---
  window.addEventListener('load', () => {
    loadSchedule(currentDate);
    addMessage('bot',
      'こんにちは！予約AIアシスタントです。\\n\\nご希望の日時・スタッフをお気軽にお知らせください。\\n左のスケジュール表の「空き」をクリックしても予約できます。',
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
