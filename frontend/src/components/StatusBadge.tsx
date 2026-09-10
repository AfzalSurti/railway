import type { BookingStatus } from '../types/booking';
import { classNames } from '../utils/format';

const styles: Record<BookingStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SCHEDULED: 'bg-sky-50 text-sky-700 ring-sky-100',
  QUEUED: 'bg-indigo-50 text-indigo-700',
  RUNNING: 'bg-amber-50 text-amber-700',
  AUTHENTICATION_REQUIRED: 'bg-orange-50 text-orange-700',
  PAYMENT_REQUIRED: 'bg-violet-50 text-violet-700',
  UNKNOWN_RESULT: 'bg-rose-100 text-rose-800 ring-rose-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        styles[status],
      )}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}
