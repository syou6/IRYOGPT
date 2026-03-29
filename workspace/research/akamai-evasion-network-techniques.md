# Research: Network-Level Akamai Bot Manager Evasion for VPS-Based Scraping (Japan)

**Date**: 2026-03-30
**Scope**: VPS-based scraper (ConoHa, Japan) targeting Japanese websites protected by Akamai Bot Manager

---

## Executive Summary

Akamai Bot Manager operates across five simultaneous detection layers: IP reputation/ASN classification, TLS fingerprinting (JA3/JA4), HTTP/2 protocol fingerprinting, JavaScript sensor data, and behavioral analysis. No single evasion technique is sufficient alone. For a ConoHa VPS targeting Japanese sites, the ConoHa ASN (GMO Internet / AS7684) is classified as datacenter and will receive an immediate negative trust score. The only viable path is routing all scraping traffic through Japan residential proxies — specifically BrightData or Oxylabs — combined with correct TLS and HTTP/2 fingerprint impersonation.

---

## 1. Residential Proxy Services: Japan Comparison

### How Akamai Scores IPs

Akamai classifies IPs into three trust tiers before any behavioral analysis occurs:

- **Residential IPs** (home ISP): Positive trust score. High cost to acquire at scale, therefore low bot association.
- **Mobile IPs** (cellular carrier): Positive trust score. Tower-assigned, difficult to coordinate.
- **Datacenter IPs** (cloud/VPS/hosting): Negative trust score. Automatically suspicious. ConoHa falls here.

The detection compares requesting IPs against databases of known IP providers and public WHOIS/ASN records. A datacenter ASN like AWS AS16509 or GMO AS7684 will fail IP trust checks before Akamai even examines behavioral signals.

### Provider Comparison for Japan

| Provider | Japan IP Pool | Global Pool | Pricing (Residential) | Sticky Session | ISP Targeting | Akamai Performance |
|----------|--------------|-------------|----------------------|----------------|---------------|-------------------|
| **BrightData** | Undisclosed (large) | 150M+ | $2.50–$4.00/GB | Up to 30 min | Yes (ISP proxy product) | Best-in-class |
| **Oxylabs** | 2,633,211 IPs | 175M+ | $8/GB | Configurable | ASN targeting available | Excellent |
| **Decodo (SmartProxy)** | Undisclosed | 115M+ | $2.20–$3.00/GB | Configurable | Limited | Good |
| **NetNut** | 52M+ (global) | 52M+ | Subscription-based | Configurable | No | Good |
| **IPRoyal** | Undisclosed | 8M+ | $2.45–$7.00/GB | Configurable | No | Moderate |
| **Webshare** | 30M+ (global) | 30M+ | Varies | Configurable | No | Moderate |

**Key findings:**

**BrightData** is the most cited provider for Akamai-protected sites. Their ISP Proxy product provides "real residential IPs purchased or leased directly from ISPs for commercial use" — target sites treat these identically to residential IPs but with datacenter-level stability and uptime (99.99%). Pricing starts at $2.50/GB at enterprise scale. Their residential pool supports sticky sessions up to 30 minutes.

**Oxylabs** is the only provider that publicly documents Japan IP count: 2.63 million residential IPs. They support ASN targeting (allowing you to specify NTT, KDDI, or SoftBank ASNs), city-level targeting (Tokyo: 16,895; Yokohama: 1,024 specifically enumerated), and both IPv4 and IPv6. Pricing is $8/GB which is higher than competitors. Latency testing from April 2025 shows Oxylabs residential proxies were "faster than most competitors by as many as five times" in independent benchmarks.

**Decodo (formerly SmartProxy)** is the budget option at $2.20–$3.00/GB with 115M+ IPs and 195+ countries. Their Site Unblocker product targets CAPTCHA and anti-bot evasion specifically. Less documented Akamai performance than BrightData/Oxylabs.

**IPRoyal and Webshare** are budget-tier providers with smaller pools. Not recommended for Akamai-protected high-security targets — their smaller Japan pools mean higher IP reuse, faster reputation degradation.

**NetNut** uses a subscription model (not per-GB), which makes it expensive for low-volume scraping but cost-effective for sustained high-volume operations.

### Which Works Best Against Akamai

Industry consensus from scraping communities in 2025–2026: **BrightData residential > Oxylabs residential > Decodo**. The reasons:

