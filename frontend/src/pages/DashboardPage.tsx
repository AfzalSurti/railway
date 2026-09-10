import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { bookingService } from '../services/booking.service';
import { getApiErrorMessage } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import type { BookingStatus, BookingTask } from '../types/booking';
import { formatDate, formatStartsIn } from '../utils/format';

const STAT_CARDS: Array<{ key: string; label: string; statuses: BookingStatus[] }> = [
  { key: 'scheduled', label: 'Scheduled', statuses: ['SCHEDULED'] },
  { key: 'queued', label: 'Queued', statuses: ['QUEUED'] },
  { key: 'running', label: 'Running', statuses: ['RUNNING'] },
  { key: 'action', label: 'Action required', statuses: ['AUTHENTICATION_REQUIRED', 'PAYMENT_REQUIRED'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'failed', label: 'Failed', statuses: ['FAILED'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED'] },
];

export function DashboardPage() {
  const [bookings, setBookings] = useState<BookingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const { notify } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    bookingService
      .list()
      .then(setBookings)
      .catch((error) => notify({ variant: 'error', title: 'Failed to load dashboard', message: getApiErrorMessage(error) }))
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const counts = useMemo(
    () =>
      STAT_CARDS.map((card) => ({
        ...card,
        count: bookings.filter((booking) => card.statuses.includes(booking.status)).length,
      })),
    [bookings],
  );

  const upcoming = bookings
    .filter((booking) => booking.status === 'SCHEDULED' || booking.status === 'QUEUED' || booking.status === 'RUNNING' || booking.actionRequired)
    .slice(0, 6);

  if (loading) {
    return <Spinner label="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Operations overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Scheduling, queueing, and the mock provider are live. Real IRCTC booking is not implemented.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        {counts.map((card) => (
          <Card key={card.key} className="p-5">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{card.count}</p>
          </Card>
        ))}
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming scheduled tasks</h2>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming bookings"
            description="Schedule a train, bus, or flight task to see it here."
            actionLabel="Schedule booking"
            onAction={() => navigate('/bookings/new')}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {upcoming.map((booking) => (
              <button
                key={booking.id}
                className="text-left"
                onClick={() => navigate(`/bookings/${booking.id}`)}
              >
                <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                        {booking.serviceType}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {booking.source} → {booking.destination}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(booking.journeyDate)}
                        {booking.trainNumber ? ` · ${booking.trainNumber}` : ''}
                        {booking.provider ? ` · ${booking.provider}` : ''}
                      </p>
                      {booking.status === 'SCHEDULED' ? (
                        <p className="mt-2 text-sm font-medium text-brand-700">
                          {formatStartsIn(booking.scheduledAt, now)}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
