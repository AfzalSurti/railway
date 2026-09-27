import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Spinner } from '../components/Spinner';
import { passengerService } from '../services/passenger.service';
import { bookingService } from '../services/booking.service';
import { providerService } from '../services/provider.service';
import { getApiErrorMessage } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import type { Gender, Passenger } from '../types/passenger';
import type { ServiceType } from '../types/booking';
import type { ProviderInfo } from '../types/provider';

const schema = z.object({
  serviceType: z.enum(['TRAIN', 'BUS', 'FLIGHT']),
  provider: z.string().min(1, 'Provider is required'),
  source: z.string().min(1, 'Source is required'),
  destination: z.string().min(1, 'Destination is required'),
  journeyDate: z.string().min(1, 'Journey date is required'),
  // Required only when "Schedule for later" is selected (checked at submit time) —
  // "Book now" fills this in automatically.
  scheduledAt: z.string().optional(),
  trainNumber: z.string().optional(),
  travelClass: z.string().optional(),
  quota: z.string().optional(),
  passengerIds: z.array(z.string()).min(1, 'Select at least one passenger'),
});

type FormValues = z.infer<typeof schema>;

export function NewBookingPage() {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookNow, setBookNow] = useState(true);
  const [showAddPassenger, setShowAddPassenger] = useState(false);
  const [addingPassenger, setAddingPassenger] = useState(false);
  const [newPassenger, setNewPassenger] = useState({ name: '', age: '', gender: 'MALE' as Gender, phone: '' });
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { notify } = useToast();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // The travel assistant links here with the chosen option pre-filled.
    defaultValues: {
      serviceType: (['TRAIN', 'BUS', 'FLIGHT'].includes(params.get('serviceType') ?? '')
        ? params.get('serviceType')
        : 'TRAIN') as ServiceType,
      provider: params.get('provider') ?? 'MOCK',
      source: params.get('source') ?? '',
      destination: params.get('destination') ?? '',
      journeyDate: params.get('journeyDate') ?? '',
      trainNumber: params.get('trainNumber') ?? '',
      travelClass: params.get('travelClass') ?? '',
      passengerIds: [],
    },
  });

  const selectedPassengers = watch('passengerIds');
  const serviceType = watch('serviceType');
  const selectedProvider = watch('provider');

  useEffect(() => {
    Promise.all([passengerService.list(), providerService.list()])
      .then(([nextPassengers, nextProviders]) => {
        setPassengers(nextPassengers);
        setProviders(nextProviders);
      })
      .catch((error) => notify({ variant: 'error', title: 'Failed to load form data', message: getApiErrorMessage(error) }))
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => {
    const matches = providers.filter((item) => item.serviceType === serviceType);
    if (matches.length > 0 && !matches.some((item) => item.name === selectedProvider)) {
      setValue('provider', matches[0].name);
    }
  }, [providers, selectedProvider, serviceType, setValue]);

  async function handleAddPassenger() {
    const age = Number(newPassenger.age);
    if (!newPassenger.name.trim() || !age || age < 1 || age > 120 || newPassenger.phone.trim().length < 8) {
      notify({ variant: 'error', title: 'Fill in a valid name, age (1-120), and phone number' });
      return;
    }
    setAddingPassenger(true);
    try {
      const created = await passengerService.create({
        name: newPassenger.name.trim(),
        age,
        gender: newPassenger.gender,
        phone: newPassenger.phone.trim(),
      });
      setPassengers((prev) => [...prev, created]);
      setValue('passengerIds', [...selectedPassengers, created.id], { shouldValidate: true });
      setNewPassenger({ name: '', age: '', gender: 'MALE', phone: '' });
      setShowAddPassenger(false);
      notify({ variant: 'success', title: `${created.name} added` });
    } catch (error) {
      notify({ variant: 'error', title: 'Could not add passenger', message: getApiErrorMessage(error) });
    } finally {
      setAddingPassenger(false);
    }
  }

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/bookings'))}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <span aria-hidden="true">←</span> Back
      </button>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Schedule a booking</h1>
        <p className="mt-1 text-sm text-slate-500">
          This creates a booking task only. No ticket will be purchased.
        </p>
      </div>
      <Card className="p-6">
        <form
          className="space-y-5"
          onSubmit={handleSubmit(async (values) => {
            if (!bookNow && !values.scheduledAt) {
              notify({ variant: 'error', title: 'Pick a scheduled time', message: 'Or switch to "Book now".' });
              return;
            }
            try {
              const created = await bookingService.create({
                ...values,
                serviceType: values.serviceType as ServiceType,
                source: values.source.toUpperCase(),
                destination: values.destination.toUpperCase(),
                // "Book now" schedules a few seconds out so it is picked up
                // immediately instead of sitting as an unqueued draft.
                scheduledAt: bookNow
                  ? new Date(Date.now() + 5000).toISOString()
                  : new Date(values.scheduledAt as string).toISOString(),
              });
              notify({
                variant: 'success',
                title: bookNow ? 'Booking is running now' : 'Booking task scheduled',
              });
              navigate(`/bookings/${created.id}`);
            } catch (error) {
              notify({ variant: 'error', title: 'Could not schedule booking', message: getApiErrorMessage(error) });
            }
          })}
        >
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">When</p>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setBookNow(true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  bookNow ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Book now
              </button>
              <button
                type="button"
                onClick={() => setBookNow(false)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  !bookNow ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Schedule for later
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {bookNow
                ? 'Execution starts right away — no ticket is actually purchased in this phase.'
                : 'Pick a future date and time; the worker will pick it up automatically then.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Service" error={errors.serviceType?.message} {...register('serviceType')}>
              <option value="TRAIN">TRAIN</option>
              <option value="BUS">BUS</option>
              <option value="FLIGHT">FLIGHT</option>
            </Select>
            <Select label="Provider" error={errors.provider?.message} {...register('provider')}>
              {(providers.length > 0
                ? providers.filter((item) => item.serviceType === serviceType)
                : [
                    { name: 'MOCK', serviceType: 'TRAIN', available: true, health: 'AVAILABLE', description: '', capabilities: [] },
                    { name: 'IRCTC', serviceType: 'TRAIN', available: false, health: 'NOT_IMPLEMENTED', description: '', capabilities: [] },
                  ]
              ).map((item) => (
                <option key={`${item.serviceType}-${item.name}`} value={item.name}>
                  {item.name}
                  {item.available ? '' : ' (coming soon)'}
                </option>
              ))}
            </Select>
            <Input label="Source" placeholder="BRC" error={errors.source?.message} {...register('source')} />
            <Input
              label="Destination"
              placeholder="MMCT"
              error={errors.destination?.message}
              {...register('destination')}
            />
            <Input label="Journey Date" type="date" error={errors.journeyDate?.message} {...register('journeyDate')} />
            {bookNow ? null : (
              <Input
                label="Scheduled Time"
                type="datetime-local"
                error={errors.scheduledAt?.message}
                {...register('scheduledAt')}
              />
            )}
            {serviceType === 'TRAIN' && selectedProvider === 'IRCTC' ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:col-span-2">
                IRCTC integration is coming soon. This only creates a booking task. Real ticket booking, login, OTP,
                CAPTCHA, and payment are not implemented.
              </p>
            ) : null}
            <Input
              label={serviceType === 'TRAIN' ? 'Train Number' : serviceType === 'BUS' ? 'Bus Number' : 'Flight Number'}
              placeholder={serviceType === 'TRAIN' ? '20902' : serviceType === 'BUS' ? 'BUS-1234' : '6E-234'}
              {...register('trainNumber')}
            />
            <Input label="Class" placeholder={serviceType === 'TRAIN' ? '3A' : 'Economy'} {...register('travelClass')} />
            {serviceType === 'TRAIN' ? <Input label="Quota" placeholder="GENERAL" {...register('quota')} /> : null}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Passengers</p>
            {passengers.length === 0 ? (
              <p className="text-sm text-slate-500">No passengers yet — add one below.</p>
            ) : (
              <div className="space-y-2">
                {passengers.map((passenger) => {
                  const checked = selectedPassengers.includes(passenger.id);
                  return (
                    <label
                      key={passenger.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <span>
                        <span className="block font-medium text-slate-900">{passenger.name}</span>
                        <span className="text-sm text-slate-500">
                          {passenger.age} yrs · {passenger.gender}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...selectedPassengers, passenger.id]
                            : selectedPassengers.filter((id) => id !== passenger.id);
                          setValue('passengerIds', next, { shouldValidate: true });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            )}
            {errors.passengerIds ? (
              <p className="mt-2 text-xs text-rose-600">{errors.passengerIds.message}</p>
            ) : null}

            {showAddPassenger ? (
              <div className="mt-3 space-y-3 rounded-xl border border-dashed border-slate-300 p-4">
                <p className="text-sm font-medium text-slate-700">Add a new passenger</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Name"
                    value={newPassenger.name}
                    onChange={(event) => setNewPassenger((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <Input
                    label="Age"
                    type="number"
                    min={1}
                    max={120}
                    value={newPassenger.age}
                    onChange={(event) => setNewPassenger((prev) => ({ ...prev, age: event.target.value }))}
                  />
                  <Select
                    label="Gender"
                    value={newPassenger.gender}
                    onChange={(event) =>
                      setNewPassenger((prev) => ({ ...prev, gender: event.target.value as Gender }))
                    }
                  >
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                    <option value="OTHER">OTHER</option>
                  </Select>
                  <Input
                    label="Phone"
                    value={newPassenger.phone}
                    onChange={(event) => setNewPassenger((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setShowAddPassenger(false)}>
                    Cancel
                  </Button>
                  <Button type="button" loading={addingPassenger} onClick={handleAddPassenger}>
                    Add passenger
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="secondary" className="mt-3" onClick={() => setShowAddPassenger(true)}>
                + Add new passenger
              </Button>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting}>
              {bookNow ? 'Book Now' : 'Schedule Booking'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
