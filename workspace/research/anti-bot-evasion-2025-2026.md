# Anti-Bot Evasion Techniques 2025-2026: Gap Analysis vs Current Implementation

> Research date: 2026-03-30
> Codebase: `/Users/sho/yoyakuraku/IRYOGPT/scrapers/`
> Key files: `stealth.py`, `base_scraper.py`

---

## Executive Summary

The current scraper stack is well-built for Akamai Bot Manager evasion: puppeteer-extra-plugin-stealth full 17-module coverage, WindMouse, Bezier fallback, CDP injection timing, and Xvfb+headless=False are all best practices. However, six significant gaps exist that could cause detection on hardened targets in 2026: AudioContext fingerprinting, WebRTC IP leak, Runtime.enable CDP leak (rebrowser-patches pattern), HTTP/2 fingerprint mismatch from proxy chains, screen.devicePixelRatio/colorDepth fixup on Xvfb, and IP-layer datacenter flagging (ConoHa VPS). Two medium-priority gaps (scroll physics, Poisson-distributed timing) would improve behavioral plausibility. One low-priority gap (font enumeration defense) is a theoretical concern for most targets.

---

## Area 1: TLS / Network Layer

### 1.1 JA3/JA4 TLS Fingerprint

**What it is:** JA3 hashes the ClientHello fields (cipher suites, extensions, elliptic curves) into a 32-char MD5. JA4 improves on it by sorting extensions alphabetically before hashing, making it stable against Chrome's TLS ClientHello permutation feature (Chrome since v117 shuffles extension order on every connection, breaking JA3 consistency). Akamai, Cloudflare, and DataDome all ingest JA3/JA4 as a detection signal.

**Do we handle it?** YES — implicitly. Because zendriver controls a real Chrome binary, the TLS handshake is produced by Chrome's BoringSSL stack, not by a Python `ssl` module or `requests` library. Chrome's JA3/JA4 profile matches a genuine browser by definition. No custom action required.

**Caveat:** If you ever route requests through a Python `requests`/`httpx` proxy layer (e.g., for API calls or sidecar requests), those calls will emit a Python TLS fingerprint, not Chrome's. Keep all traffic inside the browser or through curl_cffi with `impersonate="chrome131"`.

**Priority:** MEDIUM (no action needed for current zendriver-only approach; becomes CRITICAL if any Python HTTP client is added)
**Difficulty:** N/A for current stack; LOW for curl_cffi addition if needed

---

### 1.2 HTTP/2 Fingerprint (SETTINGS, WINDOW_UPDATE, Pseudo-Header Order)

**What it is:** HTTP/2 connections start with a SETTINGS frame that includes 6 parameters: HEADER_TABLE_SIZE, ENABLE_PUSH, MAX_CONCURRENT_STREAMS, INITIAL_WINDOW_SIZE, MAX_FRAME_SIZE, MAX_HEADER_LIST_SIZE. Each HTTP client library has hardcoded defaults that differ from Chrome. Additionally, Chrome sends pseudo-headers in a fixed order: `:method`, `:authority`, `:scheme`, `:path`. Python's `httpx`/`aiohttp`/`requests` all send different SETTINGS values and header orderings that are trivially fingerprinted.

Chrome's canonical HTTP/2 SETTINGS (as of Chrome 120+):
```
HEADER_TABLE_SIZE: 65536
ENABLE_PUSH: 1
MAX_CONCURRENT_STREAMS: 1000
INITIAL_WINDOW_SIZE: 6291456
MAX_FRAME_SIZE: 16384
MAX_HEADER_LIST_SIZE: 262144
WINDOW_UPDATE: 15663105
```

**Do we handle it?** YES — implicitly, same reason as JA3: zendriver drives real Chrome which produces real HTTP/2 frames. The risk is the same as above: any sidecar Python HTTP calls will expose a non-Chrome H2 fingerprint.

**Priority:** MEDIUM (same caveat as JA3)
**Difficulty:** LOW if using curl_cffi; HIGH if implementing natively

---

### 1.3 TCP Fingerprint (JA4T / TCP Window Size / TTL)

**What it is:** JA4T fingerprints the TCP SYN packet: window size, MSS, options order (timestamp, SACK, NOP, window scaling), and TTL. A Linux VPS produces TTL=64, window_size=65535 by default. A Windows desktop produces TTL=128, window_size=65535 but with different TCP option ordering. Akamai uses JA4T as an additional signal but it is a network-layer fingerprint, not browser-layer.

**Do we handle it?** NO. The VPS (ConoHa, Linux) sends Linux TCP SYN packets regardless of what Chrome does.

**Priority:** LOW — Akamai weights browser-layer signals far more heavily than TCP-layer for standard bot detection. TCP fingerprinting is used more by enterprise DPI appliances. The ConoHa IP reputation problem (see 5.2) is a larger concern.
**Difficulty:** VERY HIGH — requires kernel-level modification (`tc qdisc`, `iptables NFQUEUE`, or `nfqueue-bindings`). Not practical for this use case.

---

## Area 2: Browser Fingerprint Gaps

### 2.1 AudioContext Fingerprinting

**What it is:** Websites create an `OfflineAudioContext`, instantiate an `OscillatorNode` and `DynamicsCompressorNode`, render the audio buffer, then hash the resulting float32 array. The output varies by CPU, GPU, OS audio stack, and sample rate. On a VPS with no physical audio hardware, Chrome uses a software renderer (typically PulseAudio/ALSA stub or the internal Chrome audio renderer) which produces a different fingerprint hash than consumer laptops. Brave defends against this with "farbling" — deterministic per-domain randomization with 0.00000014% to 0.00000214% signal noise.

**Current state in `stealth.py`:** NOT PRESENT. The 22 existing patches do not include AudioContext.

**Do we handle it?** NO.

**Priority:** HIGH — Akamai Bot Manager's sensor data JS explicitly collects audio fingerprint data as part of its telemetry payload. Mismatches between claimed OS (Windows, via userAgentData) and VPS audio stack are detectable.

