# Mouse Movement Algorithms

## 1. WindMouse Algorithm

**Origin**: ben.land blog post (2021), widely adopted
**GitHub**: https://github.com/AsfhtgkDavid/windmouse
**Concept**: Models cursor as a physics particle with inertia, acted on by:
- Gravity vector (constant magnitude, always points toward target)
- Wind force (random perturbation)

**Parameters**:
- `gravity` (G): pull strength toward target
- `wind` (W): random perturbation magnitude
- `minWait`, `maxWait`: speed control
- `targetArea`: radius around target for deceleration

**Limitation**: Produces recognizable "swooping" patterns; does not model the sigma-lognormal velocity profile seen in real human movements.

---

## 2. Bezier Curve + Fitts's Law (Ghost-Cursor)

**GitHub**: https://github.com/Xetera/ghost-cursor
**Playwright port**: https://github.com/bn-l/ghost-cursor-play

**Algorithm**:
1. Select random control points above and below the direct path (constrained to one side to avoid cubic artifacts)
2. Apply Fitts's Law to determine point density (speed): `MT = a + b * log2(D/W + 1)` where D = distance, W = target width
3. Overshoot logic: if target distance > `overshootThreshold` (default 500px), cursor moves past target then corrects
4. `moveSpeed` is randomized by default

**Key insight**: Fitts's Law predicts that larger, closer targets are reached faster — matching empirical human motor behavior.

**Weakness**: Pure Bezier curves lack the velocity profile (bell-shaped speed curve with acceleration/deceleration) that sigma-lognormal models produce.

---

## 3. Sigma-Lognormal Model (Kinematic Theory of Rapid Movements)

**Foundational paper**: Plamondon, R. (1995). "A kinematic theory of rapid human movements." *Biological Cybernetics*, 72(4), 295-307.
**URL**: https://link.springer.com/article/10.1007/BF00202785
**Extensions**: https://arxiv.org/html/2401.16519

**Core Concept**: Human voluntary movement is a summation of overlapping lognormal velocity pulses, each representing a neuromuscular command.

**Velocity profile equation**:
```
v(t) = Σ_i A_i * Λ(t; t₀ᵢ, μᵢ, σᵢ²)
```
Where `Λ` is a lognormal function parameterized by:
- `t₀`: command onset time
- `μ`: log-mean of the impulse response
- `σ`: log-standard deviation (shape control)
- `A`: amplitude (movement magnitude)

**Practical decomposition**: Any mouse trajectory can be decomposed into N lognormal "strokes":
- First 1-2 strokes: large amplitude (agonist + antagonist muscle activation) = ballistic phase
- Later strokes: small amplitude, low velocity = fine correction phase

**BeCAPTCHA-Mouse implementation**: The BiDAlab group at UAM uses this model to generate synthetic trajectories and extract neuromotor features for bot detection.
**Dataset**: 200K+ trajectories from 58 users; publicly available at https://github.com/BiDAlab/BeCAPTCHA-Mouse
**Detection accuracy**: 93% bot detection accuracy using single trajectory

