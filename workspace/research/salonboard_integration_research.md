# Research: SalonBoard / Hot Pepper Beauty Integration — Legal & Technical Landscape

## Executive Summary

There is **no official Recruit API or partner program** for SalonBoard reservation system integration. Recruit terminated its Hot Pepper Beauty API in 2017 and has not replaced it with any partner pathway. All current commercial integration tools (DOUKI, SalonConnect, Beauty Merit, Salons Solution) operate via **scraping with the salon owner's credentials**, without explicit permission from Recruit. This exists in a legal grey zone: it is not straightforwardly criminal under the Unauthorized Access Prevention Act if the account holder expressly authorizes the access, but it is likely a **Terms of Service violation** creating civil liability risk. Recruit has not publicly prosecuted any of these vendors to date, suggesting a tacit tolerance, but this carries no guarantee of future enforcement.

---

## Findings

### 1. Recruit Partner Programs and API Status

**Recruit Web Service** (webservice.recruit.co.jp) offers only a **Hot Pepper Gourmet** (restaurant) API to the public. There is no beauty or SalonBoard API listed. Registration gives access to restaurant search data, not reservation write access.

**Hot Pepper Beauty API was terminated in approximately 2017.** Multiple industry sources confirm this, with one industry commentator on Threads stating: "ホットペッパーだけがAPIを開放していないので連携がスムーズじゃない" (Hot Pepper is the only platform that hasn't opened its API, which makes integration unsmooth). The same source notes all other beauty platforms (Rakuten Beauty, Minimo, etc.) do offer APIs, making HPB the sole holdout.

**No technology partnership program** for reservation system integration with SalonBoard or Hot Pepper Beauty was found in any official Recruit documentation, press release, or third-party reporting. Recruit's corporate site does not list any beauty tech integration partner pathway.

**Conclusion:** There is no legitimate official channel. Recruit has deliberately closed its API and offers no replacement for third-party reservation system integration.

---

### 2. How Existing Integration Vendors Actually Work

All five commercial integration vendors found operate using **scraping** — automated browser access using the salon's own login credentials stored in the vendor's system:

| Vendor | Monthly Price | Method | Notes |
|--------|---------------|--------|-------|
| DOUKI | ¥5,000 | Server-side scraping | Pub/Sub triggers, ~7 second sync |
| SalonConnect | ¥3,980 | Scraping (confirmed) | Multiple sources confirm this explicitly |
| Beauty Merit | ¥20,000 + ¥100,000 initial | Scraping (implied) | Launched 2017, still operating |
| Salons Solution | Not found | Scraping (implied) | Has published SalonBoard integration ToS |
| coming-soon | ¥12,000-20,000 | Scraping (implied) | Auto-push notification features |

**Key technical limitation** common to all: because HPB has no API, any reservations entered manually by the salon *within* SalonBoard are not synced back to the external system. Data flows only from external → SalonBoard, not the reverse. This is a fundamental limitation of the scraping approach vs. a true API.

**DOUKI's technical architecture** (partially disclosed): They use OpenAPI+Orval to describe portal site endpoints, and employ Pub/Sub-triggered synchronization. Their Google Calendar sync uses the Gmail API. They rebuilt to a monorepo architecture. Notably, they describe accessing "portal site endpoints" using OpenAPI — this suggests they may be hitting SalonBoard's internal API endpoints (reverse-engineered from network traffic) rather than pure HTML scraping. This would be more stable but more legally ambiguous.

**No vendor has publicly disclosed** receiving permission from Recruit for SalonBoard access. None of their published terms of service mention Recruit authorization. The Salons Solution SalonBoard integration ToS notably states that the user themselves is responsible for all settings and data — essentially pushing liability to the salon owner.

---

### 3. SalonBoard Terms of Service Analysis

The **Hot Pepper Beauty consumer Terms of Service** (cdn.p.recruit.co.jp/terms/hpb-t-1001/index.html) contains the following relevant prohibitions:

**Article 5, Clause 2 — Prohibited Uses:**
- **[2]:** "当社の承認した以外の方法により本サービスを利用する行為" — Use of the service by methods other than those approved by the Company
- **[4]:** "本サービスを無断で改変する行為" — Unauthorized modification of the Service
- **[5]:** "当社のサーバー等のコンピューターに不正にアクセスしたり、有害なコンピュータプログラム等を送信または書き込む行為" — Unauthorized access to Company servers or transmission of harmful programs

**App Terms, Article 10-2:** Prohibits reverse engineering, decompiling, and disassembly without Company consent.

**Key finding:** Clause [2] — "methods other than those approved by the Company" — is broad enough to cover automated/programmatic access. Recruit has not approved any third-party scraping. This makes scraping of SalonBoard a **Terms of Service violation** under the civil law framework, regardless of whether it is criminal.

The **Recruit Web Service API Terms** add: collected data cannot be compiled into third-party databases or used for purposes beyond what the terms explicitly permit.

**Note:** No SalonBoard-specific master ToS was successfully retrieved (salonboard.com pages timed out). The HPB consumer terms above apply to the consumer-facing site. SalonBoard is the salon-side management system and likely has a separate, potentially stricter operator agreement that was not accessible during this research.

---

### 4. Japanese Law on Scraping — Unauthorized Access Prevention Act (不正アクセス禁止法)

**The Act prohibits** entering another person's authentication credentials into a system without authorization. However, the law contains a critical exception:

**Article 3 proviso:** Access is NOT unauthorized if performed with "the consent of the access manager or the authorization holder (利用権者の承諾を得てする場合)."

**Legal interpretation for the "salon authorizes a vendor" scenario:**

Under the law's framework:
- The **salon owner** is the 利用権者 (authorization holder) for their SalonBoard account
- If the salon owner **explicitly consents** to a vendor logging in on their behalf, this may fall within the Article 3 exception
- This is the legal theory that DOUKI, SalonConnect, and others appear to rely upon — the salon agrees to their service terms and provides credentials

**Critical caveats from legal analysis:**
1. The ToS violation (civil liability) exists independently of the criminal law question
2. If Recruit is considered the "access manager" (アクセス管理者) rather than the salon, the salon owner's consent alone may be insufficient — the access manager's consent would also be required
3. Excessive server load from scraping could trigger **偽計業務妨害罪** (obstruction of business) under the Criminal Code (Articles 233, 234) regardless of ToS issues
4. The 2010 **Librahack incident** established that even low-frequency automated access can lead to arrest under this theory if it causes service disruption

**Browser session / cookie approach (salon logs in manually, vendor reads session):** This is technically the same legal question — if the salon authorizes it, the criminal law exception likely applies. The practical risk is lower (no stored passwords) but the ToS violation risk is identical.

---

### 5. RPA Legal Status in Japan

**RPA (Robotic Process Automation) is not specifically regulated** under Japanese law. Using RPA for business automation is treated as ordinary computer use. The legal analysis defaults to:
1. ToS compliance (civil risk)
2. Unauthorized Access Prevention Act (criminal risk if no user consent)
3. Obstruction of business if server load is excessive (criminal risk)

**Important nuance:** RPA vendor BizRobo! and others explicitly market to law firms and regulated industries. The consensus in the Japanese legal/tech community is that RPA is lawful if the account holder authorizes the automation and the service's ToS does not prohibit it.

For SalonBoard specifically: the ToS prohibition on "methods other than those approved" would apply to RPA in the same way it applies to scraping.

---

### 6. Legal Cases Involving Reservation System Scraping in Japan

**No specific legal cases involving SalonBoard or Hot Pepper Beauty scraping were found.** Recruit has not publicly sued any of the integration vendors.

The only relevant precedents found:
- **Librahack incident (2010):** Arrest for automated library catalog access at ~1 request/second. Charges were for obstruction of business. Case established that even low-frequency automated access carries criminal risk if it causes service disruption.
- **No civil cases** between Recruit and integration vendors were found in public records

The absence of enforcement against DOUKI/SalonConnect (operating since ~2017-2019) suggests Recruit may be exercising prosecutorial discretion, possibly because: (a) these vendors are technically serving Recruit's own customers, (b) Recruit does not want negative publicity, or (c) the legal basis for action is ambiguous given the user-consent exception.

---

### 7. Practical Risk Assessment for Different Approaches

| Approach | Criminal Risk | Civil/ToS Risk | Practical Stability |
|----------|--------------|----------------|---------------------|
| Official Recruit API | None (doesn't exist) | N/A | N/A |
| Server-side scraping with salon's stored credentials | Low-Medium (user consent exception applies) | High (ToS violation) | Medium (breaks on UI changes) |
| Browser extension (salon stays logged in, extension reads DOM) | Low (user controls their own browser) | High (ToS violation) | Medium |
| Manual salon logs in, our server reads their session cookie | Low-Medium | High | Medium |
| Reverse-engineering SalonBoard's internal API endpoints | Medium-High (no user authorization for API endpoint access) | Very High | High (until Recruit breaks it) |
| Asking Recruit for a formal partnership | None | None | Depends on outcome |

---

### 8. Path to Legitimate Partnership with Recruit

**Recruit corporate contact for business development:**
- Recruit Holdings business inquiry: recruit.co.jp/support/
- No specific "technology partner" program for SalonBoard was found
- Recruit does have partner programs for HR/staffing (Indeed, Rikunabi) but not for beauty platform integrations

**Recommended approach if pursuing official channel:**
1. Contact Recruit's Beauty Division (responsible for HPB/SalonBoard) via their corporate inquiry form
2. Frame as a mutual benefit: your system drives more salon adoption of HPB, reducing their churn
3. Recruit has strong incentive to lock salons in to HPB ecosystem — a vetted partner program could serve this goal
4. Reference: Recruit has previously run limited partner programs for specific enterprise integrations (e.g., ATS integrations for HR tech), suggesting this model is not alien to them

**Likelihood assessment:** Based on research, Recruit appears to have deliberately kept SalonBoard a closed ecosystem since 2017 as a competitive moat. A formal partner API is unlikely in the short term, but a direct enterprise negotiation for specific use cases (e.g., AI-assisted reservation management for verified salon customers) is not impossible.

---

## Sources

1. [【2026年最新】ホットペッパービューティーと予約連携が出来るおすすめの予約システム5選](https://tada-reserve.jp/blog/alignment/) — Integration methods analysis; confirms all vendors use scraping not API
2. [ホットペッパーだけがAPIを開放していない (Threads)](https://www.threads.com/@3104hasegawa/post/DHStk7JvJgQ/) — Industry practitioner confirming HPB is sole platform without API
3. [HOT PEPPER Beauty 利用規約](https://cdn.p.recruit.co.jp/terms/hpb-t-1001/index.html) — Official Recruit ToS; extracted key prohibited-use clauses
4. [リクルートWEBサービス 利用規約](https://cdn.p.recruit.co.jp/terms/rws-t-1001/index.html) — Recruit API terms; data reuse restrictions
5. [サロンズソリューション サロンボード連携 利用規約](https://www.salons.jp/posts/7960333/) — Third-party integration ToS; liability-shifting to salon owner
6. [DOUKIリニューアル技術記事](https://salon-douki.com/1831) — Technical architecture details; Pub/Sub sync, OpenAPI usage
7. [スクレイピングは違法？弁護士が解説 (TopCourt Law)](https://topcourt-law.com/internet_security/scraping-illegal) — Civil liability framework for ToS violations
8. [【IT弁護士監修】スクレイピングは違法？(PigData)](https://pig-data.jp/blog_news/blog/scraping-crawling/scrapinglaw/) — Four violation categories; Librahack case
9. [不正アクセス行為の禁止等に関する法律 (e-Gov)](https://laws.e-gov.go.jp/law/411AC0000000128) — Full text of Unauthorized Access Prevention Act
10. [【絶対に自動化してはいけない】自動化禁止サイトまとめ (Qiita)](https://qiita.com/n_oshiumi/items/b4efd1f40ec0a1b77376) — Sites explicitly prohibiting automation; SalonBoard not listed
11. [リクルートWEBサービス登録](https://webservice.recruit.co.jp/register) — Available Recruit public APIs; only restaurant API found
12. [ホットペッパービューティーの利用メリットと連携予約システム](https://rsvia.co.jp/column/hot_pepper_beauty_review/) — Confirms scraping is universal method

---

## Confidence Assessment

**High confidence (3+ sources):**
- No official Recruit API exists for SalonBoard integration (2017 shutdown, not replaced)
- All current vendors (DOUKI, SalonConnect, etc.) use scraping with user credentials
- HPB ToS prohibits "methods not approved by the Company" covering scraping
- No criminal prosecutions found against integration vendors
- Unauthorized Access Prevention Act has a user-consent exception

**Medium confidence (1-2 sources):**
- DOUKI may be accessing internal API endpoints (reverse-engineered) rather than HTML scraping
- Salons Solution ToS structure shifts liability to salon owner — this may be the industry standard legal approach
- Recruit's internal business development contact path exists but no confirmed response patterns found

**Low confidence / Unverified:**
- SalonBoard operator-side ToS (separate from consumer HPB ToS) — could not retrieve; may be stricter
- Whether Recruit has sent cease-and-desist letters to vendors privately
- Whether an enterprise partnership negotiation with Recruit is feasible

---

## Information Gaps

1. **SalonBoard operator ToS full text** — salonboard.com timed out during research. This is the most critical gap; the operator agreement likely has stricter automated access restrictions than the consumer HPB ToS.
2. **Recruit's private enforcement actions** — Whether Recruit has issued private C&D letters to integration vendors is not publicly known.
3. **DOUKI's exact technical method** — Whether they scrape HTML or hit internal API endpoints is not publicly disclosed. This distinction matters legally (reverse engineering of API endpoints adds copyright/computer fraud risk).
4. **Any Recruit beauty tech partner program that is invite-only** — May exist for large enterprise customers without public documentation.
5. **Post-2024 legal developments** — The research found no 2024-2026 cases, but the legal landscape may have shifted.
