# Research: curl_cffi and Akamai Bypass

## Executive Summary

curl_cffi is a Python binding for a fork of curl-impersonate via CFFI that spoofs TLS/JA3, HTTP/2
(Akamai-format SETTINGS/WINDOW_UPDATE), and partial JA4 signals to make HTTP requests
indistinguishable from real Chrome/Firefox/Safari/Edge. Against Akamai Bot Manager it achieves
roughly 90% success in moderate-difficulty configurations when combined with residential proxies,
but fails entirely against full JavaScript-challenge enforcement that requires sensor_data. The
_abck cookie has a 365-day nominal lifetime but is cryptographically bound to the originating
IP+UA+TLS session, making naïve cross-proxy replay unreliable. Browserless sensor_data generation
without a real JavaScript engine is technically possible but requires deep reverse-engineering
investment or a paid API service.

---

## Findings

### 1. How curl_cffi Impersonates Chrome: Exact TLS Signals Spoofed

curl_cffi is a Python CFFI binding around a patched libcurl (the "curl-impersonate" fork). The
impersonation operates at three stacked layers:

#### Layer 1 — TLS ClientHello (JA3 / JA3N)

The JA3 string is a comma-separated concatenation of five fields extracted from the TLS ClientHello:

```
<TLS version>,<cipher suite IDs hyphen-delimited>,<extension IDs hyphen-delimited>,<supported groups>,<EC point formats>
```

Example for Chrome 134 desktop:
```
771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,
51-27-65281-18-45-0-35-5-11-43-16-65037-23-17613-13-10,4588-29-23-24,0
```

JA3N is identical but extensions are sorted numerically (Chrome permutes extension order per
request, so JA3N is stable across calls):
```
771,4865-4866-4867-...,0-5-10-11-13-16-18-23-27-35-43-45-51-17613-65037-65281,4588-29-23-24,0
```

Specific extra_fp fields that go beyond what JA3 covers:

| Field | API key | Example value |
|-------|---------|---------------|
| Signature algorithms list | tls_signature_algorithms | ["ecdsa_secp256r1_sha256", ...] |
| Minimum TLS version | tls_min_version | TLSv1_2 |
| GREASE extensions | tls_grease | True |
| Extension order permutation | tls_permute_extensions | True |
| Certificate compression | tls_cert_compression | "brotli" |
| Record size limit | tls_record_size_limit | 4001 |
| Delegated credentials | tls_delegated_credential | "ecdsa_secp256r1_sha256:..." |

curl_cffi ships a lookup table of pre-captured fingerprints for each browser version. When you
call impersonate="chrome133a", the library patches libcurl's SSL context to emit exactly those
cipher suites, extensions, and curves.

#### Layer 2 — HTTP/2 Akamai Fingerprint

The Akamai HTTP/2 fingerprint string has four pipe-separated components:

```
SETTINGS|WINDOW_UPDATE|PRIORITY_FRAMES|PSEUDO_HEADER_ORDER
```

