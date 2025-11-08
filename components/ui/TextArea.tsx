import * as React from 'react';
import { cn } from '@/utils/cn';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[5rem] w-full rounded-2xl border border-slate-300/70 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_15px_35px_rgba(15,23,42,0.12)] transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/70 dark:bg-white/5 dark:text-slate-50 dark:focus:ring-offset-emerald-950/40 dark:placeholder:text-slate-400',
          'backdrop-blur-sm',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