**Implementation:**
```javascript
// Inject via add_script_to_evaluate_on_new_document
const audioCtxProto = window.AudioContext || window.webkitAudioContext;
const origCreateOscillator = audioCtxProto.prototype.createOscillator;
const origCreateDynamicsCompressor = audioCtxProto.prototype.createDynamicsCompressor;

// Offline context: spoof getChannelData output
const OrigOfflineCtx = window.OfflineAudioContext;
window.OfflineAudioContext = class extends OrigOfflineCtx {
    startRendering() {
        return super.startRendering().then(buffer => {
            // Apply deterministic per-session noise (same seed as canvas noise)
            const data = buffer.getChannelData(0);
            const noise = 0.0000001; // Brave-level farbling
            for (let i = 0; i < data.length; i++) {
                data[i] += (Math.random() * 2 - 1) * noise;
            }
            return buffer;
        });
    }
};
makeNative(window.OfflineAudioContext, 'OfflineAudioContext');
```

**Difficulty:** LOW (15 lines of JS to add to `build_stealth_js`)

---

### 2.2 WebGL2 Advanced (Shader Precision, Extensions List)

**What it is:** Current `stealth.py` patches `WebGLRenderingContext.getParameter` for params `0x9245` (VENDOR) and `0x9246` (RENDERER) only. Advanced detection checks:
- `getSupportedExtensions()` — headless Chrome on a VPS may have fewer extensions than desktop Chrome with NVIDIA GPU
- `getShaderPrecisionFormat()` — returns precision for FRAGMENT_SHADER/VERTEX_SHADER; differs between real NVIDIA and SwiftShader
- `MAX_TEXTURE_SIZE`, `MAX_VIEWPORT_DIMS`, `ALIASED_LINE_WIDTH_RANGE` — cross-check with reported GPU
- `getExtension('WEBGL_debug_renderer_info')` — some sites specifically call this to get the unmasked renderer

**Do we handle it?** PARTIAL — vendor/renderer strings are spoofed, but precision formats and extensions list are not.

**Priority:** MEDIUM — Akamai's current sensor collects WebGL parameters but the vendor/renderer spoof is the primary signal. Shader precision is a secondary signal used by more sophisticated checks (Cloudflare Turnstile, DataDome).

**Implementation:**
```javascript
// Add to WebGL getParameter patch block
if (param === 0x8B4D) return { rangeMin: 127, rangeMax: 127, precision: 23 }; // HIGH_FLOAT
if (param === 0x8B4E) return { rangeMin: 127, rangeMax: 127, precision: 23 }; // HIGH_INT
if (param === 0x8B50) return 16384; // MAX_TEXTURE_SIZE (NVIDIA GTX 1650)
if (param === 0x9240) return 'Google Inc. (NVIDIA)'; // UNMASKED_VENDOR_WEBGL
if (param === 0x9241) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)';

// getSupportedExtensions spoof
const origGetSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
WebGLRenderingContext.prototype.getSupportedExtensions = function() {
    return [
        'ANGLE_instanced_arrays', 'EXT_blend_minmax', 'EXT_color_buffer_half_float',
        'EXT_disjoint_timer_query', 'EXT_float_blend', 'EXT_frag_depth',
        'EXT_shader_texture_lod', 'EXT_texture_compression_bptc',
        'EXT_texture_compression_rgtc', 'EXT_texture_filter_anisotropic',
        'EXT_sRGB', 'KHR_parallel_shader_compile', 'OES_element_index_uint',
        'OES_fbo_render_mipmap', 'OES_standard_derivatives', 'OES_texture_float',
        'OES_texture_float_linear', 'OES_texture_half_float',
        'OES_texture_half_float_linear', 'OES_vertex_array_object',
        'WEBGL_color_buffer_float', 'WEBGL_compressed_texture_s3tc',
        'WEBGL_compressed_texture_s3tc_srgb', 'WEBGL_debug_renderer_info',
        'WEBGL_debug_shaders', 'WEBGL_depth_texture', 'WEBGL_draw_buffers',
        'WEBGL_lose_context', 'WEBGL_multi_draw',
    ];
};
```

**Difficulty:** LOW-MEDIUM (30-50 lines of JS additions)

---

### 2.3 Font Enumeration

**What it is:** Sites measure the rendered pixel width of text in a set of hundreds of font families against a baseline (e.g., `monospace`). Installed fonts differ: a Linux VPS with Japanese locale will have `Noto CJK`, `IPAGothic`, etc., but will lack Windows-only fonts like `MS Mincho`, `Meiryo`, `Yu Gothic` that real Windows Chrome users have.

**Do we handle it?** NO.

**Priority:** MEDIUM — This fingerprint is used by fingerprint.js Pro and FingerprintJS Enterprise to compute a stable user ID. Akamai Bot Manager itself may use it as a supplementary signal. The VPS + Japanese locale + claimed "Windows" UA creates an inconsistency.

**Implementation approach:** There is no clean JS injection fix. Options:
1. Install Windows-compatible Japanese fonts on the VPS: `sudo apt-get install -y fonts-ipafont fonts-ipaexfont` (covers IPA but not MS-proprietary fonts). Wine can install MS fonts: `apt-get install ttf-mscorefonts-installer`.
2. Override `document.fonts` API to return a controlled font list (complex; breaks legitimate font loading).
3. Accept the inconsistency since Akamai weighs this less than behavioral signals.

**Difficulty:** MEDIUM (system-level font installation, one-time VPS setup)

---

### 2.4 Screen: devicePixelRatio and colorDepth on Xvfb

**What it is:** Xvfb default color depth is 24-bit and devicePixelRatio is 1.0. Real modern monitors are 96+ DPI with devicePixelRatio typically 1.0-2.0 (Retina/HiDPI). The colorDepth issue: `screen.colorDepth` should be 24 (which Xvfb does provide), but `window.devicePixelRatio` being exactly 1.0 combined with certain screen resolutions (1920x1080) that should logically be DPR=1.5 on modern monitors is mildly suspicious.

