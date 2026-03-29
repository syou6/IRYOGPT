# Research: zendriver — Comprehensive API & Stealth Analysis

> Researched: 2026-03-29
> Sources: PyPI, GitHub (cdpdriver/zendriver), zendriver.dev, deepwiki, benchmark studies

---

## Executive Summary

Zendriver (v0.15.3, released March 12 2026) is an async-first Python browser automation library that
controls Chrome via the Chrome DevTools Protocol (CDP) directly — with NO Selenium/WebDriver layer.
Its primary stealth advantage is architectural: by not using WebDriver at all, `navigator.webdriver`
is never set to `true`. However, zendriver does NOT include many of the JavaScript-level stealth
patches that puppeteer-extra-plugin-stealth provides (canvas fingerprint, font fingerprint, Chrome
runtime, etc.). Significant additional hardening is required for serious anti-bot bypass work.

---

## 1. Built-In Stealth Features

### What zendriver DOES provide:

| Feature | Status | How |
|---|---|---|
| `navigator.webdriver = undefined` | YES | CDP-native; no WebDriver protocol means the property is absent |
| No automation extension | YES | Chrome launched without `--enable-automation` |
| Fresh browser profile per run | YES | Default; temp dir cleaned on exit |
| WebRTC IP leak prevention | YES (opt-in) | `disable_webrtc=True` → `--webrtc-ip-handling-policy=disable_non_proxied_udp` |
| WebGL fingerprint disabling | YES (opt-in) | `disable_webgl=True` → `--disable-webgl --disable-webgl2` |
| No CDP injection artifacts | YES | Architectural; no driver JS injected |
| Human-like mouse dispatch | PARTIAL | `Input.dispatchMouseEvent` via CDP — native-level events, but NOT Bezier curves |
| Language/locale spoofing | YES | `lang=` param sets `--lang` and Accept-Language |
| User-agent override | YES | `set_user_agent()` or pass at start |

### What zendriver does NOT provide by default:

| Feature | Status | Notes |
|---|---|---|
| `--disable-blink-features=AutomationControlled` | NOT included in defaults | Must add manually via `browser_args` |
| Canvas fingerprint spoofing | NO | No built-in JS injection; Issue #108 confirms this gap |
| Font fingerprint spoofing | NO | Same gap |
| `Page.addScriptToEvaluateOnNewDocument` wrapper | NO | Must call raw CDP manually |
| Chrome runtime API spoofing | NO | `window.chrome` not patched |
| Permission API spoofing | NO | |
| Plugin/mimeType spoofing | NO | |
| Notification API spoofing | NO | |
| Headless detection patches | NO | Headless mode (`--headless=new`) is still detectable via standard checks |
| TLS/JA3 fingerprint randomization | NO | Uses system Chrome's TLS stack |
| Bezier-curve mouse movement | NO | Linear interpolation only (steps param) |
| Proxy authentication | NOT SUPPORTED | Confirmed open issue #208 |

### Default Chrome arguments (from config.py):
```
--remote-allow-origins=*
--no-first-run
--no-service-autorun
--no-default-browser-check
--homepage=about:blank
--no-pings
--password-store=basic
--disable-infobars
--disable-breakpad
--disable-component-update
--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding
--disable-background-networking
--disable-dev-shm-usage
--disable-features=IsolateOrigins,DisableLoadExtensionCommandLineSwitch,site-per-process
--disable-session-crashed-bubble
--disable-search-engine-choice-screen
```

Note: `--disable-blink-features=AutomationControlled` is NOT in this list.

---

## 2. Correct API as of 2026 (v0.15.3)

### Starting the Browser

```python
import zendriver as zd

# Simple start
browser = await zd.start()

# With options
browser = await zd.start(
    headless=False,
    user_data_dir="/path/to/profile",   # persistent profile
    browser_executable_path="/usr/bin/google-chrome",
    browser_args=["--window-size=1920,1080", "--disable-blink-features=AutomationControlled"],
    sandbox=True,
    lang="ja-JP",
    disable_webrtc=True,   # added in v0.15.0
    disable_webgl=True,    # added in v0.15.0
)

# Via Config object (equivalent)
from zendriver import Config
config = Config(
    headless=False,
    browser_args=["--disable-blink-features=AutomationControlled"],
)
browser = await zd.start(config)

# Context manager (auto-cleanup)
async with await zd.start() as browser:
    page = await browser.get("https://example.com")
```

There is no `Browser.create()` static method — use `zd.start()`.

### Page Navigation

```python
page = await browser.get("https://example.com")
page2 = await browser.get("https://example.com", new_tab=True)
page3 = await browser.get("https://example.com", new_window=True)

# Access main tab directly
tab = browser.main_tab
```

### JavaScript Injection on Every Page Load — `Page.addScriptToEvaluateOnNewDocument`

