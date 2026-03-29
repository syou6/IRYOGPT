"""
ブラウザステルス対策（puppeteer-extra-plugin-stealth 完全互換）

puppeteer-extra-plugin-stealth の17モジュール全てを
zendriver の CDP API で再実装。

重要: page.evaluate() ではなく
cdp.page.add_script_to_evaluate_on_new_document を使うこと。
→ ページのJSより先に実行されるため、Akamaiセンサー等の
  検知スクリプトが走る前にパッチが適用される。

対策一覧（puppeteer-extra-plugin-stealth 17モジュール対応）:
 1. navigator.webdriver          ← zendriver がアーキテクチャレベルで対応済み
 2. chrome.app                   ← 本ファイルで対応
 3. chrome.csi                   ← 本ファイルで対応
 4. chrome.loadTimes             ← 本ファイルで対応
 5. chrome.runtime               ← 本ファイルで対応
 6. defaultArgs                  ← browser_args で対応
 7. iframe.contentWindow         ← 本ファイルで対応
 8. media.codecs                 ← 本ファイルで対応
 9. navigator.hardwareConcurrency← 本ファイルで対応
10. navigator.languages          ← 本ファイルで対応
11. navigator.permissions        ← 本ファイルで対応
12. navigator.plugins            ← 本ファイルで対応
13. navigator.vendor             ← 本ファイルで対応
14. sourceurl                    ← evaluate不使用で回避
15. user-agent-override          ← 本ファイルで対応
16. webgl.vendor                 ← 本ファイルで対応
17. window.outerdimensions       ← 本ファイルで対応

追加対策（Akamai Bot Manager対策）:
18. Canvas指紋ノイズ
19. Battery API
20. connection.rtt
21. deviceMemory
22. console.debug 抑制
"""

import math
import random


