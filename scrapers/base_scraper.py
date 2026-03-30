"""
ステルス対策込みの基底スクレイパー（zendriver版）

zendriver = nodriverのアクティブfork（2026年3月現在も活発にメンテナンス）
- CDP直接通信（Selenium/WebDriver不要）→ bot検知回避力が最も高い
- 完全async/awaitネイティブ → run_in_executor不要
- Cookie保存/読込のビルトインサポート
- VPSでは Xvfb + headless=False で運用（headless=Trueは検知される）

ステルス対策（Akamai Bot Manager対応）:
- cdp.page.add_script_to_evaluate_on_new_document でページJSより先に注入
  （page.evaluate は遅すぎてAkamaiセンサーに間に合わない）
- puppeteer-extra-plugin-stealth 全17モジュール互換
- ベジェ曲線マウス移動
- ランダムビューポート + screen/outerWidth/outerHeight 一貫性
"""

import asyncio
import logging
import math
import random
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import zendriver as uc
import zendriver.cdp as cdp

from scrapers.config import (
    SCREENSHOTS_DIR,
    USER_AGENTS,
)
from scrapers.stealth import bezier_curve, build_stealth_js, random_viewport, wind_mouse

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))


class BaseScraper(ABC):
    """全スクレイパーの基底クラス（zendriver + Akamai対策版）"""

    SESSION_MAX_AGE_HOURS = 10  # 80%プリエンプティブ再ログイン考慮

    def __init__(self, name: str, cookies_path: Path):
        self.name = name
        self.cookies_path = cookies_path
        self._browser = None
        self._page = None
        self._captcha_detected = False
        self._last_login_time: Optional[datetime] = None
        self._consecutive_failures = 0
        self._max_retries = 3
        self._scrape_count = 0
        self._viewport = random_viewport()
        self._user_agent = ""
        self._stealth_injected = False

    # ------------------------------------------------------------------
    # ブラウザ起動・終了
    # ------------------------------------------------------------------

    async def start_browser(self) -> None:
        """zendriver でブラウザを起動（Xvfb環境前提、headless=False）"""
        self._user_agent = random.choice(USER_AGENTS)
        self._viewport = random_viewport()
        w, h = self._viewport

        logger.info(f"[{self.name}] UA: {self._user_agent[:60]}... VP: {w}x{h}")

        config = uc.Config(
            headless=False,
            sandbox=False,
            lang="ja-JP",
            user_agent=self._user_agent,
            disable_webrtc=True,
        )
        config.add_argument(f"--window-size={w},{h}")
        # Akamai対策: 自動化フラグを無効化
        config.add_argument("--disable-blink-features=AutomationControlled")

        self._browser = await uc.start(config=config)

        # ステルスJSをページ読み込み前に注入（最重要）
        await self._register_stealth_scripts()

        # Cookie読み込み
        await self._load_cookies()

        logger.info(f"[{self.name}] ブラウザ起動完了 (zendriver + stealth)")

    async def _register_stealth_scripts(self) -> None:
        """
        cdp.page.add_script_to_evaluate_on_new_document で
        ステルスJSを登録（全ページで自動実行される）

        重要: page.evaluate() ではなくこのCDPメソッドを使う。
        page.evaluate() はページJSの後に実行されるため、
        Akamaiセンサーが先に走って検知される。
        このCDPメソッドはページJSより先に実行される。
        """
        try:
            stealth_js = build_stealth_js(self._viewport, self._user_agent)

            # メインのタブに対してCDPコマンドを送信
            main_tab = self._browser.main_tab
            if main_tab:
                await main_tab.send(
                    cdp.page.add_script_to_evaluate_on_new_document(
                        source=stealth_js
                    )
                )
                self._stealth_injected = True
                logger.info(f"[{self.name}] ステルスJS登録完了（add_script_to_evaluate_on_new_document）")
            else:
                logger.warning(f"[{self.name}] main_tab取得失敗。safe_gotoでフォールバック注入")

        except Exception as e:
            logger.warning(f"[{self.name}] ステルスJS CDP登録失敗（フォールバック使用）: {e}")
            self._stealth_injected = False

    async def _inject_stealth_fallback(self) -> None:
        """
        CDPメソッドが使えない場合のフォールバック。
        page.evaluate() で注入（タイミングは遅いが無いよりマシ）
        """
        if self._stealth_injected:
            return
        try:
            stealth_js = build_stealth_js(self._viewport, self._user_agent)
            await self._page.evaluate(stealth_js)
            logger.debug(f"[{self.name}] ステルスJS フォールバック注入完了")
        except Exception as e:
            logger.debug(f"[{self.name}] ステルスJS フォールバック失敗（無害）: {e}")

    async def close_browser(self) -> None:
        try:
            if self._browser:
                await self._save_cookies()
                self._browser.stop()
        except Exception as e:
            logger.error(f"[{self.name}] ブラウザ終了エラー: {e}")
        finally:
            self._page = None
            self._browser = None
            self._stealth_injected = False

    async def maybe_restart_browser(self) -> None:
        """メモリリーク対策: 20回に1回ブラウザを再起動"""
        self._scrape_count += 1
        if self._scrape_count % 20 == 0:
            logger.info(f"[{self.name}] 定期再起動（{self._scrape_count}回目）")
            await self.close_browser()
            await self.start_browser()

    # ------------------------------------------------------------------
    # Cookie 管理
    # ------------------------------------------------------------------

    async def _save_cookies(self) -> None:
        try:
            self.cookies_path.parent.mkdir(parents=True, exist_ok=True)
            await self._browser.cookies.save(file=str(self.cookies_path))
            logger.debug(f"[{self.name}] Cookie保存完了")
        except Exception as e:
            logger.error(f"[{self.name}] Cookie保存失敗: {e}")

    async def _load_cookies(self) -> bool:
        if not self.cookies_path.exists():
            return False
        try:
            await self._browser.cookies.load(file=str(self.cookies_path))
            logger.debug(f"[{self.name}] Cookie読込完了")
            return True
        except Exception as e:
            logger.error(f"[{self.name}] Cookie読込失敗: {e}")
            return False

    def clear_cookies(self) -> None:
        if self.cookies_path.exists():
            self.cookies_path.unlink()
            logger.info(f"[{self.name}] Cookie削除")

    # ------------------------------------------------------------------
    # 人間的な操作の模倣（Akamai行動解析対策）
    # ------------------------------------------------------------------

    async def human_delay(self, min_sec: float = 0.5, max_sec: float = 2.0) -> None:
        """指数分布ベースの遅延（均一分布は機械的で検知される）"""
        mean = (min_sec + max_sec) / 2
        delay = random.expovariate(1.0 / mean)
        delay = max(min_sec, min(delay, max_sec * 1.5))
        await asyncio.sleep(delay)

    async def human_click(self, element) -> None:
        """WindMouseアルゴリズムでマウスを移動してからクリック"""
        try:
            box = await self._page.evaluate("""
                (el) => {
                    const rect = el.getBoundingClientRect();
                    return {
                        x: rect.x + rect.width / 2,
                        y: rect.y + rect.height / 2,
                        width: rect.width,
                        height: rect.height,
                    };
                }
            """, element)

            if box and box.get("width", 0) > 0:
                w, h = self._viewport
                start_x = random.randint(int(w * 0.1), int(w * 0.9))
                start_y = random.randint(int(h * 0.1), int(h * 0.9))

                # クリック位置に微小なずれ（中心ぴったりは不自然）
                target_x = box["x"] + random.uniform(-box["width"] * 0.15, box["width"] * 0.15)
                target_y = box["y"] + random.uniform(-box["height"] * 0.15, box["height"] * 0.15)

                dist = math.sqrt((target_x - start_x) ** 2 + (target_y - start_y) ** 2)

                # 距離が十分あればWindMouse、短距離はベジェ
                if dist > 50:
                    path = wind_mouse((start_x, start_y), (target_x, target_y))
                else:
                    path = bezier_curve((start_x, start_y), (target_x, target_y))

                # CDPネイティブのmouse_moveでパスを送信（Fitts法則速度カーブ）
                # 端で遅く中間で速い（人間の運動学に基づく）
                total_points = len(path)
                step = max(1, total_points // 8)
                for i in range(0, total_points, step):
                    px, py = path[i]
                    try:
                        await self._page.mouse_move(px, py, steps=1)
                    except Exception:
                        break
                    t_pos = i / max(1, total_points)
                    bell = 1 - 4 * (t_pos - 0.5) ** 2
                    delay = 0.025 - (bell * 0.017)  # 端0.025s、中間0.008s
                    await asyncio.sleep(delay)

                await self.human_delay(0.05, 0.15)

        except Exception:
            pass

        await element.click()

    async def human_type(self, element, text: str) -> None:
        """人間的なタイピング（速度にゆらぎ、たまに一瞬止まる）"""
        await element.click()
        await self.human_delay(0.2, 0.5)
        await element.clear_input()

        for char in text:
            await element.send_keys(char)

            # 対数ロジスティック分布（2026年論文: 99.8%回避率）
            # 均一分布より自然なキーストロークタイミング
            u = random.random()
            u = max(0.01, min(u, 0.99))
            delay = 0.07 * (u / (1 - u)) ** 0.35
            delay = max(0.03, min(delay, 0.4))

            # たまに少し長めの間（考え中を再現）
            if random.random() < 0.08:
                delay += random.uniform(0.2, 0.5)

            # 記号区切りで微妙に遅くなる
            if char in (" ", "-", "@", "."):
                delay += random.uniform(0.05, 0.15)

            await asyncio.sleep(delay)

    async def random_scroll(self) -> None:
        """慣性減衰スクロール + 逆スクロール（DataDome対策）"""
        total_scroll = random.randint(100, 500)
        scrolled = 0
        # 初速から減衰（タッチパッド慣性を再現）
        velocity = random.uniform(80, 140)
        decay = random.uniform(0.88, 0.95)

        while scrolled < total_scroll:
            chunk = int(max(10, velocity))
            chunk = min(chunk, total_scroll - scrolled)
            await self._page.evaluate(f"window.scrollBy(0, {chunk})")
            velocity *= decay
            # 微小なスタッター（5%の確率で一瞬停止）
            if random.random() < 0.05:
                await asyncio.sleep(random.uniform(0.1, 0.2))
            else:
                await asyncio.sleep(random.uniform(0.02, 0.06))
            scrolled += chunk

        # 8%の確率で逆スクロール（人間は読み返す）
        if random.random() < 0.08:
            reverse = random.randint(20, 80)
            await asyncio.sleep(random.uniform(0.3, 0.8))
            await self._page.evaluate(f"window.scrollBy(0, -{reverse})")

        await self.human_delay(0.2, 0.6)

    async def random_idle(self) -> None:
        """たまにある『何もしない時間』を再現"""
        if random.random() < 0.15:
            idle_time = random.uniform(1.0, 3.0)
            logger.debug(f"[{self.name}] アイドル: {idle_time:.1f}秒")
            await asyncio.sleep(idle_time)

    # ------------------------------------------------------------------
    # 要素検索ヘルパー
    # ------------------------------------------------------------------

    async def find(self, selector: str, timeout: int = 10):
        try:
            return await self._page.find(selector, timeout=timeout)
        except Exception:
            return None

    async def find_all(self, selector: str) -> list:
        try:
            return await self._page.select_all(selector)
        except Exception:
            return []

    async def query(self, selector: str):
        try:
            return await self._page.query_selector(selector)
        except Exception:
            return None

    # ------------------------------------------------------------------
    # CAPTCHA 検知
    # ------------------------------------------------------------------

    async def detect_captcha(self) -> bool:
        captcha_selectors = [
            "iframe[src*='recaptcha']",
            "iframe[src*='captcha']",
            ".g-recaptcha",
            "#captcha",
            "[class*='captcha']",
            "[id*='captcha']",
            "img[src*='captcha']",
            "iframe[title*='reCAPTCHA']",
            "iframe[src*='hcaptcha']",
            ".h-captcha",
            "iframe[src*='challenges.cloudflare']",
            ".cf-turnstile",
            # Akamai Bot Manager の画像チャレンジ
            "#sec-cpt-if",
            "iframe[src*='akamaihd']",
        ]

        for selector in captcha_selectors:
            try:
                element = await self.query(selector)
                if element:
                    self._captcha_detected = True
                    logger.warning(f"[{self.name}] CAPTCHA検知: {selector}")
                    await self.screenshot("captcha_detected")
                    return True
            except Exception:
                continue

        try:
            body_text = await self._page.evaluate("document.body.innerText")
            captcha_keywords = [
                "画像認証", "captcha", "ロボットではない",
                "確認してください", "I'm not a robot",
                "セキュリティチェック", "不正なアクセス",
                "Access Denied", "Request blocked",
            ]
            for keyword in captcha_keywords:
                if keyword.lower() in body_text.lower():
                    self._captcha_detected = True
                    logger.warning(f"[{self.name}] CAPTCHA検知(テキスト): {keyword}")
                    await self.screenshot("captcha_detected_text")
                    return True
        except Exception:
            pass

        return False

    @property
    def captcha_detected(self) -> bool:
        return self._captcha_detected

    def reset_captcha_flag(self) -> None:
        self._captcha_detected = False

    # ------------------------------------------------------------------
    # ログイン
    # ------------------------------------------------------------------

    @abstractmethod
    async def login(self) -> bool:
        ...

    @abstractmethod
    async def is_logged_in(self) -> bool:
        ...

    async def ensure_logged_in(self) -> bool:
        """ログイン状態を保証（80% TTLでプリエンプティブ再ログイン）"""
        if self._is_session_expired():
            logger.info(f"[{self.name}] セッション期限切れ → 再ログイン")
            self.clear_cookies()
        elif self._should_preemptive_relogin():
            logger.info(f"[{self.name}] プリエンプティブ再ログイン（80% TTL）")
            # Cookie は残してまずログイン状態を確認
            if await self.is_logged_in():
                logger.debug(f"[{self.name}] まだ有効だがCookie更新")
                await self._save_cookies()
                self._last_login_time = datetime.now(JST)
                return True
        elif await self.is_logged_in():
            logger.debug(f"[{self.name}] セッション有効")
            await self._save_cookies()
            return True

        logger.info(f"[{self.name}] ログイン実行...")
        success = await self.login()

        if success:
            self._last_login_time = datetime.now(JST)
            await self._save_cookies()
            if await self.detect_captcha():
                return False

        return success

    def _should_preemptive_relogin(self) -> bool:
        """80% TTLに達したか"""
        if self._last_login_time is None:
            return False
        age_hours = (datetime.now(JST) - self._last_login_time).total_seconds() / 3600
        return age_hours > (self.SESSION_MAX_AGE_HOURS * 0.8)

    def _is_session_expired(self) -> bool:
        now = datetime.now(JST)
        if self._last_login_time is None:
            if self.cookies_path.exists():
                import os
                mtime = datetime.fromtimestamp(
                    os.path.getmtime(self.cookies_path), tz=JST
                )
                return (now - mtime).total_seconds() / 3600 > self.SESSION_MAX_AGE_HOURS
            return False
        return (now - self._last_login_time).total_seconds() / 3600 > self.SESSION_MAX_AGE_HOURS

    # ------------------------------------------------------------------
    # セッション切れ検知と自動復旧
    # ------------------------------------------------------------------

    async def detect_session_expired(self) -> bool:
        try:
            current_url = self._page.url
            if "/login" in current_url.lower():
                logger.warning(f"[{self.name}] セッション切れ（ログインページにリダイレクト）")
                return True

            body_text = await self._page.evaluate("document.body.innerText")
            for keyword in [
                "ログインの有効期限が切れました",
                "一定時間操作されなかった",
                "セッションが切れ",
                "再度ログイン",
            ]:
                if keyword in body_text:
                    logger.warning(f"[{self.name}] セッション切れ: {keyword}")
                    return True
        except Exception:
            pass
        return False

    async def recover_session(self) -> bool:
        logger.info(f"[{self.name}] セッション復旧開始...")
        self.clear_cookies()

        try:
            await self.close_browser()
            await self.start_browser()

            success = await self.login()
            if success:
                self._last_login_time = datetime.now(JST)
                await self._save_cookies()
                self._consecutive_failures = 0
                logger.info(f"[{self.name}] セッション復旧成功")
            return success
        except Exception as e:
            logger.error(f"[{self.name}] セッション復旧失敗: {e}")
            return False

    # ------------------------------------------------------------------
    # データ取得
    # ------------------------------------------------------------------

    @abstractmethod
    async def fetch_reservations(self, target_date: str) -> list[dict]:
        ...

    async def fetch_reservations_safe(self, target_date: str) -> list[dict]:
        """予約取得（セッション切れ自動復旧 + メモリリーク対策付き）"""
        await self.maybe_restart_browser()

        for attempt in range(self._max_retries):
            try:
                reservations = await self.fetch_reservations(target_date)

                if await self.detect_session_expired():
                    logger.warning(
                        f"[{self.name}] セッション切れ → 復旧 ({attempt + 1}/{self._max_retries})"
                    )
                    if await self.recover_session():
                        continue
                    else:
                        break

                self._consecutive_failures = 0
                return reservations

            except Exception as e:
                self._consecutive_failures += 1
                logger.error(
                    f"[{self.name}] 予約取得エラー ({attempt + 1}/{self._max_retries}): {e}"
                )
                if attempt < self._max_retries - 1:
                    wait = (2 ** attempt) + random.uniform(0, 1)
                    logger.info(f"[{self.name}] {wait:.1f}秒後にリトライ")
                    await asyncio.sleep(wait)

        return []

    # ------------------------------------------------------------------
    # ユーティリティ
    # ------------------------------------------------------------------

    async def screenshot(self, name: str) -> Path:
        timestamp = datetime.now(JST).strftime("%Y%m%d_%H%M%S")
        filename = f"{self.name}_{name}_{timestamp}.png"
        path = SCREENSHOTS_DIR / filename
        try:
            await self._page.save_screenshot(str(path))
            logger.info(f"[{self.name}] スクショ保存: {path}")
        except Exception as e:
            logger.error(f"[{self.name}] スクショ失敗: {e}")
        return path

    async def safe_goto(self, url: str, timeout: int = 30) -> bool:
        """安全なページ遷移（ステルス再注入 + Akamai _abck検証待ち）"""
        try:
            self._page = await self._browser.get(url, new_tab=False)

            # 新タブバグ対策: CDPステルスが効いてない可能性があるので再注入
            await self._reinject_stealth_for_tab()

            # Akamaiセンサーの実行を待つ
            # _abck クッキーが -1~-1 → センサー未完了
            # センサーJS（527KB）のロード+実行+テレメトリ送信に2-4秒かかる
            await self._wait_for_akamai_sensor()

            await self.random_idle()

            return True
        except Exception as e:
            logger.error(f"[{self.name}] ページ遷移失敗 {url}: {e}")
            try:
                await self.screenshot("goto_failed")
            except Exception:
                pass
            return False

    async def _reinject_stealth_for_tab(self) -> None:
        """
        zendriver既知バグ対策:
        add_script_to_evaluate_on_new_document は新タブに適用されないことがある。
        ページ遷移ごとにCDPで再登録 + フォールバックでevaluateも実行。
        """
        try:
            stealth_js = build_stealth_js(self._viewport, self._user_agent)

            # CDPで再登録（冪等: 同じスクリプトが複数回登録されても問題ない）
            await self._page.send(
                cdp.page.add_script_to_evaluate_on_new_document(
                    source=stealth_js
                )
            )
        except Exception:
            pass

        # フォールバック: evaluate で即時実行（既にページJSが走ってる可能性あり）
        await self._inject_stealth_fallback()

    async def _wait_for_akamai_sensor(self) -> None:
        """
        Akamaiセンサーの完了を待つ。

        _abck クッキーの値が "-1~-1~-1~-1~-1" → 未検証
        センサーJS実行後 → 値が変わる（検証済み）

        最大5秒待って、検証済みにならなくても続行
        （Akamaiが無いサイトでもタイムアウトで進める）
        """
        for _ in range(10):
            await asyncio.sleep(0.5)
            try:
                abck = await self._page.evaluate("""
                    document.cookie.split(';')
                        .map(c => c.trim())
                        .find(c => c.startsWith('_abck='))
                """)
                if abck and "-1~-1~-1~-1~-1" not in abck:
                    logger.debug(f"[{self.name}] Akamaiセンサー検証完了")
                    return
                # _abck がない = Akamai不使用サイト → 即続行
                if not abck:
                    await self.human_delay(0.5, 1.5)
                    return
            except Exception:
                break

        # タイムアウト（5秒）: 続行するが警告
        logger.debug(f"[{self.name}] Akamaiセンサー待ちタイムアウト（続行）")

    async def wait_for_url(self, condition, timeout: int = 15) -> bool:
        import time
        end_time = time.time() + timeout
        while time.time() < end_time:
            try:
                if condition(self._page.url):
                    return True
            except Exception:
                pass
            await asyncio.sleep(0.5)
        return False
