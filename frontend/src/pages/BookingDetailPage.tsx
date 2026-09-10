import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { bookingService } from '../services/booking.service';
import { getApiErrorMessage } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import type {
  BookingTask,
  ExecutionLog,
  HumanAction,
  PaymentTransaction,
  TicketArtifact,
} from '../types/booking';
import { formatDate, formatDateTime, formatStartsIn, toDatetimeLocalValue } from '../utils/format';

const ACTIVE_STATUSES = new Set([
  'QUEUED',
  'RUNNING',
  'AUTHENTICATION_REQUIRED',
  'PAYMENT_REQUIRED',
  'UNKNOWN_RESULT',
]);

const PIPELINE_STAGES = [
  { step: 'OPENING_PROVIDER', label: 'Provider opened' },
  { step: 'SEARCHING', label: 'Journey searched' },
  { step: 'VERIFYING_JOURNEY', label: 'Journey verified' },
  { step: 'CHECKING_AVAILABILITY', label: 'Availability checked' },
  { step: 'ENTERING_PASSENGER_DETAILS', label: 'Passenger details' },
  { step: 'PAYMENT_REQUIRED', label: 'Payment' },
  { step: 'CONFIRMING_BOOKING', label: 'Confirmation' },
  { step: 'BOOKING_CONFIRMED', label: 'Booking confirmed' },
] as const;

