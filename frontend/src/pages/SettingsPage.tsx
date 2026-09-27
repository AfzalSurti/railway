import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { paymentMethodService } from '../services/paymentMethod.service';
import { getApiErrorMessage } from '../services/api';
import type { PaymentMethodInfo } from '../types/paymentMethod';

/**
 * Detects a card brand from its number so it can be shown to the user, e.g.
 * "Visa •••• 4242". This never leaves the browser — see handleAddCard below.
 */
function detectBrand(digits: string): string {
  if (/^4/.test(digits)) return 'Visa';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6/.test(digits)) return 'RuPay';
  return 'Card';
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [methods, setMethods] = useState<PaymentMethodInfo[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [autoPay, setAutoPay] = useState(true);

  function refresh() {
    return paymentMethodService
      .list()
      .then(setMethods)
      .catch((error) => notify({ variant: 'error', title: 'Could not load payment methods', message: getApiErrorMessage(error) }))
      .finally(() => setLoadingMethods(false));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddCard(event: FormEvent) {
    event.preventDefault();
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 12) {
      notify({ variant: 'error', title: 'Enter a valid card number' });
      return;
    }
    // Only ever computed and sent: a label, the detected brand, and the last
    // 4 digits. The full number, expiry, and any CVV are discarded right
    // here in the browser and never transmitted, logged, or stored anywhere.
    const brand = detectBrand(digits);
    const last4 = digits.slice(-4);
    setAdding(true);
    try {
      await paymentMethodService.create({
        label: label.trim() || `${brand} card`,
        brand,
        last4,
        autoPay,
      });
      setLabel('');
      setCardNumber('');
      setExpiry('');
      setAutoPay(true);
      notify({ variant: 'success', title: 'Payment method saved' });
      await refresh();
    } catch (error) {
      notify({ variant: 'error', title: 'Could not save payment method', message: getApiErrorMessage(error) });
    } finally {
      setAdding(false);
    }
  }

  async function toggleAutoPay(method: PaymentMethodInfo) {
    try {
      await paymentMethodService.setAutoPay(method.id, !method.autoPay);
      await refresh();
      notify({ variant: 'success', title: !method.autoPay ? 'Auto-pay enabled' : 'Auto-pay disabled' });
    } catch (error) {
      notify({ variant: 'error', title: 'Could not update auto-pay', message: getApiErrorMessage(error) });
    }
  }

  async function removeMethod(method: PaymentMethodInfo) {
    try {
      await paymentMethodService.remove(method.id);
      await refresh();
      notify({ variant: 'success', title: 'Payment method removed' });
    } catch (error) {
      notify({ variant: 'error', title: 'Could not remove payment method', message: getApiErrorMessage(error) });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Account details for this development workspace.</p>
      </div>
      <Card className="p-6">
        <dl className="space-y-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Name</dt>
            <dd className="mt-1 font-medium">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
            <dd className="mt-1 font-medium">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Phone</dt>
            <dd className="mt-1 font-medium">{user?.phone}</dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <Button
            variant="secondary"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sign out
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">Payment methods</h2>
        <p className="mt-1 text-sm text-slate-500">
          Provider-hosted payment. We only ever keep the card brand and last 4 digits for your reference — the full
          number, expiry, and CVV never leave your browser and are never sent to or stored by this app.
        </p>

        {loadingMethods ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : methods.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No payment methods saved yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {methods.map((method) => (
              <li
                key={method.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {method.brand} •••• {method.last4}
                    {method.autoPay ? (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
                        Auto-pay
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-slate-500">{method.label}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => toggleAutoPay(method)}>
                    {method.autoPay ? 'Disable auto-pay' : 'Use for auto-pay'}
                  </Button>
                  <Button variant="danger" onClick={() => removeMethod(method)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form className="mt-5 space-y-4 border-t border-slate-100 pt-5" onSubmit={handleAddCard}>
          <p className="text-sm font-medium text-slate-700">Add a payment method</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Card number"
              placeholder="4242 4242 4242 4242"
              inputMode="numeric"
              autoComplete="cc-number"
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
            />
            <Input
              label="Expiry (not stored)"
              placeholder="MM/YY"
              autoComplete="cc-exp"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
            />
            <Input
              label="Nickname"
              placeholder="e.g. HDFC Credit Card"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={autoPay}
              onChange={(event) => setAutoPay(event.target.checked)}
            />
            Automatically authorize payment with this method when a booking asks for it
          </label>
          <div className="flex justify-end">
            <Button type="submit" loading={adding}>
              Save payment method
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
