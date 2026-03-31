# Academic Research: Browser Automation Detection & Evasion (2024-2026)

> Research compiled: 2026-03-31
> Focus: Peer-reviewed papers from IEEE, ACM, USENIX, arXiv on bot detection and evasion

---

## 1. Fingerprint Inconsistency Detection

### FP-Inconsistent: Measurement and Analysis of Fingerprint Inconsistencies in Evasive Bot Traffic
- **Authors:** Hari Venugopalan, Shaoor Munir, Shuaib Ahmed, Tangbaihe Wang, Samuel T. King, Zubair Shafiq
- **Venue:** arXiv June 2024 (arXiv:2406.07647); ACM IMC 2025 (dl.acm.org/doi/10.1145/3730567.3732919)
- **Links:** https://arxiv.org/abs/2406.07647 | https://bob.cs.ucdavis.edu/assets/dl/fp-inconsistent.pdf

**What they did:** Deployed a honeypot website with two commercial anti-bot services (DataDome and BotD) and solicited traffic from 20 bot services claiming "realistic and undetectable traffic." Analyzed 500,000+ requests.

**Key findings:**
- Average evasion rate: **52.93% against DataDome**, **44.56% against BotD** across all 20 bot services
- Evasive bots struggle to maintain fingerprint *consistency* — they modify attributes but introduce contradictions
- Inconsistencies exist across *space* (two attributes at the same time) and *time* (one attribute at two different times)
- Example inconsistency: bot claims to be Chrome 120 on Windows but has a Canvas rendering characteristic of Linux

**Detection rules they derived:**
- Cross-attribute consistency rules (e.g., UserAgent + screen resolution + WebGL renderer must correlate)
- Temporal consistency rules (fingerprint must not change dramatically between page loads)
- Their rules reduced evasion rates by **48.11% against DataDome** and **44.95% against BotD**

**Practical implication for scraping:** If you spoof fingerprints, ALL spoofed attributes must be internally consistent. Changing UA to Chrome 124 but leaving WebGL GPU info unchanged creates a detectable contradiction. Tools like Camoufox address this by loading coherent fingerprint profiles.

---

## 2. TLS Fingerprinting for Bot Detection

### When Handshakes Tell the Truth: Detecting Web Bad Bots via TLS Fingerprints
- **Authors:** Ghalia Jarad, Kemal Bicakci
- **Venue:** arXiv, submitted February 10, 2026
- **Link:** https://arxiv.org/abs/2602.09606

**What they did:** Applied JA4 TLS fingerprinting with gradient-boosted ML (CatBoost, XGBoost) to classify bot vs. human traffic at the TLS handshake layer.

**Key findings:**
- **CatBoost model: AUC 0.998, F1 score 0.9734, accuracy 0.9863** — near-perfect bot detection from TLS alone
- Most discriminative features: `ja4_b` (cipher suite component), cipher count, extension count
- JA4 outperforms JA3 because it adds GREASE detection and more dimensions

**Practical implication:** Python's `requests` library, `httpx`, and `aiohttp` all produce non-browser TLS fingerprints. This is why services like CycleTLS and `curl_cffi` (which impersonates browser TLS) matter for evasion. A scraper using raw Python HTTP clients will be flagged at the network layer before any JavaScript even runs.

**Evasion state-of-art:** Tools like `curl_cffi` impersonate Chrome/Safari TLS fingerprints. CycleTLS spoofs JA3/JA4. However, the paper notes that HTTP/3 fingerprinting is a future expansion area — current QUIC-based connections are not yet covered.

---

## 3. Browser Fingerprinting Detection (ML & Static Analysis)

### Beyond the Crawl: Unmasking Browser Fingerprinting in Real User Interactions
- **Authors:** Meenatchi Sundaram Muthu Selva Annamalai, Igor Bilogrevic, Emiliano De Cristofaro
- **Venue:** WWW 2025 (February 2025, arXiv:2502.01608)
- **Link:** https://arxiv.org/abs/2502.01608

**What they did:** 30-participant user study, 10 weeks, real browsing across 3,000 top websites. Compared fingerprinting sites found by automated crawlers vs. real users.

**Key findings:**
- **Automated crawlers miss ~45% of fingerprinting websites** that real users encounter
- Crawlers fail to reach authentication-gated pages, login-only flows, and interaction-triggered scripts
- Proposed: federated learning on real user data for fingerprinting detection (privacy-preserving)

**Implication:** Detection systems tuned on crawler data have blind spots. Anti-bot vendors that only measure against automated baselines underestimate real-world fingerprinting. Conversely, scrapers operating in "logged-in" contexts may trigger detection scripts that baseline crawl-based research doesn't even know about.

---

