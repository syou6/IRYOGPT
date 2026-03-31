# Research: Patchright, rebrowser-patches, Botright Deep Dive

Date: 2026-03-31

---

## Executive Summary

Patchright is a fully functional Python (and Node.js/.NET) library that patches Playwright at the binary/protocol level to evade bot detection. It exists as `patchright` on PyPI and is a true drop-in replacement for `playwright`. Against Akamai specifically, available benchmarks show ~67% bypass rate in headless mode, while non-headless (headed) mode fares much better. rebrowser-patches provides a competing approach (also Python-compatible) with configurable Runtime.enable fix strategies and notably supports Firefox/WebKit unlike Patchright. Botright is built on Playwright for CAPTCHA solving and will eventually use Patchright as its engine, but they are NOT currently interoperable as a combined package.

---

## 1. Patchright Python — Does It Exist? Installation & Usage

### Yes, patchright-python is a real, maintained package.

PyPI package name: `patchright`
Latest version: **1.58.2** (released March 7, 2026)
Python versions supported: 3.9 through 3.13
GitHub repo: https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-python

### Installation

```bash
pip install patchright
patchright install chromium
# Or install real Chrome:
patchright install chrome
```

### Synchronous API

```python
from patchright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="chrome",       # Use real Chrome, not Chromium
        headless=False,         # Headless is detectable
        no_viewport=True,       # Prevents viewport fingerprinting
    )
    page = browser.new_page()
    page.goto("https://example.com")
    page.screenshot(path="screenshot.png")
    browser.close()
```

### Asynchronous API

```python
import asyncio
from patchright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            channel="chrome",
            headless=False,
            no_viewport=True,
        )
        page = await browser.new_page()
        await page.goto("https://example.com")
        await page.screenshot(path="screenshot.png")
        await browser.close()

asyncio.run(main())
```

### Recommended "Maximum Stealth" Configuration

```python
from patchright.sync_api import sync_playwright

with sync_playwright() as p:
    # launch_persistent_context is recommended over launch()
    context = p.chromium.launch_persistent_context(
        user_data_dir="/tmp/patchright_profile",
        channel="chrome",
        headless=False,
        no_viewport=True,
        # DO NOT set custom user_agent or headers
    )
    page = context.new_page()
    page.goto("https://target.com")
```

### Proxy Integration

Since Patchright is a drop-in replacement for Playwright, proxy configuration is identical to Playwright:

```python
from patchright.sync_api import sync_playwright

with sync_playwright() as p:
    # With launch()
    browser = p.chromium.launch(
        channel="chrome",
        proxy={
            "server": "http://residential-proxy.example.com:8080",
            "username": "user",
            "password": "pass",
        }
    )
    context = browser.new_context()
    page = context.new_page()

    # OR with launch_persistent_context (recommended):
    context = p.chromium.launch_persistent_context(
        user_data_dir="/tmp/profile",
        channel="chrome",
        headless=False,
        no_viewport=True,
        proxy={
            "server": "socks5://residential-proxy.example.com:1080",
            "username": "user",
            "password": "pass",
        }
    )
```

Both HTTP and SOCKS5 proxies are supported (same as standard Playwright).

### The isolated_context Parameter (Patchright-specific)

The only API addition over standard Playwright is the `isolated_context` parameter on evaluate methods:

```python
# Default: isolated context (stealth, recommended)
result = page.evaluate("() => document.title", isolated_context=True)

# Main context: when you need to access window globals
result = page.evaluate("() => window.myGlobal", isolated_context=False)
```

---

## 2. How Patchright Works — Technical Patches

Patchright applies **22 patches (~5,856 lines)** via AST manipulation before compilation. Key mechanisms:

1. **Runtime.enable elimination**: Uses `Page.createIsolatedWorld` instead of the detectable `Runtime.enable` CDP command
2. **Network-layer script injection**: Intercepts HTML responses, modifies CSP headers, injects stealth `<script>` tags that self-delete after execution
3. **Command-line sanitization**: Removes `--enable-automation`, `--disable-popup-blocking`; adds `--disable-blink-features=AutomationControlled`
4. **Console domain disabled**: Entire Console CDP domain is turned off to prevent detection leaks

---

## 3. Patchright vs Akamai — Results and User Reports

### Official Claims (from project docs)
Patchright claims to bypass: Cloudflare, Akamai, Kasada, DataDome, Shape/F5, Fingerprint.com, Bet365, CreepJS, Sannysoft, Incolumitas.

### Benchmark Results (techinz/browsers-benchmark, 2025)

