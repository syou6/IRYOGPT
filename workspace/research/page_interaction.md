# Page Interaction Patterns

## 1. Dwell Time Distribution on Elements

### Definition
Time cursor hovers over or near an interactive element before clicking.

### Human dwell time distributions
- **Simple buttons** (known location): 100-400ms hover before click
- **Unknown links**: 300-800ms (reading the link text)
- **Form fields**: 200-600ms (considering what to type)
- **Dropdown menus**: 300-1000ms after opening, before selection
- **Images**: 500ms-3s for meaningful images; near-zero for decorative
- **Navigation links**: 150-500ms

### Implementation
```python
import numpy as np

def dwell_time_before_click(element_type, element_label_length=0):
    """Sample realistic dwell time before clicking element"""
    params = {
        'button': (5.5, 0.4),       # log-normal (μ, σ) → ~250ms median
        'link': (5.9, 0.5),          # → ~365ms median
        'input': (5.7, 0.45),        # → ~300ms median
        'dropdown': (6.2, 0.5),      # → ~490ms median
        'checkbox': (5.6, 0.4),      # → ~270ms median
    }
    mu, sigma = params.get(element_type, params['button'])
    # Longer labels take more time to read
    reading_bonus = element_label_length * 0.003  # ~3ms per character
    base = np.random.lognormal(mu, sigma) / 1000
    return base + reading_bonus
```

### Bot detection signal
DataDome and PerimeterX track hover duration; clicking instantly (< 50ms after mouse arrival) is a strong bot signal.

---

## 2. Tab Switching / Focus-Blur Patterns

### Natural tab behavior
Humans frequently switch tabs while waiting for content to load or checking other information:
- `visibilitychange` event: `document.hidden = true` when tab blurs
- `focus`/`blur` events on window
- Typical tab switch duration: 5-30 seconds away from page

### Detection signal
Anti-bot systems monitor:
- Pages where user never triggered `blur` event (no real browsing context)
- `Page Visibility API` never showing hidden state
- `document.hasFocus()` always returning true

### Simulation
```javascript
// Occasional tab-away simulation via visibility events
// Note: Can't programmatically fire these in headless browsers convincingly
// Real fix: Use non-headless browser mode
```

**Key insight**: Headless browsers typically never fire `visibilitychange` because there is no competing tab. This is a detectable signal. Using non-headless mode (or Camoufox/nodriver) resolves this.

---

## 3. Copy-Paste Behavior Detection

### What anti-bot systems detect
- Paste events into form fields without prior focus+typing sequence
- Clipboard content pasted that is perfectly identical to target value
- `paste` event without preceding `copy` on the same page
- Form fill via `input.value = 'text'` without firing keyboard events

### Human copy-paste patterns
- Select text with mouse drag (or Ctrl+A)
- `copy` event fires on source element
- Navigate to target field (mouse movement)
- `paste` event fires with 300-800ms delay after arriving at field
- User often glances at pasted content briefly (300ms-1s before continuing)

### Safe clipboard simulation in automation
```javascript
// DON'T: Direct value assignment
element.value = 'text';  // No keyboard events — bot signal

// DON'T: page.fill() in Playwright without events
await page.fill('#input', 'text');  // May not fire all events

// DO: Type character by character with realistic timing
await page.type('#input', 'text', { delay: sampleIKI() });

// For paste simulation (when needed):
await page.evaluate(async (text) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
    });
    document.activeElement.dispatchEvent(pasteEvent);
}, textToPaste);
```

---

## 4. Right-Click / Context Menu Patterns

### Natural right-click behavior
- Humans right-click to: inspect element (devtools), open link in new tab, save image, copy link
- Frequency: ~2-5% of clicks are right-clicks in typical browsing
- Right-click is preceded by mouse dwell: 200-600ms hover before right-click
- After context menu appears: user reads options for 300ms-1.5s, then selects or dismisses

### Detection implications
- Never right-clicking at all can be suspicious on very long sessions
- Contextmenu event should fire naturally from `page.mouse.click({button: 'right'})`
- Playwright/Puppeteer: `await page.click(selector, {button: 'right'})`

---

## 5. Text Selection Patterns

### How humans select text
- **Double-click**: Selects single word; most common selection method
- **Click-drag**: For phrases; cursor moves from start to end, mouseup releases
- **Triple-click**: Selects full paragraph line
- **Shift+click**: Extends selection

### Selection velocity characteristics
From "Learning Human Behavior for Bot Detection" (IEEE 10451138):
- Human drag selection: decelerating near selection endpoint (Fitts's Law applies)
- Selection movement: non-linear path even for straight horizontal text
- Humans frequently over-select then adjust (mousedown, drag, slight correction)

### Automated selection detection signals
- Perfect pixel-accurate selection (start and end at exact character boundaries)
- Constant velocity drag (no deceleration)
- Instantaneous selection of multiple paragraphs (no drag time)

---

## 6. Form Interaction Patterns

### Natural form completion sequence
1. **Survey page**: ~2-5s reading time before touching first field
2. **Field navigation**: Mix of Tab (keyboard flow) and mouse clicks
3. **Tab usage**: 60-70% of users use Tab between simple fields
4. **Mouse click**: More common when fields are far apart or non-sequential
5. **Review before submit**: 1-5s pause looking at filled form
6. **Submit hesitation**: Brief pause (200-800ms) before clicking submit

### Validation error behavior
- Error appears → user looks at error (500ms-2s dwell)
- Moves to fix the field (natural mouse path, not instant focus)
- Re-reads field content before editing (200-500ms)
- Makes correction with realistic typing

---

## Key Sources

- https://multilogin.com/glossary/anti-bot-behavior-simulation/ — Dwell time, error corrections
- https://incolumitas.com/2021/04/11/bot-detection-with-behavioral-analysis/ — Focus/blur, behavioral spikes
- https://pushsecurity.com/blog/introducing-malicious-copy-paste-detection — Copy-paste detection
- https://ieeexplore.ieee.org/document/10451138/ — Text selection human patterns
- DataDome signals list — click coordinates, hover patterns, copy-paste behavior