### Byte by Byte: Unmasking Browser Fingerprinting at the Function Level Using V8 Bytecode Transformers
- **Venue:** arXiv, September 2025 (arXiv:2509.09950)
- **Link:** https://arxiv.org/html/2509.09950v1

**Key findings:**
- Fingerprinting detection using **V8 bytecode analysis** (not source code)
- Achieves **98.9% accuracy, 84.0% precision, 85.1% recall**
- Robust against JavaScript obfuscation — works even when source code is obfuscated
- Does not require dynamic execution context or predefined API lists

**Practical implication:** Traditional fingerprint script detection looked for known API calls (navigator.plugins, canvas.toDataURL). This paper shows that bytecode-level analysis survives obfuscation. Anti-detect browsers that obfuscate their injection scripts remain detectable.

---

### The WASM Cloak: Evaluating Browser Fingerprinting Defenses Under WebAssembly-based Obfuscation
- **Venue:** arXiv, August 2025 (arXiv:2508.21219)
- **Link:** https://arxiv.org/html/2508.21219v1

**What they did:** Evaluated what happens when fingerprinting scripts are converted from JavaScript to WebAssembly (WASM).

**Key findings:**
- **JS-to-WASM conversion defeats academic feature-based ML detectors** — they rely on JS API call patterns which disappear in WASM
- **API-level defenses (browser extensions, browser-level blocks) remain robust** against WASM obfuscation
- CrUX Top-1M crawl from May 2025 used for real-world evaluation

**Practical implication:** Detection vendors who rely purely on static JS analysis (looking for `canvas.toDataURL()` etc.) will be defeated by WASM-obfuscated fingerprinters. However, browser-level defenses that intercept at the API layer are not affected — meaning Brave's built-in fingerprint randomization still works even against WASM fingerprinters.

---

### FP-tracer: Fine-grained Browser Fingerprinting Detection via Taint-tracking and Entropy-based Thresholds
- **Authors:** Soumia Boussaha, Daniele Antonioli, et al.
- **Venue:** PETS 2024 (Privacy Enhancing Technologies Symposium, July 2024, Bristol)
- **Links:** https://petsymposium.org/popets/2024/popets-2024-0092.php | https://github.com/soumboussaha/FP-tracer

**Key findings:**
- Extends Foxhound (privacy-oriented Firefox fork) with numeric taint tracking
- 62 fingerprint sources, 25 data sink points tracked
- Detects fingerprinting even when scripts are obfuscated
- Discriminates fingerprinting *invasiveness* by measuring joint entropy of collected attributes
- Detects audio, canvas, and storage fingerprinting in Tranco Top 100K crawl

**Practical implication:** This is a research-grade detection tool (browser fork), not a production anti-bot system. But the methodology — tracking data flow from APIs to network exfiltration — reflects how sophisticated detection can get. Anti-detect browsers must ensure that fingerprint data does not flow in observable patterns.

---

## 4. Canvas Fingerprinting: Attack and Defense

### Breaking the Shield: Analyzing and Attacking Canvas Fingerprinting Defenses in the Wild
- **Authors:** Hoang Dai Nguyen, Phani Vadrevu
- **Venue:** WWW 2025 (ACM Web Conference, April-May 2025, Sydney)
- **Links:** https://dl.acm.org/doi/10.1145/3696410.3714713 | https://www.hoangdainguyen.com/publications/canvas_fp_attack_www25.pdf

**What they did:** Analyzed 18 browser extensions and 5 major browsers (Chrome, Firefox, Brave, Tor, Safari) for canvas fingerprinting defenses. Then attacked each defense.

**Key findings:**
- Randomization-based defenses (used by 9 extensions + Brave) are the most popular
- **All randomization mechanisms are attackable** — their non-determinism can be predicted or exploited
- The attack exploits statistical patterns in the "randomized" noise
- **Conclusion: No fully deployable defense against canvas fingerprinting currently exists**

**Practical implication (offensive):** From a scraper's perspective, this means detection vendors can reliably detect canvas noise injection. Tools that add noise to canvas outputs (like some puppeteer-stealth patches) are detectable. Camoufox's approach — using hardware-level rendering variations by changing browser internals — is harder to detect than additive noise.

---

### Canvassing the Fingerprinters: Characterizing Canvas Fingerprinting Use Across the Web
- **Authors:** Elisa Luo, Tom Ritter, Stefan Savage, Geoff Voelker
- **Venue:** ACM IMC 2025 (October 2025, Madison, Wisconsin)
- **Links:** https://dl.acm.org/doi/10.1145/3730567.3764500 | https://www.sysnet.ucsd.edu/~voelker/pubs/canvas-imc25.pdf

**Key findings:**
- **12.7% of the top 20,000 websites use canvas fingerprinting**
- Developed a "fingerprint the fingerprinters" methodology — grouping identical test canvases across sites
- Identifies and characterizes which commercial fingerprinting services are deployed where
- Canvas hashes are stable enough to reliably identify specific fingerprinting services

