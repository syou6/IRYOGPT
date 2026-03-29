# Research: Chrome DevTools Protocol (CDP) Automation Detection Methods (2025–2026)

## Executive Summary

Anti-bot systems have moved well beyond simple `navigator.webdriver` checks. As of 2025–2026, detection is layered across protocol-level CDP signals, JavaScript environment inconsistencies, behavioral biometrics, and fingerprint cross-validation. A critical V8 change in May 2025 broke a widely-used CDP serialization signal, forcing defenders onto multi-signal strategies. Meanwhile, tools like nodriver/zendriver evade detection by minimizing CDP domain usage entirely.

---

## 1. ALL Known CDP-Based Detection Methods

### 1.1 navigator.webdriver

The oldest and most widely known signal. When a browser is controlled via WebDriver or CDP, Chrome automatically sets `navigator.webdriver = true`.

**Detection:**
```javascript
if (navigator.webdriver) { /* bot detected */ }
```

**Evasion:**
- `Object.defineProperty(navigator, 'webdriver', { get: () => undefined })`
- Chrome flag: `--disable-blink-features=AutomationControlled`
- puppeteer-extra-plugin-stealth's `navigator.webdriver` evasion module injects this via `addScriptToEvaluateOnNewDocument`

**Status:** Trivially bypassed by any stealth plugin, but still catches unpatched bots.

---

### 1.2 window.cdc_ Properties (ChromeDriver-Specific)

ChromeDriver injects a hardcoded global variable into the page's JavaScript context. The name follows the pattern `$cdc_asdjflasutopfhvcZLmcfl_` (varies slightly by version).

**Detection:**
```javascript
if (document["$cdc_asdjflasutopfhvcZLmcfl_"]) { /* Selenium/ChromeDriver detected */ }
// or: scan all window keys for /\$cdc_/ pattern
```

**Evasion:**
- undetected-chromedriver patches the ChromeDriver binary to replace the `cdc_` string
- Manual binary patching: `vim chromedriver` → `:%s/cdc_/dog_/g`
- Pure CDP frameworks (Puppeteer, Playwright) do NOT inject this variable — it's ChromeDriver-specific

**Status:** Active detection vector for raw Selenium. Not applicable to Puppeteer/Playwright.

---

### 1.3 Runtime.enable CDP Detection (The 2024 Signal)

**This is the most significant CDP detection method discovered in 2024.**

All major automation libraries — Puppeteer, Playwright, Selenium — send `Runtime.enable` CDP command to the browser. This command is essential for:
- Receiving `Runtime.executionContextCreated` events (to discover frame execution context IDs)
- Receiving `Runtime.consoleAPICalled` events (to capture console output)

When `Runtime.enable` is active, Chrome serializes objects passed to `console.*` methods across the CDP WebSocket. This serialization triggers custom property getters:

**Detection code (the classic 2024 technique):**
```javascript
let wasSerialized = false;
const e = new Error();
Object.defineProperty(e, 'stack', {
  get() {
    wasSerialized = true;
    return '';
  }
});
console.debug(e);
// If wasSerialized is true after a tick, Runtime.enable is active
```

**Why it worked:** CDP's `Runtime.consoleAPICalled` event causes Chrome to preview/serialize the logged object, which reads `.stack`, triggering the getter.

**Why it STOPPED working (May 2025):** Two V8 commits in May 2025 introduced a guard function `getErrorProperty()` that explicitly skips user-defined getters when inspecting error objects. V8 now checks if a property's getter has a valid `ScriptId` (indicating it is user code) and refuses to call it during CDP preview. The flag never flips.