Real Chrome 134 example (from Issue #529):
```
1:65536;2:0;4:6291456;6:262144|15663105|0|m,a,s,p
```

Breakdown:
- SETTINGS: `1:65536` (HEADER_TABLE_SIZE), `2:0` (ENABLE_PUSH=disabled),
  `4:6291456` (INITIAL_WINDOW_SIZE), `6:262144` (MAX_HEADER_LIST_SIZE)
- WINDOW_UPDATE: `15663105` (connection-level window increment in bytes)
- PRIORITY: `0` means no PRIORITY frames (Chrome dropped them after HTTP/2 draft)
- Pseudo-headers: `m,a,s,p` = `:method, :authority, :scheme, :path`

libcurl normally sends different SETTINGS and window values that are immediately detectable
as a Python/Go HTTP library rather than Chrome. curl_cffi overrides these via custom CURLOPT
extensions (non-standard options added specifically for this project):
- `CURLOPT_HTTP2_SETTINGS`
- `CURLOPT_HTTP2_WINDOW_UPDATE`
- `CURLOPT_HTTP2_PSEUDO_HEADERS_ORDER`

Additional HTTP/2 per-stream weight is controlled via:
- `http2_stream_weight` (e.g. 256 for Chrome)
- `http2_stream_exclusive` (e.g. 1)

#### Layer 3 — HTTP/3 / QUIC (since v0.11.4 / v0.15.0)

Browser profiles chrome145 and firefox147+ include HTTP/3 fingerprints and UDP proxy support,
meaning QUIC CRYPTO handshake parameters can also be spoofed. This is the newest layer and
the least battle-tested.

---

### 2. JA3 and JA4 — Does curl_cffi Defeat Both?

**JA3: Yes, fully defeated.**
curl_cffi ships pre-captured JA3 strings for 30+ browser versions. By replicating the exact
cipher suite order, extension set, supported groups, and EC point formats, JA3 hash output
is identical to real Chrome. Claimed match rate: 99.8% against Chrome 128 in benchmarks.

**JA4: Substantially defeated, with a caveat.**
JA4 (developed by FoxIO, the creator of JA3) was designed to be more stable than JA3 by sorting
cipher suites alphabetically and using a different extension ordering strategy. Because curl_cffi
controls the full TLS handshake at the libcurl level — including ALPN selection, extension
presence, cipher order, and version negotiation — it can produce a JA4 output identical to a
real Chrome session.

The key caveat: JA4 also includes the ALPN protocol string (h2, http/1.1). curl_cffi correctly
negotiates h2 via ALPN, which is essential. The extra_fp option tls_permute_extensions=True
mimics Chrome's per-connection extension permutation, which matters for JA3 stability but less
so for JA4.

No native `ja4=...` parameter exists in curl_cffi's API. JA4 conformance comes implicitly from
the accuracy of the underlying TLS handshake reconstruction. If Akamai has started keying on
JA4-specific normalization artefacts, the built-in profiles should still pass because they
originate from real Chrome captures.

---

### 3. HTTP/2 Fingerprint — SETTINGS and WINDOW_UPDATE

This is where curl_cffi most clearly exceeds all other Python HTTP libraries. Standard requests,
httpx, and aiohttp all emit their own SETTINGS frames and window sizes, which are trivially
different from Chrome:

| Client | INITIAL_WINDOW_SIZE | WINDOW_UPDATE | ENABLE_PUSH |
|--------|--------------------|-----------|----|
| Chrome 134 | 6,291,456 | 15,663,105 | 0 (disabled) |
| Python httpx | 65,535 (default) | 65,535 | 1 |
| Python requests | n/a (HTTP/1.1 only) | n/a | n/a |

curl_cffi sets:
- SETTINGS via `akamai=` parameter or `CURLOPT_HTTP2_SETTINGS`
- WINDOW_UPDATE via the second pipe-segment of the akamai string
- PRIORITY frames via the third segment (Chrome sends none: `0`)
- Pseudo-header order (`m,a,s,p` for Chrome) via `CURLOPT_HTTP2_PSEUDO_HEADERS_ORDER`

A WAF rule of the form "if User-Agent claims Chrome but SETTINGS header table size != Chrome's
value, flag as bot" is trivial to write and is exactly what Akamai enforces. curl_cffi is the
only Python library (outside of headless browsers) that defeats this check.

---

### 4. Real-World Success Rates Against Akamai with curl_cffi Alone

Success depends heavily on which Akamai product tier is deployed:

| Akamai Configuration | curl_cffi + residential proxy | Notes |
|----------------------|-------------------------------|-------|
| Basic (TLS + header check only) | ~95% | TLS spoof is sufficient |
| Bot Manager Standard (JS challenge) | ~70-90% | Depends on sensor_data enforcement |
| Bot Manager Premier (full behavioral) | ~20-40% | Requires sensor_data |
| Sites with active re-challenge loops | ~10-30% | _abck must be refreshed |

Reported figures from practitioners:
- "The Web Scraping Club" (Substack): 90% bypass on Gucci.com using scrapy-impersonate
  (curl_cffi backend)
- DataHut blog: improvement from 9% (httpx) to 93% success after migrating to curl_cffi
- brightdata blog: Walmart returns human content with impersonate="chrome", bot page without

The consensus: curl_cffi alone handles Akamai configurations that rely primarily on TLS/HTTP2
fingerprinting. It fails when the site enforces `sensor_data` validation (JavaScript behavioral
telemetry) as a hard requirement for cookie issuance.

---

### 5. Cookie Harvesting Pattern: Browser Gets _abck, curl_cffi Replays

#### The _abck Cookie

- Nominal lifetime: 365 days per the cookie database
- Companion cookies: `ak_bmsc` (2-hour session), `bm_sz`, `bm_sv`, `RT`
- Structure (internal): timestamps, encrypted/signed tokens, behavioral data references,
  challenge outcome flags
- Binding: contains encrypted data reflecting the originating UA and proxy details

#### The Harvest-and-Replay Pattern

Workflow:
1. Run a real Chromium/Playwright session from a residential IP, navigate to the target site
2. Akamai's JS challenge executes, collects sensor_data (canvas fingerprint, mouse/keyboard
   events, WebGL, fonts, etc.), POST to `/akam/` endpoint
