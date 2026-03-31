# Anti-Bot Evasion Research: Comprehensive 2025-2026 Report
## Research date: 2026-03-31
## Focus: Akamai Bot Manager, browser frameworks, TLS evasion, proxies, CDP bypass

---

## Executive Summary

Akamai Bot Manager in 2026 is a multi-layered trust scoring system that cannot be bypassed by any single technique alone. The effective approach requires combining: (1) a source IP with legitimate residential or mobile ASN reputation, (2) authentic TLS fingerprints matching a real browser, (3) a stealthy browser automation layer that hides CDP signals, and (4) human-like behavioral patterns. From a datacenter VPS like ConoHa, direct requests achieve under 12% success against Akamai-protected sites. With residential/mobile proxies routed through the VPS, success rates rise to 70-96% depending on proxy type and browser tool. Commercial scraping APIs (Scrapfly, ZenRows) claim 97-99% success and abstract all complexity at a cost of roughly $0.03-0.30 per heavy request.

---

## 1. How Akamai Bot Manager Actually Detects Bots

Akamai's detection runs across five layers simultaneously:

**Layer 1 - TLS Fingerprinting (Connection-time)**
Each TLS library produces a unique ClientHello handshake. Akamai captures JA3 and JA4 hashes. JA4 (2023-present) sorts cipher suites and extensions into canonical order before hashing, making JA3-era randomization useless. A Python `requests` library connecting from a VPS produces a JA3/JA4 instantly recognizable as automation.

**Layer 2 - IP Reputation**
IP addresses are classified by ASN (Autonomous System Number). Datacenter ASNs (AWS, GCP, ConoHa, etc.) receive immediate negative trust scores. Akamai enforces 3 requests before challenge on datacenter ASNs. Residential ISP IPs (NTT, KDDI, SoftBank) receive positive trust signals. Mobile carrier IPs (NTT Docomo, SoftBank, au) receive the highest trust.

**Layer 3 - HTTP Characteristics**
Header order, presence of `Origin`/`Referer`, HTTP version (1.1 vs 2/3), and header value patterns. `requests` and similar libraries default to HTTP/1.1 and produce non-browser header ordering.

**Layer 4 - JavaScript Fingerprinting**
Akamai injects JavaScript that collects: JS engine details, hardware capabilities, GPU info (WebGL), OS details, browser plugins, canvas fingerprint, audio fingerprint, screen properties, and timezone. This data becomes the `sensor_data` payload POSTed to `/akamai/bm/gather-data-from-client`.

**Layer 5 - Cookie Chain + Behavioral Analysis**
The `_abck` cookie is issued after successful sensor_data validation. It has a TTL and must be refreshed. Subsequent requests are validated against this cookie. Behavioral patterns (mouse movements, scroll timing, click patterns) accumulate trust or suspicion over the session.

**Key Akamai cookies:**
- `_abck` - Primary validation cookie, ~10 min TTL
- `ak_bmsc` - Bot manager session cookie
- `bm_sv` - Session validation
- `bm_mi` - Machine identification

---

## 2. Browser Automation Framework Rankings

### Benchmark Data (techinz/browsers-benchmark, January 2026)
18 tools tested across 5 anti-bot systems (Cloudflare, DataDome, Amazon, Google, Ticketmaster/Imperva):

| Tool | Overall Bypass Rate | RAM Usage | Notes |
|------|---------------------|-----------|-------|
| camoufox_headless | 83.3% | 1037 MB | Firefox, C++ patched |
| nodriver-chrome | 83.3% | ~400 MB | Direct CDP |
| playwright-firefox | 83.3% | ~600 MB | Firefox engine |
| zendriver | 75% | ~400 MB | Best vs Akamai specifically |
| playwright-stealth | 66.7% | ~350 MB | Varies by config |
| patchright_headless | 16.7% | ~350 MB | Poor headless |
| playwright-chrome | 16.7% | 212 MB | Heavily detected headless |

**Note**: These tests used "clean" home proxies. Datacenter IPs would reduce all scores by 30-50 percentage points.

### Tool Deep-Dives

**Camoufox (daijro/camoufox)**
- Firefox modified at the C++ level before JavaScript can inspect it
- BrowserForge integration for statistically accurate fingerprint generation
- Achieves 0% headless detection on major fingerprint test suites
- Best against DataDome and fingerprint-heavy systems
- IMPORTANT: Original maintainer inactive since March 2025. Community forks active but check status.
- Memory intensive: ~1GB per instance
- Python async API

