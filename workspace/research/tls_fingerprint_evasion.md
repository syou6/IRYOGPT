# Research: TLS/JA3/JA4 Fingerprint Evasion for Akamai Bot Manager (2025-2026)

## Executive Summary

Akamai Bot Manager uses a 5-layer detection stack: IP reputation, TLS fingerprinting (JA3/JA4), HTTP/2 fingerprinting, JavaScript sensor data collection, and behavioral analysis. Bypassing TLS fingerprinting alone (layer 2) is necessary but not sufficient — you must address all five layers for reliable success. For zendriver (CDP-based real Chrome), TLS and HTTP/2 fingerprints pass natively because the browser uses Chrome's own BoringSSL stack; the remaining challenges are IP reputation and Akamai's JavaScript sensor data (`_abck` cookie generation). For non-browser scraping (curl_cffi, primp), you must explicitly impersonate Chrome's TLS and HTTP/2 parameters.

---

## Findings

### 1. How JA3/JA3S/JA4/JA4+ Fingerprinting Works and What Akamai Checks

#### JA3 (2017, MD5-based)

JA3 is computed from the unencrypted TLS ClientHello packet. It concatenates five fields separated by commas, then MD5-hashes the result:

```
TLSVersion,CipherSuiteIDs,ExtensionIDs,EllipticCurveIDs,EllipticCurveFormatIDs
```

Example: `771,4865-4866-4867-49195-49196,0-23-65281-10-11-35-16-5-13-51-45-43-21,29-23-24,0`

The hash becomes a ~32-char hex string, e.g., `cd08e31494f9531f560d64c695473da9` (old stable Chrome).

**JA3S** fingerprints the _server's_ TLS ServerHello (cipher suite chosen, extensions). Used to correlate client+server behavior.

#### JA4 (2023, FoxIO, SHA256-based) — What Akamai Uses Today

JA4 was designed specifically to defeat JA3 evasion via extension permutation. Format:

```
[protocol][version][sni][cipher_count][ext_count][alpn]_[cipher_hash]_[ext_hash]
```

Example: `t13d1516h2_8daaf6152771_e5627eed2f58`

Key design choices that make JA4 harder to evade:
- **Cipher suites are sorted before hashing** — reordering them does nothing
- **Extensions are sorted before hashing** — Chrome's extension permutation (since v108) has zero effect on JA4
- **GREASE values are stripped** — inserting fake extensions/ciphers has zero effect
- **SNI and ALPN removed** from extension hash — changing the target domain doesn't change the fingerprint
- **Signature algorithms are included** — appended _unsorted_ in appearance order (still a behavioral signal)
- **Three-part structure** — captures protocol context (QUIC vs TCP), TLS version, and ALPN

JA4 was adopted by Cloudflare, Akamai, AWS, VirusTotal, and NetWitness in 2024-2025.

**JA4+ suite** adds:
- JA4H: HTTP request header fingerprint
- JA4L: latency measurement
- JA4X: X.509 certificate fingerprint
- JA4SSH: SSH traffic fingerprint

#### What Akamai Specifically Checks

Based on Akamai's published whitepaper and detection documentation, the TLS signal stack includes:

- JA3/JA4 hash matching against known-bad (bot library) signatures
- HTTP/2 SETTINGS frame values (see section 4)
- Header ordering and consistency (HTTP anomaly detection)
- Browser version in User-Agent vs TLS capabilities mismatch
- IP reputation score
- JavaScript sensor data (`_abck` cookie)

---

### 2. TLS Fingerprint Randomization and Impersonation Tools

#### Chrome's Own Extension Permutation (since Chrome 108, shipped Jan 2023)

Chrome now randomizes the order of TLS extensions in every ClientHello. With ~15 factorial possible permutations (~10^12), every connection gets a unique JA3 hash. This was intended to make the TLS ecosystem more robust, but it also broke passive JA3-based bot detection.

The `pre_shared_key` extension (0x0029) remains fixed as the _last_ extension per TLS 1.3 RFC.

**Impact**: JA3 is effectively dead for Chrome-version-pinning. JA4, which sorts before hashing, is unaffected.

#### curl_cffi (Python — Most Practical Tool)

**Repo**: https://github.com/lexiforest/curl_cffi
**Install**: `pip install curl-cffi`

