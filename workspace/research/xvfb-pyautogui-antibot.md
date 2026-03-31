# Research: Xvfb + PyAutoGUI OS-Level Input for Undetectable Browser Automation

## Executive Summary

The Xvfb + PyAutoGUI approach is one of the most credible architectures for evading JavaScript-level bot detection. OS-level input events are genuinely indistinguishable from human input to any JavaScript running inside the browser. However, Akamai (and similarly advanced systems) operate on multiple detection layers simultaneously — TLS fingerprinting, behavioral biometrics, IP reputation, and sensor data collection — meaning OS-level input alone is necessary but not sufficient. The most battle-tested open implementation of this architecture is `docker-stealthy-auto-browse`, which uses Firefox (Camoufox) rather than Chrome to also eliminate CDP as a detection vector.

---

## Findings

### 1. docker-stealthy-auto-browse: Architecture and Effectiveness

**Repository**: https://github.com/psyb0t/docker-stealthy-auto-browse
**Author blog post**: https://ciprian.51k.eu/docker-stealthy-auto-browse-the-browser-that-doesnt-know-its-being-automated

The project is a Docker container that wires together four components:

- **Camoufox**: A custom Firefox fork. The key insight is that Firefox does not use CDP, so there is literally no CDP protocol connection for detectors to find. This eliminates the single most reliable bot detection signal.
- **Playwright**: Used only for DOM-level reads — getting element coordinates, page source — not for dispatching input events.
- **PyAutoGUI**: Handles all mouse movements and keystrokes at the OS level. Mouse paths follow Bezier curves with random jitter. Keystrokes are character-by-character with variable inter-key delays.
- **Xvfb**: Provides a virtual framebuffer so the browser runs "headed" without a physical display. This avoids all headless-mode detection signals.
- **noVNC**: Exposes the virtual display as a web page for monitoring and manual intervention.
- **browserforge**: Injects consistent browser fingerprints that are coherent across all browser APIs.

**Control API**: Single HTTP POST endpoint on port 8080 accepting JSON. The `get_interactive_elements` action returns both viewport (x, y) pixel coordinates (for PyAutoGUI) and CSS selectors (for Playwright reads), enabling the hybrid approach.

**Claimed bot detection results**: Passes Cloudflare Turnstile, CreepJS, BrowserScan, Pixelscan. The author is explicit that this was tested; no independent third-party verification was found.

**Pre-installed extensions**: uBlock Origin, LocalCDN (CDN fingerprinting prevention), ClearURLs, Consent-O-Matic.

