# Scroll Behavior Simulation

## 1. Physical Scroll Models

### Mouse Wheel (Discrete Scrolling)
- Each wheel tick generates a fixed scroll delta (typically 100-120px or 3 "lines")
- Human behavior: 1-3 ticks fired in quick succession (burst), then pause
- Inter-tick interval within a burst: 20-100ms
- Inter-burst interval: 200ms-3s depending on content engagement
- Sometimes single ticks; sometimes rapid multi-tick bursts

### Touchpad / Magic Mouse (Momentum Scrolling)
- Generates continuous `wheel` events with varying `deltaY`
- Natural pattern: starts slow, accelerates, then decelerates with exponential decay
- Delta values: small start (5-15px), peak (50-200px), trailing off (< 5px cutoff)
- iOS/macOS model: deceleration coefficient ~0.95 per frame at 60fps

### Simulating Momentum Scrolling
```javascript
async function momentumScroll(page, distance, duration_ms=800) {
    const frames = Math.round(duration_ms / 16.67); // 60fps
    const peaks_at = 0.2; // peak velocity at 20% of total time

    let scrolled = 0;
    for (let i = 0; i < frames; i++) {
        const t = i / frames;
        // Bell-shaped velocity: rises then decays
        const velocity = t < peaks_at
            ? distance * (t / peaks_at) * 2 / frames
            : distance * Math.exp(-4 * (t - peaks_at)) * 2 / frames;

        await page.mouse.wheel({ deltaY: velocity });
        scrolled += velocity;
        await sleep(16 + Math.random() * 5 - 2); // ~60fps with jitter
    }
}
```

---

## 2. Reading-Speed Based Scroll Timing

### Reading speed data
- Average adult reading speed: 200-250 WPM (English)
- Fast readers: 400+ WPM
- Skimming: 600-1000 WPM
- Japanese reading: ~400-600 characters/minute

### Scroll-to-content correlation
Anti-bot systems correlate scroll position with time-on-page:
- If user scrolled to bottom of 1000-word article in 3 seconds: bot signal
- Normal reading pace for 1000 words: ~4-5 minutes
- Skimming 1000 words: ~60-90 seconds

### Implementation: content-aware scroll timing
```python
def calculate_scroll_delay(visible_text_chars, reading_speed_cpm=1200):
    """
    reading_speed_cpm: characters per minute during 'skimming'
    1200 cpm ~ casual skimming (still faster than careful reading)
    """
    chars_per_second = reading_speed_cpm / 60
    base_delay = visible_text_chars / chars_per_second
    # Add variance: ±30%
    variance = base_delay * 0.3
    return base_delay + random.uniform(-variance, variance)
```

---

## 3. Scroll Jank and Stutter Simulation

Real human scrolling is NOT perfectly smooth. Include:

### Jank patterns
- **Pause-then-burst**: Stop reading for 500ms-2s, then scroll rapidly to next section
- **Micro-stutters**: Occasional 50-150ms pauses mid-scroll (attention shifts)
- **Backtrack scrolling**: 10-20% probability of scrolling back up slightly after reaching a new section

### Stutter frequency
```python
def add_scroll_jank(scroll_events):
    """Add random pauses and micro-stutters to scroll event sequence"""
    result = []
    for event in scroll_events:
        # 5% chance of micro-stutter
        if random.random() < 0.05:
            result.append({'type': 'pause', 'duration': random.uniform(0.05, 0.15)})
        result.append(event)
        # 2% chance of backtrack
        if random.random() < 0.02:
            backtrack_amount = random.uniform(0.1, 0.4)  # scroll back 10-40%
            result.append({'type': 'scroll_up', 'amount': backtrack_amount})
    return result
```

---

## 4. Desktop vs Mobile Scroll Differences

### Desktop (mouse wheel)
- Discrete steps: 3-line or 100px increments
- Speed: Controlled by scroll velocity (number of ticks per second)
- Horizontal scroll: Rare except for wide tables (shift+wheel)
- Event type: `WheelEvent` with `deltaMode=1` (DOM_DELTA_LINE) or `deltaMode=0` (DOM_DELTA_PIXEL)

### Mobile / Touchpad (continuous)
- Smooth, continuous `WheelEvent` with `deltaMode=0`
- Momentum: continues after finger lifts (exponential decay)
- Two-finger gesture on trackpad generates similar events
- `navigator.maxTouchPoints > 0` signals touch capability

### Matching browser's expected input device
If spoofing as mobile device, ensure scroll events match mobile patterns:
- deltaMode=0 (pixel-based)
- Smooth acceleration/deceleration
- No sudden stops

---

## 5. Scroll Position Patterns

### Natural scroll sequences on content pages
1. Initial scroll: 50-200px to clear navigation/header
2. Reading phase: slow scroll (50-100px/sec) while reading
3. Skim sections: faster scroll (300-500px/sec) through uninteresting parts
4. Stop at images/forms: 0.5-3s pause
5. Footer visit: ~60% of users never scroll to footer

### Anti-bot scroll behaviors to AVOID
- Perfect linear velocity scroll
- Scrolling exactly to element Y coordinate
- Scroll then immediate form fill (no reading time)
- Scrolling at same speed throughout entire page
- Using `scrollIntoView()` directly (generates no WheelEvent, suspicious)

---

## Key Sources

- https://multilogin.com/glossary/anti-bot-behavior-simulation/ — Scroll speed/content correlation
- https://www.proxies.sx/blog/datadome-akamai-bypass-mobile-proxies — Variable scroll, "reading" pauses
- https://alvarotrigo.com/blog/kinetic-scrolling/ — Kinetic scrolling device physics
- DataDome documentation — DataDome analyzes scroll velocity and pause patterns
