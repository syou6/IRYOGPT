"""
CAPTCHA検知・エラー通知

CAPTCHAが検知された場合やスクレイピングエラーが発生した場合に
管理者へ通知を送る。

通知チャネル（優先順）:
1. LINE Messaging API（推奨: LINE Notify は 2025/3/31 に終了済み）
2. LINE Notify（レガシー: 既存トークンがあれば使用）
3. ログのみ（通知チャネル未設定時）
"""

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import httpx

from scrapers.config import NOTIFY_LINE_TOKEN

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

# LINE Messaging API 設定（.envから読み込み）
import os
LINE_CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "")
LINE_ADMIN_USER_ID = os.getenv("LINE_ADMIN_USER_ID", "")


async def notify_captcha(
    scraper_name: str,
    screenshot_path: Optional[Path] = None,
) -> None:
    """CAPTCHA検知を管理者に通知"""
    message = (
        f"[よやくらく] CAPTCHA検知\n"
        f"スクレイパー: {scraper_name}\n"
        f"時刻: {datetime.now(JST).strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"対応: Cookie再取得が必要です\n"
        f"手順: POST /resume/{scraper_name}"
    )

    await _send_notification(message)
    logger.warning(f"CAPTCHA通知送信: {scraper_name}")


async def notify_error(
    scraper_name: str,
    error_message: str,
) -> None:
    """スクレイピングエラーを管理者に通知"""
    message = (
        f"[よやくらく] スクレイピングエラー\n"
        f"スクレイパー: {scraper_name}\n"
        f"エラー: {error_message}\n"
        f"時刻: {datetime.now(JST).strftime('%Y-%m-%d %H:%M:%S')}"
    )

    await _send_notification(message)
    logger.error(f"エラー通知送信: {scraper_name} - {error_message}")


async def notify_sync_result(
    results: dict,
) -> None:
    """同期結果をログに記録（正常時は通知しない）"""
    total_synced = sum(r.get("synced", 0) for r in results.values())
    total_errors = sum(r.get("errors", 0) for r in results.values())

    if total_errors > 0:
        message = (
            f"[よやくらく] 同期完了（エラーあり）\n"
            f"同期: {total_synced}件\n"
            f"エラー: {total_errors}件\n"
            f"詳細: {results}"
        )
        await _send_notification(message)

    logger.info(f"同期結果: synced={total_synced}, errors={total_errors}")


# ------------------------------------------------------------------
# 通知ルーター
# ------------------------------------------------------------------

async def _send_notification(message: str) -> bool:
    """利用可能な通知チャネルで送信"""
    # 1. LINE Messaging API（推奨）
    if LINE_CHANNEL_ACCESS_TOKEN and LINE_ADMIN_USER_ID:
        return await _send_line_messaging_api(message)

    # 2. LINE Notify（レガシー）
    if NOTIFY_LINE_TOKEN:
        return await _send_line_notify(message)

    # 3. ログのみ
    logger.warning(f"通知チャネル未設定。メッセージ: {message}")
    return False


# ------------------------------------------------------------------
# LINE Messaging API（推奨）
# ------------------------------------------------------------------

async def _send_line_messaging_api(message: str) -> bool:
    """LINE Messaging API でプッシュメッセージ送信"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.line.me/v2/bot/message/push",
                headers={
                    "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={
                    "to": LINE_ADMIN_USER_ID,
                    "messages": [
                        {"type": "text", "text": message}
                    ],
                },
                timeout=10,
            )

            if resp.status_code == 200:
                logger.info("LINE Messaging API 送信成功")
                return True
            else:
                logger.error(f"LINE Messaging API 送信失敗: {resp.status_code} {resp.text}")
                return False

    except Exception as e:
        logger.error(f"LINE Messaging API 送信エラー: {e}")
        return False


# ------------------------------------------------------------------
# LINE Notify（レガシー: 2025/3/31 終了済み）
# ------------------------------------------------------------------

async def _send_line_notify(message: str) -> bool:
    """LINE Notifyでメッセージ送信（非推奨: サービス終了済み）"""
    if not NOTIFY_LINE_TOKEN:
        logger.debug("LINE Notify未設定、スキップ")
        return False

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://notify-api.line.me/api/notify",
                headers={"Authorization": f"Bearer {NOTIFY_LINE_TOKEN}"},
                data={"message": message},
                timeout=10,
            )

            if resp.status_code == 200:
                logger.info("LINE Notify送信成功")
                return True
            elif resp.status_code == 401:
                logger.error("LINE Notify認証エラー（サービス終了の可能性）。LINE Messaging APIへの移行を推奨")
                return False
            else:
                logger.error(f"LINE Notify送信失敗: {resp.status_code}")
                return False

    except Exception as e:
        logger.error(f"LINE Notify送信エラー: {e}")
        return False
