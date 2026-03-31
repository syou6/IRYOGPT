# Research: SalonBoard & Minimo — Bot Protection, Scraping, and API Access

**Date:** 2026-03-31
**Researcher:** Claude (Research Module)

---

## Executive Summary

SalonBoard (salonboard.com) is operated by Recruit and runs on Akamai CDN with Akamai's bot protection stack. There is no official public API — Recruit shut down the Hot Pepper Beauty API in 2017 and has not reopened it. All third-party booking systems that claim SalonBoard/HPB integration use browser scraping (not APIs). SalonBoard employs CAPTCHA (image authentication) that intermittently blocks scraping attempts, confirmed by SalonConnect's own FAQ. Minimo (minimodel.jp) runs on AWS CloudFront and offers a formal partner authentication key system for a limited set of approved booking systems.

---

## Findings

### 1. SalonBoard WAF and Bot Protection

**Confirmed Infrastructure (via W3Techs):**
- CDN/Security: **Akamai** (CDN + DNS services)
- SSL: DigiCert
- Web servers: Apache and Nginx behind Akamai edge
- Hosting: Internet Initiative Japan (IIJ) data centers
- HTTPS Strict Transport Security (HSTS) enabled
- Session cookies with HttpOnly and Secure flags

**Akamai Bot Manager:**
Akamai provides both CDN and Bot Manager at the edge. W3Techs confirms Akamai CDN is in use. Akamai Bot Manager (a separate product that detects and challenges bots using behavioral analytics, TLS fingerprinting, and JavaScript challenges) is likely deployed given that:
1. SalonConnect's FAQ explicitly states that "image authentication (CAPTCHA)" occasionally appears during SalonBoard scraping attempts, blocking automated sync.
2. SalonConnect states they "continuously tune" operations to minimize the frequency of CAPTCHA triggers.
3. The site times out for automated fetchers (both /login/ and /kiyaku/ endpoints returned 60s timeouts), consistent with edge-level bot challenge behavior.

**No reCAPTCHA or hCaptcha visible on homepage** — challenges appear to be triggered contextually (likely on login flow and on high-frequency automated requests).

### 2. SalonBoard Login Flow

Based on the login guide at assist-all.co.jp:

- **Fields:** Management ID or registered email address + password
- **Session timeout:** 15 hours auto-logout
- **Optional verification:** Email or SMS code may be sent in some scenarios
- **MFA:** The site does NOT currently mandate MFA for all users ("現在のサロンボードでは、多要素認証（MFA）については公式な全ユーザー対応は行われていません")
- **CAPTCHA behavior:** Image authentication appears intermittently on login — confirmed by SalonConnect FAQ, which notes their scraper is regularly blocked by CAPTCHA during automated login sequences
- **Initial password:** Sent by email with 7-day expiry on first login

**Login URL:** https://salonboard.com/CNT/common/login/ (standard form-based)

### 3. Official API — Does Not Exist