export function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [booking, setBooking] = useState<BookingTask | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [actions, setActions] = useState<HumanAction[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [tickets, setTickets] = useState<TicketArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [mockOutcome, setMockOutcome] = useState('SUCCESS');
  const [now, setNow] = useState(Date.now());

  async function refresh(bookingId: string) {
    const [task, executionLogs, humanActions, paymentRows, ticketRows] = await Promise.all([
      bookingService.getById(bookingId),
      bookingService.logs(bookingId),
      bookingService.actions(bookingId).catch(() => [] as HumanAction[]),
      bookingService.payments(bookingId).catch(() => [] as PaymentTransaction[]),
      bookingService.tickets(bookingId).catch(() => [] as TicketArtifact[]),
    ]);
    setBooking(task);
    setLogs(executionLogs);
    setActions(humanActions);
    setPayments(paymentRows);
    setTickets(ticketRows);
  }

  useEffect(() => {
    if (!id) return;
    refresh(id)
      .catch((error) => {
        notify({ variant: 'error', title: 'Booking not found', message: getApiErrorMessage(error) });
        navigate('/bookings');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, notify]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const bookingStatus = booking?.status;

  useEffect(() => {
    if (!id || !bookingStatus || !ACTIVE_STATUSES.has(bookingStatus)) {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh(id).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [id, bookingStatus]);

  if (loading || !booking) {
    return <Spinner label="Loading booking..." />;
  }

  const canCancel =
    booking.status === 'SCHEDULED' ||
    booking.status === 'QUEUED' ||
    booking.status === 'AUTHENTICATION_REQUIRED' ||
    booking.status === 'PAYMENT_REQUIRED' ||
    booking.status === 'UNKNOWN_RESULT';
  const showCancelRequested = booking.status === 'RUNNING';
  const canReschedule = booking.status === 'SCHEDULED';
  const canRunNow = import.meta.env.DEV && booking.status === 'SCHEDULED';
  const canResume =
    booking.status === 'AUTHENTICATION_REQUIRED' ||
    booking.status === 'PAYMENT_REQUIRED' ||
    booking.status === 'UNKNOWN_RESULT';

  const fields = [
    ['Booking ID', booking.id],
    ['Service', booking.serviceType],
    ['Provider', booking.provider],
    ['Current stage', booking.currentStage ? booking.currentStage.replaceAll('_', ' ') : '—'],
    ['Provider status', booking.providerStatus ?? '—'],
    ['Source', booking.source],
    ['Destination', booking.destination],
    ['Journey date', formatDate(booking.journeyDate)],
    ['Scheduled time', formatDateTime(booking.scheduledAt)],
    ['Train number', booking.trainNumber ?? '—'],
    ['Class', booking.travelClass ?? '—'],
    ['Quota', booking.quota ?? '—'],
    ['Started', booking.startedAt ? formatDateTime(booking.startedAt) : '—'],
    ['Completed', booking.completedAt ? formatDateTime(booking.completedAt) : '—'],
    ['Retries', String(booking.retryCount)],
    ['Reference', booking.bookingReference ?? '—'],
    ['Artifact ID', booking.artifactId ?? '—'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{booking.serviceType}</p>
          <h1 className="text-2xl font-bold text-slate-900">
            {booking.source} → {booking.destination}
          </h1>
          {booking.status === 'SCHEDULED' ? (
            <p className="mt-1 text-sm font-medium text-brand-700">{formatStartsIn(booking.scheduledAt, now)}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={booking.status} />
          {canResume ? (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const updated = await bookingService.resume(booking.id);
                  setBooking(updated);
                  setLogs(await bookingService.logs(booking.id));
                  notify({ variant: 'success', title: 'Booking resumed' });
                } catch (error) {
                  notify({ variant: 'error', title: 'Resume failed', message: getApiErrorMessage(error) });
                }
              }}
            >
              Resume after action
            </Button>
          ) : null}
          {canRunNow ? (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const updated = await bookingService.runNow(booking.id, mockOutcome);
                  setBooking(updated);
                  setLogs(await bookingService.logs(booking.id));
                  notify({ variant: 'success', title: 'Queued for mock execution' });
                } catch (error) {
                  notify({ variant: 'error', title: 'Run failed', message: getApiErrorMessage(error) });
                }
              }}
            >
              Run now
            </Button>
          ) : null}
          {canReschedule ? (
            <Button
              variant="secondary"
              onClick={() => {
                setScheduledAtLocal(toDatetimeLocalValue(booking.scheduledAt));
                setRescheduleOpen(true);
              }}
            >
              Reschedule
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="danger" onClick={() => setConfirmCancel(true)}>
              Cancel booking
            </Button>
          ) : null}
          {showCancelRequested ? (
            booking.cancellationRequested ? (
              <span className="text-sm font-medium text-amber-700">Cancellation requested</span>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                Request cancellation
              </Button>
            )
          ) : null}
        </div>
      </div>

      {booking.actionRequired ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Action required</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{booking.actionRequiredType.replaceAll('_', ' ')}</p>
          <p className="mt-1 text-sm text-slate-600">
            {booking.actionRequiredMessage ?? 'A human action is required before execution can continue.'}
          </p>
        </Card>
      ) : null}

      {booking.failureCode ? (
        <Card className="border-rose-200 p-5">
          <p className="text-sm font-semibold text-rose-700">{booking.failureCode}</p>
          <p className="mt-1 text-sm text-slate-600">{booking.failureReason}</p>
        </Card>
      ) : null}

      {actions.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Human action requests</h2>
          <p className="mt-1 text-sm text-slate-500">
            Complete the required step with the provider, then mark it done. No OTP, password, or
            card detail is ever entered or stored here.
          </p>
          <ul className="mt-4 space-y-3">
            {actions.map((action) => (
              <li
                key={action.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {action.type.replaceAll('_', ' ')}
                    <span className="ml-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {action.status}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{action.message}</p>
                </div>
                {action.status === 'PENDING' ? (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await bookingService.resolveAction(booking.id, action.id);
                        await refresh(booking.id);
                        notify({ variant: 'success', title: 'Marked complete' });
                      } catch (error) {
                        notify({
                          variant: 'error',
                          title: 'Could not resolve',
                          message: getApiErrorMessage(error),
                        });
                      }
                    }}
                  >
                    Mark complete
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {payments.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Payment</h2>
          <p className="mt-1 text-sm text-slate-500">
            Provider-hosted payment. No card number, CVV, UPI PIN, or OTP is entered or stored here.
          </p>
          <ul className="mt-4 space-y-3">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {(payment.amount / 100).toLocaleString(undefined, {
                      style: 'currency',
                      currency: payment.currency,
                    })}
                    <span className="ml-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {payment.status}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {payment.provider}
                    {payment.failureReason ? ` · ${payment.failureReason}` : ''}
                  </p>
                </div>
                {(payment.status === 'PROCESSING' || payment.status === 'REQUIRED' || payment.status === 'FAILED') &&
                booking.status === 'PAYMENT_REQUIRED' ? (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await bookingService.authorizePayment(booking.id);
                        await refresh(booking.id);
                        notify({ variant: 'success', title: 'Payment authorization recorded' });
                      } catch (error) {
                        notify({
                          variant: 'error',
                          title: 'Authorization failed',
                          message: getApiErrorMessage(error),
                        });
                      }
                    }}
                  >
                    Authorize payment
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tickets.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Ticket</h2>
          <ul className="mt-4 space-y-3">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{ticket.fileName}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {ticket.provider} · {(ticket.sizeBytes / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await bookingService.downloadTicket(booking.id, ticket.id, ticket.fileName);
                    } catch (error) {
                      notify({
                        variant: 'error',
                        title: 'Download failed',
                        message: getApiErrorMessage(error),
                      });
                    }
                  }}
                >
                  Download
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {canRunNow ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Mock outcome</h2>
          <p className="mt-1 text-sm text-slate-500">Development only. The worker still executes the job asynchronously.</p>
          <div className="mt-3 max-w-sm">
            <Select label="Simulated result" value={mockOutcome} onChange={(event) => setMockOutcome(event.target.value)}>
              <option value="SUCCESS">SUCCESS</option>
              <option value="NO_SEATS">NO_SEATS</option>
              <option value="TRAIN_NOT_FOUND">TRAIN_NOT_FOUND</option>
              <option value="WEBSITE_TIMEOUT">WEBSITE_TIMEOUT</option>
              <option value="PAYMENT_FAILED">PAYMENT_FAILED</option>
              <option value="AUTHENTICATION_REQUIRED">AUTHENTICATION_REQUIRED</option>
              <option value="PAYMENT_REQUIRED">PAYMENT_REQUIRED</option>
              <option value="UNKNOWN_RESULT">UNKNOWN_RESULT</option>
            </Select>
          </div>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Passengers</h2>
        <div className="mt-4 space-y-3">
          {booking.passengers.map((passenger) => (
            <div key={passenger.id} className="rounded-xl border border-slate-200 px-4 py-3">
              <p className="font-medium">{passenger.name}</p>
              <p className="text-sm text-slate-500">
                {passenger.age} yrs · {passenger.gender} · {passenger.phone}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Execution</h2>
        <p className="mt-1 text-sm text-slate-500">
          Provider {booking.provider}. Browser session details are never shown. No real ticket is purchased.
        </p>
        <ol className="mt-5 space-y-2">
          {PIPELINE_STAGES.map((stage) => {
            const matched = logs.find((log) => log.step === stage.step);
            const current = booking.currentStage === stage.step;
            return (
              <li key={stage.step} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    matched
                      ? matched.status === 'ERROR'
                        ? 'bg-rose-500 text-white'
                        : 'bg-emerald-500 text-white'
                      : current
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {matched ? '✓' : current ? '●' : '○'}
                </span>
                <span className={matched || current ? 'font-medium text-slate-900' : 'text-slate-500'}>
                  {stage.label}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Execution timeline</h2>
        <p className="mt-1 text-sm text-slate-500">Provider stages are recorded here. Sensitive values are never displayed.</p>
        <div className="mt-6">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">No logs yet.</p>
          ) : (
            <ol className="relative space-y-0 border-l border-slate-200 pl-6">
              {logs.map((log, index) => (
                <li key={log.id} className="relative pb-6 last:pb-0">
                  <span
                    className={`absolute -left-[31px] mt-1 h-3.5 w-3.5 rounded-full ring-4 ring-white ${
                      log.status === 'SUCCESS'
                        ? 'bg-emerald-500'
                        : log.status === 'ERROR'
                          ? 'bg-rose-500'
                          : log.status === 'WARNING'
                            ? 'bg-amber-500'
                            : 'bg-brand-500'
                    }`}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{log.step.replaceAll('_', ' ')}</p>
                      <p className="mt-1 text-sm text-slate-600">{log.message}</p>
                    </div>
                    <p className="whitespace-nowrap text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
                  </div>
                  {index < logs.length - 1 ? <span className="sr-only">next</span> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        title={booking.status === 'RUNNING' ? 'Request cancellation?' : 'Cancel this booking task?'}
        description={
          booking.status === 'RUNNING'
            ? 'The worker will stop at the next safe step. This does not kill an in-flight mock execution immediately.'
            : 'The scheduled job will be removed. No real ticket action will be taken.'
        }
        confirmLabel={booking.status === 'RUNNING' ? 'Request cancellation' : 'Cancel task'}
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          try {
            const updated = await bookingService.cancel(booking.id);
            setBooking(updated);
            setLogs(await bookingService.logs(booking.id));
            notify({ variant: 'success', title: updated.cancellationRequested && updated.status === 'RUNNING' ? 'Cancellation requested' : 'Booking cancelled' });
            setConfirmCancel(false);
          } catch (error) {
            notify({ variant: 'error', title: 'Cancel failed', message: getApiErrorMessage(error) });
          }
        }}
      />

      {rescheduleOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold">Reschedule booking</h2>
            <form
              className="mt-4 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  const iso = new Date(scheduledAtLocal).toISOString();
                  const updated = await bookingService.reschedule(booking.id, iso);
                  setBooking(updated);
                  setLogs(await bookingService.logs(booking.id));
                  notify({ variant: 'success', title: 'Booking rescheduled' });
                  setRescheduleOpen(false);
                } catch (error) {
                  notify({ variant: 'error', title: 'Reschedule failed', message: getApiErrorMessage(error) });
                }
              }}
            >
              <Input
                label="Scheduled time"
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(event) => setScheduledAtLocal(event.target.value)}
              />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setRescheduleOpen(false)}>
                  Close
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