1. Pool size matters — larger pools mean lower per-IP reuse, slower reputation decay
2. ISP proxy products (BrightData, Oxylabs) provide static residential-equivalent IPs with high uptime
3. Providers with direct ISP relationships have cleaner IP histories (less contamination from prior users)

---

## 2. Proxy Rotation Strategies

### Sticky Sessions vs. Per-Request Rotation

**For Akamai-protected sites with session state (login flows, booking systems): use sticky sessions.**

Akamai's `_abck` cookie and `bm_sz` cookie are session-bound. If your IP changes mid-session, the cookie becomes invalid and triggers a re-challenge. For multi-step workflows (search → select → book), you must maintain the same IP for the entire session.

Sticky session durations by provider:
- BrightData: up to 30 minutes
- Oxylabs: configurable (typically 10–30 minutes)
- Decodo: configurable

**For pure read-only scraping (no login): rotate per logical session, not per request.**

Rotating on every single HTTP request creates an unnatural pattern — real browsers do not change IPs between page loads. Rotate IPs between complete page scraping sessions (i.e., one IP per "visit" that fetches the page and all its resources).

### Geographic Consistency

Anti-bot systems implement "impossible travel detection": switching from a Tokyo IP to an Osaka IP within seconds is technically plausible, but switching from Tokyo to London within 2 seconds is flagged. More importantly for Japanese sites:

- Stay within Japan. Do not use non-Japan IPs even if the site is globally accessible.
- Prefer Tokyo or Osaka for Japanese e-commerce/healthcare sites — these are the expected user demographics.
- If the target site serves specific prefectures (regional hospital/clinic directories), use city-level targeting to match that prefecture.

### ISP-Targeted Proxies (NTT, KDDI, SoftBank)

Oxylabs supports ASN targeting, which lets you specify Japanese carrier ASNs:
- NTT Communications: AS4713
- NTT Docomo: AS9605
- KDDI: AS2516
- SoftBank: AS17676

BrightData's ISP proxy network similarly sources from ISPs directly. Targeting a major Japanese ISP like NTT dramatically improves trust scores because:
1. These ASNs are associated with legitimate residential internet access
2. They are not in datacenter blocklists
3. Behavior analytics expect patterns consistent with Japanese home broadband users

### Rotation Timing

Fixed intervals create machine-detectable rhythms. Anti-bot systems detect rotation at exactly 60-second intervals. Use randomized intervals:
- Base interval: 30–120 seconds between IP rotations (not per-request)
- Add jitter: ±20–40% random variation on the base interval
- Avoid rotating during active session state — wait for a complete logical task unit to finish

---

## 3. IP Reputation Management

### How Akamai Scores IPs

Akamai checks IPs against multiple reputation databases in real-time:
- Spamhaus (spam/malware associations)
- Project Honey Pot (web scraping/fraud)
- IPQS (IP Quality Score — fraud, proxy, VPN detection)
- Internal Akamai threat intelligence databases

Reputation operates as a **multiplier** across detection factors. A clean residential IP with perfect behavioral signals and correct TLS fingerprint can still be blocked if it's in a blacklist. Conversely, a slightly imperfect behavioral profile can pass if the IP has excellent reputation.

**Key characteristic of reputation decay:** IP reputation decays slowly when clean, but IPs flagged across multiple blacklists "may remain flagged indefinitely." Shared proxy pool contamination is a major risk — one abusive user on the same proxy IP damages reputation for all subsequent users.

### VPS/Datacenter IP Detection (ASN-Based)

ConoHa VPS operates under GMO Internet Group. The relevant ASNs:
- GMO Internet: AS7684
- GMO Cloud: AS23647

These ASNs are publicly listed as commercial hosting providers. Any anti-bot system with an ASN database (all major ones) will classify these as datacenter IPs before examining any other signals. **Direct scraping from ConoHa IPs against Akamai-protected sites will fail at the first detection layer.**

The detection mechanism: WHOIS records from APNIC (Asia-Pacific Network Information Centre) publicly document these ASN ranges as commercial hosting. Akamai's IP intelligence database has this indexed.

### IP Warming Techniques

"IP warming" involves gradually building a positive request history for an IP before using it for scraping:

