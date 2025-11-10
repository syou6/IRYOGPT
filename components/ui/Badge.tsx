import clsx from 'clsx';
import { HTMLAttributes } from 'react';

const baseClass = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]';

const variants = {
  primary: 'border border-premium-accent/50 text-premium-accent',
  neutral: 'border border-premium-stroke/60 text-premium-muted',
  solid: 'bg-premium-accent/15 text-premium-text',
} as const;

const hoverVariants = {
  primary: 'hover:border-premium-accent hover:text-premium-accent',
  neutral: 'hover:border-premium-accent/40 hover:text-premium-text',
  solid: 'hover:bg-premium-accent/25',
};

export type BadgeVariant = keyof typeof variants;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  interactive?: boolean;
}

const Badge = ({ variant = 'neutral', interactive = false, className, ...props }: BadgeProps) => (
  <span
    className={clsx(
      baseClass,
      variants[variant],
      interactive && hoverVariants[variant],
      'transition',
      className,
    )}
    {...props}
  />
);

export default Badge;