**Do we handle it?** PARTIAL — `stealth.py` patches outerWidth/outerHeight/innerWidth/innerHeight/screen.width/screen.height/screen.availWidth/screen.availHeight. It does NOT patch `screen.colorDepth`, `screen.pixelDepth`, or `window.devicePixelRatio`.

**Priority:** LOW-MEDIUM — colorDepth=24 is the correct value for Xvfb's default. The gap is `devicePixelRatio`.

**Implementation:**
```javascript
// Add to stealth.py
Object.defineProperty(window, 'devicePixelRatio', {
    get: () => 1.0,  // or 1.25 for higher-DPI common laptops
    configurable: true,
});
Object.defineProperty(screen, 'colorDepth', {
    get: () => 24, configurable: true,
});
Object.defineProperty(screen, 'pixelDepth', {
    get: () => 24, configurable: true,
});
```

**Difficulty:** VERY LOW (3 lines)

---

### 2.5 WebRTC Local IP Leak

**What it is:** WebRTC's ICE (Interactive Connectivity Establishment) process enumerates all local network interfaces and sends them to the STUN server. Even with a proxy configured in Chrome, WebRTC uses UDP which bypasses SOCKS/HTTP proxy settings. A VPS's real IP (133.88.120.151 or similar ConoHa range) leaks through WebRTC even if the user-facing IP appears different.

**Do we handle it?** NO — no WebRTC mitigation in `stealth.py` or `base_scraper.py`.

**Priority:** HIGH — Akamai Bot Manager collects WebRTC ICE candidates as part of sensor telemetry. A datacenter IP leaking through WebRTC while the connection IP is also datacenter is a strong bot signal. More critically, the VPS IP range (GMO/ConoHa: AS7506) is a known datacenter ASN — WebRTC leaking this confirms datacenter origin.

**Implementation (two approaches):**

Option A — Chrome launch flag (preferred):
```python
browser_args=[
    # ...existing args...
    "--enforce-webrtc-ip-handling-policy=disable_non_proxied_udp",
    # Alternatively: default_public_interface_only (less aggressive)
]
```

Option B — JS injection (fallback, intercepts RTCPeerConnection):
```javascript
// Add to stealth.py
const origRTCPeerConnection = window.RTCPeerConnection;
window.RTCPeerConnection = function(config, constraints) {
    if (config && config.iceServers) {
        config.iceServers = [];  // Block STUN/TURN servers
    }
    const pc = new origRTCPeerConnection(config, constraints);
    const origAddIceCandidate = pc.addIceCandidate.bind(pc);
    // Block local IP candidates
    pc.addIceCandidate = function(candidate) {
        if (candidate && candidate.candidate &&
            /192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\./.test(candidate.candidate)) {
            return Promise.resolve();
        }
        return origAddIceCandidate(candidate);
    };
    return pc;
};
makeNative(window.RTCPeerConnection, 'RTCPeerConnection');
```

**Difficulty:** LOW (Chrome flag: 1 line; JS injection: 20 lines)

---

### 2.6 SpeechSynthesis API Fingerprint

**What it is:** `window.speechSynthesis.getVoices()` returns a list of available TTS voices. On a Linux VPS with no audio system, this returns an empty array. A Windows Chrome user would have Japanese Microsoft voices (`Microsoft Haruka`, `Microsoft Ichiro`, etc.) plus Google voices. Discrepancy between `navigator.languages = ['ja-JP', 'ja']` and empty voice list is detectable.

**Do we handle it?** NO.

**Priority:** LOW — Akamai does check for this inconsistency but it is a weak signal. However, combined with other signals it adds to a bot score.

**Implementation:**
```javascript
// Add to stealth.py
if (window.speechSynthesis) {
    const origGetVoices = window.speechSynthesis.getVoices.bind(window.speechSynthesis);
    window.speechSynthesis.getVoices = function() {
        const voices = origGetVoices();
        if (voices.length === 0) {
            // Return minimal spoofed voice list consistent with Japanese Windows
            return [
                { voiceURI: 'Microsoft Haruka Desktop - Japanese', name: 'Microsoft Haruka Desktop - Japanese',
                  lang: 'ja-JP', localService: true, default: true },
                { voiceURI: 'Google 日本語', name: 'Google 日本語',
                  lang: 'ja-JP', localService: false, default: false },
            ];
        }
        return voices;
    };
}
```

**Difficulty:** VERY LOW (15 lines)

---

### 2.7 Performance.now() Timing Precision

**What it is:** Chrome reduces `performance.now()` precision to 100 microseconds (0.1ms) by default for security (Spectre mitigation). Brave reduces it further to 1ms. When running on a VPS with a high-resolution Linux clock, `performance.now()` may return sub-100µs precision if Chrome's internal jitter mechanism is not working correctly in certain Xvfb configurations.

**Do we handle it?** NO — not patched in `stealth.py`.

**Priority:** LOW — Chrome in headless=False mode should already apply the 100µs reduction natively. This is primarily a concern for `headless=new` mode.

**Implementation (only needed if issues arise):**
```javascript
const origPerfNow = performance.now.bind(performance);
performance.now = function() {
    return Math.floor(origPerfNow() * 10) / 10; // Force 100µs precision
};
```

---

## Area 3: CDP / Automation Detection

### 3.1 Runtime.enable CDP Detection (rebrowser-patches gap)

**What it is:** When Puppeteer, Playwright, or any CDP-based tool calls `Runtime.enable`, it registers event listeners for `executionContextCreated` and `executionContextDestroyed`. Anti-bot JavaScript can detect this by calling a method that internally triggers a check for whether the `Runtime.enable` command was ever issued. The check works via a specific side effect: scripts injected into the page via `Runtime.evaluate` or `Page.addScriptToEvaluateOnNewDocument` leave traces in the runtime context chain.