| Tool | Overall Bypass Rate | Notes |
|------|---------------------|-------|
| Camoufox (headless) | 83.3% | Best overall |
| NoDriver + Chrome | 83.3% | Tied best |
| Playwright Firefox | 83.3% | Tied best |
| **Patchright** | **66.7%** | Good but not perfect |
| Playwright (headless) | 33.3% | Poor |
| Standard Playwright | 16.7% | Worst |

### CreepJS Detection Score
- Standard Playwright headless: 100% detected as bot
- Patchright: ~67% headless detection reduction (NOT zero)
- Camoufox: 0% detected (best)

### Key Finding: Patchright is NOT undetectable in headless mode
Even with all patches, sophisticated systems (Cloudflare higher tiers, DataDome, some Akamai configs) can still detect Patchright in headless mode. Headed mode performs significantly better.

### Akamai-Specific Notes
- No dedicated Akamai test results were found in any public benchmark
- Akamai Bot Manager relies heavily on TLS fingerprinting (JA3/JA4) in addition to CDP detection
- Patchright addresses CDP-level detection but does NOT patch TLS fingerprinting
- For Akamai, combining Patchright with `curl-cffi` for initial TLS handshake, or using residential proxies with proper TLS signatures, is recommended
- Zero GitHub issues in the Patchright repo specifically about Akamai (searched — no matches found)

### Real-World Usage Reports
- Scrapling (uses Patchright internally) succeeded on Reddit in all modes including headless, where stock Chromium fails
- Instagram: Patchright-based tools still hit login redirects without cookies (not purely detection-based)
- The project has not been reported as "detected and blocked" in any 2026 GitHub issue or public discussion found

---

## 4. Patchright Limitations — What It DOESN'T Fix

| Limitation | Impact |
|------------|--------|
| Console API completely disabled | Cannot use `console.log()`, `console.error()` etc — PageError/ConsoleMessage events broken |
| Chromium-only | Firefox and WebKit are NOT patched — no cross-browser stealth |
| WebSocket routing broken | 6 failing tests; requires external MITM proxy for stealth WebSocket routing |
| InitScript timing | Script tags load slower than normal InitScripts — timing-based detection possible |
| about:blank incompatibility | InitScripts cannot affect about:blank, data URIs — must navigate to real URLs |
| Chrome extensions | Extensions are dysfunctional |
| Headless detection | Still ~67% detectable in headless mode (CreepJS) |
| TLS fingerprinting | Does NOT fix JA3/JA4 fingerprint — Akamai/Cloudflare can detect via TLS |
| Non-atomic selector engines | NodeJS and .NET only — Python tests pass but behavior differs |

---

## 5. rebrowser-patches — Python Support

### Yes, rebrowser-patches works with Python.

PyPI package: `rebrowser-playwright`
Latest version: **1.52.0** (May 9, 2025) — note: significantly older than patchright's 1.58.2

Installation:
```bash
pip install rebrowser-playwright
# Note: import namespace stays as "playwright" (not "rebrowser_playwright")
```

Usage (imports are IDENTICAL to standard playwright):
```python
from playwright.sync_api import sync_playwright  # unchanged import!

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com")
    browser.close()
```

### Key Difference from Patchright

rebrowser-playwright keeps the `playwright` import namespace — you change only the package you install, NOT your import statements. Patchright requires changing `playwright` → `patchright` in all imports.

### Three Fix Strategies (configurable via environment variables)
1. `addBinding` (default): Creates bindings in the main world to get context IDs without Runtime.enable
2. Isolated context mode: Executes code in a separate world
3. Enable/Disable approach: Quickly disables Runtime after enabling it

### rebrowser-playwright vs Patchright Comparison

| Criterion | Patchright | rebrowser-playwright |
|-----------|-----------|---------------------|
| Latest version | 1.58.2 (Mar 2026) | 1.52.0 (May 2025) |
| Browser support | Chromium ONLY | Chromium, Firefox, WebKit |
| Import change required | Yes (playwright → patchright) | No (same playwright imports) |
| Configurable strategies | No | Yes (3 modes via env vars) |
| Patch approach | 22 binary patches (~5,856 lines) | Runtime.enable fix + patches |
| Node.js support | Yes | Yes (via rebrowser-puppeteer/playwright) |
| Python support | Yes | Yes |
| Maintenance activity | Active (2026) | Less active (last release May 2025) |

---

## 6. Patchright vs Zendriver — Head-to-Head

### Architecture Comparison

