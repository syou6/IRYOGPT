# What Major Bot Detection Systems Actually Measure

## DataDome

**Signal count**: 35+ signals per session

**Behavioral signals collected**:
- Mouse velocity, acceleration, and curvature
- Scroll speed and pause patterns
- Typing inter-key timing and error corrections
- Click coordinate placement relative to elements
- Page focus/blur event patterns
- Copy-paste behavior patterns
- Dwell time on elements

**ML approach**: Real-time behavioral profile built per visitor, compared against known human baselines.

**Bot-specific patterns they detect**:
- Static scroll behavior (same height at fixed intervals)
- Form filling faster than humanly possible
- Navigating multiple pages simultaneously
- Mouse movements in perfect straight lines
- Zero dwell time before clicks

**Bypass success rates** (per proxies.sx guide, 2026):
- Bezier curve mouse + variable scroll + log-normal delays + mobile proxies + Camoufox: 89-95%

---

## Akamai Bot Manager

**Detection layers**:
1. **TLS fingerprinting (JA3/JA4)**: Captures TLS extension ordering and signature algorithm combinations. JA4 (introduced ~2024-2025) catches automation libraries that had learned to spoof JA3 hashes.
2. **Browser integrity checks**: Navigator properties, plugin lists, screen dimensions
3. **Behavioral analysis**: Mouse movements, timing, interaction patterns
4. **Rate limiting**: Adaptive based on behavioral score

**Key advancement**: JA4 fingerprinting is significantly harder to spoof than JA3 because it captures more TLS handshake specifics. Tools like CycleTLS (https://github.com/Danny-Dasilva/CycleTLS) handle JA3; JA4 support is still evolving.

**Evasion difficulty**: HIGH — requires both behavioral simulation AND TLS fingerprint matching.

---

## PerimeterX / HUMAN Security

**JavaScript sensor**: `px.js` (injected script)

**What px.js collects**:
1. Device/browser fingerprint (navigator properties)
2. Behavioral biometrics: mouse movements, keystrokes, interaction patterns
3. Timing intervals between actions
4. Browser capability metrics
5. Cookie validation: `_px3`, `_pxvid`, `_pxhd` tokens

**Detection approach**: Predictive scoring model; assigns risk score per request.

**Bypass approach**:
- Intercept and replay valid `_px3` cookies from real browsers (short TTL, ~60-120s)
- Generate valid tokens requires solving their HMAC challenge
- Behavioral simulation alone insufficient; need valid cookie chain

---

## Cloudflare Bot Management

**Coverage**: ~20% of all web traffic

**Detection stack**:
1. IP reputation (datacenter ASNs blocked first pass)
2. TLS fingerprinting
3. JavaScript challenge (generates `cf_clearance` cookie)
4. Browser fingerprinting via Challenge page
5. Behavioral analysis on protected pages

**Challenge types**:
- **Managed Challenge**: Automatic, invisible to humans (behavioral analysis only)
- **Interactive Challenge (CAPTCHA)**: Appears when confidence is low
- **Turnstile**: Privacy-preserving replacement for CAPTCHA (2023+)

**Key signal**: Runtime.enable CDP call is detectable by Cloudflare. rebrowser-patches (https://github.com/rebrowser/rebrowser-patches) patches this leak.

---

## GeeTest

**Specialty**: CAPTCHA challenges + behavioral analysis
**Known defense against BotBrowser (2025)**:
- Cross-platform spoofing detection (if OS says Windows but behavior says Mac)
- Device sensor consistency checks

---

## Common Across All Systems

**Universal bot signals**:
| Signal | Bot Behavior | Human Behavior |
|--------|--------------|----------------|
| Mouse path | Straight line | Curved, with micro-corrections |
| Click timing | <10ms after cursor arrival | 50-500ms hover |
| Scroll | Constant velocity | Variable, reading-paced |
| Typing | Constant IKI | Variable, digraph-dependent |
| Session | Single goal, direct | Wandering, exploratory |
| Focus/blur | Never blurs | Occasional tab switching |
| Right-click | Never | Occasional |
| Referrer | Missing/wrong | Correct chain |

**Timing analysis** (most powerful signals):
- Zero think-time between page load and interaction
- Perfectly periodic action intervals
- Action precisely aligned with page load completion (no processing delay)

---

## Detection System Bypassing Priority

1. **IP layer** (hardest limit): Use residential proxies, avoid datacenter IPs
2. **TLS fingerprint**: Use real browser (not automation library's default TLS)
3. **Browser fingerprint**: Use Camoufox, nodriver, or rebrowser-patches
4. **Behavioral signals**: Implement all techniques from other research files
5. **Session patterns**: Markov chain navigation, circadian timing

Without solving layer 1 (IP reputation), behavioral simulation alone will fail.
