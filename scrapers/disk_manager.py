"""
ディスク管理

VPSのディスク容量を保護するため:
- 古いスクリーンショットの自動削除
- ログファイルのサイズ監視
- Cookie バックアップ
"""

import logging
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))


def cleanup_screenshots(
    screenshots_dir: Path,
    max_age_hours: int = 48,
    max_count: int = 200,
) -> int:
    """
    古いスクリーンショットを削除

    Args:
        screenshots_dir: スクリーンショットディレクトリ
        max_age_hours: この時間より古いファイルを削除
        max_count: この数を超えたら古い順に削除

    Returns:
        削除したファイル数
    """
    if not screenshots_dir.exists():
        return 0

    files = sorted(
        screenshots_dir.glob("*.png"),
        key=lambda f: f.stat().st_mtime,
    )

    deleted = 0
    now = datetime.now(JST).timestamp()
    cutoff = now - (max_age_hours * 3600)

    # 時間ベースの削除
    for f in files:
        if f.stat().st_mtime < cutoff:
            try:
                f.unlink()
                deleted += 1
            except Exception as e:
                logger.error(f"スクショ削除失敗: {f} - {e}")

    # 数ベースの削除（残りが多すぎる場合）
    remaining = sorted(
        screenshots_dir.glob("*.png"),
        key=lambda f: f.stat().st_mtime,
    )
    while len(remaining) > max_count:
        oldest = remaining.pop(0)
        try:
            oldest.unlink()
            deleted += 1
        except Exception as e:
            logger.error(f"スクショ削除失敗: {oldest} - {e}")

    if deleted > 0:
        logger.info(f"スクリーンショット {deleted}件 削除")

    return deleted


def check_disk_space(min_free_gb: float = 1.0) -> bool:
    """
    ディスク空き容量チェック

    Returns:
        True: 空き十分, False: 空き不足
    """
    disk = shutil.disk_usage("/")
    free_gb = disk.free / (1024 ** 3)

    if free_gb < min_free_gb:
        logger.warning(f"ディスク空き容量不足: {free_gb:.2f}GB (最低 {min_free_gb}GB 必要)")
        return False

    return True


def backup_cookies(cookies_dir: Path) -> None:
    """
    Cookie ファイルのバックアップ

    ログイン成功時のCookieを .bak にコピー。
    本体が壊れた場合のリカバリ用。
    """
    if not cookies_dir.exists():
        return

    for cookie_file in cookies_dir.glob("*.dat"):
        backup = cookie_file.with_suffix(".dat.bak")
        try:
            shutil.copy2(cookie_file, backup)
        except Exception as e:
            logger.error(f"Cookieバックアップ失敗: {cookie_file} - {e}")
