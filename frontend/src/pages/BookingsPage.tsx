import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { bookingService } from '../services/booking.service';
import { getApiErrorMessage } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import type { BookingTask } from '../types/booking';
import { formatDate, formatDateTime, formatStartsIn } from '../utils/format';

export function BookingsPage() {
  const [bookings, setBookings] = useState<BookingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();
  const { notify } = useToast();

  useEffect(() => {
    bookingService
      .list()
      .then(setBookings)
      .catch((error) => notify({ variant: 'error', title: 'Failed to load bookings', message: getApiErrorMessage(error) }))
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    bookingService
      .list()
      .then(setBookings)
      .catch((error) => notify({ variant: 'error', title: 'Failed to load bookings', message: getApiErrorMessage(error) }))
      .finally(() => setLoading(false));
  }, [notify]);

  if (loading) {
    return <Spinner label="Loading bookings..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Booking tasks</h1>
          <p className="mt-1 text-sm text-slate-500">Scheduled work items only. No live tickets are purchased yet.</p>
        </div>
        <Button onClick={() => navigate('/bookings/new')}>Schedule booking</Button>
      </div>
      {bookings.length === 0 ? (
        <EmptyState
          title="No booking tasks"
          description="Create a scheduled booking task for a future journey."
          actionLabel="Schedule booking"
          onAction={() => navigate('/bookings/new')}
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <button key={booking.id} className="block w-full text-left" onClick={() => navigate(`/bookings/${booking.id}`)}>
              <Card className="p-5 transition hover:border-brand-200">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                      {booking.serviceType} · {booking.provider}
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      {booking.source} → {booking.destination}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Journey {formatDate(booking.journeyDate)} · Scheduled {formatDateTime(booking.scheduledAt)}
                      {booking.trainNumber ? ` · ${booking.trainNumber}` : ''}
                    </p>
                    {booking.status === 'SCHEDULED' ? (
                      <p className="mt-1 text-sm font-medium text-brand-700">
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
  );
}
