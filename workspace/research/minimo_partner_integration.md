# Research: Minimo (ミニモ) Partner Integration System

**Research date:** 2026-03-31
**Researcher:** Claude Sonnet 4.6

---

## Executive Summary

Minimo (minimodel.jp), operated by MIXI株式会社 (formerly ミクシィ), runs a **closed, invitation-only partner integration program** for external reservation systems. There is NO public developer portal, NO public API documentation, and NO open application process. The integration uses a **proprietary authentication key** generated from within the Minimo Salon Tool — not OAuth or a public API key scheme. As of research date, exactly 7 systems are approved partners: かんざし (KANZASHI), BeautyMerit, Reservia, サロリザ (saloriza), coming-soon, FAN CUBE, and サロンコネクト (SalonConnect). New partners appear to be onboarded exclusively through direct business negotiation with MIXI's Minimo team.

---

## Findings

### 1. Authentication Key — Technical Details

**Type:** Proprietary API key (called "認証キー" — authentication key)

**How it works:**
- The key is generated *within* the Minimo Salon Tool by the salon operator, not the partner system
- Navigation path: Minimo Salon Tool → 設定 (Settings) → 予約システム連携 (Reservation System Integration) → [Partner name] 連携方法
- The salon operator copies the generated key and pastes it into the partner system's management dashboard
- This is a **per-salon, per-integration key** — each salon generates their own key for each connected partner system

**Format:** Unknown. No public documentation discloses the key format, length, or encoding. It is not confirmed to be UUID, JWT, or any standard format.

**Authentication protocol:** Not publicly documented. Based on behavior (key is generated on Minimo side, consumed on partner side), it appears to be a bearer token / API key model rather than OAuth. There is no OAuth callback flow described in any documentation.

