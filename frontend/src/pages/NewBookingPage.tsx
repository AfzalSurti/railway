import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
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
import type { Passenger } from '../types/passenger';
import type { ServiceType } from '../types/booking';
import type { ProviderInfo } from '../types/provider';

const schema = z.object({
  serviceType: z.enum(['TRAIN', 'BUS', 'FLIGHT']),
  provider: z.string().min(1, 'Provider is required'),
  source: z.string().min(1, 'Source is required'),
  destination: z.string().min(1, 'Destination is required'),
  journeyDate: z.string().min(1, 'Journey date is required'),
  scheduledAt: z.string().min(1, 'Scheduled time is required'),
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
  const navigate = useNavigate();
  const { notify } = useToast();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceType: 'TRAIN',
      provider: 'MOCK',
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

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
            try {
              const created = await bookingService.create({
                ...values,
                serviceType: values.serviceType as ServiceType,
                source: values.source.toUpperCase(),
                destination: values.destination.toUpperCase(),
                scheduledAt: new Date(values.scheduledAt).toISOString(),
              });
              notify({ variant: 'success', title: 'Booking task scheduled' });
              navigate(`/bookings/${created.id}`);
            } catch (error) {
              notify({ variant: 'error', title: 'Could not schedule booking', message: getApiErrorMessage(error) });
            }
          })}
        >
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
                    { name: 'MOCK', serviceType: 'TRAIN', available: true, health: 'AVAILABLE', description: '' },
                    { name: 'IRCTC', serviceType: 'TRAIN', available: false, health: 'NOT_IMPLEMENTED', description: '' },
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
            <Input
              label="Scheduled Time"
              type="datetime-local"
              error={errors.scheduledAt?.message}
              {...register('scheduledAt')}
            />
            {serviceType === 'TRAIN' && selectedProvider === 'IRCTC' ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:col-span-2">
                IRCTC integration is coming soon. This only creates a booking task. Real ticket booking, login, OTP,
                CAPTCHA, and payment are not implemented.
              </p>
            ) : null}
            {serviceType === 'TRAIN' ? (
              <>
                <Input label="Train Number" placeholder="20902" {...register('trainNumber')} />
                <Input label="Class" placeholder="3A" {...register('travelClass')} />
                <Input label="Quota" placeholder="GENERAL" {...register('quota')} />
              </>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Passengers</p>
            {passengers.length === 0 ? (
              <p className="text-sm text-slate-500">Add a passenger before scheduling a booking.</p>
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
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting}>
              Schedule Booking
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