rebrowser-patches fixes this with three modes:
1. `addBinding` — creates a DOM binding instead of calling Runtime.enable
2. `alwaysIsolated` — runs all scripts in isolated worlds via `Page.createIsolatedWorld`
3. `enableDisable` — calls Runtime.enable then immediately Runtime.disable

**Do we handle it?** PARTIAL. zendriver uses CDP directly, not Puppeteer. The key question is whether zendriver calls `Runtime.enable` internally. Since zendriver is a fork of nodriver which deliberately avoids WebDriver protocol, it likely avoids some of these leaks, but the source should be checked.

**Priority:** HIGH — This is one of the primary detection mechanisms used by Cloudflare and DataDome in 2025. Less certain for Akamai, but worth auditing.

**Action:** Audit zendriver's CDP command sequence on startup using `--remote-debugging-port` and Chrome DevTools to check if `Runtime.enable` is called.

**Difficulty:** MEDIUM (requires zendriver internals audit; if present, requires either patching zendriver or using `Page.createIsolatedWorld` pattern)

---

### 3.2 sourceURL Leak (`pptr:` / `__puppeteer_utility_world__`)

**What it is:** Puppeteer appends `//# sourceURL=pptr:evaluateHandle` to `eval()`'d scripts. Pages can detect this by checking `Error().stack` or by hooking `eval`. zendriver likely has its own source annotation pattern.

**Do we handle it?** UNKNOWN — zendriver may or may not annotate its injected scripts. The `__stealth_injected__` guard in `stealth.py` is visible to page JS.

**Priority:** MEDIUM

**Action:** Check what sourceURL zendriver injects. If it contains identifiable strings (e.g., `zendriver`, `nodriver`, `cdp`), rename them to something generic like `app.js`.

**Difficulty:** LOW once identified

---

### 3.3 Error.stack CDP Differences

**What it is:** Chrome DevTools Protocol modifies how `Error().stack` is generated when evaluation happens in an isolated context vs. the main world. Scripts evaluated via `Runtime.evaluate` show a different stack frame pattern than scripts evaluated in the main JS thread.

**Do we handle it?** PARTIALLY — because `add_script_to_evaluate_on_new_document` runs in the main world before page scripts, this is less of a concern for our stealth injections. However, any `page.evaluate()` calls made during scraping (to extract data, check states) may show CDP-sourced stack frames.

**Priority:** LOW — Page JS rarely hooks `Error.stack` except on highly sophisticated anti-bot deployments. Not a current Akamai concern.

---

### 3.4 Anti-Detect Browsers (Multilogin / GoLogin) — What They Do Differently

**What it is:** Commercial anti-detect browsers (Multilogin, GoLogin, Kameleo, Incogniton) patch Chrome at the binary level rather than via JS injection. This means:
- `navigator.userAgent` is patched at the C++ level (not detectable via `toString()` native check)
- `WebGL.getParameter()` returns values patched in GPU code (not JS override)
- Keyboard/mouse events are synthesized at OS level, not CDP-level
- They maintain profile consistency across sessions (same fingerprint for same profile)

**Do we handle it?** Our JS-level patching is detectable in theory by checking if `getParameter.toString()` returns `[native code]` while simultaneously the function has been replaced. Our `makeNative()` proxy addresses this for functions we've explicitly wrapped, but not for every patched method.

**Priority:** MEDIUM — the `makeNative()` wrapper in `stealth.py` covers `permissions.query` and `getBattery` but NOT `WebGLRenderingContext.getParameter`, `HTMLMediaElement.canPlayType`, `HTMLCanvasElement.toDataURL`. These patched functions will fail a `toString()` native check.

**Implementation:** Extend `makeNative()` to all overridden native methods:
```python
# In build_stealth_js, after all patches:
"""
makeNative(WebGLRenderingContext.prototype.getParameter, 'getParameter');
makeNative(HTMLMediaElement.prototype.canPlayType, 'canPlayType');
makeNative(HTMLCanvasElement.prototype.toDataURL, 'toDataURL');
makeNative(HTMLCanvasElement.prototype.toBlob, 'toBlob');
makeNative(window.RTCPeerConnection, 'RTCPeerConnection');
"""
```

**Difficulty:** VERY LOW (5 lines)

---

## Area 4: Behavioral Analysis

### 4.1 Fitts's Law Compliance in Mouse Movement

**What it is:** Fitts's Law predicts movement time based on target distance and size: `MT = a + b * log2(2D/W)`. Human cursor movement shows a characteristic velocity bell curve: slow start, rapid acceleration through the middle 60% of the path, gradual deceleration and micro-correction as the cursor approaches the target. Bots that move at constant speed or use pure bezier curves with constant t-step progression fail this check.

**Do we handle it?** PARTIAL. WindMouse simulates gravity+wind physics which produces natural acceleration/deceleration. However, the step interval in the path traversal code uses fixed `random.uniform(0.008, 0.025)` delays regardless of position in the path. For true Fitts compliance, delays should be shorter in the middle of the path (high velocity phase) and longer at start/end (low velocity phase).

**Priority:** MEDIUM — Akamai's behavior analysis uses velocity profiling as one of its ML features.

**Implementation:**
```python
# In human_click(), replace uniform delay with velocity-scaled delay:
total_points = len(path)
for i in range(0, len(path), step):
    px, py = path[i]
    # Position in path (0=start, 1=end)
    t = i / total_points
    # Bell curve: slower at start/end, faster in middle
    # Using 1 - 4*(t-0.5)^2 bell shape
    velocity_factor = 1 - 4 * (t - 0.5) ** 2
    # velocity_factor ~0 at edges, ~1 in middle
    delay = 0.025 - (velocity_factor * 0.017)  # range: 0.008 to 0.025
    await self._page.mouse_move(px, py, steps=1)
    await asyncio.sleep(delay)
```

**Difficulty:** LOW (modify 3 lines in `human_click`)

