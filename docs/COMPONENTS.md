# Components

Components are reusable building blocks that meet specific interaction needs. They combine to create intuitive user experiences for SiteGPT.jp.

## Design principles

- **Clarity first** – keep copy concise, leverage generous line-height, and reserve accent colors for interactive elements so actions are immediately scannable.
- **Depth through glass** – layer translucent surfaces over soft gradient backdrops; always pair blur (`backdrop-blur-sm`+) with subtle borders to avoid muddy edges.
- **Neon energy, sparingly** – limit emerald/iris glows to primary CTAs, focus states, and key metrics so the interface stays calm but feels futuristic.
- **Comfortable motion** – default to 200–250 ms easing, use micro-parallax or glow pulses only when they communicate state changes, and respect `prefers-reduced-motion`.
- **Emerald atmosphere** – anchor surfaces in deep greens with soft diffusion glows (think Spotify x Supabase) so the experience feels grounded yet alive.

---

## Layout and structure

### Layout

A layout component provides the main structure for pages, including navigation, header, and content area.

**Usage:**

```tsx
import Layout from '@/components/layout';

export default function Page() {
  return (
    <Layout>
      <div>Your content here</div>
    </Layout>
  );
}
```

**Features:**

- Responsive navigation with glassmorphism design and blurred translucency between 8–12px
- Floating neon gradient mesh behind hero sections for depth
- Consistent header with logo lockup, utility links, and CTA grouping
- Main content area capped at `max-w-6xl` with 24–48px gutters depending on breakpoint
- Optional footer slot with subdued contrast for legal/navigation links
- Navigation trays and primary action buttons share an Apple-like rounded geometry (`rounded-full`) with generous internal padding

**Responsive rhythm:**

- Collapse navigation into a command-menu style sheet below `md`
- Maintain 64px top padding on desktop, 32px on mobile to preserve breathing room
- Promote primary CTA into sticky bottom bar on mobile when a page has long-form content
- Keep nav controls pill-shaped even when collapsed to retain visual continuity

**Props:**

| Prop       | Type              | Default | Description                         |
| ---------- | ----------------- | ------- | ----------------------------------- |
| `children` | `React.ReactNode` | -       | Content to render inside the layout |

**Design tokens:**

- Background: `bg-gradient-to-b from-[#010e0a] via-[#020d12] to-[#010306]`
- Secondary background: `bg-gradient-to-br from-emerald-900 via-slate-950 to-[#041b15]` with `after:` pseudo-element glow (`blur-3xl opacity-40`)
- Text: `text-slate-100` (light gray)
- Accent: `emerald-400` (neon green)
- Border: `border-white/5` (semi-transparent white)
- Glow: `shadow-[0_0_30px_rgba(16,185,129,0.25)]` applied to CTA containers

**Accessibility:**

- Semantic HTML structure with `<header>` and `<main>` elements
- Keyboard navigation support for navigation links
- ARIA labels for interactive elements

---

## Forms and input

### TextArea

A text area lets users enter long form text which spans over multiple lines.

**Usage:**

```tsx
import { Textarea } from '@/components/ui/TextArea';

function Form() {
  return (
    <Textarea
      placeholder="Enter your message..."
      rows={4}
      className="custom-class"
    />
  );
}
```

**Props:**

Extends `React.TextareaHTMLAttributes<HTMLTextAreaElement>`

| Prop                        | Type     | Default | Description                             |
| --------------------------- | -------- | ------- | --------------------------------------- |
| `className`                 | `string` | -       | Additional CSS classes                  |
| All standard textarea props | -        | -       | Supports all native textarea attributes |

**Design tokens:**

- Background: `bg-white/90 dark:bg-white/5` overlaid on cards for readability
- Border: `border border-slate-300` (light mode), `border-slate-700/70` (dark mode)
- Focus ring: `focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2`
- Placeholder: `placeholder:text-slate-400`
- Disabled: `opacity-50 cursor-not-allowed`
- Error: `ring-rose-400/60 text-rose-50 bg-rose-950/40`
- Shape: `rounded-2xl` with `backdrop-blur-sm` and soft shadow

**Accessibility:**

- Proper focus management with visible focus rings
- Disabled state handling
- Supports `aria-label` and other ARIA attributes

---

## Loading

### LoadingDots

A loading indicator that displays animated dots to show that content is being loaded.

**Usage:**

```tsx
import LoadingDots from '@/components/ui/LoadingDots';

function LoadingState() {
  return <LoadingDots color="#33F699" style="small" />;
}
```