1. **Initial period**: Use the IP only for benign, human-like browsing (home page, static assets) at very low request rates (1–2 requests/minute)
2. **Gradual increase**: Over 24–48 hours, slowly increase request frequency while maintaining clean behavioral signals
3. **Avoid simultaneous activation**: Do not activate many new IPs at the same time — coordinated new-IP activity is itself a bot signal
4. **Session diversity**: Access different pages/endpoints rather than repeatedly hitting the same URL

In practice, for commercial residential proxy pools, warming is less critical because the IPs have existing legitimate traffic history from other users of the proxy service. The main concern is **contamination** — selecting IPs that were recently used abusively.

### IPv6 Rotation Possibilities

IPv6 rotation offers practical advantages for IP exhaustion scenarios:
- IPv6 address space (340 undecillion addresses) makes rotation across fresh IPs trivial
- IPv6 pools have historically cleaner reputation (less abuse history than IPv4)
- A well-tuned IPv6 rotation system reportedly cut CAPTCHA prompts by 80–90% compared to static IPv4 proxies in testing

**Caveats for Akamai specifically:**
- Akamai handles IPv6 traffic and applies the same ASN classification rules
- IPv6 datacenter ranges are still classified as datacenter
- Japan IPv6 adoption by residential ISPs (NTT Flets Hikari supports IPv6) means residential IPv6 is feasible
- Oxylabs explicitly offers IPv6 proxies with Japan coverage

---

## 4. DNS-Level Evasion

### DNS Fingerprinting Risk

DNS queries from a VPS scraper can leak information even when using proxies if the DNS resolver is not routed through the proxy. This creates a "DNS leak" where:
- The proxy hides the HTTP traffic source IP
- But DNS queries go directly from the VPS's local resolver to public DNS (e.g., 8.8.8.8)
- Akamai can correlate DNS query patterns with HTTP request patterns to identify automation

While Akamai does not primarily detect bots via DNS, DNS leaks can expose the true origin infrastructure and assist in correlation attacks.

### DNS-over-HTTPS (DoH) Configuration

Route all DNS resolution through the proxy to prevent leaks:

**Option 1: Route DNS through SOCKS5 proxy**
Most SOCKS5 proxies support remote DNS resolution. In Python with `requests` via SOCKS5:
```
socks5h://user:pass@proxy-host:port
```
The `h` suffix (SOCKS5h) sends DNS resolution to the proxy server, not locally.

**Option 2: System-wide DoH**
Configure the OS to use DNS-over-HTTPS via a trusted resolver (Cloudflare `1.1.1.1`, Google `8.8.8.8`, or NextDNS). On Linux:
```
# /etc/systemd/resolved.conf
[Resolve]
DNS=1.1.1.1
DNSOverTLS=yes
```

**Option 3: Proxy-integrated DNS**
When using BrightData or Oxylabs, routing through their proxy gateway automatically resolves DNS at the proxy endpoint, eliminating VPS-origin DNS leaks.

### Practical Recommendation

For a VPS-based scraper, the simplest correct solution is to use SOCKS5h (with remote DNS) for all connections. This routes both traffic and DNS resolution through the residential proxy, ensuring the target site sees DNS queries originating from the same residential IP range as the HTTP traffic.

---

## 5. HTTP Header Ordering

### Why Header Order Matters

Akamai inspects HTTP headers at two levels:
1. **Presence and values**: Whether expected headers exist and have plausible values
2. **Order**: The sequence in which headers appear in the request

Different HTTP clients produce different default header ordering. Python's `requests` library sends headers in a different order than Chrome, and this ordering is detectable before any content analysis.

### Chrome's Default HTTP/1.1 Header Order

Chrome (as of v120+) sends headers in approximately this order:
```
:method
:authority
:scheme
:path
Host
Connection
Cache-Control
sec-ch-ua
sec-ch-ua-mobile
sec-ch-ua-platform
Upgrade-Insecure-Requests
User-Agent
Accept
Sec-Fetch-Site
Sec-Fetch-Mode
Sec-Fetch-User
Sec-Fetch-Dest
Accept-Encoding
Accept-Language
Cookie
```

### HTTP/2 Pseudo-Header Order

In HTTP/2, the four pseudo-headers must appear first, and their ordering is browser-specific:

| Client | Pseudo-header order |
|--------|---------------------|
| Chrome | `:method`, `:authority`, `:scheme`, `:path` (MASP) |
| Firefox | `:method`, `:path`, `:authority`, `:scheme` (MPAS) |
| Safari | `:method`, `:scheme`, `:path`, `:authority` (MSPA) |
| curl | `:method`, `:path`, `:scheme`, `:authority` (MPSA) |