---

### 4.2 Keystroke Dynamics (Digraph Timing)

**What it is:** Humans type character pairs (digraphs) with characteristic inter-key intervals. Research shows these follow a log-logistic distribution (not uniform random). For Japanese input, common digraphs like `の` → `no`, `は` → `ha` on romaji input have specific timing profiles. Detection systems that analyze `keydown`/`keyup` event timing can identify bot typing.

**Do we handle it?** PARTIAL. `human_type()` uses `random.uniform(0.04, 0.12)` per character + occasional pauses. This is random uniform, not log-logistic. The current pauses at punctuation boundaries are good. However, there is no variation based on character pair (e.g., same-finger digraphs are slower than alternating-hand digraphs for touch typists).

**Priority:** MEDIUM — Akamai collects keystroke timing in sensor data. For login forms (username/password), digraph consistency matters. However, for typical login with short alphanumeric credentials, current implementation is likely sufficient.

**Implementation improvement:**
```python
async def human_type(self, element, text: str) -> None:
    await element.click()
    await self.human_delay(0.2, 0.5)
    await element.clear_input()

    prev_char = None
    for char in text:
        await element.send_keys(char)

        # Log-logistic distribution approximation via weibull
        # mu=0.07 (70ms mean), sigma=0.35
        mu, sigma = 0.07, 0.35
        u = random.random()
        delay = mu * (u / (1 - u)) ** sigma  # log-logistic quantile
        delay = max(0.03, min(delay, 0.4))  # clamp to sane range

        # Same-finger penalty (simplistic: consecutive same key)
        if prev_char and prev_char.lower() == char.lower():
            delay += random.uniform(0.02, 0.06)

        # Punctuation/space boundary
        if char in (" ", "-", "@", ".", "_"):
            delay += random.uniform(0.05, 0.15)

        # Occasional "think" pause
        if random.random() < 0.05:
            delay += random.uniform(0.3, 0.8)

        await asyncio.sleep(delay)
        prev_char = char
```

**Difficulty:** LOW

---

### 4.3 Japanese IME Input Simulation

**What it is:** Japanese web forms expect romaji-to-kana conversion events. When a Japanese user types `yamada` to enter `山田`, the browser fires:
1. `compositionstart`
2. Multiple `compositionupdate` (keyCode=229 for each IME character)
3. `compositionend`
4. `input` event with the final kana/kanji

Current `element.send_keys(char)` sends direct ASCII keypresses without composition events. For sites with strict keyboard event validation (rare but possible), this pattern is detectable.

**Do we handle it?** NO — `human_type()` sends chars directly without IME simulation.

**Priority:** LOW — Akamai's current detection does not specifically check for IME composition events. Most Japanese forms accept direct romaji input. Only login forms on highly regulated Japanese sites (banking, government) might validate IME patterns.

**Difficulty:** HIGH — requires CDP `Input.dispatchKeyEvent` with `keyIdentifier=U+0000` (IME composition key code 229) followed by `Input.insertText` for the composed character. Non-trivial to implement correctly.

---

### 4.4 Scroll Physics (Momentum / Deceleration)

**What it is:** Human scroll behavior has:
- Variable scroll delta (not fixed pixel amounts per event)
- Momentum: continued scrolling after finger release (especially trackpad)
- Natural pauses mid-page (reading behavior)
- Occasional scroll-up corrections (user reads back)
- Delta variance > 5px between events (bots typically send uniform scroll amounts)

**Do we handle it?** PARTIAL. `random_scroll()` in `base_scraper.py` uses chunked scroll with variable `random.randint(30, 120)` chunks and `random.uniform(0.02, 0.08)` delays. This is reasonable but lacks:
- Momentum deceleration (decreasing scroll speed over time)
- Occasional reverse scroll (scroll up 10-30px)
- Natural micro-pause on interesting elements

**Priority:** MEDIUM — Google SearchGuard (deployed January 2025) specifically uses Welford's algorithm to compute scroll delta variance in real-time. Low variance = bot flag.

**Implementation:**
```python
async def random_scroll(self) -> None:
    """自然なスクロール（モメンタム + 逆スクロール再現）"""
    total_scroll = random.randint(200, 600)
    scrolled = 0
    # Initial velocity
    velocity = random.randint(40, 80)  # pixels per frame

    while scrolled < total_scroll:
        # Momentum decay
        velocity = max(15, int(velocity * random.uniform(0.85, 0.98)))
        chunk = int(velocity * random.uniform(0.8, 1.2))
        chunk = min(chunk, total_scroll - scrolled)

        await self._page.evaluate(f"window.scrollBy(0, {chunk})")
        scrolled += chunk

        # Occasional micro-reverse (human re-reads)
        if random.random() < 0.08:
            reverse = random.randint(10, 40)
            await self._page.evaluate(f"window.scrollBy(0, -{reverse})")
            scrolled -= reverse  # allows more total scroll

        delay = random.uniform(0.015, 0.06)
        # Natural reading pause (3% chance)
        if random.random() < 0.03:
            delay += random.uniform(0.4, 1.2)
        await asyncio.sleep(delay)

    await self.human_delay(0.2, 0.6)
```

**Difficulty:** LOW

---

### 4.5 Poisson Distribution for Inter-Action Intervals

**What it is:** Human action timing (clicks, page loads, form interactions) follows a Poisson process where events arrive at a mean rate. The inter-arrival times follow an exponential distribution with occasional bursts. Current `human_delay()` uses `random.uniform()` which is flat — not exponentially distributed.

**Do we handle it?** PARTIAL — pauses exist but use uniform distribution.

**Priority:** LOW — The difference between uniform and exponential inter-action timing is subtle and unlikely to be the primary detection trigger for Akamai. More relevant for long-session behavioral consistency.

