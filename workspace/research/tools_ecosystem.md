# Tools Ecosystem: Production Anti-Detection Tools (2025-2026)

## Mouse Movement Libraries

### ghost-cursor (TypeScript/JavaScript)
- **Repo**: https://github.com/Xetera/ghost-cursor
- **Algorithm**: Bezier curves + Fitts's Law
- **Features**: Overshoot/re-approach, randomized speed, Playwright port available
- **npm**: `npm install ghost-cursor`
- **Playwright port**: https://github.com/bn-l/ghost-cursor-play
- **Status**: Active, v1.4.2 (Jan 2026)

### HumanCursor (Python)
- **Repo**: https://github.com/riflosnake/HumanCursor
- **Works with**: PyAutoGUI / direct mouse control
- **Features**: Natural motion algorithm with acceleration/deceleration

### human_mouse (Python)
- **Repo**: https://github.com/sarperavci/human_mouse
- **Algorithm**: Bezier curves + spline interpolation
- **Claims**: "Ultra-realistic"

### windmouse (Python)
- **Repo**: https://github.com/AsfhtgkDavid/windmouse
- **Algorithm**: WindMouse (physics-based: gravity + wind forces)
- **Status**: Widely used; simpler but less realistic than sigma-lognormal

### bezmouse (Linux)
- **Repo**: https://github.com/vincentbavitz/bezmouse
- **Works with**: xdotool
- **Platform**: Linux only

### PHC Mouse Movement Generator (Private)
- **Repo**: https://github.com/Pointergeist/PHC-mouse-movement-gen
- **Algorithm**: Sigma-lognormal model derived from datasets
- **Access**: Private API, contact via Discord/Telegram
- **Claims**: Bypasses sophisticated anti-bot + CAPTCHAs

---

## Full Browser Automation Libraries

### emunium (Python)
- **Repo**: https://github.com/DedInc/emunium
- **Works with**: Selenium, Pyppeteer, Playwright
- **Features**:
  - Mouse movement simulation (human=True flag)
  - Typing at 280 CPM default (configurable)
  - Scroll into viewport
  - Image/OCR-based element detection
- **Note**: Non-ASCII text pasted via clipboard (not typed character-by-character)

### BotNavigator
- **Repo**: https://github.com/MiddleSchoolStudent/BotNavigator
- **Features**: Dynamic task execution, fingerprint adaptation, behavior simulation
- **AI-powered**: Dynamic task execution

---

## Anti-Detect Browsers

### Camoufox (Firefox-based)
- **Repo**: https://github.com/daijro/camoufox
- **Approach**: Engine-level patches to Firefox (C++ level modifications)
- **Spoofs**: Canvas, WebGL, fonts, screen dimensions, navigator properties
- **Statistical modeling**: Uses BrowserForge for statistically realistic device profiles
- **Python API**: `pip install camoufox`
- **Status**: Gap in maintenance 2024, resumed late 2025

### nodriver (Python)
- **Repo**: https://github.com/ultrafunkamsterdam/nodriver (successor to undetected-chromedriver)
- **Approach**: CDP-minimal, fully async, avoids Runtime.enable
- **Language**: Python only
- **Status**: Actively maintained 2025-2026

### zendriver (Python)
- **Repo**: https://github.com/cdpdriver/zendriver
- **Based on**: nodriver fork
- **Note**: Canvas/font fingerprint spoofing still has gaps (GitHub issue #108)

### rebrowser-patches (Puppeteer/Playwright patches)
- **Repo**: https://github.com/rebrowser/rebrowser-patches
- **Fixes**:
  1. Runtime.enable CDP leak (primary Cloudflare/DataDome detection vector)
  2. sourceURL leak in evaluation contexts
  3. Utility world naming leak
- **Usage**: Drop-in replacement packages for both Puppeteer and Playwright
- **Latest version**: 24.8.1 (2025-05-06)

### Patchright (Playwright-based)
- **Based on**: Playwright with anti-detect patches
- **Guide**: https://roundproxies.com/blog/patchright/

### SeleniumBase (Python)
- **Repo**: https://github.com/seleniumbase/SeleniumBase
- **Features**: Built-in UC (undetected chromedriver) mode, CDP bypass

---

## Detection Testing Tools

### rebrowser-bot-detector
- **Repo**: https://github.com/rebrowser/rebrowser-bot-detector
- **Tests**: 10 detection tests covering:
  1. runtimeEnableLeak
  2. sourceUrlLeak
  3. navigatorWebdriver
  4. bypassCsp
  5. viewport consistency
  6. useragent consistency
  7. pwInitScripts (Playwright init script detection)
  8. exposeFunctionLeak
  9. mainWorldExecution
  10. window.dummyFn

### scrapfly/Antibot-Detector
- **Repo**: https://github.com/scrapfly/Antibot-Detector
- **Purpose**: Real-time detection of anti-bot systems
- **Identifies**: Cloudflare, Akamai, DataDome, reCAPTCHA, hCaptcha, Shape Security

---

## Timing Utilities

### Recommended delay distributions

```python
import numpy as np

# Log-normal delays (more human-like than uniform)
def human_delay(context='default'):
    """
    Returns delay in seconds using log-normal distribution
    Calibrated to match empirical human browsing data
    """
    # (μ, σ) for log-normal in milliseconds
    params = {
        'click_to_type': (6.5, 0.6),     # ~665ms median
        'between_fields': (7.0, 0.7),     # ~1100ms median
        'page_load_to_action': (7.5, 0.8), # ~1800ms median
        'inter_keystroke': (5.3, 0.4),    # ~200ms median
        'scroll_pause': (7.2, 0.8),       # ~1300ms median
        'form_review': (8.0, 0.6),        # ~3000ms median
    }
    mu, sigma = params.get(context, (7.0, 0.8))
    ms = np.random.lognormal(mu, sigma)
    return ms / 1000

# Occasional "thinking" pauses (3-10 seconds)
def thinking_pause():
    return np.random.uniform(3, 10)
```

---

## Key Combination for Maximum Evasion (2025-2026)

Based on proxies.sx analysis achieving 89-95% success rates:

1. **IP**: Mobile residential proxies (not datacenter, not static residential)
2. **Browser**: Camoufox (Firefox) or Chrome with rebrowser-patches
3. **TLS**: Handled by real browser engine (not Python requests library)
4. **Mouse**: Ghost-cursor or sigma-lognormal implementation
5. **Keyboard**: Log-normal IKI sampling with digraph corrections
6. **Scroll**: Variable speed, content-paced with backtracking
7. **Timing**: Log-normal delays, not uniform random
8. **Session**: Markov chain navigation, circadian timing

Without layer 1 (residential IP), all behavioral simulation is insufficient.
