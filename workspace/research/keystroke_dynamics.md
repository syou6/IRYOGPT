# Keystroke Dynamics Simulation

## Core Terminology

- **Dwell time (hold duration)**: Duration a key is pressed (keydown to keyup)
- **Flight time**: Time between keyup of one key and keydown of the next
- **Inter-Key Interval (IKI)**: Total time between consecutive keydown events = dwell + flight
- **Digraph timing**: IKI for a specific pair of consecutive keys (e.g., "th", "in", "er")
- **Trigraph timing**: IKI across three consecutive keys

---

## 1. Inter-Key Interval (IKI) Distributions

### Empirical human typing patterns

From the timing-forgery attack paper (arxiv.org/html/2601.17280v1):

**Histogram sampling approach**:
- Sample each IKI independently from the empirical CDF of human inter-keystroke intervals
- Requires only aggregate statistics from public keystroke datasets
- O(n) time per session
- **Achieves 99.8%+ evasion rate against 5 classifiers**

**Statistical impersonation**:
```
Δⱼ = μ_human + σ_human · zⱼ + c(kⱼ, kⱼ₊₁)
```
Where:
- `μ_human`: population mean IKI (~100-200ms for typical typist)
- `σ_human`: population std dev
- `zⱼ`: standard normal sample
- `c(kⱼ, kⱼ₊₁)`: digraph-specific correction from public latency tables

**LSTM generative model** (most realistic):
- Architecture: 2-layer LSTM, 64 hidden units/layer
- Character embedding: dim=32, concatenated with previous IKI
- Output: Mixture density network with 5 Gaussian components
- Training: 5 epochs on 5,000 human sessions (80/20 split), Adam lr=1e-3
- Loss: Negative log-likelihood
- Sampling: Temperature 1.0, IKI clipped to [30, 3000]ms range
- Achieves: mean δ = 0.877 (human baseline δ = 0.987)

### Key datasets for IKI calibration
- CMU Keystroke Dynamics Benchmark Dataset (public, ~51 users, fixed password)
- KeyRecs dataset: https://pmc.ncbi.nlm.nih.gov/articles/PMC10474054/
- Aalto dataset (touchscreen typing, 37K participants)

### Typical distribution parameters
- Mean IKI: 100-250ms (depends on typing speed)
- Distribution shape: right-skewed, approximately log-normal
- For 60 WPM typist: ~200ms average IKI
- Common bigrams ("th", "he", "in"): 10-30% faster than average
- Infrequent bigrams: 50-200% slower than average

### Autocorrelation caveat
Human typing shows autocorrelation ρ₁ ≈ 0.087 (sequential IKIs are slightly correlated). Simple histogram sampling fails to reproduce this. Fix: apply AR(1) injection after sampling.

---

## 2. Key Hold Duration (Dwell Time)

**Typical values**:
- Average dwell time: 60-120ms
- Modifier keys (Shift, Ctrl): 150-300ms (held longer)
- Spacebar: 80-150ms
- Distribution: Approximately log-normal, right-skewed

**Implementation**:
```python
import numpy as np

def sample_dwell_time(key_type='normal'):
    params = {
        'normal': (4.3, 0.3),    # log-normal (μ, σ) → ~75ms median
        'modifier': (4.9, 0.35), # → ~135ms median
        'space': (4.5, 0.3),     # → ~90ms median
        'backspace': (4.8, 0.4)  # → ~120ms median
    }
    mu, sigma = params.get(key_type, params['normal'])
    return np.random.lognormal(mu, sigma) / 1000  # convert to seconds
```

---

## 3. Error Rate Simulation

### Human error rates
- Competent typists: 2-5% error rate (per character)
- Higher error rates at: word boundaries, after long words, complex sequences
- Error types: substitution (wrong key), transposition (swapped keys), omission

### Error correction patterns
Two natural correction strategies:
1. **Immediate correction**: backspace within 200-500ms of error
2. **Delayed correction**: type a few more characters, then backspace multiple times

### Implementation approach
```python
def should_make_error(char_index, word, typing_speed_wpm):
    # Higher error probability for:
    # - Characters after complex sequences
    # - Higher typing speeds
    # - Uncommon character combinations
    base_error_rate = 0.02  # 2%
    complexity_factor = get_bigram_difficulty(word, char_index)
    speed_factor = max(1.0, typing_speed_wpm / 80)  # more errors at high speed
    return random.random() < (base_error_rate * complexity_factor * speed_factor)

def correction_delay_strategy():
    # Immediate (70% of the time): backspace within 300ms
    # Delayed (30% of the time): continue 1-4 chars, then correct
    if random.random() < 0.7:
        return 'immediate', random.lognormal(5.5, 0.4) / 1000
    else:
        extra_chars = random.randint(1, 4)
        return 'delayed', extra_chars
```

---

## 4. Language-Specific Patterns: Japanese IME Input

### IME composition events
Japanese input via IME (MS-IME, Google IME, macOS IME) fires specific browser events:
1. `compositionstart`: User begins IME input (e.g., starts typing romaji)
2. `compositionupdate`: Each keystroke updates the composition buffer
3. `compositionend`: User commits the conversion (presses Enter or selects)

### Detection implications
- Raw keystroke events during IME composition are different: the browser sees romaji keystrokes, not the final kanji/hiragana
- `input` event during composition has `isComposing: true`
- The gap between `compositionend` and next `compositionstart` varies significantly

### IME-specific timing characteristics
**Romaji input phase**: Similar to normal Latin typing (IKI ~100-200ms)
**Conversion selection phase**: Longer pause (500ms-3s) for user to review/select candidates
**Confirmation**: Enter key or space key press after ~200-800ms review time

### Simulation approach for Japanese
```javascript
// Fire composition events for Japanese input
async function typeJapanese(page, selector, text_romaji, text_kanji) {
    await page.focus(selector);
    // 1. Type romaji with normal IKI distribution
    for (const char of text_romaji) {
        await page.keyboard.type(char);
        await sleep(sampleIKI('romaji'));
    }
    // 2. Pause for conversion review (500ms-2s)
    await sleep(sampleLognormal(700, 400));
    // 3. Fire compositionend (commit with Enter)
    await page.keyboard.press('Enter');
    // 4. Brief post-commit pause
    await sleep(sampleIKI('normal'));
}
```

### Key detection signal
Anti-bot systems that analyze Japanese input look for:
- Absence of `compositionstart`/`compositionend` events (direct kanji injection)
- Unnatural conversion timing (too fast or perfectly timed)
- Missing `input` events with `isComposing: true` during composition phase

---

## 5. Thinking Pauses and Contextual Timing

**Natural typing pause locations**:
- Before first word of a sentence: 300-800ms
- After punctuation: 100-400ms
- Before/after complex words: 200-600ms
- When switching from one field to another: 500ms-2s
- Before form submission: 1-3s (review behavior)

**Inter-field timing** (form filling):
- Tab between fields: 300-800ms
- Click to next field: accounts for mouse movement time + 200-500ms
- Reviewing filled fields: random 500ms-3s pauses

---

## Key Sources

- arxiv.org/html/2601.17280v1 — Timing-forgery attacks, LSTM model, 99.8% evasion
- https://dl.acm.org/doi/10.1145/3733103 — ACM Survey on keystroke dynamics (2025)
- https://link.springer.com/chapter/10.1007/978-3-031-65175-5_30 — Bot detection via keystroke dynamics
- https://pmc.ncbi.nlm.nih.gov/articles/PMC10474054/ — KeyRecs dataset