def build_stealth_js(viewport: tuple[int, int], user_agent: str) -> str:
    """
    ステルスJSを生成（ビューポートとUA情報を埋め込む）

    cdp.page.add_script_to_evaluate_on_new_document で注入すること。
    page.evaluate() は使わない（タイミングが遅すぎる）。
    """
    w, h = viewport

    return """
(() => {
    // 既に注入済みならスキップ
    if (window.__stealth_injected__) return;
    window.__stealth_injected__ = true;

    // ================================================================
    // 1. navigator.webdriver（zendriver がアーキテクチャレベルで対処済み
    //    だが、二重保険として明示的に削除）
    // ================================================================
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true,
    });
    // prototype チェーンでも削除
    delete Object.getPrototypeOf(navigator).webdriver;

    // ================================================================
    // 2. chrome.app
    // ================================================================
    if (!window.chrome) window.chrome = {};
    window.chrome.app = {
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        getDetails: function() { return null; },
        getIsInstalled: function() { return false; },
        installState: function() { return 'not_installed'; },
        isInstalled: false,
        runningState: function() { return 'cannot_run'; },
    };

    // ================================================================
    // 3. chrome.csi
    // ================================================================
    window.chrome.csi = function() {
        return {
            onloadT: Date.now(),
            startE: Date.now(),
            pageT: Math.random() * 1000 + 500,
            tran: 15,
        };
    };

    // ================================================================
    // 4. chrome.loadTimes
    // ================================================================
    window.chrome.loadTimes = function() {
        return {
            commitLoadTime: Date.now() / 1000,
            connectionInfo: 'h2',
            finishDocumentLoadTime: Date.now() / 1000 + 0.1,
            finishLoadTime: Date.now() / 1000 + 0.2,
            firstPaintAfterLoadTime: 0,
            firstPaintTime: Date.now() / 1000 + 0.05,
            navigationType: 'Other',
            npnNegotiatedProtocol: 'h2',
            requestTime: Date.now() / 1000 - 0.3,
            startLoadTime: Date.now() / 1000 - 0.2,
            wasAlternateProtocolAvailable: false,
            wasFetchedViaSpdy: true,
            wasNpnNegotiated: true,
        };
    };

    // ================================================================
    // 5. chrome.runtime
    // ================================================================
    window.chrome.runtime = {
        OnInstalledReason: {
            CHROME_UPDATE: 'chrome_update',
            INSTALL: 'install',
            SHARED_MODULE_UPDATE: 'shared_module_update',
            UPDATE: 'update',
        },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
        PlatformArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
        PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
        RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
        connect: function() { return { onDisconnect: { addListener: function() {} }, onMessage: { addListener: function() {} }, postMessage: function() {} }; },
        sendMessage: function() {},
        id: undefined,
    };

    // ================================================================
    // 7. iframe.contentWindow
    // ================================================================
    const origContentWindow = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype, 'contentWindow'
    );
    if (origContentWindow) {
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function() {
                const win = origContentWindow.get.call(this);
                if (win) {
                    try {
                        Object.defineProperty(win.navigator, 'webdriver', {
                            get: () => undefined, configurable: true,
                        });
                    } catch(e) {}
                }
                return win;
            },
            configurable: true,
        });
    }

    // ================================================================
    // 8. media.codecs
    // ================================================================
    const origCanPlayType = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function(type) {
        // 一般的なコーデックは全て対応と返す
        if (type.includes('video/mp4') || type.includes('video/webm') ||
            type.includes('audio/mpeg') || type.includes('audio/mp4') ||
            type.includes('audio/webm') || type.includes('audio/ogg')) {
            return 'probably';
        }
        return origCanPlayType.call(this, type);
    };

    // ================================================================
    // 9. navigator.hardwareConcurrency
    // ================================================================
    Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8, configurable: true,
    });

    // ================================================================
    // 10. navigator.languages
    // ================================================================
    Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'ja', 'en-US', 'en'],
        configurable: true,
    });

    // ================================================================
    // 11. navigator.permissions
    // ================================================================
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
        window.navigator.permissions.query = (parameters) => {
            if (parameters.name === 'notifications') {
                return Promise.resolve({ state: Notification.permission });
            }
            return originalQuery.call(window.navigator.permissions, parameters);
        };
    }

    // ================================================================
    // 12. navigator.plugins + mimeTypes
    // ================================================================
    function makePluginArray() {
        const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer',
              description: 'Portable Document Format', length: 1,
              0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' } },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              description: '', length: 1,
              0: { type: 'application/pdf', suffixes: 'pdf', description: '' } },
            { name: 'Native Client', filename: 'internal-nacl-plugin',
              description: '', length: 2,
              0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
              1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' } },
        ];
        const arr = Object.create(PluginArray.prototype);
        plugins.forEach((p, i) => { arr[i] = Object.create(Plugin.prototype, Object.getOwnPropertyDescriptors(p)); });
        Object.defineProperty(arr, 'length', { get: () => 3 });
        arr.item = (i) => arr[i] || null;
        arr.namedItem = (n) => plugins.find(p => p.name === n) || null;
        arr.refresh = () => {};
        return arr;
    }

    Object.defineProperty(navigator, 'plugins', {
        get: () => makePluginArray(), configurable: true,
    });

    function makeMimeTypeArray() {
        const mimes = [
            { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
            { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
        ];
        const arr = Object.create(MimeTypeArray.prototype);
        mimes.forEach((m, i) => { arr[i] = Object.create(MimeType.prototype, Object.getOwnPropertyDescriptors(m)); });
        Object.defineProperty(arr, 'length', { get: () => 4 });
        arr.item = (i) => arr[i] || null;
        arr.namedItem = (n) => mimes.find(m => m.type === n) || null;
        return arr;
    }

    Object.defineProperty(navigator, 'mimeTypes', {
        get: () => makeMimeTypeArray(), configurable: true,
    });

    // ================================================================
    // 13. navigator.vendor
    // ================================================================
    Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.', configurable: true,
    });

    // ================================================================
    // 15. user-agent-override（userAgentData API）
    // ================================================================
    if (navigator.userAgentData) {
        const brands = [
            { brand: 'Google Chrome', version: '""" + user_agent.split("Chrome/")[1].split(".")[0] if "Chrome/" in user_agent else "146" + """' },
            { brand: 'Chromium', version: '""" + user_agent.split("Chrome/")[1].split(".")[0] if "Chrome/" in user_agent else "146" + """' },
            { brand: 'Not_A Brand', version: '24' },
        ];
        Object.defineProperty(navigator, 'userAgentData', {
            get: () => ({
                brands: brands,
                mobile: false,
                platform: 'Windows',
                getHighEntropyValues: () => Promise.resolve({
                    architecture: 'x86',
                    bitness: '64',
                    brands: brands,
                    fullVersionList: brands,
                    mobile: false,
                    model: '',
                    platform: 'Windows',
                    platformVersion: '15.0.0',
                    uaFullVersion: '""" + (user_agent.split("Chrome/")[1].split(" ")[0] if "Chrome/" in user_agent else "146.0.0.0") + """',
                    wow64: false,
                }),
            }),
            configurable: true,
        });
    }

    // ================================================================
    // 16. webgl.vendor
    // ================================================================
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 0x9245) return 'Google Inc. (NVIDIA)';
        if (param === 0x9246) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        return getParameter.call(this, param);
    };
    if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
            if (param === 0x9245) return 'Google Inc. (NVIDIA)';
            if (param === 0x9246) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)';
            return getParameter2.call(this, param);
        };
    }

    // ================================================================
    // 17. window.outerdimensions（Xvfb対策: 必須）
    //     ヘッドレスやXvfbでは outerWidth/outerHeight が 0 になる
    //     → Akamai Bot Manager が即検知する
    // ================================================================
    Object.defineProperty(window, 'outerWidth', {
        get: () => """ + str(w) + """, configurable: true,
    });
    Object.defineProperty(window, 'outerHeight', {
        get: () => """ + str(h + 85) + """, configurable: true,  // +85 = ツールバー高さ
    });
    Object.defineProperty(window, 'innerWidth', {
        get: () => """ + str(w) + """, configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
        get: () => """ + str(h) + """, configurable: true,
    });
    // screen も一貫性を持たせる
    Object.defineProperty(screen, 'width', {
        get: () => """ + str(w) + """, configurable: true,
    });
    Object.defineProperty(screen, 'height', {
        get: () => """ + str(h + 85) + """, configurable: true,
    });
    Object.defineProperty(screen, 'availWidth', {
        get: () => """ + str(w) + """, configurable: true,
    });
    Object.defineProperty(screen, 'availHeight', {
        get: () => """ + str(h + 45) + """, configurable: true,
    });

    // ================================================================
    // 18. Canvas指紋ノイズ
    // ================================================================
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const origToBlob = HTMLCanvasElement.prototype.toBlob;

    // セッション固定のシード
    const seed = """ + str(random.randint(1, 255)) + """;

    HTMLCanvasElement.prototype.toDataURL = function() {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
            try {
                const img = ctx.getImageData(0, 0, Math.min(this.width, 3), Math.min(this.height, 3));
                for (let i = 0; i < img.data.length; i += 4) {
                    img.data[i] = (img.data[i] + seed) % 256;
                }
                ctx.putImageData(img, 0, 0);
            } catch(e) {}
        }
        return origToDataURL.apply(this, arguments);
    };

    // ================================================================
    // 19. Battery API
    // ================================================================
    if (navigator.getBattery) {
        navigator.getBattery = () => Promise.resolve({
            charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1.0,
            addEventListener: () => {}, removeEventListener: () => {},
            dispatchEvent: () => true,
        });
    }

    // ================================================================
    // 20. connection.rtt / downlink
    // ================================================================
    if (navigator.connection) {
        Object.defineProperty(navigator.connection, 'rtt', { get: () => 50, configurable: true });
        Object.defineProperty(navigator.connection, 'downlink', { get: () => 10, configurable: true });
        Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g', configurable: true });
        Object.defineProperty(navigator.connection, 'saveData', { get: () => false, configurable: true });
    }

    // ================================================================
    // 21. deviceMemory
    // ================================================================
    Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8, configurable: true,
    });

    // ================================================================
    // 22. cdc_ プロパティの削除（ChromeDriver痕跡）
    // ================================================================
    for (const prop of Object.getOwnPropertyNames(document)) {
        if (prop.startsWith('cdc_') || prop.startsWith('$cdc_')) {
            delete document[prop];
        }
    }
    for (const prop of Object.getOwnPropertyNames(window)) {
        if (prop.startsWith('cdc_') || prop.startsWith('$cdc_')) {
            delete window[prop];
        }
    }

    // ================================================================
    // 23. console.debug 抑制（bot検知用のシリアライゼーション攻撃対策）
    // ================================================================
    const origDebug = console.debug;
    console.debug = function(...args) {
        const str = args.map(a => String(a)).join(' ');
        if (str.includes('cdc_') || str.includes('webdriver')) return;
        return origDebug.apply(this, args);
    };

    // ================================================================
    // 24. toString() 保護（native code として見せる）
    // ================================================================
    const nativeToString = Function.prototype.toString;
    const spoofedFns = new Set();

    function makeNative(fn, name) {
        spoofedFns.add(fn);
        const handler = {
            apply: function(target, thisArg, args) {
                if (spoofedFns.has(thisArg)) {
                    return 'function ' + (name || thisArg.name || '') + '() { [native code] }';
                }
                return nativeToString.apply(thisArg, args);
            }
        };
        Function.prototype.toString = new Proxy(Function.prototype.toString, handler);
    }

    // 主要な偽装関数をnativeに見せる
    if (navigator.permissions?.query) makeNative(navigator.permissions.query, 'query');
    if (navigator.getBattery) makeNative(navigator.getBattery, 'getBattery');

})();
"""


