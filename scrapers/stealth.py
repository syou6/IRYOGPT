"""
ブラウザステルス対策

zendriver（CDP直接通信）に加えて、JavaScriptレベルでの
ブラウザフィンガープリント偽装を行う。

対策一覧:
1. navigator.webdriver の削除
2. Chrome自動化拡張の痕跡隠蔽
3. WebGL/Canvasフィンガープリント安定化
4. Permission API 正常化
5. Plugin/MimeType の偽装
6. iframe contentWindow の保護
7. ベジェ曲線によるマウス移動
"""

import math
import random

# ------------------------------------------------------------------
# ステルスJS（ページ遷移ごとに注入）
# ------------------------------------------------------------------

STEALTH_JS = """
(() => {
    // 既に注入済みならスキップ
    if (window.__stealth_injected__) return;
    window.__stealth_injected__ = true;

    // --- 1. navigator.webdriver の完全削除 ---
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true,
    });

    // --- 2. Chrome自動化フラグの隠蔽 ---
    // chrome.runtime が存在するように偽装
    if (!window.chrome) {
        window.chrome = {};
    }
    if (!window.chrome.runtime) {
        window.chrome.runtime = {
            connect: () => {},
            sendMessage: () => {},
            onMessage: { addListener: () => {} },
        };
    }

    // cdc_ プロパティの削除（ChromeDriverの痕跡）
    const cdcProps = Object.getOwnPropertyNames(document)
        .filter(p => p.startsWith('cdc_') || p.startsWith('$cdc_'));
    cdcProps.forEach(p => { delete document[p]; });

    // --- 3. Permissions API の正常化 ---
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
        window.navigator.permissions.query = (parameters) => {
            if (parameters.name === 'notifications') {
                return Promise.resolve({ state: Notification.permission });
            }
            return originalQuery.call(window.navigator.permissions, parameters);
        };
    }

    // --- 4. Plugin / MimeType の偽装 ---
    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const plugins = [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer',
                  description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                  description: '' },
                { name: 'Native Client', filename: 'internal-nacl-plugin',
                  description: '' },
            ];
            plugins.length = 3;
            plugins.item = (i) => plugins[i] || null;
            plugins.namedItem = (n) => plugins.find(p => p.name === n) || null;
            plugins.refresh = () => {};
            return plugins;
        },
        configurable: true,
    });

    Object.defineProperty(navigator, 'mimeTypes', {
        get: () => {
            const mimeTypes = [
                { type: 'application/pdf', suffixes: 'pdf',
                  description: 'Portable Document Format',
                  enabledPlugin: navigator.plugins[0] },
            ];
            mimeTypes.length = 1;
            mimeTypes.item = (i) => mimeTypes[i] || null;
            mimeTypes.namedItem = (n) => mimeTypes.find(m => m.type === n) || null;
            return mimeTypes;
        },
        configurable: true,
    });

    // --- 5. languages の一貫性 ---
    Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'ja', 'en-US', 'en'],
        configurable: true,
    });

    // --- 6. WebGL ベンダー/レンダラーの安定化 ---
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
        // UNMASKED_VENDOR_WEBGL
        if (param === 0x9245) return 'Google Inc. (NVIDIA)';
        // UNMASKED_RENDERER_WEBGL
        if (param === 0x9246) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        return getParameter.call(this, param);
    };

    // WebGL2 も同様に
    if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
            if (param === 0x9245) return 'Google Inc. (NVIDIA)';
            if (param === 0x9246) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0, D3D11)';
            return getParameter2.call(this, param);
        };
    }

    // --- 7. Canvas指紋にノイズ注入（微小な変動で一貫性を維持）---
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
        if (this.width === 0 && this.height === 0) {
            return origToDataURL.apply(this, arguments);
        }
        const ctx = this.getContext('2d');
        if (ctx) {
            const imageData = ctx.getImageData(0, 0, Math.min(this.width, 2), Math.min(this.height, 2));
            // セッション固定のシードでわずかなノイズ
            if (!window.__canvas_seed__) {
                window.__canvas_seed__ = Math.floor(Math.random() * 10);
            }
            imageData.data[0] = (imageData.data[0] + window.__canvas_seed__) % 256;
            ctx.putImageData(imageData, 0, 0);
        }
        return origToDataURL.apply(this, arguments);
    };

    // --- 8. iframe contentWindow の保護 ---
    // bot検知がiframe内のnavigator.webdriverをチェックする対策
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
                            get: () => undefined,
                            configurable: true,
                        });
                    } catch(e) {}
                }
                return win;
            },
            configurable: true,
        });
    }

    // --- 9. console.debug への自動化検知ログを抑制 ---
    const origDebug = console.debug;
    console.debug = function(...args) {
        const str = args.join(' ');
        if (str.includes('cdc_') || str.includes('webdriver')) return;
        return origDebug.apply(this, args);
    };

    // --- 10. connection.rtt の安定化（ネットワーク指紋）---
    if (navigator.connection) {
        Object.defineProperty(navigator.connection, 'rtt', {
            get: () => 50,
            configurable: true,
        });
    }

    // --- 11. hardwareConcurrency / deviceMemory の安定化 ---
    Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
        configurable: true,
    });
    Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
        configurable: true,
    });

    // --- 12. Battery API の正常化 ---
    if (navigator.getBattery) {
        navigator.getBattery = () => Promise.resolve({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1.0,
            addEventListener: () => {},
        });
    }
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

    Args:
        start: 開始座標 (x, y)
        end: 終了座標 (x, y)
        steps: ステップ数（0=距離から自動計算）

    Returns:
        (x, y) のリスト
    """
    sx, sy = start
    ex, ey = end

    dist = math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)

    if steps == 0:
        steps = max(10, int(dist / 15))

    # 制御点をランダムに（自然な曲がりを再現）
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

        x = (
            inv_t ** 3 * sx
            + 3 * inv_t ** 2 * t * cp1[0]
            + 3 * inv_t * t ** 2 * cp2[0]
            + t ** 3 * ex
        )
        y = (
            inv_t ** 3 * sy
            + 3 * inv_t ** 2 * t * cp1[1]
            + 3 * inv_t * t ** 2 * cp2[1]
            + t ** 3 * ey
        )

        # 微小なジッター（人間の手ブレ）
        jitter = max(1, dist * 0.005)
        x += random.uniform(-jitter, jitter)
        y += random.uniform(-jitter, jitter)

        points.append((int(x), int(y)))

    # 最後は正確に目標に到達
    points[-1] = (int(ex), int(ey))

    return points


def random_viewport() -> tuple[int, int]:
    """
    一般的なデスクトップ解像度からランダムに選択

    ブラウザ起動のたびに異なるサイズにすることで指紋を分散。
    ただし極端なサイズは避ける。
    """
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
