# Research: SalonConnect / DOUKI / coming-soon Technical Deep Dive

## Executive Summary

All HPB/SalonBoard reservation integration services — SalonConnect, DOUKI, coming-soon, and every other vendor claiming HPB compatibility — use **web scraping, not an official API**. Recruit/HPB killed their public API in 2017 and have never restored it. SalonConnect's own FAQ explicitly states: "スクレイピングによる同期を行っており、100%の保証が難しい" (sync via scraping, 100% reliability cannot be guaranteed). DOUKI is a one-person indie operation run by an active salon owner, built on a modern TypeScript/Turborepo monorepo with Pub/Sub triggered sync achieving ~7-second latency. SalonConnect is a 7-person Tokyo SMB (株式会社セレナーデ) hosted on Sakura Internet's shared cloud. Neither company has disclosed its specific scraping framework publicly.

---

## Findings

### 1. The HPB API Situation

Hot Pepper Beauty (HPB) operated a public API until approximately 2017, at which point Recruit terminated it. No official API currently exists for HPB reservation data. Every system on the market that advertises "HPB integration" or "SalonBoard integration" is using scraping. This was independently confirmed by:

- The industry comparison site tada-reserve.jp: "ホットペッパービューティーは正式に連携している予約システムは一つもありません" (no officially integrated reservation system exists with HPB)
- SalonConnect's own FAQ (faq.salonconnect.jp/?p=1899): explicitly uses the word "スクレイピング"
- Industry commentary on Threads by Hasegawa (@3104hasegawa) noting that HPB alone does not open data exchange mechanisms while other portals do offer APIs

The implication: **every competitor is operating in the same scraping grey zone**. None have a moat from official API access.

### 2. SalonConnect — Technical Profile

**Operator:** 株式会社セレナーデ (Serenade Inc.), Tokyo Shibuya
**Founded:** 2006
**Team size:** 7 employees (very small)
**CEO:** 川原 潤 (Kawahara Jun)

**Infrastructure:**
- Domain: salonconnect.jp
- IP: 160.16.113.22
- Hosting: **Sakura Internet** (さくらインターネット), SAKURA-NET block, Osaka
- DNS nameservers: ns1/ns2.value-domain.com (Value Domain, a Sakura subsidiary)
- This is a **dedicated server or VPS on Sakura Internet**, not AWS or GCP

**Scraping mechanism (confirmed via FAQ):**
- Uses browser automation to log into SalonBoard/HPB using the salon's credentials stored in SalonConnect
- Performs scraping of the SalonBoard management screen (not the public-facing HPB site)
- CAPTCHA occasionally blocks sync: "サロンボードにて画像認証が表示される場合に、同期できない場合があります"
- They continuously "tune" the system to reduce CAPTCHA triggers: "画像認証が出ないように、日々チューニングを行っており"
- Sync is described as "real-time" in marketing but the FAQ says "極稀に連携がされない場合" (very rarely sync fails)
- Manual re-sync is possible: user opens the reservation and saves without changes to force reflection
- Password management is critical: HPB forces password changes every 6 months and SalonConnect must be updated in sync

**Sync direction:**
- HPB web reservations → SalonConnect (pull from SalonBoard)
- Non-HPB portal reservations → HPB (push to SalonBoard)
- SalonConnect manual reservations → HPB (push to SalonBoard)
- Notable limitation: HPB hand-entered reservations do NOT automatically sync to SalonConnect unless pulled

**CAPTCHA handling approach:**
- The FAQ states they do daily tuning to avoid triggering CAPTCHA
- No disclosure of specific technique (likely: human-like delays, real browser user-agent, IP rotation, session cookie management)
- When CAPTCHA does appear: sync fails silently; users must manually re-sync

**Pricing:**
- Base: ¥3,980/month (no setup fee, no minimum term)
- Dual HPB account: ¥7,980/month
- Online booking add-on: +¥1,000/month
- LINE integration: +¥2,000/month
- POS: +¥6,980/month

**Scale:** 2,000+ salon locations as of recent reporting

**Tech stack clues:**
- iOS + Android apps exist (developed in-house among 7 staff)
- Web-based admin dashboard
- No public tech blog, no job postings mentioning specific frameworks
- Sakura Internet hosting suggests traditional Japanese server hosting (not cloud-native)

---

### 3. DOUKI (salon-douki.com) — Technical Profile

