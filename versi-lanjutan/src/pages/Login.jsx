import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { login } from '../lib/api';
import { useSessionStore } from '../stores';
import { Button, Input } from '../components/ui';

const schema = z.object({
  identifier: z.string().trim().min(1, 'Username atau email wajib diisi.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});

export default function Login() {
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  const session = useSessionStore((state) => state.session);
  const ready = useSessionStore((state) => state.ready);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { identifier: '', password: '' } });

  if (ready && session) {
    return <Navigate to={session.role === 'admin' ? '/dashboard' : '/kasir'} replace />;
  }

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const next = await login(values);
      setSession(next);
      navigate(next.role === 'admin' ? '/dashboard' : '/kasir', { replace: true });
    } catch (error) {
      setFormError(error.message || 'Login gagal.');
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white" aria-hidden="true">
            {/* Ukuran mark mengikuti versi-murni: gambar 128 px di tile 48 px. */}
            <img
              src={`${import.meta.env.BASE_URL}brand/brahamart-mark.png`}
              alt=""
              className="absolute left-1/2 top-1/2 h-32 w-32 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            />
          </span>
          <div>
            <strong className="block font-heading text-xl">Brahamart</strong>
            <span className="text-sm text-indigo-200">Sistem POS Minimarket Sederhana</span>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="font-heading text-3xl font-semibold leading-tight">Transaksi mudah, minimarket makin berkembang.</h1>
          <ul className="space-y-2 text-sm text-indigo-100">
            <li>• Transaksi cepat dengan scan barcode atau pencarian produk</li>
            <li>• Kelola produk, kategori, dan stok dengan mudah</li>
            <li>• Rekap penjualan harian, bulanan, atau periode tertentu</li>
          </ul>
        </div>

        <p className="text-sm text-indigo-200/80">© 2026 Brahamart</p>
      </section>

      <section className="grid place-items-center bg-canvas px-4 py-10">
        <div className="w-full max-w-md rounded-card border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="font-heading text-2xl font-semibold text-ink">Masuk</h2>
          <p className="mt-1 text-sm text-ink-muted">Gunakan akun kasir atau admin Brahamart.</p>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            {formError ? (
              <p role="alert" className="rounded-lg border border-danger/40 bg-danger-tint px-3 py-2 text-sm text-danger-dark">
                {formError}
              </p>
            ) : null}

            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-ink">Username atau email</span>
              <Input autoComplete="username" placeholder="Masukkan username atau email" {...register('identifier')} />
              {errors.identifier ? <span className="text-sm text-danger-dark">{errors.identifier.message}</span> : null}
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-ink">Password</span>
              <span className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
              {errors.password ? <span className="text-sm text-danger-dark">{errors.password.message}</span> : null}
            </label>

            <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2 w-full">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {isSubmitting ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>

          <p className="mt-6 border-t border-slate-100 pt-4 text-sm text-ink-muted">
            Akun dibuat oleh Admin toko. Hubungi Admin bila Anda belum memiliki akses atau lupa password.
          </p>
        </div>
      </section>
    </main>
  );
}