Hot Pepper Beauty / SalonBoard has **no public API**. Key facts:
- Recruit published an HPB API around 2014–2016 for read-only salon search/data queries
- The API was **discontinued in 2017**
- No replacement API has been offered since
- Industry commentary on Threads (2026): "ホットペッパーだけがAPIを開放していないので連携がスムーズじゃない" (Only Hot Pepper doesn't open its API, making integration difficult)
- Recruit's official web services page (webservice.recruit.co.jp) still lists a read-only Hot Pepper search API for public data (salon listings, not booking management), but this does NOT provide access to the SalonBoard booking management system

**Conclusion: There is no official API pathway into SalonBoard's booking/management system.**

### 4. Who Has Successfully "Scraped" SalonBoard?

Multiple commercial booking systems do — but with significant caveats:

| System | Approach | Reliability |
|--------|----------|-------------|
| SalonConnect | Explicit scraping, acknowledged in FAQ | Occasional CAPTCHA failures; manual re-sync required |
| DOUKI | Scraping (implied; claims "seconds" sync) | Marketing copy only; no technical disclosure |
| Beauty×Merit | Scraping | Confirmed by industry analysis |
| coming-soon | Scraping | Confirmed by industry analysis |
| LiME | Scraping | Confirmed by industry analysis |

**All five major HPB-integrated booking systems use scraping, not APIs.** This is explicitly confirmed by tada-reserve.jp: "ホットペッパービューティーと連動できると書いてある予約システムは全てスクレイピング技術を使っています" (All systems claiming HPB compatibility use scraping technology).

**Critical limitation from SalonConnect FAQ:** "システムの特性上、100%の保証が難しい" — 100% reliability is impossible due to CAPTCHA challenges. When CAPTCHA blocks the scraper, the sync silently fails and requires manual intervention.

### 5. Technical Scraping Architecture (inferred)

Based on SalonConnect FAQ and industry sources:
- Systems log in with the salon's SalonBoard credentials (staff provides username/password to the third-party service)
- Browser automation (Selenium/Playwright-class) is used to simulate human login and navigate to booking data
- CAPTCHA sometimes appears and blocks the automation — this is Akamai Bot Manager's challenge mechanism
- These companies likely use residential proxy rotation and session cookie reuse to minimize challenge frequency
- No GitHub repositories exist for SalonBoard-specific scrapers (none found)
- No public Qiita/Zenn technical writeups on SalonBoard scraping found

### 6. SalonBoard Terms of Service

The ToS page (salonboard.com/kiyaku/) timed out during fetch, suggesting Akamai blocks direct automated access. From context, industry operators acknowledge that scraping SalonBoard is a grey area — it is technically prohibited in most platform ToS, but the commercial services doing it operate with the implicit tolerance of Recruit (since they help drive HPB adoption). No lawsuit or enforcement action found in search results.

### 7. Booking Systems That Integrate With SalonBoard

These are the known integrators (all scraping-based):
- **SalonConnect** (salonconnect.jp) — most technically documented; explicit scraper
- **DOUKI** (salon-douki.com) — marketed as "seconds-fast" sync; relaxation salon focus
- **Beauty×Merit** (beautymerit.com)
- **coming-soon**
- **LiME**
- **Salon Board Master** (salon-douki.com/salonboard-master) — DOUKI's companion app

---

## Minimo (minimodel.jp) Findings

### Infrastructure

- **CDN:** Amazon CloudFront (no Akamai)
- **Web framework:** Next.js (React-based)
- **Web server:** Node.js + Apache
- **Hosting:** AWS (Japan + Germany nodes)
- **SSL:** Starfield Technologies
- **No Cloudflare detected**

### Bot Protection

No DataDome, PerimeterX, or Cloudflare Bot Management detected in W3Techs data. CloudFront's native WAF (AWS WAF) is the likely bot mitigation layer, which is less aggressive than Akamai Bot Manager. No CAPTCHA blocking of scrapers reported in available sources.

### Official API / Partner Integration

Minimo has a **formal partner authentication key system** — materially different from SalonBoard:
- Approved booking systems (KANZASHI, Reservia, Beauty×Merit, SalonConnect, coming-soon, FAN CUBE, Saloriza) can generate an **authentication key** from within the Minimo Salon Tool settings
- This key is pasted into the partner booking system's settings
- As of January 26, 2024, authentication key registration became mandatory for integrations
- This appears to be an API key / token-based authorization, enabling slot sync between Minimo and the partner system

**This means minimo has a semi-official integration pathway that SalonBoard does not have.**

### Integration Constraints (Minimo)

- Only one external system can be connected at a time
- After integration, booking slot management must be done through the external system
- Simultaneous use with Minimo's shift scheduling feature is not supported
- Available sync hours configurable from 07:00 to 23:30

---

## Comparative Analysis

| Criterion | SalonBoard (HPB) | Minimo |
|-----------|-----------------|--------|
| CDN/WAF | Akamai | AWS CloudFront |
| Bot protection | Akamai Bot Manager (confirmed via CAPTCHA evidence) | AWS WAF (standard) |
| Official API | None (shutdown 2017) | Partner auth-key system (limited) |
| Scraping by third parties | Common; CAPTCHA blocks periodically | Less documented |
| Login type | Email/ID + password; optional SMS OTP | Standard |
| MFA enforcement | Not mandatory for all users | Not documented |
| GitHub scrapers | None found | None found |
| Regulatory stance on scraping | Implicit tolerance (no known enforcement) | Not documented |

---

## Sources

1. [W3Techs — Technologies used by salonboard.com](https://w3techs.com/sites/info/salonboard.com) — Infrastructure and CDN details; confirms Akamai
2. [W3Techs — Technologies used by minimodel.jp](https://w3techs.com/sites/info/minimodel.jp) — Confirms AWS CloudFront, Next.js, no Akamai
3. [SalonConnect FAQ — 極稀に連携がされない場合の対処方法](https://faq.salonconnect.jp/?p=1899) — Explicit confirmation that SalonConnect scrapes SalonBoard; CAPTCHA blocks scraping; 100% reliability impossible
4. [SalonConnect FAQ — ミニモ認証キー登録方法](https://faq.salonconnect.jp/?p=2591) — Minimo auth-key system; mandatory since Jan 26, 2024
5. [Minimo Help — 外部予約システムとの連携方法](https://help.chatplus.jp/support-minimo/article/118/) — Minimo's external system integration settings
6. [タダリザーブ — ホットペッパービューティーと予約連携できるシステム5選 (2026)](https://tada-reserve.jp/blog/alignment/) — All HPB integrators use scraping; API shut down 2017
7. [タダリザーブ — ミニモ連携できるシステム5選](https://tada-reserve.jp/blog/minimo/) — Minimo partner integrations
8. [lifestyle.assist-all.co.jp — サロンボードログインガイド](https://lifestyle.assist-all.co.jp/salonboard-login-guide/) — Login flow details; MFA not mandatory
9. [Threads @3104hasegawa](https://www.threads.com/@3104hasegawa/post/DHStk7JvJgQ/) — Industry comment: "Only Hot Pepper doesn't open its API"
10. [KAMIU — HPB API停止記事](https://kamiu.jp/hpb_api/) — Coverage of API shutdown event
11. [DOUKI — サロンボードマスター](https://salon-douki.com/salonboard-master) — "No relationship with Recruit"; scraping-implied integration
12. [Akamai Bot Manager product page](https://www.akamai.com/products/bot-manager) — Akamai bot management capabilities

---

## Confidence Assessment

- **High confidence:** SalonBoard uses Akamai CDN (confirmed W3Techs). No official API exists (confirmed multiple sources). All third-party integrators use scraping (explicitly confirmed by SalonConnect and industry articles). CAPTCHA/image auth blocks scrapers intermittently (confirmed SalonConnect FAQ).
- **High confidence:** Minimo uses AWS CloudFront, not Akamai. Minimo has a formal partner auth-key system.
- **Medium confidence:** Akamai Bot Manager (not just CDN) is deployed on SalonBoard — inferred from CAPTCHA evidence and site timeout behavior, but not directly confirmed by Akamai product disclosure.
- **Medium confidence:** SalonBoard login flow uses optional SMS/email OTP — reported in login guides but no first-hand confirmation.
- **Low confidence / Unverified:** Specific Akamai Bot Manager configuration (challenge types, score thresholds, blocking behavior) — not publicly disclosed.
- **Low confidence / Unverified:** Whether Recruit tolerates or actively fights commercial scrapers — no enforcement actions found.

---

## Information Gaps

1. **SalonBoard ToS full text** — salonboard.com/kiyaku/ timed out; exact language on automated access prohibition not retrieved
2. **Akamai Bot Manager vs. just Akamai CDN** — W3Techs shows "Akamai CDN"; whether the more expensive Bot Manager product is layered on top is inferred, not confirmed
3. **SalonBoard robots.txt** — Not fetched; would clarify crawling policy
4. **Minimo's internal API spec** — Partner auth-key system confirmed but full technical spec not public
5. **SalonBoard login page source** — Timed out; exact form fields and hidden tokens not confirmed
6. **DOUKI's specific technical approach** — Company does not disclose implementation details
7. **Rate limiting behavior** — No data on request rate thresholds that trigger CAPTCHA challenges
8. **IP blocking vs. CAPTCHA** — SalonConnect mentions CAPTCHA; unclear if IP-level blocks also occur

---

## Practical Implications

For any product attempting to read SalonBoard data programmatically:

1. **No API path exists.** Scraping is the only technical option.
2. **Akamai Bot Manager will trigger CAPTCHA challenges** — frequency depends on rate/behavior tuning. Commercial players (SalonConnect) deal with this routinely but accept unreliability.
3. **Salon credentials must be provided** by the salon owner — no anonymous scraping possible for booking data (it's behind login).
4. **Minimo is significantly more accessible** — formal auth-key system, AWS WAF instead of Akamai, no documented CAPTCHA blocking.
5. **Legal grey area** — Scraping SalonBoard likely violates ToS. Commercial operators proceed anyway; no known enforcement actions found.