**Zendriver (ultrafunkamsterdam/zendriver)**
- Active fork of NoDriver with faster development pace
- Bypasses WebDriver protocol entirely - no `navigator.webdriver` exposure
- Direct Chrome DevTools Protocol without Puppeteer overhead
- Async-first Python
- Confirmed working against Akamai, Cloudflare, CloudFront in 2025 testing
- 75% baseline success rate (clean proxy, no residential required for some sites)

**Patchright (Kaliiiiiiiiii-Vinyzu/patchright)**
- Playwright binary-level patch
- Sets `navigator.webdriver` = false, patches HeadlessChrome UA
- Protocol-level CDP stealth (better than JS patching)
- Works well against basic/medium anti-bot
- Against enterprise Akamai headless: needs residential proxy support
- Active maintenance, tracks Playwright versions

**Rebrowser-patches (rebrowser/rebrowser-patches)**
- Collection of patches for Puppeteer and Playwright
- Primary fix: `Runtime.Enable` CDP leak (this single signal detected by ALL major anti-bots)
- Three modes:
  - `addBinding` (default): Creates bindings in main world, avoids Runtime.Enable
  - `alwaysIsolated`: Uses `Page.createIsolatedWorld`
  - `enableDisable`: Runtime.Enable then immediate Runtime.Disable
- Also patches `sourceURL` from `pptr:...` to generic names
- Tested vs Cloudflare and DataDome (not specifically tested vs Akamai)
- Latest: Playwright 1.52.0 (April 2025), Puppeteer 24.8.1 (May 2025)

**Playwright-stealth / puppeteer-extra-plugin-stealth**
- Legacy approach: JS API patching via Proxy objects
- Spoofs `navigator.webdriver`, `navigator.languages`, `screen.colorDepth`
- Problem: patches introduce their own detectable artifacts
- Still useful for basic/medium protection but considered inferior to CDP-level approaches
- Not recommended for Akamai

**Botright**
- Playwright-based with built-in CAPTCHA solving
- Less maintained, not recommended for production

### Practical Success Rates Against Akamai (Combined Tool + Proxy)

| Proxy Type | Tool Alone | + Residential Proxy | + Mobile Proxy |
|-----------|-----------|---------------------|----------------|
| Enterprise Akamai | 5-15% | 40-70% | 75-96% |
| Medium protection | 40-60% | 80-90% | 90%+ |

---

## 3. TLS Fingerprint Evasion

### The JA3/JA4 Problem

**JA3** (2017-2021): Hash of TLS cipher suites + extensions + elliptic curves. Defeatable by randomization.

**JA4** (2023-present): Sorts cipher suites and extensions canonically before hashing, ignores GREASE values. Randomization does NOT defeat JA4. A Python `requests` session always produces a non-browser JA4 fingerprint.

### Tools That Work

**curl_cffi (lexiforest/curl_cffi) - Recommended for Python**
```python
from curl_cffi import requests as cffi_requests

# Impersonate Chrome 124
session = cffi_requests.Session(impersonate="chrome124")
response = session.get("https://target.com")

# Custom JA3/JA4
session = cffi_requests.Session(ja3="...", akamai="...")
```
- Python bindings for curl-impersonate via CFFI
- Supported profiles: Chrome (110-124+), Firefox, Safari, Edge
- Also supports HTTP/2 fingerprint (SETTINGS, WINDOW_UPDATE frames)
- Real-world: ~92% success vs 12% for `requests` library (tested Q1 2025, 50+ sites)
- Works against Akamai when TLS is the primary detection vector
- Maintained actively (lexiforest fork, more active than original lwthiker)

**scrapy-impersonate / scrapy-curl-cffi**
- Scrapy middleware using curl_cffi
- Author of The Web Scraping Club confirmed: "I've used it in several cases when it comes to handling Akamai bot protection"
- For Akamai sites where JS execution is not required

**tls-client (Go)**
- Go library using uTLS for per-browser TLS fingerprints
- Good for high-throughput Go scrapers
- Less Python-friendly

**uTLS (Go)**
- Underlying library for TLS fingerprint mimicking
- Less effective against JA4 due to normalization but useful for JA3 targets

### What No Longer Works
- Simple cipher suite randomization (JA4 sorts before hashing)
- Only changing User-Agent (TLS fingerprint remains unchanged)
- HTTP/1.1 requests claiming to be Chrome (HTTP/2 required)

---

## 4. Residential Proxy Providers - Japan Focus

