import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Barcode, Printer, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { commitSale, getSettings, listProducts, listTransactions } from '../lib/api';
import { dayKey, money, todayKey } from '../lib/format';
import { useCartStore, useSessionStore } from '../stores';
import { Button, Card, CardHeader, Dialog, EmptyState, Field, Input, Select, Toast, cn } from '../components/ui';

const discountSchema = z.object({
  type: z.enum(['nominal', 'percent']),
  value: z.coerce.number().min(0, 'Diskon tidak boleh negatif.'),
});

export default function Kasir() {
  const session = useSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const transactionsQuery = useQuery({ queryKey: ['transactions'], queryFn: listTransactions });

  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clear);
  const discount = useCartStore((state) => state.discount);
  const setDiscount = useCartStore((state) => state.setDiscount);
  const totals = useCartStore((state) => state.totals());

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [method, setMethod] = useState('Tunai');
  const [cash, setCash] = useState('');
  const [toast, setToast] = useState(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [receiptSize, setReceiptSize] = useState(null);
  const searchRef = useRef(null);

  const settings = settingsQuery.data;
  const products = useMemo(
    () => (productsQuery.data || []).filter((product) => product.isActive),
    [productsQuery.data],
  );

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = normalized
      ? products.filter((product) =>
          product.name.toLowerCase().includes(normalized) ||
          product.code.toLowerCase().includes(normalized) ||
          String(product.barcode || '').includes(normalized))
      : [];
    return list.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)).slice(0, 8);
  }, [products, query]);

  const todayReceipts = (transactionsQuery.data || [])
    .filter((transaction) => transaction.status !== 'dibatalkan' && dayKey(transaction.createdAt) === todayKey())
    .length;

  const quickProducts = useMemo(() => {
    const available = products.filter((product) => Number(product.stock) > 0);
    const preferred = ['plastic', 'tea', 'bread', 'lighter']
      .map((id) => available.find((product) => product.id === id))
      .filter(Boolean);
    const rest = available.filter((product) => !preferred.includes(product));
    return [...preferred, ...rest].slice(0, 4);
  }, [products]);

  const paperSize = receiptSize || settings?.receiptPaperSize || '80';
  const total = settings?.roundTo100 ? Math.round(totals.total / 100) * 100 : totals.total;
  const cashValue = Number(String(cash).replace(/\D/g, '')) || 0;
  const change = Math.max(0, cashValue - total);

  const notify = (message, tone = 'success') => {
    setToast({ message, tone });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3200);
  };

  const add = (product) => {
    const result = addItem(product);
    if (!result.ok) {
      notify(result.code === 'empty' ? product.name + ' sedang habis.' : 'Stok ' + product.name + ' tidak mencukupi.', 'error');
      return;
    }
    setQuery('');
    setSearchOpen(false);
    searchRef.current?.focus();
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;
    const exact = products.find((product) => String(product.barcode) === normalized || product.code.toLowerCase() === normalized);
    if (exact) {
      add(exact);
      return;
    }
    if (results.length === 0) notify('Produk tidak ditemukan. Periksa nama atau barcode.', 'error');
    setSearchOpen(true);
  };

  const saleMutation = useMutation({
    mutationFn: (payload) => commitSale(payload, session),
    onSuccess: (transaction) => {
      setReceipt(transaction);
      clearCart();
      setCash('');
      setPaymentOpen(false);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stockMovements'] });
    },
    onError: (error) => notify(error.message || 'Transaksi gagal disimpan.', 'error'),
  });

  const finishPayment = () => {
    if (items.length === 0) return;
    if (method === 'Tunai' && cashValue < total) {
      notify('Uang diterima kurang ' + money(total - cashValue) + '.', 'error');
      return;
    }
    saleMutation.mutate({
      items: items.map((item) => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        price: item.price,
        quantity: item.quantity,
      })),
      paymentMethod: method,
      received: method === 'Tunai' ? cashValue : total,
      totals: {
        subtotal: totals.total,
        grossSubtotal: totals.grossSubtotal,
        itemDiscount: 0,
        discount: totals.discountAmount,
        discountType: discount.type,
        discountValue: Number(discount.value || 0),
        total,
      },
    });
  };

  const discountForm = useForm({
    resolver: zodResolver(discountSchema),
    defaultValues: { type: discount.type, value: discount.value },
  });

  const applyDiscount = (values) => {
    const amount = values.type === 'percent'
      ? Math.round((totals.grossSubtotal * Number(values.value)) / 100)
      : Number(values.value);
    if (amount > totals.grossSubtotal) {
      discountForm.setError('value', { message: 'Diskon melebihi subtotal.' });
      return;
    }
    setDiscount({ type: values.type, value: Number(values.value) });
    setDiscountOpen(false);
    notify(values.value > 0 ? 'Diskon diterapkan.' : 'Diskon dihapus.');
  };

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'F1') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === 'F4') {
        event.preventDefault();
        setDiscountOpen(true);
      } else if (event.key === 'F9') {
        event.preventDefault();
        if (items.length) {
          clearCart();
          notify('Transaksi dibatalkan.');
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [items.length, clearCart]);

  const now = new Date();
  const shift = now.getHours() < 12 ? 'Shift Pagi' : now.getHours() < 18 ? 'Shift Siang' : 'Shift Malam';

  return (
    <div className="grid gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="font-heading text-lg font-semibold text-ink">Terminal Kasir 01</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {shift} · Kasir ID: <span className="font-medium text-ink">{session?.staffCode || '-'}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Lokal · siap transaksi
          </span>
          <span>Struk hari ini: <strong className="text-ink tnum">{todayReceipts}</strong></span>
          <span>Sesi tidak aktif: <strong className="text-ink">30 menit</strong></span>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <div className="grid gap-4">
        <Card className="relative p-4">
          <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(Boolean(event.target.value.trim()));
                }}
                placeholder="Scan barcode atau ketik nama produk… (F1)"
                className="pl-10 pr-14"
                aria-label="Cari produk"
              />
              <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 px-1.5 py-0.5 text-sm text-ink-muted sm:block">F1</kbd>
            </div>
            <Button type="submit" className="shrink-0">
              <Barcode size={18} /> Tambah
            </Button>
          </form>

          {searchOpen && results.length ? (
            <ul className="absolute left-4 right-4 top-[calc(100%-4px)] z-20 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-card">
              {results.map((product) => {
                const soldOut = Number(product.stock) <= 0;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => (soldOut ? notify(product.name + ' sedang habis.', 'error') : add(product))}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
                        soldOut ? 'cursor-not-allowed opacity-70' : 'hover:bg-primary-tint',
                      )}
                    >
                      <span aria-hidden="true">{product.emoji || '📦'}</span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-ink">{product.name}</strong>
                        <span className="text-sm text-ink-muted">
                          {product.code} ·{' '}
                          {soldOut ? <b className="text-danger-dark">Stok habis</b> : `Stok ${product.stock} ${product.unit}`}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-primary tnum">{money(product.salePrice)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="Daftar barang belanja"
            description={`${totals.itemCount} item di keranjang`}
            action={
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setDiscountOpen(true)}>Diskon (F4)</Button>
                <Button variant="outlineDanger" size="sm" onClick={() => { clearCart(); notify('Transaksi dibatalkan.'); }} disabled={!items.length}>
                  Batal (F9)
                </Button>
              </div>
            }
          />
          {items.length === 0 ? (
            <EmptyState icon="🛒" title="Keranjang masih kosong" description="Scan barcode atau cari produk untuk memulai transaksi." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-ink-muted">
                    <th className="px-5 py-3 font-medium">Produk</th>
                    <th className="px-3 py-3 font-medium">Jumlah</th>
                    <th className="px-3 py-3 text-right font-medium">Subtotal</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.productId} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3">
                        <strong className="block text-ink">{item.emoji} {item.name}</strong>
                        <span className="text-sm text-ink-muted">{item.sku} · {money(item.price)} / {item.unit}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="inline-flex items-center rounded-lg border border-slate-200">
                          <button type="button" className="px-2.5 py-1 text-lg text-ink-muted hover:text-ink" onClick={() => setQuantity(item.productId, item.quantity - 1)} aria-label={`Kurangi ${item.name}`}>−</button>
                          <span className="min-w-8 text-center text-sm tnum" aria-label="Jumlah">{item.quantity}</span>
                          <button type="button" className="px-2.5 py-1 text-lg text-ink-muted hover:text-ink" onClick={() => setQuantity(item.productId, item.quantity + 1)} aria-label={`Tambah ${item.name}`}>+</button>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-ink tnum">{money(item.price * item.quantity)}</td>
                      <td className="px-5 py-3 text-right">
                        <button type="button" onClick={() => removeItem(item.productId)} className="text-ink-muted hover:text-danger" aria-label={`Hapus ${item.name}`}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Produk cepat kasir" description="Klik untuk menambah instan" />
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
            {quickProducts.length === 0 ? (
              <p className="col-span-full text-sm text-ink-muted">Belum ada produk tersedia.</p>
            ) : (
              quickProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => add(product)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary-tint"
                >
                  <strong className="block truncate text-sm text-ink">{product.emoji} {product.name}</strong>
                  <span className="text-sm font-semibold text-primary tnum">{money(product.salePrice)}</span>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader title="Ringkasan pembayaran" description={`ID ${session?.staffCode || ''}`} />
        <div className="grid flex-1 gap-4 p-5">
          <div>
            <p className="text-sm text-ink-muted">Metode pembayaran</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(settings?.paymentMethods || ['Tunai']).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMethod(option)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm',
                    method === option ? 'border-primary bg-primary-tint text-primary-hover' : 'border-slate-200 text-ink-muted hover:border-primary/40',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tnum">{money(totals.grossSubtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Diskon</dt><dd className="tnum">{money(totals.discountAmount)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">PPN {settings?.vatRate ?? 11}%</dt><dd className="text-ink-muted">Sudah termasuk</dd></div>
          </dl>

          <div className="rounded-lg bg-primary px-4 py-3 text-white">
            <span className="text-sm text-indigo-100">Total bayar</span>
            <strong className="block font-heading text-3xl font-bold tnum">{money(total)}</strong>
          </div>

          {method === 'Tunai' ? (
            <Field label="Uang diterima">
              <Input
                inputMode="numeric"
                value={cash}
                onChange={(event) => setCash(event.target.value.replace(/\D/g, ''))}
                placeholder="0"
              />
            </Field>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-muted">
              Pembayaran non-tunai dicatat setelah dikonfirmasi kasir.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {[total, 20000, 50000, 100000].filter((value, index, list) => value > 0 && list.indexOf(value) === index).map((value) => (
              <Button key={value} variant="secondary" size="sm" onClick={() => setCash(String(value))}>
                {value === total ? 'Uang pas' : money(value)}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-ink-muted">Kembalian</span>
            <strong className="text-lg text-emerald-600 tnum">{money(change)}</strong>
          </div>

          <Button size="lg" className="mt-auto w-full" disabled={!items.length || saleMutation.isPending} onClick={() => setPaymentOpen(true)}>
            <ShoppingCart size={18} /> {saleMutation.isPending ? 'Menyimpan…' : 'Proses pembayaran'}
          </Button>
        </div>
      </Card>
      </div>

      <Dialog
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        title="Diskon transaksi"
        description="Diskon di atas 10% memerlukan persetujuan Admin sesuai ketentuan bisnis."
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => { setDiscount({ type: 'nominal', value: 0 }); setDiscountOpen(false); }}>Hapus diskon</Button>
            <Button type="submit" form="discount-form">Terapkan</Button>
          </>
        }
      >
        <form id="discount-form" onSubmit={discountForm.handleSubmit(applyDiscount)} className="grid gap-3">
          <Field label="Jenis diskon" error={discountForm.formState.errors.type?.message}>
            <Select {...discountForm.register('type')}>
              <option value="nominal">Nominal (Rp)</option>
              <option value="percent">Persentase (%)</option>
            </Select>
          </Field>
          <Field label="Nilai diskon" error={discountForm.formState.errors.value?.message}>
            <Input type="number" min="0" step="1" {...discountForm.register('value')} />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Konfirmasi pembayaran"
        description={`${totals.itemCount} item · ${method}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>Batal</Button>
            <Button onClick={finishPayment} disabled={saleMutation.isPending}>
              {saleMutation.isPending ? 'Menyimpan…' : 'Bayar & simpan'}
            </Button>
          </>
        }
      >
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between"><dt className="text-ink-muted">Total tagihan</dt><dd className="font-semibold tnum">{money(total)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-muted">Uang diterima</dt><dd className="tnum">{money(method === 'Tunai' ? cashValue : total)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-muted">Kembalian</dt><dd className="font-semibold text-emerald-600 tnum">{money(method === 'Tunai' ? change : 0)}</dd></div>
        </dl>
      </Dialog>

      <Dialog
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title="Transaksi berhasil"
        description={receipt ? receipt.id : ''}
        className="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceipt(null)}>Transaksi baru</Button>
            <Button onClick={() => window.print()}><Printer size={16} /> Cetak struk</Button>
          </>
        }
      >
        <div className="no-print mb-3 flex items-center gap-2">
          <span className="text-sm text-ink-muted">Ukuran kertas</span>
          {['58', '80'].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setReceiptSize(size)}
              aria-pressed={paperSize === size}
              className={
                'rounded-lg border px-3 py-1.5 text-sm ' +
                (paperSize === size
                  ? 'border-primary bg-primary-tint text-primary-hover'
                  : 'border-slate-200 text-ink-muted hover:border-primary/40')
              }
            >
              {size} mm
            </button>
          ))}
        </div>
        {receipt ? (
          <div
            className="print-area receipt-paper rounded-lg border border-dashed border-slate-300 p-4 text-sm"
            data-size={paperSize}
          >
            <div className="text-center">
              <strong className="block font-heading text-base">{settings?.storeName || 'Brahamart'}</strong>
              <span className="text-ink-muted">{receipt.id}</span>
              <span className="block text-ink-muted">{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(receipt.createdAt))}</span>
              <span className="block text-ink-muted">Kasir: {receipt.cashierName}</span>
            </div>
            <ul className="mt-3 grid gap-1 border-y border-dashed border-slate-300 py-2">
              {receipt.items.map((item) => (
                <li key={item.productId} className="flex justify-between gap-2">
                  <span>{item.quantity}× {item.name}</span>
                  <span className="tnum">{money(item.subtotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 grid gap-1">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tnum">{money(receipt.grossSubtotal)}</dd></div>
              <div className="flex justify-between"><dt>Diskon</dt><dd className="tnum">{money(receipt.discount)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tnum">{money(receipt.total)}</dd></div>
              <div className="flex justify-between"><dt>{receipt.paymentMethod}</dt><dd className="tnum">{money(receipt.received)}</dd></div>
              <div className="flex justify-between"><dt>Kembalian</dt><dd className="tnum">{money(receipt.change)}</dd></div>
            </dl>
            <p className="mt-2 text-center text-ink-muted">PPN {settings?.vatRate ?? 11}% sudah termasuk dalam harga</p>
            <p className="mt-1 text-center text-ink-muted">{settings?.receiptFooter || 'Terima kasih telah berbelanja'}</p>
            <div className="receipt-barcode" aria-hidden="true" />
            <span className="block text-center text-sm text-ink-muted tnum">{receipt.id}</span>
          </div>
        ) : null}
      </Dialog>

      <Toast message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
