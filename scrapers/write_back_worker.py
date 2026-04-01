"""
書き戻しワーカー（Outboxパターン）

write_back_queue テーブルからペンディングのタスクを取得し、
SalonBoard/minimoにブラウザ自動化で書き込む。

指数バックオフでリトライ:
  30秒 → 60秒 → 120秒 → 240秒 → 480秒
  5回失敗 → status='manual' + 管理者通知

起動:
  python -m scrapers.write_back_worker --site-id YOUR_SITE_ID
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from scrapers.config import (
    SUPABASE_SERVICE_KEY,
    SUPABASE_URL,
    StoreConfig,
    load_store_configs,
)
from scrapers.notifier import notify_error
from scrapers.salonboard_writer import BookingRequest, SalonBoardWriter

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

POLL_INTERVAL = 30  # 秒
BACKOFF_BASE = 30   # 秒


class WriteBackWorker:
    """write_back_queue を処理するワーカー"""

    def __init__(self, store_config: StoreConfig):
        self.store_config = store_config
        self.site_id = store_config.site_id
        self.sb_writer = SalonBoardWriter.from_store_config(store_config)
        self._running = False
        self._headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self._base_url = f"{SUPABASE_URL}/rest/v1"

    async def start(self) -> None:
        """ワーカーループ開始"""
        self._running = True
        logger.info(f"[write-back] ワーカー開始 (site_id={self.site_id})")

        await self.sb_writer.start_browser()

        try:
            while self._running:
                processed = await self._process_pending()
                if not processed:
                    await asyncio.sleep(POLL_INTERVAL)
        except asyncio.CancelledError:
            logger.info("[write-back] ワーカーキャンセル")
        finally:
            await self.sb_writer.close_browser()

    async def stop(self) -> None:
        self._running = False

    async def _process_pending(self) -> int:
        """ペンディングタスクを1件ずつ処理"""
        tasks = await self._fetch_pending_tasks()
        if not tasks:
            return 0

        count = 0
        for task in tasks:
            await self._process_task(task)
            count += 1
            # タスク間に少し待機（SBへの負荷軽減）
            await asyncio.sleep(2)

        return count

    async def _fetch_pending_tasks(self) -> list[dict]:
        """キューからリトライ可能なタスクを取得"""
        now = datetime.now(JST).isoformat()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self._base_url}/write_back_queue",
                    headers=self._headers,
                    params={
                        "site_id": f"eq.{self.site_id}",
                        "status": "in.(pending,processing)",
                        "next_retry_at": f"lte.{now}",
                        "order": "created_at.asc",
                        "limit": "5",
                    },
                )
                if resp.status_code == 200:
                    return resp.json()
                logger.error(f"[write-back] キュー取得エラー: {resp.status_code}")
                return []
        except Exception as e:
            logger.error(f"[write-back] キュー取得エラー: {e}")
            return []

    async def _process_task(self, task: dict) -> None:
        """1件のタスクを処理"""
        task_id = task["id"]
        platform = task["target_platform"]
        action = task["action"]
        payload = task.get("payload", {})
        attempts = task.get("attempts", 0)
        max_attempts = task.get("max_attempts", 5)

        logger.info(
            f"[write-back] 処理開始: {task_id} ({platform}/{action}, "
            f"試行{attempts + 1}/{max_attempts})"
        )

        # status を processing に更新
        await self._update_task(task_id, {"status": "processing"})

        success = False
        error_msg = None

        try:
            if platform == "salonboard" and action == "create":
                result = await self._write_to_salonboard(payload)
                success = result.success
                error_msg = result.error
            elif platform == "minimo" and action == "block_slot":
                # TODO: minimo書き込み実装
                error_msg = "minimo書き込みは未実装"
            else:
                error_msg = f"未対応のアクション: {platform}/{action}"

        except Exception as e:
            error_msg = str(e)
            logger.error(f"[write-back] 処理エラー: {e}")

        new_attempts = attempts + 1

        if success:
            await self._update_task(task_id, {
                "status": "completed",
                "attempts": new_attempts,
                "completed_at": datetime.now(JST).isoformat(),
            })
            logger.info(f"[write-back] 完了: {task_id}")
        elif new_attempts >= max_attempts:
            await self._update_task(task_id, {
                "status": "manual",
                "attempts": new_attempts,
                "last_error": error_msg,
            })
            logger.error(
                f"[write-back] 最大試行回数超過: {task_id} → 手動対応が必要"
            )
            await notify_error(
                "write-back",
                f"SB書き戻し失敗（{max_attempts}回）: {error_msg}\n"
                f"タスクID: {task_id}\nペイロード: {json.dumps(payload, ensure_ascii=False)[:200]}",
            )
        else:
            # 指数バックオフで次回リトライ
            backoff = BACKOFF_BASE * (2 ** (new_attempts - 1))
            next_retry = datetime.now(JST) + timedelta(seconds=backoff)
            await self._update_task(task_id, {
                "status": "pending",
                "attempts": new_attempts,
                "last_error": error_msg,
                "next_retry_at": next_retry.isoformat(),
            })
            logger.warning(
                f"[write-back] リトライ予定: {task_id} "
                f"({backoff}秒後, 試行{new_attempts}/{max_attempts})"
            )

    async def _write_to_salonboard(self, payload: dict) -> "BookingResult":
        """SalonBoardに予約を書き込む"""
        from scrapers.salonboard_writer import BookingResult

        req = BookingRequest(
            date=payload["date"],
            start_time=payload["start_time"],
            end_time=payload.get("end_time", ""),
            staff_name=payload.get("staff_name", ""),
            customer_name=payload.get("customer_name", "WEB予約"),
            customer_phone=payload.get("customer_phone", ""),
            menu=payload.get("menu", ""),
            duration_min=payload.get("duration_min", 30),
        )
        return await self.sb_writer.create_reservation(req)

    async def _update_task(self, task_id: str, updates: dict) -> None:
        """write_back_queue の行を更新"""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.patch(
                    f"{self._base_url}/write_back_queue",
                    headers=self._headers,
                    params={"id": f"eq.{task_id}"},
                    json=updates,
                )
                if resp.status_code not in (200, 204):
                    logger.error(
                        f"[write-back] タスク更新エラー: {resp.status_code} {resp.text}"
                    )
        except Exception as e:
            logger.error(f"[write-back] タスク更新エラー: {e}")
