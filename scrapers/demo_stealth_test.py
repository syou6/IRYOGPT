"""
ステルス実装テストスクリプト（公開bot検知サイト向け）

対象サイト:
  - https://bot.sannysoft.com          基本的なbot検知テスト
  - https://browserleaks.com/canvas    Canvas指紋テスト
  - https://browserleaks.com/webgl     WebGL指紋テスト
  - https://abrahamjuliot.github.io/creepjs/  総合bot検知テスト

使い方:
  python -m scrapers.demo_stealth_test
"""

import asyncio
import logging
import random
import sys
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path

import zendriver as uc
import zendriver.cdp as cdp

from scrapers.stealth import build_stealth_js, random_viewport
from scrapers.config import USER_AGENTS, SCREENSHOTS_DIR

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

DEMO_DIR = SCREENSHOTS_DIR / "demo"
DEMO_DIR.mkdir(parents=True, exist_ok=True)

TEST_SITES = [
    {
        "name": "sannysoft",
        "url": "https://bot.sannysoft.com",
        "label": "SannySoft Bot Detection",
        "wait_sec": 5,
        "scroll": False,
    },
    {
        "name": "browserleaks_canvas",
        "url": "https://browserleaks.com/canvas",
        "label": "BrowserLeaks Canvas Fingerprint",
        "wait_sec": 6,
        "scroll": True,
    },
    {
        "name": "browserleaks_webgl",
        "url": "https://browserleaks.com/webgl",
        "label": "BrowserLeaks WebGL Fingerprint",
        "wait_sec": 6,
        "scroll": True,
    },
    {
        "name": "creepjs",
        "url": "https://abrahamjuliot.github.io/creepjs/",
        "label": "CreepJS Comprehensive Detection",
        "wait_sec": 12,
        "scroll": True,
    },
]


@dataclass
class TestResult:
    site_name: str
    label: str
    url: str
    screenshot_path: Path | None
    success: bool
    error: str | None


async def _register_stealth(browser, viewport: tuple[int, int], user_agent: str) -> None:
    """add_script_to_evaluate_on_new_document でステルスJSを登録"""
    stealth_js = build_stealth_js(viewport, user_agent)
    main_tab = browser.main_tab
    if main_tab:
        await main_tab.send(
            cdp.page.add_script_to_evaluate_on_new_document(source=stealth_js)
        )
        logger.info("ステルスJS登録完了（add_script_to_evaluate_on_new_document）")
    else:
        logger.warning("main_tab取得失敗。ステルスJS未登録")


async def _reinject_stealth(page, stealth_js: str) -> None:
    """ページ遷移ごとにCDPで再登録 + evaluate フォールバック"""
    try:
        await page.send(
            cdp.page.add_script_to_evaluate_on_new_document(source=stealth_js)
        )
    except Exception:
        pass
    try:
        await page.evaluate(stealth_js)
    except Exception:
        pass


async def _scroll_page(page) -> None:
    """人間的なスクロール（慣性減衰）"""
    total = random.randint(300, 600)
    scrolled = 0
    velocity = random.uniform(80, 130)
    decay = random.uniform(0.88, 0.94)

    while scrolled < total:
        chunk = int(max(10, velocity))
        chunk = min(chunk, total - scrolled)
        try:
            await page.evaluate(f"window.scrollBy(0, {chunk})")
        except Exception:
            break
        velocity *= decay
        await asyncio.sleep(random.uniform(0.02, 0.06))
        scrolled += chunk

    await asyncio.sleep(random.uniform(0.3, 0.8))


async def _take_screenshot(page, site_name: str) -> Path:
    """タイムスタンプ付きスクリーンショットを保存"""
    ts = datetime.now(JST).strftime("%Y%m%d_%H%M%S")
    filename = f"{site_name}_{ts}.png"
    path = DEMO_DIR / filename
    await page.save_screenshot(str(path))
    return path


async def run_test(
    browser,
    stealth_js: str,
    site: dict,
) -> TestResult:
    """1サイトのテストを実行"""
    label = site["label"]
    url = site["url"]
    name = site["name"]

    logger.info(f"テスト開始: {label}")
    logger.info(f"  URL: {url}")

    try:
        page = await browser.get(url, new_tab=False)
        await _reinject_stealth(page, stealth_js)

        logger.info(f"  待機中: {site['wait_sec']}秒（ページ読み込み + JS実行）")
        await asyncio.sleep(site["wait_sec"])

        if site["scroll"]:
            logger.info("  スクロール実行中...")
            await _scroll_page(page)

        # creepjs は追加待機（非同期テスト項目が多い）
        if name == "creepjs":
            logger.info("  CreepJS 追加待機（テスト項目完了まで）...")
            await asyncio.sleep(6)

        screenshot_path = await _take_screenshot(page, name)
        logger.info(f"  スクリーンショット保存: {screenshot_path}")

        return TestResult(
            site_name=name,
            label=label,
            url=url,
            screenshot_path=screenshot_path,
            success=True,
            error=None,
        )

    except Exception as e:
        logger.error(f"  エラー: {e}")
        return TestResult(
            site_name=name,
            label=label,
            url=url,
            screenshot_path=None,
            success=False,
            error=str(e),
        )


def _print_summary(results: list[TestResult]) -> None:
    """テスト結果のサマリーを表示"""
    print("\n" + "=" * 60)
    print("ステルステスト結果サマリー")
    print("=" * 60)

    passed = sum(1 for r in results if r.success)
    total = len(results)

    for r in results:
        status = "OK" if r.success else "NG"
        print(f"\n[{status}] {r.label}")
        print(f"     URL: {r.url}")
        if r.success and r.screenshot_path:
            print(f"     スクショ: {r.screenshot_path}")
        if r.error:
            print(f"     エラー: {r.error}")

    print("\n" + "-" * 60)
    print(f"完了: {passed}/{total} サイト成功")
    print(f"スクリーンショット保存先: {DEMO_DIR}")
    print("=" * 60 + "\n")


async def main() -> None:
    viewport = random_viewport()
    user_agent = random.choice(USER_AGENTS)
    w, h = viewport

    logger.info("ステルステスト開始")
    logger.info(f"User-Agent: {user_agent[:70]}...")
    logger.info(f"Viewport: {w}x{h}")
    logger.info(f"スクリーンショット保存先: {DEMO_DIR}")

    config = uc.Config()
    config.headless = False
    config.add_argument(f"--user-agent={user_agent}")
    config.add_argument(f"--window-size={w},{h}")
    config.add_argument("--no-sandbox")
    config.add_argument("--disable-dev-shm-usage")
    config.add_argument("--disable-infobars")
    config.add_argument("--disable-blink-features=AutomationControlled")
    config.add_argument("--disable-features=IsolateOrigins,site-per-process")
    config.add_argument("--enforce-webrtc-ip-handling-policy=disable_non_proxied_udp")

    browser = await uc.start(config=config)

    try:
        await _register_stealth(browser, viewport, user_agent)

        stealth_js = build_stealth_js(viewport, user_agent)
        results: list[TestResult] = []

        for i, site in enumerate(TEST_SITES):
            if i > 0:
                # サイト間の待機（不審な高速アクセス回避）
                wait = random.uniform(2.0, 4.0)
                logger.info(f"次のサイトまで {wait:.1f}秒待機...")
                await asyncio.sleep(wait)

            result = await run_test(browser, stealth_js, site)
            results.append(result)

        _print_summary(results)

    finally:
        try:
            browser.stop()
        except Exception:
            pass


if __name__ == "__main__":
    asyncio.run(main())
