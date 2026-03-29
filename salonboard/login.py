"""
サロンボード ログイン & Cookie保持

使い方:
  1. .env に SALONBOARD_ID, SALONBOARD_PASSWORD を設定
  2. python salonboard/login.py
  3. 初回はブラウザが開いてログイン → cookies.json 保存
  4. 2回目以降は cookies.json を再利用（セッション有効なら）
"""

import os
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from dotenv import load_dotenv

load_dotenv()

# サロンボードのURL
LOGIN_URL = "https://salonboard.com/login/"
TOP_URL = "https://salonboard.com/KLP/top/"

COOKIES_PATH = Path(__file__).parent.parent / "cookies.json"
SCREENSHOTS_DIR = Path(__file__).parent.parent / "screenshots"


def ensure_dirs():
    SCREENSHOTS_DIR.mkdir(exist_ok=True)


def login_with_credentials(page):
    """ID/PWでログイン"""
    salon_id = os.environ.get("SALONBOARD_ID")
    salon_pw = os.environ.get("SALONBOARD_PASSWORD")

    if not salon_id or not salon_pw:
        raise ValueError("SALONBOARD_ID と SALONBOARD_PASSWORD を .env に設定してください")

    page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)

    # スクリーンショットで現在のページを確認（セレクタ特定用）
    page.screenshot(path=str(SCREENSHOTS_DIR / "login_page.png"), full_page=True)
    print(f"ログインページのスクショを保存: {SCREENSHOTS_DIR / 'login_page.png'}")

    # --- セレクタはアカウント取得後に特定する ---
    # 以下は推定値。実際のページを見て書き換える。
    # TODO: 実際のセレクタに置き換え
    page.fill('input[name="userId"]', salon_id)
    page.fill('input[name="password"]', salon_pw)
    page.click('button[type="submit"]')

    # ログイン後のページ遷移を待つ
    try:
        page.wait_for_url("**/top/**", timeout=15000)
        print("ログイン成功!")
        return True
    except PlaywrightTimeout:
        page.screenshot(path=str(SCREENSHOTS_DIR / "login_failed.png"), full_page=True)
        print(f"ログイン失敗。スクショ確認: {SCREENSHOTS_DIR / 'login_failed.png'}")
        return False


def try_cookies_login(context, page):
    """保存済みCookieでログイン試行"""
    if not COOKIES_PATH.exists():
        return False

    page.goto(TOP_URL, wait_until="networkidle", timeout=30000)

    # ログインページにリダイレクトされたらCookie無効
    if "login" in page.url.lower():
        print("Cookie期限切れ。再ログインします。")
        return False

    print("Cookie再利用でログイン成功!")
    return True


def get_authenticated_page(headless=False):
    """
    認証済みのpage objectを返す。
    headless=False でブラウザを表示（セレクタ確認用）。
    本番は headless=True に切り替え。
    """
    ensure_dirs()

    pw = sync_playwright().start()
    browser = pw.chromium.launch(headless=headless)

    # Cookie再利用を試行
    if COOKIES_PATH.exists():
        context = browser.new_context(storage_state=str(COOKIES_PATH))
        page = context.new_page()
        if try_cookies_login(context, page):
            return pw, browser, context, page
        page.close()
        context.close()

    # 新規ログイン
    context = browser.new_context()
    page = context.new_page()

    if login_with_credentials(page):
        # Cookie保存
        context.storage_state(path=str(COOKIES_PATH))
        print(f"Cookie保存: {COOKIES_PATH}")
        return pw, browser, context, page

    browser.close()
    pw.stop()
    raise RuntimeError("サロンボードへのログインに失敗しました")


def main():
    """テスト実行: ログインしてトップページのスクショを撮る"""
    print("サロンボード ログインテスト開始...")
    print(f"headless=False でブラウザを表示します")

    pw, browser, context, page = get_authenticated_page(headless=False)

    try:
        page.screenshot(path=str(SCREENSHOTS_DIR / "top_page.png"), full_page=True)
        print(f"トップページのスクショ保存: {SCREENSHOTS_DIR / 'top_page.png'}")
        print(f"現在のURL: {page.url}")
    finally:
        browser.close()
        pw.stop()

    print("完了!")


if __name__ == "__main__":
    main()
