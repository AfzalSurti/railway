import type { ReactNode } from 'react';
import { classNames } from '../utils/format';

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames('rounded-2xl border border-slate-200 bg-white shadow-card', className)}>
      {children}
    </div>
  );
}