| Criterion | Patchright | Zendriver |
|-----------|-----------|-----------|
| Based on | Playwright (patched) | NoDriver fork (CDP direct) |
| API style | Full Playwright API | Minimal async CDP API |
| Python | Yes | Yes |
| Browser | Chromium/Chrome only | Chrome only (via CDP) |
| WebDriver used | No (patched out) | No (never used WebDriver) |
| Stealth approach | Patch existing framework | Avoid problematic CDP domains entirely |
| Learning curve | Low (Playwright devs) | High (different API) |

### Benchmark Results (2025 tests)

Zendriver overall: **75% bypass rate** (Cloudflare + Akamai + CloudFront out of 4 tests)
Patchright overall: **66.7% bypass rate**

In one benchmark, Zendriver beat Patchright 3/4 vs ~2.67/4.

However results vary by benchmark methodology. The techinz/browsers-benchmark shows:
- Camoufox headless: 83.3%
- NoDriver-Chrome: 83.3%
- Patchright: 66.7%
- Zendriver headless: 50% (in this specific test)

### When to Choose Which

Choose **Patchright** if:
- You already have Playwright code (near-zero migration cost)
- You need the full Playwright API (selectors, page objects, network interception)
- You need multi-language support (.NET, Node.js, Python)
- You want the most actively maintained option

Choose **Zendriver** if:
- Starting fresh with no Playwright code
- You want "driverless" approach (no WebDriver at all)
- Performance/speed is priority (lighter weight)
- Specific sites where zendriver bypasses but patchright doesn't

---

## 7. Migration from Zendriver to Patchright

Zendriver and Patchright have fundamentally different APIs — migration is NOT a simple find-and-replace. This is a full rewrite of browser interaction code.

### Zendriver Pattern (typical)
```python
import zendriver as uc

async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")
    element = await page.find("button")
    await element.click()
    await browser.stop()
```

### Equivalent in Patchright
```python
from patchright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir="/tmp/profile",
            channel="chrome",
            headless=False,
            no_viewport=True,
        )
        page = await context.new_page()
        await page.goto("https://example.com")
        await page.click("button")
        await context.close()
```

### Key API Mapping

| Zendriver | Patchright |
|-----------|-----------|
| `uc.start()` | `p.chromium.launch_persistent_context(...)` |
| `browser.get(url)` | `page.goto(url)` |
| `page.find(selector)` | `page.locator(selector)` or `page.query_selector()` |
| `element.click()` | `page.click(selector)` or `locator.click()` |
| `page.get_content()` | `page.content()` |
| `page.evaluate(js)` | `page.evaluate(js, isolated_context=True)` |

---

## 8. Botright — CAPTCHA Solving with Playwright

