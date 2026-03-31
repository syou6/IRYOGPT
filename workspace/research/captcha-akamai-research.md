# Research: CAPTCHA Solving Services vs. Akamai Bot Manager (2025-2026)

## Executive Summary

Akamai Bot Manager does NOT use a traditional image CAPTCHA as its primary challenge mechanism. Instead, it employs a layered system anchored by the `_abck` cookie and JavaScript-based sensor data collection, with three distinct challenge types: crypto (proof-of-work), behavioral (sensor data submission), and adaptive (both combined). SalonBoard's "画像認証" is almost certainly Google reCAPTCHA v2 embedded as one of Akamai's optional challenge actions — not a proprietary Akamai visual puzzle. Dedicated CAPTCHA solving services (2captcha, Anti-Captcha, CapSolver) handle reCAPTCHA reliably and cheaply. Akamai's deeper bot detection (fingerprinting, TLS analysis) requires different tooling entirely, with services like EZ-Captcha and Hyper Solutions SDK specifically targeting it.

---

## Findings

### 1. What Type of Challenge Does Akamai Bot Manager Use?

Akamai Bot Manager is primarily a **behavioral fingerprinting + JavaScript challenge system**, not a traditional CAPTCHA. It operates on multiple layers:

**Primary Detection Layer (Invisible to User):**
- JavaScript (`/bm_sz` script) collects 4,000+ browser/device datapoints including TLS fingerprint, JA3 hash, mouse movements, screen resolution, fonts, plugins, and hardware capabilities.
- Results are encoded into two cookies: `_abck` (primary bot detection token) and `bm_sz` (human/bot differentiation).
- Requests that fail fingerprint checks are blocked with HTTP 403 or HTTP 200 (both are used to confuse bots) with page content containing "Pardon Our Interruption" or "Access Denied."

**SEC-CPT Challenge Layer (Triggered on Suspicious Traffic):**
When deeper verification is needed, Akamai returns HTTP **428 Precondition Required** with a JSON challenge body. Three provider types exist:
1. **Crypto** — Proof-of-work. The client must compute cryptographic answers and wait a mandatory `chlg_duration` (seconds). Users see a countdown timer. No human interaction needed.
2. **Behavioral** — Sensor data submission. Extract a script endpoint from the challenge page, POST sensor data up to 3 times to a dynamic verification URL.
3. **Adaptive** — Combination of crypto + behavioral.

**Optional CAPTCHA Action (Site-Configurable):**
Site operators can configure Akamai to trigger a **Google reCAPTCHA challenge** as a fallback action. This is what SalonBoard likely uses for "画像認証" — standard reCAPTCHA v2 image selection embedded via Akamai's challenge action configuration.

**Key Detection Signals:**
| Signal | Meaning |
|--------|---------|
| Cookie `_abck` present | Akamai Bot Manager is active |
| Cookie `bm_sz` present | Akamai bot scoring is running |
| HTTP 403 + "Pardon Our Interruption" | Hard block |
| HTTP 200 + "Access Denied" | Soft block (deceptive) |
| HTTP 428 | SEC-CPT challenge triggered |
| Cookie `sec_cpt` contains `~3~` | Challenge solved successfully |
| Network requests with `akamai` in path | Akamai telemetry active |

---

### 2. SalonBoard "画像認証" — What Is It?

SalonBoard (operated by Recruit) uses Akamai Bot Manager. The "画像認証" (image authentication) displayed on login is most likely **Google reCAPTCHA v2** (the "select all traffic lights / bicycles / crosswalks" image grid), configured as a challenge action within Akamai's Bot Manager. This is a well-documented integration pattern where Akamai presents reCAPTCHA when it scores a session as suspicious but not outright blocked.

Standard reCAPTCHA v2 is fully supported by all major CAPTCHA solving services at low cost.

---

### 3. CAPTCHA Solving Services — Detailed Comparison

