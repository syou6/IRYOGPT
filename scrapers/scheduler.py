"""
ランダム間隔スケジューラー

定期的にスクレイピングを実行する。
ボット検知を回避するため、間隔をランダムにする。

方式:
- 通常: 2.5〜4分のランダム間隔で定期取得
- CAPTCHA検知時: 一時停止 → 管理者に通知 → 手動復旧待ち
- エラー時: 指数バックオフでリトライ（最大30分）
"""

import asyncio
import logging
import random
import signal
from datetime import datetime, timedelta

from scrapers.config import SYNC_INTERVAL_MAX, SYNC_INTERVAL_MIN
from scrapers.minimo_scraper import MinimoScraper
from scrapers.notifier import notify_captcha, notify_error, notify_sync_result
from scrapers.salonboard_scraper import SalonBoardScraper
from scrapers.sync_service import SyncService

logger = logging.getLogger(__name__)


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

    async def start(self) -> None:
        """スケジューラー開始"""
        self._running = True
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
                await self._run_cycle()

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
        today = datetime.now().strftime("%Y-%m-%d")
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
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
            reservations = await scraper.fetch_reservations(target_date)

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
            target_date = datetime.now().strftime("%Y-%m-%d")

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

    def _handle_shutdown(self) -> None:
        """graceful shutdown"""
        logger.info("シャットダウンシグナル受信")
        self._running = False

    async def _cleanup(self) -> None:
        """リソース解放"""
        logger.info("クリーンアップ中...")
        await self.salonboard.close_browser()
        await self.minimo.close_browser()
        logger.info("クリーンアップ完了")
