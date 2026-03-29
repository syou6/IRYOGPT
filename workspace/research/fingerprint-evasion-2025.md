# Browser Fingerprint Evasion: Complete Technical Reference 2025-2026

## Overview

This document covers every major detection vector and countermeasure for browser automation using CDP-based Chromium (zendriver/nodriver). Sources verified March 30, 2026.

---

## PART 1: CDP-LEVEL DETECTION VECTORS

### 1.1 Runtime.enable Leak (CRITICAL - most sites check this)

All major automation libraries (Puppeteer, Playwright) call `Runtime.enable` to receive execution context events. This CDP command creates a detectable artifact because any webpage can detect whether the Runtime domain is active.

Detection: Cloudflare, DataDome, and others instrument this. The Runtime domain being enabled is observable.

Countermeasures:
- **Method A (AddBinding)**: Create a binding in the main world to capture context ID without calling Runtime.enable. Used by rebrowser-patches default mode.
- **Method B (AlwaysIsolated)**: Use `Page.createIsolatedWorld` for ALL script execution. Scripts never run in the main world, so MutationObserver cannot see them.
- **Method C (Enable/Disable)**: Call Runtime.enable then immediately Runtime.disable to trigger execution context events while minimizing the detection window.

zendriver/nodriver avoids this entirely by not being built on top of Playwright/Puppeteer's execution model.

### 1.2 sourceURL Leak in Script Evaluation

Puppeteer appends `//# sourceURL=pptr:evaluate` to evaluated scripts. This string is visible in Error stack traces and is a hard bot signal.

Detection: Anti-bot scripts throw intentional errors and read the stack trace to find `pptr:` or `__playwright` patterns.

Countermeasure: Set `REBROWSER_PATCHES_SOURCE_URL=app.js` or `jquery.min.js`. For zendriver/CDP manual injection, never append sourceURL at all.

### 1.3 Utility World Naming

Default world names like `__puppeteer_utility_world__6.5.0` or `__playwright_utility_world__` are visible and identifiable.

Countermeasure: Set to a generic name (`util`, `helpers`). Configure via `REBROWSER_PATCHES_UTILITY_WORLD_NAME`.

### 1.4 navigator.webdriver (CRITICAL)

`navigator.webdriver === true` is the most checked signal. Set by Chrome when launched via ChromeDriver/WebDriver protocol.

Countermeasure:
- Launch Chrome with `--disable-blink-features=AutomationControlled`
- zendriver/nodriver does NOT use WebDriver protocol at all (uses CDP directly), so this is NOT set
- Verify: the property should be `undefined` (not `false`) in a real browser

### 1.5 CDP Mouse Coordinate Bug

Chrome aligns screen and webpage mouse coordinates in CDP-dispatched events. In real human use, these coordinates can differ (e.g., on multi-monitor setups, when the browser window is offset). This discrepancy IS detectable.

Countermeasure: Use OS-level input injection (xdotool on Linux, pyautogui) rather than CDP `Input.dispatchMouseEvent`.

### 1.6 __pwInitScripts Global

Playwright injects `__pwInitScripts` into the global scope. Any fingerprinter checking `typeof window.__pwInitScripts` gets a hit.

Countermeasure: Camoufox sandboxes all Playwright internal code; zendriver does not use Playwright at all.

### 1.7 Chrome for Testing User Agent

The string "Google Chrome for Testing" in the User-Agent is an absolute bot signal. Chrome 115+ introduced this for testing builds.

Countermeasure: Always override User-Agent to a real Chrome release string. Use `Emulation.setUserAgentOverride` via CDP, and also set Sec-CH-UA headers consistently.

---

## PART 2: JAVASCRIPT API FINGERPRINTING VECTORS

### 2.1 AudioContext Fingerprinting

**How it works:**
1. Script creates an `OfflineAudioContext(1, 44100, 44100)`
2. Creates an `OscillatorNode` with `type: 'triangle'` and frequency 10000Hz
3. Routes through a `DynamicsCompressorNode`
4. Calls `startRendering()` and reads the resulting audio buffer
5. Sums all sample values - this sum is unique per hardware/OS combination

The sum captures subtle differences in floating-point math implementation across different CPUs and audio stacks.

**Detection sensitivity:**
- Different GPU/CPU combos produce different sums
- Different OS audio stacks (CoreAudio vs WASAPI vs ALSA) produce different values
- Headless Chrome on Linux with no audio device returns a distinct value

**Evasion approaches:**

WRONG APPROACH: Add random noise per call. Detection systems call `getChannelData()` multiple times. If the sum changes, noise injection is detected. This itself is a stronger bot signal.

CORRECT APPROACH 1 (Consistent noise): Seed noise with a stable value (e.g., hash of session UUID). Same session always returns same noisy-but-wrong value.

CORRECT APPROACH 2 (Source-level patch): CloakBrowser patches the C++ audio rendering code directly. The output is plausible but consistently wrong in a fingerprint-like way.

CORRECT APPROACH 3 (Hook with session-stable proxy):
```javascript
// Inject via Page.addScriptToEvaluateOnNewDocument
const SESSION_SEED = Math.random(); // Generate ONCE per session, store in closure
const originalGetChannelData = AudioBuffer.prototype.getChannelData;
AudioBuffer.prototype.getChannelData = function() {
  const data = originalGetChannelData.apply(this, arguments);
  // Apply deterministic noise based on session seed
  // MUST return same values for same call within session
  return data;
};
```

