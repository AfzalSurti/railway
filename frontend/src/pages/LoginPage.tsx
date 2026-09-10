import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { getApiErrorMessage } from '../services/api';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-card">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to manage scheduled travel tasks.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={handleSubmit(async (values) => {
          try {
            await login(values.email, values.password);
            notify({ variant: 'success', title: 'Signed in' });
            navigate('/dashboard');
          } catch (error) {
            notify({ variant: 'error', title: 'Login failed', message: getApiErrorMessage(error) });
          }
        })}
      >
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Login
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Need an account?{' '}
        <Link to="/register" className="font-semibold text-brand-700 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
