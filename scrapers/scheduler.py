"""
ランダム間隔スケジューラー

定期的にスクレイピングを実行する。
ボット検知を回避するため、間隔をランダムにする。

方式:
- 通常: 2.5〜4分のランダム間隔で定期取得
- 営業時間外: 間隔を3倍に（深夜スクレイピングは不審）
- CAPTCHA検知時: 一時停止 → 管理者に通知 → 手動復旧待ち
- エラー時: 指数バックオフでリトライ（最大30分）
- 日次: 古い予約データの自動クリーンアップ
- 日次: 古いスクリーンショットの自動削除
- 消えた予約の検知: SalonBoardから消えた予約をcancelled扱いに
"""

import asyncio
import logging
import random
import signal
from datetime import datetime, timedelta, timezone

from scrapers.config import (
    SCREENSHOTS_DIR,
    SYNC_INTERVAL_MAX,
    SYNC_INTERVAL_MIN,
)
from scrapers.disk_manager import backup_cookies, check_disk_space, cleanup_screenshots
from scrapers.minimo_scraper import MinimoScraper
from scrapers.notifier import notify_captcha, notify_error, notify_sync_result
from scrapers.salonboard_scraper import SalonBoardScraper
from scrapers.sync_service import SyncService

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

# 営業時間（この範囲外は頻度を下げる）
BUSINESS_HOURS_START = 8   # 8:00
BUSINESS_HOURS_END = 22    # 22:00