**Props:**

| Prop    | Type                 | Default     | Description                           |
| ------- | -------------------- | ----------- | ------------------------------------- |
| `color` | `string`             | `'#33F699'` | Color of the loading dots             |
| `style` | `'small' \| 'large'` | `'small'`   | Size variant of the loading indicator |

**Variants:**

- **Small**: Compact loading dots for inline use
- **Large**: Larger loading dots for full-page loading states

**Design tokens:**

- Animation: CSS keyframe-based dot animation with 280 ms stagger
- Color: Customizable via `color` prop, default matches accent token
- Size: Controlled via `style` prop; large style scales dot spacing to 1rem
- Motion safety: reduce translation distance to 25% when `prefers-reduced-motion`

**Accessibility:**

- Uses `aria-busy` attribute (should be added by parent)
- Non-intrusive animation that respects `prefers-reduced-motion`

---

## Messaging

### Onboarding (Spotlight)

An onboarding component that guides users through key features using spotlight-style tooltips.

**Usage:**

```tsx
import Onboarding from '@/components/Onboarding';

function Dashboard() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <>
      {showOnboarding && (
        <Onboarding
          onComplete={() => {
            setShowOnboarding(false);
          }}
        />
      )}
      {/* Your dashboard content */}
    </>
  );
}
```

**Props:**

| Prop         | Type         | Default | Description                                                      |
| ------------ | ------------ | ------- | ---------------------------------------------------------------- |
| `onComplete` | `() => void` | -       | Callback function called when onboarding is completed or skipped |

**Features:**

- Multi-step guided tour
- Automatic positioning relative to target elements
- Progress indicators
- Skip functionality
- Local storage persistence (per user)

**Onboarding Steps:**

The component uses predefined steps defined in `ONBOARDING_STEPS`:

```typescript
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // Element ID or selector
  position?: 'top' | 'bottom' | 'left' | 'right';
}
```

**Positioning:**

- Automatically calculates position based on target element
- Supports four positions: `top`, `bottom`, `left`, `right`
- Updates position on scroll and resize events

**Design tokens:**

- Overlay: `bg-black/60 backdrop-blur-[2px]` with fade-in transition
- Tooltip background: `bg-slate-900/90 dark:bg-slate-950/95`
- Shadow: `shadow-[0_30px_80px_rgba(2,6,23,0.65)]`
- Accent color: `gradient from-emerald-400 to-cyan-300` applied to progress dots
- Border radius: `rounded-2xl` to mirror cards elsewhere

**Accessibility:**

- Keyboard navigation support (should be enhanced)
- Focus trap within tooltip
- ARIA labels for skip and navigation buttons
- Screen reader announcements for step changes

**Best practices:**

1. Only show onboarding once per user (handled via localStorage)
2. Allow users to skip at any time
3. Keep descriptions concise and actionable
4. Ensure target elements exist before showing steps

---

## Component patterns

### Glassmorphism

Many components use a glassmorphism design pattern with semi-transparent backgrounds and blur effects.

**Example:**

```tsx
<div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(2,6,23,0.6)]">
  {/* Content */}
</div>
```

**Do:** pair blur with internal padding (`p-6`+) and subtle inner strokes (`ring-1 ring-white/5`).

**Don't:** set opacity below 3%—it will muddy the typography.

### Neon accents

The design system uses neon green (`emerald-400`) as the primary accent color for interactive elements.

**Example:**

```tsx
<button className="bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 text-slate-900 font-semibold shadow-[0_25px_45px_rgba(16,185,129,0.35)]">
  Action
</button>
```

Pair accents with `text-shadow` (`shadow-emerald-200/30`) or thin glow borders for hover states.

### Navigation & actions

- Primary nav items live in rounded trays (`rounded-full px-5 py-2`) with layered strokes (`border border-white/10` + `ring-emerald-500/20`).
- Secondary actions adopt the same Apple-like curvature to maintain rhythm between navigation and CTAs.
- Background glow layers (`before:absolute blur-[120px] bg-emerald-500/20`) can sit behind nav to echo Spotify/Supabase inspired ambiance.

### Responsive design

All components are built with mobile-first responsive design using Tailwind CSS breakpoints.

**Breakpoints:**

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

Add content-specific tweaks:

- Trigger stacked layouts for cards at `md` and below
- Cap large headlines to 2 lines using `line-clamp-2`
- Promote sticky CTAs on mobile detail pages for better conversion

