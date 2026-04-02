"""
Bot検知テストスクリプト

zendriver + ステルスJS の検知回避力を実証する。
3つのテストサイトにアクセスし、スクリーンショットで結果を保存。

使い方:
  python -m scrapers.bot_detection_test

テストサイト:
  1. bot.sannysoft.com — ブラウザ指紋チェック（WebDriver検知など）
  2. abrahamjuliot.github.io/creepjs — CreepJS 高度な指紋検知
  3. nowsecure.nl — Cloudflare Bot Management テスト
"""

import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path

import zendriver as uc

from scrapers.config import SCREENSHOTS_DIR, USER_AGENTS
from scrapers.stealth import build_stealth_js, random_viewport

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

TESTS = [
    {
        "name": "sannysoft",
        "url": "https://bot.sannysoft.com/",
        "wait": 5,
        "description": "WebDriver検知、navigator属性、WebGL等のチェック",
    },
    {
        "name": "creepjs",
        "url": "https://abrahamjuliot.github.io/creepjs/",
        "wait": 12,
        "description": "高度な指紋検知（Canvas, Audio, WebGL hash等）",
    },
    {
        "name": "nowsecure",
        "url": "https://nowsecure.nl/",
        "wait": 10,
        "description": "Cloudflare Bot Management 検知テスト",
    },
    {
        "name": "salonboard_login",
        "url": "https://salonboard.com/login/",
        "wait": 8,
        "description": "SalonBoardログイン画面（Akamai CDN通過テスト）",
    },
]


async def run_tests():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = SCREENSHOTS_DIR / f"bot_test_{timestamp}"
    results_dir.mkdir(parents=True, exist_ok=True)

    ua = USER_AGENTS[0]
    vp = random_viewport()
    w, h = vp

    logger.info(f"UA: {ua[:60]}...")
    logger.info(f"Viewport: {w}x{h}")

    config = uc.Config(
        headless=False,
        sandbox=False,
        user_agent=ua,
        disable_webrtc=True,
    )
    config._browser_args.append("--lang=ja-JP")

    browser = await uc.start(config)

    try:
        page = await browser.get("about:blank")

        # ステルスJS注入
        stealth_js = build_stealth_js((w, h), ua)
        import zendriver.cdp as cdp
        await page.send(
            cdp.page.add_script_to_evaluate_on_new_document(stealth_js)
        )
        logger.info("ステルスJS注入完了")

        results = []

        for test in TESTS:
            logger.info(f"\n{'='*50}")
            logger.info(f"テスト: {test['name']} — {test['description']}")
            logger.info(f"URL: {test['url']}")
            logger.info(f"{'='*50}")

            try:
                await page.get(test["url"])
                await asyncio.sleep(test["wait"])

                # スクリーンショット保存
                screenshot_path = results_dir / f"{test['name']}.png"
                await page.save_screenshot(str(screenshot_path))
                logger.info(f"スクリーンショット保存: {screenshot_path}")

                # ページタイトル取得
                title = await page.evaluate("document.title")
                logger.info(f"ページタイトル: {title}")

                # sannysoft の場合、結果テーブルを解析
                if test["name"] == "sannysoft":
                    result_text = await page.evaluate("""
                        (() => {
                            const rows = document.querySelectorAll('table tr');
                            const results = [];
                            rows.forEach(row => {
                                const cells = row.querySelectorAll('td');
                                if (cells.length >= 2) {
                                    const key = cells[0].textContent.trim();
                                    const val = cells[1].textContent.trim();
                                    const passed = !cells[1].classList.contains('failed');
                                    results.push(`${passed ? 'PASS' : 'FAIL'} ${key}: ${val}`);
                                }
                            });
                            return results.join('\\n');
                        })()
                    """)
                    if result_text:
                        logger.info(f"\n--- Sannysoft 結果 ---\n{result_text}")
                        fail_count = result_text.count("FAIL")
                        pass_count = result_text.count("PASS")
                        logger.info(f"PASS: {pass_count}, FAIL: {fail_count}")
                        results.append({
                            "test": "sannysoft",
                            "pass": pass_count,
                            "fail": fail_count,
                            "status": "PASS" if fail_count == 0 else "PARTIAL",
                        })

                # nowsecure の場合、Cloudflare通過チェック
                elif test["name"] == "nowsecure":
                    current_url = await page.evaluate("window.location.href")
                    page_text = await page.evaluate("document.body.innerText")
                    blocked = "challenge" in current_url.lower() or "ray id" in page_text.lower()
                    status = "FAIL" if blocked else "PASS"
                    logger.info(f"Cloudflare通過: {status}")
                    logger.info(f"現在のURL: {current_url}")
                    results.append({
                        "test": "nowsecure",
                        "status": status,
                        "url": current_url,
                    })

                # salonboard の場合
                elif test["name"] == "salonboard_login":
                    current_url = await page.evaluate("window.location.href")
                    page_text = await page.evaluate("document.body.innerText.substring(0, 500)")
                    blocked = any(x in page_text.lower() for x in ["access denied", "blocked", "captcha"])
                    has_login_form = await page.evaluate("""
                        !!document.querySelector('input[name="userId"]')
                    """)
                    status = "PASS" if has_login_form and not blocked else "FAIL"
                    logger.info(f"SalonBoardアクセス: {status}")
                    logger.info(f"ログインフォーム検出: {has_login_form}")
                    logger.info(f"ブロック検知: {blocked}")
                    results.append({
                        "test": "salonboard_login",
                        "status": status,
                        "login_form": has_login_form,
                        "blocked": blocked,
                    })

                # creepjs の場合
                elif test["name"] == "creepjs":
                    trust_score = await page.evaluate("""
                        (() => {
                            const el = document.querySelector('.visitor-info .grade');
                            return el ? el.textContent.trim() : 'N/A';
                        })()
                    """)
                    logger.info(f"CreepJS Trust Score: {trust_score}")
                    results.append({
                        "test": "creepjs",
                        "trust_score": trust_score,
                    })

            except Exception as e:
                logger.error(f"テスト失敗 [{test['name']}]: {e}")
                results.append({"test": test["name"], "status": "ERROR", "error": str(e)})

        # --- 最終サマリー ---
        logger.info(f"\n{'='*60}")
        logger.info("テスト結果サマリー")
        logger.info(f"{'='*60}")
        for r in results:
            logger.info(f"  {r}")
        logger.info(f"\nスクリーンショット保存先: {results_dir}")
        logger.info(f"{'='*60}")

    finally:
        await browser.stop()


if __name__ == "__main__":
    asyncio.run(run_tests())
