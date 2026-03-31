# Research: Japan Residential & Mobile Proxies for Akamai-Protected Sites

Research date: 2026-03-31

---

## Executive Summary

For scraping Akamai-protected Japanese sites (e.g. SalonBoard), datacenter IPs (including ConoHa/GMO AS23916) will reliably fail - Akamai assigns them a significant negative trust score. The minimum viable approach is residential proxies (~$2-4/GB), with mobile proxies being the gold standard for difficult targets (~$5-9/GB). SOAX is the standout provider for Japan specifically because it explicitly lists NTT Docomo, SoftBank, and au (KDDI) mobile carrier targeting. BrightData has the largest pool (179,884 Japan IPs) but costs more. For a 4x/day SalonBoard scraping job (50 pages/session, ~200 pages/day), monthly costs range from roughly $7-80 depending on provider and proxy type. Self-hosted Japan mobile proxy using a local SIM is technically feasible but requires Raspberry Pi + USB modem hardware and a carrier that permits tethering.

---

## Findings

### 1. BrightData Japan Proxies

BrightData is the largest provider with 179,884 IPs in Japan (across all proxy types). Their location page confirms city-level targeting for Tokyo, Osaka, and Saitama.

**Pricing (current, note: 50% promo discount active as of research date):**

| Type | Pay-as-you-go | Starter | Professional | Enterprise |
|------|--------------|---------|--------------|------------|
| Residential | $4/GB | $3.50/GB (141 GB, $499/mo) | $3.00/GB (332 GB, $999/mo) | $2.50/GB (798 GB, $1,999/mo) |
| Mobile | $8/GB | $7/GB (71 GB, $499/mo) | $6/GB (166 GB, $999/mo) | $5/GB (399 GB, $1,999/mo) |
| ISP Static | ~$15/GB PAYG | $12.82/GB (39 GB, $499/mo) | $11.35/GB (88 GB, $999/mo) | $10.52/GB (190 GB, $1,999/mo) |
| Datacenter | $1.30-$1.80/IP/mo | — | — | — |

**Japan carrier targeting:** The location page states "target any carrier & ASN" but does NOT explicitly list NTT Docomo, SoftBank, or au (KDDI) by name. Carrier targeting is available but requires dashboard configuration or contacting sales.

**Japan IP count:** 179,884 total IPs across all types.

**Verdict:** Most established provider, huge network, but expensive and Japan carrier targeting is not transparently documented.

---

### 2. SOAX Japan Proxies (Best for Japan Carrier Targeting)

SOAX is the clearest provider for Japan mobile carrier targeting. Their Japan page explicitly lists:
- NTT Docomo
- SoftBank Corp.
- au One Net (KDDI)
- Biglobe
- Rakuten Mobile Network
- 40+ additional regional providers (including Starlink, JCom, Kurashiki Cable TV)

**Japan IP count:** 210,600 IPs

**Pricing:**

| Plan | Monthly Cost | GB Included | Per-GB Rate |
|------|-------------|-------------|-------------|
| Starter | $90 | 25 GB | $3.60/GB |
| Advanced | $170 | 50 GB | $3.40/GB |
| Professional | $740 | 300 GB | $2.46/GB |
| Business | $1,600 | 800 GB | $2.00/GB |
| Enterprise | Custom | — | from $0.32/GB |

**Features:** 47 Japanese prefectures, 100+ cities, individual carrier selection, sticky + rotating sessions.

**Verdict:** Best Japan-specific option. Explicit Docomo/SoftBank/au carrier targeting is a major differentiator. $90/mo minimum is relatively affordable for a real Japan mobile IP pool.

---

### 3. IPRoyal Japan Proxies

IPRoyal offers budget-friendly pricing but with less granular Japan-specific control.

**Pricing:**

| Type | Pricing |
|------|---------|
| Residential | From $1.75/GB (32M+ pool) |
| ISP Static | From $2.40/proxy |
| Datacenter | From $1.39/proxy (60+ locations) |
| Mobile | From $117/month (4.5M+ IPs, 4G/5G) |

**Japan coverage:** Country and city-level targeting confirmed. ASN-level targeting is available but reportedly limited to higher-spending users (noted in Proxyway review as a limitation for smaller budgets).

**Japan carrier targeting:** Not explicitly documented for Japan. Mobile proxy pool is global 4.5M IPs - Japan is included but carrier-specific targeting for Docomo/SoftBank/au is not confirmed.