### Overview
Botright (https://github.com/Vinyzu/Botright) — same author as Patchright (Vinyzu)

Installation:
```bash
pip install botright
playwright install
```

### CAPTCHA Success Rates
| CAPTCHA Type | Success Rate |
|-------------|-------------|
| reCAPTCHA v2 | 50-80% (reCognizer) |
| hCaptcha | Up to 90% (outdated solver) |
| GeeTest v3 slider | 100% |
| GeeTest v3 icon | 60-70% |
| GeeTest v4 | Supported |
| reCAPTCHA v3 Intelligent | 100% |
| reCAPTCHA v3 Space | 0% (unsupported) |

### Basic Usage
```python
import asyncio
import botright

async def main():
    botright_client = await botright.Botright()
    browser = await botright_client.new_browser()
    page = await browser.new_page()

    await page.goto("https://site-with-captcha.com")
    # CAPTCHA solving happens automatically

    await botright_client.close()

asyncio.run(main())
```

---

## 9. Can Patchright + Botright Be Combined?

### Current Status: NOT DIRECTLY COMBINABLE (as of early 2026)

From the official GitHub discussion (#34, Jan 2025):

Developer Vinyzu stated:
> "Patchright is more up to date, so you should right now probably use Patchright."
> "The original end goal for Patchright was to use it in Botright."

Botright currently uses standard Playwright as its engine. Patchright integration is planned but NOT yet implemented. You cannot simply swap Botright's Playwright with Patchright by changing imports — Botright initializes its own browser context internally.

### Workaround: Manual Combined Approach

If you need both stealth AND CAPTCHA solving, the current practical approach is:
1. Use Patchright for navigation and stealth
2. Call external CAPTCHA solving services (2captcha, CapSolver, etc.) manually
3. Or use Botright alone and accept its current Playwright base (less stealth than Patchright)

---

## 10. Patchright Being Detected in 2026 — Reports

### What Was Found
- No GitHub issues in the patchright repo about being detected in 2026 (confirmed by searching discussions for "akamai" — zero results)
- No public Reddit threads specifically documenting "Patchright gets detected by X in 2026"
- Scrapling (which uses Patchright) reports 80-100% success on major sites in 2026 benchmarks
- One notable finding: in CreepJS headless testing, Patchright still scores ~67% bot detection (not zero), meaning SOME detection systems can still identify it in headless mode

### Practical Status as of March 2026
Patchright appears to remain effective for its stated use cases. The main risks are:
1. Headless mode (significantly more detectable than headed mode)
2. Sites using TLS fingerprinting as primary detection (Akamai's JA3/JA4 approach)
3. Behavioral analysis catching non-human interaction patterns (mouse movements, timing)

---

## Sources

1. [patchright PyPI page](https://pypi.org/project/patchright/) — version 1.58.2, installation, code examples (accessed 2026-03-31)
2. [patchright-python GitHub](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-python) — README, API docs (accessed 2026-03-31)
3. [patchright GitHub](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright) — main repo, limitations, architecture (accessed 2026-03-31)
4. [patchright Bug Tracker Issue #30](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/issues/30) — known bugs and limitations (accessed 2026-03-31)
5. [Botright vs Patchright Discussion #34](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright/discussions/34) — developer comment on integration plans (accessed 2026-03-31)
6. [rebrowser-playwright PyPI](https://pypi.org/project/rebrowser-playwright/) — v1.52.0, installation, Python support (accessed 2026-03-31)
7. [rebrowser-patches GitHub](https://github.com/rebrowser/rebrowser-patches) — architecture, Python support, fix strategies (accessed 2026-03-31)
8. [Botright GitHub](https://github.com/Vinyzu/Botright) — CAPTCHA rates, code examples, status (accessed 2026-03-31)
9. [anti-detect-browser-tools-tech-comparison/patchright.md](https://github.com/pim97/anti-detect-browser-tools-tech-comparison/blob/master/patchright.md) — technical analysis, 22 patches, detection bypasses (accessed 2026-03-31)
10. [browsers-benchmark GitHub](https://github.com/techinz/browsers-benchmark) — benchmark methodology, tool comparison table (accessed 2026-03-31)
11. [patchright-python DeepWiki User Guide](https://deepwiki.com/Kaliiiiiiiiii-Vinyzu/patchright-python/4-user-guide) — API differences, code examples, recommended settings (accessed 2026-03-31)
12. [Kahtaf browser automation comparison](https://kahtaf.com/blog/browser-automation-compared/) — Scrapling/Patchright real-world test results (accessed 2026-03-31)
13. [Best Patchright alternatives roundproxies](https://roundproxies.com/blog/best-patchright-alternatives/) — detection score table, limitations analysis (accessed 2026-03-31)
14. [Firecrawl Issue #1281 — Migrate to Patchright](https://github.com/firecrawl/firecrawl/issues/1281) — real migration report, "change imports only" (accessed 2026-03-31)
15. [roundproxies Patchright guide](https://roundproxies.com/blog/patchright/) — proxy integration approach, recommended config (accessed 2026-03-31)

---

## Confidence Assessment

- **High confidence**: Patchright-python exists (PyPI v1.58.2), installation process, API code examples, known bugs/limitations, migration from Playwright, proxy configuration pattern
- **High confidence**: rebrowser-playwright Python support (PyPI confirmed), import namespace behavior, multi-browser support advantage
- **High confidence**: Botright + Patchright NOT currently combined (developer confirmed in discussion)
- **Medium confidence**: Akamai-specific bypass success — no dedicated Akamai test data found; general benchmarks used as proxy
- **Medium confidence**: Patchright vs Zendriver comparison — benchmark numbers vary across different test suites and methodologies
- **Low confidence**: 2026 detection reports — no definitive "Patchright was caught by X on date Y" found; absence of reports suggests it still works but cannot confirm

## Information Gaps

- No dedicated Akamai Bot Manager test results for Patchright (only general benchmark scores)
- No Reddit community discussions specifically about Patchright + Akamai from 2025-2026 found
- Exact Botright integration timeline for Patchright engine is unknown
- Headless mode bypass rate for Akamai specifically (vs general ~67% CreepJS score) is unknown
- No data on whether rebrowser-playwright's multi-browser support (Firefox/WebKit) provides better Akamai bypass than Patchright's Chromium-only approach