#### 2captcha
- **URL:** https://2captcha.com
- **Model:** Human-powered + AI hybrid
- **Supported types:** Image CAPTCHA, reCAPTCHA v2/v2 Invisible/v3/Enterprise, hCaptcha, Cloudflare Turnstile, Amazon Captcha, GeeTest, Arkose Labs (FunCaptcha), KeyCAPTCHA, Lemin, Capy
- **Akamai Native Support:** NOT listed. No direct AkamaiWEB/SBSD task type.
- **reCAPTCHA v2 pricing:** ¥139–¥399 per 1,000 (approximately $0.95–$2.80 USD)
- **Image CAPTCHA pricing:** ¥75–¥135 per 1,000 (approximately $0.50–$0.90 USD)
- **hCaptcha:** ~$0.003/solve ($3.00/1,000)
- **Cloudflare Turnstile:** ¥199 per 1,000 (~$1.35 USD)
- **GeeTest:** ¥399 per 1,000 (~$2.70 USD)
- **Arkose Labs:** ¥199–¥7,000 per 1,000 (varies wildly by difficulty)
- **Solve speed:** 5–60 seconds (reCAPTCHA typically 20–40s)
- **Success rate:** Claimed 95%+; uptime 99.9%
- **Capacity:** Up to 12,000 requests/minute for image types; lower for JS challenges
- **Playwright integration:** Via API token injection — get token from 2captcha API, inject via `document.getElementById('g-recaptcha-response').innerHTML = token`
- **Note:** Pricing shown in CNY on their site; they appear to serve Chinese market pricing; actual USD may differ

#### Anti-Captcha (anti-captcha.com)
- **URL:** https://anti-captcha.com
- **Model:** Human workers
- **Supported types:** Image CAPTCHA, reCAPTCHA v2/v3/Enterprise, hCaptcha, GeeTest, Arkose Labs, Cloudflare Turnstile, Amazon WAF, Friendly Captcha, Prosopo, Altcha
- **Akamai Native Support:** NOT listed in documentation
- **Pricing per 1,000 solves:**
  | Type | Price (USD) |
  |------|-------------|
  | Image CAPTCHA | $0.50–$0.70 |
  | reCAPTCHA v2 | $0.95–$2.00 |
  | reCAPTCHA v3 | $1.00–$2.00 |
  | reCAPTCHA Enterprise | $5.00 |
  | GeeTest | $1.80 |
  | Arkose Labs | $3.00 |
  | Cloudflare Turnstile | $2.00 |
  | Amazon WAF | $2.00 |
- **Success rate:** Not published; discounts apply at higher daily volumes
- **Playwright integration:** Same token injection method as 2captcha; official API libraries available for Python, Node.js, PHP

#### CapSolver
- **URL:** https://capsolver.com / https://docs.capsolver.com
- **Model:** AI-powered (no humans)
- **Supported types:** reCAPTCHA v2/v3/Enterprise, Cloudflare Turnstile/Challenge, AWS WAF CAPTCHA, hCaptcha, GeeTest, Arkose Labs, DataDome
- **Akamai Native Support:** CLAIMED but NOT listed on public pricing page. Marketing mentions Akamai support; pricing page as of research does not list it explicitly.
- **Pricing per 1,000 solves:**
  | Type | Price (USD) |
  |------|-------------|
  | reCAPTCHA v2 | $0.80 |
  | reCAPTCHA v3 | $1.00 |
  | reCAPTCHA v3 Enterprise | $3.00 |
  | Cloudflare Turnstile | $1.20 |
  | Cloudflare Challenge | $1.20 |
- **Speed:** AI-based — typically faster than human services (sub-10 seconds)
- **Playwright integration:** Official browser extension that auto-detects and solves. Load via `--load-extension` flag in Playwright's `launchPersistentContext`. Supports both "click mode" and "token mode."
- **Note:** Pay-as-you-go; package discounts up to 60% off

#### NopeCHA
- **URL:** https://nopecha.com
- **Model:** AI-powered browser extension
- **Supported types:** reCAPTCHA v2/v3/Enterprise, hCaptcha (including video challenges), Cloudflare Turnstile, Arkose FunCAPTCHA, AWS WAF CAPTCHA, GeeTest, PerimeterX Human, Text CAPTCHA, Lemin
- **Akamai Native Support:** NOT listed
- **Pricing:**
  - Free tier: 100 recognitions per 24 hours
  - Paid: ~$1 per 90,000 recognitions (extremely cheap)
- **Playwright integration:** NATIVE — designed specifically for Playwright/Puppeteer/Selenium. Load extension into Chromium context, it auto-solves CAPTCHAs. Version 0.5.4 (Dec 2025) uses undetectable mouse action implementation.
- **Best for:** High-volume reCAPTCHA/hCaptcha solving with Playwright

