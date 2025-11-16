import clsx from 'clsx';
import { ButtonHTMLAttributes, forwardRef } from 'react';

const BASE_CLASS =
  'inline-flex items-center justify-center rounded-full font-semibold leading-tight whitespace-nowrap tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium-accent/40 disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS = {
  primary:
    'bg-gradient-to-r from-premium-accent via-premium-accentGlow to-premium-accent text-premium-base shadow-glow hover:shadow-premium',
  secondary:
    'border border-premium-stroke/60 bg-premium-surface/80 text-premium-text hover:border-premium-accent/70',
  ghost: 'text-premium-text hover:text-premium-accent',
} as const;

const SIZES = {
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3 text-base',
  full: 'w-full px-4 py-2.5 text-base',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(BASE_CLASS, VARIANTS[variant], SIZES[size], className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export default Button;
