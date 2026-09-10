import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Spinner } from '../components/Spinner';
import { passengerService } from '../services/passenger.service';
import { getApiErrorMessage } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import type { Gender, Passenger } from '../types/passenger';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  age: z.coerce.number().int().min(1).max(120),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  phone: z.string().min(8, 'Phone is required'),
});

type FormValues = z.infer<typeof schema>;

export function PassengersPage() {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Passenger | null>(null);
  const [deleting, setDeleting] = useState<Passenger | null>(null);
  const [open, setOpen] = useState(false);
  const { notify } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function refresh() {
    const data = await passengerService.list();
    setPassengers(data);
  }

  useEffect(() => {
    refresh()
      .catch((error) => notify({ variant: 'error', title: 'Failed to load passengers', message: getApiErrorMessage(error) }))
      .finally(() => setLoading(false));
  }, [notify]);

  function openCreate() {
    setEditing(null);
    reset({ name: '', age: 30, gender: 'MALE', phone: '' });
    setOpen(true);
  }

  function openEdit(passenger: Passenger) {
    setEditing(passenger);
    reset({
      name: passenger.name,
      age: passenger.age,
      gender: passenger.gender,
      phone: passenger.phone,
    });
    setOpen(true);
  }

  if (loading) {
    return <Spinner label="Loading passengers..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Passengers</h1>
          <p className="mt-1 text-sm text-slate-500">Saved travellers that can be attached to booking tasks.</p>
        </div>
        <Button onClick={openCreate}>Add passenger</Button>
      </div>

      {passengers.length === 0 ? (
        <EmptyState
          title="No passengers yet"
          description="Add a traveller before scheduling a booking task."
          actionLabel="Add passenger"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {passengers.map((passenger) => (
            <Card key={passenger.id} className="p-5">
              <p className="text-lg font-semibold text-slate-900">{passenger.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {passenger.age} yrs · {passenger.gender.toLowerCase()} · {passenger.phone}
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => openEdit(passenger)}>
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeleting(passenger)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold">{editing ? 'Edit passenger' : 'Add passenger'}</h2>
            <form
              className="mt-4 space-y-4"
              onSubmit={handleSubmit(async (values) => {
                try {
                  if (editing) {
                    await passengerService.update(editing.id, values);
                    notify({ variant: 'success', title: 'Passenger updated' });
                  } else {
                    await passengerService.create({
                      ...values,
                      gender: values.gender as Gender,
                    });
                    notify({ variant: 'success', title: 'Passenger added' });
                  }
                  await refresh();
                  setOpen(false);
                } catch (error) {
                  notify({ variant: 'error', title: 'Save failed', message: getApiErrorMessage(error) });
                }
              })}
            >
              <Input label="Name" error={errors.name?.message} {...register('name')} />
              <Input label="Age" type="number" error={errors.age?.message} {...register('age')} />
              <Select label="Gender" error={errors.gender?.message} {...register('gender')}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
              <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  Save
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete passenger"
        description="This passenger will be removed from your saved travellers."
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await passengerService.remove(deleting.id);
            notify({ variant: 'success', title: 'Passenger deleted' });
            await refresh();
            setDeleting(null);
          } catch (error) {
            notify({ variant: 'error', title: 'Delete failed', message: getApiErrorMessage(error) });
          }
        }}
      />
    </div>
  );
}