curl_cffi is a Python binding for a fork of curl-impersonate using cffi. It replaces OpenSSL with BoringSSL (for Chrome targets) or NSS (for Firefox), making TLS handshakes cryptographically identical to real browsers.

Supported impersonation targets (as of 2026):
- Chrome: `chrome99`, `chrome110`, `chrome116`, `chrome119`, `chrome120`, `chrome123`, `chrome124`, `chrome131`, `chrome133a`, `chrome136`, `chrome142`, `chrome145`
- Firefox: `firefox133`, `firefox135`, `firefox144`, `firefox147`
- Safari: `safari153` through `safari260`, iOS variants
- Android Chrome: `chrome99_android`, `chrome131_android`
- Tor: `tor145`
- Aliases: `chrome`, `firefox`, `safari` (always latest)

Basic usage:
```python
from curl_cffi import requests

resp = requests.get("https://target.com", impersonate="chrome145")
```

Custom fingerprint (when you need exact control):
```python
resp = requests.get(
    "https://target.com",
    ja3="771,4865-4866-4867-49195-49196,0-23-65281-10-11-35-16-5-13-51-45-43-21,29-23-24,0",
    akamai="4:16777216|16711681|0|m,p,a,s",  # HTTP/2 SETTINGS string
    extra_fp={
        "tls_signature_algorithms": ["ecdsa_secp256r1_sha256", "rsa_pss_rsae_sha256"],
        "tls_grease": True,
        "tls_permute_extensions": True,
        "tls_cert_compression": "brotli",
        "http2_stream_weight": 256,
        "http2_stream_exclusive": 1,
        "tls_record_size_limit": 4001,
    }
)
```

HTTP/3 support was added in v0.15.0.

#### primp (Python, Rust backend — Fastest)

**Repo**: https://github.com/deedy5/primp
**Install**: `pip install primp`

primp is backed by a Rust TLS/HTTP stack (forked from reqwest). As of v1.1.0 it's a full multi-crate Rust ecosystem. It impersonates at the protocol level (not just header spoofing).

Supported targets: `chrome_144` through `chrome_146`, `safari_18.5`, `safari_26`, `edge_144` through `edge_146`, `firefox_140` through `firefox_148`, `opera_126` through `opera_129`, `random`

```python
import primp

client = primp.Client(impersonate="chrome_146", os="windows")
resp = client.get("https://target.com")
```

#### bogdanfinn/tls-client (Go + Python FFI wrapper)

**Repo**: https://github.com/bogdanfinn/tls-client
**Python wrapper**: `pip install wrapper-tls-requests`

Written in Go using uTLS. Supports `Chrome_144` and many browser profiles. Tracks HTTP/2 Akamai fingerprints via `AkamaiFingerprint` / `AkamaiFingerprintHash` struct fields. Can be used from Python via FFI.

#### CycleTLS (Go/JavaScript)

**Repo**: https://github.com/Danny-Dasilva/CycleTLS

Supports Chrome JA4R fingerprints. Configurable via `Ja3` and `Ja4r` options. Used for Node.js/Go scraping pipelines.

#### azuretls-client (Go)

**Repo**: https://github.com/Noooste/azuretls-client

"Full control over ClientHello (JA3/JA4)". Session defaults to Chrome fingerprint automatically. Supports HTTP/1.1, HTTP/2, HTTP/3. Has built-in Chrome, Firefox, Safari, Edge presets.

#### uTLS (Go — Foundational Library)

**Repo**: https://github.com/refraction-networking/utls

The foundational Go library for TLS ClientHello mimicry. All the above Go-based tools are built on top of it. Provides `ClientHelloSpec` struct for fine-grained control over:
- `TLSVersionMin/Max`
- `CipherSuites`
- `Extensions` (SNI, ALPN, supported groups, session tickets, etc.)
- Elliptic curve and point format settings

**Known limitation**: Does not support TLS extensions 1-4. If a JA3 signature contains extension IDs 1-4, the endpoint can still identify the client as uTLS-based.

---

### 3. How to Change Chrome's TLS Fingerprint at CDP Level

**Short answer: You cannot.** This is the most important architectural constraint.

The Chrome DevTools Protocol (CDP) operates at the application layer. It can intercept HTTP request/response headers, modify URLs, inject JavaScript, and intercept responses. It has no access to the TLS stack.

