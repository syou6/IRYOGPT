"""
スクレイパーサービス エントリーポイント

使い方:
  # 定期同期を開始（通常運用）
  python -m scrapers.main --site-id YOUR_SITE_ID

  # 手動で1回だけ同期
  python -m scrapers.main --site-id YOUR_SITE_ID --once --date 2026-03-29

  # サロンボードだけテスト
  python -m scrapers.main --site-id YOUR_SITE_ID --once --source salonboard

  # CAPTCHA後の再ログイン
  python -m scrapers.main --relogin salonboard

  # スクリーンショットだけ撮る（セレクタ確認用）
  python -m scrapers.main --screenshot salonboard

ConoHaサーバーでの常時稼働:
  # systemdサービスとして登録する場合
  sudo cp scrapers/yoyakuraku-scraper.service /etc/systemd/system/
  sudo systemctl enable yoyakuraku-scraper
  sudo systemctl start yoyakuraku-scraper
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime

from scrapers.config import LOGS_DIR
from scrapers.minimo_scraper import MinimoScraper
from scrapers.salonboard_scraper import SalonBoardScraper
from scrapers.scheduler import ReservationScheduler
from scrapers.sync_service import SyncService


def setup_logging() -> None:
    """ログ設定"""
    log_file = LOGS_DIR / f"scraper_{datetime.now().strftime('%Y%m%d')}.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )


async def run_scheduler(site_id: str) -> None:
    """定期同期を開始"""
    scheduler = ReservationScheduler(site_id)
    await scheduler.start()


async def run_once(
    site_id: str,
    target_date: str,
    source: str = None,
) -> None:
    """1回だけ同期を実行"""
    logger = logging.getLogger(__name__)
    sync_service = SyncService(site_id)

    scrapers = {}
    if source in (None, "salonboard"):
        scrapers["salonboard"] = SalonBoardScraper()
    if source in (None, "minimo"):
        scrapers["minimo"] = MinimoScraper()

    for name, scraper in scrapers.items():
        try:
            await scraper.start_browser()
            logger.info(f"[{name}] 予約取得開始: {target_date}")

            reservations = await scraper.fetch_reservations(target_date)
            logger.info(f"[{name}] 取得件数: {len(reservations)}")

            if reservations:
                result = await sync_service.sync_reservations(reservations, name)
                logger.info(f"[{name}] 同期結果: {result}")

            for r in reservations:
                logger.info(f"  {r}")

        except Exception as e:
            logger.error(f"[{name}] エラー: {e}")
        finally:
            await scraper.close_browser()


async def relogin(source: str) -> None:
    """Cookie削除して再ログイン"""
    logger = logging.getLogger(__name__)

    if source == "salonboard":
        scraper = SalonBoardScraper()
    elif source == "minimo":
        scraper = MinimoScraper()
    else:
        logger.error(f"不明なソース: {source}")
        return

    scraper.clear_cookies()

    try:
        await scraper.start_browser()
        success = await scraper.login()

        if success:
            logger.info(f"[{source}] 再ログイン成功。Cookieを更新しました。")
        else:
            logger.error(f"[{source}] 再ログイン失敗。")

    finally:
        await scraper.close_browser()


async def take_screenshot(source: str) -> None:
    """スクリーンショットを撮る（セレクタ確認用）"""
    logger = logging.getLogger(__name__)

    if source == "salonboard":
        scraper = SalonBoardScraper()
    elif source == "minimo":
        scraper = MinimoScraper()
    else:
        logger.error(f"不明なソース: {source}")
        return

    try:
        await scraper.start_browser()

        if await scraper.ensure_logged_in():
            await scraper.screenshot("manual_check")
            logger.info(f"[{source}] スクリーンショット保存完了")
        else:
            logger.error(f"[{source}] ログイン失敗")

    finally:
        await scraper.close_browser()


def main():
    parser = argparse.ArgumentParser(
        description="よやくらく 予約スクレイパーサービス"
    )
    parser.add_argument(
        "--site-id",
        help="よやくらくのサイトID（Supabase同期用）",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="1回だけ実行して終了",
    )
    parser.add_argument(
        "--date",
        default=datetime.now().strftime("%Y-%m-%d"),
        help="対象日 (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--source",
        choices=["salonboard", "minimo"],
        help="特定のソースのみ実行",
    )
    parser.add_argument(
        "--relogin",
        metavar="SOURCE",
        help="Cookie削除して再ログイン (salonboard or minimo)",
    )
    parser.add_argument(
        "--screenshot",
        metavar="SOURCE",
        help="スクリーンショットを撮る (salonboard or minimo)",
    )

    args = parser.parse_args()

    setup_logging()
    logger = logging.getLogger(__name__)
    logger.info("=" * 50)
    logger.info("よやくらく スクレイパーサービス")
    logger.info("=" * 50)

    if args.relogin:
        asyncio.run(relogin(args.relogin))
    elif args.screenshot:
        asyncio.run(take_screenshot(args.screenshot))
    elif args.once:
        if not args.site_id:
            logger.error("--site-id が必要です")
            sys.exit(1)
        asyncio.run(run_once(args.site_id, args.date, args.source))
    else:
        if not args.site_id:
            logger.error("--site-id が必要です")
            sys.exit(1)
        asyncio.run(run_scheduler(args.site_id))


if __name__ == "__main__":
    main()