#### EZ-Captcha (ez-captcha.com)
- **URL:** https://ez-captcha.com
- **Model:** AI-powered
- **Supported types:** AkamaiWEB, AkamaiSBSD, plus standard types
- **Akamai Native Support:** YES — explicitly supports two Akamai-specific task types
  - `AkamaiWEB`: Response time < 1.5 seconds
  - `AkamaiSBSD`: Response time < 3 seconds
- **Pricing:** $2.50 per 1,000 requests for both Akamai types
- **API:** POST to `https://api.ez-captcha.com/createSyncTask` with pageURL, v3 script URL, cookies, user agent, language. Receive payload to POST to target site.
- **Developer plan:** Contact for better rates
- **Best for:** Sites where Akamai's deeper challenge (SEC-CPT) is triggered

#### Bright Data Web Unlocker
- **URL:** https://brightdata.com/products/web-unlocker/captcha-solver/akamai-bot
- **Model:** Infrastructure-level (proxy + browser fingerprinting + CAPTCHA solving combined)
- **Akamai Support:** YES — explicit Akamai Bot CAPTCHA solver product page
- **Pricing:**
  - Pay-as-you-go: $1.50/1,000 successful requests
  - 380K tier: $1.30/1,000 at $499/month
  - 900K tier: $1.10/1,000 at $999/month
  - 2M tier: $1.00/1,000 at $1,999/month
- **What it handles:** Full Akamai bypass including fingerprinting, not just CAPTCHA; treats entire request lifecycle
- **Integration:** Drop-in API proxy endpoint; works with Python `requests`, Node.js `fetch`, cURL
- **Note:** This is a full web unlocker service, not a pure CAPTCHA solver — you send your request through their infrastructure

#### Hyper Solutions SDK
- **URL:** https://docs.hypersolutions.co / https://github.com/Hyper-Solutions/hyper-sdk-go
- **Model:** SDK (not a hosted service per se; you run their code)
- **Akamai Support:** YES — specifically built for Akamai SEC-CPT challenges
  - Parses `sec-cpt` challenge from HTML/JSON responses
  - Generates `generate_sec_cpt_payload()`
  - Handles all three provider types: crypto, behavioral, adaptive
  - Available in Go (`hyper-sdk-go`) and JavaScript (`hyper-sdk-js` on npm)
- **Python:** Via `hyper_sdk.akamai.SecCptChallenge` with `tls_client` library
- **Pricing:** Not found (may be subscription-based or enterprise)
- **Session recovery:** Once `sec_cpt` cookie contains `~3~`, session is maintained automatically via `tls_client.Session` object

---

### 4. Akamai Challenge Detection Patterns

```python
# Programmatic detection in Python/Playwright

# Indicator 1: Cookie presence
def has_akamai_protection(cookies: dict) -> bool:
    return "_abck" in cookies or "bm_sz" in cookies

# Indicator 2: HTTP 428 = SEC-CPT challenge
def is_sec_cpt_challenge(status_code: int) -> bool:
    return status_code == 428

# Indicator 3: HTTP 403 with specific content
def is_akamai_block(status_code: int, body: str) -> bool:
    return status_code == 403 and (
        "Pardon Our Interruption" in body or
        "Access Denied" in body
    )

# Indicator 4: HTTP 200 soft block (deceptive!)
def is_akamai_soft_block(status_code: int, body: str) -> bool:
    return status_code == 200 and "Access Denied" in body

# Indicator 5: Challenge solved successfully
def is_challenge_solved(cookies: dict) -> bool:
    sec_cpt = cookies.get("sec_cpt", "")
    return "~3~" in sec_cpt
```

---

### 5. Playwright Integration Patterns