# ------------------------------------------------------------------
# ベジェ曲線マウス移動
# ------------------------------------------------------------------

def bezier_curve(
    start: tuple[float, float],
    end: tuple[float, float],
    steps: int = 0,
) -> list[tuple[int, int]]:
    """
    3次ベジェ曲線で自然なマウスパスを生成
    """
    sx, sy = start
    ex, ey = end

    dist = math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)

    if steps == 0:
        steps = max(10, int(dist / 15))

    deviation = dist * random.uniform(0.1, 0.35)
    cp1 = (
        sx + (ex - sx) * random.uniform(0.2, 0.5) + random.uniform(-deviation, deviation),
        sy + (ey - sy) * random.uniform(0.2, 0.5) + random.uniform(-deviation, deviation),
    )
    cp2 = (
        sx + (ex - sx) * random.uniform(0.5, 0.8) + random.uniform(-deviation, deviation),
        sy + (ey - sy) * random.uniform(0.5, 0.8) + random.uniform(-deviation, deviation),
    )

    points = []
    for i in range(steps + 1):
        t = i / steps
        inv_t = 1 - t

        x = (inv_t ** 3 * sx + 3 * inv_t ** 2 * t * cp1[0]
             + 3 * inv_t * t ** 2 * cp2[0] + t ** 3 * ex)
        y = (inv_t ** 3 * sy + 3 * inv_t ** 2 * t * cp1[1]
             + 3 * inv_t * t ** 2 * cp2[1] + t ** 3 * ey)

        jitter = max(1, dist * 0.005)
        x += random.uniform(-jitter, jitter)
        y += random.uniform(-jitter, jitter)

        points.append((int(x), int(y)))

    points[-1] = (int(ex), int(ey))
    return points


def random_viewport() -> tuple[int, int]:
    """一般的なデスクトップ解像度からランダムに選択"""
    viewports = [
        (1366, 768),
        (1440, 900),
        (1536, 864),
        (1280, 720),
        (1920, 1080),
        (1600, 900),
        (1280, 800),
        (1280, 1024),
    ]
    return random.choice(viewports)
