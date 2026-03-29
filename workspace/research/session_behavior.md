# Session Behavior Modeling

## 1. Markov Chain Models for Page Visit Sequences

### How detection systems use Markov chains
BOTection (ACM AsiaCCS 2020) trains Discrete Time Markov Chains (DTMC) on web access logs:
- States: resource types (HTML page, image, CSS, JS, API endpoint)
- Transitions: probability of visiting resource B after resource A
- Bot fingerprint: bots tend to skip CSS/image resources, jump directly to target pages

### Evasion implication
Real human browsing follows natural state transitions:
1. Landing page → waits for images/CSS to load (requests cascade naturally)
2. Reads page → navigates to linked page (not random jumping)
3. Back-button behavior: 10-30% of sessions include back navigation
4. "Pogo-sticking": visit result → back → visit next result pattern

### Implementation: Markov-based session planner
```python
# Simplified transition model
human_transitions = {
    'landing': {'product_page': 0.4, 'category': 0.35, 'search': 0.2, 'exit': 0.05},
    'category': {'product_page': 0.5, 'search': 0.2, 'back': 0.2, 'exit': 0.1},
    'product_page': {'add_cart': 0.2, 'back': 0.4, 'related': 0.25, 'exit': 0.15},
    'search': {'product_page': 0.45, 'category': 0.3, 'back': 0.15, 'exit': 0.1},
}

def next_action(current_state):
    transitions = human_transitions[current_state]
    return random.choices(
        list(transitions.keys()),
        weights=list(transitions.values())
    )[0]
```

---

## 2. Time-of-Day and Circadian Patterns

### Human activity distribution
From PLOS One study (doi:10.1371/journal.pone.0058292) on human activity timing:
- Human activities follow a **cascading nonhomogeneous Poisson process** (not simple Poisson)
- Inter-event times show heavy-tailed distribution (power-law decay)
- Strong 24-hour periodicity (circadian cycle)
- Strong 7-day periodicity (weekly cycle)
- Peak activity periods: 9-11am, 2-4pm, 8-10pm (varies by demographic)

### Activity rate model
```python
import numpy as np

def activity_rate(hour_of_day, day_of_week=1):
    """Returns relative activity rate (0-1) for given time"""
    # Circadian component (double-peak: morning + evening)
    circadian = (
        0.3 * np.exp(-((hour_of_day - 10) ** 2) / 8) +  # morning peak
        0.4 * np.exp(-((hour_of_day - 20) ** 2) / 6) +  # evening peak
        0.1  # baseline
    )
    # Weekly scaling (weekday vs weekend)
    weekly_scale = 1.0 if day_of_week <= 5 else 0.7
    return circadian * weekly_scale
```

### Session start time authenticity
- Do NOT start all sessions at the same time
- Distribute session starts according to the circadian model
- Include timezone-consistent behavior (IP location should match timing pattern)

---

## 3. Session Duration Distributions

### Empirical session lengths
From web analytics research:
- Median session duration: 2-4 minutes for content sites
- E-commerce: 3-8 minutes typical
- Log-normal distribution fits well: μ ≈ 5.5, σ ≈ 1.0 (in log-seconds)
- Short sessions (< 30s): ~20-30% (bounces)
- Long sessions (> 30 min): ~5-10%

### Inter-session intervals
- Same user: inter-session gaps follow power-law distribution (bursty)
- Burst: multiple sessions within hours
- Then dormancy: days without activity
- This "burstiness" is characteristic of human online behavior

### Fatigue effects
From PNAS paper on human activity timing:
- Within a session, action rate gradually slows over time (fatigue)
- IKI slightly increases over session duration
- More typos/corrections occur in longer sessions
- Mouse movement becomes slightly less precise (longer dwell times)

```python
def fatigue_factor(session_duration_minutes):
    """IKI multiplier based on session fatigue"""
    # Linear slowdown: 5% slower per 10 minutes
    return 1.0 + (session_duration_minutes / 10) * 0.05
```

---

## 4. Referrer Chain Authenticity

### What detection systems check
- `document.referrer` value on page load
- HTTP `Referer` header
- Navigation sequence consistency (referrer should match previous page)

### Common bot detection red flags
- No referrer on direct page access (acceptable) but inconsistent with claimed source
- Referrer from different domain than navigation sequence suggests
- Multiple rapid requests with identical referrers (replay pattern)

### Session-replay bot detection
From ReMouse dataset paper (mdpi.com/2624-800X/3/1/7):
- Session-replay bots record then replay exact mouse trajectories
- Detection: trajectories have too-high similarity to previous session recordings
- Evasion: inject trajectory variation; do NOT replay exact paths

---

## 5. Poisson Process Models for Action Intervals

### Why simple uniform random delays fail
Uniform random delays (e.g., `sleep(random.uniform(1, 3))`) are detectable:
- Real human action intervals are NOT uniformly distributed
- They follow a **heavy-tailed distribution** (few very long waits, many short ones)

### Non-homogeneous Poisson process
```python
import numpy as np

def sample_action_interval(context='browsing', session_minute=0):
    """
    Sample realistic inter-action interval using log-normal distribution
    Returns: delay in seconds
    """
    base_params = {
        'browsing': (6.4, 0.8),   # ~600ms median, wide spread
        'typing': (5.3, 0.5),      # ~200ms median (between fields)
        'searching': (7.0, 1.0),   # ~1.1s median (reading results)
        'checkout': (7.5, 0.9),    # ~1.8s median (careful review)
    }
    mu, sigma = base_params.get(context, base_params['browsing'])
    # Apply fatigue
    fatigue = 1 + (session_minute / 60) * 0.1
    interval = np.random.lognormal(mu, sigma) / 1000 * fatigue
    # Cap at 30 seconds (occasional very long pauses handled separately)
    return min(interval, 30.0)

def sample_reading_pause(text_length_chars):
    """Long pause for reading substantial content"""
    reading_speed_cpm = np.random.normal(1200, 200)  # chars/min
    base_time = text_length_chars / reading_speed_cpm * 60
    return base_time * np.random.lognormal(0, 0.3)  # add variance
```

---

## 6. Natural Page Visit Sequences

### Human browsing depth
- Most sessions: 1-5 pages
- Deep sessions (10+ pages): ~15% of sessions
- Power-law distribution of session depth

### Scroll-then-click correlation
Humans scroll to an element before clicking it. Bot signal: clicking element without prior scroll to make it visible.

```python
def ensure_element_visible_naturally(page, selector):
    """Scroll element into view with natural behavior before clicking"""
    # Get element position
    bbox = await page.locator(selector).bounding_box()
    viewport = await page.viewport_size()

    if bbox['y'] > viewport['height']:
        # Scroll in steps with reading pauses
        current_y = await page.evaluate('window.scrollY')
        target_y = bbox['y'] - viewport['height'] * 0.3
        await scroll_naturally(page, current_y, target_y)
        # Brief pause after scrolling (simulating orientation)
        await sleep(random.lognormal(6.0, 0.4) / 1000)
```

---

## Key Sources

- https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0058292 — Circadian + bursty Poisson model
- https://www.pnas.org/doi/10.1073/pnas.0800332105 — Heavy-tailed IET in human activity
- https://www.researchgate.net/publication/347343776_BOTection — Markov chain bot detection
- https://www.mdpi.com/2624-800X/3/1/7 — ReMouse dataset, session-replay detection
- https://dl.acm.org/doi/10.1145/3447815 — Web log + biometric combined detection