Akamai checks pseudo-header order as part of its HTTP/2 fingerprint. A scraper claiming to be Chrome but sending pseudo-headers in Firefox or curl order is immediately flagged.

### HTTP/2 SETTINGS Frame Values (Chrome)

Chrome sends these specific SETTINGS values at connection establishment:
- `SETTINGS_HEADER_TABLE_SIZE`: 65536
- `SETTINGS_MAX_CONCURRENT_STREAMS`: 1000
- `SETTINGS_INITIAL_WINDOW_SIZE`: 6291456 (6 MB)
- `SETTINGS_MAX_HEADER_LIST_SIZE`: 262144

Chrome's WINDOW_UPDATE increment: ~15,663,105 bytes (~15 MB)

Any HTTP client using different SETTINGS values while claiming to be Chrome will produce a mismatched HTTP/2 fingerprint. Libraries like `curl-cffi` (Python) and `httpcloak` (Go) correctly impersonate these values.

### Implementation

Use `curl-cffi` in Python to get correct TLS + HTTP/2 fingerprint impersonation:
```python
from curl_cffi import requests as cfreqs
session = cfreqs.Session(impersonate="chrome120")
response = session.get("https://target.jp", proxies={"https": "socks5h://user:pass@proxy:port"})
```

This library correctly sets:
- JA3/JA4 TLS fingerprint matching Chrome
- HTTP/2 SETTINGS frame values
- Pseudo-header ordering (MASP)
- WINDOW_UPDATE values

---

## 6. Network Timing

### TCP Window Size Fingerprinting

The TCP SYN packet carries OS-identifying information in its initial window size and options:

| OS | Initial TCP Window Size |
|----|------------------------|
| Linux kernel 3.x | 29,200 bytes |
| Linux kernel 5.x–6.x | 64,240 bytes |
| Windows 10/11 | 65,535 bytes (with scaling) |
| macOS | 65,535 bytes |

A VPS running Ubuntu Linux 22.04 (kernel 5.15) will have a TCP window of 64,240 bytes — this is consistent with a Linux server, not a Windows desktop. While this alone is not a block trigger, it contributes to the overall fingerprint profile.

**Mitigation**: TCP window size modification at the kernel level (`sysctl net.ipv4.tcp_rmem`), though this is an advanced technique with limited practical impact since Akamai primarily focuses on application-layer signals.

### Connection Reuse Patterns

Real browsers maintain persistent HTTP/2 connections and multiplex multiple requests over a single connection. Scrapers that open a new connection per request are detectable via:
- Connection establishment frequency
- TCP handshake patterns
- Session ticket reuse (TLS session resumption)

**Recommended pattern**: Reuse sessions (HTTP/2 persistent connections with session cookies) across multiple requests within a scraping session. This matches browser behavior and reduces connection overhead.

### Request Pipelining and Rate

Real browsers do not fire requests at precisely regular intervals. Behavior patterns to implement:
- **Inter-request delays**: 1–8 seconds between page loads (not milliseconds)
- **Jitter**: Add random variation (±30–50% of base delay)
- **Think time simulation**: Longer pauses after "reading" content (5–15 seconds before the next action)
- **Concurrency limits**: Maximum 1–2 concurrent requests per session (browsers typically have 6 per domain but a single user rarely hits multiple pages simultaneously)

Fixed timing patterns (e.g., exactly 3.000 seconds between every request) are flagged as "machine-detectable rhythm" by anti-bot systems.

---

## 7. VPN/Tunnel Options

### WireGuard Through Residential Exit Nodes

Architecture:
```
[ConoHa VPS] → [WireGuard tunnel] → [Residential proxy gateway] → [Target site]
```

Implementation using `wireproxy`:
- `wireproxy` is a userspace WireGuard client that exposes itself as a SOCKS5 or HTTP proxy
- It can connect to a WireGuard endpoint at a residential proxy provider
- Traffic exits the residential provider's network with a residential IP

**Practical limitation**: Very few residential proxy providers offer WireGuard endpoints. This architecture is typically used with self-hosted residential exit nodes (e.g., a Raspberry Pi on a home ISP connection), not commercial proxy services.

