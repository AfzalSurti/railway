import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { getApiErrorMessage } from '../services/api';

const schema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Enter a valid email'),
    phone: z.string().min(8, 'Enter a valid phone number'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm your password'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-card">
      <h1 className="text-2xl font-bold text-slate-900">Create your workspace</h1>
      <p className="mt-1 text-sm text-slate-500">Register to start scheduling booking tasks.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={handleSubmit(async (values) => {
          try {
            await registerUser({
              name: values.name,
              email: values.email,
              phone: values.phone,
              password: values.password,
            });
            notify({ variant: 'success', title: 'Registration successful' });
            navigate('/assistant');
          } catch (error) {
            notify({
              variant: 'error',
              title: 'Registration failed',
              message: getApiErrorMessage(error),
            });
          }
        })}
      >
        <Input label="Name" error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone" error={errors.phone?.message} {...register('phone')} />
        <Input label="Password" type="password" error={errors.password?.message} {...register('password')} />
        <Input
          label="Confirm Password"
          type="password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
