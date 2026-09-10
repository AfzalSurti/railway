import { forwardRef, type SelectHTMLAttributes } from 'react';
import { classNames } from '../utils/format';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, children, ...props },
  ref,
) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <select
        ref={ref}
        className={classNames(
          'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-4',
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
            : 'border-slate-200 focus:border-brand-500 focus:ring-brand-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
});
