# Research Summary: Human Behavior Simulation for Bot Detection Evasion (2025-2026)

## Executive Summary

Bot detection systems (Akamai, Cloudflare, PerimeterX/HUMAN, DataDome) have evolved beyond simple fingerprinting into full behavioral biometric analysis, collecting 35+ signals per session covering mouse movement, keystroke dynamics, scroll patterns, and session-level navigation. The academic and open-source communities have developed rigorous counter-techniques grounded in neuroscience (sigma-lognormal motor models), physics (minimum jerk, Ornstein-Uhlenbeck processes), and machine learning (GANs, diffusion models, LSTM-based keystroke synthesis). Recent research (2026) demonstrates that sampling inter-keystroke intervals from empirical human distributions achieves 99.8%+ evasion rates against state-of-the-art classifiers.

## Key Files

- `mouse_movement.md` - Mouse trajectory algorithms (Bezier, WindMouse, sigma-lognormal, diffusion, minimum jerk, OU process)
- `keystroke_dynamics.md` - Typing simulation: IKI distributions, digraph timing, error rates, IME handling
- `scroll_behavior.md` - Scroll physics, inertial momentum, reading-speed correlation
- `page_interaction.md` - Dwell time, focus/blur, clipboard, right-click, text selection
- `session_behavior.md` - Markov chains, Poisson processes, circadian patterns, session duration
- `detection_systems.md` - What each major vendor actually measures
- `tools_ecosystem.md` - Production tools: ghost-cursor, camoufox, rebrowser, emunium
- `sources.md` - Full bibliography