**Operator:** Solo developer who also runs an actual massage/relaxation salon
**Type:** Independent/personal project; explicitly states "整体サロン経営をしながら個人で開発しているアプリ" (app developed individually while managing a massage salon)
**Disclaimer:** App has "一切関係ありません" (no relationship) with Recruit (SalonBoard owner)

**Infrastructure:**
- Domain: salon-douki.com
- IP: 163.44.185.204
- Hosting: **GMO Pepabo** (LOLIPOP shared hosting), Fukuoka
- DNS: dns01/dns02.muumuu-domain.com (Muumuu Domain, GMO Pepabo subsidiary)
- The website/blog is on LOLIPOP; the actual service backend is almost certainly elsewhere

**Technical stack (confirmed via relaunch blog post, salon-douki.com/1831):**
- **Monorepo:** Turborepo
- **API layer:** OpenAPI + Orval (generates TypeScript interfaces automatically for PeakManager and SalonBoard endpoints)
- **Real-time sync (bookings):** Previously polling every 60 seconds; now **Pub/Sub trigger-based** achieving **~7-second sync latency**
- **Google Calendar integration:** Uses **Gmail API** with trigger-based detection for near-instant calendar sync
- **Type safety:** Full TypeScript across backend and frontend
- **AI tooling:** Uses CursorAI for development

**SalonBoard Master app (separate iOS/Android companion):**
- Published on App Store (id6746419020) and Google Play
- Was rejected by App Store multiple times before approval
- Appears to function as a **native WebView wrapper** over SalonBoard's mobile web interface
- When user taps "DOUKI sync icon" inside the app, data is sent from the app to DOUKI's backend
- This is the key mechanism: the mobile app captures session data from the SalonBoard web session running inside WKWebView, then transmits it to DOUKI's servers

**Sync mechanism hypothesis (based on evidence):**
The SalonBoard Master app likely operates as a WKWebView wrapper that intercepts or reads the authenticated SalonBoard session, extracts reservation/shift data via JavaScript injection or DOM scraping within the WebView, and pushes it to DOUKI's backend via API. The backend then propagates changes to other connected portals (Rakuten Beauty, Peak Manager, etc.) via headless browser automation on their servers.

**Sync performance:**
- Booking sync: ~7 seconds (Pub/Sub triggered)
- Google Calendar: near-instantaneous (Gmail API triggers)
- Previous polling interval: 60 seconds

**Supported integrations:**
1. Peak Manager (ピークマネージャー) — primary mode
2. SalonBoard (Relaxation) — HPB + Rakuten Beauty
3. SalonBoard (Hair) — hair-specific configuration
4. Google Calendar
5. EPARK Osteopathy/Acupuncture

**Pricing:**
- ¥5,000/month
- No minimum contract, no setup fee
- Annual plan (slightly discounted)
- Free plan exists with limited features

**Scale:** Smaller than SalonConnect; no stated install count

---

### 4. coming-soon (カミングスーン) — Technical Profile

**Operator:** Professional company (larger than DOUKI, comparable to SalonConnect)
**URL:** 1cs.jp

**Integration claim:**
Connects with HPB, minimo, Nailie, OzMall. Like all others, uses scraping (no official API).

**Technical details available:**
- "ホットペッパービューティーの予約時間、予約メニュー、利用ポイントがcoming-soonに自動で反映" (HPB reservation times, menus, and points auto-reflect in coming-soon)
- minimo: reservation time and menu only (no customer data)
- Nailie: includes customer data sync
- No technical methodology disclosed in public docs

**Pricing (from partner docs):**
- Ranges reported around ¥5,000-8,000/month range (varies by plan)
- coming-soon markets itself as an AI-powered "gap-filling" scheduler that maximizes utilization

**Marketing angle:** "beauty industry's only patented technology" for filling booking gaps automatically

---

### 5. CAPTCHA Handling — What's Known

SalonConnect is the only service that publicly acknowledges CAPTCHA as a problem and states they actively work to avoid it. The specific techniques are not disclosed but industry-standard approaches for this type of scraping include:

1. **Human-like timing:** Random delays between actions (1-5 seconds between page interactions)
2. **Session persistence:** Reusing authenticated cookie sessions rather than logging in fresh each time
3. **Browser fingerprinting:** Using real Chrome/Chromium with undetected-chromedriver or Playwright stealth plugins
4. **Reduced frequency:** Not hammering the site; syncing every few minutes rather than continuously
5. **IP management:** Using dedicated IPs per salon (not shared datacenter IPs), possibly residential proxies for particularly sensitive operations
6. **Time-based scheduling:** Avoiding sync during Recruit's known maintenance/update windows

SalonConnect's use of Sakura Internet dedicated servers (not dynamic cloud) suggests they may assign per-salon or per-batch dedicated IPs rather than rotating proxies. This would look like legitimate salon staff logging in from a consistent IP.

No evidence of residential proxy usage found for either SalonConnect or DOUKI from public sources.

---

### 6. Sync Frequency Comparison

| Service | Stated Sync | Evidence |
|---------|------------|---------|
| SalonConnect | "Real-time" | Actually scrape-based; manual re-sync available; "very rare" failures acknowledged |
| DOUKI | ~7 seconds (booking), near-instant (calendar) | Confirmed in relaunch blog post; previously 60-second polling |
| coming-soon | "Automatic" | No specific interval disclosed |

---

### 7. Infrastructure Summary

| Service | Hosting | Region | CDN/Cloud |
|---------|---------|--------|-----------|
| salonconnect.jp | Sakura Internet (dedicated/VPS) | Osaka, JP | None detected |
| salon-douki.com (website) | GMO Pepabo LOLIPOP | Fukuoka, JP | None detected |
| salon-douki.com (backend) | Unknown (not LOLIPOP) | Likely Tokyo, JP | Unknown |
| 1cs.jp (coming-soon) | Unknown | Unknown | Unknown |

---

### 8. Competitive Positioning

| Criterion | SalonConnect | DOUKI | coming-soon |
|-----------|-------------|-------|-------------|
| Price/month | ¥3,980 (base) | ¥5,000 | ~¥5,500+ |
| Salon count | 2,000+ | Not disclosed | Not disclosed |
| Team size | 7 employees | 1 person (solo) | Medium company |
| Tech stack | Legacy (Sakura hosting) | Modern (TypeScript, Turborepo, Pub/Sub) | Unknown |
| Sync method | Scraping (confirmed) | Scraping + possible WKWebView | Scraping (assumed) |
| Sync speed | "Real-time" (unspecified) | ~7 seconds | "Automatic" |
| CAPTCHA ack'd | Yes (publicly) | Not publicly | Not publicly |
| iOS/Android app | Yes | Yes (SalonBoard Master) | Unknown |
| Google Calendar | No | Yes | No |
| EPARK support | No | Yes (osteopathy/acupuncture) | No |

---

## Key Strategic Insights

1. **The scraping grey zone is the whole industry.** There is no official API. Everyone is scraping. The competitive moat is operational reliability (fewer CAPTCHA failures), not technical access.

2. **DOUKI's architecture is more modern than SalonConnect's.** A solo developer on a massage table built a Pub/Sub system with 7-second sync using TypeScript and Turborepo. SalonConnect is on legacy Sakura hosting.

3. **DOUKI's SalonBoard Master app is the most interesting approach.** By wrapping SalonBoard in a native app, they avoid browser detection issues entirely — the traffic appears to come from legitimate Safari/Chrome user agents on real iOS/Android devices. This is likely why AppStore approved it eventually despite multiple rejections.

4. **SalonConnect's CAPTCHA problem is a persistent operational cost.** They explicitly acknowledge daily tuning work. This is not a solved problem — it's an ongoing maintenance burden for every scraping-based service.

5. **Credential storage is a vulnerability.** All these services store the salon's SalonBoard/HPB login credentials on their own servers. This is a security and trust issue, and also means a single HPB session policy change (e.g., enforcing 2FA or requiring SMS OTP on login) would break all of them simultaneously.

6. **The 2017 API shutdown was intentional.** Recruit shut down HPB's API to maintain platform control and prevent competing booking surfaces. They have shown no interest in reopening it. All integration services exist in a legal grey area under HPB's terms of service.

---

## Sources