WARNING: `toString()` on overridden functions reveals "function getChannelData() { [native code] }" vs real native. Use Proxy objects instead.

**Nodes to intercept:**
- `AudioContext.prototype.createOscillator`
- `AudioContext.prototype.createAnalyser`
- `DynamicsCompressorNode.prototype.getReduction`
- `AudioBuffer.prototype.getChannelData`
- `AnalyserNode.prototype.getFloatFrequencyData`
- `AnalyserNode.prototype.getByteFrequencyData`

### 2.2 WebGL2 Fingerprinting

**Detection vectors:**

a) **RENDERER and VENDOR strings** via `WEBGL_debug_renderer_info` extension:
   - `gl.getParameter(UNMASKED_RENDERER_WEBGL)` — returns GPU model e.g. "ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)"
   - Headless Linux shows "llvmpipe (LLVM 15.0, 256 bits)" or "SwiftShader Device (Subzero)" — immediate bot signal

b) **Shader precision formats**: `gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT)` returns rangeMin, rangeMax, precision. Values differ by GPU vendor.

c) **Supported extensions**: `gl.getSupportedExtensions()` returns a list. Missing common extensions or having unexpected ones is suspicious.

d) **GL Parameters**: `gl.getParameter(gl.MAX_TEXTURE_SIZE)`, `gl.getParameter(gl.MAX_VIEWPORT_DIMS)`, etc. — vary by GPU.

e) **WebGL canvas rendering**: Drawing a complex scene and reading pixels produces a near-unique hash. Called "canvas WebGL fingerprint" distinct from 2D canvas.

f) **WebGPU**: `navigator.gpu.requestAdapter()` and checking adapter features/limits. CloakBrowser patches this at C++ level.

**Evasion:**

DO NOT randomly assign renderer strings. WAFs hash renderer+extensions combinations against a database of real devices. Unknown combinations flag as bot.

CORRECT APPROACH: Use real renderer strings from known GPU/OS combinations. Camoufox uses BrowserForge's statistical database of real device configurations.

For zendriver:
```javascript
// Spoof via CDP Page.addScriptToEvaluateOnNewDocument
const getParam = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(param) {
  const UNMASKED_RENDERER = 37446;
  const UNMASKED_VENDOR = 37445;
  if (param === UNMASKED_RENDERER) return 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)';
  if (param === UNMASKED_VENDOR) return 'Google Inc. (Intel)';
  return getParam.apply(this, arguments);
};
// Apply same to WebGL2RenderingContext.prototype.getParameter
```

WARNING: Must use Proxy with `apply` trap to pass `instanceof WebGLRenderingContext` checks.

### 2.3 Canvas 2D Fingerprinting

**How it works:**
1. Draw text with specific font/size/color
2. Draw geometric shapes, gradients, shadows
3. Call `toDataURL()` or `getImageData()` — returns unique pixel data influenced by GPU rendering pipeline, text rasterization, and anti-aliasing

**Detection of evasion:**
- **Multiple reads**: Fingerprinters call `toDataURL()` repeatedly. If hash changes → noise injection detected
- **Proof-of-work**: Fill canvas with `rgba(0, 127, 255, 1)`, read back pixel at (0,0). If r ≠ 0, g ≠ 127, b ≠ 255 → modification detected
- **Function native check**: `toDataURL.toString()` should be `"function toDataURL() { [native code] }"`. Wrapped functions reveal themselves

**Correct evasion:**
- Session-stable deterministic offset (same session, same output)
- Use Proxy object with `apply` trap (harder to detect than direct override)
- Source-level patch (CloakBrowser approach — undetectable)

### 2.4 Font Enumeration Fingerprinting

**How it works:**
Scripts probe for ~400 known fonts using one of two methods:

Method A (CSS/JS measureText): Create a `<canvas>`, set `font: '72px TestFont, monospace'`, measure text width. If width != width with `monospace` alone, the font is installed.

Method B (CSS @font-face trick): Create a `@font-face` that loads a remote resource for a specific Unicode range. If the request fires, that Unicode range's preferred font is installed.

**Headless Linux problem:** A fresh Chromium on Ubuntu has very few fonts — no Windows fonts, no macOS fonts. `document.fonts.check('12px Arial')` returns false. This is a strong signal.

**Evasion:**
- Install common fonts in the container: `apt-get install fonts-liberation fonts-noto ttf-mscorefonts-installer`
- Override `FontFace` API and `document.fonts` to return a realistic list
- Via CDP injection:
```javascript
// Override measureText to return plausible widths for known fonts
const ctx = HTMLCanvasElement.prototype.getContext;
// ... intercept CanvasRenderingContext2D.prototype.measureText
```
- Camoufox allows specifying an explicit fonts list matched to target OS

**Important:** Font list must match the claimed OS. Windows 11 has different default fonts than macOS 14.

### 2.5 Screen and Display Fingerprinting

**Detection vectors:**

