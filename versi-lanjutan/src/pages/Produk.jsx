import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react';
import {
  deleteCategory, deleteProduct, listCategories, listProducts, saveCategory, saveProduct, toggleProduct,
} from '../lib/api';
import { money, stockStatus } from '../lib/format';
import { useSessionStore } from '../stores';
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, Input, Select, Toast } from '../components/ui';

const productSchema = z.object({
  code: z.string().trim().min(1, 'Kode barang wajib diisi.'),
  name: z.string().trim().min(1, 'Nama produk wajib diisi.'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih.'),
  unit: z.string().min(1, 'Satuan wajib diisi.'),
  purchasePrice: z.coerce.number().min(0, 'Harga beli tidak boleh negatif.'),
  salePrice: z.coerce.number().min(0, 'Harga jual tidak boleh negatif.'),
  stock: z.coerce.number().int('Stok harus bilangan bulat.').min(0, 'Stok tidak boleh negatif.'),
  minStock: z.coerce.number().int('Stok minimum harus bilangan bulat.').min(0),
});

const categorySchema = z.object({ name: z.string().trim().min(1, 'Nama kategori wajib diisi.') });

const emptyProduct = {
  code: '', name: '', categoryId: '', unit: 'pcs',
  purchasePrice: 0, salePrice: 0, stock: 0, minStock: 10,
};

const toneForStatus = { aman: 'success', menipis: 'warning', habis: 'danger' };
const labelForStatus = { aman: 'Aman', menipis: 'Menipis', habis: 'Habis' };

export default function Produk() {
  const session = useSessionStore((state) => state.session);
  const isAdmin = session?.role === 'admin';
  const queryClient = useQueryClient();

  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: null, name: '' });
  const [toast, setToast] = useState(null);

  const notify = (message, tone = 'success') => {
    setToast({ message, tone });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3200);
  };

  const form = useForm({ resolver: zodResolver(productSchema), defaultValues: emptyProduct });
  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = form;

  const categoryName = (id) => categoriesQuery.data?.find((entry) => entry.id === id)?.name || '-';

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (productsQuery.data || [])
      .filter((product) => {
        if (query && !product.name.toLowerCase().includes(query) &&
          !product.code.toLowerCase().includes(query) &&
          !String(product.barcode || '').includes(query)) return false;
        if (category && product.categoryId !== category) return false;
        if (status && stockStatus(product) !== status) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [productsQuery.data, search, category, status]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] });

  const saveMutation = useMutation({
    mutationFn: (values) => saveProduct(values, session),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      notify(editing ? 'Perubahan produk disimpan.' : 'Produk berhasil ditambahkan.');
      setEditing(null);
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: (payload) => toggleProduct(payload, session),
    onSuccess: (result) => {
      invalidate();
      setConfirm(null);
      notify(result.isActive ? 'Produk diaktifkan.' : 'Produk dinonaktifkan.');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteProduct({ id }, session),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
      notify('Produk dihapus permanen.');
    },
    onError: (error) => {
      setConfirm(null);
      notify(error.message, 'error');
    },
  });

  const categoryMutation = useMutation({
    mutationFn: (values) => saveCategory(values, session),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCategoryForm({ id: null, name: '' });
      notify('Kategori ' + saved.name + ' disimpan.');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const categoryDelete = useMutation({
    mutationFn: (id) => deleteCategory({ id }, session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      notify('Kategori dihapus.');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    reset({ ...emptyProduct, categoryId: categoriesQuery.data?.[0]?.id || '' });
    setFormOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    reset({
      code: product.code,
      name: product.name,
      categoryId: product.categoryId,
      unit: product.unit,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      stock: product.stock,
      minStock: product.minStock,
    });
    setFormOpen(true);
  };

  const submit = (values) => {
    saveMutation.mutate({ ...values, id: editing?.id, isActive: editing ? editing.isActive : true, emoji: editing?.emoji || '📦' });
  };

  return (
    <div className="grid gap-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Cari produk</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, kode, atau barcode" className="pl-10" />
        </label>
        <label className="min-w-[160px]">
          <span className="sr-only">Filter kategori</span>
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Semua kategori</option>
            {(categoriesQuery.data || []).map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </Select>
        </label>
        <label className="min-w-[150px]">
          <span className="sr-only">Filter stok</span>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Semua stok</option>
            <option value="aman">Aman</option>
            <option value="menipis">Menipis</option>
            <option value="habis">Habis</option>
          </Select>
        </label>
        <Button variant="secondary" onClick={() => { setSearch(''); setCategory(''); setStatus(''); }}>Reset</Button>
        {isAdmin ? (
          <>
            <Button variant="secondary" onClick={() => setCategoriesOpen(true)}><Tags size={16} /> Kategori</Button>
            <Button onClick={openCreate}><Plus size={16} /> Tambah produk</Button>
          </>
        ) : (
          <Badge tone="neutral">Akses kasir: hanya melihat</Badge>
        )}
      </Card>

      <Card>
        <CardHeader title="Daftar produk" description={`${rows.length} produk ditampilkan dari ${(productsQuery.data || []).length} total`} />
        {productsQuery.isLoading ? (
          <p className="px-5 py-8 text-sm text-ink-muted">Memuat katalog…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon="📦" title="Tidak ada produk" description="Ubah kata kunci pencarian atau tambahkan produk baru." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-ink-muted">
                  <th className="px-5 py-3 font-medium">Kode</th>
                  <th className="px-3 py-3 font-medium">Produk</th>
                  <th className="px-3 py-3 font-medium">Kategori</th>
                  <th className="px-3 py-3 text-right font-medium">Harga jual</th>
                  <th className="px-3 py-3 text-right font-medium">Stok</th>
                  <th className="px-3 py-3 font-medium">Status stok</th>
                  <th className="px-3 py-3 font-medium">Aktif</th>
                  {isAdmin ? <th className="px-5 py-3 text-right font-medium">Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const state = stockStatus(product);
                  return (
                    <tr key={product.id} className="border-b border-slate-50 last:border-0 hover:bg-primary-tint/40">
                      <td className="px-5 py-3 text-ink-muted">{product.code}</td>
                      <td className="px-3 py-3">
                        <strong className="text-ink">{product.emoji} {product.name}</strong>
                        <span className="block text-sm text-ink-muted">{product.barcode || '-'}</span>
                      </td>
                      <td className="px-3 py-3 text-ink-muted">{categoryName(product.categoryId)}</td>
                      <td className="px-3 py-3 text-right tnum">{money(product.salePrice)}</td>
                      <td className="px-3 py-3 text-right tnum">{product.stock} {product.unit}</td>
                      <td className="px-3 py-3"><Badge tone={toneForStatus[state]}>{labelForStatus[state]}</Badge></td>
                      <td className="px-3 py-3">
                        <Badge tone={product.isActive ? 'success' : 'neutral'}>{product.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
                      </td>
                      {isAdmin ? (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(product)} aria-label={`Ubah ${product.name}`}>
                              <Pencil size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirm({ type: 'toggle', product })}
                              aria-label={product.isActive ? `Nonaktifkan ${product.name}` : `Aktifkan ${product.name}`}
                            >
                              {product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirm({ type: 'delete', product })} aria-label={`Hapus ${product.name}`}>
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Ubah produk' : 'Tambah produk'}
        description="Kode barang harus unik. Harga dan stok tidak boleh negatif."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button type="submit" form="product-form" disabled={isSubmitting || saveMutation.isPending}>Simpan produk</Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <Field label="Kode barang" error={errors.code?.message}>
            <Input placeholder="SKU-89912345" {...register('code')} />
          </Field>
          <Field label="Nama produk" error={errors.name?.message}>
            <Input placeholder="Indomie Goreng Original 85g" {...register('name')} />
          </Field>
          <Field label="Kategori" error={errors.categoryId?.message}>
            <Select {...register('categoryId')}>
              <option value="">Pilih kategori</option>
              {(categoriesQuery.data || []).map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Satuan" error={errors.unit?.message}>
            <Select {...register('unit')}>
              {['pcs', 'pack', 'dus', 'pouch', 'botol'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </Select>
          </Field>
          <Field label="Harga beli" error={errors.purchasePrice?.message}>
            <Input type="number" min="0" {...register('purchasePrice')} />
          </Field>
          <Field label="Harga jual" error={errors.salePrice?.message}>
            <Input type="number" min="0" {...register('salePrice')} />
          </Field>
          <Field label="Stok" error={errors.stock?.message}>
            <Input type="number" min="0" step="1" {...register('stock')} />
          </Field>
          <Field label="Stok minimum" error={errors.minStock?.message}>
            <Input type="number" min="0" step="1" {...register('minStock')} />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.type === 'delete' ? 'Hapus produk permanen?' : confirm?.product?.isActive ? 'Nonaktifkan produk?' : 'Aktifkan produk?'}
        description={confirm?.product?.name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>Batal</Button>
            <Button
              variant={confirm?.type === 'delete' ? 'danger' : 'primary'}
              onClick={() => {
                if (confirm.type === 'delete') deleteMutation.mutate(confirm.product.id);
                else toggleMutation.mutate({ id: confirm.product.id, isActive: !confirm.product.isActive });
              }}
            >
              {confirm?.type === 'delete' ? 'Ya, hapus' : 'Ya, lanjutkan'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {confirm?.type === 'delete'
            ? 'Produk yang pernah ditransaksikan tidak dapat dihapus; gunakan nonaktifkan agar riwayat tetap utuh.'
            : 'Status produk memengaruhi kemunculannya di halaman kasir.'}
        </p>
      </Dialog>

      <Dialog
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        title="Kategori produk"
        description="Kategori yang masih dipakai produk tidak dapat dihapus."
        footer={<Button variant="secondary" onClick={() => setCategoriesOpen(false)}>Tutup</Button>}
      >
        <form
          className="mb-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!categoryForm.name.trim()) return;
            categoryMutation.mutate({ id: categoryForm.id, name: categoryForm.name.trim() });
          }}
        >
          <Input
            value={categoryForm.name}
            onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Nama kategori baru"
            aria-label="Nama kategori"
          />
          <Button type="submit" disabled={categoryMutation.isPending}>{categoryForm.id ? 'Simpan' : 'Tambah'}</Button>
        </form>
        <ul className="divide-y divide-slate-100">
          {(categoriesQuery.data || []).map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 py-2">
              <span className="flex-1 text-sm">{entry.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setCategoryForm({ id: entry.id, name: entry.name })}>Ubah</Button>
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => categoryDelete.mutate(entry.id)}>Hapus</Button>
            </li>
          ))}
        </ul>
      </Dialog>

      <Toast message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