3. Akamai sets `_abck` cookie with a high trust score
4. Extract cookies from the browser context
5. Switch to curl_cffi for all subsequent requests, injecting the harvested cookies

```python
# Step 1: harvest with Playwright
from playwright.async_api import async_playwright
import json

async def harvest_cookies(url: str) -> dict:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        ctx = await browser.new_context()
        page = await ctx.new_page()
        await page.goto(url)
        await page.wait_for_timeout(3000)  # let sensor_data POST complete
        cookies = await ctx.cookies()
        await browser.close()
        return {c['name']: c['value'] for c in cookies}

# Step 2: replay with curl_cffi
from curl_cffi import AsyncSession

async def scrape_with_harvested_cookies(url: str, cookies: dict):
    async with AsyncSession(impersonate="chrome133a") as s:
        r = await s.get(
            url,
            cookies=cookies,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )
        return r.text
```

#### Does It Actually Work?

Partially — with important constraints:

1. **IP consistency is critical.** The _abck value is encrypted with UA + proxy metadata.
   Replaying from a different IP than the one that generated the cookie typically fails or
   triggers a re-challenge. Both harvesting and replaying must use the same residential IP.

2. **UA consistency.** The User-Agent sent with curl_cffi must match the harvesting browser
   session exactly.

3. **TLS consistency.** This is where curl_cffi earns its place — if you replay with plain
   requests, the TLS fingerprint mismatch may invalidate the cookie session even if cookies
   are present.

4. **Session freshness.** The _abck cookie is nominally 365 days, but Akamai performs in-session
   re-challenge if behavioral patterns drift. Long-lived sessions that see no sensor_data
   refreshes degrade in trust score over time. Practical reuse window: hours to days depending
   on request volume.

5. **ak_bmsc is 2-hour expiry.** This companion cookie must be refreshed more frequently.
   Some Akamai implementations require both.

The pattern is viable when you control a small pool of residential IPs and can maintain
IP-sticky sessions. It breaks at scale because each residential IP can only support one
harvested session at a time.

---

### 6. Python Code Examples for curl_cffi with Akamai

#### Basic Chrome Impersonation

```python
from curl_cffi import requests

# Simple impersonation — handles TLS + HTTP/2 automatically
r = requests.get(
    "https://www.example-akamai-site.com",
    impersonate="chrome133a",
)
print(r.status_code, r.text[:200])
```

#### Persistent Session (cookie jar + connection pool)

```python
from curl_cffi.requests import Session

with Session(impersonate="chrome133a") as s:
    s.headers.update({
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
    })
    # First request — cookie jar starts empty
    r1 = s.get("https://target.com/")
    # Subsequent requests reuse cookies and connections
    r2 = s.get("https://target.com/products")
    print(s.cookies)
```

#### Async Session with Residential Proxy

