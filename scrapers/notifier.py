"""
CAPTCHA検知・エラー通知

CAPTCHAが検知された場合やスクレイピングエラーが発生した場合に
管理者へ通知を送る。

通知チャネル:
- LINE Notify（推奨: 即時性が高い）
- メール（Resend API）
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx

from scrapers.config import NOTIFY_EMAIL, NOTIFY_LINE_TOKEN

logger = logging.getLogger(__name__)


async def notify_captcha(
    scraper_name: str,
    screenshot_path: Optional[Path] = None,
) -> None:
    """CAPTCHA検知を管理者に通知"""
    message = (
        f"[よやくらく] CAPTCHA検知\n"
        f"スクレイパー: {scraper_name}\n"
        f"時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"対応: Cookie再取得が必要です\n"
        f"手順: python main.py --relogin {scraper_name}"
    )

    await _send_line_notify(message)
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
        f"時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )

    await _send_line_notify(message)
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
        await _send_line_notify(message)

    logger.info(f"同期結果: synced={total_synced}, errors={total_errors}")


# ------------------------------------------------------------------
# LINE Notify
# ------------------------------------------------------------------

async def _send_line_notify(message: str) -> bool:
    """LINE Notifyでメッセージ送信"""
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
            else:
                logger.error(f"LINE Notify送信失敗: {resp.status_code}")
                return False

    except Exception as e:
        logger.error(f"LINE Notify送信エラー: {e}")
        return False
