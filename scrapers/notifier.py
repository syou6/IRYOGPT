"""
CAPTCHA検知・エラー通知

CAPTCHAが検知された場合やスクレイピングエラーが発生した場合に
管理者へ通知を送る。

通知チャネル:
1. LINE Messaging API（推奨）
2. ログのみ（フォールバック）
"""

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from scrapers.config import (
    LINE_ADMIN_USER_ID,
    LINE_CHANNEL_ACCESS_TOKEN,
)

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

# 通知抑制（同じ内容を短時間に連投しない）
_last_notification: dict[str, float] = {}
NOTIFICATION_COOLDOWN = 300  # 5分


async def notify_captcha(
    scraper_name: str,
    screenshot_path: Optional[Path] = None,
) -> None:
    """CAPTCHA検知を管理者に通知"""
    message = (
        f"[よやくらく] CAPTCHA検知\n"
        f"スクレイパー: {scraper_name}\n"
        f"時刻: {datetime.now(JST).strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"対応: POST /resume/{scraper_name}"
    )
    await _send_notification(message, key=f"captcha_{scraper_name}")


async def notify_error(
    scraper_name: str,
    error_message: str,
) -> None:
    """スクレイピングエラーを管理者に通知"""
    message = (
        f"[よやくらく] スクレイピングエラー\n"
        f"スクレイパー: {scraper_name}\n"
        f"エラー: {error_message[:200]}\n"
        f"時刻: {datetime.now(JST).strftime('%Y-%m-%d %H:%M:%S')}"
    )
    await _send_notification(message, key=f"error_{scraper_name}")


async def notify_sync_result(results: dict) -> None:
    """同期結果をログに記録（エラー時のみ通知）"""
    total_synced = sum(r.get("synced", 0) for r in results.values())
    total_errors = sum(r.get("errors", 0) for r in results.values())

    if total_errors > 0:
        message = (
            f"[よやくらく] 同期完了（エラーあり）\n"
            f"同期: {total_synced}件 / エラー: {total_errors}件"
        )
        await _send_notification(message, key="sync_error")

    logger.info(f"同期結果: synced={total_synced}, errors={total_errors}")


# ------------------------------------------------------------------
# 通知ルーター
# ------------------------------------------------------------------

async def _send_notification(message: str, key: str = "") -> bool:
    """利用可能な通知チャネルで送信（クールダウン付き）"""
    import time

    # 同一キーの通知を短時間に繰り返さない
    if key:
        now = time.time()
        last = _last_notification.get(key, 0)
        if now - last < NOTIFICATION_COOLDOWN:
            logger.debug(f"通知抑制中（{key}）")
            return False
        _last_notification[key] = now

    if LINE_CHANNEL_ACCESS_TOKEN and LINE_ADMIN_USER_ID:
        return await _send_line_messaging_api(message)

    logger.warning(f"通知チャネル未設定。メッセージ: {message}")
    return False


# ------------------------------------------------------------------
# LINE Messaging API
# ------------------------------------------------------------------

async def _send_line_messaging_api(message: str) -> bool:
    """LINE Messaging API でプッシュメッセージ送信（共有HTTPクライアント使用）"""
    try:
        from scrapers.sync_service import get_http_client

        client = await get_http_client()
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
            logger.info("LINE通知送信成功")
            return True

        logger.error(f"LINE通知送信失敗: {resp.status_code} {resp.text}")
        return False

    except Exception as e:
        logger.error(f"LINE通知送信エラー: {e}")
        return False