**Source:** [Why a classic CDP bot detection signal suddenly stopped working](https://blog.castle.io/why-a-classic-cdp-bot-detection-signal-suddenly-stopped-working-and-nobody-noticed/)

**Evasion (before May 2025 breakage):**
1. **Isolated Context method:** Use `Page.createIsolatedWorld` to create contexts without triggering `Runtime.enable` in the main world
2. **Enable-Disable trick:** Call `Runtime.enable` immediately followed by `Runtime.Disable`
3. **Avoid CDP Runtime domain entirely** (nodriver/zendriver approach)

---

### 1.4 sourceURL Leak (Puppeteer-Specific)

Puppeteer automatically appends a `//# sourceURL=__puppeteer_evaluation_script__` comment to every script evaluated via `page.evaluate()`. This string appears in stack traces and error objects.

**Detection:**
```javascript
// Overriding a function and checking the stack trace of calls to it
const originalQuerySelector = document.querySelector;
document.querySelector = function(...args) {
  const stack = new Error().stack;
  if (stack.includes('__puppeteer_evaluation_script__')) {
    /* Puppeteer detected */
  }
  return originalQuerySelector.apply(this, args);
};
```

Also detectable via the rebrowser-bot-detector `sourceUrlLeak` test.

**Playwright equivalent:** Playwright uses `__playwright_evaluation_script__` as its sourceURL marker.

**Evasion:**
- puppeteer-extra-plugin-stealth's `sourceurl` evasion module strips/randomizes this marker
- Use `Page.addScriptToEvaluateOnNewDocument` instead of `page.evaluate()` — the injected script does not get this marker

---

### 1.5 window.__pwInitScripts and Playwright Globals

Playwright injects several global variables into every page it controls:

**Detectable globals:**
- `window.__pwInitScripts` — Playwright initialization scripts array
- `window.__playwright__binding__` — Playwright's binding object for Node.js↔browser communication
- Any function exposed via `page.exposeFunction()` — creates a global with an `__installed` boolean property

**Detection:**
```javascript
if (window.__pwInitScripts) { /* Playwright detected */ }
if (window.__playwright__binding__) { /* Playwright detected */ }
// Scan all window properties for __installed flag
for (const key of Object.keys(window)) {
  if (typeof window[key] === 'function' && window[key].__installed) {
    /* Playwright exposeFunction detected */
  }
}
```

**Evasion:** Use Playwright's `addInitScript` carefully; avoid `exposeFunction` when stealth is needed.

---

### 1.6 mainWorldExecution / Isolated World Detection

Puppeteer and Playwright (with certain configurations) run evaluation scripts in an **isolated JavaScript world** — a separate V8 context that shares the DOM but not the JavaScript heap with the page's main world.

**Detection:**
```javascript
// Site patches a function in main world
window._testFn = function() { return 'original'; };
// Automation tool tries to override it from isolated world — change is invisible to main world
// Site checks if the function was modified
if (window._testFn() === 'original') {
  /* Either not automated, or running in isolated world (automation indicator) */
}
```

The rebrowser-bot-detector `mainWorldExecution` test checks whether automation code can alter `document.querySelector` (which requires main world access).

**Evasion:**
- Run evaluation in main world: `page.evaluate()` (Puppeteer) or `page.evaluate()` (Playwright) both run in main world by default
- The rebrowser patch (`REBROWSER_PATCHES_RUNTIME_FIX_MODE=alwaysIsolated`) moves execution to isolated world — this introduces its own detection risk

---

### 1.7 Performance.getMetrics / Timing Discrepancies

CDP exposes `Performance.getMetrics` which returns internal Chrome performance counters. The timing profile of an automated browser can differ from a human-driven browser:

- Zero or near-zero values for interaction metrics (no real user input events)
- Unusually fast or uniform page load sequences
- Missing paint metrics (`first-contentful-paint`, `largest-contentful-paint`) in headless mode

**Also:** `chrome.loadTimes()` is a legacy Chrome API that exposes page load timing. Headless Chrome historically had different values for `wasNpnNegotiated`, `connectionInfo`, and `requestTime`.

**Status:** Less reliable after headless Chrome unification (Nov 2022). Modern headless Chrome has matching timing behavior. Behavioral timing analysis (mouse/scroll patterns) is more reliable.

---

### 1.8 Error Stack Traces Containing CDP / VM Context Markers

Scripts executed via CDP (both `Runtime.evaluate` and `Page.addScriptToEvaluateOnNewDocument`) may appear in stack traces as `VM<number>` (e.g., `VM215`, `VM216`) in Chrome DevTools.

**Detection approach:**
```javascript
function checkStack() {
  try { throw new Error(); } catch(e) {
    if (/VM\d+/.test(e.stack)) { /* CDP-injected script context */ }
  }
}
```

**Also detectable via Memory Profiler:** Loading an allocation sampling profile during page load shows suspicious `VM`-labeled scripts, which can be inspected for obfuscated anti-detect injection code.

**Source:** [Analyzing anti-detect browsers: How to detect scripts injected via CDP in Chrome](https://blog.castle.io/how-to-detect-scripts-injected-via-cdp-in-chrome-2/)

---

### 1.9 chrome.runtime Differences

Real Chrome has a populated `chrome.runtime` object with methods like `chrome.runtime.connect()`. Headless Chrome and automation frameworks often have an empty or missing `chrome.runtime`.

**Detection:**
```javascript
if (!window.chrome || !window.chrome.runtime) { /* not real Chrome */ }
if (window.chrome && window.chrome.runtime && !window.chrome.runtime.connect) { /* spoofed */ }
```

puppeteer-extra-plugin-stealth has a dedicated `chrome.runtime` evasion module to populate this object correctly.

**Also:** `chrome.app`, `chrome.csi`, and `chrome.loadTimes` — all three are present in real Chrome but absent or partially absent in headless/automated Chrome without stealth.

---

### 1.10 WebSocket Connection Pattern Detection

Anti-bot systems can, in theory, detect CDP WebSocket connections to the browser. From the server side:
- The browser opens a WebSocket connection on a debug port (default `9222`)
- The `/json/version` endpoint is accessible on that port

**From the page's JavaScript context:** CDP WebSocket traffic is not directly observable by page scripts. However, behavioral side effects of CDP commands (timing, serialization events) ARE observable.

**The detectable side effect:** CDP serialization of objects sent over the WebSocket triggers getter calls in the page context (the basis for the Runtime.enable detection).

---

### 1.11 bypassCSP Detection

When automation calls `page.setBypassCSP(true)`, it uses CDP's `Page.setBypassCSP` command. This can be detected because it allows inline scripts and eval in contexts where CSP would normally block them.

**Detection:**
```javascript
// Probe: try to execute an inline eval or injected script
// If it succeeds on a page with strict CSP, bypassCSP is active
```

The rebrowser-bot-detector has an explicit `bypassCsp` test for this.

---

### 1.12 Viewport Size Detection

Automation frameworks use non-human-standard viewport sizes:
- Puppeteer default: **800x600**
- Playwright default: **1280x720**

Real users almost never have these exact viewport dimensions.

**Detection:**
```javascript
if (window.innerWidth === 800 && window.innerHeight === 600) { /* Puppeteer default */ }
if (window.innerWidth === 1280 && window.innerHeight === 720) { /* Playwright default */ }
```

The rebrowser-bot-detector tests this explicitly. puppeteer-extra-plugin-stealth's `window.outerdimensions` module patches this.

---

### 1.13 HeapSnapshot Detection

Using the CDP `HeapProfiler` domain (`HeapProfiler.takeHeapSnapshot`) is observable as a side effect because it enumerates ALL JavaScript objects. A custom getter on an object would fire:

```javascript
// Objects with custom getters will be read during heap snapshot
const sentinel = {};
Object.defineProperty(sentinel, 'secret', {
  get() { /* triggered if HeapProfiler reads this object */ }
});
window._sentinel = sentinel;
```

This is a theoretical/advanced technique — not commonly deployed in production detection scripts.

---

## 2. What creepjs Detects

creepjs (https://abrahamjuliot.github.io/creepjs/) is an open-source browser fingerprinting library specifically designed to **detect inconsistencies in anti-fingerprinting tools** and automation. It is uniquely aggressive in detecting "lies" (spoofed values).

### Fingerprinting Signals Collected:

**Canvas:**
- 2D canvas image rendering (shapes, text, emoji, text metrics)
- OffscreenCanvas behavior
- Canvas paint operations

**WebGL:**
- GPU model and vendor (`UNMASKED_VENDOR_WEBGL`, `UNMASKED_RENDERER_WEBGL`)
- WebGL extensions list
- Rendering capabilities
- WebGL2 parameters

**Audio:**
- Web Audio API processing characteristics
- Frequency domain data
- AudioContext compressor behavior
- Sample values from OscillatorNode

**Screen & Display:**
- Screen resolution (`screen.width`, `screen.height`)
- Available screen space (`screen.availWidth`, `screen.availHeight`)
- Color depth, pixel depth
- Device pixel ratio
- Window dimensions (`outerWidth`, `outerHeight`, `innerWidth`, `innerHeight`)

**Navigator Properties:**
- `navigator.userAgent`, `navigator.appVersion`
- `navigator.platform` (OS identifier)
- `navigator.vendor`
- `navigator.hardwareConcurrency` (CPU core count)
- `navigator.deviceMemory`
- `navigator.languages`
- `navigator.mimeTypes` and `navigator.plugins`
- `navigator.webdriver` (automation flag)
- `navigator.permissions` behavior

**JavaScript Engine Fingerprinting:**
- Math function precision (`Math.tan(-1e308)`, `Math.acos(0.123)`, etc.)
- Error stack trace format and content
- Error message text
- `toString()` output of native functions (detects proxy wrapping)
- `Function.prototype.toString()` — proxied functions return non-native source

**Prototype Lie Detection:**
creepjs explicitly tests whether any `Object.defineProperty` overrides have been applied to browser APIs. It checks if native function `toString()` returns the correct `[native code]` string and whether the prototype chain is intact. Stealth tools using `Proxy` or `Object.defineProperty` are detectable because their `toString()` output often differs subtly.

**Additional API Signals:**
- Fonts (via Canvas text rendering)
- WebRTC (IP leak, ICE candidate generation behavior)
- Speech synthesis voices
- Media codecs (video/audio format support)
- Media devices (camera/microphone count and labels)
- CSS media query responses
- `document.hasTrustToken` behavior
- Battery API (if available)
- `window.chrome` object presence and completeness

**Anti-Fingerprinting Tool Detection:**
creepjs specifically identifies:
- Tor Browser
- Brave (fingerprint randomization mode)
- Firefox Enhanced Tracking Protection
- Browser extensions that modify fingerprints
- puppeteer-extra-plugin-stealth (via prototype lie detection)

**Trust Score System:**
creepjs computes a "trust score" based on:
- Consistency of fingerprint over multiple checks
- Number of detected "lies" (inconsistent values)
- Whether the fingerprint matches known human baseline distributions

**Source:** [What is CreepJS Browser Fingerprint and How to Bypass It - Scrapfly](https://scrapfly.io/blog/posts/browser-fingerprinting-with-creepjs)

---

## 3. What FingerprintJS / Fingerprint Pro Detects

FingerprintJS (open source) and Fingerprint Pro (commercial) are visitor identification systems. The commercial product includes dedicated bot detection (BotD).

### BotD (Open Source Bot Detection Library)

Detectable automation tools:
- Headless Chrome / Firefox
- Selenium (and variants: undetected-chromedriver, pyppeteer_stealth)
- Playwright
- PhantomJS
- Nightmare
- Electron
- SlimerJS
- puppeteer-extra-plugin-stealth (Pro version)
- browserless (Pro version)

**Source:** [FingerprintJS/BotD GitHub](https://github.com/fingerprintjs/BotD)

### Fingerprint Pro Detection Signals (Combined Client + Server):

**Browser attributes (client-side):**
- Canvas, WebGL, audio fingerprints
- Installed fonts
- Screen resolution and color depth
- Device pixel ratio
- `navigator.hardwareConcurrency`
- `navigator.deviceMemory`
- Timezone and language settings
- `navigator.plugins` and `navigator.mimeTypes`
- Browser version and feature support (feature detection matrix)

**Automation-specific checks:**
- `navigator.webdriver` presence
- Missing APIs (Notification API, WebRTC internals)
- `window.chrome` object integrity
- Permissions API behavior
- `navigator.plugins` count (headless Chrome has 0 by default)
- User agent containing "HeadlessChrome" or "Google Chrome for Testing"

**Server-side signals:**
- HTTP headers
- TLS fingerprints (JA3/JA4)
- TCP connection patterns
- IP reputation

**Behavioral signals (Pro):**
- Cursor movement trajectory
- Scroll velocity and patterns
- Keystroke timing dynamics
- Click coordinates (center vs. natural click)
- Touch events (mobile)
- Network overrides

**Source:** [FingerprintJS BotD npm](https://www.npmjs.com/package/@fingerprintjs/botd), [Fingerprint Bot Detection](https://fingerprint.com/products/bot-detection/)

---

## 4. puppeteer-extra-plugin-stealth: ALL Evasion Modules

The plugin uses `Page.addScriptToEvaluateOnNewDocument` (CDP) to inject all patches BEFORE the page's own JavaScript runs.

### Complete Module List (17 evasions):

| Module | What It Patches |
|--------|----------------|
| `chrome.app` | Adds a realistic `chrome.app` object (absent in headless Chrome) |
| `chrome.csi` | Adds `chrome.csi()` timing API (absent in headless Chrome) |
| `chrome.loadTimes` | Adds `chrome.loadTimes()` API (absent in headless Chrome) |
| `chrome.runtime` | Adds a realistic `chrome.runtime` object with proper methods |
| `defaultArgs` | Removes automation-revealing default CLI flags |
| `iframe.contentWindow` | Patches `iframe.contentWindow.navigator.webdriver` — iframes have their own `navigator` which also gets `webdriver=true` in automation |
| `media.codecs` | Spoofs supported media codec list to match real Chrome |
| `navigator.hardwareConcurrency` | Sets CPU core count to realistic value (default: 4) |
| `navigator.languages` | Sets `navigator.languages` to realistic array |
| `navigator.permissions` | Patches `Notification.permission` to return `'default'` instead of `'denied'` (headless Chrome returns `'denied'`) |
| `navigator.plugins` | Adds realistic `navigator.plugins` and `navigator.mimeTypes` arrays (empty in headless Chrome) |
| `navigator.vendor` | Sets `navigator.vendor` to `'Google Inc.'` |
| `navigator.webdriver` | Removes/spoofs the `navigator.webdriver` property |
| `sourceurl` | Removes/obfuscates the `__puppeteer_evaluation_script__` sourceURL marker from injected scripts |
| `user-agent-override` | Removes `HeadlessChrome` from user agent; also patches `navigator.userAgent`, `navigator.appVersion`, `navigator.platform`, `navigator.userAgentData` |
| `webgl.vendor` | Spoofs `UNMASKED_VENDOR_WEBGL` and `UNMASKED_RENDERER_WEBGL` to realistic GPU values |
| `window.outerdimensions` | Sets `window.outerWidth`, `window.outerHeight` to match viewport (headless Chrome has these as 0) |

### How Injection Works:

All patches are applied via `Page.addScriptToEvaluateOnNewDocument`, which runs the JavaScript in every new document context BEFORE any page scripts execute. This is the correct approach — using `page.evaluate()` would run AFTER page scripts and could miss detection that happens at parse time.

**Source:** [puppeteer-extra GitHub evasions directory](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth/evasions)

---

## 5. playwright-stealth

`playwright-stealth` is a Python port (and JS port) of puppeteer-extra-plugin-stealth for Playwright. The Python package is available at https://pypi.org/project/playwright-stealth/

### What It Patches:

- `navigator.webdriver` removal
- `navigator.languages` override (via `navigator_languages_override` parameter)
- `navigator.platform` spoofing
- User agent (via `user_agent_override` parameter)
- Init scripts injection (applies all patches via `addInitScript` which uses `Page.addScriptToEvaluateOnNewDocument` internally)

### Important Caveat:

The maintainer explicitly states: **"Don't expect this to bypass anything but the simplest of bot detection methods."**

The Python port lags behind the JS version in coverage. The more complete version is `playwright-extra` with the stealth plugin (JS ecosystem).

**Source:** [playwright-stealth PyPI](https://pypi.org/project/playwright-stealth/)

### Playwright-Specific Gaps Not Covered by Stealth:

- `window.__pwInitScripts` injection by Playwright itself (not patched by stealth)
- `window.__playwright__binding__` from `exposeFunction()` calls
- Default viewport size (1280x720) — must be overridden manually
- "Google Chrome for Testing" user agent (Playwright uses this for fresh Chrome installs)

---

## 6. Page.addScriptToEvaluateOnNewDocument: The Critical Timing Difference

### What It Does

`Page.addScriptToEvaluateOnNewDocument` is a CDP method in the `Page` domain. It registers a JavaScript source string that Chrome will evaluate **in every new document context, before any of the document's own scripts execute**.

**CDP method signature:**
```
Page.addScriptToEvaluateOnNewDocument(
  source: string,             // JavaScript to execute
  worldName?: string,         // Optional: run in named isolated world
  includeCommandLineAPI?: boolean,
  runImmediately?: boolean    // If true, also run in existing contexts immediately
) -> { identifier: ScriptIdentifier }
```

The `identifier` returned can be used to remove the script later via `Page.removeScriptToEvaluateOnNewDocument`.

**Source:** [Chrome DevTools Protocol - Page domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/)

### Why Timing Matters for Stealth

**page.evaluate() timeline:**
```
[Page navigation starts]
  → [HTML parsing begins]
  → [Document scripts execute] ← DETECTION CAN HAPPEN HERE
  → [DOMContentLoaded fires]
  → [page.evaluate() runs]    ← TOO LATE: site JS already ran
```

**addScriptToEvaluateOnNewDocument timeline:**
```
[Page navigation starts]
  → [V8 context created for new document]
  → [addScriptToEvaluateOnNewDocument scripts run] ← PATCHES APPLIED
  → [HTML parsing begins]
  → [Document scripts execute]  ← See patched APIs
  → [DOMContentLoaded fires]
```

**Concrete example:** If a site detects `navigator.webdriver` during its own initialization code, a patch applied via `page.evaluate()` will run AFTER detection already occurred. The same patch via `addScriptToEvaluateOnNewDocument` runs before detection is possible.

### Playwright and Puppeteer Wrappers

Both frameworks expose this as a higher-level API:
- **Puppeteer:** `page.evaluateOnNewDocument(fn)` (wraps `addScriptToEvaluateOnNewDocument`)
- **Playwright:** `page.addInitScript(fn)` (wraps `addScriptToEvaluateOnNewDocument`)

These are the correct methods to use for stealth patching.

### Detection of addScriptToEvaluateOnNewDocument Injections

Scripts injected this way MAY appear as `VM<n>` contexts in stack traces. Anti-detect browsers that inject stealth scripts can be detected by inspecting `Debugger.scriptParsed` events via CDP and retrieving the source of injected scripts. This is how Castle documented the detection of anti-detect browser injections.

**Source:** [Analyzing anti-detect browsers: How to detect scripts injected via CDP in Chrome](https://blog.castle.io/how-to-detect-scripts-injected-via-cdp-in-chrome-2/)

---

## 7. New Detection Methods Discovered in 2025–2026

### 7.1 V8 Getter Bypass Fixed (May 2025) — Signal Dead

The `console.debug(errorWithCustomStackGetter)` CDP detection signal stopped working in May 2025 due to V8 commits that prevent user-defined getters from being called during CDP error object preview. This was a widely-deployed anti-bot signal.

**Source:** [Castle Blog - CDP signal stopped working](https://blog.castle.io/why-a-classic-cdp-bot-detection-signal-suddenly-stopped-working-and-nobody-noticed/)

### 7.2 "Google Chrome for Testing" User Agent (2024–2025)

Playwright and Puppeteer, when using freshly downloaded Chrome, now default to "Google Chrome for Testing" in the user agent string instead of "Google Chrome". This is a new, specific detection signal.

**Detection:** `navigator.userAgent.includes('Google Chrome for Testing')`

The rebrowser-bot-detector `useragent` test explicitly checks for this.

### 7.3 Browser Extension Detection via CDP Side Effects (2025–2026)

Castle documented (Jan 2026) that browser extensions leave detectable traces:
- Extensions inject content scripts into isolated worlds
- Extensions can expose global objects or modify the DOM
- Extension `web_accessible_resources` can be probed via `chrome-extension://` URLs
- LinkedIn was found to enumerate extensions by probing extension resource URLs

These same techniques apply to anti-detect browser extensions that inject stealth patches.

**Source:** [Detecting browser extensions for bot detection, lessons from LinkedIn and Castle](https://blog.castle.io/detecting-browser-extensions-for-bot-detection-lessons-from-linkedin-and-castle/)

### 7.4 AI Agent / LLM Crawler Detection (2025)

DataDome reported in 2025 that LLM agent traffic quadrupled (from 2.6% to 10%+ of bot traffic). New detection focuses on:
- Unusual intent patterns (not following human browsing paths)
- API-style access patterns from browser automation used by AI agents
- `browser-use` and similar AI agent frameworks being flagged by CDP-based detection

GitHub issue: [Bot Detection by CDP flags browser-use as bot](https://github.com/browser-use/browser-use/issues/360)

### 7.5 Rebrowser Bot Detector — New Test Suite (2024–2025)

A comprehensive modern test suite published as open source covering:

1. **runtimeEnableLeak** — CDP Runtime.enable side effect (partially mitigated post-May 2025)
2. **sourceUrlLeak** — `__puppeteer_evaluation_script__` in stack traces
3. **mainWorldExecution** — Whether automation can modify main world functions
4. **navigatorWebdriver** — Classic webdriver flag
5. **bypassCsp** — `page.setBypassCSP(true)` detection
6. **viewport** — Default viewport dimensions
7. **window.dummyFn** — Main world object accessibility from isolated contexts
8. **useragent** — "Google Chrome for Testing" detection
9. **pwInitScripts** — `window.__pwInitScripts` Playwright injection
10. **exposeFunctionLeak** — `page.exposeFunction()` global variable leak

**Source:** [rebrowser-bot-detector GitHub](https://github.com/rebrowser/rebrowser-bot-detector)

### 7.6 Per-Customer Behavioral Models (Cloudflare, 2025)

Cloudflare published research on per-customer bot defenses that use individual site traffic patterns to train detection models, making generic bypass tools less effective even when static fingerprinting signals pass.

**Source:** [Cloudflare - Building unique per-customer defenses against advanced bot threats](https://blog.cloudflare.com/per-customer-bot-defenses/)

---

## Summary Table: Detection Methods vs. Stealth Evasion Status

| Detection Method | Detected By | Stealth Evasion | Status (2025-2026) |
|-----------------|-------------|-----------------|-------------------|
| `navigator.webdriver = true` | All anti-bots | `Object.defineProperty` via `addScriptToEvaluateOnNewDocument` | Trivially bypassed |
| `window.$cdc_...` | Anti-bots | Binary patching or use non-ChromeDriver | ChromeDriver only; not in Puppeteer/Playwright |
| `Runtime.enable` CDP serialization side effect | DataDome, Cloudflare, others | Isolated world, enable/disable toggle, avoid Runtime domain | **SIGNAL BROKEN** since May 2025 V8 change |
| `sourceURL = __puppeteer_evaluation_script__` | Bot detectors | stealth `sourceurl` module | Active; requires patching |
| `window.__pwInitScripts` | Bot detectors | Avoid — no easy patch | Active; Playwright-specific |
| `window.__playwright__binding__` | Bot detectors | Avoid `exposeFunction()` | Active |
| `mainWorldExecution` (isolated world test) | Anti-bots | Use main world execution | Active |
| Viewport 800x600 / 1280x720 | Bot detectors | Set custom viewport | Active; trivially fixed |
| HeadlessChrome user agent | All | stealth `user-agent-override` module | Active; trivially fixed |
| "Google Chrome for Testing" UA | Bot detectors | Override user agent | Active (2024+) |
| `navigator.plugins = []` | Anti-bots | stealth `navigator.plugins` module | Active |
| `Notification.permission = 'denied'` | Anti-bots | stealth `navigator.permissions` module | Active |
| Missing `chrome.app/csi/loadTimes/runtime` | Anti-bots | stealth chrome.* modules | Active |
| `window.outerWidth/outerHeight = 0` | Anti-bots | stealth `window.outerdimensions` module | Active |
| CDP VM context in stack traces | Advanced anti-bots | `worldName` parameter to create named world | Advanced |
| Per-behavioral model (Cloudflare/DataDome) | Commercial anti-bots | Human-like behavior simulation | Active; hard to bypass |
| JA3/JA4 TLS fingerprint | Server-side anti-bots | Use real TLS stack (not trivial) | Active |

---

## Sources

1. [Castle Blog - CDP signal stopped working (May 2025)](https://blog.castle.io/why-a-classic-cdp-bot-detection-signal-suddenly-stopped-working-and-nobody-noticed/) — V8 change that broke Runtime.enable detection
2. [Castle Blog - From Puppeteer stealth to Nodriver](https://blog.castle.io/from-puppeteer-stealth-to-nodriver-how-anti-detect-frameworks-evolved-to-evade-bot-detection/) — Full evolution of anti-detect frameworks
3. [Castle Blog - How to detect Playwright bots](https://blog.castle.io/how-to-detect-headless-chrome-bots-instrumented-with-playwright/) — Playwright-specific detection signals
4. [Castle Blog - How to detect Puppeteer bots](https://blog.castle.io/how-to-detect-headless-chrome-bots-instrumented-with-puppeteer-2/) — Puppeteer-specific detection signals
5. [Castle Blog - CDP script injection detection](https://blog.castle.io/how-to-detect-scripts-injected-via-cdp-in-chrome-2/) — Detecting addScriptToEvaluateOnNewDocument injections
6. [Castle Blog - Bot detection 2025](https://blog.castle.io/bot-detection-101-how-to-detect-bots-in-2025-2/) — Comprehensive 2025 bot detection landscape
7. [Rebrowser - Runtime.enable fix](https://rebrowser.net/blog/how-to-fix-runtime-enable-cdp-detection-of-puppeteer-playwright-and-other-automation-libraries) — Detailed Runtime.enable detection and evasion
8. [Rebrowser - Isolated context main world](https://rebrowser.net/blog/how-to-access-main-context-objects-from-isolated-context-in-puppeteer-and-playwright) — Isolated vs main world execution
9. [rebrowser-bot-detector GitHub](https://github.com/rebrowser/rebrowser-bot-detector) — Open source detection test suite
10. [puppeteer-extra GitHub evasions](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth/evasions) — All stealth evasion modules
11. [playwright-stealth PyPI](https://pypi.org/project/playwright-stealth/) — Python Playwright stealth package
12. [Chrome DevTools Protocol - Page domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/) — Official CDP documentation for addScriptToEvaluateOnNewDocument
13. [Scrapfly - What is CreepJS](https://scrapfly.io/blog/posts/browser-fingerprinting-with-creepjs) — creepjs detection signals
14. [FingerprintJS BotD GitHub](https://github.com/fingerprintjs/BotD) — BotD detection capabilities
15. [The Web Scraping Club - Playwright stealth CDP](https://substack.thewebscraping.club/p/playwright-stealth-cdp) — Runtime.enable detection overview
16. [DataDome - New Headless Chrome CDP signal](https://datadome.co/threat-research/how-new-headless-chrome-the-cdp-signal-are-impacting-bot-detection/) — DataDome's CDP detection research
17. [Cloudflare - Per-customer bot defenses](https://blog.cloudflare.com/per-customer-bot-defenses/) — Behavioral model detection
18. [Castle Blog - Browser extension detection 2026](https://blog.castle.io/detecting-browser-extensions-for-bot-detection-lessons-from-linkedin-and-castle/) — Extension-based detection

---

## Confidence Assessment

**High confidence (3+ sources):**
- `navigator.webdriver` detection and bypass via `Object.defineProperty`
- `Runtime.enable` CDP detection mechanism and its May 2025 breakage
- `sourceURL` leak from `page.evaluate()` in Puppeteer/Playwright
- All 17 puppeteer-extra-plugin-stealth modules and what they patch
- `Page.addScriptToEvaluateOnNewDocument` timing advantage over `page.evaluate()`
- Playwright globals (`__pwInitScripts`, `__playwright__binding__`)
- Viewport size defaults as detection signals
- creepjs prototype lie detection and trust score system

**Medium confidence (1–2 sources):**
- HeapSnapshot detection (theoretical; not widely deployed)
- WebSocket connection pattern detection (server-side; limited JS visibility)
- Per-customer behavioral models (Cloudflare description is high-level)
- JA3/TLS fingerprinting details

**Low confidence / Unverified:**
- Exact V8 `getErrorProperty()` function name — reported by Castle but not independently verified
- Specific DataDome implementation details (403 on their blog)
- Exact PerimeterX/HUMAN JavaScript probe list

## Information Gaps

- DataDome's full detection script was not accessible (403 error)
- Akamai's complete sensor data collection list is proprietary
- Exact implementation of Cloudflare's per-customer behavioral models
- Whether the May 2025 V8 change affects ALL versions of Chrome or only specific builds
- nodriver/zendriver's specific internal CDP command avoidance strategy (documentation is vague; source code inspection would be needed)