**Residential proxy commercial services** (BrightData, Oxylabs) typically expose HTTPS or SOCKS5 proxy endpoints, not WireGuard peers. Routing WireGuard through them adds unnecessary complexity.

### SSH SOCKS Proxy Through Residential IPs

A simpler architecture for custom residential exit nodes:
```
[ConoHa VPS] → SSH → [Home server / Raspberry Pi on NTT residential connection] → [Target site]
```

```bash
# On ConoHa VPS: create SOCKS5 proxy through home server
ssh -D 1080 -N -f user@home-server.example.jp

# Use in Python scraper
proxies = {"https": "socks5h://127.0.0.1:1080"}
```

**Advantages**:
- Exit IP is a genuine residential NTT/KDDI/SoftBank address
- No per-GB proxy costs
- You control the IP (no contamination from other users)
- Can maintain persistent connection for long-running scrapers

**Disadvantages**:
- Single IP (no rotation without multiple home servers)
- Bandwidth limited by home upstream (typically 100–500 Mbps but shared)
- IP can be banned without rotation option
- Requires maintaining the home server infrastructure

### Tor — Why It Is Not Recommended

Tor is not suitable for this use case for four reasons:

1. **Detection**: Tor exit node IP ranges are publicly listed and maintained in real-time databases. IPQS and similar services track all Tor exit nodes. Akamai blocks Tor exit IPs automatically.

2. **Performance**: Traffic traverses 3 relays globally, adding 200–500ms latency minimum. Japanese sites with Tor exit nodes in Japan are limited — few Japanese Tor exit nodes exist, so traffic typically routes through nodes in Europe/US.

3. **Geographic inconsistency**: Selecting Japan-only exit nodes (`ExitNodes {JP}` in torrc) dramatically limits available nodes, making connections unstable or unavailable.

4. **Abuse history**: Tor exit nodes have extensive abuse histories in all reputation databases, giving them among the worst IP trust scores possible.

**Verdict**: Do not use Tor for scraping Akamai-protected sites.

---

## 8. ConoHa VPS — Specific Considerations

### ASN and IP Reputation

ConoHa VPS is operated by GMO Internet Group. Their primary ASNs:
- **AS7684** (GMO Internet, Inc.) — main datacenter infrastructure
- **AS23647** (GMO Cloud K.K.) — cloud hosting services

These ASNs are in every major datacenter detection database. When a request arrives from a ConoHa IP:
1. Akamai's IP intelligence database immediately classifies it as "datacenter/hosting"
2. Trust score drops to minimum before any other analysis
3. Even perfect TLS fingerprinting and behavioral signals cannot overcome the ASN classification for high-security targets

**Verdict**: ConoHa IPs must not be used as the exit IP for requests to Akamai-protected Japanese sites. All scraping traffic must exit through residential proxy IPs.

### Recommended Architecture

```
[ConoHa VPS - scraping logic]
    ↓ SOCKS5h connection
[Residential Proxy Gateway - BrightData/Oxylabs]
    ↓ Japan residential IP (NTT/KDDI/SoftBank ASN)
[Target Japanese Website - Akamai protected]
```

The ConoHa VPS handles all scraping logic, scheduling, and data storage. It never touches the target site directly. All outbound HTTP requests route through the residential proxy.

### Split Approach: Login vs. Scheduled Checks

For systems with both authentication and periodic data checks, consider:

**Login/authentication**: Always through residential proxy (high-security operation, triggers Akamai's most aggressive detection)

**Low-sensitivity polling** (e.g., checking if a page is up, fetching public static content): Can potentially be done directly from ConoHa if the content is truly public and unprotected, but this creates inconsistency in the access pattern that sophisticated systems may detect. Generally, route everything through the proxy for consistency.

**API endpoints** (if the target exposes undocumented APIs): These often have lighter bot detection than HTML pages. Test whether the API endpoint has Akamai protection before deciding on proxy routing.

---

## Comparative Analysis: Proxy Strategy Options

| Strategy | IP Quality | Rotation | Cost | Complexity | Akamai Bypass Rate |
|----------|-----------|----------|------|------------|-------------------|
| Direct ConoHa | Datacenter | N/A | Free | Low | ~0% |
| BrightData Residential | High | Excellent | $2.50–$4.00/GB | Medium | ~85–95% |
| BrightData ISP Proxy | High | Static/configurable | Higher | Medium | ~90–95% |
| Oxylabs Residential (Japan) | High | Excellent | $8/GB | Medium | ~85–95% |
| Decodo Residential | Medium-High | Good | $2.20–$3.00/GB | Medium | ~75–85% |
| SSH through home server | Highest (genuine) | None | Infrastructure only | High | ~95%+ |
| Tor | Blacklisted | Auto | Free | Low | ~0% |
| IPv6 residential rotation | Medium-High | Excellent | Provider-dependent | Medium-High | ~70–80% |

---

## Sources

1. [How to Bypass Akamai when Web Scraping in 2026 - Scrapfly](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping) — Detection layers, IP trust scoring, residential proxy effectiveness
2. [Outsmarting Akamai's Bot Detection with JA3Proxy - HackerNoon](https://hackernoon.com/outsmarting-akamais-bot-detection-with-ja3proxy) — JA3 fingerprinting details, HTTP/2 header inspection
3. [HTTP/2 Fingerprinting - lwthiker.com](https://lwthiker.com/networks/2022/06/17/http2-fingerprinting.html) — Chrome SETTINGS frame values, pseudo-header ordering, WINDOW_UPDATE values
4. [Proxy Rotation & ASN Diversity: Detection Impact - PlainProxies](https://plainproxies.com/blog/uncategorized/proxy-rotation-asn-diversity-ip-reputation-detection) — ASN classification mechanics, geographic consistency, rotation timing
5. [Bypass Akamai Bot Manager - RoundProxies](https://roundproxies.com/blog/bypass-akamai/) — _abck cookie mechanism, proxy type requirements
6. [Residential Proxy Bot Detection Using ML - Cloudflare Blog](https://blog.cloudflare.com/residential-proxy-bot-detection-using-machine-learning/) — How ML detects residential proxy abuse, behavioral signals
7. [Oxylabs Japan Proxy Page](https://oxylabs.io/location-proxy/japan) — Japan IP count (2.63M), Tokyo/Yokohama breakdown, ASN targeting
8. [BrightData Residential Proxies Pricing](https://brightdata.com/pricing/proxy-network/residential-proxies) — Pricing tiers ($2.50–$4.00/GB), plan structures
9. [Ultimate Guide to Web Scraping Antibot Systems - WebAutomation.io](https://webautomation.io/blog/ultimate-guide-to-web-scraping-antibot-and-blocking-systems-and-how-to-bypass-them/) — Akamai-specific detection and evasion strategies
10. [IPv6 Rotating Proxy Guide - RapidSeedbox](https://www.rapidseedbox.com/blog/rotating-ipv6-proxy-scraping) — IPv6 rotation advantages, clean reputation, CAPTCHA reduction data
11. [Web Scraping with Tor - ScrapingAnt](https://scrapingant.com/blog/web-scraping-tor-python) — Tor limitations for scraping
12. [ipapi.is](https://ipapi.is/) — IP classification methodology, datacenter detection approach
13. [Sticky vs. Rotating Proxies - ZenRows](https://www.zenrows.com/blog/sticky-vs-rotating-proxies) — Session management strategy

---

## Confidence Assessment

- **High confidence**: Akamai's 5-layer detection model (IP/ASN, TLS, HTTP/2, JS, behavior); Chrome's HTTP/2 SETTINGS values; ConoHa datacenter classification; BrightData and Oxylabs pricing; pseudo-header ordering by browser — all verified from primary technical sources
- **Medium confidence**: Japan-specific IP pool sizes (Oxylabs 2.63M directly confirmed; BrightData not disclosed); ISP targeting availability (documented for Oxylabs, inferred for BrightData); exact Akamai bypass rates (industry estimates, not independently audited)
- **Low confidence / Unverified**: ConoHa-specific ban rate in practice; exact NTT/KDDI/SoftBank ASN filtering effectiveness against Akamai specifically; IPv6 residential availability from Japanese ISPs through proxy providers

## Information Gaps

- BrightData does not publicly disclose Japan-specific IP counts (requires sales inquiry)
- No public benchmark comparing BrightData vs. Oxylabs specifically against Japanese Akamai deployments
- ConoHa's exact ASN numbers need verification against current APNIC WHOIS records
- Sticky session maximum durations for Oxylabs Japan-targeted residential not explicitly documented
- Whether Japanese health/medical sites (target vertical) have Akamai configuration at "Premier" tier (most aggressive) vs. standard tier — this significantly affects bypass difficulty