The TLS ClientHello is generated deep inside Chrome's BoringSSL implementation, before any CDP hook fires. There is no CDP command, Network domain method, or Chrome flag that lets you:
- Choose specific cipher suites
- Set extension ordering
- Change the GREASE values
- Modify supported_groups or signature_algorithms

**However, this is actually advantageous**: because zendriver/nodriver drive a real Chrome binary, the TLS handshake is Chrome's authentic BoringSSL handshake. The JA4 fingerprint produced is identical to a real Chrome user. This means:

- JA3 check: PASSES (Chrome BoringSSL generates the correct signature)
- JA4 check: PASSES (same)
- HTTP/2 SETTINGS: PASSES (Chrome sends correct SETTINGS frames)

What zendriver DOES NOT handle natively:
- IP reputation (needs residential proxy)
- JavaScript sensor data / `_abck` cookie (needs correct behavior or SDK)
- CDP detection signals (`navigator.webdriver`, headless flags) — partially patched by zendriver/nodriver

**Practical approach for zendriver**: Focus on IP rotation (residential proxies), behavioral mimicry, and if needed, use a sensor data SDK for `_abck` generation.

If you use a proxy that MITM-terminates TLS (e.g., a corporate HTTPS proxy, or some residential proxy services), the TLS fingerprint seen by Akamai will be that of the proxy, NOT Chrome. This can break TLS-layer evasion even with a real Chrome instance.

---

### 4. HTTP/2 Fingerprinting (SETTINGS Frame, Window Size, Header Order)

Akamai's HTTP/2 fingerprinting was published as a whitepaper at Black Hat EU 2017 and is now a core detection signal. The fingerprint format is:

```
S[param:value;...]|WU|P[streamID:exclusive:dependent:weight,...]|PS[pseudo-header-order]
```

Where:
- **S** = SETTINGS frame parameters (semicolon-separated ID:value pairs)
- **WU** = WINDOW_UPDATE frame value (or 0 if absent)
- **P** = PRIORITY frames
- **PS** = Pseudo-header order (m=:method, p=:path, a=:authority, s=:scheme)

#### Chrome vs Python HTTP/2 SETTINGS Values (Critical Differences)

| Parameter | Chrome | Python golang/net/http | Go stdlib |
|-----------|--------|----------------------|-----------|
| SETTINGS_HEADER_TABLE_SIZE | 65,536 | 4,096 | 4,096 |
| SETTINGS_ENABLE_PUSH | 0 (disabled) | 1 | 1 |
| SETTINGS_INITIAL_WINDOW_SIZE | 6,291,456 | 65,535 | 65,535 |
| SETTINGS_MAX_CONCURRENT_STREAMS | 1,000 | (not sent) | (not sent) |
| SETTINGS_MAX_FRAME_SIZE | (not sent) | 16,384 | 16,384 |
| SETTINGS_MAX_HEADER_LIST_SIZE | 262,144 | (not sent) | (not sent) |

The INITIAL_WINDOW_SIZE difference alone (~96x) is an immediate bot identifier.

Chrome's pseudo-header order: `:method, :authority, :scheme, :path`
Python httpx default: `:method, :path, :scheme, :authority` (different!)

#### Akamai HTTP/2 String Format for curl_cffi

Real Chrome 124 example:
```
4:16777216|16711681|0|m,p,a,s
```

Breakdown:
- `4:16777216` = SETTINGS_INITIAL_WINDOW_SIZE:16777216 (16MB)
- `|16711681` = WINDOW_UPDATE value
- `|0` = no PRIORITY frames
- `|m,p,a,s` = pseudo-header order (:method, :path, :authority, :scheme)

Note: Chrome's pseudo-header order is actually `:method, :authority, :scheme, :path` (m,a,s,p) in most sources, but varies by Chrome version.

Tools that correctly spoof HTTP/2: curl_cffi (via `akamai=` parameter), azuretls-client, bogdanfinn/tls-client, primp.

---

### 5. TLS ClientHello Randomization in Chrome 108+

Starting with Chrome 108 (shipped with effect from Chrome 109, broadly January 2023):

- Chrome permutes TLS extension _order_ in every ClientHello
- ~15! ≈ 1.3 trillion possible orderings
- The `pre_shared_key` extension (required to be last by RFC 8446) remains fixed
- GREASE values are still inserted at random positions

**Effect on JA3**: Every connection produces a unique JA3 hash. JA3 is now useless for identifying "this is Chrome 120" with confidence.

