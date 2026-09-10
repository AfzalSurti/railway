import { forwardRef, type InputHTMLAttributes } from 'react';
import { classNames } from '../utils/format';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        id={inputId}
        ref={ref}
        className={classNames(
          'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4',
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
            : 'border-slate-200 focus:border-brand-500 focus:ring-brand-50',
          className,
        )}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
});
