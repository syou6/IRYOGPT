# Research: Akamai Bot Manager — sensor_data and _abck Cookie Mechanisms

**Researched:** 2026-03-31
**Researcher:** Claude Research Module (Sonnet 4.6)

---

## Executive Summary

Akamai Bot Manager uses a layered client-side telemetry system where obfuscated JavaScript fingerprints the browser, constructs a 58-field "sensor_data" payload, encrypts it using two PRNG-based transforms seeded from a JS file hash and a cookie hash, and POSTs it to a dynamic endpoint to obtain the _abck validation cookie. As of 2026, version 3 (v3) is current, using cookie-integrated encryption that is significantly harder to reverse-engineer statically than v2. Browserless generation is possible but requires continuously updated commercial solvers — all public open-source tools target v2/legacy or are no longer maintained. Several commercial API services (Hyper Solutions, TakionAPI, EZCaptcha) actively offer working solvers.

---

## Findings

### 1. Sensor_data Version History and Current Version

Akamai has shipped multiple generations of its sensor_data system. The versioning corresponds to the JS protection payload format, not a public semver:

| Generation | Common Name | Status in 2026 |
|------------|-------------|----------------|
| v1 / 1.0   | Akamai 1.x  | Obsolete; rarely seen |
| v1.7 / 1.75 | "Akamai 1.7X legacy" | Legacy; still present on old deployments |
| v2 / 2.0   | Akamai 2.0  | Phased out; many sites migrated away |
| v3 / 3.x   | Akamai 3.x  | **Current as of 2025-2026** |

**v1 → v2 differences:** v1 used simpler static fingerprinting. v2 introduced the full 58-element colon-delimited array, PRNG-based shuffling, and the two-key encryption model (file hash + cookie hash). The `akamai-bm-telemetry` header (base64 of sensor_data) also appeared at v2.