```python
import asyncio
from curl_cffi import AsyncSession

async def main():
    async with AsyncSession(
        impersonate="chrome133a",
        proxies={"https": "http://user:pass@residential-proxy:8080"},
    ) as s:
        tasks = [
            s.get(f"https://target.com/page/{i}") for i in range(10)
        ]
        results = await asyncio.gather(*tasks)
        for r in results:
            print(r.status_code)

asyncio.run(main())
```

#### Manual Akamai HTTP/2 Fingerprint (Chrome 134 exact)

```python
from curl_cffi.requests import Session

JA3_CHROME134 = (
    "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,"
    "51-27-65281-18-45-0-35-5-11-43-16-65037-23-17613-13-10,4588-29-23-24,0"
)
AKAMAI_CHROME134 = "1:65536;2:0;4:6291456;6:262144|15663105|0|m,a,s,p"

with Session(
    ja3=JA3_CHROME134,
    akamai=AKAMAI_CHROME134,
    extra_fp={
        "tls_permute_extensions": True,
        "tls_grease": True,
        "tls_cert_compression": "brotli",
    },
) as s:
    r = s.get("https://target.com")
```

#### Inject Harvested Cookies

```python
from curl_cffi.requests import Session

harvested = {
    "_abck": "0E868C6C...~1~YAAQy...",
    "bm_sz": "BF4B4DAA...",
    "ak_bmsc": "A1B2C3...",
}

with Session(impersonate="chrome133a") as s:
    r = s.get(
        "https://target.com/checkout",
        cookies=harvested,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                                "AppleWebKit/537.36 (KHTML, like Gecko) "
                                "Chrome/133.0.0.0 Safari/537.36"},
    )
```

---

### 7. scrapy-impersonate Integration

scrapy-impersonate (PyPI: `scrapy-impersonate`, GitHub: `jxlil/scrapy-impersonate`) is a Scrapy
download handler that routes HTTP/HTTPS requests through curl_cffi instead of Scrapy's default
Twisted HTTP client.

#### How It Works

The handler intercepts Scrapy's download pipeline. When a request arrives, instead of opening
a Twisted HTTP connection, it delegates to curl_cffi's async interface. The result is that every
Scrapy request inherits curl_cffi's TLS + HTTP/2 impersonation transparently.

#### Installation and settings.py

```python
# settings.py
DOWNLOAD_HANDLERS = {
    "http": "scrapy_impersonate.ImpersonateDownloadHandler",
    "https": "scrapy_impersonate.ImpersonateDownloadHandler",
}
USER_AGENT = ""  # curl_cffi sets UA automatically based on impersonated browser
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

DOWNLOADER_MIDDLEWARES = {
    "scrapy_impersonate.RandomBrowserMiddleware": 1000,  # optional: random browser rotation
}
```

#### Spider Example

```python
import scrapy

class AkamaiSpider(scrapy.Spider):
    name = "akamai_spider"

    def start_requests(self):
        yield scrapy.Request(
            "https://target-akamai-site.com/products",
            meta={
                "impersonate": "chrome133a",
                "impersonate_args": {
                    "verify": True,
                    "timeout": 15,
                },
            },
            callback=self.parse,
        )

    def parse(self, response):
        for item in response.css(".product"):
            yield {"name": item.css("h2::text").get()}
```

#### Limitations