**For reCAPTCHA v2 (most likely SalonBoard case) using 2captcha:**
```python
import requests
from playwright.sync_api import sync_playwright

def solve_recaptcha_2captcha(api_key: str, site_key: str, page_url: str) -> str:
    # Step 1: Submit task
    resp = requests.post("https://2captcha.com/in.php", data={
        "key": api_key,
        "method": "userrecaptcha",
        "googlekey": site_key,
        "pageurl": page_url,
        "json": 1,
    })
    task_id = resp.json()["request"]

    # Step 2: Poll for result (20-60 second wait)
    import time
    time.sleep(20)
    for _ in range(10):
        res = requests.get(f"https://2captcha.com/res.php?key={api_key}&action=get&id={task_id}&json=1")
        if res.json()["status"] == 1:
            return res.json()["request"]
        time.sleep(5)
    raise Exception("CAPTCHA solve timeout")

def login_with_captcha_solve(username: str, password: str):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto("https://salonboard.com/login/")

        # Detect reCAPTCHA site key
        site_key = page.eval_on_selector(
            ".g-recaptcha", "el => el.getAttribute('data-sitekey')"
        )

        # Solve via service
        token = solve_recaptcha_2captcha(
            api_key="YOUR_KEY",
            site_key=site_key,
            page_url=page.url
        )

        # Inject token
        page.evaluate(f"""
            document.getElementById('g-recaptcha-response').innerHTML = '{token}';
        """)

        # Fill credentials and submit
        page.fill("#username", username)
        page.fill("#password", password)
        page.click("#login-button")
```

**For NopeCHA extension approach (auto-solve):**
```python
from playwright.sync_api import sync_playwright
import json, pathlib

def setup_nopecha_context(api_key: str):
    # Configure extension
    config_path = pathlib.Path("nopecha_config.json")
    config_path.write_text(json.dumps({"key": api_key}))

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="/tmp/playwright_profile",
            headless=False,
            args=[
                "--disable-extensions-except=/path/to/nopecha",
                "--load-extension=/path/to/nopecha",
            ]
        )
        page = context.new_page()
        # NopeCHA auto-handles reCAPTCHA/hCaptcha it encounters
        page.goto("https://salonboard.com/login/")
        # CAPTCHAs solved automatically by extension
```

---

### 6. Session Recovery After CAPTCHA Solve

Yes — sessions are preserved after CAPTCHA solving IF handled correctly:

1. **Cookie persistence:** After solving, the `sec_cpt` cookie (containing `~3~`) and valid `_abck` cookie must be stored and forwarded on subsequent requests.
2. **Playwright:** `page.context().cookies()` returns all cookies; use `context.add_cookies()` to restore from saved state.
3. **Requests library:** `tls_client.Session` automatically maintains cookies across requests; once solved, subsequent requests in the same session proceed without re-challenge.
4. **Duration:** Valid sessions typically last minutes to hours depending on site configuration; re-challenges occur when fingerprint or behavior changes.

---

## Comparative Analysis

| Service | Akamai Native | reCAPTCHA v2 | hCaptcha | Price/1K (reCAPTCHA) | Price/1K (Akamai) | Playwright Integration | Speed |
|---------|--------------|--------------|----------|---------------------|-------------------|----------------------|-------|
| 2captcha | No | Yes | Yes | ~$1.00–$2.80 | N/A | Token injection | 20–60s |
| Anti-Captcha | No | Yes | Yes | $0.95–$2.00 | N/A | Token injection | 15–45s |
| CapSolver | Partial? | Yes | Yes | $0.80 | Unlisted | Extension / Token | <10s |
| NopeCHA | No | Yes | Yes | ~$0.01 ($1/90K) | N/A | Native extension | <10s |
| EZ-Captcha | YES | Yes | Unknown | ~$1.00 | $2.50 | API + token | <3s |
| Bright Data | YES | Yes | Yes | ~$1.50 (bundled) | $1.50 (bundled) | Drop-in proxy | Varies |
| Hyper SDK | YES | Via SDK | No | SDK-based | SDK-based | Python/Go/JS SDK | 1–5s |

---

## Recommendation for SalonBoard / SalonConnect Use Case

**Most likely scenario:** SalonBoard uses Akamai Bot Manager with reCAPTCHA v2 configured as the challenge action. The "画像認証" is standard reCAPTCHA v2.

**Recommended approach (in priority order):**

1. **NopeCHA (cheapest + easiest for reCAPTCHA):** Load as Playwright extension. At ~$0.011/1,000 solves it is extremely cost-effective if reCAPTCHA v2 is the only challenge. Free tier covers 100/day.

2. **2captcha or CapSolver (reliable fallback):** Well-documented APIs, proven Playwright integration. CapSolver is AI-based (faster). Both handle reCAPTCHA v2 at <$1/1,000.

3. **EZ-Captcha (if Akamai SEC-CPT 428 is triggered):** $2.50/1,000 for `AkamaiWEB` task type. Use when the JavaScript fingerprinting challenge fires before the CAPTCHA page.