### Success Rate Data (proxies.sx, January 2026 benchmark)
Methodology: 30 sites per anti-bot vendor, same stealth browser config (Camoufox + behavioral sim), proxy variable isolated

| Metric | Mobile 4G/5G | Residential | Datacenter (ConoHa) |
|--------|-------------|-------------|---------------------|
| Akamai success rate | 91-96% | 35-55% | 5-12% |
| DataDome success rate | 89-95% | 30-50% | <10% |
| PerimeterX success rate | 90-94% | 25-45% | 8-15% |
| Akamai JA4 pass rate | 97% | 55% | 8% |
| IP ban rate /1000 req | 0.5% | 5.8% | 52% |
| Time to first block | 4.2 hours | 18 min | 45 sec |
| Cost /1000 successful req | $2.80 | $4.50 | $22+ |

**ConoHa VPS**: 45 seconds before first block, 52% ban rate per 1000 requests, 5-12% Akamai success rate.

### Provider Comparison for Japan

**BrightData**
- Residential pool: 195 countries, significant Japan
- ISP proxies: NTT, KDDI, SoftBank ASNs available
- Mobile proxies: NTT Docomo, SoftBank, au (KDDI)
- Residential: $8-15/GB
- ISP/static residential: ~$2-3/IP/month
- Strengths: Web Scraper IDE, custom rules, proxy manager, best ecosystem
- Best for: Enterprise-grade, needs specific Japan ISP targeting

**Oxylabs**
- Pool: 175M+ residential IPs, 195 countries
- Success rate: 99.95% in independent testing (fastest: 0.6s avg response)
- Japan: residential and ISP proxies available
- Residential: comparable or slightly higher than BrightData
- Best for: Highest reliability, performance-critical scraping

**IPRoyal**
- Japan ISP proxies confirmed: NTT, SoftBank, au (KDDI)
- Static residential ISP: from $2.70/IP/month
- Speed: up to 10 Gbps, 99.9% uptime, unlimited bandwidth
- Budget-friendly vs BrightData/Oxylabs
- Best for: Cost-sensitive, Japan ISP IPs, static sessions

**Smartproxy (now Decodo)**
- Japan residential available
- Mid-tier pricing
- Best for: Mid-budget operations

**For Akamai bypass in Japan:**
Priority order: Mobile carrier IPs (NTT Docomo/SoftBank/au) > Japan ISP static (NTT/KDDI) > Japan residential rotating > datacenter

---

## 5. Commercial Anti-Detect Browsers

All major anti-detect browsers expose automation APIs:

| Browser | API Type | Headless | Price | Anti-Akamai |
|---------|----------|----------|-------|-------------|
| Multilogin | Selenium, Puppeteer | Yes | $29-159/mo | Medium-High (includes built-in residential proxies) |
| Kameleo | REST API, Puppeteer, Selenium | Yes | €59/mo | High (best developer API) |
| AdsPower | Local API, Selenium | Yes | $5.40+/mo | Medium |
| GoLogin | Playwright, Puppeteer | Partial | $49/mo (100 profiles) | Medium |
| Nstbrowser | Playwright, Puppeteer, Selenium | Yes | Free tier available | Medium (built-in CAPTCHA) |

**How to use programmatically:**
All expose a local WebSocket endpoint or REST API. Example Kameleo + Playwright:
```python
# Connect to Kameleo's local port
playwright.chromium.connect_over_cdp(f"ws://localhost:{KAMELEO_PORT}")
```

**Key consideration**: Designed primarily for multi-account management, not high-volume scraping. Per-session overhead is significant. For volume scraping, open-source tools (Zendriver, Camoufox) are more appropriate.

**Multilogin advantage**: Only commercial anti-detect browser with built-in residential proxies (no separate proxy subscription needed).

---

## 6. Session Cookie Harvesting / Replay

### The Hybrid Approach

The most cost-effective pattern for Akamai-protected sites:

1. **Session establishment** (expensive but infrequent):
   - Use Zendriver or Camoufox + residential/mobile proxy
   - Complete full page load including JS execution
   - Extract: `_abck`, `ak_bmsc`, `bm_sv`, `bm_mi` cookies
   - Extract any `akamai-bm-telemetry` headers

2. **Data extraction** (cheap and fast):
   - Use `curl_cffi` with extracted cookies
   - Same session headers/fingerprint
   - Much faster than full browser per request

3. **Session refresh**:
   - When `_abck` expires (~10 min) or 403 received
   - Return to step 1

### Direct Sensor Data Generation (Advanced)

