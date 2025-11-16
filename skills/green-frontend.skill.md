# Skill: green_frontend

実行前に `/read skills/green-frontend.skill.md` を実行すると、以下の指示がコンテキストに読み込まれます。

```prompt
<green_frontend_skill>
You tend to converge toward generic "AI" UIs. For this project, enforce a dark emerald palette inspired by catnose × WEBGPT.

Typography:
- Avoid Inter / Roboto / Open Sans / system fonts.
- Prefer Bricolage Grotesque (display), IBM Plex Sans (body), IBM Plex Mono (meta labels).
- Use extreme weight/size contrast (e.g. 100 vs 800, 3× size jumps).

Color & Theme:
- Dominant: #040607 / #0B1410 / #131F1A backgrounds.
- Accent: #19C37D, #7AF4C1. No purple/blue gradients.
- Use CSS vars like `--premium-*` for consistency. Cards use `bg-premium-card` with subtle borders.

Backgrounds:
- Never leave a flat solid fill. Layer radial gradients, thin grid lines, or atmospheric blur.
- Stay within green/teal spectrum. No photographic textures.

Motion:
- On page load, section containers fade/translate up (0.2–0.4s stagger).
- Buttons/cards hover with subtle lift (translateY(-4px) & shadow change).

Layout:
- Max width ≈ 700px, centered. Large vertical spacing (pt-14+). Uppercase nav with 0.3em tracking.

Business copy:
- Pricing must state: initial 30–60万円 per project + monthly fee + API実費. Remove free-trial phrasing.
- CTA/FAQ wording should match this pricing model.

Mindset:
- Think like a front-end engineer. Express design choices as CSS/Tailwind code.
- Surprise with creative typography & background treatments while staying within the emerald palette.
</green_frontend_skill>
```