class ReservationScheduler:
    """ランダム間隔でスクレイピングを実行するスケジューラー"""

    def __init__(self, site_id: str):
        self.site_id = site_id
        self.salonboard = SalonBoardScraper()
        self.minimo = MinimoScraper()
        self.sync_service = SyncService(site_id)
        self._running = False
        self._consecutive_errors = {"salonboard": 0, "minimo": 0}
        self._max_consecutive_errors = 5
        self._paused = {"salonboard": False, "minimo": False}
        self._cycle_count = 0
        self._last_cleanup: datetime | None = None
        self._started_at: datetime | None = None
        self._last_sync_at: datetime | None = None
        self._last_reservations: dict[str, list[dict]] = {}

    async def start(self) -> None:
        """スケジューラー開始"""
        self._running = True
        self._started_at = datetime.now(JST)
        logger.info("スケジューラー開始")

        loop = asyncio.get_event_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, self._handle_shutdown)

        await self.salonboard.start_browser()
        await self.minimo.start_browser()

        try:
            while self._running:
                self._cycle_count += 1
                await self._run_cycle()

                await self._maybe_cleanup()

                interval = self._calc_interval()
                logger.info(f"次の同期まで {interval:.0f}秒")
                await asyncio.sleep(interval)

        except asyncio.CancelledError:
            logger.info("スケジューラーキャンセル")
        finally:
            await self._cleanup()

    def _calc_interval(self) -> float:
        """営業時間に応じて同期間隔を調整"""
        hour = datetime.now(JST).hour
        base = random.uniform(SYNC_INTERVAL_MIN, SYNC_INTERVAL_MAX)

        if hour < BUSINESS_HOURS_START or hour >= BUSINESS_HOURS_END:
            # 営業時間外は3倍の間隔（不審なアクセスパターン回避）
            return base * 3.0

        return base

    async def _run_cycle(self) -> None:
        """1回の同期サイクル"""
        now = datetime.now(JST)
        today = now.strftime("%Y-%m-%d")
        tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        dates = [today, tomorrow]

        # ディスク容量チェック
        if not check_disk_space(min_free_gb=0.5):
            cleanup_screenshots(SCREENSHOTS_DIR, max_age_hours=12, max_count=50)

        results = {}

        for date in dates:
            if not self._paused["salonboard"]:
                sb_result = await self._scrape_safe(
                    self.salonboard, "salonboard", date
                )
                results[f"salonboard_{date}"] = sb_result

            if not self._paused["minimo"]:
                minimo_result = await self._scrape_safe(
                    self.minimo, "minimo", date
                )
                results[f"minimo_{date}"] = minimo_result

        self._last_sync_at = datetime.now(JST)
        await notify_sync_result(results)

    async def _scrape_safe(
        self, scraper, source: str, target_date: str
    ) -> dict:
        """安全にスクレイピング実行（消えた予約の検知含む）"""
        try:
            reservations = await scraper.fetch_reservations_safe(target_date)

            if scraper.captcha_detected:
                self._paused[source] = True
                self._consecutive_errors[source] = 0
                await notify_captcha(source)
                logger.warning(f"[{source}] CAPTCHA検知 → 一時停止")
                return {"synced": 0, "errors": 0, "captcha": True}

            # --- 消えた予約の検知 ---
            cache_key = f"{source}_{target_date}"
            prev_reservations = self._last_reservations.get(cache_key, [])

            if reservations:
                result = await self.sync_service.sync_reservations(
                    reservations, source
                )

                # 前回あって今回ない予約 → キャンセルされた可能性
                if prev_reservations:
                    await self._detect_cancelled(
                        prev_reservations, reservations, source, target_date
                    )

                self._last_reservations[cache_key] = reservations
            else:
                result = {"synced": 0, "errors": 0}

            self._consecutive_errors[source] = 0
            return result

        except Exception as e:
            self._consecutive_errors[source] += 1
            logger.error(
                f"[{source}] スクレイピングエラー "
                f"({self._consecutive_errors[source]}/{self._max_consecutive_errors}): {e}"
            )

            if self._consecutive_errors[source] >= self._max_consecutive_errors:
                self._paused[source] = True
                await notify_error(
                    source,
                    f"連続{self._max_consecutive_errors}回エラー。一時停止。最終エラー: {e}",
                )
                logger.error(f"[{source}] 連続エラー上限 → 一時停止")

            return {"synced": 0, "errors": 1}

    async def _detect_cancelled(
        self,
        prev: list[dict],
        current: list[dict],
        source: str,
        target_date: str,
    ) -> None:
        """前回あったが今回消えた予約をcancelledとしてマーク"""
        current_ids = {r.get("external_id") for r in current if r.get("external_id")}
        disappeared = [
            r for r in prev
            if r.get("external_id") and r["external_id"] not in current_ids
        ]

        if not disappeared:
            return

        logger.info(
            f"[{source}] {target_date}: {len(disappeared)}件の予約が消失 → cancelled扱い"
        )

        for r in disappeared:
            cancelled = {**r, "status": "cancelled"}
            await self.sync_service.sync_reservations([cancelled], source)

    async def _maybe_cleanup(self) -> None:
        """日次クリーンアップ"""
        now = datetime.now(JST)
        if self._last_cleanup and (now - self._last_cleanup).total_seconds() < 86400:
            return

        try:
            await self.sync_service.cleanup_old_reservations(days_before=30)
            cleanup_screenshots(SCREENSHOTS_DIR, max_age_hours=48)
            from scrapers.config import COOKIES_DIR
            backup_cookies(COOKIES_DIR)
            self._last_cleanup = now
            logger.info("日次クリーンアップ完了")
        except Exception as e:
            logger.error(f"クリーンアップエラー: {e}")

    async def resume(self, source: str) -> bool:
        if source not in self._paused:
            return False

        scraper = self.salonboard if source == "salonboard" else self.minimo

        scraper.clear_cookies()
        scraper.reset_captcha_flag()

        await scraper.close_browser()
        await scraper.start_browser()

        self._paused[source] = False
        self._consecutive_errors[source] = 0
        logger.info(f"[{source}] 再開")
        return True

    async def force_sync(self, target_date: str = None) -> dict:
        if target_date is None:
            target_date = datetime.now(JST).strftime("%Y-%m-%d")

        results = {}

        if not self._paused["salonboard"]:
            results["salonboard"] = await self._scrape_safe(
                self.salonboard, "salonboard", target_date
            )

        if not self._paused["minimo"]:
            results["minimo"] = await self._scrape_safe(
                self.minimo, "minimo", target_date
            )

        return results

    async def realtime_check(
        self, target_date: str, staff_name: str, start_time: str
    ) -> dict:
        """予約確定直前のリアルタイムチェック"""
        logger.info(
            f"リアルタイムチェック: {target_date} {staff_name} {start_time}"
        )

        all_reservations = []

        for source, scraper in [
            ("salonboard", self.salonboard),
            ("minimo", self.minimo),
        ]:
            if self._paused[source]:
                continue
            try:
                reservations = await scraper.fetch_reservations_safe(target_date)
                all_reservations.extend(reservations)
                if reservations:
                    await self.sync_service.sync_reservations(reservations, source)
            except Exception as e:
                logger.error(f"[{source}] リアルタイムチェックエラー: {e}")

        # 競合チェック（時間の重なりも考慮）
        conflicts = []
        for r in all_reservations:
            if r.get("staff_name", "").strip() != staff_name.strip():
                continue
            if r.get("status") != "confirmed":
                continue

            # 完全一致チェック
            if r.get("start_time", "") == start_time:
                conflicts.append(r)
                continue

            # 時間帯の重なりチェック
            r_start = r.get("start_time", "")
            r_end = r.get("end_time", "")
            if r_start and r_end and r_start <= start_time < r_end:
                conflicts.append(r)

        result = {
            "available": len(conflicts) == 0,
            "conflicts": conflicts,
            "checked_at": datetime.now(JST).isoformat(),
        }

        if conflicts:
            logger.warning(f"競合検知: {conflicts}")
        else:
            logger.info(f"空き確認OK: {target_date} {staff_name} {start_time}")

        return result

    def get_status(self) -> dict:
        return {
            "running": self._running,
            "paused": dict(self._paused),
            "consecutive_errors": dict(self._consecutive_errors),
            "salonboard_captcha": self.salonboard.captcha_detected,
            "minimo_captcha": self.minimo.captcha_detected,
            "cycle_count": self._cycle_count,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "last_sync_at": self._last_sync_at.isoformat() if self._last_sync_at else None,
            "last_cleanup": self._last_cleanup.isoformat() if self._last_cleanup else None,
        }

    def _handle_shutdown(self) -> None:
        logger.info("シャットダウンシグナル受信")
        self._running = False

    async def _cleanup(self) -> None:
        logger.info("クリーンアップ中...")
        await self.salonboard.close_browser()
        await self.minimo.close_browser()
        from scrapers.sync_service import close_http_client
        await close_http_client()
        logger.info("クリーンアップ完了")