a) `screen.width` / `screen.height` — Xvfb default is 1024x768 or 800x600, both suspicious
b) `screen.colorDepth` — Xvfb often reports 24 or 32; real displays are 24
c) `window.devicePixelRatio` — Xvfb: 1.0; modern HiDPI displays: 1.5, 2.0
d) `screen.availWidth` vs `window.outerWidth` — mismatch if taskbar/window chrome misconfigured
e) `window.outerWidth` / `window.outerHeight` — Playwright default leaves these at 0 (detectable)
f) HDR detection: `window.matchMedia('(dynamic-range: high)')` — will be false in Xvfb
g) `screen.orientation.type` — should be 'landscape-primary' for desktop
h) Color gamut: `window.matchMedia('(color-gamut: p3)')` — extended color space check

**Headless-specific signals:**
- Old `--headless` mode: `window.innerWidth === 800, window.innerHeight === 600` (Puppeteer default)
- New `--headless=new`: More realistic but still reports `screen.width` based on virtual display
- `screen.availTop` and `screen.availLeft` are 0 in headless but non-zero on real desktops with taskbars

**Evasion:**
```bash
# Xvfb with realistic resolution
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
```
Via CDP:
```python
# Set window bounds
await page.cdp_session.execute("Browser.setWindowBounds", {
    "windowId": window_id,
    "bounds": {"width": 1920, "height": 1080}
})
# Override screen properties
await page.evaluate("""
  Object.defineProperty(screen, 'width', {get: () => 1920});
  Object.defineProperty(screen, 'height', {get: () => 1080});
  Object.defineProperty(screen, 'availWidth', {get: () => 1920});
  Object.defineProperty(screen, 'availHeight', {get: () => 1040}); // minus taskbar
  Object.defineProperty(window, 'devicePixelRatio', {get: () => 1.0});
""")
```

Also set via CDP `Emulation.setDeviceMetricsOverride`.

### 2.6 Keyboard Layout Fingerprinting

**How it works:**
- `KeyboardEvent.code` represents the PHYSICAL key position (layout-independent, e.g., "KeyQ")
- `KeyboardEvent.key` represents the LOGICAL character (layout-dependent, e.g., "a" or "q" or "a" depending on layout)
- On AZERTY keyboards, pressing the physical key labeled "A" generates `code: "KeyQ"` but `key: "a"` — inconsistent with QWERTY expectation
- Shift key behavior: On AZERTY, Shift is required before digits. Scripts can detect layout by observing if Shift is pressed before "1", "2" etc.

**Bot detection use:**
- Most bots dispatch keyboard events with inconsistent code/key combinations
- CDP `Input.dispatchKeyEvent` often gets the code/key mapping wrong
- Tor Browser resistance: suppresses Alt/Shift modifier key events to prevent layout detection

**Evasion:**
- Ensure dispatched key events have consistent `code`/`key`/`keyCode` mappings
- For CDP dispatch: validate against real browser key tables
- Use OS-level input injection (xdotool, pyautogui) for natural event generation

### 2.7 Touch/Pointer Event Fingerprinting

**How it works:**
- `navigator.maxTouchPoints` — headless Chromium defaults to 0 (no touch), real desktops also 0, but the value being explicitly checked creates a consistency requirement
- `PointerEvent.pressure` — for mouse: always 0.5 (mouse button pressed) or 0.0 (not pressed). For touch: variable 0-1. For pen: variable.
- `PointerEvent.tiltX` / `PointerEvent.tiltY` — for mouse: always 0. For pen: variable. Spoofing non-zero tilt for a mouse pointer is detectable.
- `PointerEvent.pointerType` — "mouse", "touch", or "pen". Must be consistent with other properties.
- `PointerEvent.width` / `PointerEvent.height` — contact geometry. Mouse: 1x1. Touch: variable. Faking 1x1 for touch is detectable.

**CDP-specific issue:**
`Input.dispatchMouseEvent` in CDP doesn't perfectly replicate the event properties that a real OS sends. `buttons` bitmask, `movementX`/`movementY` values, and timing can be inconsistent.

**Evasion:**
- For desktop scraping: use `navigator.maxTouchPoints = 0` and ensure all pointer events have `pressure: 0` (not pressed) or `pressure: 0.5` (pressed), `tiltX: 0`, `tiltY: 0`, `pointerType: 'mouse'`
- Use OS-level mouse events where possible

### 2.8 Performance.now() and Timing Attacks

**How it works:**
- Real browsers clamp `performance.now()` resolution to 100 microseconds (cross-origin isolated: 5 microseconds)
- Bots often have very high timer precision OR very low precision (virtualized environments)
- Event processing latency: real browsers have 4-16ms natural jitter in event handling. Zero-jitter event dispatch is suspicious.
- `Date.now()` vs `performance.now()` drift: should accumulate identically. Fake timing manipulation often creates drift.
- Animation frame timing: `requestAnimationFrame` callback timing should follow display refresh cadence (~16.67ms at 60fps). Headless often returns timer-driven 0ms or very inconsistent values.

**Detection:**
- Check if `performance.now()` returns whole numbers (clamped too aggressively) or has too much precision
- Check if `performance.timeOrigin` is plausible (not 0, not in the distant past)
- Measure time to execute known operations — bots in VMs may be faster or slower than expected

**Evasion:**
- No specific spoofing needed for headless Chromium — Chrome's own clamping applies
- Ensure Xvfb is configured to report realistic vsync timing
- Use `--window-size` and proper display config so rAF timing is realistic

### 2.9 WebRTC Leak Detection

**What leaks:**
- `RTCPeerConnection` with STUN server reveals:
  - Local LAN IP (e.g., 192.168.x.x)
  - Public IP (same as proxy IP if proxy is correctly configured, or real IP if not)
  - IPv6 addresses