**Effect on JA4**: Zero effect. JA4 sorts extensions before hashing. Chrome 120 always produces the same JA4 hash regardless of extension order.

**Effect on detection**: Akamai has moved to JA4 as the primary TLS signal. JA3 is still logged but primarily used for anomaly detection (e.g., a client that sends the SAME JA3 on every request is suspicious — real Chrome always varies).

**Implication for evasion tools**: Tools that impersonate Chrome should also randomize extension order to avoid the opposite problem (stable JA3 = bot signature). curl_cffi's `extra_fp.tls_permute_extensions = True` enables this.

---

### 6. GitHub Repos and Tools Specifically for TLS Evasion Against Akamai

| Repo | Language | Purpose | Notes |
|------|----------|---------|-------|
| [lexiforest/curl_cffi](https://github.com/lexiforest/curl_cffi) | Python/C | Python HTTP client with full TLS+H2 impersonation | Best all-round Python tool |
| [deedy5/primp](https://github.com/deedy5/primp) | Python/Rust | Fast Rust-backed impersonation | Fastest for pure HTTP scraping |
| [bogdanfinn/tls-client](https://github.com/bogdanfinn/tls-client) | Go + FFI | TLS+H2 spoof with Python/JS/C# bindings | Mature, widely used |
| [Noooste/azuretls-client](https://github.com/Noooste/azuretls-client) | Go | Auto Chrome fingerprint, H2 support | Chrome preset by default |
| [refraction-networking/utls](https://github.com/refraction-networking/utls) | Go | Foundation library for ClientHello mimicry | Building block |
| [Danny-Dasilva/CycleTLS](https://github.com/Danny-Dasilva/CycleTLS) | Go/JS | JA3/JA4R spoof | Node.js/Go pipelines |
| [enetx/surf](https://github.com/enetx/surf) | Go | Advanced HTTP client, JA3/JA4, HTTP/3 QUIC | Full-stack impersonation |
| [juzeon/spoofed-round-tripper](https://github.com/juzeon/spoofed-round-tripper) | Go | Wraps tls-client as http.RoundTripper | Use with any Go HTTP lib |
| [Hyper-Solutions/hyper-sdk-py](https://github.com/Hyper-Solutions/hyper-sdk-py) | Python | Akamai sensor data + _abck generation | No-browser sensor spoofing |
| [xvertile/akamai-bmp-generator](https://github.com/xvertile/akamai-bmp-generator) | Various | Akamai BMP sensor data generator | Open source sensor gen |
| [niespodd/browser-fingerprinting](https://github.com/niespodd/browser-fingerprinting) | Markdown | Anti-bot analysis + countermeasure guide | Reference document |
| [FoxIO-LLC/ja4](https://github.com/FoxIO-LLC/ja4) | Various | Official JA4+ spec and implementations | Understand what you're evading |
| [0x676e67/wreq-python (rnet)](https://github.com/0x676e67/rnet) | Python/Rust | Rust-based ergonomic HTTP client with TLS fingerprint | Alternative to primp |
| [zinzied/TLS-Chameleon](https://github.com/zinzied/TLS-Chameleon) | Python | Auto TLS spoofing + browser asset loading | Uses curl_cffi internally |

---

### 7. Whether zendriver/nodriver Can Control TLS Settings

**zendriver/nodriver cannot control TLS settings directly.** Here is the complete picture:

**What zendriver DOES provide (TLS perspective)**:
- Drives a real Chrome/Chromium binary via CDP
- Chrome generates authentic BoringSSL TLS ClientHello (correct JA4 for the Chrome version)
- Chrome sends correct HTTP/2 SETTINGS frames
- Passes JA3, JA4, and HTTP/2 fingerprint checks natively

**What zendriver CANNOT do**:
- Select specific cipher suites
- Control extension ordering (though Chrome randomizes this anyway since v108)
- Choose specific TLS extensions
- Modify SETTINGS frame values
- Control WINDOW_UPDATE values

**The key anti-detection features zendriver provides** (not TLS-related):
- Uses CDP instead of WebDriver protocol (no `navigator.webdriver = true`)
- Patches some headless browser detection signals
- Supports real Chrome user profiles and cookie persistence
- Allows JavaScript execution for sensor data compliance

**Critical proxy caveat**: If you route zendriver through an HTTPS-intercepting proxy (e.g., mitmproxy, some residential proxy providers that MITM), the TLS fingerprint seen by the target will be the _proxy's_ fingerprint, not Chrome's. Only proxies that operate at the TCP/SOCKS layer (SOCKS5, HTTP CONNECT tunneling) preserve the browser's TLS fingerprint.

**Success rate against Akamai**: Zendriver achieved ~75% success in comparative benchmarks against various anti-bot services. Real Chrome + residential proxy (SOCKS5) can push this higher. The remaining failures are typically due to Akamai's JavaScript sensor data challenges, not TLS.

---

### 8. Proxy Services That Handle TLS Fingerprint Masking

#### Tier 1: Managed Scraping APIs (Full Stack — Recommended)

These handle TLS, HTTP/2, sensor data, and behavior automatically:

| Service | Akamai Success Rate | TLS Approach | Notes |
|---------|-------------------|--------------|-------|
| **Scrapfly ASP** | ~98% | Matches real browser TLS | Best Akamai success rate in 2026 benchmark |
| **ZenRows** | High | Real browser + TLS spoof | Hybrid approach |
| **Bright Data Web Unlocker** | High | Scraping browser with TLS | 20,000+ customers |
| **Zyte API** | ~80% | 80.48 score in benchmark | Cost-effective |
| **Scrape.do** | ~81% | 81.43 score in benchmark | Good value |
| **ScrapingBee** | 32% | Failed at anti-bot sites | Acquired by Oxylabs 2025 |

#### Tier 2: Residential Proxy Networks (IP only — You handle TLS)

These provide residential IP rotation but do NOT handle TLS fingerprinting for you. You must use curl_cffi or similar alongside:

- **Bright Data Residential Proxies** — 175M+ IPs, most reliable
- **Oxylabs Residential** — 175M+ IPs, 99.95% uptime
- **Smartproxy (now Decodo)** — Rebranded 2025
- **IPRoyal**, **Proxy-Cheap** — Budget options

**Critical rule**: Use SOCKS5 proxies, not HTTP CONNECT with TLS interception. HTTP CONNECT tunneling (`CONNECT target.com:443`) preserves browser TLS. A proxy that decrypts and re-encrypts HTTPS will break your TLS fingerprint.

#### Tier 3: JA3Proxy (Self-hosted TLS Proxy)

**Concept**: Run JA3Proxy locally, point your scraper at it, chain it upstream to a residential proxy.

Architecture:
```
Your script (any HTTP lib)
  → localhost:port (JA3Proxy, Chrome 133 TLS fingerprint)
    → residential proxy
      → target site
```

Benefit: Works with ANY HTTP client (requests, httpx, curl). JA3Proxy handles TLS impersonation transparently.

Limitation: Addresses TLS and IP only. Does not solve JavaScript sensor data challenges.

---

## Akamai's Full Detection Stack (Practical Summary)

Akamai Bot Manager operates across five simultaneous layers. Understanding each helps prioritize your evasion strategy:

| Layer | What It Checks | Bypass Method |
|-------|---------------|---------------|
| **1. IP Reputation** | Datacenter vs residential, velocity, blacklists | Residential rotating proxies (SOCKS5) |
| **2. TLS Fingerprint** | JA4 hash, BoringSSL vs OpenSSL vs Go crypto | curl_cffi / real Chrome / primp |
| **3. HTTP/2 Fingerprint** | SETTINGS values, window size, header order | curl_cffi akamai= param / real Chrome |
| **4. JavaScript Sensor Data** | _abck cookie, device telemetry, canvas, WebGL | Real Chrome + correct behavior, or hyper-sdk |
| **5. Behavioral Analysis** | Mouse movements, click timing, scroll patterns | Human-like delays, real Chrome interaction |

For zendriver specifically: Layers 2 and 3 are handled automatically. Layers 1, 4, and 5 need explicit work.

---

## Practical Recommendations for zendriver + Akamai

### Option A: zendriver + SOCKS5 Residential Proxy (Simplest)

```python
import zendriver as zd
import asyncio

async def scrape():
    browser = await zd.start(
        browser_args=[
            "--proxy-server=socks5://user:pass@residential-proxy:port"
        ]
    )
    page = await browser.get("https://akamai-protected-site.com")
    # Chrome handles TLS natively; residential proxy handles IP
    content = await page.get_content()
    await browser.stop()
```

Requirements: Residential SOCKS5 proxy (Bright Data, Oxylabs, etc.)

### Option B: zendriver + curl_cffi for Static Resources

Use zendriver for pages requiring JavaScript execution and sensor data, use curl_cffi for static asset fetching or API calls (reusing session cookies from zendriver):

```python
from curl_cffi import requests as cffi_requests

# After getting cookies from zendriver session:
session = cffi_requests.Session(impersonate="chrome145")
session.cookies.update(zendriver_cookies)
response = session.get("https://api.target.com/data")
```

### Option C: Pure curl_cffi (No Browser, Highest Risk for Akamai)

Only works if Akamai's JavaScript challenge is absent or manageable:

```python
from curl_cffi import requests

session = requests.Session(impersonate="chrome145")

# Chrome 124-ish HTTP/2 fingerprint
AKAMAI_FP = "4:16777216|16711681|0|m,p,a,s"

resp = session.get(
    "https://target.com",
    akamai=AKAMAI_FP,
    extra_fp={
        "tls_grease": True,
        "tls_permute_extensions": True,  # Match Chrome 108+ behavior
        "tls_cert_compression": "brotli",
        "http2_stream_weight": 256,
        "http2_stream_exclusive": 1,
    },
    proxies={"https": "socks5://user:pass@residential:port"},
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "sec-ch-ua": '"Google Chrome";v="145", "Chromium";v="145", "Not?A_Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
    }
)
```

Failure mode: Akamai serves a JavaScript challenge page to generate `_abck`. curl_cffi cannot execute JavaScript.

### Option D: hyper-sdk-py for Sensor Data (Advanced)

If you need to bypass Akamai's JavaScript challenge without a real browser, use hyper-sdk to generate valid `_abck` sensor data:

```python
from hyper_sdk.akamai import SensorInput, generate_sensor_data

# Requires a hyper-solutions API key
input_data = SensorInput(...)
sensor_data, ctx = await session.generate_sensor_data(input_data)
# POST sensor_data to Akamai's sensor endpoint to get valid _abck cookie
```

---

## Comparative Analysis

| Tool | Language | TLS Spoof | HTTP/2 Spoof | JS Execution | Akamai Sensor | Speed | Complexity |
|------|----------|-----------|--------------|--------------|---------------|-------|------------|
| zendriver (real Chrome) | Python | Native (BoringSSL) | Native | Yes | Yes (browser) | Slow | Low |
| curl_cffi | Python | Yes (BoringSSL fork) | Yes (akamai= param) | No | No | Fast | Medium |
| primp | Python | Yes (Rust) | Yes | No | No | Fastest | Low |
| bogdanfinn/tls-client | Go/Python FFI | Yes (uTLS) | Yes | No | No | Fast | Medium |
| primp + hyper-sdk | Python | Yes | Yes | No | Partial | Fast | High |
| zendriver + residential SOCKS5 | Python | Native | Native | Yes | Yes | Slow | Low |
| Scrapfly ASP | API | Managed | Managed | Managed | Managed | Medium | Lowest |

---

## Sources

1. [lexiforest/curl_cffi GitHub](https://github.com/lexiforest/curl_cffi) — Main Python TLS impersonation library, README and docs
2. [curl_cffi impersonation targets](https://curl-cffi.readthedocs.io/en/latest/impersonate/targets.html) — Supported Chrome/Safari/Firefox versions
3. [curl_cffi customization docs](https://curl-cffi.readthedocs.io/en/latest/impersonate/customize.html) — JA3/akamai/extra_fp parameter reference
4. [FoxIO-LLC/ja4 Technical Details](https://github.com/FoxIO-LLC/ja4/blob/main/technical_details/JA4.md) — Official JA4 specification
5. [Fastly: Chrome's TLS ClientHello Permutation](https://www.fastly.com/blog/a-first-look-at-chromes-tls-clienthello-permutation-in-the-wild) — Chrome 108+ extension randomization analysis
6. [trickster.dev: HTTP/2 Fingerprinting](https://www.trickster.dev/post/understanding-http2-fingerprinting/) — SETTINGS frame technical breakdown
7. [Akamai Black Hat Whitepaper](https://blackhat.com/docs/eu-17/materials/eu-17-Shuster-Passive-Fingerprinting-Of-HTTP2-Clients-wp.pdf) — Original HTTP/2 fingerprinting research
8. [deedy5/primp GitHub](https://github.com/deedy5/primp) — Rust-backed Python impersonation client
9. [bogdanfinn/tls-client GitHub](https://github.com/bogdanfinn/tls-client) — Go TLS client with Python bindings
10. [refraction-networking/utls GitHub](https://github.com/refraction-networking/utls) — Foundational uTLS Go library
11. [Noooste/azuretls-client GitHub](https://github.com/Noooste/azuretls-client) — Auto-Chrome TLS Go client
12. [Danny-Dasilva/CycleTLS GitHub](https://github.com/Danny-Dasilva/CycleTLS) — JA4R spoof for Go/JS
13. [Hyper-Solutions/hyper-sdk-py GitHub](https://github.com/Hyper-Solutions/hyper-sdk-py) — Akamai sensor data generation
14. [HackerNoon: JA3Proxy](https://hackernoon.com/outsmarting-akamais-bot-detection-with-ja3proxy) — JA3Proxy chain technique
15. [The Web Scraping Club: Bypass Akamai by Chaining Proxies](https://substack.thewebscraping.club/p/bypass-akamai-bot-protection) — Proxy chain technique
16. [Scrapfly: How to Bypass Akamai 2026](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping) — Current best practices
17. [Browserless: TLS Fingerprinting in Playwright/Puppeteer](https://www.browserless.io/blog/tls-fingerprinting-explanation-detection-and-bypassing-it-in-playwright-and-puppeteer) — Real Chrome via CDP TLS analysis
18. [ScrapeOps: Smart Proxy Fingerprint Benchmark Jan 2026](https://scrapeops.io/proxy-providers/proxy-api-browser-fingerprint-benchmark/) — Provider comparison
19. [Akamai: Detection Methods (official docs)](https://techdocs.akamai.com/cloud-security/docs/detection-methods) — Official Akamai detection layer documentation
20. [cdpdriver/zendriver GitHub](https://github.com/cdpdriver/zendriver) — zendriver source and documentation
21. [niespodd/browser-fingerprinting GitHub](https://github.com/niespodd/browser-fingerprinting) — Anti-bot countermeasure analysis
22. [Cloudflare: JA3/JA4 Fingerprint Docs](https://developers.cloudflare.com/bots/additional-configurations/ja3-ja4-fingerprint/) — JA4 adoption reference

---

## Confidence Assessment

**High confidence** (verified across 3+ sources):
- JA4 normalizes/sorts extensions and ciphers before hashing, making extension permutation ineffective
- Chrome 108+ randomizes extension order; this breaks JA3 but not JA4
- CDP/zendriver cannot modify TLS settings at the BoringSSL layer
- Real Chrome via CDP produces authentic JA3/JA4/HTTP2 fingerprints
- curl_cffi `impersonate=` sets JA3+HTTP/2+headers to match real Chrome
- Akamai uses at minimum 5 detection layers; TLS is just one of them
- HTTPS-intercepting proxies break Chrome's TLS fingerprint; SOCKS5 preserves it

**Medium confidence** (1-2 sources):
- zendriver achieves ~75% success rate against anti-bot services broadly
- Scrapfly achieves ~98% Akamai bypass rate (self-reported)
- hyper-sdk-py can generate valid `_abck` sensor data without a browser
- Chrome's INITIAL_WINDOW_SIZE in HTTP/2 SETTINGS is 6,291,456 bytes (vs Python's 65,535)

**Low confidence / needs verification**:
- Exact Chrome 145 JA4 hash values (these change with each Chrome release)
- Whether zendriver specifically patches any HTTP/2 SETTINGS anomalies
- Whether Akamai uses JA4H (HTTP header fingerprint) in addition to JA4 TLS

---

## Information Gaps

- No public documentation on exactly which JA4 hashes Akamai whitelists/blacklists (this is internal to Akamai)
- The exact Akamai sensor data encryption algorithm (v3) is obfuscated; hyper-sdk handles it but is a paid service
- Whether BrightData's "Web Unlocker" product internally uses BoringSSL or certificate pinning bypass
- How zendriver handles HTTP/2 SETTINGS — whether the Chrome version it launches sends correct SETTINGS (likely yes, since it's real Chrome) but this was not confirmed in testing
- Exact JA4 values for Chrome 145 and current Firefox/Safari (would require running the tools against ja4er.com or similar test service)
- Whether Akamai's sensor data challenge can be bypassed by headless Chrome with the right behavioral simulation vs always requiring reverse-engineered sensor generation
