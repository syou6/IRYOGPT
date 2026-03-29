"""
統合予約同期サービス

サロンボード・ミニモの予約データを統合して Supabase に同期する。
よやくらく側はこのDBを参照して空き枠を計算する。

テーブル設計:
  external_reservations:
    - id (uuid)
    - site_id (uuid, FK sites) -- よやくらくのサイトID
    - source ('salonboard' | 'minimo')
    - external_id (text) -- 外部システムの予約ID
    - date (date)
    - start_time (time)
    - end_time (time)
    - staff_name (text)
    - customer_name (text)
    - menu (text)
    - status ('confirmed' | 'cancelled' | 'completed')
    - raw_data (jsonb)
    - synced_at (timestamptz)
    - created_at (timestamptz)
"""

import json
import logging
from datetime import datetime
from typing import Optional

import httpx

from scrapers.config import SUPABASE_SERVICE_KEY, SUPABASE_URL

logger = logging.getLogger(__name__)


class SyncService:
    """予約データをSupabaseに同期するサービス"""

    def __init__(self, site_id: str):
        self.site_id = site_id
        self.headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        }
        self.base_url = f"{SUPABASE_URL}/rest/v1"

    async def sync_reservations(
        self, reservations: list[dict], source: str
    ) -> dict:
        """
        予約データをSupabaseに同期（upsert）

        Args:
            reservations: スクレイパーから取得した予約リスト
            source: 'salonboard' or 'minimo'

        Returns:
            {"synced": 件数, "errors": 件数}
        """
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            logger.error("Supabase設定が未設定")
            return {"synced": 0, "errors": 0}

        synced = 0
        errors = 0

        for reservation in reservations:
            try:
                row = {
                    "site_id": self.site_id,
                    "source": source,
                    "external_id": reservation.get("external_id", ""),
                    "date": reservation["date"],
                    "start_time": reservation.get("start_time", ""),
                    "end_time": reservation.get("end_time", ""),
                    "staff_name": reservation.get("staff_name", ""),
                    "customer_name": reservation.get("customer_name", ""),
                    "menu": reservation.get("menu", ""),
                    "status": reservation.get("status", "confirmed"),
                    "raw_data": json.dumps(
                        reservation.get("raw_data", {}), ensure_ascii=False
                    ),
                    "synced_at": datetime.utcnow().isoformat(),
                }

                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        f"{self.base_url}/external_reservations",
                        headers=self.headers,
                        json=row,
                        timeout=10,
                    )

                    if resp.status_code in (200, 201):
                        synced += 1
                    else:
                        logger.error(
                            f"Supabase書き込みエラー: {resp.status_code} {resp.text}"
                        )
                        errors += 1

            except Exception as e:
                logger.error(f"同期エラー: {e}")
                errors += 1

        result = {"synced": synced, "errors": errors}
        logger.info(f"[{source}] 同期結果: {result}")
        return result

    async def get_external_reservations(
        self, date: str, source: Optional[str] = None
    ) -> list[dict]:
        """
        指定日の外部予約を取得

        Args:
            date: 'YYYY-MM-DD'
            source: 'salonboard' or 'minimo' (Noneなら両方)
        """
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            return []

        try:
            params = {
                "site_id": f"eq.{self.site_id}",
                "date": f"eq.{date}",
                "status": "eq.confirmed",
            }
            if source:
                params["source"] = f"eq.{source}"

            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}/external_reservations",
                    headers=self.headers,
                    params=params,
                    timeout=10,
                )

                if resp.status_code == 200:
                    return resp.json()
                else:
                    logger.error(
                        f"外部予約取得エラー: {resp.status_code} {resp.text}"
                    )
                    return []

        except Exception as e:
            logger.error(f"外部予約取得エラー: {e}")
            return []

    async def cleanup_old_reservations(self, days_before: int = 30) -> int:
        """古い予約データを削除"""
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            return 0

        try:
            from datetime import timedelta

            cutoff = (datetime.utcnow() - timedelta(days=days_before)).strftime(
                "%Y-%m-%d"
            )

            async with httpx.AsyncClient() as client:
                resp = await client.delete(
                    f"{self.base_url}/external_reservations",
                    headers=self.headers,
                    params={
                        "site_id": f"eq.{self.site_id}",
                        "date": f"lt.{cutoff}",
                    },
                    timeout=10,
                )

                if resp.status_code in (200, 204):
                    logger.info(f"古い予約データ削除完了（{cutoff}以前）")
                    return 1
                else:
                    logger.error(f"削除エラー: {resp.status_code}")
                    return 0

        except Exception as e:
            logger.error(f"クリーンアップエラー: {e}")
            return 0