- Even with a proxy at the HTTP level, WebRTC bypasses proxy and uses direct UDP to STUN server

**Detection by anti-bot:**
- Public IP from WebRTC ≠ IP from HTTP headers → proxy detected
- LAN IP pattern reveals datacenter/cloud (10.x.x.x ranges are datacenter-typical)

**Evasion options:**

Option 1 (Disable WebRTC entirely):
```bash
# Chrome flag
--force-webrtc-ip-handling-policy=disable_non_proxied_udp
```
This prevents all UDP, including STUN. `RTCPeerConnection` still works but returns no host candidates.

Option 2 (Route WebRTC through proxy):
```bash
--force-webrtc-ip-handling-policy=default_public_interface_only
```

Option 3 (CDP override):
zendriver 0.15.0 added `webrtc_leak_protection = True` which applies the disable flag.

Option 4 (JS injection):
```javascript
// Override RTCPeerConnection constructor
window.RTCPeerConnection = function(config) {
  if (config) {
    config.iceServers = [];
    config.iceTransportPolicy = 'relay';
  }
  return new OriginalRTCPeerConnection(config);
};
```

**Important:** ICE candidate events that produce host/srflx candidates with real local IPs are the leak. Relay-only or empty ICE candidates are acceptable to anti-bot systems.

### 2.10 Speech Synthesis Fingerprinting

**What it detects:**
`speechSynthesis.getVoices()` returns the list of TTS voices installed on the system. This list is:
- OS-specific (Windows has different voices than macOS)
- Language-pack-dependent (Russian voices only on Russian-localized systems)
- Empty on Linux/headless Chromium without TTS packages

**Headless signal:**
Chrome on Linux with no speech synthesis installed returns `[]` from `getVoices()`. However, `speechSynthesis` object itself exists and `window.SpeechSynthesisUtterance` is defined. This combination (API present but empty voices) is suspicious.

**Evasion:**
```javascript
// Inject via addScriptToEvaluateOnNewDocument
Object.defineProperty(window, 'speechSynthesis', {
  get: () => ({
    getVoices: () => [
      {
        default: true,
        lang: 'en-US',
        localService: true,
        name: 'Microsoft David Desktop - English (United States)',
        voiceURI: 'Microsoft David Desktop - English (United States)'
      },
      // Add 3-4 more realistic voices for the claimed OS/locale
    ],
    onvoiceschanged: null,
    speaking: false,
    pending: false,
    paused: false
  })
});
```

**Important:** Voice names must match claimed OS. Windows voices start with "Microsoft X Desktop". macOS voices have different names. Claiming Windows UA but providing Linux voice names is detectable.

### 2.11 Bluetooth/USB/HID API Fingerprinting

**Detection vectors:**

a) `navigator.bluetooth` — present in Chrome on desktop, undefined in headless/CDP mode with `--disable-features=WebBluetooth` (the default in automation)

b) `navigator.usb` — similarly absent in headless contexts

c) `navigator.hid` — Human Interface Device API, absent in headless

d) `navigator.serial` — Serial port API

e) `navigator.gpu` — WebGPU, present in modern Chrome but may differ in headless

f) Checking API presence vs. absence creates a fingerprint of what capabilities are enabled.

**Detection logic:**
- Real Chrome 120+ on Windows: all of bluetooth, usb, hid, serial, gpu are defined
- Headless Chrome (default flags): these may be undefined or throw permission errors
- A sophisticated check: call `navigator.bluetooth.getAvailability()` — in headless it may reject or throw where real Chrome returns a Promise that resolves to true/false

**Evasion:**
Ensure Chrome is launched without `--disable-features=WebBluetooth` (or the equivalent for each API). These APIs being present doesn't automatically leak data — they just need to exist.

```python
# For zendriver, ensure these are NOT disabled
# Avoid: --disable-features=WebBluetooth,WebUSB,WebHID
```

For JS-level override if needed:
```javascript
if (!navigator.bluetooth) {
  Object.defineProperty(navigator, 'bluetooth', {
    get: () => ({
      getAvailability: () => Promise.resolve(true),
      requestDevice: () => Promise.reject(new DOMException('User cancelled', 'NotAllowedError'))
    })
  });
}
```

### 2.12 CSS Media Query Fingerprinting

**Detection vectors:**

a) `window.matchMedia('(prefers-color-scheme: dark)').matches` — auto-dark-mode setting. Headless Chromium defaults to `light`.

b) `window.matchMedia('(prefers-reduced-motion: reduce)').matches` — accessibility setting

c) `window.matchMedia('(prefers-contrast: more)').matches` — high contrast mode

d) `window.matchMedia('(display-mode: standalone)')` — PWA detection

e) `window.matchMedia('(color-gamut: p3)')` — wide color gamut display support

f) `window.matchMedia('(dynamic-range: high)')` — HDR display

g) `window.matchMedia('(hover: hover)')` — presence of hovering input device

h) `window.matchMedia('(pointer: fine)')` — fine pointer (mouse vs touch)

**Server-side CSS technique:**
Using `<picture>` elements with media query sources — if server logs show the wrong image variant was requested, CSS-based fingerprinting reveals browser capabilities without JavaScript.