Zendriver has NO wrapper for this. Use raw CDP send:

```python
await tab.send(
    cdp.page.add_script_to_evaluate_on_new_document(
        source="""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """
    )
)
```

IMPORTANT: This must be called AFTER navigating or setting up the tab, and applies only to
subsequently-loaded documents. Due to nodriver issue #1835, there are confirmed bugs where
this does not work reliably for all newly opened tabs — only the tab it was called on.

### Mouse Movement API

```python
# Tab-level mouse move (coordinates, steps for interpolation)
await tab.mouse_move(x=500, y=300, steps=10, flash=False)

# Tab-level mouse click
await tab.mouse_click(
    x=500,
    y=300,
    button="left",       # "left", "right", "middle"
    buttons=1,
    modifiers=0,         # Alt=1, Ctrl=2, Meta=4, Shift=8
    flash=False,
)

# Element-level click (coordinates computed automatically)
elem = await tab.find("Submit")
await elem.click()

# Element-level mouse_drag
await elem.mouse_drag(destination_element)
```

Note: `mouse_move` uses linear step interpolation:
`pathway = [(step_size_x * i, step_size_y * i) for i in range(steps + 1)]`
This is NOT Bezier-curve based. It dispatches `mouseMoved` CDP events at each step.

### Cookie API

```python
# Access via browser.cookies (CookieJar)
all_cookies = await browser.cookies.get_all()

# Save to disk
await browser.cookies.save(filepath="/path/to/cookies.json")

# Load from disk
await browser.cookies.load(filepath="/path/to/cookies.json")

# Batch set
await browser.cookies.set_all(cookie_list)

# Clear all
await browser.cookies.clear()
```

### Viewport / Window Size

There is NO direct `page.set_viewport()` call. Two approaches:

```python
# 1. Via browser_args at launch (recommended)
browser = await zd.start(
    browser_args=["--window-size=1920,1080"]
)

# 2. Via tab methods after launch
await tab.set_window_size(left=0, top=0, width=1920, height=1080)

# or
await tab.set_window_state(left=0, top=0, width=1920, height=1080, state="normal")
# state options: "normal", "fullscreen", "maximized", "minimized"
```

Note: `set_window_size` controls the OS window, not the viewport/content area. For precise
viewport control, use `Emulation.setDeviceMetricsOverride` via raw CDP:

```python
await tab.send(
    cdp.emulation.set_device_metrics_override(
        width=1920, height=1080, device_scale_factor=1, mobile=False
    )
)
```

### Page.evaluate Syntax

```python
# Basic evaluation
result = await tab.evaluate("document.title")

# With promise support
result = await tab.evaluate(
    "fetch('https://api.example.com').then(r => r.json())",
    await_promise=True,
    return_by_value=True,
)

# Full signature (from source):
async def evaluate(
    self,
    expression: str,
    await_promise: bool = False,
    return_by_value: bool = True,
) -> Any | None | Tuple[cdp.runtime.RemoteObject, cdp.runtime.ExceptionDetails | None]
```

Note: Prior to v0.14.2 (Sep 2025), `evaluate` returned `None` for falsy values (bug).
Fixed in v0.14.2.

### Sending Raw CDP Commands

```python
import zendriver.cdp as cdp

# Any CDP domain is accessible
await tab.send(cdp.network.enable())
await tab.send(cdp.page.add_script_to_evaluate_on_new_document(source="..."))
await tab.send(cdp.emulation.set_user_agent_override(user_agent="..."))

# Add event handler
def on_request(event: cdp.network.RequestWillBeSent):
    print(event.request.url)

tab.add_handler(cdp.network.RequestWillBeSent, on_request)
# Always remove handlers when done:
tab.remove_handlers(cdp.network.RequestWillBeSent)
```

### Network Interception

```python
# Wait for specific request/response
request = await tab.expect_request("*api/endpoint*")
response = await tab.expect_response("*api/endpoint*")

# Active interception (added v0.12.0)
async def intercept_handler(request, response):
    return modified_response

await tab.intercept(pattern, intercept_handler)
```

### User Agent Override

```python
# At launch (preferred)
browser = await zd.start(user_agent="Mozilla/5.0 ...")

# Post-launch
await tab.set_user_agent(
    user_agent="Mozilla/5.0 ...",
    accept_language="ja-JP,ja;q=0.9",
    platform="Win32",
)
```

### Local Storage

```python
items = await tab.get_local_storage()
await tab.set_local_storage({"key": "value"})
```

---

## 3. Known Limitations and Bugs

### Confirmed Bugs (from GitHub issues tracker)