**Real effectiveness**: Moderate-to-high against Cloudflare and DataDome. Against Akamai, success rates are likely 20-40% from datacenter IPs, rising to 70-85% with residential proxies (estimate based on tool category benchmarks from pim97's comparison repo).

---

### 2. PyAutoGUI vs xdotool vs ydotool

| Tool | Platform | Mechanism | Key Capability | Key Limitation |
|------|----------|-----------|----------------|----------------|
| PyAutoGUI | Linux/Mac/Win | X11 / OS input APIs | Python-native, curved paths, jitter, cross-platform | Requires X display, no Wayland, 100ms mandatory pause per call |
| xdotool | Linux X11 only | X11 Xlib calls | Window targeting, send to background windows, query window geometry | Broken on Wayland, actively maintained but X11-tied |
| ydotool | Linux (X11 + Wayland) | kernel `uinput` module | Works on any input consumer including Wayland, fbdev, text consoles | Cannot target specific windows, requires `ydotoold` daemon, types slowly |

**For Xvfb-based browser automation, the ranking is:**

1. **PyAutoGUI** — best for this use case. Since your target window (Chrome/Firefox on Xvfb) owns the entire virtual display, you do not need window targeting. PyAutoGUI's screen coordinates map directly. Human-curve mouse movement is built-in via the `tween` parameter.

2. **xdotool** — good alternative, especially useful for sending keystrokes to a specific window by window ID without needing the window to be focused. Command-line, so callable from any language. Example: `xdotool type --window $WID --clearmodifiers "hello"`.

3. **ydotool** — useful if migrating to a Wayland-based setup, but has no window-targeting ability and slower typing makes it awkward for form automation.

**Detection difference**: All three produce genuine kernel input events. From the JavaScript perspective inside the browser, there is zero difference between PyAutoGUI, xdotool, ydotool, and a human hand. The difference is only visible at the OS/display-server level, which JS cannot reach.

---

### 3. Targeting Specific Elements Without CSS Selectors

This is the core technical challenge of pure OS-level input. Two approaches:

**Approach A: CDP/Playwright read + PyAutoGUI click (hybrid)**

This is what `docker-stealthy-auto-browse` and `stealthy-scraping-tools` (https://github.com/NikolaiT/stealthy-scraping-tools) both do:

1. Use CDP or Playwright to get the bounding box of a CSS selector:
   ```python
   element = await page.query_selector("button#submit")
   box = await element.bounding_box()
   # Returns {"x": 320, "y": 480, "width": 120, "height": 40}
   center_x = box["x"] + box["width"] / 2
   center_y = box["y"] + box["height"] / 2
   ```
2. Pass those coordinates to PyAutoGUI:
   ```python
   pyautogui.moveTo(center_x, center_y, duration=0.8, tween=pyautogui.easeOutQuad)
   pyautogui.click()
   ```

NikolaiT's stealthy-scraping-tools states explicitly: "We only use the CDP to obtain the page source and to get the absolute coordinates for an arbitrary CSS selector. Mouse movements and typing is handled by pyautogui."

**Approach B: Screenshot + computer vision (no DOM)**

For cases where even Playwright DOM reads are detectable:
- Take a screenshot of the Xvfb display with `PIL.ImageGrab.grab()` or `scrot`
- Use OpenCV template matching or pytesseract OCR to locate a button by its visual appearance
- Click the matched pixel coordinates
- Slower (~200-500ms per locate operation) and brittle on dynamic UIs

**SeleniumBase's `gui_click_element()`** uses the hybrid approach — it leverages WebDriver to resolve the selector to coordinates, then hands off to PyAutoGUI for the actual mouse movement. This is also useful for shadow-root elements that JS cannot reach.

---

### 4. Combining CDP Reading with OS-Level Input: Detection Risk

**The critical finding**: CDP detection targets the *existence of a CDP connection*, not specific CDP commands.

When Chrome is launched with `--remote-debugging-port`, it opens a WebSocket. Sites can probe for this via:
- `window.chrome.runtime` non-standard properties
- Performance timeline entries created by CDP
- `navigator.webdriver` being `true`

**Mitigation strategies:**

- **Use Firefox instead of Chrome** (Camoufox approach): Firefox does not implement CDP. Playwright uses the Firefox DevTools Protocol (different protocol, less widely fingerprinted). This is the cleanest solution.
- **Use Chrome with CDP disabled**: Launch Chrome without `--remote-debugging-port`, use a different control mechanism. Hard with Playwright/Selenium as they require it.
- **Use Patchright**: A patched Playwright that removes CDP-related JavaScript artifacts. Passes most detection tests. See: https://roundproxies.com/blog/patchright/
- **Use NoDriver/undetected-chromedriver**: Launches Chrome in a way that hides the `--remote-debugging-port` flag.

**Bottom line on hybrid approach**: CDP for coordinate reading + PyAutoGUI for clicking is reasonably safe if you also eliminate CDP artifacts from the JS environment (via Patchright or Firefox). The CDP connection itself is the risk, not the specific commands you use. Reading coordinates via CDP is lower risk than using CDP to dispatch click events.

---

### 5. noVNC Setup for Manual CAPTCHA Solving

Standard stack: **Xvfb → x11vnc → websockify → noVNC**

**Installation:**
```bash
apt-get install -y xvfb x11vnc
pip install websockify
git clone https://github.com/novnc/noVNC.git
```

**Launch sequence:**
```bash
# 1. Start virtual display
Xvfb :1 -screen 0 1920x1080x24 -dpi 96 &

# 2. Start VNC server (localhost only for security)
x11vnc -display :1 -noxdamage -rfbport 5901 -shared -loop -nopw -localhost &

# 3. Start noVNC web bridge
./noVNC/utils/novnc_proxy --listen 6080 --vnc localhost:5901 &

# 4. Optional: lightweight window manager
DISPLAY=:1 fluxbox &

# 5. Launch browser
DISPLAY=:1 google-chrome --no-sandbox --profile-directory=Default &
```

**Remote access**: SSH tunnel to VPS, then open `http://localhost:6080/vnc.html` in your browser. You see the full virtual desktop and can interact manually to solve CAPTCHAs or handle 2FA.

**CAPTCHA workflow:**
1. Automation detects CAPTCHA (page.locator(".captcha") present, or screenshot comparison)
2. Automation pauses, sends webhook/notification to operator
3. Operator opens noVNC tab, solves CAPTCHA manually
4. Automation detects CAPTCHA gone, resumes

The `docker-stealthy-auto-browse` project uses this same approach: noVNC listens on the same Docker container, accessible via port mapping.

---

### 6. Performance: Pages Per Minute with OS-Level Input

No published benchmarks were found. Based on component timing analysis:

**Timing breakdown per page interaction:**
- Page load: 2-5 seconds (network/JS dependent)
- Mouse movement (PyAutoGUI, human-like curve, 800ms duration): 0.8s
- PyAutoGUI mandatory pause after each call: 0.1s per call
- Keystroke typing (character-by-character at ~100-200ms/char): ~1-3s for a typical form field
- Wait for DOM response: 0.5-2s

**Realistic estimate:**
- Simple page visit + single click: ~5-8 seconds total → **7-12 pages/minute**
- Form fill + submit: ~10-20 seconds total → **3-6 pages/minute**
- Compared to pure Playwright/CDP (no human delays): 30-60 pages/minute

**PyAutoGUI is inherently slow** because:
1. The 100ms mandatory `PAUSE` after every call (configurable via `pyautogui.PAUSE = 0.05`)
2. Human-curve mouse movement takes 0.5-1.5 seconds by design
3. Character-by-character typing adds seconds per field

**Optimization levers:**
- Reduce `pyautogui.PAUSE` to 0.02-0.05 (below 0.02 causes reliability issues)
- Use `pyautogui.typewrite()` with `interval=0.05` instead of 0.1
- Set mouse move `duration=0.3` for less protected pages
- Use Playwright for all reads/navigations, only use PyAutoGUI for the final click/type

---

### 7. Real Chrome Stable + Xvfb + Persistent Profile

**Does it pass all bot detection?** No. But it eliminates several detection layers:

**What Xvfb + Real Chrome fixes:**
- Headless mode signatures (navigator.userAgent "HeadlessChrome", missing plugins, etc.)
- `window.chrome` object being undefined
- WebGL reporting "SwiftShader" renderer (real Chrome uses actual GPU driver even in Xvfb)
- Screen resolution being 0x0 or headless defaults

**What it does NOT fix:**
- CDP connection detection (Chrome is still controlled via CDP when using Playwright/Selenium)
- `navigator.webdriver = true` (unless patched)
- Blank browser history (fresh profile is a major anomaly signal)
- Missing accumulated cookies, saved passwords, visited sites
- IP reputation (datacenter IP is itself a strong bot signal for Akamai)
- TLS fingerprint (Python/Playwright TLS stacks are fingerprinted)

**Persistent profile setup:**
```bash
# Create profile directory, warm it up manually once via noVNC
mkdir -p /home/chrome-profiles/profile-001

# Launch with persistent profile
DISPLAY=:1 google-chrome \
  --user-data-dir=/home/chrome-profiles/profile-001 \
  --no-first-run \
  --no-default-browser-check \
  --disable-blink-features=AutomationControlled \
  --no-sandbox
```

**Profile warming** (critical): Before using a profile for scraping, manually browse 10-20 legitimate sites via noVNC over 2-3 days. This creates natural history, cookies, and localStorage entries that anti-bot ML models look for.

**On "blank profile is the biggest anomaly"**: Confirmed by multiple sources. Anti-bot systems check localStorage, IndexedDB, cookies, visited sites. A profile with zero history on a datacenter IP is extremely high risk even with perfect fingerprints.

---

### 8. Screen Resolution and DPI in Xvfb

**Standard production settings:**
```bash
Xvfb :1 -screen 0 1920x1080x24 -dpi 96
```

**Why these values:**
- `1920x1080`: Most common desktop resolution (used by ~25% of real users per StatCounter). Avoids suspicious values like 800x600 (old headless default) or unusual dimensions.
- `24`: Color depth in bits. Use 24 (RGB888), never 8 or 16.
- `-dpi 96`: Standard 1x display density. This makes `window.devicePixelRatio = 1` in Chrome, matching typical desktop monitors.

**What Chrome reports in JavaScript:**
- `screen.width = 1920`, `screen.height = 1080`
- `window.devicePixelRatio = 1` (with -dpi 96)
- `screen.colorDepth = 24`

**DPI gotchas:**
- If you omit `-dpi`, Xvfb defaults to ~75 DPI, which produces a non-integer or unusual devicePixelRatio
- For a 2x HiDPI simulation: `Xvfb :1 -screen 0 1920x1080x24 -dpi 192` — Chrome will report `devicePixelRatio = 2`
- The x11docker GitHub issue found 4:3 resolutions give better DPI accuracy with Xvfb, but 1920x1080 is more convincing fingerprint-wise

**Additional Chrome flags to match real browser:**
```bash
--window-size=1920,1080
--force-device-scale-factor=1
```

---

### 9. AT-SPI Accessibility API as CDP Alternative

AT-SPI2 (Assistive Technology Service Provider Interface) is the Linux accessibility framework. The KDE project has built `selenium-webdriver-at-spi` (https://github.com/KDE/selenium-webdriver-at-spi) that implements a WebDriver interface over AT-SPI.

**Technical reality:**
- AT-SPI works by reading accessibility tree nodes exposed by GTK/Qt applications
- Chrome does expose an accessibility tree when `--force-renderer-accessibility` is passed
- This gives you button labels, input field values, and UI structure without CDP
- However, AT-SPI is not designed for Chrome automation; the implementation is incomplete for web content
- No known production scraping tool uses AT-SPI for Chrome DOM reading

**Anti-detection value:**
- AT-SPI calls go through D-Bus (Linux IPC), not a network socket
- JavaScript inside Chrome cannot detect D-Bus activity
- Chrome's accessibility tree exposure is triggered by the `--force-renderer-accessibility` flag, which is not itself a bot signal

**Practical verdict**: AT-SPI is an interesting research direction but not production-ready for web scraping. It cannot replace CDP for getting element coordinates reliably. Use the CDP-for-reads + PyAutoGUI-for-input hybrid instead.

---

### 10. Akamai-Specific Detection Analysis

Akamai Bot Manager uses a layered detection model. Each layer must be defeated independently:

**Layer 1: TLS Fingerprint (JA3/JA4)**
- Akamai identifies the TLS client hello signature
- Python libraries (`requests`, `aiohttp`) produce known-bot TLS fingerprints
- **Mitigation**: Use a real Chrome or Firefox browser (not a Python HTTP library). Chrome's TLS stack produces a valid browser fingerprint. Xvfb + real Chrome passes this layer.

**Layer 2: HTTP Headers**
- Header order, presence of Accept-Encoding, Sec-Fetch-* headers, HTTP/2 vs HTTP/1.1
- **Mitigation**: Real Chrome sends correct headers automatically.

**Layer 3: JavaScript Sensor Data (BMP — Bot Management Protocol)**
- Akamai injects a JS payload that collects device fingerprint, browser properties, and behavioral data
- Collected data is encrypted and posted to Akamai's servers alongside each request
- The sensor data includes: screen resolution, canvas fingerprint, WebGL renderer, font list, audio context fingerprint, timing data, and — critically — mouse movement trajectories and keystroke timing
- **Mitigation for PyAutoGUI**: Mouse movements generated by PyAutoGUI with eased curves and jitter should produce plausible behavioral vectors. But without a warmed-up profile and history, behavioral anomaly scores remain high.

**Layer 4: IP Reputation**
- Datacenter IPs are heavily penalized
- **Mitigation**: Residential or mobile proxies

**Layer 5: Behavioral Consistency Over Time**
- Akamai tracks patterns across multiple requests/sessions
- Same fingerprint + datacenter IP + no cookies = instant flag
- **Mitigation**: Persistent profiles, session cookies carried across requests

**Can Akamai detect Xvfb vs real display?**
- JavaScript cannot query whether a display is virtual or physical
- There is no API that exposes "this is an Xvfb display"
- The only indirect signals are: unusual screen refresh rate (Xvfb does not report one; Chrome defaults to 0 or 60), unusual display geometry
- **Setting Xvfb with `-screen 0 1920x1080x24` and Chrome with `--force-device-scale-factor=1` is sufficient to be indistinguishable at the JS layer**

**Practical verdict for Akamai**: Xvfb + OS-level input is necessary but not sufficient. You also need: residential proxy, warmed profile, correct TLS fingerprint (real Chrome gives you this), and coherent behavioral data in the sensor payload.

---

### 11. Memory and CPU on a 2GB VPS

**Chrome baseline memory usage:**
- Single Chrome instance with 1-2 tabs: 300-700 MB RAM
- Xvfb itself: ~10-20 MB
- x11vnc: ~10-15 MB
- noVNC/websockify: ~20-30 MB
- Python + PyAutoGUI + orchestration: ~50-100 MB

**Total for 1 Chrome instance**: ~400-900 MB

**2GB VPS feasibility:**
- 1 Chrome instance: feasible with careful management
- 2 Chrome instances simultaneously: tight, likely hits swap
- Chrome flags to reduce memory:
  ```bash
  --disable-dev-shm-usage   # Critical for Docker
  --disable-gpu             # Reduces GPU memory allocation
  --no-zygote               # Reduces process count
  --single-process          # Dramatic RAM reduction but crashes more
  --js-flags="--max-old-space-size=512"  # Limits V8 heap
  --disk-cache-size=1       # Disables disk cache
  ```
- The `--disable-dev-shm-usage` flag is critical in Docker/VPS environments because Chrome uses `/dev/shm` for IPC and the default 64MB limit causes crashes. This flag redirects to `/tmp`.

**CPU requirements:**
- Xvfb rendering: ~5-15% CPU per Chrome tab during active use
- PyAutoGUI operations: negligible CPU
- Real Chrome JavaScript execution: varies by site, 20-80% per tab on complex pages

**Recommendation for 2GB VPS**: Run one Chrome instance at a time. Use `--disable-dev-shm-usage` and `--disable-gpu`. Monitor with `free -h` and add a 512MB swap file as safety margin.

---

## Comparative Analysis

| Approach | Cloudflare | Akamai | DataDome | Setup Complexity | Speed | Memory |
|----------|-----------|--------|---------|-----------------|-------|--------|
| Xvfb + PyAutoGUI + Firefox (Camoufox) | High | Medium | High | Medium | Slow (3-12 ppm) | 600-900MB |
| Xvfb + PyAutoGUI + Real Chrome + Patchright | High | Medium | High | Medium | Slow | 600-900MB |
| Patchright alone (no OS input) | High | Low-Med | High | Low | Fast (30-60 ppm) | 300-500MB |
| Sensor data replay (Hyper-SDK) | N/A | High | Medium | High | Very Fast | Low |
| Residential proxy service (ScraperAPI, etc.) | High | High | High | Low | Medium | Low |

---

## Practical Implementation Guide

### Minimum viable Xvfb + PyAutoGUI + Chrome stack

```bash
# System deps
apt-get install -y xvfb x11vnc fluxbox google-chrome-stable python3-pip
pip install pyautogui playwright pillow

# Start virtual display
export DISPLAY=:1
Xvfb :1 -screen 0 1920x1080x24 -dpi 96 &
sleep 1
fluxbox &

# Start noVNC (for CAPTCHA solving)
x11vnc -display :1 -rfbport 5901 -localhost -nopw -loop &
./noVNC/utils/novnc_proxy --listen 6080 --vnc localhost:5901 &

# Launch Chrome with persistent profile
google-chrome \
  --display=:1 \
  --user-data-dir=/data/chrome-profile \
  --disable-blink-features=AutomationControlled \
  --disable-dev-shm-usage \
  --disable-gpu \
  --no-sandbox \
  --window-size=1920,1080 &
```

```python
# Python orchestration: CDP for coordinates, PyAutoGUI for input
import pyautogui
from playwright.async_api import async_playwright

pyautogui.PAUSE = 0.05  # Reduce from 100ms default

async def click_element_stealthy(page, selector):
    element = await page.query_selector(selector)
    box = await element.bounding_box()
    x = box["x"] + box["width"] / 2
    y = box["y"] + box["height"] / 2
    # Human-like move
    pyautogui.moveTo(x, y, duration=0.6, tween=pyautogui.easeOutQuad)
    pyautogui.click()

async def type_stealthy(text):
    for char in text:
        pyautogui.press(char)
        import random, time
        time.sleep(random.uniform(0.08, 0.18))
```

---

## Sources

1. [docker-stealthy-auto-browse GitHub](https://github.com/psyb0t/docker-stealthy-auto-browse) — Architecture, input modes, API design
2. [Blog post: "The Browser That Doesn't Know It's Being Automated"](https://ciprian.51k.eu/docker-stealthy-auto-browse-the-browser-that-doesnt-know-its-being-automated) — Technical deep-dive on Camoufox + PyAutoGUI approach
3. [stealthy-scraping-tools GitHub (NikolaiT)](https://github.com/NikolaiT/stealthy-scraping-tools) — CDP-for-coordinates + PyAutoGUI-for-input pattern
4. [anti-detect-browser-tools-tech-comparison (pim97)](https://github.com/pim97/anti-detect-browser-tools-tech-comparison) — Tool success rates against Akamai, Cloudflare
5. [How to Bypass Akamai Anti-Scraping (Scrapfly)](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping) — Akamai detection layers: TLS, IP, JavaScript, behavior
6. [Bypassing Akamai for Free (The Web Scraping Club)](https://substack.thewebscraping.club/p/bypassing-akamai-for-free) — TLS fingerprinting as primary Akamai signal
7. [The Lab #57: Avoiding CDP Detection (Substack)](https://substack.thewebscraping.club/p/playwright-stealth-cdp) — How CDP connection itself is detected
8. [xdotool GitHub](https://github.com/jordansissel/xdotool) — X11 input simulation capabilities
9. [ydotool GitHub (ReimuNotMoe)](https://github.com/ReimuNotMoe/ydotool) — uinput-based Wayland-compatible input
10. [ydotool overview (gadgeteer.co.za)](https://gadgeteer.co.za/ydotool-is-an-alternative-to-xdotool-that-works-on-both-x11-and-wayland/) — xdotool vs ydotool comparison
11. [xvfb + VNC + noVNC setup guide](https://crashlaker.github.io/2022/04/09/xfvb_+_vnc_+_novnc_+_fluxbox.html) — Exact commands for noVNC stack
12. [selenium-webdriver-at-spi (KDE)](https://github.com/KDE/selenium-webdriver-at-spi) — AT-SPI accessibility API automation
13. [x11docker DPI issue #230](https://github.com/mviereck/x11docker/issues/230) — Xvfb DPI configuration challenges
14. [Xvfb limitations for CAPTCHA](https://www.xugj520.cn/en/archives/automation-captcha-solution-hardware.html) — Why accumulated profile matters more than virtual display
15. [SeleniumBase HackerNews discussion](https://news.ycombinator.com/item?id=42433199) — PyAutoGUI for shadow-root elements
16. [ACM: Bot Detection with Mouse Biometrics](https://dl.acm.org/doi/10.1145/3447815) — Academic paper on behavioral biometrics for bot detection

---

## Confidence Assessment

- **High confidence**: OS-level input (PyAutoGUI/xdotool) is indistinguishable from human input at the JavaScript layer. Multiple primary sources confirm this unanimously.
- **High confidence**: CDP connection existence is detectable by Akamai and Cloudflare; using Firefox (no CDP) is cleaner than patching Chrome.
- **High confidence**: Xvfb with `1920x1080x24 -dpi 96` produces correct browser fingerprint values. JS cannot detect Xvfb vs real display.
- **High confidence**: noVNC stack setup is well-documented; Xvfb → x11vnc → websockify → noVNC is the standard pattern.
- **Medium confidence**: Performance estimate of 3-12 pages/minute is derived from component timing, not a published benchmark.
- **Medium confidence**: Akamai bypass rates (20-40% datacenter, 70-85% residential) are industry estimates from the pim97 comparison, not independently verified.
- **Low confidence**: AT-SPI as CDP replacement — theoretically sound but no production implementations found.
- **Low confidence**: Whether PyAutoGUI's Bezier curves actually fool Akamai's behavioral biometrics model. Akamai trains on real user data; synthetic curves may still be detectable at sufficient sample sizes.

---

## Information Gaps

- No published performance benchmark for PyAutoGUI pages/minute in browser scraping context
- No independent verification of docker-stealthy-auto-browse's claimed Cloudflare bypass
- Akamai's exact sensor data schema and what behavioral features trigger high scores is not public
- No confirmed report of this exact stack (Xvfb + PyAutoGUI + warmed Chrome profile) being tested against a live Akamai-protected site with published results
- AT-SPI2 + Chrome accessibility tree: no working implementation found for production use
- Chrome Stable vs Chromium differences in bot detection fingerprint: not researched
