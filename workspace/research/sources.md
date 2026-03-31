# Sources List

## Previous Research Sources (Mouse/Keyboard Behavioral)

1. **BeCAPTCHA-Mouse** - https://arxiv.org/pdf/2005.00890
2. **DMTG Diffusion Mouse Trajectories** - https://arxiv.org/html/2410.18233v1
3. **Keystroke Timing-Forgery Attacks** - https://arxiv.org/html/2601.17280v1
4. **ghost-cursor** - https://github.com/Xetera/ghost-cursor
5. **camoufox** - https://github.com/daijro/camoufox
6. **rebrowser-patches** - https://github.com/rebrowser/rebrowser-patches

## Fingerprint Evasion Research Sources (2026-03-30 session)

7. [rebrowser-patches README](https://github.com/rebrowser/rebrowser-patches/blob/main/README.md) — Runtime.enable leak, sourceURL leak, utility world naming patches
8. [rebrowser-bot-detector](https://github.com/rebrowser/rebrowser-bot-detector) — 10 detection tests: runtimeEnableLeak, sourceUrlLeak, navigatorWebdriver, bypassCsp, viewport, useragent, pwInitScripts, exposeFunctionLeak, mainWorldExecution, window.dummyFn
9. [CreepJS on Scrapfly](https://scrapfly.io/blog/posts/browser-fingerprinting-with-creepjs) — Detection categories, trust scoring, JavaScript tampering detection
10. [Pydoll Fingerprint Evasion](https://pydoll.tech/docs/deep-dive/fingerprinting/evasion-techniques/) — CDP injection techniques, WebRTC disable, canvas noise warning
11. [CloakBrowser GitHub](https://github.com/CloakHQ/CloakBrowser) — 33 source-level C++ patches, Chromium 145, 30/30 tests passed
12. [Camoufox Fingerprint Injection](https://camoufox.com/fingerprint/) — Full property list, C++ level implementation
13. [Camoufox WebGL Docs](https://camoufox.com/fingerprint/webgl/) — WebGL renderer, extensions, context attributes, GL params, shader precision
14. [niespodd/browser-fingerprinting](https://github.com/niespodd/browser-fingerprinting) — p0f, JA3, WebGL, Canvas, AudioContext, behavioral signals
15. [FingerprintJS BotD README](https://github.com/fingerprintjs/BotD/blob/main/README.md) — Detectable tools list
16. [Detecting noise in canvas fingerprinting - castle.io](https://blog.castle.io/detecting-noise-in-canvas-fingerprinting/) — PoW verification, function consistency analysis
17. [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth) — 17 evasion modules
18. [zendriver GitHub](https://github.com/cdpdriver/zendriver) — CDP-based framework, WebRTC/WebGL disable
19. [zendriver canvas fingerprint issue #108](https://github.com/cdpdriver/zendriver/issues/108) — Open gap in canvas/font spoofing
20. [CycleTLS GitHub](https://github.com/Danny-Dasilva/CycleTLS) — JA3/JA4 TLS spoofing
21. [Privacy Sandbox - Storage Partitioning](https://privacysandbox.google.com/cookies/storage-partitioning) — Chrome 115+ storage partitioning
22. [GeeTest on BotBrowser 2025](https://www.geetest.com/en/article/how-to-defeat-botbrowser-in-2025) — Cross-platform spoofing countermeasures
23. [Security Boulevard - evolution of anti-detect frameworks](https://securityboulevard.com/2025/06/from-puppeteer-stealth-to-nodriver-how-anti-detect-frameworks-evolved-to-evade-bot-detection/) — nodriver/selenium-driverless evolution
24. [arXiv:2406.07647 - Fingerprint Inconsistency](https://bob.cs.ucdavis.edu/assets/dl/fp-inconsistent.pdf) — 2024 temporal fingerprint inconsistency research
25. [Akamai HTTP/2 Fingerprinting Whitepaper](https://blackhat.com/docs/eu-17/materials/eu-17-Shuster-Passive-Fingerprinting-Of-HTTP2-Clients-wp.pdf) — SETTINGS frame format
26. [DataDome - Headless Chrome & CDP](https://datadome.co/threat-research/how-new-headless-chrome-the-cdp-signal-are-impacting-bot-detection/) — CDP signal detection (403 at access time)
27. [Camoufox GitHub](https://github.com/daijro/camoufox) — Full source for Firefox-based anti-detect
28. [castle.io - WebGL renderer role](https://blog.castle.io/the-role-of-webgl-renderer-in-browser-fingerprinting/) — WebGL renderer in fingerprinting

## Academic Papers (2024-2026 session, 2026-03-31)

29. [arXiv:2406.07647 FP-Inconsistent (ACM IMC 2025)](https://arxiv.org/abs/2406.07647) — Fingerprint inconsistency detection; 52.93% DataDome evasion; 20 bot services tested
30. [arXiv:2602.09606 TLS Fingerprinting (2026)](https://arxiv.org/abs/2602.09606) — JA4 + CatBoost: AUC 0.998, F1 0.9734 for bot detection at TLS layer
31. [arXiv:2502.01608 Beyond the Crawl (WWW 2025)](https://arxiv.org/abs/2502.01608) — Crawlers miss 45% of fingerprinting sites; federated learning for detection
32. [arXiv:2502.14326 Browser Fingerprint Detection 2025](https://arxiv.org/abs/2502.14326) — Chrome extension for fingerprint randomization and detection
33. [arXiv:2411.12045 Fingerprinting Survey 2024](https://arxiv.org/abs/2411.12045) — Survey of browser fingerprinting techniques and privacy impact
34. [PETS 2024 FP-tracer](https://petsymposium.org/popets/2024/popets-2024-0092.php) — Taint-tracking + entropy classification; 62 sources / 25 sinks; Foxhound fork
35. [USENIX Security 2025 - Are CAPTCHAs Still Bot-hard?](https://www.usenix.org/conference/usenixsecurity25/presentation/teoh) — Halligan VLM: 60.7% solve rate on 26 CAPTCHA types; 70.6% in wild
36. [arXiv:2601.06461 VIPER Strike (USENIX 2026)](https://arxiv.org/abs/2601.06461) — VLM defeats visual reasoning CAPTCHAs with 93.2% success on 6 providers
37. [arXiv:2410.18233 DMTG Mouse Diffusion (2024)](https://arxiv.org/abs/2410.18233) — Entropy-controlled diffusion networks for human-like mouse trajectories; beats GAN baseline
38. [arXiv:2508.21219 WASM Cloak (2025)](https://arxiv.org/abs/2508.21219) — WASM obfuscation defeats ML-based fingerprint detectors; API-level defenses survive
39. [arXiv:2509.09950 V8 Bytecode Fingerprinting (2025)](https://arxiv.org/abs/2509.09950) — 98.9% accuracy via V8 bytecode analysis; robust to JS obfuscation
40. [WWW 2025 Breaking the Shield](https://dl.acm.org/doi/10.1145/3696410.3714713) — All canvas randomization defenses attackable; no fully deployable defense exists
41. [ACM IMC 2025 Canvassing Fingerprinters](https://dl.acm.org/doi/10.1145/3730567.3764500) — 12.7% of top 20K sites use canvas fingerprinting
42. [HAL Chiapponi PhD Thesis 2023](https://theses.hal.science/tel-04443915/) — RESIP detection via network timing; deceptive mitigation technique
43. [arXiv:2404.10610 RESIP Traffic Classification (2024)](https://arxiv.org/abs/2404.10610) — ML-based identification of residential proxy traffic flows
44. [PMC - Bot Detection under GDPR/AI Act 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC11962364/) — Regulatory context for bot detection in EU
45. [WWW 2024 Assessing Web Fingerprinting Risk](https://arxiv.org/abs/2403.15607) — Fingerprinting risk assessment methodology
46. [Web Runner 2049 (DIMVA 2020)](https://dl.acm.org/doi/10.1007/978-3-030-52683-2_7) — Foundational gray/black-box anti-bot evaluation methodology