**Verdict:** Cheapest residential option at $1.75/GB. Good for budget scraping where carrier targeting is not critical. Mobile plan ($117/mo) is a fixed cost which may suit regular use.

---

### 4. Oxylabs Japan Proxies

Oxylabs focuses on enterprise/premium market.

**Japan IP count:** 2,633,211 residential IPs (very large pool). 16,895 IPs in Tokyo, 1,024 in Yokohama.

**Pricing:**

| Plan | Monthly Cost | GB Included | Per-GB Rate |
|------|-------------|-------------|-------------|
| Starter | $30 | 5 GB | $6/GB |
| Basic | $100 | 20 GB | $5/GB |
| Advanced | $500 | 125 GB | $4/GB |
| Corporate | $2,500 | 1,000 GB | $2.50/GB |
| Mobile | Separate | — | From $9/GB |

**Japan carrier targeting:** Supports "country, state, city, and ASN targeting" for mobile proxies. Specific carriers (Docomo/SoftBank/au) not explicitly listed on Japan page.

**Verdict:** Largest Japan residential IP pool (2.6M IPs). Expensive but reliable. $30 entry plan is accessible. Mobile at $9/GB is the priciest among compared providers.

---

### 5. Decodo (formerly Smartproxy) Japan Proxies

Rebranded from Smartproxy in April 2025. Competitive pricing with broad coverage.

**Pricing:**

| GB/mo | Per-GB Rate | Monthly Cost |
|-------|-------------|-------------|
| 3 GB | $3.75 | $11.25 |
| 10 GB | $3.50 | $35 |
| 25 GB | $3.25 | $81.25 |
| 50 GB | $3.00 | $150 |
| 100 GB | $2.75 | $275 |
| 250 GB | $2.50 | $625 |
| 1,000 GB | $2.00 | $2,000 |
| PAYG | $4.00 | per GB |

**Japan coverage:** 115M+ IPs globally, Japan confirmed in 195+ locations. No specific Japan carrier targeting documented. ISP and mobile proxies also available.

**Verdict:** Best price-to-entry at $11.25/mo for 3 GB. Good for low-volume testing. Japan carrier targeting is not a documented feature.

---

### 6. Akamai Detection Mechanism and Proxy Type Effectiveness

Akamai Bot Manager operates across five simultaneous layers:
1. **IP reputation** - Assigns positive/neutral/negative trust scores based on IP type
2. **TLS fingerprinting (JA3)** - Identifies client from TLS handshake characteristics
3. **JavaScript challenges** - Generates `_abck` cookie via browser JS execution
4. **Behavioral analysis** - Mouse movement, click patterns, timing
5. **Session monitoring** - Tracks consistency across requests

**Trust scores by proxy type:**
- **Datacenter IPs** (including ConoHa AS23916): Significant NEGATIVE trust score. Akamai explicitly knows these are not real users. These will be blocked or challenged aggressively.
- **Residential IPs**: POSITIVE trust score. Real user IPs, expensive to acquire, trusted by Akamai.
- **Mobile IPs**: POSITIVE trust score, often HIGHER than residential. Mobile towers recycle IPs among thousands of users, making individual IP blocking counterproductive for Akamai. Mobile IPs are the most trusted type.
- **ISP Static (Hybrid) IPs**: Positive trust score. Datacenter speed + residential ASN registration via BGP announcement. A strong middle ground.

**Key insight from Scrapfly research:** "Mobile IPs also provide a positive trust score as these are mostly used by humans. In addition, since mobile towers might share and recycle IP addresses it makes it much more difficult to rely on IP addresses for identification."

---

### 7. ConoHa VPS (AS23916 / GMO Internet) IP Reputation

**Short answer: ConoHa datacenter IPs will be blocked by Akamai.** No specific blacklist entry for AS23916 was found in public databases, but this is irrelevant - Akamai does not need a specific blacklist entry. It categorizes ALL datacenter ASNs (including GMO Internet AS23916) as having negative trust scores by default.

**Can datacenter IP reputation be improved?**
- **No meaningful way to "improve" a datacenter IP's reputation with Akamai.** Akamai's trust scoring is based on IP type classification (datacenter vs. residential vs. mobile), not just historical behavior.
- Whitelisting is possible but only if you control the target site's Akamai configuration (i.e., you are the site owner). An external scraper cannot whitelist their own IPs on someone else's Akamai deployment.
- Slowing down requests helps avoid rate limits but does not change the fundamental IP type classification.
- Using ConoHa as a proxy routing node (with residential exit IPs) is a valid architecture, but the exit IPs must be residential/mobile - the ConoHa server itself as the exit node will not work.

