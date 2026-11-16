import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { changePassword, getMyProfile, updateProfile } from '../lib/api';
import { dateTime, initials } from '../lib/format';
import { useSessionStore } from '../stores';
import { Badge, Button, Card, CardHeader, Field, Input, Toast } from '../components/ui';

/* Validasi kontak sama dengan versi-murni: email ATAU nomor telepon. */
const isContact = (value) => (value.includes('@')
  ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  : /^\+?[\d ()-]{6,20}$/.test(value));

const profileSchema = z.object({
  nama: z.string().trim().min(1, 'Nama lengkap wajib diisi.').max(80, 'Nama maksimal 80 karakter.'),
  email: z.string().trim().min(1, 'Email atau nomor telepon wajib diisi.')
    .max(120, 'Maksimal 120 karakter.')
    .refine(isContact, 'Masukkan email atau nomor telepon yang valid.'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi.'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter.'),
  confirmPassword: z.string(),
})
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi password tidak cocok.',
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'Password baru harus berbeda dari password lama.',
  });

/* Foto profil diperkecil ke 256 px seperti versi-murni agar hemat penyimpanan. */
function processPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !['image/jpeg', 'image/png'].includes(file.type)) {
      reject(new Error('Pilih file JPG atau PNG.'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('Ukuran foto maksimal 2 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Foto tidak dapat dibaca.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('File foto tidak valid.'));
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Peramban tidak dapat memproses foto.'));
          return;
        }
        canvas.width = size;
        canvas.height = size;
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, size, size);
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Profil() {
  const session = useSessionStore((state) => state.session);
  const setSession = useSessionStore((state) => state.setSession);
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ['myProfile'], queryFn: () => getMyProfile(session) });

  const [photo, setPhoto] = useState('');
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  const notify = (message, tone = 'success') => {
    setToast({ message, tone });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3200);
  };

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { nama: '', email: '' },
  });
  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    profileForm.reset({ nama: profileQuery.data.nama || '', email: profileQuery.data.email || '' });
    setPhoto(profileQuery.data.photo || '');
  }, [profileQuery.data, profileForm]);

  const profileMutation = useMutation({
    mutationFn: (values) => updateProfile({ ...values, photo }, session),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSession({ ...session, nama: updated.nama });
      notify('Profil berhasil diperbarui.');
    },
    onError: (error) => notify(error.message || 'Profil gagal disimpan.', 'error'),
  });

  const passwordMutation = useMutation({
    mutationFn: (values) => changePassword(values, session),
    onSuccess: () => {
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      notify('Password berhasil diganti.');
    },
    onError: (error) => {
      passwordForm.setError('currentPassword', { message: error.message || 'Password gagal diganti.' });
    },
  });

  const pickPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setPhoto(await processPhoto(file));
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const user = profileQuery.data;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Informasi profil"
            description="Data pribadi yang dipakai pada akun Brahamart."
          />
          <form className="grid gap-4 p-5" onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}>
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-tint text-xl font-semibold text-primary-hover">
                {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials(user?.nama)}
              </span>
              <div className="grid gap-2">
                <span className="text-sm text-ink-muted">Foto profil opsional · JPG atau PNG, maks. 2 MB</span>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" type="button" onClick={() => fileRef.current?.click()}>
                    <Camera size={15} /> Ubah foto
                  </Button>
                  {photo ? (
                    <Button variant="ghost" size="sm" type="button" onClick={() => setPhoto('')}>
                      <Trash2 size={15} /> Hapus foto
                    </Button>
                  ) : null}
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={pickPhoto} />
              </div>
            </div>

            <Field label="Nama lengkap" error={profileForm.formState.errors.nama?.message}>
              <Input maxLength={80} autoComplete="name" {...profileForm.register('nama')} />
            </Field>
            <Field label="Email / nomor telepon" error={profileForm.formState.errors.email?.message}>
              <Input maxLength={120} autoComplete="email" {...profileForm.register('email')} />
            </Field>

            <dl className="grid gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Username</dt>
                <dd className="text-ink">{user?.username || '-'} · tidak dapat diubah</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Kode staf</dt>
                <dd className="text-ink tnum">{user?.staffCode || '-'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Peran</dt>
                <dd>
                  <Badge tone={user?.role === 'admin' ? 'info' : 'neutral'}>
                    {user?.role === 'admin' ? 'Admin' : 'Kasir'}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Login terakhir</dt>
                <dd className="text-ink">{user?.lastLoginAt ? dateTime(user.lastLoginAt) : 'Belum tercatat'}</dd>
              </div>
            </dl>

            <div className="flex justify-end">
              <Button type="submit" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? 'Menyimpan…' : 'Simpan profil'}
              </Button>
            </div>
          </form>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Ganti password" description="Gunakan password yang unik untuk melindungi akun." />
            <form className="grid gap-4 p-5" onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))}>
              <Field label="Password saat ini" error={passwordForm.formState.errors.currentPassword?.message}>
                <Input type="password" autoComplete="current-password" {...passwordForm.register('currentPassword')} />
              </Field>
              <Field label="Password baru" error={passwordForm.formState.errors.newPassword?.message} hint="Minimal 8 karakter.">
                <Input type="password" autoComplete="new-password" {...passwordForm.register('newPassword')} />
              </Field>
              <Field label="Konfirmasi password baru" error={passwordForm.formState.errors.confirmPassword?.message}>
                <Input type="password" autoComplete="new-password" {...passwordForm.register('confirmPassword')} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordMutation.isPending}>
                  <KeyRound size={16} /> {passwordMutation.isPending ? 'Menyimpan…' : 'Ganti password'}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <strong className="flex items-center gap-2 text-base text-ink">
              <ShieldCheck size={18} className="text-primary" /> Keamanan sesi
            </strong>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Sesi berakhir setelah 30 menit tidak aktif. Setelah 5 kali login gagal, akun dikunci sementara
              selama 5 menit. Password disimpan sebagai hash SHA-256 di peramban ini.
            </p>
          </Card>
        </div>
      </div>

      <Toast message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