4. **Bright Data or Hyper SDK (if deep Akamai bypass needed):** For sites where fingerprinting alone blocks requests before any CAPTCHA appears. Higher cost but handles full Akamai stack.

**Cost estimate for 1,000 logins/month:**
- If only reCAPTCHA: ~$1–$3 (2captcha/CapSolver)
- If Akamai SEC-CPT also triggers: ~$2.50 + $1–3 = ~$3.50–$5.50 per 1,000

---

## Sources

1. [Akamai Handling 428 Status Code (SEC-CPT)](https://docs.hypersolutions.co/akamai-web/handling-428-status-code-sec-cpt) — Full technical spec of SEC-CPT challenge types (crypto, behavioral, adaptive), cookie detection, session recovery
2. [EZ-Captcha Akamai Solver](https://www.ez-captcha.com/products/akamai) — AkamaiWEB/SBSD task types, $2.50/1K pricing, API integration details
3. [Scrapfly: How to Bypass Akamai Anti-Scraping (2026)](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping) — Detection via _abck/bm_sz cookies, HTTP 403/428 patterns, soft block deception
4. [Bypassing Akamai Bot Manager for Free (The Web Scraping Club)](https://substack.thewebscraping.club/p/bypassing-akamai-for-free) — Cookie detection, TLS fingerprint bypass with scrapy-impersonate
5. [2captcha Pricing](https://2captcha.com/pricing) — Complete pricing table in CNY; reCAPTCHA/image/Turnstile/Arkose rates
6. [Anti-Captcha Homepage](https://anti-captcha.com/) — Supported types, full pricing table in USD
7. [CapSolver Pricing Docs](https://docs.capsolver.com/en/pricing/) — reCAPTCHA/Turnstile pricing; Akamai not explicitly listed
8. [CapSolver Playwright Integration Guide](https://www.capsolver.com/blog/All/how-to-integrate-playwright) — Extension-based auto-solve, code example
9. [NopeCHA Homepage](https://nopecha.com/) — Supported types, pricing ($1/90K), Playwright-native design
10. [NopeCHA GitHub Extension](https://github.com/NopeCHALLC/nopecha-extension) — v0.5.4 undetectable mouse actions, Playwright/Selenium/Puppeteer compatibility
11. [Bright Data Akamai Bot Solver](https://brightdata.com/products/web-unlocker/captcha-solver/akamai-bot) — $1–1.50/1K pricing tiers, Python/Node/cURL integration
12. [Hyper Solutions SDK Gist (Python example)](https://gist.github.com/justhyped/5c28e785642fccdf13265bf5d09e551a) — SEC-CPT solve workflow with tls_client, session recovery via sec_cpt cookie
13. [Akamai Tech Docs: Challenge Action (Terraform)](https://techdocs.akamai.com/terraform/docs/bmgr-ds-challenge-action) — Official confirmation that reCAPTCHA is a configurable challenge action

---

## Confidence Assessment

- **High confidence:** Akamai uses _abck/bm_sz cookies + HTTP 428 + SEC-CPT as primary detection signals; reCAPTCHA v2 is the configurable CAPTCHA action; session cookies persist after solve.
- **High confidence:** NopeCHA, 2captcha, Anti-Captcha, CapSolver all support reCAPTCHA v2 reliably with documented Playwright integrations.
- **High confidence:** EZ-Captcha explicitly supports AkamaiWEB/SBSD tasks at $2.50/1K.
- **Medium confidence:** SalonBoard specifically uses reCAPTCHA v2 (indirect evidence from "画像認証" terminology and Akamai's known reCAPTCHA challenge action; not confirmed by direct inspection of salonboard.com).
- **Low confidence:** CapSolver's claimed Akamai support — marketing claims it but pricing page does not list Akamai task types.
- **Low confidence:** 2captcha's Akamai support claim — search results mentioned it but the official pricing page does not list any Akamai task type.

## Information Gaps

- Cannot confirm SalonBoard's exact CAPTCHA type without live browser inspection (network tab, page source).
- Hyper Solutions SDK pricing not publicly disclosed — requires contact.
- NopeCHA does not explicitly support Akamai SEC-CPT challenges; unknown behavior when Akamai's deeper challenge fires.
- No published third-party benchmark comparing solve success rates across services specifically for Akamai-protected Japanese sites.
- Session duration after Akamai challenge solve is site-specific; no published data for SalonBoard.