**Implementation:**
```python
async def human_delay(self, min_sec: float = 0.5, max_sec: float = 2.0) -> None:
    # Exponential distribution clipped to [min_sec, max_sec]
    mean = (min_sec + max_sec) / 2
    delay = random.expovariate(1.0 / mean)
    delay = max(min_sec, min(delay, max_sec * 1.5))
    await asyncio.sleep(delay)
```

**Difficulty:** VERY LOW (2 lines)

---

### 4.6 Session-Level Behavioral Consistency

**What it is:** Anti-bot ML models analyze session-level patterns: does the mouse move before every click? Does scroll always happen between navigations? Is the timing distribution consistent across the session? A scraper that always does click→type→click→next in exactly the same sequence with the same timing variance will be detected by LSTM models trained on session trajectories.

**Do we handle it?** PARTIAL — `random_idle()` (15% chance, 1-3s) provides some variance. The natural navigation flow (top→menu→target) adds behavioral plausibility. However, the scraping pattern is highly repetitive: fetch reservation page, click dates, extract data, repeat. This session-level regularity is detectable.

**Priority:** MEDIUM — Akamai Bot Manager uses ML scoring that accumulates trust across requests in a session. Highly repetitive patterns lower the trust score over time.

**Implementation suggestions:**
1. Add occasional "distraction" behavior: random hover over non-target elements (15% of navigations)
2. Vary the sequence: sometimes scroll before clicking, sometimes not
3. Add a 5-15% chance of going to an "irrelevant" page (e.g., clinic top page) and spending 10-30s before the target
4. Vary session start: don't always start from the login page directly; sometimes browse the top page first

---

## Area 5: Proxy / IP Layer

### 5.1 Residential Proxy for Japan

**What it is:** Residential proxies use IP addresses from ISP-assigned consumer internet connections (NTT Flets, SoftBank, au, etc.) rather than datacenter IP ranges. Akamai and other bot managers classify IPs by ASN (Autonomous System Number) and categorize them as "residential", "mobile", "datacenter", or "hosting".

**Current state:** Running directly on ConoHa VPS (GMO Internet, AS7506) — a datacenter ASN.

**Do we handle it?** NO.

**Priority:** HIGH — The single most impactful evasion improvement available. Akamai's ML assigns significantly lower trust scores to requests from datacenter ASNs. A residential Japan IP immediately improves the trust score baseline.

**Options:**
- **BrightData Residential (Japan):** 150M+ IPs, 99% success rate, ~$15/GB. Sticky sessions up to 30 min. Best-in-class for Akamai bypass. Integration: set proxy in Chrome launch args.
- **Oxylabs Residential (Japan):** 175M+ IPs, 99.95% success rate, ~$15/GB. Slightly faster response times.
- **IPRoyal / Proxy-Cheap:** Lower cost (~$3-8/GB) but smaller Japan pool and lower reliability.

**Integration:**
```python
browser_args=[
    # ...existing args...
    f"--proxy-server=http://user:pass@jp.residential.brightdata.com:22225",
]
```

**Note:** Using a residential proxy will also fix the TLS/HTTP2 fingerprint concern (section 1.1/1.2) for the proxied connections, since the proxy routes traffic through a real residential browser.

**Difficulty:** LOW (1 line in browser_args; cost is the main consideration: ~$15-30/month for typical scraping volume)

---

### 5.2 ConoHa VPS IP Reputation

**What it is:** ConoHa VPS is operated by GMO Internet (AS7506). This ASN is in all major IP reputation databases as a "Japan datacenter/hosting" range. Akamai's IP intelligence module flags AS7506 IPs as medium-risk bot traffic by default. The IP 133.88.120.151 (referenced in project memory) is in the 133.88.0.0/16 CIDR block which is ConoHa's range.

**Do we handle it?** NO (the VPS IP is used directly for all scraping traffic).

**Priority:** HIGH — Even with perfect browser fingerprint spoofing, the IP-layer classification as "datacenter" is a persistent negative signal.

**Mitigation options:**
1. Use residential proxy (5.1) — routes scraping traffic through residential IPs
2. Add a Japan mobile proxy as alternative for high-security targets
3. Check if Salon Board / Minimo specifically blocks AS7506 (test with `curl -x "" https://target.com` from VPS vs from local residential IP)

---

### 5.3 Sticky Session Strategy

**What it is:** Anti-bot systems track IP consistency across a session. If the source IP changes mid-session (IP rotation between requests), it's an immediate detection signal. Residential proxy providers offer "sticky sessions" where the same exit IP is maintained for a configurable duration.

**Do we handle it?** N/A (currently no proxy at all).

**Priority:** HIGH (when residential proxy is added).

**Recommendation:** Use sticky sessions for the full session duration (minimum 10-20 minutes for a login→scrape cycle). BrightData and Oxylabs both support sticky sessions up to 30 minutes.

---

## Area 6: Akamai-Specific Analysis

### 6.1 Sensor JS Telemetry — What Akamai Actually Collects

Based on research into Akamai's sensor data structure (the `sensor_data` POST parameter, which is a 58-element encoded array), the key telemetry fields are:

**Device/Environment signals:**
- Screen resolution, colorDepth, pixelDepth
- `window.outerWidth/outerHeight` vs `window.innerWidth/innerHeight` ratio
- `navigator.hardwareConcurrency`
- `navigator.deviceMemory`
- `navigator.connection.rtt`, `downlink`, `effectiveType`
- Battery API availability and state
- `navigator.userAgentData` high-entropy values

**Browser fingerprint signals:**
- Canvas fingerprint hash
- WebGL vendor/renderer string
- AudioContext hash
- Font metric fingerprint
- Installed plugins/MIME types

**Behavioral signals (collected over first 3-5 seconds):**
- Mouse movement coordinates and timing (velocity/acceleration vectors)
- Scroll events (delta values and timing)
- Keyboard events on interactive elements
- Time between page load and first user interaction
- Touch event presence (distinguishes mobile from desktop)

**Network signals:**
- IP classification (residential/datacenter/mobile)
- HTTP header order and values
- `_abck` cookie validation chain