For sites where cookie replay alone is insufficient:

**GitHub resources (reverse-engineered):**
- `xiaoweigege/akamai2.0-sensor_data`: Akamai v2 sensor_data + _abck bypass
- `cirleamihai/akamai-1.7-cookie-generator`: v1.7 cookie generator
- `i7solar/Akamai`: v1.75 _abck and ak_bmsc generator
- `JokerPeter/akamai-sensor-data-bypass`: Sensor data bypass

**WARNING**: Akamai v3 (current, 2024-present) uses:
- Dynamic JavaScript with complex function concatenation
- Encrypted sensor data
- Hash-seeded by dynamically downloaded script IDs
- Significantly harder to reverse engineer than v2

Commercial sensor_data generation APIs exist (found on BHW forums) but are expensive and fragile.

**Practical recommendation**: Use browser-based session establishment unless you have dedicated reverse engineering resources.

---

## 7. CDP Detection Bypass - Technical Details

### Detection Vectors (ranked by how widely they're checked)

1. **`Runtime.Enable` CDP command** - Detected by ALL major anti-bots (Akamai, Cloudflare, DataDome)
2. **`navigator.webdriver` = true** - Basic check, most tools fix this
3. **HeadlessChrome in User Agent** - Fixed by most stealth tools
4. **`window.cdc_*` / `$cdc_*` variables** - Chrome DevTools markers
5. **`pptr:...` source URLs** in JS stack traces
6. **CDP-specific JS execution timing patterns**
7. **Utility world naming** (Playwright's internal world names)

### The Runtime.Enable Problem (Critical)

Standard Playwright and Puppeteer use `Runtime.Enable` to receive CDP events. This single CDP command is detectable by all major anti-bot vendors. The pattern appears in JS stack traces and timing.

**Solutions:**
- **rebrowser-patches**: Replaces Runtime.Enable with binding-based context tracking
- **NoDriver/ZenDriver**: Never calls Runtime.Enable in the first place
- **Patchright**: Binary-level fix to Playwright's CDP communication

### Current Best Practice

```
ZenDriver > Patchright + rebrowser-patches > Camoufox > Playwright-stealth
(for CDP detection evasion, from best to worst)
```

### Chrome Headless v2 (2022 unification)

Google unified headful/headless Chrome codebases in late 2022. Traditional fingerprint-based detection (API discrepancies, rendering differences) was largely eliminated. Detection shifted to behavioral analysis and CDP protocol signals.

### Remaining Flags That Help (Necessary but Not Sufficient)
```
--disable-blink-features=AutomationControlled
--disable-web-security
--no-first-run
--no-service-autorun
--password-store=basic
```

---

## 8. Cloud Browser / Scraping API Services

### For Akamai Bypass - Service Comparison

| Service | Claimed Akamai Success | Independent Benchmark | Cost | Datacenter-friendly |
|---------|----------------------|----------------------|------|---------------------|
| Scrapfly | 97-99% | 99% overall (Scrapeway) | Credits: ~$0.03-0.30/heavy req | Yes |
| ZenRows | 98% | 54% (Scrapeway) | $69/mo base, ~$4.60/1K avg | Yes |
| ScraperAPI | "Bypass Akamai" | 64% overall | Per-successful-request | Yes |
| ScrapingBee | Not specified | 31% (Scrapeway) | Per-request | Yes |
| Browserless.io | None (browser only) | N/A | ~$250/mo | Yes |
| Browserbase | None (browser only) | N/A | ~$100/mo | Yes |

**Warning about benchmarks**: Scrapeway and other third-party benchmarks may use specific test sites that favor particular services. Claims should be independently verified on target sites.

**Working from ConoHa VPS**: All these services handle proxy routing server-side. Your VPS is just making API calls. Source IP does not matter for these services.

**Scrapfly technical approach:**
- Real browser fingerprints
- Automatic challenge solving
- Country-specific routing
- Anti-scraping protection (ASP) bypass parameter
- Supports Playwright/Puppeteer/Selenium via their API

**ZenRows technical approach:**
- AI-powered detection bypass
- Premium residential proxies included
- JavaScript rendering with stealth
- `?apikey=X&url=Y&js_render=true&premium_proxy=true`

---

## 9. Recommended Architecture by Use Case

### Use Case A: From ConoHa VPS, occasional Akamai bypass (< 1000 req/day)

**Stack**: ZenRows or Scrapfly API
- No proxy management needed
- No browser automation needed
- Simple HTTP calls from VPS
- Cost: ~$49-70/month for moderate volume
- Success rate: 70-99% (site-dependent)

### Use Case B: High-volume Japan-specific Akamai bypass (> 10,000 req/day)

**Stack**:
1. Zendriver (Python) for browser automation
2. BrightData or Oxylabs Japan mobile/ISP proxies
3. curl_cffi for non-JS requests after session establishment
4. Session cookie harvesting + replay pattern

**Cost estimate**: ~$200-500/month (proxies dominate)
**Success rate**: 80-95% against Akamai
**From ConoHa VPS**: Yes, VPS routes through residential proxies

### Use Case C: Maximum stealth, enterprise Akamai (custom built)

**Stack**:
1. Camoufox (or maintained fork) for fingerprint perfection
2. Japan mobile carrier proxies (NTT Docomo/SoftBank 4G/5G)
3. Behavioral simulation (realistic mouse/scroll/timing patterns)
4. Session management with periodic refresh
5. curl_cffi with TLS matching for bulk data extraction

**Success rate**: 91-96% with mobile proxies
**Cost**: High (mobile proxies most expensive at $4-6/GB)

### What Does NOT Work from Datacenter IPs (ConoHa Direct)

- Direct HTTP requests with `requests` library: ~2% success
- curl_cffi TLS spoofing without proxy: ~15% success (TLS fixed but IP reputation fails)
- Stealth browser from datacenter: ~10-20% (IP reputation dominates)
- The only exception: Akamai sites where JS/TLS is the ONLY check (rare in 2026)

---

## Confidence Assessment

**High confidence** (multiple consistent sources):
- Datacenter IPs alone get <12% success against Akamai
- Mobile proxies achieve 91-96% Akamai success
- Runtime.Enable CDP command is the primary detection vector for browser automation
- JA4 normalization defeats simple TLS randomization
- Camoufox and Zendriver are the leading open-source stealth tools in 2026
- curl_cffi is the standard Python library for TLS fingerprint spoofing

**Medium confidence** (fewer sources, possible bias):
- Scrapfly's 97-99% Akamai claim (vendor-stated)
- Specific proxy pricing figures (change frequently)
- 83.3% benchmark figures for camoufox (specific test sites, may not generalize)

**Low confidence / Unverified**:
- Akamai v3 sensor_data reverse engineering difficulty level
- Specific Japan ISP proxy coverage by provider
- Exact cookie TTL values for _abck in all configurations

---

## Information Gaps

- No independent benchmark specifically against Akamai (most tests use Cloudflare as proxy)
- Japan mobile proxy quality and actual ASN coverage per provider not publicly documented
- Akamai v3 sensor_data encryption scheme not publicly reversed (only v1.7/2.0 documented on GitHub)
- Real-world persistent session longevity data for mobile proxies against Akamai
- Whether rebrowser-patches specifically bypasses Akamai (only Cloudflare/DataDome tested)

---

## Sources

1. [Scrapfly: How to Bypass Akamai Anti-Scraping 2026](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping)
2. [DataDome & Akamai Bypass Guide 2026 - PROXIES.SX](https://www.proxies.sx/blog/datadome-akamai-bypass-mobile-proxies)
3. [GitHub: techinz/browsers-benchmark](https://github.com/techinz/browsers-benchmark)
4. [GitHub: pim97/anti-detect-browser-tools-tech-comparison](https://github.com/pim97/anti-detect-browser-tools-tech-comparison)
5. [GitHub: rebrowser/rebrowser-patches](https://github.com/rebrowser/rebrowser-patches)
6. [TLS Fingerprint Bypass Techniques 2026 - ScrapeHero](https://www.scrapehero.com/tls-fingerprint-bypass-techniques/)
7. [From Puppeteer-stealth to Nodriver - Security Boulevard](https://securityboulevard.com/2025/06/from-puppeteer-stealth-to-nodriver-how-anti-detect-frameworks-evolved-to-evade-bot-detection/)
8. [The 2025 Web Scraping Tech Stack - Substack](https://substack.thewebscraping.club/p/the-2025-web-scraping-tech-stack)
9. [Best Antidetect Browsers 2026 - Proxyway](https://proxyway.com/best/antidetect-browsers)
10. [GitHub: lexiforest/curl_cffi](https://github.com/lexiforest/curl_cffi)
11. [Bypassing Akamai for Free - The Web Scraping Club](https://substack.thewebscraping.club/p/bypassing-akamai-for-free)
12. [GitHub: daijro/camoufox](https://github.com/daijro/camoufox)
