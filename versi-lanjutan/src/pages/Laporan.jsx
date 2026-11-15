import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { buildReport, getSettings, listCategories, listTransactions, listUsers } from '../lib/api';
import { dayKey, downloadFile, money, number, toCSV, todayKey } from '../lib/format';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select } from '../components/ui';

const periods = [
  { id: 'today', label: 'Hari ini' },
  { id: '7d', label: '7 hari terakhir' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'custom', label: 'Rentang tanggal' },
];

function shiftDays(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return dayKey(date);
}

export default function Laporan() {
  const transactionsQuery = useQuery({ queryKey: ['transactions'], queryFn: listTransactions });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const [period, setPeriod] = useState('7d');
  const [from, setFrom] = useState(shiftDays(6));
  const [to, setTo] = useState(todayKey());
  const [cashierId, setCashierId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const range = useMemo(() => {
    if (period === 'today') return { from: todayKey(), to: todayKey() };
    if (period === '7d') return { from: shiftDays(6), to: todayKey() };
    if (period === 'month') {
      const now = new Date();
      return { from: dayKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayKey() };
    }
    return { from, to };
  }, [period, from, to]);

  const invalidRange = Boolean(range.from && range.to && range.from > range.to);

  const report = useMemo(
    () => (invalidRange ? null : buildReport(transactionsQuery.data || [], { ...range, cashierId, categoryId })),
    [transactionsQuery.data, range, cashierId, categoryId, invalidRange],
  );

  const exportCsv = () => {
    if (!report) return;
    const rows = [['Laporan Penjualan Brahamart'], ['Periode', range.from + ' s/d ' + range.to], []];
    rows.push(['Ringkasan']);
    rows.push(['Total penjualan', report.revenue]);
    rows.push(['Jumlah transaksi', report.transactionCount]);
    rows.push(['Rata-rata transaksi', report.average]);
    rows.push(['Item terjual', report.itemCount]);
    rows.push(['Estimasi laba kotor', report.grossProfit]);
    rows.push([]);
    rows.push(['Produk', 'Qty terjual', 'Pendapatan']);
    report.topProducts.forEach((item) => rows.push([item.name, item.quantity, item.revenue]));
    downloadFile(toCSV(rows), `laporan-${range.from}-${range.to}.csv`, 'text/csv;charset=utf-8');
  };

  const exportPdf = () => window.print();

  return (
    <div className="grid gap-4">
      <Card className="grid gap-3 p-4 md:grid-cols-4">
        <Field label="Periode">
          <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
            {periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
        </Field>
        <Field label="Dari tanggal">
          <Input type="date" value={range.from} onChange={(event) => { setPeriod('custom'); setFrom(event.target.value); }} />
        </Field>
        <Field label="Sampai tanggal">
          <Input type="date" value={range.to} onChange={(event) => { setPeriod('custom'); setTo(event.target.value); }} />
        </Field>
        <Field label="Kasir">
          <Select value={cashierId} onChange={(event) => setCashierId(event.target.value)}>
            <option value="">Semua kasir</option>
            {(usersQuery.data || []).map((user) => <option key={user.id} value={user.id}>{user.nama}</option>)}
          </Select>
        </Field>
        <Field label="Kategori" className="md:col-span-2">
          <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Semua kategori</option>
            {(categoriesQuery.data || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </Select>
        </Field>
        <div className="flex items-end gap-2 md:col-span-2 md:justify-end">
          <Button variant="secondary" onClick={exportCsv} disabled={!report}><Download size={16} /> Ekspor CSV</Button>
          <Button variant="secondary" onClick={exportPdf} disabled={!report}><FileText size={16} /> Ekspor PDF</Button>
        </div>
      </Card>

      {invalidRange ? (
        <div className="rounded-card border border-danger/40 bg-danger-tint px-4 py-3 text-sm text-danger-dark">
          Rentang tanggal tidak valid: tanggal awal melewati tanggal akhir.
        </div>
      ) : null}

      {report ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Total penjualan', value: money(report.revenue) },
              { label: 'Jumlah transaksi', value: number(report.transactionCount) },
              { label: 'Rata-rata transaksi', value: money(report.average) },
              { label: 'Item terjual', value: number(report.itemCount) },
              { label: 'Estimasi laba kotor', value: money(report.grossProfit) },
            ].map((card) => (
              <Card key={card.label} className="p-4">
                <p className="text-sm text-ink-muted">{card.label}</p>
                <strong className="mt-1 block font-heading text-xl tnum">{card.value}</strong>
              </Card>
            ))}
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Produk terjual" description={`${report.topProducts.length} produk · hanya transaksi selesai`} />
              {report.topProducts.length === 0 ? (
                <EmptyState icon="📈" title="Tidak ada transaksi" description="Tidak ada transaksi selesai pada periode ini." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-ink-muted">
                        <th className="px-5 py-3 font-medium">Produk</th>
                        <th className="px-3 py-3 text-right font-medium">Qty</th>
                        <th className="px-5 py-3 text-right font-medium">Pendapatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topProducts.map((item) => (
                        <tr key={item.productId} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3 text-ink">{item.name}</td>
                          <td className="px-3 py-3 text-right tnum">{number(item.quantity)}</td>
                          <td className="px-5 py-3 text-right tnum">{money(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Metode pembayaran" description="Komposisi nilai transaksi" />
              <ul className="grid gap-3 p-5">
                {Object.entries(report.byMethod).length === 0 ? (
                  <li className="text-sm text-ink-muted">Belum ada pembayaran tercatat.</li>
                ) : (
                  Object.entries(report.byMethod).map(([method, value]) => {
                    const percent = report.revenue ? Math.round((value / report.revenue) * 100) : 0;
                    return (
                      <li key={method} className="grid gap-1">
                        <div className="flex justify-between text-sm">
                          <span>{method}</span>
                          <span className="tnum">{money(value)} · {percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="border-t border-slate-100 px-5 py-3">
                <p className="text-sm text-ink-muted">
                  PPN {settingsQuery.data?.vatRate ?? 11}% sudah termasuk dalam harga. Hanya transaksi berstatus selesai yang dihitung.
                </p>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Rincian transaksi" description={`${report.transactions.length} transaksi pada periode ini`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-ink-muted">
                    <th className="px-5 py-3 font-medium">Nomor</th>
                    <th className="px-3 py-3 font-medium">Tanggal</th>
                    <th className="px-3 py-3 font-medium">Kasir</th>
                    <th className="px-3 py-3 font-medium">Metode</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3">{transaction.id}</td>
                      <td className="px-3 py-3 text-ink-muted">{dayKey(transaction.createdAt)}</td>
                      <td className="px-3 py-3">{transaction.cashierName}</td>
                      <td className="px-3 py-3"><Badge tone="neutral">{transaction.paymentMethod}</Badge></td>
                      <td className="px-5 py-3 text-right tnum">{money(transaction.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