| Issue | Status |
|---|---|
| `evaluate()` returns `None` for falsy values | Fixed in v0.14.2 |
| `add_script_to_evaluate_on_new_document` unreliable on new tabs | OPEN (inherited from nodriver #1835) |
| `send_keys` fails on 2FA input fields (bot-detection interference) | OPEN #200 |
| Memory leak in simple scripts | OPEN #198 |
| "Too many open files" resource exhaustion | OPEN #212 |
| iFrame `contentDocument` access failures | OPEN #199, #239 |
| Commands hang indefinitely | OPEN #240 |
| Browser fails to start as Windows Administrator | OPEN #247 |
| Extensions broken with Chrome 139+ | OPEN #229 |
| Race condition in `Tab.query_selector` / `query_selector_all` | Fixed v0.15.2 |
| JSON serialization in `evaluate` calls | Fixed v0.14.1 |

### Architectural Limitations

- Python 3.10+ ONLY (no 3.9 support)
- Alpha status (v0.15.x, AGPL-3.0 licensed)
- No proxy authentication support (#208)
- No Selenium-style `ExpectedConditions` (#236)
- No permanent/persistent network monitor (#223)
- Linear mouse interpolation only (no Bezier curves)
- No Widevine DRM support (#225)
- No built-in fingerprint spoofing
- `Page.addScriptToEvaluateOnNewDocument` not reliably cross-tab

---

## 4. Additional Stealth Needed Beyond Zendriver

Zendriver's CDP architecture removes the WebDriver layer, but modern anti-bot systems
(Cloudflare, DataDome, Kasada, Imperva, PerimeterX) check far more than `navigator.webdriver`.

### What you MUST add manually:

#### A. `--disable-blink-features=AutomationControlled` flag
Zendriver does NOT add this by default. Without it, `window.chrome.cdc_*` properties
may still be detectable.

```python
browser_args=["--disable-blink-features=AutomationControlled"]
```

#### B. Canvas Fingerprint Spoofing
Zendriver has no built-in canvas noise injection (Issue #108). Inject via CDP:

```python
await tab.send(cdp.page.add_script_to_evaluate_on_new_document(source="""
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        const ctx = origGetContext.call(this, type, ...args);
        if (type === '2d') {
            const origFillText = ctx.fillText.bind(ctx);
            ctx.fillText = function(...fargs) {
                origFillText(...fargs);
                // add micro-noise to pixel data
            };
        }
        return ctx;
    };
"""))
```

#### C. WebGL Vendor/Renderer Spoofing
`disable_webgl=True` disables WebGL entirely (detectable); spoofing is more stealthy:

```python
await tab.send(cdp.page.add_script_to_evaluate_on_new_document(source="""
    const getParam = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return 'Intel Inc.';      // UNMASKED_VENDOR_WEBGL
        if (param === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
        return getParam.call(this, param);
    };
"""))
```

#### D. `window.chrome` Runtime Object
Headless Chrome lacks `window.chrome.runtime`; inject:

```python
await tab.send(cdp.page.add_script_to_evaluate_on_new_document(source="""
    window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
    };
"""))
```

#### E. Navigator.permissions Spoofing
Automation contexts return different results for Notification permission:

```python
await tab.send(cdp.page.add_script_to_evaluate_on_new_document(source="""
    const origQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (params) =>
        params.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : origQuery(params);
"""))
```

#### F. Navigator.plugins Spoofing
Headless browsers have empty plugins array:

```python
await tab.send(cdp.page.add_script_to_evaluate_on_new_document(source="""
    Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
    });
    Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
    });
"""))
```

#### G. Human-Like Mouse Movement
Zendriver's built-in `mouse_move(steps=10)` uses linear interpolation only.
For real human-like movement, use Bezier curves (WindMouse algorithm):

```python
# pip install human-mouse
# or implement Bezier curve mouse path manually
```

#### H. Headless Detection
`--headless=new` is still detectable via:
- `navigator.userAgent` contains "Headless"
- Missing `window.outerWidth`/`outerHeight`
- Screen properties differ

Add to browser_args: `--window-size=1920,1080` and override UA at launch.

---

## 5. Comparison with Other Solutions

### Detection Rate Benchmarks

| Tool | Bypass Rate | Notes |
|---|---|---|
| Camoufox (headless) | 83.3% | Firefox-based; highest fingerprint accuracy |
| NoDriver (Chrome) | 83.3% | CDP-based; same architecture as zendriver |
| zendriver (Chrome) | ~75% | Fork of nodriver; slightly higher in some tests |
| Playwright Firefox | 83.3% | No stealth plugin; Firefox baseline is better |
| Patchright | 66.7% | Patched Playwright Chrome |
| Playwright Chrome headless | ~25% | Stock; highly detectable |
| Selenium | ~25% | WebDriver-based; most detectable |

Source: github.com/techinz/browsers-benchmark (2025 data)

### Feature Comparison

| Feature | zendriver | patchright | puppeteer-extra-stealth | playwright-stealth |
|---|---|---|---|---|
| WebDriver flag removal | YES (arch.) | YES (patched) | YES (JS) | YES (JS) |
| CDP-native (no WebDriver) | YES | NO | NO | NO |
| Canvas spoofing | NO | YES | YES | YES |
| WebGL spoofing | partial (disable) | YES | YES | YES |
| navigator.plugins | NO | YES | YES | partial |
| Chrome runtime | NO | YES | YES | partial |
| Permissions API | NO | YES | YES | partial |
| Bezier mouse movement | NO | NO | NO | NO |
| Async Python API | YES | NO (JS) | NO (JS) | NO (JS) |
| Proxy auth | NO | YES | YES | YES |
| Multi-browser | Chrome only | Chrome only | Chrome only | Chromium only |
| Language | Python | JavaScript | JavaScript | JavaScript |
| Active maintenance | YES | YES | Declining | Minimal |
| License | AGPL-3.0 | MIT | MIT | MIT |

### Key Distinctions

**puppeteer-extra-plugin-stealth**: The gold standard for JS-level patches. 17 individual
evasion modules covering canvas, webgl, chrome runtime, navigator properties, iframe,
permissions, hairline feature, mime types, source url, user agent, vendor, etc.
Written in JavaScript/Node.js.

**playwright-stealth** (Python, pip install playwright-stealth): Python port of puppeteer-stealth.
Provides similar JS patches but quality is lower than the original JS version. Works with
sync and async Playwright.

**patchright**: Direct fork of Playwright Chromium with binary-level patches. Fixes CDP
isolation issues that allow CDP detection. More reliable than playwright-stealth plugin
but still Playwright-based (slower than zendriver).

**zendriver**: Best for Python + async. Architectural advantage means it passes many
checks automatically, but lacks JS-level fingerprint patches.

**Camoufox**: Firefox-based, highest overall bypass rate, but Python library is a wrapper
around a custom Firefox build.

### Recommendation by Use Case

- **Bypass Cloudflare/DataDome without fingerprinting**: zendriver (add `--disable-blink-features=AutomationControlled`)
- **Maximum stealth with Python**: zendriver + manual CDP JS injections (canvas, webgl, chrome runtime)
- **JavaScript ecosystem**: puppeteer-extra + stealth plugin
- **Firefox stealth**: Camoufox
- **Playwright-compatible API**: patchright

---

## Sources

1. [zendriver PyPI](https://pypi.org/project/zendriver/) — v0.15.3, March 12 2026
2. [cdpdriver/zendriver GitHub](https://github.com/cdpdriver/zendriver) — Main repo, README, issue tracker
3. [zendriver.dev documentation](https://zendriver.dev/) — Official docs
4. [zendriver.dev quickstart](https://zendriver.dev/quickstart/) — API examples
5. [zendriver CDP tutorial](https://zendriver.dev/tutorials/cdp/) — Raw CDP usage
6. [zendriver release notes](https://zendriver.dev/release-notes/) — Full changelog
7. [deepwiki cdpdriver/zendriver](https://deepwiki.com/cdpdriver/zendriver) — AI-generated wiki with source analysis
8. [deepwiki stephanlensky/zendriver](https://deepwiki.com/stephanlensky/zendriver) — API details
9. [GitHub issue #108: Canvas fingerprints](https://github.com/cdpdriver/zendriver/issues/108) — Confirmed gap
10. [ultrafunkamsterdam/nodriver](https://github.com/ultrafunkamsterdam/nodriver) — Upstream project
11. [browsers-benchmark](https://github.com/techinz/browsers-benchmark) — Detection bypass rates
12. [castle.io: Puppeteer stealth to Nodriver evolution](https://blog.castle.io/from-puppeteer-stealth-to-nodriver-how-anti-detect-frameworks-evolved-to-evade-bot-detection/)
13. [roundproxies: Patchright alternatives 2026](https://roundproxies.com/blog/best-patchright-alternatives/)

---

## Confidence Assessment

- **High confidence**: API signatures (mouse_move, evaluate, cookies, window_size), Chrome args list,
  what IS and IS NOT in default args, CDP send pattern, known bugs list
- **Medium confidence**: Exact bypass rates (benchmarks from 2025 data, may have shifted),
  `add_script_to_evaluate_on_new_document` cross-tab reliability
- **Low confidence / Unverified**: Whether v0.15.3 added any stealth improvements beyond v0.15.0

## Information Gaps

- Source code of `config.py` was read via AI extraction — could not directly confirm every
  argument byte-for-byte (strongly corroborated by multiple sources)
- Mouse movement interpolation math: confirmed linear (not Bezier) from source, but exact
  implementation of step coordinates was described by DeepWiki, not directly verified in raw source
- `Page.addScriptToEvaluateOnNewDocument` reliability: the bug is confirmed from nodriver upstream
  but unclear if zendriver has since patched it