- Requires AsyncioSelectorReactor (not Scrapy's default)
- Session/cookie persistence works within a single request but cross-request cookie jar
  management requires custom middleware
- Not compatible with some Scrapy extensions that assume the default HTTP client

---

### 8. tls_client vs curl_cffi

| Dimension | curl_cffi | tls_client (FlorianREGAZ) |
|-----------|-----------|--------------------------|
| Underlying engine | Patched libcurl (C), CFFI bindings | Bogdanfinn tls-client (Go), ctypes/CGo |
| Maintenance | Active (v0.15+ as of 2026) | Effectively abandoned (last release Feb 2024) |
| Open issues | Low (active triage) | 66+ open, no responses |
| HTTP/2 support | Full: SETTINGS, WINDOW_UPDATE, PRIORITY, pseudo-header order | Configurable via h2_settings dict but limited |
| HTTP/3 support | Yes (v0.11.4+), fingerprinted | No |
| asyncio | Native AsyncSession | No native async support |
| Browser profiles | Chrome 99–145, Firefox 133–147, Safari 15–26, Edge 99–101 | Chrome 103–120, Firefox 102–120, Safari 15.3–16.0 |
| JA3/JA3N accuracy | 99.8% claimed against Chrome 128 | Not benchmarked publicly |
| JA4 accuracy | Implicit via full handshake reconstruction | Unknown |
| Akamai http2 param | Native `akamai=` parameter | Not supported |
| Extra fingerprint fields | Yes: extra_fp dict | No |
| Performance | On par with aiohttp/pycurl | ~20-30% slower than curl_cffi sync |
| PyPI installs | High (tens of thousands weekly) | Declining |
| ARM/non-x86 | Limited (macOS ARM works; BSD incomplete) | Platform-limited by Go binary distribution |

**Verdict:** curl_cffi is strictly superior in 2026. tls_client's Go backend (Bogdanfinn's fork)
was innovative when released but has not kept up with browser profile updates or Akamai's HTTP/2
fingerprinting advances. The lack of async support and a native Akamai fingerprint parameter are
critical gaps. For any new project, use curl_cffi.

---

### 9. Session Management: Cookies and Headers Across Requests

curl_cffi's Session (sync) and AsyncSession (async) maintain:

- **Cookie jar**: automatically stores Set-Cookie headers and sends them on subsequent same-origin
  requests, identical to requests.Session behavior
- **Connection pool**: TLS sessions are reused (session resumption), which is important for
  Akamai's behavioral consistency scoring
- **Default headers**: set once at Session level, merged with per-request headers
- **Proxy per-request**: AsyncSession supports different proxies per request, enabling IP rotation
  while keeping the cookie jar intact (note: this breaks Akamai binding unless you maintain IP
  consistency)

```python
# Session-level defaults
s = Session(
    impersonate="chrome133a",
    headers={"Accept-Language": "en-US,en;q=0.9"},
    cookies={"_abck": "..."},
)

# Per-request override
r = s.get(url, headers={"Referer": "https://target.com/"})

# Access session cookies after requests
print(s.cookies["_abck"])

# Discard cookies (for multi-user/session isolation)
s2 = Session(impersonate="chrome133a", discard_cookies=True)
```

To discard cookies on a per-request basis for isolation while reusing TLS/connection context,
use the `discard_cookies=True` parameter.

---

### 10. Performance: Requests Per Second

No authoritative benchmark with exact RPS numbers exists in public documentation. Available
comparative data:

| Library | Sync RPS (rough) | Async capability | Relative speed |
|---------|-----------------|-----------------|----------------|
| curl_cffi (sync) | ~50-150 RPS* | Yes (AsyncSession) | On par with pycurl/aiohttp |
| curl_cffi (async) | ~500-2000 RPS* | Native asyncio | Same as aiohttp at scale |
| requests | ~30-80 RPS* | No (use httpx/aiohttp) | 1x baseline |
| httpx (sync) | ~40-100 RPS* | Yes | ~1.2-1.5x requests |
| aiohttp (async) | ~500-2000 RPS* | Native asyncio | ~10-20x requests sync |
| tls_client | ~20-30% slower than curl_cffi | No native async | ~0.7-0.8x curl_cffi sync |

*RPS highly dependent on network latency, target server, and concurrency. These are relative
rankings, not absolute measurements from a controlled benchmark.

Available hard data:
- curl_cffi completed 50 requests 20-30% faster than tls_client in head-to-head sync tests
- DataForge Analytics case: latency dropped from 410ms avg (httpx) to ~285ms avg (curl_cffi),
  a 62% reduction (includes anti-bot overhead)
- curl_cffi is described as "on par with aiohttp" for async workloads

---

### 11. Akamai sensor_data Generation Without a Browser

#### What Is sensor_data?