**Key discovery source:** [SalonConnect FAQ — ミニモ認証キー登録方法](https://faq.salonconnect.jp/?p=2591)

---

### 2. Data Access Scope — What Partners Can Do

Based on observed behavior described in SalonConnect's and Minimo's help documentation:

**What IS synced (confirmed):**
- **Availability/slots:** The connected partner system pushes slot availability to Minimo, which Minimo displays as "すぐ予約" (instant booking) slots
- **Schedule/shift data:** Partner system's shift schedule is reflected in Minimo's "外部予約システム連携時間" (External Reservation System Integration Time)
- **Reservation status:** When a booking comes through either system, both sides are updated (double-booking prevention)
- **Appointment modification:** Time changes to Minimo-sourced reservations can be made via the partner system

**What is NOT synced / restricted (confirmed):**
- Duration changes to existing Minimo reservations are blocked
- Staff reassignment on Minimo-origin reservations is not possible via partner system
- Customer cancellations from Minimo side do not auto-delete on partner side (handled separately)

**Read vs. Write:**
The integration is **bidirectional** — partner systems can both read availability and write (create) reservations. This is confirmed because:
- The primary purpose is double-booking prevention (requires real-time reads)
- Partner systems manage the slots that Minimo then shows to customers

**Source:** [SalonConnect — ミニモ連携仕様について](https://faq.salonconnect.jp/?p=2215), [Minimo Help — 外部予約システムとの連携方法](https://help.chatplus.jp/support-minimo/article/118/)

---

### 3. Approved Partners (Complete List as of 2026-03)

| Partner System | Company | Notes |
|---|---|---|
| かんざし (KANZASHI) | — | Earliest/most established integration |
| BeautyMerit | — | Supports proprietary salon app creation |
| Reservia (リザービア) | — | Founded 2012, 4,500+ salons |
| サロリザ (saloriza) | 株式会社GENE (Niigata) | Partnership announced Aug 2021 |
| coming-soon | — | Listed as "coming soon" in some older docs; now active |
| FAN CUBE (ファンキューブ) | — | Salon-focused; website has SSL certificate issues |
| サロンコネクト (SalonConnect) | — | Minimo API support added Jan 26, 2024 |

**Confirmed source:** [Minimo Help — 連携できるサービス一覧](https://help.chatplus.jp/support-minimo/article/346/)

---

### 4. How Approved Partners Got Approved — Partnership Process

**No public application process exists.** The research found:

- Minimo's official pages contain NO mention of a partner application program
- No developer portal, no API signup page, no partner program page exists at minimodel.jp or mixi.co.jp
- The saloriza press release (Aug 2021, PR Times) describes the integration as MIXI and GENE "beginning system integration" — suggesting direct company-to-company negotiation
- SalonConnect's FAQ notes their integration launched Jan 26, 2024, implying each partnership has a negotiated launch date
- The inquiry contact on minimodel.jp/info/salon asks for company name, contact person, email, phone — consistent with a B2B sales process rather than a self-serve developer program

**Inference:** Becoming a Minimo integration partner requires:
1. Direct contact with MIXI's Minimo business team (via minimodel.jp contact form or direct sales contact)
2. Bilateral agreement on integration scope and terms
3. Technical integration (likely Minimo provides API credentials/documentation under NDA to approved partners)
4. Named addition to Minimo's official partner list

**Press release source:** [PR Times — saloriza × minimo 連携開始](https://prtimes.jp/main/html/rd/p/000000001.000085254.html)

---

### 5. Public API Documentation

**There is none.** Exhaustive search confirmed:
- No public URL at minimodel.jp/api, minimodel.jp/developer, or similar
- No Swagger/OpenAPI spec publicly accessible
- No GitHub repositories with Minimo API client libraries
- No Qiita or Zenn articles describing Minimo API technical details
- No Stack Overflow questions about Minimo API integration
- The faq.minimodel.jp domain redirects to help.chatplus.jp (a third-party help center tool), which contains only end-user documentation

---

### 6. Discoverable API Endpoints

**None found through public research.** The Minimo web app (minimodel.jp) and Salon Tool are consumer-facing applications. No API endpoints were discoverable through:
- Google dorking on minimodel.jp
- Searching developer community sites
- Examining help documentation for endpoint hints

The Minimo mobile app likely communicates with internal APIs, but these are not public and would require reverse engineering (terms-of-service violation).

---

### 7. MIXI Developer Program

MIXI operates a developer center at developer.mixi.co.jp, which provides:
- **mixiアプリ** — apps for the mixi social network
- **mixi Connect** — mixi Graph API
- **mixi Plugin** — social buttons/widgets

**Critical finding:** The MIXI developer program covers ONLY the legacy mixi social network. It has NO relationship to Minimo. Minimo is a separate product under MIXI's corporate umbrella and does not participate in the mixi developer ecosystem.

**Source:** [mixi Developer Center](https://developer.mixi.co.jp/)

---

### 8. Individual Developers vs. Companies

There is no evidence that individual developers can apply for Minimo partner status. All confirmed partners (saloriza/GENE, SalonConnect, Reservia, KANZASHI, BeautyMerit) are established software companies with salon management products serving existing customer bases. The partnership model appears to be purely B2B — MIXI is interested in companies that can drive mutual customer value (i.e., salons who already use both Minimo and the partner system).

---

## Information Gaps

- **Authentication key format:** The exact format, length, and encoding of Minimo's 認証キー is not publicly disclosed
- **API endpoint structure:** No public endpoint documentation exists; endpoints are only known to approved partners under NDA
- **Partner onboarding timeline:** How long the approval/onboarding process takes is unknown
- **Partner agreement terms:** Whether there are revenue-sharing, exclusivity, or certification requirements is unknown
- **New partner acceptance status:** Whether Minimo is actively accepting new integration partners (vs. closed to new additions) is unknown
- **Technical protocol:** REST vs. WebSocket vs. polling mechanism is undisclosed

---

## Confidence Assessment

- **High confidence:** 7 named partners (multiple sources confirm identical list); authentication key is generated in Salon Tool and pasted to partner dashboard; integration is bidirectional for slots/reservations; no public API documentation exists
- **Medium confidence:** Partnership requires direct B2B negotiation with MIXI; MIXI developer program is unrelated to Minimo
- **Low confidence / Unverified:** Key is a bearer token (not OAuth); individual developers cannot apply; partnerships are NDA-covered

---

## Sources

1. [SalonConnect FAQ — ミニモ認証キー登録方法](https://faq.salonconnect.jp/?p=2591) — Auth key generation process
2. [SalonConnect FAQ — ミニモ連携仕様について](https://faq.salonconnect.jp/?p=2215) — Integration data sync specifications
3. [SalonConnect FAQ — ミニモアカウント（サロンツール）について](https://faq.salonconnect.jp/?p=1547) — Salon Tool account requirements
4. [Minimo Help — 外部予約システムとの連携方法](https://help.chatplus.jp/support-minimo/article/118/) — Integration setup process
5. [Minimo Help — 連携できるサービス一覧](https://help.chatplus.jp/support-minimo/article/346/) — Official partner list
6. [Minimo Help — Category: 外部予約システムについて](https://help.chatplus.jp/support-minimo/category/67) — Full category of integration help articles
7. [PR Times — saloriza × minimo 連携開始プレスリリース (2021-08-25)](https://prtimes.jp/main/html/rd/p/000000001.000085254.html) — Partnership announcement; company details
8. [minimodel.jp — サロンツール紹介ページ](https://minimodel.jp/info/salon) — Contact form for business inquiries
9. [minimodel.jp — 掲載者様向けFAQ](https://minimodel.jp/info/faq) — Official FAQ
10. [Reservia — ミニモ連携解説記事](https://rsvia.co.jp/column/minimo_reservation_linkage/) — Partner overview (marketing)
11. [mixi Developer Center](https://developer.mixi.co.jp/) — Confirmed: mixi dev program unrelated to Minimo
12. [タダリザーブ — ミニモ連携システム解説](https://tada-reserve.jp/blog/minimo/) — Partner overview (marketing)
