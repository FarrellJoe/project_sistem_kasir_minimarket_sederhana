import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ban, Printer, Search } from 'lucide-react';
import { listTransactions, listUsers, voidTransaction } from '../lib/api';
import { dateTime, dayKey, money } from '../lib/format';
import { useSessionStore } from '../stores';
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, Input, Select, Textarea, Toast } from '../components/ui';

const voidSchema = z.object({
  reason: z.string().trim().min(1, 'Alasan pembatalan wajib diisi.').max(240, 'Alasan maksimal 240 karakter.'),
});

export default function Riwayat() {
  const session = useSessionStore((state) => state.session);
  const isAdmin = session?.role === 'admin';
  const queryClient = useQueryClient();

  const transactionsQuery = useQuery({ queryKey: ['transactions'], queryFn: listTransactions });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [cashier, setCashier] = useState('');
  const [method, setMethod] = useState('');
  const [detail, setDetail] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (message, tone = 'success') => {
    setToast({ message, tone });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3200);
  };

  const form = useForm({ resolver: zodResolver(voidSchema), defaultValues: { reason: '' } });

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (transactionsQuery.data || []).filter((transaction) => {
      if (!isAdmin && String(transaction.cashierId) !== String(session.userId)) return false;
      if (query && !transaction.id.toLowerCase().includes(query) &&
        !String(transaction.cashierName || '').toLowerCase().includes(query)) return false;
      if (date && dayKey(transaction.createdAt) !== date) return false;
      if (status && transaction.status !== status) return false;
      if (cashier && String(transaction.cashierId) !== String(cashier)) return false;
      if (method && transaction.paymentMethod !== method) return false;
      return true;
    });
  }, [transactionsQuery.data, search, date, status, cashier, method, isAdmin, session.userId]);

  const voidMutation = useMutation({
    mutationFn: (values) => voidTransaction({ id: voidTarget.id, reason: values.reason }, session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      setVoidTarget(null);
      setDetail(null);
      form.reset({ reason: '' });
      notify('Transaksi dibatalkan dan stok dikembalikan.');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  return (
    <div className="grid gap-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Cari transaksi</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor transaksi atau kasir" className="pl-10" />
        </label>
        <Field label="Tanggal" className="min-w-[170px]">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Status" className="min-w-[150px]">
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Semua status</option>
            <option value="selesai">Selesai</option>
            <option value="dibatalkan">Dibatalkan</option>
          </Select>
        </Field>
        {isAdmin ? (
          <Field label="Kasir" className="min-w-[170px]">
            <Select value={cashier} onChange={(event) => setCashier(event.target.value)}>
              <option value="">Semua kasir</option>
              {(usersQuery.data || []).map((user) => (
                <option key={user.id} value={user.id}>{user.nama}</option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Metode" className="min-w-[160px]">
          <Select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="">Semua metode</option>
            <option value="Tunai">Tunai</option>
            <option value="QRIS">QRIS</option>
            <option value="Debit/Transfer">Debit / Transfer</option>
          </Select>
        </Field>
        <Button variant="secondary" onClick={() => { setSearch(''); setDate(''); setStatus(''); setCashier(''); setMethod(''); }}>Reset</Button>
      </Card>

      <Card>
        <CardHeader title="Riwayat transaksi" description={isAdmin ? 'Seluruh transaksi toko' : 'Hanya transaksi milik Anda'} />
        {rows.length === 0 ? (
          <EmptyState icon="🧾" title="Tidak ada transaksi" description="Ubah filter atau selesaikan transaksi pertama di halaman Kasir." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-ink-muted">
                  <th className="px-5 py-3 font-medium">Nomor</th>
                  <th className="px-3 py-3 font-medium">Waktu</th>
                  <th className="px-3 py-3 font-medium">Kasir</th>
                  <th className="px-3 py-3 font-medium">Metode</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-slate-50 last:border-0 hover:bg-primary-tint/40">
                    <td className="px-5 py-3 font-medium text-ink">{transaction.id}</td>
                    <td className="px-3 py-3 text-ink-muted">{dateTime(transaction.createdAt)}</td>
                    <td className="px-3 py-3">{transaction.cashierName}</td>
                    <td className="px-3 py-3 text-ink-muted">{transaction.paymentMethod}</td>
                    <td className="px-3 py-3 text-right tnum">{money(transaction.total)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={transaction.status === 'dibatalkan' ? 'danger' : 'success'}>
                        {transaction.status === 'dibatalkan' ? 'Dibatalkan' : 'Selesai'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => setDetail(transaction)}>Detail</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? detail.id : ''}
        description={detail ? dateTime(detail.createdAt) + ' · ' + detail.cashierName : ''}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Cetak ulang</Button>
            {isAdmin && detail?.status !== 'dibatalkan' ? (
              <Button variant="outlineDanger" onClick={() => { setVoidTarget(detail); setDetail(null); form.reset({ reason: '' }); }}>
                <Ban size={16} /> Void transaksi
              </Button>
            ) : null}
            <Button onClick={() => setDetail(null)}>Tutup</Button>
          </>
        }
      >
        {detail ? (
          <div className="print-area grid gap-3">
            <ul className="grid gap-2 border-y border-slate-100 py-3">
              {(detail.items || []).map((item) => (
                <li key={item.productId} className="grid gap-0.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>{item.quantity}× {item.name}</span>
                    <span className="tnum">{money(item.subtotal ?? item.price * item.quantity)}</span>
                  </div>
                  {item.discount ? (
                    <span className="text-sm text-emerald-700">
                      Diskon item {item.discountType === 'percent' ? item.discountValue + '%' : money(item.discountValue) + '/unit'}: − {money(item.discount)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <dl className="grid gap-1 text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tnum">{money(detail.grossSubtotal ?? detail.subtotal)}</dd></div>
              {detail.itemDiscount ? (
                <div className="flex justify-between"><dt className="text-ink-muted">Diskon item</dt><dd className="text-emerald-700 tnum">− {money(detail.itemDiscount)}</dd></div>
              ) : null}
              <div className="flex justify-between"><dt className="text-ink-muted">Diskon transaksi</dt><dd className="tnum">{money(detail.discount)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tnum">{money(detail.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">{detail.paymentMethod}</dt><dd className="tnum">{money(detail.received)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Kembalian</dt><dd className="tnum">{money(detail.change)}</dd></div>
            </dl>
            {detail.status === 'dibatalkan' ? (
              <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger-dark">
                Dibatalkan: {detail.voidReason}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title="Void transaksi"
        description={voidTarget ? voidTarget.id + ' · ' + money(voidTarget.total) : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoidTarget(null)}>Batal</Button>
            <Button variant="danger" type="submit" form="void-form" disabled={voidMutation.isPending}>Ya, batalkan</Button>
          </>
        }
      >
        <form id="void-form" className="grid gap-3" onSubmit={form.handleSubmit((values) => voidMutation.mutate(values))}>
          <Field label="Alasan pembatalan" error={form.formState.errors.reason?.message}>
            <Textarea rows={3} maxLength={240} placeholder="Tuliskan alasan pembatalan…" {...form.register('reason')} />
          </Field>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Status berubah menjadi Dibatalkan, stok dikembalikan, dan transaksi tidak dihitung pada laporan. Data asli tetap tersimpan.
          </p>
        </form>
      </Dialog>

      <Toast message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
