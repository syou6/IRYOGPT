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

import asyncio
import hashlib
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from scrapers.config import SUPABASE_SERVICE_KEY, SUPABASE_URL

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

# PostgREST in.() フィルタに安全でない文字
_POSTGREST_UNSAFE_RE = re.compile(r'[(),"]')

# httpx 接続プール設定
_http_client: Optional[httpx.AsyncClient] = None
_http_lock = asyncio.Lock()


async def get_http_client() -> httpx.AsyncClient:
    """共有HTTPクライアントを取得（接続プールの再利用、ロック付き）"""
    global _http_client
    async with _http_lock:
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


def _reservation_hash(reservation: dict) -> str:
    """予約データのコンテンツハッシュを生成（変更検知用）"""
    key_fields = (
        reservation.get("external_id", ""),
        reservation.get("date", ""),
        reservation.get("start_time", ""),
        reservation.get("end_time", ""),
        reservation.get("staff_name", ""),
        reservation.get("customer_name", ""),
        reservation.get("menu", ""),
        reservation.get("status", ""),
    )
    return hashlib.md5("|".join(key_fields).encode()).hexdigest()


class SyncService:
    """予約データをSupabaseに同期するサービス（コンテンツハッシュ差分検知付き）"""

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
        # 前回同期時のハッシュキャッシュ {external_id: content_hash}
        self._last_hashes: dict[str, str] = {}

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
        予約データをSupabaseに同期（コンテンツハッシュ差分検知付き）

        前回と同じデータはスキップし、変更・追加分だけupsert。
        前回あったが今回無い予約はキャンセル扱いでステータス更新。

        Args:
            reservations: スクレイパーから取得した予約リスト
            source: 'salonboard' or 'minimo'

        Returns:
            {"synced": 件数, "skipped": 件数, "cancelled": 件数, "errors": 件数}
        """
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            logger.error("Supabase設定が未設定")
            return {"synced": 0, "skipped": 0, "cancelled": 0, "errors": 0}

        if not reservations:
            # 予約0件: 前回あった予約が全てキャンセルされた可能性
            cancelled = await self._mark_cancelled(source, set(self._last_hashes.keys()))
            self._last_hashes.clear()
            return {"synced": 0, "skipped": 0, "cancelled": cancelled, "errors": 0}

        now = datetime.now(JST).isoformat()

        # 差分検知: 変更があった予約だけ抽出
        current_hashes: dict[str, str] = {}
        changed_rows = []
        skipped = 0

        for reservation in reservations:
            ext_id = reservation.get("external_id", "")
            content_hash = _reservation_hash(reservation)
            current_hashes[ext_id] = content_hash

            # 前回と同じハッシュならスキップ
            if self._last_hashes.get(ext_id) == content_hash:
                skipped += 1
                continue

            changed_rows.append({
                "site_id": self.site_id,
                "source": source,
                "external_id": ext_id,
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

        # キャンセル検知: 前回あったが今回無い予約
        disappeared_ids = set(self._last_hashes.keys()) - set(current_hashes.keys())
        cancelled = await self._mark_cancelled(source, disappeared_ids)

        # ハッシュキャッシュ更新
        self._last_hashes = current_hashes

        if not changed_rows:
            logger.info(f"[{source}] 変更なし（{skipped}件スキップ, {cancelled}件キャンセル）")
            return {"synced": 0, "skipped": skipped, "cancelled": cancelled, "errors": 0}

        # 変更分だけバッチupsert
        try:
            resp = await self._request_with_retry(
                "post",
                f"{self.base_url}/external_reservations",
                json=changed_rows,
            )

            if resp is None:
                result = {"synced": 0, "skipped": skipped, "cancelled": cancelled, "errors": len(changed_rows)}
            elif resp.status_code in (200, 201):
                result = {"synced": len(changed_rows), "skipped": skipped, "cancelled": cancelled, "errors": 0}
            else:
                logger.error(
                    f"Supabaseバッチ書き込みエラー: {resp.status_code} {resp.text}"
                )
                result = {"synced": 0, "skipped": skipped, "cancelled": cancelled, "errors": len(changed_rows)}

        except Exception as e:
            logger.error(f"同期エラー: {e}")
            result = {"synced": 0, "skipped": skipped, "cancelled": cancelled, "errors": len(changed_rows)}

        logger.info(f"[{source}] 同期結果: {result}")
        return result

    async def _mark_cancelled(self, source: str, external_ids: set[str]) -> int:
        """
        消えた予約をキャンセル済みとしてバッチマーク。

        PostgREST の in. フィルタを使って1リクエストで一括更新する。
        """
        if not external_ids:
            return 0

        now = datetime.now(JST).isoformat()
        # PostgREST in.() injection 防止: 安全でない文字を含むIDは除外
        safe_ids = {
            eid for eid in external_ids
            if eid and not _POSTGREST_UNSAFE_RE.search(eid)
        }
        if len(safe_ids) != len(external_ids):
            skipped = external_ids - safe_ids
            logger.warning(f"[{source}] 不正な文字を含むexternal_idをスキップ: {skipped}")
        if not safe_ids:
            return 0

        # PostgREST の in.() 内では各値をダブルクォートで囲む
        ids_csv = ",".join(f'"{eid}"' for eid in safe_ids)

        try:
            resp = await self._request_with_retry(
                "patch",
                f"{self.base_url}/external_reservations",
                params={
                    "site_id": f"eq.{self.site_id}",
                    "source": f"eq.{source}",
                    "external_id": f"in.({ids_csv})",
                    "status": "eq.confirmed",
                },
                json={"status": "cancelled", "synced_at": now},
            )

            if resp and resp.status_code in (200, 204):
                logger.info(
                    f"[{source}] キャンセル検知: {len(external_ids)}件 "
                    f"({', '.join(list(external_ids)[:5])}{'...' if len(external_ids) > 5 else ''})"
                )
                return len(external_ids)
            else:
                status = resp.status_code if resp else "N/A"
                logger.warning(f"[{source}] キャンセルバッチ更新失敗: {status}")
                return 0

        except Exception as e:
            logger.error(f"[{source}] キャンセルバッチ更新エラー: {e}")
            return 0

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