**Practical implication:** Canvas fingerprinting is near-universal at scale. If your scraper's canvas rendering doesn't match a known device profile, it will be flagged at 12.7% of top sites.

---

## 5. CAPTCHA Bypass via LLM/VLM

### Are CAPTCHAs Still Bot-hard? Generalized Visual CAPTCHA Solving with Agentic Vision Language Model
- **Venue:** USENIX Security 2025
- **Links:** https://www.usenix.org/conference/usenixsecurity25/presentation/teoh | https://www.usenix.org/system/files/usenixsecurity25-teoh.pdf

**System:** "Halligan" — an agentic VLM-based CAPTCHA solver

**Key findings:**
- **60.7% solve rate on 2,600 challenges** across 26 CAPTCHA types (reCAPTCHA v2, hCaptcha, GeeTest, etc.)
- **70.6% solve rate on "in the wild" CAPTCHAs** not seen during development (30-day live test)
- Architecture: visual challenge → search problem formulation → VLM optimization → answer
- Generalizes to unseen CAPTCHA types without platform-specific retraining

**Practical implication:** CAPTCHAs as a primary bot barrier are weakening rapidly. VLM-based solvers don't require per-CAPTCHA training. This shifts the arms race toward behavioral and passive fingerprinting detection, since visual CAPTCHAs are no longer reliable gateways.

---

### VIPER Strike: Defeating Visual Reasoning CAPTCHAs via Structured Vision-Language Inference
- **Authors:** Accepted USENIX Security 2026
- **Link:** https://arxiv.org/abs/2601.06461

**Key findings:**
- Targets Visual Reasoning CAPTCHAs (VRCs) — more complex than image-click CAPTCHAs
- Providers tested: VTT, GeeTest, NetEase, Dingxiang, Shumei, Xiaodun
- **Up to 93.2% success rate** — approaching human-level performance
- Architecture: structured multi-object visual perception + adaptive LLM-based reasoning
- Source code and benchmark released at zenodo.org

**Practical implication:** GeeTest's "advanced" behavioral CAPTCHA can be defeated by VLM reasoning. Detection vendors are aware; this is pushing the field toward combining CAPTCHA with passive behavioral signals.

---

## 6. Mouse Trajectory and Behavioral Evasion

### DMTG: A Human-Like Mouse Trajectory Generation Bot Based on Entropy-Controlled Diffusion Networks
- **Authors:** Jiahua Liu, Zeyuan Cui, Wenhan Ge, Pengxiang Zhan
- **Venue:** arXiv, October 2024 (arXiv:2410.18233)
- **Link:** https://arxiv.org/html/2410.18233v1

**What they did:** Built a diffusion model (entropy-controlled) that generates mouse trajectories indistinguishable from human ones, specifically to evaluate behavioral CAPTCHAs.

**Key findings:**
- DMTG **reduces bot detection accuracy by 4.75%-9.73%** compared to prior best methods (BeCAPTCHA-Mouse, GAN-based)
- Successfully replicates "slow initiation and directional force differences" from human neuromuscular models
- Tested against GeeTest and Akamai behavioral detection
- Entropy control allows tuning trajectory complexity to match target CAPTCHA type

**Practical implication:** This is the state-of-the-art for programmatic mouse trajectory generation in 2024. The sigma-lognormal model (already in our mouse_movement.md) is the neurological basis; diffusion models are the current ML frontier.

---

## 7. CDP (Chrome DevTools Protocol) Detection

### Industry Research: How New Headless Chrome & the CDP Signal Are Impacting Bot Detection
- **Source:** DataDome Threat Research (2024)
- **Link:** https://datadome.co/threat-research/how-new-headless-chrome-the-cdp-signal-are-impacting-bot-detection/

**Key findings:**
- CDP creates a detectable side channel via the **Error.stack getter** in JavaScript
- When CDP is active, a getter on `Error.stack` executes during `console.log` serialization, revealing automation
- This signal works even when `navigator.webdriver` is patched and UA is spoofed
- **V8 patch (May 2025):** Two V8 commits introduced `getErrorProperty()` wrapper that prevents user-defined getters from triggering during CDP object inspection — **this signal was neutralized in Chrome 125+**

**How to detect scripts injected via CDP (Castle.io):**
- CDP-injected scripts have a distinct `sourceURL` fingerprint
- `window.chrome` object structure differs when CDP is active
- See rebrowser-patches (already in our sources.md) for the full list of leaks

**Practical implication:** As of Chrome 125+, the classic CDP Error.stack signal no longer works. Bot detection vendors have shifted to looking for other CDP artifacts. rebrowser-patches and CloakBrowser address the remaining signals.

---

## 8. Foundational Papers (Pre-2024, Still Cited)

