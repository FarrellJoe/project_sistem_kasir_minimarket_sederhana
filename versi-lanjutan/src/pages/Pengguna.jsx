import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Pencil, UserPlus } from 'lucide-react';
import { listUsers, resetUserPassword, saveUser, toggleUser } from '../lib/api';
import { dateTime, initials } from '../lib/format';
import { useSessionStore } from '../stores';
import { Badge, Button, Card, CardHeader, Dialog, Field, Input, Select, Toast } from '../components/ui';

const userSchema = z.object({
  nama: z.string().trim().min(1, 'Nama lengkap wajib diisi.'),
  username: z.string().trim().min(1, 'Username wajib diisi.').regex(/^\S+$/, 'Username tanpa spasi.'),
  email: z.string().trim().min(1, 'Email atau nomor telepon wajib diisi.'),
  role: z.enum(['admin', 'kasir']),
  isActive: z.boolean(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => !data.password || data.password.length >= 8, {
  message: 'Password minimal 8 karakter.',
  path: ['password'],
}).refine((data) => !data.password || data.password === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.',
  path: ['confirmPassword'],
});

const resetSchema = z.object({
  password: z.string().min(8, 'Password minimal 8 karakter.'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.',
  path: ['confirmPassword'],
});

export default function Pengguna() {
  const session = useSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers });

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (message, tone = 'success') => {
    setToast({ message, tone });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3200);
  };

  const form = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: { nama: '', username: '', email: '', role: 'kasir', isActive: true, password: '', confirmPassword: '' },
  });
  const resetForm = useForm({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirmPassword: '' } });

  const saveMutation = useMutation({
    mutationFn: (values) => saveUser(values, session),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFormOpen(false);
      notify('Pengguna ' + user.nama + ' disimpan (' + user.staffCode + ').');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: (payload) => toggleUser(payload, session),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirm(null);
      notify(result.isActive ? 'Akun diaktifkan.' : 'Akun dinonaktifkan.');
    },
    onError: (error) => {
      setConfirm(null);
      notify(error.message, 'error');
    },
  });

  const resetMutation = useMutation({
    mutationFn: (values) => resetUserPassword({ id: resetTarget.id, password: values.password }, session),
    onSuccess: () => {
      setResetTarget(null);
      resetForm.reset({ password: '', confirmPassword: '' });
      notify('Password ' + resetTarget.nama + ' berhasil direset.');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ nama: '', username: '', email: '', role: 'kasir', isActive: true, password: '', confirmPassword: '' });
    setFormOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    form.reset({
      nama: user.nama, username: user.username, email: user.email,
      role: user.role, isActive: user.isActive, password: '', confirmPassword: '',
    });
    setFormOpen(true);
  };

  const submit = (values) => {
    if (!editing && String(values.password || '').length < 8) {
      form.setError('password', { message: 'Password minimal 8 karakter untuk akun baru.' });
      return;
    }
    saveMutation.mutate({ ...values, id: editing?.id });
  };

  return (
    <div className="grid gap-4">
      <Card className="flex items-center justify-between gap-3 p-4">
        <p className="text-sm text-ink-muted">
          {(usersQuery.data || []).length} akun terdaftar. Sistem harus selalu memiliki minimal satu Admin aktif.
        </p>
        <Button onClick={openCreate}><UserPlus size={16} /> Tambah pengguna</Button>
      </Card>

      <Card>
        <CardHeader title="Daftar pengguna" description="Akun admin dan kasir beserta kode stafnya" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-ink-muted">
                <th className="px-5 py-3 font-medium">Nama</th>
                <th className="px-3 py-3 font-medium">Username</th>
                <th className="px-3 py-3 font-medium">Kode staf</th>
                <th className="px-3 py-3 font-medium">Peran</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Login terakhir</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(usersQuery.data || []).map((user) => {
                const isMe = String(user.id) === String(session.userId);
                return (
                  <tr key={user.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-tint text-sm font-semibold text-primary-hover">
                          {user.photo ? <img src={user.photo} alt="" className="h-full w-full object-cover" /> : initials(user.nama)}
                        </span>
                        <span>
                          <strong className="block text-ink">{user.nama}{isMe ? ' · Anda' : ''}</strong>
                          <span className="text-sm text-ink-muted">{user.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-muted">{user.username}</td>
                    <td className="px-3 py-3 tnum">{user.staffCode || '-'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={user.role === 'admin' ? 'info' : 'neutral'}>{user.role === 'admin' ? 'Admin' : 'Kasir'}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
                    </td>
                    <td className="px-3 py-3 text-ink-muted">{user.lastLoginAt ? dateTime(user.lastLoginAt) : 'Belum tercatat'}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)} aria-label={`Ubah ${user.nama}`}><Pencil size={15} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setResetTarget(user); resetForm.reset({ password: '', confirmPassword: '' }); }}>
                          <KeyRound size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirm(user)}
                          disabled={isMe}
                          title={isMe ? 'Tidak dapat menonaktifkan akun sendiri' : undefined}
                        >
                          {user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah pengguna' : 'Tambah pengguna'}
        description="Password minimal 8 karakter. Kode staf dibuat otomatis."
        className="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button type="submit" form="user-form" disabled={saveMutation.isPending}>Simpan pengguna</Button>
          </>
        }
      >
        <form id="user-form" className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
          <Field label="Nama lengkap" error={form.formState.errors.nama?.message} className="sm:col-span-2">
            <Input placeholder="Nama sesuai kartu identitas" {...form.register('nama')} />
          </Field>
          <Field label="Username" error={form.formState.errors.username?.message}>
            <Input placeholder="tanpa spasi" {...form.register('username')} />
          </Field>
          <Field label="Email / telepon" error={form.formState.errors.email?.message}>
            <Input placeholder="nama@toko.test" {...form.register('email')} />
          </Field>
          <Field label="Peran" error={form.formState.errors.role?.message}>
            <Select {...form.register('role')}>
              <option value="kasir">Kasir</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select {...form.register('isActive', { setValueAs: (value) => value === 'true' })} defaultValue="true">
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </Select>
          </Field>
          <Field label={editing ? 'Password baru (opsional)' : 'Password'} error={form.formState.errors.password?.message}>
            <Input type="password" autoComplete="new-password" {...form.register('password')} />
          </Field>
          <Field label="Konfirmasi password" error={form.formState.errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="Reset password"
        description={resetTarget ? resetTarget.nama + ' · ' + resetTarget.staffCode : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>Batal</Button>
            <Button type="submit" form="reset-form" disabled={resetMutation.isPending}>Simpan password</Button>
          </>
        }
      >
        <form id="reset-form" className="grid gap-3" onSubmit={resetForm.handleSubmit((values) => resetMutation.mutate(values))}>
          <Field label="Password baru" error={resetForm.formState.errors.password?.message}>
            <Input type="password" autoComplete="new-password" {...resetForm.register('password')} />
          </Field>
          <Field label="Konfirmasi password" error={resetForm.formState.errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...resetForm.register('confirmPassword')} />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.isActive ? 'Nonaktifkan akun?' : 'Aktifkan akun?'}
        description={confirm?.nama}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Batal</Button>
            <Button
              variant={confirm?.isActive ? 'danger' : 'primary'}
              onClick={() => toggleMutation.mutate({ id: confirm.id, isActive: !confirm.isActive })}
            >
              {confirm?.isActive ? 'Ya, nonaktifkan' : 'Ya, aktifkan'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {confirm?.isActive
            ? 'Akun tidak dapat login setelah dinonaktifkan. Riwayat transaksinya tetap tersimpan.'
            : 'Akun dapat kembali login sesuai perannya.'}
        </p>
      </Dialog>

      <Toast message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