**Private commercial implementation**: PHC Mouse Movement Generator (https://github.com/Pointergeist/PHC-mouse-movement-gen) claims to use sigma-lognormal model derived from collected datasets; closed-source, API-based.

---

## 4. Minimum Jerk Trajectory Model

**Origin**: Flash, T. & Hogan, N. (1985). "The coordination of arm movements: An experimentally confirmed mathematical model." *Journal of Neuroscience*, 5(7), 1688-1703.

**Principle**: Human arm movements minimize the integral of squared jerk (third derivative of position):
```
minimize ∫₀ᵀ (d³x/dt³)² + (d³y/dt³)² dt
```

**Optimal solution**: Fifth-order polynomial in time:
```
x(t) = x₀ + (xf - x₀) * [10τ³ - 15τ⁴ + 6τ⁵]
```
Where `τ = t/T` (normalized time).

**Resulting velocity profile**: Bell-shaped, symmetric, peaks at T/2 — matching empirical human hand movement data.

**Application to mouse simulation**:
- Produces the smooth acceleration-deceleration profile humans naturally use
- Works well for short, direct movements
- Does NOT naturally produce curved paths (requires spatial extension)
- MATLAB implementation: `minjerkpolytraj` function

**When to use**: Best for modeling individual "strokes" within a longer multi-segment movement; pair with sigma-lognormal for full trajectory realism.

---

## 5. Entropy-Controlled Diffusion Network (DMTG)

**Paper**: "DMTG: A Human-Like Mouse Trajectory Generation Bot Based on Entropy-Controlled Diffusion Networks"
**URL**: https://arxiv.org/html/2410.18233v1
**Year**: 2024

**Algorithm**:
1. Modified DDIM (Denoising Diffusion Implicit Model)
2. Complexity Control Parameter α: mixes Gaussian noise distribution with structured directional movement distribution
3. Style encoding via positional encoding (Transformer-style) manages complexity coefficients
4. Trained on real human trajectory datasets

**Human characteristics captured**:
- Differential acceleration: upward vs downward movements have different force application profiles
- Slow movement initiation patterns
- Natural trajectory curvature and randomness within purposeful direction

**Advantage over classical models**: Learns the full joint distribution of trajectory properties rather than approximating individual features.

---

## 6. GAN-Based Trajectory Generation

**BeCAPTCHA-Mouse GAN approach**:
- Generator architecture: takes Gaussian noise input, outputs synthetic trajectories
- Discriminator: trained to distinguish real vs synthetic human trajectories
- Achieves near-indistinguishable distributions from real human data in neuromotor feature space

**MouseAgent** (referenced in IEEE paper "Learning Human Behavior for Bot Detection"):
- Adversarial generative network approach
- Learns from human user behavior datasets

---

## 7. Ornstein-Uhlenbeck Process for Hand Tremor

**Mathematical definition**:
```
dx_t = θ(μ - x_t)dt + σ dW_t
```
Where:
- `θ`: mean reversion rate (how quickly tremor returns to baseline)
- `μ`: long-term mean (typically 0 for tremor offset)
- `σ`: volatility (tremor amplitude)
- `W_t`: Wiener process (Brownian motion)

**Application to mouse simulation**: Add OU noise to ideal trajectory coordinates:
```python
# Bivariate OU for X,Y jitter
dx = theta * (mu_x - x) * dt + sigma * sqrt(dt) * randn()
dy = theta * (mu_y - y) * dt + sigma * sqrt(dt) * randn()
```

**Typical human tremor parameters** (from physiological literature):
- Physiological tremor: 8-12 Hz, amplitude ~0.5-2 pixels at screen distance
- OU parameters: θ ≈ 5-15 Hz, σ ≈ 0.3-1.0 pixels/√s

**Key property**: Stationary, Gaussian, Markov — produces correlated noise that looks more realistic than white noise.

**Python resources**:
- https://github.com/jwergieluk/ou_noise
- Euler-Maruyama numerical method for simulation

---

## 8. Real Mouse Trajectory Datasets

| Dataset | Size | Source | URL |
|---------|------|--------|-----|
| BeCAPTCHA-Mouse | 200K+ trajectories, 58 users | UAM BiDAlab | https://github.com/BiDAlab/BeCAPTCHA-Mouse |
| ReMouse | Real-world with repeat sessions | Academic | https://www.mdpi.com/2624-800X/3/1/7 |
| KeyRecs | Keystroke + mouse dynamics | PMC | https://pmc.ncbi.nlm.nih.gov/articles/PMC10474054/ |

---

## Implementation Recommendations

**Layered approach for maximum realism**:
1. **Path planning**: Bezier curve or spline for overall trajectory shape
2. **Velocity profile**: Sigma-lognormal or minimum-jerk for speed along path
3. **Micro-corrections**: Small sigma-lognormal "fine adjustment" strokes near target
4. **Tremor overlay**: OU process noise on top of planned trajectory
5. **Fitts's Law scaling**: Adjust total movement time based on distance/target size
6. **Overshoot**: Probabilistic overshoot for distant/small targets, re-approach stroke

**Timing between movements**:
- Use log-normal distribution for inter-movement intervals (not uniform random)
- Mode around 200-800ms for typical cursor repositioning
- Occasional longer pauses (2-7 seconds) for "reading" state