**Practical conclusion:** ConoHa VPS is fine as your orchestration server (running the scraper code), but ALL outbound HTTP requests to Akamai-protected sites must exit through residential or mobile proxy IPs. The VPS IP itself must never touch the target site directly.

---

### 8. Sticky Session vs. Rotating Proxy for Login-Based Scraping

**For SalonBoard or any login-required site, sticky sessions are mandatory.**

Akamai and the application layer both tie session tokens to the originating IP. If the IP changes mid-session:
- The session cookie/token becomes invalid
- You are forced to re-authenticate (triggering additional Akamai checks)
- Re-authentication frequency is itself a bot signal

**Sticky session duration recommendations:**
- Login + navigation session: 10-30 minutes minimum
- For 50-page scraping sessions: Use 30-60 minute sticky sessions
- All major providers (BrightData, SOAX, Oxylabs, Decodo) offer configurable sticky sessions

**Rotation strategy for SalonBoard 4x/day:**
- Each scraping session: Use a DIFFERENT sticky IP from the previous session
- Within a session (50 pages): Keep the SAME sticky IP
- This mimics a different human logging in from a different device each time

---

### 9. Speed Comparison: Mobile vs. Residential vs. ISP Proxy

| Proxy Type | Typical Latency | Throughput | Stability | Akamai Trust |
|-----------|----------------|------------|-----------|--------------|
| Datacenter | 20-50ms | High | Very High | Negative |
| ISP Static | 50-150ms | High | High | Positive |
| Residential | 100-500ms | Medium | Medium | Positive |
| Mobile 4G/5G | 80-300ms | Medium | Low-Medium | Highest |