**Current coverage:**
- Screen/viewport: COVERED (outerWidth/Height, innerWidth/Height, screen.width/height)
- hardwareConcurrency: COVERED (returns 8)
- deviceMemory: COVERED (returns 8)
- connection.rtt/downlink: COVERED
- Battery API: COVERED
- Canvas: COVERED (noise injection)
- WebGL vendor/renderer: COVERED
- userAgentData: COVERED
- Plugins/MIME: COVERED
- **AudioContext: MISSING**
- **WebRTC/IP: MISSING**
- **Font metrics: PARTIALLY MISSING** (system fonts don't match claimed Windows OS)
- Behavioral (mouse, scroll, keyboard): MOSTLY COVERED but improvements possible

---

### 6.2 What Triggers Pixel Challenge vs. Block

Based on research (Akamai's response taxonomy):

| Akamai Response | HTTP Status | Trigger Conditions |
|----------------|-------------|-------------------|
| **Pass** | 200 (normal) | Trust score > 0.7, all signals clean |
| **Monitor** | 200 (normal) | Trust score 0.4-0.7, session tracked |
| **Pixel Challenge** | 200 (challenge page) | Trust score 0.2-0.4, one major signal off |
| **Bot Score Block** | 403 "Pardon Our Interruption" | Trust score < 0.2, multiple bad signals |
| **IP Block** | 403 or 429 | IP reputation blacklisted |

**Primary triggers for pixel challenge (image puzzle):**
1. Datacenter IP (AS detection)
2. `navigator.webdriver = true` detected
3. `outerWidth/innerHeight = 0` (unpatched headless)
4. AudioContext fingerprint mismatch (server-grade audio stack)
5. No mouse movement before form interaction
6. Cookie validation chain broken (_abck sensor failure)

**Our current status:**
- navigator.webdriver: FIXED
- outerWidth/Height: FIXED
- Mouse movement: FIXED (WindMouse)
- Cookie validation: FIXED (wait for _abck)
- Datacenter IP: NOT FIXED
- AudioContext: NOT FIXED

---

### 6.3 Known Working Bypasses in 2026

**Approaches confirmed working (from research as of March 2026):**

1. **Real browser + residential proxy + complete stealth patch** — the approach we already use, minus the residential proxy and AudioContext fix.

2. **curl_cffi with `impersonate="chrome131"`** — bypasses TLS/JA3/JA4/HTTP2 for pure HTTP requests. Not applicable to our interactive browser scraping use case.

3. **Sensor data regeneration services** (commercial) — services like Hyper-Solutions SDK generate valid `sensor_data` without a browser. Not recommended: creates hard dependency on external service, legally grey.

4. **BrightData Scraping Browser** — a managed browser with built-in residential proxy rotation and stealth patches. Cost: ~$0.001/request. Alternative to DIY if cost is acceptable.

**Approaches that no longer work (2025-2026):**

1. `headless=True` with basic stealth — detected by Akamai headless signals
2. Python `requests` + fake UA — TLS fingerprint immediately flagged
3. seleniumwire / mitmproxy for header injection — creates H2 fingerprint mismatch
4. IP rotation without sticky sessions — mid-session IP change = instant block
5. Random delays with uniform distribution only — behavioral ML detects non-human distributions

---

## Summary: Gap Priority Matrix

| # | Gap | Currently Handled | Priority | Difficulty | Estimated Impact |
|---|-----|------------------|----------|------------|-----------------|
| 1 | AudioContext fingerprint | NO | HIGH | LOW | Fixes Akamai audio telemetry mismatch |
| 2 | WebRTC IP leak | NO | HIGH | LOW | Prevents datacenter IP leak via WebRTC |
| 3 | Residential proxy (Japan) | NO | HIGH | LOW* | Fundamental IP reputation improvement |
| 4 | makeNative() on all patched fns | PARTIAL | MEDIUM | VERY LOW | Prevents toString() native check failure |
| 5 | Runtime.enable CDP audit (zendriver) | UNKNOWN | HIGH | MEDIUM | May be critical if zendriver leaks this |
| 6 | Scroll physics (momentum/reverse) | PARTIAL | MEDIUM | LOW | Improves behavioral ML score |
| 7 | screen.devicePixelRatio, colorDepth | PARTIAL | LOW-MED | VERY LOW | Removes 3 detectable gaps |
| 8 | Fitts's law velocity in mouse path | PARTIAL | MEDIUM | LOW | More natural velocity profile |
| 9 | WebGL2 extensions + precision | PARTIAL | MEDIUM | LOW | Closes secondary WebGL fingerprint |
| 10 | Keystroke log-logistic distribution | PARTIAL | MEDIUM | LOW | More human-like typing timing |
| 11 | SpeechSynthesis voice list spoof | NO | LOW | VERY LOW | Removes minor inconsistency |
| 12 | Font enumeration (system fonts) | NO | MEDIUM | MEDIUM | Install MS-compatible fonts on VPS |
| 13 | Session behavioral consistency | PARTIAL | MEDIUM | MEDIUM | Reduces session-level ML pattern score |
| 14 | Poisson/exponential inter-action timing | PARTIAL | LOW | VERY LOW | Minor behavioral improvement |
| 15 | Performance.now() precision | LIKELY OK | LOW | VERY LOW | Only needed if timing issues arise |
| 16 | TCP fingerprint (JA4T) | NO | LOW | VERY HIGH | Not practical to fix; low Akamai weight |
| 17 | sourceURL leak (zendriver) | UNKNOWN | MEDIUM | LOW | Audit required |

*Low difficulty to add the proxy arg; cost is the main consideration

---

## Recommended Implementation Order

### Phase 1: High-Impact, Low-Effort (1-2 hours)
1. Add **AudioContext farbling** to `stealth.py` (~20 lines)
2. Add **WebRTC blocking** Chrome flag `--enforce-webrtc-ip-handling-policy=disable_non_proxied_udp`
3. Add **`makeNative()` to all patched functions** (~5 lines)
4. Add **screen.devicePixelRatio, colorDepth, pixelDepth** patches (~6 lines)
5. Add **SpeechSynthesis voice list** spoof (~15 lines)
6. Switch `human_delay()` to **exponential distribution** (~2 lines)

### Phase 2: Medium-Effort Improvements (2-4 hours)
7. **Fitts's law velocity** in mouse path traversal (~5 lines)
8. **Scroll momentum/deceleration** with occasional reverse-scroll (~20 lines)
9. **Log-logistic keystroke timing** in `human_type()` (~10 lines)
10. **WebGL2 extensions list and shader precision** extensions (~40 lines)
11. **Audit zendriver for Runtime.enable** CDP leak

### Phase 3: Infrastructure (Ongoing / Budget Consideration)
12. **Residential proxy** (BrightData or Oxylabs Japan residential, ~$15-30/month)
13. **Font installation** on VPS: `apt-get install fonts-ipafont fonts-ipaexfont` + MS Core Fonts via ttf-mscorefonts-installer
14. **Session behavioral randomization**: add distraction behaviors, vary navigation sequences

---

## Sources

1. [Rebrowser Patches README](https://github.com/rebrowser/rebrowser-patches/blob/main/README.md) — Detailed CDP leak analysis: Runtime.enable, sourceURL, utility world naming
2. [Rebrowser: Sensitive CDP Methods](https://rebrowser.net/docs/sensitive-cdp-methods) — Runtime.enable, Page.setBypassCSP, Emulation.* detection
3. [Rebrowser: Runtime.enable Fix](https://rebrowser.net/blog/how-to-fix-runtime-enable-cdp-detection-of-puppeteer-playwright-and-other-automation-libraries) — Fix modes: addBinding, alwaysIsolated, enableDisable
4. [Browserless: TLS Fingerprinting](https://www.browserless.io/blog/tls-fingerprinting-explanation-detection-and-bypassing-it-in-playwright-and-puppeteer) — Chrome via CDP passes JA3/JA4 natively; H2 coherence requirement
5. [Trickster Dev: HTTP/2 Fingerprinting](https://www.trickster.dev/post/understanding-http2-fingerprinting/) — Chrome SETTINGS frame values, pseudo-header order
6. [Scrapfly: Akamai Bypass](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping) — Akamai telemetry layers, trust score model, working bypasses
7. [ScrapingAnt: Headless vs Headful 2025](https://scrapingant.com/blog/headless-vs-headful-browsers-in-2025-detection-tradeoffs) — Detection methods for headless Chrome in 2025
8. [DataDome: AudioContext Fingerprinting](https://datadome.co/anti-detect-tools/audio-fingerprint/) — OfflineAudioContext fingerprinting technique
9. [Fingerprint.com: Audio Fingerprinting](https://fingerprint.com/blog/audio-fingerprinting/) — 99.6% uniqueness of audio fingerprints
10. [Oxylabs: Japan Residential Proxies](https://oxylabs.io/location-proxy/japan) — Japan residential proxy specs
11. [BrightData vs Oxylabs 2026](https://brightdata.com/blog/comparison/bright-data-vs-oxylabs) — Proxy provider comparison
12. [Scrapeless: Time Fingerprinting](https://www.scrapeless.com/en/blog/time-fingerprinting) — Performance.now() precision and randomization
13. [Multilogin: WebRTC Leak Prevention](https://multilogin.com/blog/how-to-prevent-webrtc-leak/) — WebRTC IP leak prevention strategies
14. [Chrome Enterprise: WebRtcIPHandling](https://chromeenterprise.google/policies/web-rtc-ip-handling/) — Chrome policy flags for WebRTC control
15. [GitHub: akamai-bmp-generator](https://github.com/xvertile/akamai-bmp-generator) — Akamai sensor data structure research
16. [DEV: HTTP/2 Header Consistency](https://dev.to/deepak_mishra_35863517037/http2-and-header-consistency-the-holy-grail-of-stealth-3ej5) — H2 SETTINGS and header order for stealth
17. [SpringerLink: Keystroke Dynamics Bot Detection](https://link.springer.com/chapter/10.1007/978-3-031-65175-5_30) — Digraph timing analysis for bot detection
18. [arxiv: Timing-Forgery Attacks on Keystroke Detection](https://arxiv.org/html/2601.17280v1) — Log-logistic distribution for keystroke evasion (2025)
19. [ScraperAPI: SearchGuard Analysis](https://searchengineland.com/inside-google-searchguard-467676) — Welford algorithm for scroll variance detection

---

## Confidence Assessment

**High confidence** (multiple authoritative sources):
- JA3/JA4 is handled natively by real Chrome via CDP
- AudioContext fingerprinting is a real Akamai sensor signal and we don't handle it
- WebRTC leaks real IPs and Chrome has no built-in disable; CDP flag is the fix
- Residential proxy is the highest-impact single improvement for IP reputation
- Runtime.enable is a critical CDP detection vector in 2025

**Medium confidence** (1-2 sources or inferred):
- Specific Akamai trust score thresholds for pixel challenge vs. block
- Exact weight Akamai assigns to each fingerprint signal
- Whether zendriver specifically triggers Runtime.enable leak

**Low confidence / unverified**:
- Whether Akamai specifically uses SpeechSynthesis voice list cross-validation
- Whether JA4T TCP fingerprinting is actively used by Akamai for standard bot scoring (vs. DPI-level analysis)
- Exact AudioContext output values that would be produced by a Linux VPS Chrome instance

## Information Gaps

- Akamai sensor data complete field list (the 58-element array is obfuscated; only partial field mapping is publicly known)
- Whether zendriver calls Runtime.enable internally (requires source code audit or CDP traffic capture)
- Current Akamai ML model weights for each fingerprint signal (proprietary, changes continuously)
- Whether SalonBoard / Minimo specifically uses AS7506 (ConoHa) IP blocklist
