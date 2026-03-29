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
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from scrapers.config import SUPABASE_SERVICE_KEY, SUPABASE_URL

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

# httpx 接続プール設定
_http_client: Optional[httpx.AsyncClient] = None


async def get_http_client() -> httpx.AsyncClient:
    """共有HTTPクライアントを取得（接続プールの再利用）"""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )
    return _http_client


async def close_http_client() -> None:
    """アプリケーション終了時にHTTPクライアントを閉じる"""
    global _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None


class SyncService:
    """予約データをSupabaseに同期するサービス"""

    MAX_RETRIES = 3

    def __init__(self, site_id: str):
        self.site_id = site_id
        self.headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        }
        self.base_url = f"{SUPABASE_URL}/rest/v1"

    async def _request_with_retry(
        self, method: str, url: str, **kwargs
    ) -> Optional[httpx.Response]:
        """リトライ付きHTTPリクエスト"""
        client = await get_http_client()
        last_error = None

        for attempt in range(self.MAX_RETRIES):
            try:
                resp = await getattr(client, method)(
                    url, headers=self.headers, **kwargs
                )
                return resp
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout) as e:
                last_error = e
                if attempt < self.MAX_RETRIES - 1:
                    import asyncio
                    wait = (2 ** attempt) * 0.5
                    logger.warning(
                        f"Supabaseリクエストリトライ ({attempt + 1}/{self.MAX_RETRIES}): {e}"
                    )
                    await asyncio.sleep(wait)

        logger.error(f"Supabaseリクエスト失敗（{self.MAX_RETRIES}回リトライ後）: {last_error}")
        return None

    async def sync_reservations(
        self, reservations: list[dict], source: str
    ) -> dict:
        """
        予約データをSupabaseに同期（upsert）

        バッチ処理: 全予約を1回のリクエストでupsert（パフォーマンス改善）

        Args:
            reservations: スクレイパーから取得した予約リスト
            source: 'salonboard' or 'minimo'

        Returns:
            {"synced": 件数, "errors": 件数}
        """
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            logger.error("Supabase設定が未設定")
            return {"synced": 0, "errors": 0}

        if not reservations:
            return {"synced": 0, "errors": 0}

        now = datetime.now(JST).isoformat()

        # バッチ用の行データを構築
        rows = []
        for reservation in reservations:
            rows.append({
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
                "synced_at": now,
            })

        # バッチupsert
        try:
            resp = await self._request_with_retry(
                "post",
                f"{self.base_url}/external_reservations",
                json=rows,
            )

            if resp is None:
                result = {"synced": 0, "errors": len(reservations)}
            elif resp.status_code in (200, 201):
                result = {"synced": len(reservations), "errors": 0}
            else:
                logger.error(
                    f"Supabaseバッチ書き込みエラー: {resp.status_code} {resp.text}"
                )
                result = {"synced": 0, "errors": len(reservations)}

        except Exception as e:
            logger.error(f"同期エラー: {e}")
            result = {"synced": 0, "errors": len(reservations)}

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

            resp = await self._request_with_retry(
                "get",
                f"{self.base_url}/external_reservations",
                params=params,
            )

            if resp and resp.status_code == 200:
                return resp.json()
            else:
                status = resp.status_code if resp else "N/A"
                logger.error(f"外部予約取得エラー: {status}")
                return []

        except Exception as e:
            logger.error(f"外部予約取得エラー: {e}")
            return []

    async def cleanup_old_reservations(self, days_before: int = 30) -> int:
        """古い予約データを削除"""
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            return 0

        try:
            cutoff = (datetime.now(JST) - timedelta(days=days_before)).strftime(
                "%Y-%m-%d"
            )

            resp = await self._request_with_retry(
                "delete",
                f"{self.base_url}/external_reservations",
                params={
                    "site_id": f"eq.{self.site_id}",
                    "date": f"lt.{cutoff}",
                },
            )

            if resp and resp.status_code in (200, 204):
                logger.info(f"古い予約データ削除完了（{cutoff}以前）")
                return 1
            else:
                status = resp.status_code if resp else "N/A"
                logger.error(f"削除エラー: {status}")
                return 0

        except Exception as e:
            logger.error(f"クリーンアップエラー: {e}")
            return 0