1. [SalonConnect FAQ — scraping and CAPTCHA acknowledgment](https://faq.salonconnect.jp/?p=1899) — Explicit confirmation of scraping, CAPTCHA tuning, sync failure handling. Accessed 2026-03-31.

2. [SalonConnect FAQ — HPB password rotation](https://faq.salonconnect.jp/?p=288) — Reveals credential storage mechanism and dependency on stored passwords. Accessed 2026-03-31.

3. [SalonConnect pricing page](https://salonconnect.jp/price.html) — Full pricing tiers. Accessed 2026-03-31.

4. [DOUKI relaunch blog post](https://salon-douki.com/1831) — Most technically detailed document found: Turborepo, OpenAPI+Orval, Pub/Sub sync at 7 seconds, Gmail API for Google Calendar. Accessed 2026-03-31.

5. [DOUKI homepage](https://salon-douki.com/) — Pricing (¥5,000/month), 8 portals, 5 operation modes. Accessed 2026-03-31.

6. [DOUKI SalonBoard Master page](https://salon-douki.com/salonboard-master) — Confirms solo developer origin, "no relationship with Recruit" disclaimer. Accessed 2026-03-31.

7. [DOUKI SalonBoard Master + DOUKI integration](https://salon-douki.com/1836) — Describes tap-to-sync mechanism, data sent from app to DOUKI backend. Accessed 2026-03-31.

8. [Tada-Reserve: HPB-compatible systems comparison 2026](https://tada-reserve.jp/blog/alignment/) — Confirms ALL HPB integrations are scraping-based; API stopped 2017. Accessed 2026-03-31.

9. [Kamiu: HPB API shutdown article](https://kamiu.jp/hpb_api/) — Historical context for API termination. Accessed 2026-03-31.

10. [Reservation system comparison: HPB-compatible systems](https://reservation-system-comparison.info/column/cooperation-hotpepperbeauty/) — Lists competing services (One More Hand, Pepami, KANZASHI). Accessed 2026-03-31.

11. [coming-soon external linkage feature docs](https://1cs.jp/doc/function/func6) — Portal-specific sync capabilities and limitations. Accessed 2026-03-31.

12. [株式会社セレナーデ company page](https://www.snade.co.jp/) — 7 employees, founded 2006, ~20 app development projects. Accessed 2026-03-31.

13. DNS/WHOIS lookups (performed via dig/whois, 2026-03-31):
    - salonconnect.jp → 160.16.113.22 → Sakura Internet
    - salon-douki.com → 163.44.185.204 → GMO Pepabo LOLIPOP

---

## Confidence Assessment

**High confidence (multiple sources):**
- All HPB/SalonBoard integrations use scraping, not official API
- HPB API was terminated around 2017
- SalonConnect explicitly confirms scraping and CAPTCHA challenges in public FAQ
- SalonConnect hosted on Sakura Internet; salon-douki.com (website) on GMO Pepabo LOLIPOP
- DOUKI is a solo developer project; SalonConnect is a 7-person company
- DOUKI uses Turborepo + TypeScript + Pub/Sub (confirmed in blog)
- SalonConnect pricing: ¥3,980/month base; DOUKI: ¥5,000/month

**Medium confidence (single source or inferred):**
- DOUKI's SalonBoard Master app uses WKWebView with JavaScript-based data extraction (inferred from behavior description + App Store multiple rejections pattern)
- SalonConnect uses dedicated IPs per salon on Sakura Internet (inferred from hosting type)
- DOUKI backend runs on separate infrastructure from GMO Pepabo website hosting (inferred; LOLIPOP is too limited for backend services)

**Low confidence / Unverified:**
- Specific scraping framework used by SalonConnect (Selenium? Playwright? Custom HTTP?)
- Whether either service uses residential proxies
- coming-soon's exact technical stack
- DOUKI's backend cloud provider (AWS? GCP? Sakura?)
- Exact sync frequency for SalonConnect (they claim "real-time" but never define it)

---

## Information Gaps

- **SalonConnect's actual scraping framework**: No job postings, engineering blog, or technical talks found. The company has zero public engineering presence.
- **Proxy strategy**: Neither company has disclosed IP management strategy. No evidence of residential proxy vendors in their stack.
- **coming-soon deep technical analysis**: Their docs are more opaque than SalonConnect's FAQ.
- **SalonConnect sync polling interval**: Described as "real-time" but actual polling frequency (every 30s? 60s? 5 min?) is not publicly documented.
- **Legal status**: No public legal challenges from Recruit against these scraping services found. The grey area appears to be tacitly tolerated.
- **Wantedly/LinkedIn job postings**: No current engineering job postings found for either SalonConnect or DOUKI that would reveal stack details.
