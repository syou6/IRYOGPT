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