**Notes:**
- Mobile proxies have variable latency due to cell tower handoffs and network congestion
- Residential proxies use peer devices (other users' home IPs) - speed depends on their connection quality
- ISP static combines datacenter speed with residential ASN - best balance if Akamai trusts it
- For 50-page sessions, even 300ms latency per page = 15 seconds total - acceptable

---

### 10. Cost Calculation: SalonBoard 4x/Day Scraping

**Assumptions:**
- 4 sessions/day
- 50 pages/session
- 200 pages/day
- Average page size: ~500KB (HTML + JSON responses, no images)
- Monthly: 200 pages x 30 days = 6,000 pages
- Data volume: 6,000 x 500KB = ~3 GB/month (conservative estimate; actual HTML may be smaller ~100-200KB per page = 0.6-1.2 GB/month)

**Using 2 GB/month as baseline (realistic compressed HTML), 3 GB as conservative upper bound:**

| Provider | Type | Price/GB | 2 GB/mo Cost | 3 GB/mo Cost | Notes |
|----------|------|---------|-------------|-------------|-------|
| Decodo | Residential | $3.75 | $11.25 (3GB plan) | $11.25 | Cheapest entry |
| IPRoyal | Residential | $1.75 | $3.50 | $5.25 | PAYG, no minimum |
| SOAX | Residential/Mobile | $3.60 | $90 (25GB plan) | $90 | Minimum plan is 25GB |
| BrightData | Residential | $4.00 | $8.00 | $12.00 | PAYG, no minimum |
| BrightData | Mobile | $8.00 | $16.00 | $24.00 | PAYG |
| Oxylabs | Residential | $6.00 | $30 (5GB plan) | $30 | Minimum 5GB plan |
| Oxylabs | Mobile | $9.00 | $18.00 | $27.00 | PAYG |
| IPRoyal | Mobile | $117/mo flat | $117 | $117 | Fixed cost, unlimited GB |

**Most cost-efficient options for this use case:**
1. **IPRoyal Residential PAYG**: ~$3.50-5.25/month. Cheapest but no Japan carrier targeting.
2. **BrightData Residential PAYG**: ~$8-12/month. More reliable, 179K Japan IPs.
3. **Decodo 3GB plan**: $11.25/month flat. Predictable cost, good pool size.
4. **SOAX Starter**: $90/month. Overkill for 3GB but gives Docomo/SoftBank/au carrier targeting.
5. **IPRoyal Mobile fixed**: $117/month. Only makes sense if volume grows or if residential IPs get blocked.

**Recommendation for SalonBoard:** Start with BrightData PAYG residential or Decodo 3GB plan. If blocked, escalate to SOAX Starter for explicit Japanese carrier mobile IPs.

---

### 11. Japan-Specific Proxy Providers (Non-Global)

No Japan-headquartered proxy companies with their own residential IP network were identified. All major residential/mobile proxy networks are Western-headquartered (US, EU, Lithuania). However, several providers have Japan-specific dedicated pages with Japan-only IP pools:

- **LumiProxy** (lumiproxy.com/jp): 4,174,773 Japan IPs claimed. Chinese-operated but Japan-focused page.
- **Litport.net**: Lists Japan proxies with 22,386,728 IPs claimed (likely aggregated). Supports mobile, residential, ISP, datacenter.
- **Infatica**: 100,000+ Japan IPs.
- **Froxy**: Mobile and residential Japan IPs.

Note: Smaller/less-known providers carry higher risk of poor IP quality, overselling pools, or security concerns. LumiProxy and Litport have not been independently verified for quality.

---

### 12. Self-Hosted Japan Mobile Proxy (SIM Card)

**Is it practical?** Yes, but with caveats.

**Hardware needed:**
- Raspberry Pi 4 (~$50-80)
- USB 4G modem with HiLink interface (Huawei E3372 or similar, ~$30-50)
- Japanese SIM card with data plan

**Software:** 3proxy or similar, plus huawei-lte-api for IP rotation via modem reset

**Japan SIM options:**
- **IIJmio** (NTT Docomo backbone): ~¥1,100-2,000/month, tethering allowed on data plans
- **NTT Docomo direct**: Tethering permitted with no stated cap, but unlimited plans have daily high-speed limits
- **SoftBank/au**: Prepaid tourist SIMs restrict tethering; postpaid plans permit it with caveats
- **Rakuten Mobile**: ¥3,278/month unlimited data (including tethering) - most favorable for this use case

**Critical issue with carrier ToS:** Using a SIM card to run a commercial proxy service almost certainly violates Japanese carrier terms of service. Personal use (running your own scraper through your own SIM) occupies a gray area. Rakuten Mobile has the most permissive terms but explicitly forbids "operating a proxy server service" for third parties.

**Cost comparison:**
- Rakuten Mobile unlimited: ¥3,278/month (~$22/month) for truly unlimited data
- Hardware one-time: ~$100-150
- Break-even vs. BrightData PAYG: ~8-12 months

**Practical limitations:**
- Single modem = single IP at a time (one session at a time)
- IP rotation requires modem reset (takes 10-30 seconds to get new IP)
- Power outages/network instability cause downtime
- Physical presence or remote power cycling needed for hardware issues
- Mobile IP changes are not instantaneous like proxy provider APIs

**Verdict:** Self-hosted is viable for a single-threaded personal scraper with low volume. Not practical if you need multiple concurrent sessions or reliable uptime without hands-on maintenance. The $22/month Rakuten SIM + one-time hardware cost beats commercial providers for pure cost after month 5-6, but the operational burden is significant.

---

## Comparative Analysis

| Criterion | BrightData | SOAX | IPRoyal | Oxylabs | Decodo |
|-----------|-----------|------|---------|---------|--------|
| Japan IP count | 179,884 | 210,600 | Not disclosed | 2,633,211 | Not disclosed |
| NTT Docomo targeting | Unconfirmed | YES | Unconfirmed | Unconfirmed | No |
| SoftBank targeting | Unconfirmed | YES | Unconfirmed | Unconfirmed | No |
| au (KDDI) targeting | Unconfirmed | YES | Unconfirmed | Unconfirmed | No |
| Residential PAYG | $4/GB | N/A | $1.75/GB | $6/GB | $4/GB |
| Mobile pricing | $8/GB | $3.60/GB | $117/mo flat | $9/GB | Not listed |
| Min monthly cost | $0 (PAYG) | $90 | $0 (PAYG) | $30 | $11.25 |
| Sticky sessions | Yes | Yes | Yes | Yes | Yes |
| Prefecture targeting | Yes | 47 prefectures | Limited | City level | Country only |
| Reliability rating | Highest | High | Medium | Highest | High |

---

## Sources

1. [BrightData Japan Location Page](https://brightdata.com/locations/jp) — Japan IP count (179,884), proxy types, city targeting (Tokyo/Osaka/Saitama), pricing tiers. Accessed 2026-03-31.

2. [BrightData Residential Proxies Pricing](https://brightdata.com/pricing/proxy-network/residential-proxies) — Full pricing tiers $2.50-$4/GB. Accessed 2026-03-31.

3. [BrightData Mobile Proxies Pricing](https://brightdata.com/pricing/proxy-network/mobile-proxies) — Mobile pricing $5-$8/GB. Accessed 2026-03-31.

4. [SOAX Japan Proxies](https://soax.com/proxies/locations/japan) — 210,600 IPs, explicit NTT Docomo/SoftBank/au carrier list, 47 prefectures, pricing tiers. Accessed 2026-03-31.

5. [Oxylabs Japan Proxy Page](https://oxylabs.io/location-proxy/japan) — 2,633,211 residential IPs, Tokyo/Yokohama city data, pricing from $6/GB residential, $9/GB mobile. Accessed 2026-03-31.

6. [Oxylabs Residential Pricing](https://oxylabs.io/pricing/residential-proxy-pool) — Full pricing tiers $2.50-$6/GB. Accessed 2026-03-31.

7. [IPRoyal Pricing](https://iproyal.com/pricing/) — Residential from $1.75/GB, mobile from $117/month. Accessed 2026-03-31.

8. [Decodo Residential Pricing](https://decodo.com/proxies/residential-proxies/pricing) — Pricing from $2.00-$4.00/GB. Accessed 2026-03-31.

9. [Proxyway Japan Proxy Comparison](https://proxyway.com/proxy-locations/japan-proxy) — Top 5 Japan providers comparison, 500-connection testing. Accessed 2026-03-31.

10. [Scrapfly: How to Bypass Akamai](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping) — Akamai trust score by IP type, rotation vs. sticky session guidance, JP country targeting. Accessed 2026-03-31.

11. [RapidSeedbox: Sticky Session Proxies](https://www.rapidseedbox.com/blog/sticky-session-proxies) — Sticky vs. rotating proxy use cases, duration guidelines, 40% success rate improvement for multi-step flows. Accessed 2026-03-31.

12. [PrivateProxyReviews: Proxies for Akamai](https://www.privateproxyreviews.com/proxies-to-bypass-akamai/) — Provider recommendations for Akamai bypass. Accessed 2026-03-31.

13. [ScrapingFish: Build Your Own Mobile Proxy](https://scrapingfish.com/blog/byo-mobile-proxy-for-web-scraping) — Hardware setup, Raspberry Pi + USB modem guide, HiLink API. Accessed 2026-03-31.

---

## Confidence Assessment

- **High confidence**: BrightData, Oxylabs, Decodo, IPRoyal pricing — fetched directly from official pricing pages.
- **High confidence**: SOAX Japan carrier list (NTT Docomo, SoftBank, au confirmed) — fetched directly from SOAX Japan page.
- **High confidence**: Akamai trust score behavior (datacenter = negative, residential = positive, mobile = highest) — consistent across multiple independent technical sources.
- **High confidence**: Sticky session requirement for login-based scraping — multiple sources confirm.
- **Medium confidence**: ConoHa AS23916 behavior — no specific public blacklist entry found, but general datacenter IP classification by Akamai is well-documented and applies universally.
- **Medium confidence**: Self-hosted Japan SIM feasibility — hardware setup guides confirmed, but Japan-specific carrier ToS for tethering/proxy use was not definitively confirmed from official carrier documentation.
- **Low confidence**: BrightData Japan carrier targeting (Docomo/SoftBank/au) — stated as possible ("target any carrier") but not explicitly listed, may require contacting sales to confirm Japan mobile carrier ASNs.

## Information Gaps

- BrightData does not publish which specific Japanese carrier ASNs are available in their mobile proxy pool. Confirmation requires creating an account or contacting sales.
- No independent benchmark data found comparing real scraping success rates against Akamai between provider types (e.g., SOAX mobile vs. BrightData residential on a specific Japanese protected site).
- No Reddit threads found discussing SalonBoard or HPB scraping specifically — forum discussion exists for Akamai bypass generally but not Japan appointment sites.
- Japanese carrier ToS for running personal proxy/tethering on unlimited data plans not verified against official Japanese-language carrier documentation.
- Litport.net and LumiProxy Japan-focused providers not independently reviewed — IP quality and reliability unknown.