sensor_data is a POST payload sent to Akamai's `/akam/` challenge endpoint (also appears as
`akamai-bm-telemetry` header in mobile API contexts). It encodes:

- Canvas fingerprint (hardware-rendered 2D/WebGL texture hash)
- Mouse movement trajectory and timing
- Keyboard event patterns
- WebGL renderer/vendor strings
- Browser API surface (navigator properties, screen resolution, etc.)
- Cryptographic hash of the current Akamai JS challenge script
- Cookie values (in v3: cookie hash is used as encryption key)

#### Version History

- v1.x: Basic signal collection, relatively easy to reverse
- v2.0: Added `akamai-bm-telemetry`, encrypted payload, motion trajectory required
- v3.x (current): VM-obfuscated JavaScript, script content hash used in encryption,
  cookie-bound encryption, significantly harder to reverse

#### Is Headless Generation Practical in 2026?

Technically yes, but at steep cost:

**Free/DIY route:**
- Requires reversing Akamai's obfuscated VM JavaScript (drakoarmy/akamai-vm-reverse on GitHub
  decompiles the v3 VM)
- Canvas fingerprint cannot be randomly generated — must use a pool of pre-captured real device
  fingerprints (xvertile/akamai-bmp-generator ships 2,000 device fingerprints)
- Script hash changes with each Akamai deployment update (weekly to monthly), requiring
  continuous re-reverse
- Motion trajectory must be statistically realistic, not random
- Maintained Go implementation: xvertile/akamai-bmp-generator (315 stars, updated Aug 2025)
  operates as a standalone HTTP server generating sensor payloads

**Commercial API route:**
- Hyper-Solutions (hyper-sdk-py on PyPI): paid API, claims no browser required, supports
  Akamai + DataDome + Incapsula + Kasada
- RapidAPI: "Akamai BMP x-acf-sensor-data" endpoint
- Salamoonder LLC: SDK with Akamai support (Go/Python examples on GitHub)

**Practical recommendation:**
For production scale, sensor_data generation without a browser requires either:
a) Paying for a bypass API (e.g., Hyper-Solutions, ~$0.001-0.005 per solve)
b) Maintaining a small Playwright/Chromium pool for initial _abck harvesting, then replaying
   with curl_cffi for the bulk of requests

Full DIY sensor_data generation in pure Python is not practical in 2026 without committing
significant engineering resources to track Akamai's weekly script updates.

---

## Comparative Analysis

### curl_cffi vs tls_client vs browser automation

| Criterion | curl_cffi | tls_client | Playwright/Selenium |
|-----------|-----------|------------|---------------------|
| TLS fingerprint accuracy | High (full JA3/JA3N/JA4) | Medium (limited profiles) | Perfect (real browser) |
| HTTP/2 fingerprint | Full Akamai-format control | Limited | Perfect (real browser) |
| sensor_data bypass | No | No | Yes (real JS execution) |
| Speed | ~285ms avg, async capable | ~350-400ms, no async | 2,000-5,000ms per page |
| Infrastructure cost | Low (pure Python) | Low | High (browser instances) |
| Maintenance burden | Low | High (abandoned) | Low |
| Scale | 500+ concurrent easily | ~100 concurrent max | ~10-50 concurrent per server |
| Akamai success rate | ~70-90% | ~50-70% (older profiles) | ~60-70% (detectable) |

---

## Sources