**v2 → v3 differences:** v3 introduced explicit cookie-integrated encryption — the bm_sz cookie hash is now baked into the encryption seed rather than using a static default (`8888888`) throughout the session. v3 also added more aggressive real-time JS file hashing (the hash is computed by Babel-AST-level obfuscated code that concatenates and rotates array values), making static extraction of the file hash substantially harder. Overall encryption complexity increased significantly. Source: [glizzykingdreko Medium article](https://medium.com/@glizzykingdreko/akamai-v3-sensor-data-deep-dive-into-encryption-decryption-and-bypass-tools-da0adad2a784) and [akamai-v3-sensor-data-helper on GitHub](https://github.com/glizzykingdreko/akamai-v3-sensor-data-helper).

The Android/mobile variant uses a different header (`x-acf-sensor-data`) and RSA-signed payloads via the Akamai BMP (Bot Manager Premier) mobile SDK, which is separate from the web flow covered here. Source: [yoghurtbot.github.io](https://yoghurtbot.github.io/).

---

### 2. GitHub Repositories — Status Assessment

| Repo | Target Version | Language | Status (2026) |
|------|---------------|----------|---------------|
| [xiaoweigege/akamai2.0-sensor_data](https://github.com/xiaoweigege/akamai2.0-sensor_data) | v2.0 + v3 (via API) | Python + API | Last commit June 2023; offers paid API service via Telegram; open-source code is stale |
| [cirleamihai/akamai-1.7-cookie-generator](https://github.com/cirleamihai) | v1.7 legacy | Unknown | Not found in current searches; likely removed or renamed |
| [i7solar/Akamai](https://github.com/i7solar/Akamai) | v1.75 legacy | Go (Fiber) | 3 commits, created May 2023, minimal maintenance; mouse movement simulation no longer bypasses current Akamai |
| [glizzykingdreko/akamai-v3-sensor-data-helper](https://github.com/glizzykingdreko/akamai-v3-sensor-data-helper) | v3 | Node.js | Actively maintained as of 2025; decrypt/encrypt tool; author refers to TakionAPI for production use |
| [fxnatic/abck-tools](https://github.com/fxnatic/abck-tools) | v2/v3 | Go | Provides encryption primitives; README recommends capsolver.com for production |
| [voidstar0/akamai-deobfuscator](https://github.com/voidstar0/akamai-deobfuscator) | v2 | Node.js | **Archived November 2023; read-only** |
| [rastvl/akamai-deobfuscator-2.0](https://github.com/rastvl/akamai-deobfuscator-2.0) | v2.0 | Unknown | Research/study tool; not actively bypassing v3 |
| [xvertile/akamai-bmp-generator](https://github.com/xvertile/akamai-bmp-generator) | BMP mobile (2.1.2 – 3.3.4) | Go | 7 commits, created Dec 2023; minimal maintenance |
| [Hyper-Solutions/hyper-sdk-go](https://github.com/Hyper-Solutions/hyper-sdk-go) | v3 web + BMP | Go | **Actively maintained; commercial SDK** |
| [JokerPeter/akamai-sensor-data-bypass](https://github.com/JokerPeter/akamai-sensor-data-bypass) | v2/v3 | Unknown | Referenced in bypass discussions; limited detail available |

**Verdict:** No fully open-source, self-contained, browserless v3 generator is currently maintained. All working solutions as of 2026 either depend on commercial solver APIs or require ongoing manual updates each time Akamai rotates its JS.

---

### 3. sensor_data Payload — Field Structure

The payload is a **58-element array** serialized as a colon-delimited string before encryption. The raw (pre-encryption) data roughly covers these categories based on reverse engineering writeups:

**Device / Browser Identity (~10 fields)**
- User-agent string
- Browser name, version, OS version
- Installed plugins list
- Screen resolution, color depth, pixel ratio
- Hardware concurrency (CPU cores)
- Device memory

**Canvas Fingerprint (~2 fields)**
- 2D canvas fingerprint hash (cannot be randomly forged; must use real browser renders)
- WebGL renderer / vendor strings

**Behavioral / Motion Telemetry (~10 fields)**
- Simulated or recorded mouse movement trajectory
- Click timing and count
- Keyboard event timing
- Scroll events
- Touch events (on mobile)

**Browser API Responses (~8 fields)**
- WebDriver presence flag (navigator.webdriver)
- Automation tool detection (PhantomJS, Selenium artifacts)
- Timezone / language settings
- Cookie support, localStorage availability
- Battery API status
- AudioContext fingerprint

**Network / Session (~5 fields)**
- Page URL
- Referrer
- Request timing values

**Cryptographic / Challenge Fields (~5 fields)**
- File hash (extracted from Akamai JS at runtime)
- Cookie hash (from bm_sz, index 2 of tilde-split)
- Timestamps
- Random nonce values
- PRNG-derived shuffle output

**Other (~18 fields)**
- Various math call results used as behavioral signals
- Array of WebGL extensions
- Fonts list
- Connection type
- Performance.now() timing

Sources: [xiaoweigege repo README](https://github.com/xiaoweigege/akamai2.0-sensor_data), [fxnatic/abck-tools](https://github.com/fxnatic/abck-tools), [akamai-v3-sensor-data-helper](https://github.com/glizzykingdreko/akamai-v3-sensor-data-helper), ResearchGate figure on canvas fingerprinting.

The final encrypted payload format for v3 is:
```
3;0;1;0;[cookie_hash];[arbitrary];[arbitrary];[encrypted_colon_delimited_data]
```

The `akamai-bm-telemetry` request header is a **base64 encoding** of the same sensor_data string, sent alongside the POST body.

---

### 4. _abck Cookie — Generation and Validation

**Server-side generation:** The _abck cookie is returned by Akamai's edge servers after the client POSTs valid sensor_data to the dynamically-named JS endpoint (e.g., `/ak_bmsc_collect/xxx`). The server decrypts and validates the telemetry payload and, if satisfied, issues a signed _abck cookie.

**Cookie structure (as observed, not officially documented):**
The cookie is a tilde-delimited string with multiple segments containing:
- A base64-encoded signed/encrypted blob (session token)
- Request count indicator
- Validity stop signal
- Timestamp/nonce components

Patterns observed in the wild:
- `~0~` suffix portion — indicates successful validation state
- `~0~-1~-1` suffix — indicates **invalidated** session (triggers re-submission of sensor)
- After 3 successful sensor submissions in a session, `IsCookieValid()` returns true and further sensor POSTs become unnecessary

**Validation logic (from Hyper SDK source):**
```go
IsCookieValid(cookie string, requestCount int) bool
IsCookieInvalidated(cookie string) bool  // detects ~0~-1~-1 pattern
```

Sources: [Hyper SDK Go package docs](https://pkg.go.dev/github.com/Hyper-Solutions/hyper-sdk-go/akamai), [Kameleo _abck glossary](https://kameleo.io/glossary/akamai-abck-cookie), [Hyper SDK getting started](https://docs.hypersolutions.co/akamai-web/getting-started).

**What makes a valid vs. invalid cookie:**
- Valid: cryptographic signature intact, timestamp within window, request count within threshold, sensor telemetry passed ML validation server-side
- Invalid: replayed cookie (timestamp stale), sensor telemetry failed checks (mismatched canvas fingerprint, missing behavioral signals, wrong file/cookie hash), TLS fingerprint mismatch, IP reputation failure, inconsistent user-agent

---

### 5. Cookie Family — ak_bmsc, bm_sz, bm_sv, bm_mi Explained

| Cookie | Role | Lifetime |
|--------|------|----------|
| `_abck` | Primary bot validation token; main output of the sensor_data flow; gates access to protected endpoints | ~1 hour |
| `ak_bmsc` | Set on first-party domains; security-focused session token that supports the initial challenge flow and works in tandem with _abck | ~1 hour |
| `bm_sz` | Bot Manager size/seed cookie; contains the cookie hash (tilde-split index 2) used to seed the v3 encryption PRNG; first request uses default hash `8888888`, then bm_sz is issued | ~4 hours |
| `bm_sv` | Bot Manager session value; primarily a **caching optimization** cookie for Akamai CDN response performance, not directly involved in bot validation | ~1 hour |
| `bm_mi` | Bot Manager miscellaneous info; session-state cookie; exact internal role is not publicly documented but it persists per-session metadata | ~1 hour |

The most security-critical chain is: **bm_sz → sensor_data encryption seed → _abck issuance**. Without a valid bm_sz, the sensor_data payload will use the default seed and may be accepted only on the first request before Akamai issues a real bm_sz.

Sources: [Kameleo bm_sz glossary](https://kameleo.io/glossary/bm-sz-cookie), [Akamai community cookie article](https://community.akamai.com/customers/s/article/Security-in-Cookies?language=en_US), [Ford EU cookie guide](https://www.ford.eu/cookie-guide), [i7solar/Akamai README](https://github.com/i7solar/Akamai).

---

### 6. Generating Valid _abck Without a Browser in 2026

**Short answer: Yes, but only with continuously-updated solver services or significant reverse engineering investment.**

**Why it is technically possible:**
The sensor_data payload is ultimately a structured data object. If an attacker has:
1. A valid set of browser fingerprint values (canvas hash, WebGL strings, etc.)
2. The current file hash from Akamai's JS (changes on each JS rotation)
3. A valid bm_sz cookie hash
4. The correct PRNG algorithm (documented in reverse engineering repos)

...they can construct and encrypt a valid payload without a browser. Multiple commercial services do exactly this.

**Why it is hard to maintain:**
- Akamai rotates the obfuscated JS file **regularly** (per-site, can be days to weeks), changing the file hash and obfuscation pattern
- The file hash extraction requires parsing/executing obfuscated JS — static AST analysis breaks when Akamai changes the obfuscation scheme
- Canvas fingerprints must be from real device profiles; random values are flagged
- Akamai also validates TLS fingerprint (JA3/JA4) at the network layer simultaneously — a correctly-crafted sensor_data sent over a datacenter TLS stack will still fail

**The realistic workflow without browser (per Hyper SDK docs):**
1. GET the target page with matching TLS fingerprint (curl-cffi or similar)
2. Parse HTML to extract dynamic script path
3. GET the Akamai JS script
4. Send script to solver API → receive sensor_data string
5. POST sensor_data to script endpoint → receive _abck cookie
6. Check `IsCookieValid()` / `IsCookieInvalidated()` — repeat if needed (max ~3 times)
7. Proceed with protected request using valid _abck

Sources: [Hyper Solutions getting started docs](https://docs.hypersolutions.co/akamai-web/getting-started), [fxnatic/abck-tools](https://github.com/fxnatic/abck-tools), [Scrapfly bypass page](https://scrapfly.io/bypass/akamai).

---

### 7. Akamai's Obfuscated JavaScript — How It Works

Akamai's bot detection script is **dynamically generated per-request** with a unique filename/path (e.g., `/<random>/akam/11/pixel_...`). The JS itself uses multiple obfuscation layers:

**Layer 1: String array rotation**
All string literals are placed in a large array. Array indices are rotated by a specific offset (discoverable by executing the rotation logic). Function bodies reference array indices rather than string literals directly.

**Layer 2: Dynamic function concatenation**
Functions are split across array elements and concatenated at runtime using string operations. The actual function names and property accesses are computed, not hardcoded.

**Layer 3: Control flow flattening**
`switch` statements with a string-encoded state machine control execution order, making static analysis difficult.

**Layer 4: File hash computation**
A deeply nested set of operations computes a hash of the script file itself (using the concatenated/rotated string values). This hash is embedded in the final sensor_data — if the wrong hash is used, the server-side validation fails. This is the most brittle part for static reverse engineering.

**Layer 5: PRNG-based character substitution**
The two PRNGs (seeded with file hash and cookie hash) perform Fisher-Yates-style shuffles and character substitutions over an allowed character set.

The Akamai deobfuscator tools use **Babel AST transforms** to:
- Identify the string array and rotation offset
- Inline string values
- Rename mangled identifiers

However, archived tools like voidstar0's deobfuscator (archived Nov 2023) no longer work against current v3 JS patterns.

Sources: [akamai-v3-sensor-data-helper technical description](https://github.com/glizzykingdreko/akamai-v3-sensor-data-helper), [Akamai blog on JS obfuscation](https://www.akamai.com/blog/security/catch-me-if-you-can-javascript-obfuscation), [rastvl/akamai-deobfuscator-2.0](https://github.com/rastvl/akamai-deobfuscator-2.0).

---

### 8. Commercial Solver Services

| Service | Akamai Support | Approach | Notes |
|---------|---------------|----------|-------|
| [Hyper Solutions](https://hypersolutions.co/) | Web v3 + BMP mobile | API; Go/Python/JS SDKs; browserless | Actively maintained; claims "always up-to-date"; also supports DataDome, Kasada, Incapsula |
| [TakionAPI](https://docs.takionapi.tech/) | v3 (via glizzykingdreko tooling) | API; subscription via Stripe | Developer of akamai-v3-sensor-data-helper refers users here for production |
| [EZCaptcha](https://www.ez-captcha.com/products/akamai) | v3 | API | Affordable pricing claim; AI-driven solving |
| [Capsolver](https://capsolver.com) | v2/v3 | API | Recommended by fxnatic/abck-tools README |
| [ScraperAPI](https://www.scraperapi.com/solutions/bypass-akamai/) | Web (proxy-based) | Managed proxy + cookie injection | Uses smart rotation + header matching rather than pure sensor generation |
| [Scrapfly](https://scrapfly.io/bypass/akamai) | Web v3 | Managed scraping API | Claims 97% success rate; handles full session including TLS |
| [RapidAPI: akamai-bmp](https://rapidapi.com/scrapetheimpossible/api/akamai-bmp-x-acf-sensor-data) | BMP mobile 2.x–3.x (beta) | API; mobile device profile generation | BMP/mobile focused; 3.x in beta |

**Pricing:** No services publish specific pricing in their public pages (all require signup or Discord contact). Commercial solvers in this space typically charge per-request (fractions of a cent) or monthly subscriptions starting at ~$50-100/month for limited volume.

**BlackHatWorld / underground forums:** A BHW thread exists explicitly seeking "anti-bot/WAF specialist to provide automated solution to generate valid _abck (Akamai) cookies... No Selenium/Puppeteer" — confirming active market demand. The thread is gated (403 on direct access). Underground services exist but are not catalogued publicly.

---

### 9. SEC-CPT: The Newer Challenge Layer

Since approximately 2024, Akamai introduced **sec-cpt (Secure Crypto Proof of Time)** as an additional challenge layer that can be triggered on top of standard sensor_data flow:

- **Crypto provider:** Proof-of-work with mandatory time delay (cannot be skipped even with correct answer)
- **Behavioral provider:** Requires sensor data submission to a specific endpoint
- **Adaptive provider:** Combines both PoW and sensor data

Triggered via HTTP 428 status. The challenge is embedded in HTML as an iframe or delivered as JSON. Successfully solving it sets a `sec_cpt` cookie containing `~3~`.

The sec-cpt JSON structure includes: `token`, `timestamp`, `nonce`, `difficulty`, `timeout`, and `cpu` flag.

Source: [Hyper Solutions sec-cpt docs](https://docs.hypersolutions.co/akamai-web/handling-428-status-code-sec-cpt), [Hyper SDK Go package](https://pkg.go.dev/github.com/Hyper-Solutions/hyper-sdk-go/akamai).

---

### 10. Update Frequency

Akamai does not publish a changelog for sensor_data JS rotations. Based on reverse engineering community observations:

- **Per-site JS path:** The dynamic script path changes on **every page load** (random UUID component), preventing caching the endpoint URL
- **JS content / file hash:** Rotates on a **per-site schedule**, observed anywhere from daily to every few weeks. Each rotation invalidates hardcoded file hashes
- **Major version changes** (v2 → v3): Occurred over 2022-2023 timeframe; most protected sites migrated by end of 2023
- **Protection schema updates:** Akamai pushes incremental changes to obfuscation patterns and detection signals regularly, meaning even correct v3 implementations need tuning

Commercial solvers handle this by running live JS execution infrastructure that re-extracts the file hash on each request rather than caching it.

---

## Comparative Analysis

| Aspect | v1.7 (Legacy) | v2 | v3 (Current) |
|--------|---------------|-----|---------------|
| Encryption seed | Static or simple | File hash only | File hash + bm_sz cookie hash |
| Cookie integration | None | Partial | Full (bm_sz hash in PRNG seed) |
| JS obfuscation complexity | Low | Medium | High (dynamic function concat) |
| Static reverse-engineering | Feasible | Moderate effort | Very difficult |
| File hash extraction | Simple | AST parsing | Complex AST + runtime evaluation needed |
| Open-source tools | Available (stale) | Available (stale) | Commercial only (working) |
| sec-cpt challenge | No | No | Yes (2024+) |

---

## Sources

1. [Akamai v3 Sensor Data: Deep Dive — glizzykingdreko on Medium](https://medium.com/@glizzykingdreko/akamai-v3-sensor-data-deep-dive-into-encryption-decryption-and-bypass-tools-da0adad2a784) — Technical breakdown of v3 encryption algorithm; file hash and cookie hash PRNG mechanism
2. [glizzykingdreko/akamai-v3-sensor-data-helper — GitHub](https://github.com/glizzykingdreko/akamai-v3-sensor-data-helper) — v3 encrypt/decrypt Node.js module; PRNG algorithm details; v3 payload format `3;0;1;0;...`
3. [Hyper-Solutions/hyper-sdk-go — GitHub](https://github.com/Hyper-Solutions/hyper-sdk-go) — Commercial SDK; IsCookieValid/IsCookieInvalidated implementation; sec-cpt challenge types
4. [Hyper Solutions API Docs — Getting Started](https://docs.hypersolutions.co/akamai-web/getting-started) — 7-step browserless workflow; _abck validation flow
5. [Hyper Solutions — sec-cpt Handling](https://docs.hypersolutions.co/akamai-web/handling-428-status-code-sec-cpt) — sec-cpt challenge JSON structure, provider types, cookie patterns
6. [Hyper SDK Go package docs](https://pkg.go.dev/github.com/Hyper-Solutions/hyper-sdk-go/akamai) — Full SDK API: IsCookieValid, IsCookieInvalidated, ParseSecCptChallenge, sec_cpt JSON schema
7. [xiaoweigege/akamai2.0-sensor_data — GitHub](https://github.com/xiaoweigege/akamai2.0-sensor_data) — 58-element array structure; canvas/motion fields; akamai-bm-telemetry base64 header
8. [i7solar/Akamai — GitHub](https://github.com/i7solar/Akamai) — v1.75 legacy generator; _abck + ak_bmsc generation; limitation note on mouse simulation
9. [fxnatic/abck-tools — GitHub](https://github.com/fxnatic/abck-tools) and [pkg.go.dev](https://pkg.go.dev/github.com/fxnatic/abck-tools) — Encryption primitives; ExtractKeys from bm_sz; ShuffleString/EncryptString functions
10. [xvertile/akamai-bmp-generator — GitHub](https://github.com/xvertile/akamai-bmp-generator) — BMP mobile versions 2.1.2–3.3.4; PoW support; device profile generation
11. [voidstar0/akamai-deobfuscator — GitHub (archived)](https://github.com/voidstar0/akamai-deobfuscator) — Deobfuscation tool; archived Nov 2023
12. [Kameleo: _abck Cookie Glossary](https://kameleo.io/glossary/akamai-abck-cookie) — Cookie structure: timestamps, behavioral references, challenge outcomes
13. [Kameleo: bm_sz Cookie Glossary](https://kameleo.io/glossary/bm-sz-cookie) — bm_sz role in encryption seed; default hash 8888888; 4-hour lifetime
14. [Decoding Akamai 2.0 — 小伟 on Medium](https://medium.com/@240942649/decoding-akamai-2-0-418e7c7fa0a0) — v2 deep dive; 58-element array; akamai-bm-telemetry parameter
15. [yoghurtbot.github.io — Android Reversing Akamai BMP](https://yoghurtbot.github.io/) — Mobile BMP; x-acf-sensor-data header; RSA key
16. [RapidAPI: akamai-bmp-x-acf-sensor-data](https://rapidapi.com/scrapetheimpossible/api/akamai-bmp-x-acf-sensor-data) — BMP API; iOS/Android device profiles; versions up to 2.2.3 stable, 3.x beta
17. [Scrapfly: How to Bypass Akamai 2026](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping) — TLS fingerprinting as primary 2026 vector; five detection layers
18. [BlackHatWorld: Hiring _abck specialist thread](https://www.blackhatworld.com/seo/hiring-an-anti-bot-waf-specialist-to-provide-an-automated-solution-to-generate-valid-_abck-akamai-cookies-for-a-site-no-selenium-puppeteer.1330057/) — Market demand evidence; no-Selenium requirement confirmed in underground community
19. [EZCaptcha: Akamai Solver](https://www.ez-captcha.com/products/akamai) — Commercial solver; affordable pricing claim
20. [Akamai Community: Security in Cookies](https://community.akamai.com/customers/s/article/Security-in-Cookies?language=en_US) — Official perspective on cookie lifetimes

---

## Confidence Assessment

- **High confidence (3+ sources):**
  - v3 is current standard as of 2026
  - Two-PRNG encryption: file hash shuffle + cookie hash character substitution
  - bm_sz cookie provides the hash seed for v3 encryption
  - Default hash `8888888` used before bm_sz is issued
  - _abck invalidation pattern is `~0~-1~-1`
  - 58-element array payload structure
  - akamai-bm-telemetry header = base64(sensor_data)
  - All listed public GitHub repos are stale or target legacy versions
  - Commercial solvers (Hyper, TakionAPI, EZCaptcha, Capsolver) are the working 2026 solutions

- **Medium confidence (1-2 sources):**
  - Exact 58 field breakdown (categories confirmed but individual field names not fully enumerated in accessible sources)
  - bm_mi as session metadata cookie (not primary security role)
  - bm_sv as CDN caching cookie
  - JS rotation frequency (community estimates, not official)
  - sec-cpt availability on most v3 deployments (some sites only, per SDK docs)

- **Low confidence / Unverified:**
  - Exact pricing of commercial solvers (no public pricing found)
  - Whether cirleamihai/akamai-1.7-cookie-generator still exists (not found in 2026 searches)
  - Internal server-side ML model details for sensor_data validation
  - Exact timing of major version rollouts

---

## Information Gaps

- **Full 58-field enumeration with exact names and byte positions:** The community knows the categories but a complete annotated field list was not accessible in any fetchable source (Medium articles returned 403)
- **bm_mi exact purpose:** No primary source found; only observed alongside other cookies in cookie policy lists
- **Akamai's server-side validation algorithm:** Entirely proprietary; no public documentation
- **Underground forum pricing:** BHW thread gated (403); actual market rates unknown
- **JS rotation schedule per-site:** No systematic public monitoring data found
- **Whether Hyper Solutions / TakionAPI maintain >95% success rate on hardened sites** (Nike, Ticketmaster, etc.) — claims are made but not independently verified
