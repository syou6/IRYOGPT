"""
ランダム間隔スケジューラー

定期的にスクレイピングを実行する。
ボット検知を回避するため、間隔をランダムにする。

方式:
- 通常: 2.5〜4分のランダム間隔で定期取得
- CAPTCHA検知時: 一時停止 → 管理者に通知 → 手動復旧待ち
- エラー時: 指数バックオフでリトライ（最大30分）
- 日次: 古い予約データの自動クリーンアップ
"""

import asyncio
import logging
import random
import signal
from datetime import datetime, timedelta, timezone

from scrapers.config import SYNC_INTERVAL_MAX, SYNC_INTERVAL_MIN
from scrapers.minimo_scraper import MinimoScraper
from scrapers.notifier import notify_captcha, notify_error, notify_sync_result
from scrapers.salonboard_scraper import SalonBoardScraper
from scrapers.sync_service import SyncService

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))


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

    async def start(self) -> None:
        """スケジューラー開始"""
        self._running = True
        self._started_at = datetime.now(JST)
        logger.info("スケジューラー開始")

        # シグナルハンドラー（graceful shutdown）
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, self._handle_shutdown)

        # ブラウザ起動
        await self.salonboard.start_browser()
        await self.minimo.start_browser()

        try:
            while self._running:
                self._cycle_count += 1
                await self._run_cycle()

                # 日次クリーンアップ（1日1回、30日前のデータを削除）
                await self._maybe_cleanup()

                # ランダム間隔で待機
                interval = random.uniform(SYNC_INTERVAL_MIN, SYNC_INTERVAL_MAX)
                logger.info(f"次の同期まで {interval:.0f}秒")
                await asyncio.sleep(interval)

        except asyncio.CancelledError:
            logger.info("スケジューラーキャンセル")
        finally:
            await self._cleanup()

    async def _run_cycle(self) -> None:
        """1回の同期サイクル"""
        # 今日と明日の予約を取得（ダブルブッキング防止に重要な範囲）
        now = datetime.now(JST)
        today = now.strftime("%Y-%m-%d")
        tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        dates = [today, tomorrow]

        results = {}

        for date in dates:
            # サロンボード
            if not self._paused["salonboard"]:
                sb_result = await self._scrape_safe(
                    self.salonboard, "salonboard", date
                )
                results[f"salonboard_{date}"] = sb_result

            # ミニモ
            if not self._paused["minimo"]:
                minimo_result = await self._scrape_safe(
                    self.minimo, "minimo", date
                )
                results[f"minimo_{date}"] = minimo_result

        # 同期結果の通知（エラーがあれば）
        await notify_sync_result(results)

    async def _scrape_safe(
        self, scraper, source: str, target_date: str
    ) -> dict:
        """安全にスクレイピング実行（エラーハンドリング付き）"""
        try:
            # セッション切れ自動復旧付きの取得メソッドを使用
            reservations = await scraper.fetch_reservations_safe(target_date)

            # CAPTCHA 検知チェック
            if scraper.captcha_detected:
                self._paused[source] = True
                self._consecutive_errors[source] = 0
                await notify_captcha(source)
                logger.warning(f"[{source}] CAPTCHA検知 → 一時停止")
                return {"synced": 0, "errors": 0, "captcha": True}

            # 予約データをSupabaseに同期
            if reservations:
                result = await self.sync_service.sync_reservations(
                    reservations, source
                )
            else:
                result = {"synced": 0, "errors": 0}

            # エラーカウントリセット
            self._consecutive_errors[source] = 0
            return result

        except Exception as e:
            self._consecutive_errors[source] += 1
            logger.error(
                f"[{source}] スクレイピングエラー "
                f"({self._consecutive_errors[source]}/{self._max_consecutive_errors}): {e}"
            )

            # 連続エラーが上限に達したら一時停止
            if self._consecutive_errors[source] >= self._max_consecutive_errors:
                self._paused[source] = True
                await notify_error(
                    source,
                    f"連続{self._max_consecutive_errors}回エラー。一時停止。最終エラー: {e}",
                )
                logger.error(f"[{source}] 連続エラー上限 → 一時停止")

            return {"synced": 0, "errors": 1}

    async def _maybe_cleanup(self) -> None:
        """日次クリーンアップ（30日以前の古いデータ削除）"""
        now = datetime.now(JST)
        if self._last_cleanup and (now - self._last_cleanup).total_seconds() < 86400:
            return  # 24時間以内にクリーンアップ済み

        try:
            await self.sync_service.cleanup_old_reservations(days_before=30)
            self._last_cleanup = now
            logger.info("日次クリーンアップ完了")
        except Exception as e:
            logger.error(f"クリーンアップエラー: {e}")

    async def resume(self, source: str) -> bool:
        """一時停止中のスクレイパーを再開"""
        if source not in self._paused:
            return False

        scraper = self.salonboard if source == "salonboard" else self.minimo

        # Cookie削除して再ログイン
        scraper.clear_cookies()
        scraper.reset_captcha_flag()

        # ブラウザ再起動
        await scraper.close_browser()
        await scraper.start_browser()

        self._paused[source] = False
        self._consecutive_errors[source] = 0
        logger.info(f"[{source}] 再開")
        return True

    async def force_sync(self, target_date: str = None) -> dict:
        """手動で即時同期を実行"""
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

    async def realtime_check(self, target_date: str, staff_name: str, start_time: str) -> dict:
        """
        予約確定直前のリアルタイムチェック

        よやくらくで予約を確定する直前に呼び出し、
        サロンボード・ミニモの最新状態を取得して
        その枠が本当に空いているか確認する。

        Args:
            target_date: 'YYYY-MM-DD'
            staff_name: スタッフ名
            start_time: '10:00' 等

        Returns:
            {
                "available": True/False,
                "conflicts": [{"source": "salonboard", "time": "10:00", ...}],
                "checked_at": "2026-03-29T10:00:00"
            }
        """
        logger.info(
            f"リアルタイムチェック: {target_date} {staff_name} {start_time}"
        )

        all_reservations = []

        # サロンボード・ミニモ両方の最新データを取得
        for source, scraper in [
            ("salonboard", self.salonboard),
            ("minimo", self.minimo),
        ]:
            if self._paused[source]:
                continue
            try:
                reservations = await scraper.fetch_reservations_safe(target_date)
                all_reservations.extend(reservations)
                # 最新データをDBにも同期
                if reservations:
                    await self.sync_service.sync_reservations(reservations, source)
            except Exception as e:
                logger.error(f"[{source}] リアルタイムチェックエラー: {e}")

        # 競合チェック
        conflicts = []
        for r in all_reservations:
            if (
                r.get("staff_name", "").strip() == staff_name.strip()
                and r.get("start_time", "") == start_time
                and r.get("status") == "confirmed"
            ):
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
        """スケジューラーの現在の状態を返す（ヘルスチェック用）"""
        return {
            "running": self._running,
            "paused": dict(self._paused),
            "consecutive_errors": dict(self._consecutive_errors),
            "salonboard_captcha": self.salonboard.captcha_detected,
            "minimo_captcha": self.minimo.captcha_detected,
            "cycle_count": self._cycle_count,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "last_cleanup": self._last_cleanup.isoformat() if self._last_cleanup else None,
        }

    def _handle_shutdown(self) -> None:
        """graceful shutdown"""
        logger.info("シャットダウンシグナル受信")
        self._running = False

    async def _cleanup(self) -> None:
        """リソース解放"""
        logger.info("クリーンアップ中...")
        await self.salonboard.close_browser()
        await self.minimo.close_browser()
        # HTTP クライアントの解放
        from scrapers.sync_service import close_http_client
        await close_http_client()
        logger.info("クリーンアップ完了")