**Evasion:**
CDP provides `Emulation.setEmulatedMedia` to override media features:
```python
await page.cdp_session.execute("Emulation.setEmulatedMedia", {
    "media": "screen",
    "features": [
        {"name": "prefers-color-scheme", "value": "light"},
        {"name": "prefers-reduced-motion", "value": "no-preference"},
        {"name": "prefers-contrast", "value": "no-preference"},
        {"name": "color-gamut", "value": "srgb"},
        {"name": "dynamic-range", "value": "standard"},
        {"name": "hover", "value": "hover"},
        {"name": "pointer", "value": "fine"},
    ]
})
```

### 2.13 Storage Partitioning (Chrome 115+)

**What changed:**
Chrome 115 enforced storage partitioning in third-party contexts. Previously, `localStorage`, `IndexedDB`, `Cache API`, `ServiceWorkers`, and cookies in iframes were shared across sites (allowing cross-site tracking). Now each top-level origin has its own partition.

**Chrome 137 (May 2025):** Blob URLs are partitioned for all uses except top-level navigations.

**Impact on scraping/detection:**
- Cross-site fingerprinting via shared storage state is broken at the browser level
- CHIPS (Cookies Having Independent Partitioned State): third-party cookies require `Partitioned` attribute to persist across sites
- Private State Tokens (formerly Trust Tokens): allow sites to issue signed "humanity vouches" that survive storage partitioning — bots cannot obtain these legitimately

**For scrapers:**
- Ensure the Chrome profile directory is separate per session to avoid cross-contamination
- Be aware that sites using Private State Tokens will detect first-visit bot behavior even if fingerprints look clean

---

## PART 3: NETWORK-LEVEL FINGERPRINTING

### 3.1 TLS Fingerprinting (JA3/JA4)

**JA3:** Hash of TLS ClientHello fields (version, cipher suites, extensions, elliptic curves, EC point formats). Python `requests` has a different JA3 than Chrome.

**JA4:** Next-generation, more stable. Sorts extensions alphabetically before hashing, so Chrome's TLS extension permutation (Chrome 117+) doesn't generate billions of JA3s.

**Akamai's additional signal:** HTTP/2 fingerprint combining JA3 with HTTP/2 SETTINGS.

**For CDP-based Chromium:** Since you're using a real Chromium binary, TLS fingerprint IS a real Chrome fingerprint. This is one area where CDP-based tools have inherent advantage over Python `requests`.

**Risk:** If you're using a proxy, the proxy must be transparent at TLS level (not MITM). Using Charles Proxy or similar SSL inspection tools changes the TLS fingerprint.

### 3.2 HTTP/2 Fingerprinting (Akamai)

**What it fingerprints:**
- SETTINGS frame values sent at connection start: HEADER_TABLE_SIZE (65536 for Chrome), ENABLE_PUSH (0), MAX_CONCURRENT_STREAMS (variable), INITIAL_WINDOW_SIZE (6291456 for Chrome), MAX_FRAME_SIZE (16384)
- WINDOW_UPDATE frame: Chrome sends 15663105
- Stream priority: Chrome uses specific priority tree structure
- Pseudo-header order: Chrome sends `:method, :authority, :scheme, :path`

**For CDP Chromium:** Again, real Chromium = real HTTP/2 fingerprint. Safe.

**Risk:** Some proxies (especially SOCKS5) alter HTTP/2 framing. Test your proxy chain.

### 3.3 IP Reputation and ASN

- Datacenter IPs (AWS, GCP, Azure, DigitalOcean ASNs) are flagged immediately
- Residential proxies (ISP ASNs) pass ASN checks
- IP blacklists: Akamai, Cloudflare, DataDome maintain updated blocklists
- IPv6: Some scrapers use IPv4 but Chrome sends IPv6-capable headers — inconsistency

---

## PART 4: DETECTION SYSTEMS ANALYSIS

### 4.1 FingerprintJS Pro

**What it collects:**
- Canvas 2D + WebGL rendering hash
- AudioContext hash (OfflineAudioContext oscillator test)
- Screen properties (width, height, colorDepth, devicePixelRatio)
- Navigator properties (userAgent, platform, language, hardwareConcurrency, deviceMemory, cookieEnabled, doNotTrack)
- Timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
- Installed fonts (via CSS/canvas measurement)
- Touch support
- Plugin list
- Session storage, local storage availability
- IndexedDB availability
- OpenDB availability
- WebRTC local IPs
- Math functions precision (Math.tan, Math.sin output consistency)
- Vendor ID / renderer string
- DomBlockers (common ad blocker signatures)
- Cookie hash

**Bot detection module (additional):**
- `navigator.webdriver`
- HeadlessChrome UA patterns
- Runtime.enable CDP signal (Pro version)
- Browser attribute inconsistencies
- Error stack traces for sourceURL leaks
- `chrome.app`, `chrome.runtime` presence
- `window.__selenium_unwrapped`, `window._phantom`, etc.

### 4.2 CreepJS

CreepJS assigns a "trust score" 0-100% by measuring:

- **Lie Detection**: Checks if browser APIs have been overridden by inspecting function `toString()` — native functions return `"function x() { [native code] }"`. Wrapped/proxied functions may not pass `instanceof` checks or have wrong `length` values.
- **Prototype chain integrity**: Checks that `Object.getPrototypeOf(navigator)` returns `Navigator.prototype`, that prototype methods are intact.
- **Worker scope fingerprint**: Runs fingerprinting code in Web Workers and Service Workers — results should match main page. Injection via `addScriptToEvaluateOnNewDocument` may not reach workers.
- **Cross-context consistency**: Compares fingerprint from main page vs. iframes vs. workers. Inconsistencies reveal patching.
- **Math precision**: `Math.tan(-1e300)` should return `-1.4214488238747245`. Virtualized environments sometimes differ.
- **Error stack trace format**: Chrome vs Firefox vs Safari have different stack trace formats.
- **CSS computed styles**: Font rendering metrics via `getComputedStyle`.
- **Garbage collector timing**: Timing of GC-induced pauses can fingerprint JS engine version.
- **WebGL shader rendering**: Complex shader output hashed.

**Key insight:** CreepJS specifically tests for "Brave-like" farbling patterns (random noise in canvas/audio) and treats them as a detectable bot signal.

### 4.3 rebrowser-bot-detector Tests

All 10 tests with countermeasures:

1. **runtimeEnableLeak** → Use AddBinding method, avoid Runtime.enable
2. **sourceUrlLeak** → Remove `//# sourceURL=` or use generic filename
3. **mainWorldExecution** → Use isolated worlds for script injection
4. **navigatorWebdriver** → `--disable-blink-features=AutomationControlled` + CDP doesn't set it
5. **bypassCsp** → Don't call `page.setBypassCSP(true)`
6. **viewport** → Use realistic viewport: at least 1280x720, preferably 1920x1080
7. **window.dummyFn** → Ensure scripts can't detect isolated execution context
8. **useragent** → Never use "Google Chrome for Testing" UA
9. **pwInitScripts** → `window.__pwInitScripts` must not exist (don't use Playwright)
10. **exposeFunctionLeak** → Don't use `page.exposeFunction()` or clean up after use

### 4.4 BrowserLeaks.com Test Categories

Full list of what BrowserLeaks checks:

- IP Address + Geolocation
- WebRTC Leak (local/public IP via RTCPeerConnection)
- Canvas Fingerprint (2D drawing hash)
- WebGL Report (renderer string, vendor, extensions, parameters)
- WebGL Image (rendered scene hash)
- Font Fingerprint (~400 fonts probed)
- HTTP Headers (Accept, Accept-Language, Accept-Encoding, User-Agent, Sec-CH-UA Client Hints)
- JavaScript / Navigator properties (all navigator.* fields)
- SSL/TLS Client Test (JA3 fingerprint)
- HTTP/2 Test (Akamai-style H2 fingerprint)
- Geolocation API
- Browser Plugin Details
- CSS Media Queries (all media features)
- Screen Resolution / Color Depth
- System Fonts (CSS detection method)
- AudioContext Fingerprint
- Battery Status API
- Gamepad API (presence/absence)
- Ambient Light Sensor
- Device Orientation
- Speech Synthesis Voices
- Network Information API (navigator.connection)
- Hardware Concurrency (navigator.hardwareConcurrency)
- Device Memory (navigator.deviceMemory)
- Storage Quota
- Service Workers
- Social Media Login Detection (checks if logged into Twitter/Facebook/etc. via CSS)
- WebSocket

---

## PART 5: ANTI-DETECT BROWSER APPROACHES

### 5.1 Multilogin (Mimic + Stealthfox)

- Proprietary Chromium build called "Mimic" and Firefox build called "Stealthfox"
- Patches applied at C++ source level
- 50+ spoofed parameters per profile
- Cloud-synced fingerprint profiles
- Canvas, WebGL, AudioContext, fonts all spoofed via engine-level patches
- Key differentiator: team tracks new Chrome releases and re-patches quickly

### 5.2 GoLogin (Orbita Browser)

- Custom Chromium-based browser ("Orbita")
- Automatically configures 53 fingerprint parameters
- Parameters include: AudioContext, Browser, Canvas, Client Rects, External Storage, Fonts, Geo-location, Languages, Local Storage, Media devices, Platform, Plugins, Resolution, Timezone, User-Agent, WebGL Image, WebGL Metadata, WebRTC
- Cloud fingerprint database

### 5.3 Dolphin Anty

- Based on real device fingerprints (not synthetic)
- Supports Linux
- Detailed per-parameter control: Canvas, WebGL, audio, fonts
- One of few that claims to use real device fingerprint data

### 5.4 CloakBrowser (Open Source, Chromium 145)

- 33 source-level C++ patches compiled into binary
- Categories: canvas, WebGL, audio, fonts, GPU reporting, screen, hardware, automation signal removal, CDP input behavior, locale, WebGPU adapter features/limits, pointer/keyboard/mouse event behavior
- Drop-in Playwright replacement
- Last tested March 2026: passes 30/30 detection tests
- reCAPTCHA v3: 0.9 score (human-level)

### 5.5 Camoufox (Open Source, Firefox-based)

- Firefox-based, patches at C++ level
- BrowserForge for statistical fingerprint generation
- All Playwright code sandboxed (can't be detected via JS inspection)
- Patches: Navigator, Screen, Window, Document, HTTP Headers, Geolocation/Intl, WebRTC, WebGL, Media/Audio, Voices, Addons, Fonts, Cursor movement
- Note (2026): Maintenance gap, performance degraded

### 5.6 rebrowser-patches (Puppeteer/Playwright patches)

- Patches 3 signals: Runtime.enable leak, sourceURL leak, utility world naming
- `REBROWSER_PATCHES_RUNTIME_FIX_MODE`: addBinding (default), alwaysIsolated, enableDisable
- Available as drop-in: `rebrowser-puppeteer`, `rebrowser-puppeteer-core`
- Does NOT fix canvas/WebGL/audio — focuses on CDP-level signals only

---

## PART 6: ZENDRIVER-SPECIFIC IMPLEMENTATION GUIDE

### 6.1 Current zendriver Capabilities

- Uses CDP directly (no WebDriver protocol) → navigator.webdriver not set
- v0.15.0+: `webrtc_leak_protection = True` → adds `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`
- `user_agent` option for UA override
- WebGL disabling option (useful for avoiding WebGL fingerprinting entirely, but suspicious if site expects WebGL)
- Performance against anti-bot services: ~75% success rate vs Cloudflare/Datadome/CloudFront/Akamai

### 6.2 Known Gaps in zendriver

- Canvas fingerprinting: NO built-in spoofing (issue #108 open)
- Font fingerprinting: NO built-in spoofing
- AudioContext fingerprinting: NO built-in spoofing
- WebGL renderer string: NOT spoofed by default
- Speech synthesis: NOT spoofed
- CSS media queries: NOT spoofed via CDP

### 6.3 Recommended Injection Script for zendriver

Use `Page.addScriptToEvaluateOnNewDocument` to inject before any page JS runs:

```python
STEALTH_SCRIPT = """
(function() {
  // 1. Fix navigator.webdriver (already handled by zendriver's no-WebDriver approach)
  // Defensive: delete it if somehow set
  if (navigator.webdriver) {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  }

  // 2. Fix window.outerWidth/outerHeight (Playwright leaves these at 0)
  if (window.outerWidth === 0) {
    Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
    Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 88 });
  }

  // 3. Fix navigator.plugins (headless has empty array)
  const plugins = [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
  ];
  Object.defineProperty(navigator, 'plugins', { get: () => plugins });

  // 4. Fix navigator.languages
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // 5. Fix chrome object (missing in some headless contexts)
  if (!window.chrome) {
    window.chrome = {
      app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
      csi: function() { return { startE: Date.now(), onloadT: Date.now(), pageT: 1000, tran: 15 }; },
      loadTimes: function() { return { connectionInfo: 'h2', finishDocumentLoadTime: Date.now()/1000, finishLoadTime: Date.now()/1000, firstPaintAfterLoadTime: 0, firstPaintTime: Date.now()/1000, navigationType: 'Other', npnNegotiatedProtocol: 'h2', requestTime: Date.now()/1000 - 1, startLoadTime: Date.now()/1000 - 1, wasAlternateProtocolAvailable: false, wasFetchedViaSpdy: true, wasNpnNegotiated: true }; },
      runtime: { id: undefined }
    };
  }

  // 6. AudioContext - session-stable noise injection
  const AUDIO_NOISE_SEED = Math.random() * 0.0001;
  const origGetChannelData = AudioBuffer.prototype.getChannelData;
  AudioBuffer.prototype.getChannelData = new Proxy(origGetChannelData, {
    apply(target, thisArg, args) {
      const data = target.apply(thisArg, args);
      for (let i = 0; i < data.length; i += 100) {
        data[i] += AUDIO_NOISE_SEED;
      }
      return data;
    }
  });

  // 7. WebGL renderer spoofing
  const getParameterProxyHandler = {
    apply(target, thisArg, args) {
      const param = args[0];
      if (param === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      if (param === 37445) return 'Google Inc. (Intel)';
      return target.apply(thisArg, args);
    }
  };
  WebGLRenderingContext.prototype.getParameter = new Proxy(WebGLRenderingContext.prototype.getParameter, getParameterProxyHandler);
  WebGL2RenderingContext.prototype.getParameter = new Proxy(WebGL2RenderingContext.prototype.getParameter, getParameterProxyHandler);

  // 8. Speech synthesis voices
  const synth = window.speechSynthesis;
  if (synth) {
    const fakeVoices = [
      { default: true, lang: 'en-US', localService: true, name: 'Microsoft David Desktop - English (United States)', voiceURI: 'Microsoft David Desktop - English (United States)' },
      { default: false, lang: 'en-US', localService: true, name: 'Microsoft Zira Desktop - English (United States)', voiceURI: 'Microsoft Zira Desktop - English (United States)' },
    ];
    Object.defineProperty(synth, 'getVoices', { value: () => fakeVoices });
  }

})();
"""

# Apply via CDP
await tab.cdp_session.execute("Page.addScriptToEvaluateOnNewDocument", {
    "source": STEALTH_SCRIPT
})
```

### 6.4 Chrome Launch Flags for zendriver

```python
import zendriver as zd

config = zd.Config(
    headless=False,  # Use headed mode, or use Xvfb externally
    browser_args=[
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",  # Only if using Xvfb without GPU
        "--window-size=1920,1080",
        "--start-maximized",
        "--lang=en-US",
        "--accept-lang=en-US,en",
        # Do NOT add these (they break fingerprint authenticity):
        # --disable-features=WebBluetooth  (makes navigator.bluetooth undefined)
        # --disable-webgl  (too suspicious)
    ]
)
```

---

## PART 7: DETECTION EVASION MATRIX

| Detection Vector | Severity | Zendriver Status | Fix |
|-----------------|----------|-----------------|-----|
| navigator.webdriver | CRITICAL | SAFE (no WebDriver) | None needed |
| Runtime.enable leak | CRITICAL | SAFE (uses CDP directly) | None needed |
| sourceURL in stacks | HIGH | SAFE (no Puppeteer) | None needed |
| __pwInitScripts | HIGH | SAFE (not Playwright) | None needed |
| HeadlessChrome UA | HIGH | Fix with UA override | Emulation.setUserAgentOverride |
| Canvas fingerprint | HIGH | OPEN GAP | Session-stable noise via Proxy |
| WebGL renderer string | HIGH | OPEN GAP | getParameter Proxy in injected script |
| AudioContext hash | HIGH | OPEN GAP | AudioBuffer.getChannelData Proxy |
| Font list (Linux) | HIGH | OPEN GAP | Install fonts + navigator.fonts override |
| Speech synthesis voices | MEDIUM | OPEN GAP | speechSynthesis.getVoices override |
| navigator.plugins empty | HIGH | OPEN GAP | Plugins array injection |
| window.outerWidth=0 | HIGH | OPEN GAP | Override in injected script |
| Screen resolution (Xvfb) | HIGH | OPEN GAP | Xvfb 1920x1080 + Emulation.setDevice |
| WebRTC IP leak | HIGH | FIXED (v0.15.0+) | webrtc_leak_protection=True |
| Bluetooth/USB/HID APIs | MEDIUM | Check flags | Don't disable these features |
| CSS media queries | MEDIUM | OPEN GAP | Emulation.setEmulatedMedia |
| Touch points | LOW | SAFE (defaults to 0) | None for desktop |
| Keyboard layout | LOW | LOW RISK | Use realistic key events |
| Performance.now timing | LOW | SAFE (Chrome handles) | None needed |
| TLS fingerprint (JA3) | MEDIUM | SAFE (real Chromium) | None needed |
| HTTP/2 fingerprint | MEDIUM | SAFE (real Chromium) | None needed |
| IP reputation (ASN) | CRITICAL | Use residential proxy | Outside scope |
| Storage partitioning | LOW | Chrome handles | Use separate profiles |
| Private State Tokens | MEDIUM | Cannot fake | No countermeasure |

---

## PART 8: CRITICAL WARNINGS AND COMMON MISTAKES

### 8.1 Canvas Noise Must Be Session-Stable

Do NOT generate new random noise on each `toDataURL()` call. Detection systems call it multiple times and flag hash changes. Generate one seed per browser session and apply consistently.

### 8.2 WebGL Renderer Must Match Real Devices

Do NOT use random GPU strings. Use only GPU strings from the [GPU fingerprint database](https://scrapfly.io/web-scraping-tools/gpu-fingerprint) that correspond to your claimed User-Agent / OS combination.

### 8.3 User-Agent Must Be Fully Consistent

All of these must match and be internally consistent:
- `navigator.userAgent`
- `navigator.userAgentData` (User-Agent Client Hints)
- HTTP `User-Agent` header
- `Sec-CH-UA` header
- `Sec-CH-UA-Platform` header
- `navigator.platform`
- `navigator.vendor`
- `navigator.appVersion`

### 8.4 Function Native Checks

Anti-bot scripts check:
```javascript
Function.prototype.toString.call(navigator.plugins.item) // must say "native code"
```

Override functions using `Proxy` objects with `apply` traps, not direct assignment. Proxy objects are harder to detect than direct function replacement, though not impossible.

### 8.5 Worker Context Consistency

`addScriptToEvaluateOnNewDocument` does NOT run in Web Workers or Service Workers. CreepJS and other advanced fingerprinters run checks in workers and compare to main page. Inconsistencies in worker vs. main-page fingerprints = detected.

To cover workers, inject scripts that intercept `Worker` and `ServiceWorker` constructors and apply patches via `importScripts` or by intercepting worker message passing.

### 8.6 iframe Consistency

Fingerprints run inside iframes (sandboxed or not) should match. `iframe.contentWindow.navigator` has a different prototype chain than `window.navigator`. Patches applied to the top-level window do not automatically apply in iframes.

In Playwright (and rebrowser-patches), `iframe.contentWindow` is a known detection vector fixed by specific patches.

---

## PART 9: SUMMARY PRIORITY LIST FOR ZENDRIVER

**Implement immediately (HIGH impact, existing gaps):**
1. `Page.addScriptToEvaluateOnNewDocument` with full stealth script (see Part 6.3)
2. Xvfb at 1920x1080x24 for realistic screen properties
3. Install fonts in container: `fonts-liberation`, `fonts-noto`, `ttf-mscorefonts-installer` (or equivalent)
4. Realistic UA string + consistent Client Hints via `Emulation.setUserAgentOverride`
5. `Emulation.setEmulatedMedia` for media query properties
6. `--disable-blink-features=AutomationControlled` (defensive, zendriver likely handles)
7. Use residential proxy, not datacenter

**Implement for advanced targets:**
8. Worker-context script injection
9. iframe fingerprint consistency
10. Behavioral humanization (mouse, keyboard timing, scroll)
11. Session-based profile persistence (consistent fingerprint across visits)
12. Private State Token acquisition strategy (if needed for specific targets)