---

## Design tokens

### Colors

**Light mode:**

- Base: `#F6F8FB`
- Text Primary: `#0B1220`
- Text Secondary: `#4B5563`
- Accent: `#8B7CFF`
- Accent Secondary: `#EDEBFF`
- Glass: `rgba(255, 255, 255, 0.78)`
- Warning: `#FBA834`
- Success: `#34D399`

**Dark mode:**

- Base: `#021109` (deep spruce)
- Text Primary: `#F9FAFB` (slate-100)
- Text Secondary: `#94A3B8` (slate-400)
- Accent: `#33F699` (vibrant emerald)
- Glass: `rgba(255, 255, 255, 0.05)`
- Surfaces: `rgba(12, 19, 33, 0.72)` for cards, `rgba(2, 6, 23, 0.9)` for modals
- Glow wash: `rgba(23, 196, 116, 0.22)` layered via pseudo-elements for soft gradients reminiscent of Spotify/Supabase

### Typography

- Headings: `24-40px / font-semibold (600)` with tighter letter-spacing (`tracking-tight`)
- Body: `14-16px / font-normal (400)` with `leading-7`
- Microcopy: `12px / font-medium (500)` uppercase for pills and badges
- Numerals: use `tabular-nums` for metrics and pricing to avoid layout shifts

### Spacing

Uses Tailwind's default spacing scale (4px base unit).

### Motion

- Default transition: `transition duration-200 ease-out`
- Hover effects: `hover:-translate-y-0.5 hover:shadow-xl`
- Animation duration: `120-300ms` for micro states, 400ms for onboarding modals
- Use spring-based motion for spotlight transitions to feel guided, not jarring

---

## Accessibility guidelines

### Focus management

- All interactive elements should have visible focus indicators
- Use `focus:ring-2` with appropriate colors
- Ensure focus order follows logical reading flow

### Keyboard navigation

- All interactive elements should be keyboard accessible
- Use semantic HTML elements (`<button>`, `<a>`, etc.)
- Provide keyboard shortcuts where appropriate

### Screen readers

- Use semantic HTML elements
- Provide ARIA labels where needed
- Ensure proper heading hierarchy
- Use `aria-live` regions for dynamic content

### Color contrast

- Ensure WCAG AA compliance (4.5:1 for normal text, 3:1 for large text)
- Don't rely solely on color to convey information
- Provide alternative indicators (icons, text)

---

## Component development guidelines

### Creating new components

1. **Use TypeScript**: All components should be typed
2. **Follow naming conventions**: Use PascalCase for component names
3. **Support className**: Allow custom styling via `className` prop
4. **Make it accessible**: Include proper ARIA attributes
5. **Document props**: Use TypeScript interfaces and JSDoc comments
6. **Test responsive**: Ensure components work on all screen sizes

### Example component structure

```tsx
import * as React from 'react';
import { cn } from '@/utils/cn';

export interface MyComponentProps {
  /** Description of the prop */
  title: string;
  /** Optional description */
  className?: string;
  children?: React.ReactNode;
}

export const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ title, className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('base-styles', className)} {...props}>
        <h2>{title}</h2>
        {children}
      </div>
    );
  },
);

MyComponent.displayName = 'MyComponent';
```

### Utility functions

**`cn` utility:**

Used for merging class names with conditional classes:

```tsx
import { cn } from '@/utils/cn';

<div className={cn('base-class', isActive && 'active-class', className)} />;
```

---

## Related documentation

- [UI Design v3](./UI_V3_DESIGN.md) - Design system overview and visual guidelines
- [Architecture v3](./architecture_v3.md) - System architecture and API documentation

---

## Component status

| Component   | Status    | Version | Notes            |
| ----------- | --------- | ------- | ---------------- |
| Layout      | ✅ Stable | 1.0.0   | Production ready |
| TextArea    | ✅ Stable | 1.0.0   | Production ready |
| LoadingDots | ✅ Stable | 1.0.0   | Production ready |
| Onboarding  | ✅ Stable | 1.0.0   | Production ready |

**Status legend:**

- ✅ Stable: Production ready, API stable
- 🟡 Beta: Feature complete, may have minor issues
- 🟠 Early Access: In development, API may change
- ⚠️ Deprecated: Will be removed in future version
- 🚧 Caution: Use with care, may have breaking changes

---

© 2025 SiteGPT.jp

For questions or contributions, please refer to the main project documentation.