1. [curl_cffi GitHub — lexiforest/curl_cffi](https://github.com/lexiforest/curl_cffi) — Main
   repository: browser profiles, feature list, API overview
2. [curl_cffi Customize Fingerprints Docs](https://curl-cffi.readthedocs.io/en/latest/impersonate/customize.html)
   — JA3 format, Akamai string format, extra_fp dictionary fields, code examples
3. [curl_cffi Quick Start Docs](https://curl-cffi.readthedocs.io/en/latest/quick_start.html)
   — Session, AsyncSession, cookie handling, retry strategy examples
4. [Issue #529: Chrome TLS fingerprints for Chrome 134](https://github.com/lexiforest/curl_cffi/issues/529)
   — Exact JA3, JA3N, JA4, Akamai strings for Chrome 134 desktop; extra_fp usage
5. [How to Bypass Akamai — Scrapfly Blog](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping)
   — Akamai detection layers, curl_cffi effectiveness in 2026
6. [Bypassing Akamai Bot Manager for Free — The Web Scraping Club](https://substack.thewebscraping.club/p/bypassing-akamai-for-free)
   — Real-world 90% success rate, scrapy-impersonate workflow, cookie lifecycle
7. [Bypass Akamai with Playwright — Scrapeless](https://www.scrapeless.com/en/blog/bypss-akamai-with-playwright)
   — Cookie harvesting workflow, what fails with Playwright, IP/UA binding requirement
8. [scrapy-impersonate GitHub — jxlil/scrapy-impersonate](https://github.com/jxlil/scrapy-impersonate)
   — Full configuration, spider examples, supported browser profiles (30+)
9. [Python-Tls-Client GitHub — FlorianREGAZ](https://github.com/FlorianREGAZ/Python-Tls-Client)
   — Last commit Feb 2024, 66 open issues, Go backend architecture
10. [_abck Cookie Database](https://www.cookie.is/_abck) — 365-day nominal expiry confirmed
11. [Akamai _abck Glossary — Kameleo](https://kameleo.io/glossary/akamai-abck-cookie) — Cookie
    structure: timestamps, signed tokens, behavioral references; re-challenge conditions
12. [akamai-bmp-generator — xvertile](https://github.com/xvertile/akamai-bmp-generator) —
    315-star Go implementation, 2,000 device fingerprints, standalone server architecture
13. [Akamai Sensor Generator GitHub Topics](https://github.com/topics/akamai-sensor-generator)
    — Ecosystem overview: vm-reverse projects, SDK solutions
14. [Hyper-Solutions hyper-sdk-py](https://github.com/Hyper-Solutions/hyper-sdk-py) — Commercial
    API for browserless Akamai/DataDome/Incapsula bypass
15. [HTTP/2 and Header Consistency — DEV Community](https://dev.to/deepak_mishra_35863517037/http2-and-header-consistency-the-holy-grail-of-stealth-3ej5)
    — WAF detection logic for HTTP/2 SETTINGS mismatch

---

## Confidence Assessment

- **High confidence**: TLS signal list (JA3 format, extra_fp fields) — directly from official
  docs and GitHub issues with exact values
- **High confidence**: HTTP/2 Akamai fingerprint format (four-component pipe-delimited string)
  — from docs and Chrome 134 issue thread
- **High confidence**: curl_cffi > tls_client for all modern use cases — tls_client abandonment
  is publicly verifiable (Feb 2024 last commit, 66 open issues)
- **High confidence**: scrapy-impersonate integration — from official GitHub
- **High confidence**: _abck 365-day nominal expiry — confirmed by cookie database
- **Medium confidence**: Success rate figures (~90% against standard Akamai) — reported by
  practitioners, not controlled benchmarks
- **Medium confidence**: IP/UA binding of _abck — stated in multiple practitioner sources but
  not confirmed by Akamai official documentation
- **Medium confidence**: RPS performance numbers — relative rankings from benchmarks, not
  authoritative absolute measurements
- **Low confidence**: JA4 defeat confirmation — inferred from full handshake reconstruction,
  no explicit JA4 benchmark published for curl_cffi

---

## Information Gaps

- No public controlled benchmark comparing curl_cffi vs httpx vs requests in exact RPS with a
  fixed target and fixed concurrency
- Akamai does not publish documentation on _abck internal structure, encryption algorithm, or
  exact IP/UA binding mechanism
- No published success rate data distinguishing Akamai Bot Manager Standard vs Premier
- The exact JA4 output of curl_cffi impersonation profiles has not been publicly verified
  against Shodan/FoxIO's JA4 reference values
- Exact `ak_bmsc` re-challenge trigger conditions are undocumented
- Whether Akamai's 2026 deployments have begun using HTTP/3 / QUIC fingerprinting at scale is
  unknown
