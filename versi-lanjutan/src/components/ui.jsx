import { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-hover',
        secondary: 'border border-slate-200 bg-white text-ink hover:bg-slate-50',
        ghost: 'text-ink-muted hover:bg-primary-tint hover:text-primary',
        danger: 'bg-danger text-white hover:bg-danger-dark',
        outlineDanger: 'border border-danger text-danger hover:bg-danger-tint',
        info: 'bg-info text-white hover:brightness-95',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export const Button = forwardRef(function Button({ className, variant, size, ...props }, ref) {
  return <button ref={ref} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
});

export function Card({ className, ...props }) {
  return <section className={cn('rounded-card border border-slate-200 bg-white shadow-card', className)} {...props} />;
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4', className)}>
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const badgeStyles = cva('inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium', {
  variants: {
    tone: {
      neutral: 'bg-slate-100 text-ink-muted',
      success: 'bg-emerald-50 text-emerald-700',
      warning: 'bg-amber-50 text-amber-700',
      danger: 'bg-danger-tint text-danger-dark',
      info: 'bg-primary-tint text-primary-hover',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ tone, className, ...props }) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink placeholder:text-ink-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-tint',
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-tint',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-tint',
        className,
      )}
      {...props}
    />
  );
});

export function Field({ label, error, hint, children, className }) {
  return (
    <label className={cn('grid gap-1.5', className)}>
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="text-sm text-danger-dark">{error}</span> : null}
      {!error && hint ? <span className="text-sm text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function Dialog({ open, onClose, title, description, children, footer, className }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('relative z-10 w-full max-w-lg rounded-card bg-white shadow-dialog', className)}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-slate-100" aria-label="Tutup">
            <X size={18} />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer ? <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-14 text-center">
      <span className="text-3xl" aria-hidden="true">{icon || '📦'}</span>
      <strong className="text-base text-ink">{title}</strong>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function Toast({ message, tone = 'success', onClose }) {
  if (!message) return null;
  return createPortal(
    <div
      role="status"
      className={cn(
        'fixed bottom-6 right-6 z-[60] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-card',
        tone === 'error' ? 'border-danger/40 bg-danger-tint text-danger-dark' : 'border-emerald-200 bg-emerald-50 text-emerald-800',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex-1">{message}</span>
        <button type="button" onClick={onClose} aria-label="Tutup notifikasi" className="text-current opacity-60 hover:opacity-100">
          <X size={16} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
