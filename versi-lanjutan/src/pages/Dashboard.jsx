import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, Receipt, ShoppingBag, TrendingUp } from 'lucide-react';
import { getSettings, listProducts, listTransactions } from '../lib/api';
import { dayKey, money, number, todayKey } from '../lib/format';
import { Badge, Card, CardHeader, EmptyState } from '../components/ui';

const LOWER_LIMIT = 5;
const LOWER_PRICE = 9000;

function StatCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-muted">{label}</p>
          <strong className="mt-1 block font-heading text-2xl font-semibold text-ink tnum">{value}</strong>
          <p className="mt-1 text-sm text-ink-muted">{hint}</p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-lg ${tone}`} aria-hidden="true">
          <Icon size={20} />
        </span>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const products = useQuery({ queryKey: ['products'], queryFn: listProducts });
  const transactions = useQuery({ queryKey: ['transactions'], queryFn: listTransactions });
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const data = useMemo(() => {
    const today = todayKey();
    const txs = (transactions.data || []).filter((tx) => tx.status !== 'dibatalkan');
    const todayTx = txs.filter((tx) => dayKey(tx.createdAt) === today);
    const revenue = todayTx.reduce((sum, tx) => sum + Number(tx.total || 0), 0);
    const items = todayTx.reduce((sum, tx) => sum + Number(tx.itemCount || 0), 0);
    const profit = todayTx.reduce((sum, tx) =>
      sum + (tx.items || []).reduce((inner, item) =>
        inner + (Number(item.price) - Number(item.purchasePrice || 0)) * Number(item.quantity || 0), 0), 0);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = dayKey(date);
      const total = txs.filter((tx) => dayKey(tx.createdAt) === key)
        .reduce((sum, tx) => sum + Number(tx.total || 0), 0);
      return {
        key,
        label: new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(date),
        total,
      };
    });

    const productSales = new Map();
    txs.forEach((tx) => (tx.items || []).forEach((item) => {
      const entry = productSales.get(item.productId) || { name: item.name, quantity: 0 };
      entry.quantity += Number(item.quantity || 0);
      productSales.set(item.productId, entry);
    }));

    const lowStock = (products.data || [])
      .filter((product) => product.isActive && Number(product.stock) <= Number(product.minStock))
      .sort((a, b) => Number(a.stock) - Number(b.stock));

    return {
      revenue,
      transactionCount: todayTx.length,
      items,
      profit,
      average: todayTx.length ? Math.round(revenue / todayTx.length) : 0,
      days,
      maxDay: Math.max(1, ...days.map((day) => day.total)),
      top: Array.from(productSales.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      lowStock,
    };
  }, [products.data, transactions.data]);

  const loading = products.isLoading || transactions.isLoading;

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendingUp} label="Penjualan hari ini" value={money(data.revenue)} hint={`Rata-rata ${money(data.average)} / struk`} tone="bg-primary-tint text-primary-hover" />
        <StatCard icon={Receipt} label="Jumlah transaksi" value={number(data.transactionCount)} hint="Transaksi selesai hari ini" tone="bg-sky-50 text-info" />
        <StatCard icon={ShoppingBag} label="Item terjual" value={number(data.items)} hint="Total kuantitas barang" tone="bg-amber-50 text-amber-600" />
        <StatCard icon={Package} label="Laba kotor" value={money(data.profit)} hint={`PPN ${settings.data?.vatRate ?? 11}% sudah termasuk`} tone="bg-emerald-50 text-emerald-600" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader title="Tren penjualan 7 hari" description="Total nilai transaksi selesai per hari" />
          <div className="px-5 py-4">
            {loading ? (
              <p className="text-sm text-ink-muted">Memuat data…</p>
            ) : (
              <div className="flex h-48 items-end gap-3">
                {data.days.map((day) => (
                  <div key={day.key} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-lg bg-primary/80 transition-all hover:bg-primary"
                        style={{ height: `${Math.max(4, (day.total / data.maxDay) * 100)}%` }}
                        title={money(day.total)}
                      />
                    </div>
                    <span className="text-sm text-ink-muted">{day.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Stok perlu perhatian" description="Stok ≤ batas minimum" />
          <div className="divide-y divide-slate-100">
            {data.lowStock.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-muted">Semua stok dalam kondisi aman.</p>
            ) : (
              data.lowStock.slice(0, LOWER_LIMIT).map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm text-ink">{product.emoji} {product.name}</strong>
                    <span className="text-sm text-ink-muted">{product.code}</span>
                  </div>
                  <Badge tone={Number(product.stock) <= 0 ? 'danger' : 'warning'}>
                    {Number(product.stock) <= 0 ? 'Habis' : `${product.stock} ${product.unit}`}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Produk terlaris"
          description="Berdasarkan kuantitas terjual"
          action={<Link to="/laporan" className="text-sm font-medium text-primary hover:underline">Lihat laporan</Link>}
        />
        {data.top.length === 0 ? (
          <EmptyState icon="📊" title="Belum ada penjualan" description="Grafik akan terisi setelah transaksi pertama tersimpan." />
        ) : (
          <ol className="divide-y divide-slate-100">
            {data.top.map((item, index) => (
              <li key={item.name} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-tint text-sm font-semibold text-primary-hover">
                  {index + 1}
                </span>
                <strong className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.name}</strong>
                <span className="text-sm text-ink-muted">{number(item.quantity)} terjual</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {data.lowStock.some((product) => Number(product.stock) <= 0) ? (
        <div className="flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>Ada produk dengan stok habis. Produk tetap muncul di pencarian kasir dengan label &ldquo;Stok habis&rdquo; dan tidak dapat ditambahkan ke keranjang.</p>
        </div>
      ) : null}
    </div>
  );
}
