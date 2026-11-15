import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Database, Save } from 'lucide-react';
import { getSettings, listCategories, listProducts, listTransactions, listUsers, saveSettings } from '../lib/api';
import { downloadFile, toCSV } from '../lib/format';
import { useSessionStore } from '../stores';
import { Button, Card, CardHeader, Field, Input, Select, Textarea, Toast } from '../components/ui';

const schema = z.object({
  storeName: z.string().trim().min(1, 'Nama toko wajib diisi.'),
  storeAddress: z.string().max(160, 'Alamat maksimal 160 karakter.').optional(),
  storePhone: z.string().max(40, 'Nomor telepon maksimal 40 karakter.').optional(),
  receiptFooter: z.string().max(160, 'Teks footer maksimal 160 karakter.').optional(),
  receiptPaperSize: z.enum(['58', '80']),
  vatRate: z.coerce.number().min(0, 'PPN minimal 0%.').max(100, 'PPN maksimal 100%.'),
  defaultMinStock: z.coerce.number().int('Stok minimum harus bilangan bulat.').min(0),
  roundTo100: z.boolean(),
  paymentMethods: z.array(z.string()).min(1, 'Pilih setidaknya satu metode pembayaran.'),
});

const METHODS = ['Tunai', 'QRIS', 'Debit/Transfer'];

export default function Pengaturan() {
  const session = useSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [toast, setToast] = useState(null);

  const notify = (message, tone = 'success') => {
    setToast({ message, tone });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3200);
  };

  const form = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (settingsQuery.data) form.reset(settingsQuery.data);
  }, [settingsQuery.data, form]);

  const mutation = useMutation({
    mutationFn: (values) => saveSettings(values, session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      notify('Pengaturan disimpan dan langsung diterapkan.');
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const backup = async () => {
    const [products, categories, transactions, users, settings] = await Promise.all([
      listProducts(), listCategories(), listTransactions(), listUsers(), getSettings(),
    ]);
    downloadFile(JSON.stringify({ products, categories, transactions, users, settings }, null, 2),
      `backup-brahamart-${Date.now()}.json`, 'application/json');
    notify('Cadangan JSON diunduh.');
  };

  const backupCsv = async () => {
    const products = await listProducts();
    const rows = [['Kode', 'Nama', 'Kategori', 'Harga beli', 'Harga jual', 'Stok', 'Satuan', 'Aktif']];
    products.forEach((product) => rows.push([
      product.code, product.name, product.categoryId, product.purchasePrice,
      product.salePrice, product.stock, product.unit, product.isActive ? 'ya' : 'tidak',
    ]));
    downloadFile(toCSV(rows), `produk-brahamart-${Date.now()}.csv`, 'text/csv;charset=utf-8');
    notify('Cadangan CSV produk diunduh.');
  };

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = form;
  const methods = watch('paymentMethods') || [];

  const toggleMethod = (method) => {
    const next = methods.includes(method) ? methods.filter((item) => item !== method) : [...methods, method];
    setValue('paymentMethods', next, { shouldValidate: true });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader title="Identitas toko" description="Tampil pada struk dan judul halaman" />
        <form className="grid gap-3 p-5 sm:grid-cols-2" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <Field label="Nama toko" error={errors.storeName?.message}>
            <Input {...register('storeName')} />
          </Field>
          <Field label="Nomor telepon" error={errors.storePhone?.message}>
            <Input placeholder="021-123456" {...register('storePhone')} />
          </Field>
          <Field label="Alamat" className="sm:col-span-2" error={errors.storeAddress?.message}>
            <Textarea rows={2} {...register('storeAddress')} />
          </Field>
          <Field label="Teks footer struk" className="sm:col-span-2" error={errors.receiptFooter?.message}>
            <Input {...register('receiptFooter')} />
          </Field>
          <Field label="Ukuran kertas struk">
            <Select {...register('receiptPaperSize')}>
              <option value="58">58 mm</option>
              <option value="80">80 mm</option>
            </Select>
          </Field>
          <Field label="PPN sudah termasuk (%)" error={errors.vatRate?.message}>
            <Input type="number" min="0" max="100" {...register('vatRate')} />
          </Field>
          <Field label="Stok minimum default" error={errors.defaultMinStock?.message}>
            <Input type="number" min="0" step="1" {...register('defaultMinStock')} />
          </Field>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('roundTo100')} />
            Bulatkan total ke Rp100 terdekat
          </label>

          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-ink">Metode pembayaran aktif</legend>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => toggleMethod(method)}
                  aria-pressed={methods.includes(method)}
                  className={
                    'rounded-lg border px-3 py-2 text-sm ' +
                    (methods.includes(method) ? 'border-primary bg-primary-tint text-primary-hover' : 'border-slate-200 text-ink-muted')
                  }
                >
                  {method}
                </button>
              ))}
            </div>
            {errors.paymentMethods ? <p className="mt-1 text-sm text-danger-dark">{errors.paymentMethods.message}</p> : null}
          </fieldset>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              <Save size={16} /> Simpan pengaturan
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader title="Cadangan data" description="Unduh salinan data untuk pemulihan manual" />
          <div className="grid gap-2 p-5">
            <Button variant="secondary" onClick={backup}><Database size={16} /> Unduh backup JSON</Button>
            <Button variant="secondary" onClick={backupCsv}><Database size={16} /> Unduh produk CSV</Button>
            <p className="mt-2 text-sm text-ink-muted">
              Versi ini menyimpan data di <code>localStorage</code> browser. Membersihkan data situs akan mengembalikan data ke kondisi awal.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Catatan keamanan" description="Batasan versi ini" />
          <ul className="grid gap-2 p-5 text-sm text-ink-muted">
            <li>• Password di-hash SHA-256 tanpa salt dan disimpan di browser.</li>
            <li>• Pembatasan peran ditegakkan di sisi antarmuka, belum di server.</li>
            <li>• Sesi berakhir setelah 30 menit tidak aktif.</li>
          </ul>
        </Card>
      </div>

      <Toast message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