### FP-Inspector: Fingerprinting the Fingerprinters
- **Venue:** IEEE S&P 2021
- **Link:** https://uiowa-irl.github.io/FP-Inspector/ | https://web.cs.ucdavis.edu/~zubair/files/fpinspector-sp2021.pdf
- ML-based syntactic-semantic detection of fingerprinting scripts
- Detects 26% more fingerprinting scripts vs. state-of-the-art
- Foundational paper for browser fingerprinting detection ML research

### FP-STALKER: Tracking Browser Fingerprint Evolutions
- **Venue:** IEEE S&P 2018
- **Link:** https://ieeexplore.ieee.org/document/8418634/
- Cross-time fingerprint linkage despite frequent changes
- Foundational for understanding temporal fingerprint tracking

### BeCAPTCHA-Mouse: Synthetic Mouse Trajectories and Improved Bot Detection
- **Venue:** arXiv 2020
- **Link:** https://arxiv.org/abs/2005.00890
- GAN-based mouse trajectory synthesis; 93% accuracy detecting GAN trajectories
- Foundational for mouse dynamics bot detection research

### Web Runner 2049: Evaluating Third-Party Anti-bot Services
- **Venue:** DIMVA 2020
- **Links:** https://dl.acm.org/doi/10.1007/978-3-030-52683-2_7 | https://pmc.ncbi.nlm.nih.gov/articles/PMC7338186/
- Gray-box + black-box analysis of commercial anti-bot JavaScript
- Tests automation tools against real commercial anti-bot services
- Foundational methodology paper for anti-bot evaluation

---

## 9. Proxy / RESIP Detection

### Detecting and Mitigating the New Generation of Scraping Bots (PhD Thesis)
- **Author:** Elisa Chiapponi (Sorbonne Université / EURECOM)
- **Defended:** November 7, 2023
- **Links:** https://theses.hal.science/tel-04443915/ | https://www.elisachiapponi.com/publication/thesis/

**Key findings:**
- RESIP (Residential IP Proxy) characterization — the strongest weapon available to scrapers
- Two detection techniques based on network measurements: latency, TTL, routing asymmetries
- Deceptive mitigation: serve scrapers modified/decoy data rather than blocking them (harder to detect being blocked)
- Validated on Amadeus IT Group (real-world airline booking system) data

**Practical implication:** RESIP detection is now an active research area. Simply using a residential IP pool does not guarantee evasion. Network-level timing signals can distinguish proxied from direct traffic.

### Shining Light into the Tunnel: Understanding and Classifying Network Traffic of Residential Proxies
- **Venue:** arXiv April 2024 (arXiv:2404.10610)
- **Link:** https://arxiv.org/abs/2404.10610
- ML-based classification of RESIP traffic flows
- Framework for deploying RESIP nodes and collecting traffic for analysis

---

## 10. Regulatory / Legal Context

### Balancing Security and Privacy: Web Bot Detection under GDPR and AI Act
- **Venue:** PMC (PubMed Central), 2025
- **Links:** https://pmc.ncbi.nlm.nih.gov/articles/PMC11962364/ | https://pubmed.ncbi.nlm.nih.gov/40176788/

**Key findings:**
- EU AI Act (in force August 2024) applies to high-risk AI systems in bot detection
- GDPR compliance requires bots themselves to handle any personal data scraped lawfully
- "Publicly available" data is not automatically lawful to process under GDPR
- Detection vendors face privacy constraints on what behavioral data they can collect

---

## Summary: Key Findings for Our Scraping Project

| Research Finding | Practical Impact | Severity |
|------------------|-----------------|---------|
| FP-Inconsistent (2024): 52% evasion rate has inconsistency vulnerabilities | All spoofed attributes must be internally consistent (UA + GPU + screen + fonts) | CRITICAL |
| TLS fingerprinting AUC 0.998 (2026) | Use curl_cffi or similar for browser-TLS impersonation | CRITICAL |
| CDP Error.stack signal fixed in Chrome 125+ | CDP-based detection has shifted; rebrowser-patches needed | HIGH |
| Canvas randomization all attackable (WWW 2025) | Avoid additive noise; use hardware-level rendering variation | HIGH |
| 45% fingerprinting sites missed by crawlers | Login-gated flows have additional detection layers | HIGH |
| DMTG diffusion mouse model reduces detection 4-9% | Sigma-lognormal or diffusion model mouse simulation needed | MEDIUM |
| CAPTCHA bypass via VLM now 60-93% | CAPTCHAs are weakening; behavioral detection is the real barrier | MEDIUM |
| RESIP detection via network timing (2023-2024) | Residential proxies are not safe by default; timing matters | MEDIUM |
| WASM defeats feature-based ML detectors (2025) | Anti-detect browsers that obfuscate at API level are more robust | LOW |
