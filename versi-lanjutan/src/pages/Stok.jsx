import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PackageMinus, PackagePlus, Search, Warehouse } from 'lucide-react';
import { adjustStock, listProducts, listStockMovements } from '../lib/api';
import { dateTime, stockStatus } from '../lib/format';
import { useSessionStore } from '../stores';
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, Input, Select, Textarea, Toast } from '../components/ui';

const adjustSchema = z.object({
  action: z.enum(['add', 'reduce', 'correction']),
  amount: z.coerce.number().int('Jumlah harus bilangan bulat.').min(0, 'Jumlah tidak boleh negatif.'),
  reason: z.string().min(1, 'Alasan penyesuaian wajib dipilih.'),
  note: z.string().max(240, 'Catatan maksimal 240 karakter.').optional(),
});

const REASONS = ['Barang masuk', 'Barang rusak', 'Kedaluwarsa', 'Hasil stock opname', 'Koreksi input'];

export default function Stok() {
  const session = useSessionStore((state) => state.session);
  const isAdmin = session?.role === 'admin';
  const queryClient = useQueryClient();

  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const movementsQuery = useQuery({ queryKey: ['stockMovements'], queryFn: listStockMovements });

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [target, setTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (message, tone = 'success') => {
    setToast({ message, tone });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3200);
  };

  const form = useForm({
    resolver: zodResolver(adjustSchema),
    defaultValues: { action: 'add', amount: 1, reason: REASONS[0], note: '' },
  });
  const { register, handleSubmit, reset, watch, formState: { errors } } = form;
  const action = watch('action');

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (productsQuery.data || [])
      .filter((product) => {
        if (query && !product.name.toLowerCase().includes(query) && !product.code.toLowerCase().includes(query)) return false;
        if (filter && stockStatus(product) !== filter) return false;
        return true;
      })
      .sort((a, b) => Number(a.stock) - Number(b.stock));
  }, [productsQuery.data, search, filter]);

  const mutation = useMutation({
    mutationFn: (values) => adjustStock({
      productId: target.id,
      action: values.action,
      amount: values.amount,
      reason: values.reason,
      note: values.note || '',
      expectedStock: target.stock,
    }, session),
    onSuccess: (movement) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
      setTarget(null);
      notify('Stok ' + movement.stockBefore + ' → ' + movement.stockAfter + ' tersimpan.');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const openAdjust = (product) => {
    setTarget(product);
    reset({ action: 'add', amount: 1, reason: REASONS[0], note: '' });
  };

  const summary = useMemo(() => {
    const products = productsQuery.data || [];
    return {
      total: products.length,
      low: products.filter((product) => stockStatus(product) === 'menipis').length,
      out: products.filter((product) => stockStatus(product) === 'habis').length,
    };
  }, [productsQuery.data]);

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-ink-muted">Produk terdaftar</p>
          <strong className="mt-1 block font-heading text-2xl tnum">{summary.total}</strong>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-muted">Stok menipis</p>
          <strong className="mt-1 block font-heading text-2xl text-amber-600 tnum">{summary.low}</strong>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-muted">Stok habis</p>
          <strong className="mt-1 block font-heading text-2xl text-danger tnum">{summary.out}</strong>
        </Card>
      </section>

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Cari produk</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau kode produk" className="pl-10" />
        </label>
        <label className="min-w-[160px]">
          <span className="sr-only">Filter stok</span>
          <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">Semua stok</option>
            <option value="aman">Aman</option>
            <option value="menipis">Menipis</option>
            <option value="habis">Habis</option>
          </Select>
        </label>
        {!isAdmin ? <Badge tone="neutral">Akses kasir: hanya melihat</Badge> : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Ketersediaan stok" description="Diurutkan dari stok paling sedikit" />
          {rows.length === 0 ? (
            <EmptyState icon="📦" title="Tidak ada produk" description="Ubah filter atau kata kunci pencarian." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-ink-muted">
                    <th className="px-5 py-3 font-medium">Produk</th>
                    <th className="px-3 py-3 text-right font-medium">Stok</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((product) => {
                    const state = stockStatus(product);
                    return (
                      <tr key={product.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3">
                          <strong className="block text-ink">{product.emoji} {product.name}</strong>
                          <span className="text-sm text-ink-muted">{product.code} · min {product.minStock} {product.unit}</span>
                        </td>
                        <td className="px-3 py-3 text-right tnum">{product.stock} {product.unit}</td>
                        <td className="px-3 py-3">
                          <Badge tone={state === 'habis' ? 'danger' : state === 'menipis' ? 'warning' : 'success'}>
                            {state === 'habis' ? 'Habis' : state === 'menipis' ? 'Menipis' : 'Aman'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {isAdmin ? (
                            <Button variant="secondary" size="sm" onClick={() => openAdjust(product)}>
                              Sesuaikan
                            </Button>
                          ) : (
                            <span className="text-sm text-ink-muted">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Riwayat mutasi stok" description="20 perubahan terakhir" />
          {(movementsQuery.data || []).length === 0 ? (
            <EmptyState icon="📋" title="Belum ada mutasi" description="Penjualan dan penyesuaian akan tercatat di sini." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {(movementsQuery.data || []).slice(0, 20).map((movement) => {
                const product = (productsQuery.data || []).find((entry) => entry.id === movement.productId);
                const positive = Number(movement.quantity) > 0;
                return (
                  <li key={movement.id} className="flex items-start gap-3 px-5 py-3">
                    <span className={`mt-1 ${positive ? 'text-emerald-600' : 'text-danger'}`} aria-hidden="true">
                      {positive ? <PackagePlus size={16} /> : <PackageMinus size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-ink">{product?.name || movement.productId}</strong>
                      <span className="text-sm text-ink-muted">
                        {movement.type} · {movement.stockBefore} → {movement.stockAfter} · {movement.reason}
                      </span>
                      <span className="block text-sm text-ink-muted">{dateTime(movement.createdAt)}</span>
                    </div>
                    <span className={`text-sm font-semibold tnum ${positive ? 'text-emerald-600' : 'text-danger'}`}>
                      {positive ? '+' : ''}{movement.quantity}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Dialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={'Sesuaikan stok' + (target ? ' · ' + target.name : '')}
        description={target ? `Stok saat ini ${target.stock} ${target.unit}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>Batal</Button>
            <Button type="submit" form="adjust-form" disabled={mutation.isPending}>Simpan penyesuaian</Button>
          </>
        }
      >
        <form id="adjust-form" className="grid gap-3" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <Field label="Jenis penyesuaian" error={errors.action?.message}>
            <Select {...register('action')}>
              <option value="add">Tambah stok</option>
              <option value="reduce">Kurangi stok</option>
              <option value="correction">Koreksi / stock opname</option>
            </Select>
          </Field>
          <Field
            label={action === 'correction' ? 'Stok fisik hasil hitung' : 'Jumlah perubahan'}
            error={errors.amount?.message}
            hint={action === 'correction' ? 'Masukkan jumlah fisik, bukan selisih.' : 'Gunakan bilangan bulat positif.'}
          >
            <Input type="number" min="0" step="1" {...register('amount')} />
          </Field>
          <Field label="Alasan" error={errors.reason?.message}>
            <Select {...register('reason')}>
              {REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </Select>
          </Field>
          <Field label="Catatan (opsional)" error={errors.note?.message}>
            <Textarea rows={3} maxLength={240} placeholder="Tambahkan keterangan penyesuaian…" {...register('note')} />
          </Field>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-muted">
            <Warehouse size={14} className="mr-1 inline" aria-hidden="true" />
            Setiap perubahan tercatat di kartu stok: waktu, jumlah, stok sebelum/sesudah, dan pelaku.
          </p>
        </form>
      </Dialog>

      <Toast message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
