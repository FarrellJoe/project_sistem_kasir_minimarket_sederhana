(function () {
  'use strict';

  const session = Auth.requireAuth(['admin']);
  if (!session) return;

  ProductStore.ensureSeeded();

  const PAGE_SIZE = 5;
  const main = document.getElementById('report-main');
  const rangeDialog = document.getElementById('range-dialog');
  const exportDialog = document.getElementById('export-dialog');
  const printReport = document.getElementById('print-report');
  const today = wibDateKey(new Date());
  const defaultRange = rangeForPeriod('7days');
  const state = {
    draft: { period: '7days', startDate: defaultRange.startDate, endDate: defaultRange.endDate, cashierId: '', categoryId: '' },
    applied: { period: '7days', startDate: defaultRange.startDate, endDate: defaultRange.endDate, cashierId: '', categoryId: '' },
    report: null,
    productSearch: '',
    productSort: 'units',
    productPage: 1,
    toastTimer: null,
  };

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const formatMoney = (value) => 'Rp ' + Math.round(number(value)).toLocaleString('id-ID');
  const formatNumber = (value) => Math.round(number(value)).toLocaleString('id-ID');
  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function wibDateKey(value) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(value);
    const part = (type) => parts.find((entry) => entry.type === type).value;
    return part('year') + '-' + part('month') + '-' + part('day');
  }

  function addDays(dateKey, amount) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
  }

  function daysBetween(startDate, endDate) {
    const start = Date.parse(startDate + 'T00:00:00Z');
    const end = Date.parse(endDate + 'T00:00:00Z');
    return Math.max(0, Math.round((end - start) / 86400000)) + 1;
  }

  function dateFromWibKey(value, options) {
    if (!value) return '-';
    const date = new Date(value + 'T12:00:00+07:00');
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', ...options }).format(date);
  }

  function rangeForPeriod(period) {
    if (period === 'today') return { startDate: today, endDate: today };
    if (period === 'month') return { startDate: today.slice(0, 7) + '-01', endDate: today };
    return { startDate: addDays(today, -6), endDate: today };
  }

  function rangeLabel(filters) {
    const start = dateFromWibKey(filters.startDate, { day: '2-digit', month: 'short' });
    const end = dateFromWibKey(filters.endDate, { day: '2-digit', month: 'short', year: 'numeric' });
    return filters.startDate === filters.endDate
      ? dateFromWibKey(filters.startDate, { day: '2-digit', month: 'short', year: 'numeric' })
      : start + ' – ' + end;
  }

  function displayDateTime(value, options) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', ...options }).format(date);
  }

  function methodKey(method) {
    const value = String(method || '').trim().toLowerCase();
    if (value === 'cash' || value === 'tunai') return 'tunai';
    if (value === 'qris') return 'qris';
    if (value === 'debit' || value === 'transfer' || value === 'debit/transfer') return 'debit/transfer';
    return value || 'lainnya';
  }

  function methodLabel(method) {
    const labels = { tunai: 'Tunai', qris: 'QRIS', 'debit/transfer': 'Debit / Transfer' };
    const key = methodKey(method);
    return labels[key] || String(method || 'Lainnya');
  }

  function isCompleted(transaction) {
    return Boolean(transaction) &&
      (transaction.status === 'selesai' || (!transaction.status && !transaction.voidedAt));
  }

  function transactionTotal(transaction) {
    if (transaction.total != null && Number.isFinite(Number(transaction.total))) return number(transaction.total);
    return Math.max(0, number(transaction.subtotal) - number(transaction.discount));
  }

  function getCurrentData() {
    const products = ProductStore.getProducts();
    const categories = ProductStore.getCategories();
    const productById = new Map(products.map((product) => [String(product.id), product]));
    const categoryById = new Map(categories.map((category) => [String(category.id), category]));
    return { products, categories, productById, categoryById };
  }

  function cashierOptions(selectedId) {
    const users = DB.getUsers();
    return (Array.isArray(users) ? users : [])
      .filter((user) => user && (user.role === 'admin' || user.role === 'kasir'))
      .map((user) => `<option value="${escapeHtml(user.id)}" ${String(user.id) === selectedId ? 'selected' : ''}>${escapeHtml(user.nama || user.username || 'Pengguna')}</option>`)
      .join('');
  }

  function categoryOptions(selectedId, categories) {
    return categories.map((category) =>
      `<option value="${escapeHtml(category.id)}" ${String(category.id) === selectedId ? 'selected' : ''}>${escapeHtml(category.name || category.nama_kategori || 'Tanpa kategori')}</option>`
    ).join('');
  }

  function itemCategoryId(item, productById) {
    if (item.categoryId != null) return String(item.categoryId);
    const product = productById.get(String(item.productId));
    return product ? String(product.categoryId) : '';
  }

  function buildReport(filters) {
    const { products, categories, productById, categoryById } = getCurrentData();
    const allTransactions = ProductStore.getTransactions();
    const records = [];
    const productTotals = new Map();
    const paymentTotals = new Map();
    const trendMap = new Map();
    const hourlyMap = new Map();
    let grossRevenue = 0;
    let grossProfit = 0;
    let unitsSold = 0;
    let missingCostLines = 0;

    (Array.isArray(allTransactions) ? allTransactions : []).forEach((transaction) => {
      if (!isCompleted(transaction) || !Array.isArray(transaction.items)) return;
      const transactionDate = new Date(transaction.createdAt);
      const dateKey = Number.isNaN(transactionDate.getTime()) ? '' : wibDateKey(transactionDate);
      if (!dateKey || dateKey < filters.startDate || dateKey > filters.endDate) return;
      if (filters.cashierId && String(transaction.cashierId) !== filters.cashierId) return;

      const items = transaction.items.filter((item) => {
        return item && (!filters.categoryId ||
          itemCategoryId(item, productById) === filters.categoryId);
      });
      if (!items.length) return;

      const validItems = items.map((item) => {
        const product = productById.get(String(item.productId));
        const price = item.price != null && Number.isFinite(Number(item.price))
          ? number(item.price)
          : number(product && product.salePrice);
        const quantity = Number.isFinite(Number(item.quantity)) ? Math.max(0, number(item.quantity)) : 0;
        const lineBase = item.subtotal != null && Number.isFinite(Number(item.subtotal))
          ? Math.max(0, number(item.subtotal))
          : price * quantity;
        const cost = item.purchasePrice != null && Number.isFinite(Number(item.purchasePrice))
          ? number(item.purchasePrice)
          : product && Number.isFinite(Number(product.purchasePrice))
            ? number(product.purchasePrice)
            : null;
        const categoryId = itemCategoryId(item, productById);
        return { item, product, price, quantity, lineBase, cost, categoryId };
      }).filter((entry) => entry.quantity > 0);
      if (!validItems.length) return;

      const allItems = transaction.items.map((item) => {
        const product = productById.get(String(item.productId));
        const price = item.price != null && Number.isFinite(Number(item.price))
          ? number(item.price)
          : number(product && product.salePrice);
        const quantity = Number.isFinite(Number(item.quantity)) ? Math.max(0, number(item.quantity)) : 0;
        const lineBase = item.subtotal != null && Number.isFinite(Number(item.subtotal))
          ? Math.max(0, number(item.subtotal))
          : price * quantity;
        return { lineBase };
      });
      const baseTotal = allItems.reduce((sum, item) => sum + item.lineBase, 0);
      const saleTotal = transactionTotal(transaction);
      const allocationRate = baseTotal > 0 ? saleTotal / baseTotal : 0;
      const recordItems = validItems.map((entry) => {
        const revenue = entry.lineBase * allocationRate;
        const costAmount = entry.cost == null ? null : entry.cost * entry.quantity;
        const profit = costAmount == null ? null : revenue - costAmount;
        return { ...entry, revenue, costAmount, profit };
      });
      const revenue = recordItems.reduce((sum, item) => sum + item.revenue, 0);
      const profitItems = recordItems.filter((item) => item.profit != null);
      const profit = profitItems.reduce((sum, item) => sum + item.profit, 0);
      const record = {
        transaction,
        dateKey,
        items: recordItems,
        revenue,
        profit,
        units: recordItems.reduce((sum, item) => sum + item.quantity, 0),
        missingCostLines: recordItems.filter((item) => item.profit == null).length,
      };
      records.push(record);
      grossRevenue += revenue;
      grossProfit += profit;
      unitsSold += record.units;
      missingCostLines += record.missingCostLines;
      recordItems.forEach((entry) => {
        const productId = String(entry.item.productId || entry.item.sku || entry.item.name);
        const productKey = productId || 'unknown';
        const row = productTotals.get(productKey) || {
          id: productKey,
          name: entry.item.name || (entry.product && entry.product.name) || 'Produk',
          sku: entry.item.sku || (entry.product && entry.product.code) || '-',
          categoryId: entry.categoryId,
          emoji: (entry.product && entry.product.emoji) || '📦',
          unit: entry.item.unit || (entry.product && entry.product.unit) || 'unit',
          units: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          missingCostLines: 0,
          weightedPrice: 0,
          stock: entry.product ? entry.product.stock : null,
          minStock: entry.product ? entry.product.minStock : null,
        };
        row.units += entry.quantity;
        row.revenue += entry.revenue;
        row.weightedPrice += entry.price * entry.quantity;
        if (entry.costAmount == null) row.missingCostLines += 1;
        else {
          row.cost += entry.costAmount;
          row.profit += entry.profit;
        }
        productTotals.set(productKey, row);
      });
      const key = methodKey(transaction.paymentMethod);
      const payment = paymentTotals.get(key) || { key, label: methodLabel(key), revenue: 0, count: 0 };
      payment.revenue += revenue;
      payment.count += 1;
      paymentTotals.set(key, payment);
      const dayTotal = trendMap.get(dateKey) || 0;
      trendMap.set(dateKey, dayTotal + revenue);
      const hour = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta', hour: '2-digit', hourCycle: 'h23',
      }).format(transactionDate);
      const hourKey = dateKey + '-' + hour;
      hourlyMap.set(hourKey, (hourlyMap.get(hourKey) || 0) + revenue);
    });

    const productRows = Array.from(productTotals.values()).map((row) => ({
      ...row,
      averagePrice: row.units ? row.weightedPrice / row.units : 0,
      contribution: grossRevenue ? row.revenue / grossRevenue * 100 : 0,
      categoryName: categoryById.get(String(row.categoryId))?.name ||
        categoryById.get(String(row.categoryId))?.nama_kategori || 'Tanpa kategori',
    }));
    const paymentRows = Array.from(paymentTotals.values()).sort((a, b) => b.revenue - a.revenue);
    const completedDays = Math.max(1, daysBetween(filters.startDate, filters.endDate));
    const report = {
      filters: { ...filters },
      records,
      products,
      categories,
      productRows,
      paymentRows,
      trendMap,
      revenue: grossRevenue,
      transactionCount: records.length,
      average: records.length ? grossRevenue / records.length : 0,
      unitsSold,
      grossProfit,
      missingCostLines,
      productCount: productRows.length,
      dailyAverage: grossRevenue / completedDays,
      trend: buildTrend(filters, trendMap, hourlyMap),
    };
    return report;
  }

  function buildTrend(filters, trendMap, hourlyMap) {
    const totalDays = daysBetween(filters.startDate, filters.endDate);
    if (totalDays === 1) {
      return Array.from({ length: 24 }, (_, hour) => {
        const key = String(hour).padStart(2, '0');
        return { label: key, value: hourlyMap.get(filters.startDate + '-' + key) || 0, hour };
      });
    }

    const step = totalDays > 90 ? 'month' : totalDays > 31 ? 'week' : 'day';
    const buckets = new Map();
    for (let offset = 0; offset < totalDays; offset += 1) {
      const day = addDays(filters.startDate, offset);
      let key = day;
      if (step === 'week') key = addDays(filters.startDate, Math.floor(offset / 7) * 7);
      if (step === 'month') key = day.slice(0, 7);
      buckets.set(key, (buckets.get(key) || 0) + (trendMap.get(day) || 0));
    }
    return Array.from(buckets.entries()).map(([key, value]) => ({
      label: step === 'month'
        ? dateFromWibKey(key + '-01', { month: 'short', year: '2-digit' })
        : dateFromWibKey(key, { day: '2-digit', month: 'short' }),
      value,
      key,
    }));
  }

  function periodTabsMarkup() {
    const periods = [
      ['today', 'Hari Ini'],
      ['7days', '7 Hari Terakhir'],
      ['month', 'Bulan Ini'],
      ['custom', 'Rentang Tanggal'],
    ];
    return periods.map(([period, label]) =>
      `<button type="button" class="${state.draft.period === period ? 'is-active' : ''}" data-action="period" data-period="${period}" aria-pressed="${state.draft.period === period}">${label}</button>`
    ).join('');
  }

  function filterMarkup() {
    const { categories } = getCurrentData();
    return `
      <section class="product-panel report-filter-panel" aria-label="Filter laporan">
        <form id="report-filter-form">
          <div class="report-filter-top">
            <div class="report-period-tabs" role="group" aria-label="Periode laporan">${periodTabsMarkup()}</div>
            <button class="report-range-trigger" id="range-trigger" type="button" data-action="open-range">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
              <span>${escapeHtml(rangeLabel(state.draft))}</span>
              <span aria-hidden="true">⌄</span>
            </button>
          </div>
          <div class="report-filter-bottom">
            <label class="report-field">Kasir
              <select name="cashierId"><option value="">Semua kasir</option>${cashierOptions(state.draft.cashierId)}</select>
            </label>
            <label class="report-field">Kategori
              <select name="categoryId"><option value="">Semua kategori</option>${categoryOptions(state.draft.categoryId, categories)}</select>
            </label>
            <div class="report-filter-actions">
              <span class="report-filter-status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>Hanya transaksi selesai yang dihitung.</span>
              <button class="text-link" type="button" data-action="reset-report">Reset</button>
              <button class="btn btn--primary" type="submit">Terapkan filter</button>
            </div>
          </div>
        </form>
      </section>`;
  }

  function headingMarkup(report) {
    const disabled = report.transactionCount === 0 ? 'disabled aria-disabled="true"' : '';
    return `
      <section class="report-content__heading">
        <div><h1>Laporan Penjualan &amp; Analitik</h1><p>Analisis performa penjualan, metode transaksi, dan tren produk terlaris toko.</p></div>
        <div class="report-heading-actions">
          <button class="btn btn--secondary" type="button" data-action="open-export" data-format="csv" ${disabled}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M4 16v4h16v-4"/></svg>Ekspor CSV
          </button>
          <button class="btn btn--primary" type="button" data-action="open-export" data-format="pdf" ${disabled}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M4 16v4h16v-4"/></svg>Ekspor PDF
          </button>
        </div>
      </section>`;
  }

  function statsMarkup(report) {
    const noData = report.transactionCount === 0;
    const dailyTransactions = report.transactionCount / Math.max(1, daysBetween(report.filters.startDate, report.filters.endDate));
    const dailyTransactionsLabel = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })
      .format(dailyTransactions);
    return `
      <section class="report-stats" aria-label="Ringkasan laporan">
        <article class="report-stat"><span>Total Penjualan</span><strong>${formatMoney(report.revenue)}</strong><small>${noData ? 'Belum ada data' : 'Periode terpilih'}</small></article>
        <article class="report-stat report-stat--count"><span>Jumlah Transaksi</span><strong>${formatNumber(report.transactionCount)} struk</strong><small>${noData ? 'Belum ada data' : dailyTransactionsLabel + ' transaksi / hari'}</small></article>
        <article class="report-stat report-stat--average"><span>Rata-rata Transaksi</span><strong>${formatMoney(report.average)}</strong><small>${noData ? 'Belum ada data' : 'Nilai rata-rata per struk'}</small></article>
        <article class="report-stat report-stat--items"><span>Item Terjual</span><strong>${formatNumber(report.unitsSold)} item</strong><small>${noData ? 'Belum ada data' : report.productCount + ' SKU terjual'}</small></article>
        <article class="report-stat report-stat--profit"><span>Estimasi Laba Kotor</span><strong>${formatMoney(report.grossProfit)}</strong><small>${report.missingCostLines ? 'Sebagian harga modal tidak tersedia' : noData ? 'Belum ada data' : 'Dari harga jual dan harga beli'}</small></article>
      </section>`;
  }

  function trendMarkup(report) {
    const heading = report.filters.period === 'today' ? 'Tren Penjualan Hari Ini' :
      report.filters.period === 'month' ? 'Tren Penjualan Bulan Ini' :
        report.filters.period === 'custom' ? 'Tren Penjualan Periode Terpilih' : 'Tren Penjualan 7 Hari Terakhir';
    return `
      <article class="report-card report-trend-card">
        <div class="report-card__heading"><div><h2>${heading}</h2><p>Omzet harian • ${escapeHtml(rangeLabel(report.filters))}</p></div></div>
        <div class="report-chart-legend"><span><i class="report-legend-dot"></i>Omzet aktual</span></div>
        <div class="report-chart" id="report-chart" role="img" aria-label="Grafik tren penjualan"></div>
        <div class="report-chart__summary"><span>Total periode</span><strong>${formatMoney(report.revenue)}</strong><span>Rata-rata harian</span><strong>${formatMoney(report.dailyAverage)}</strong></div>
      </article>`;
  }

  function paymentClass(key) {
    if (key === 'tunai') return 'is-cash';
    if (key === 'qris') return 'is-qris';
    if (key === 'debit/transfer') return 'is-transfer';
    return 'is-other';
  }

  function paymentMarkup(report) {
    const payments = report.paymentRows;
    if (!payments.length) {
      return `<article class="report-card report-payment-card"><div class="report-card__heading"><div><h2>Metode Pembayaran</h2><p>Rekap transaksi selesai pada periode ini</p></div></div><p class="report-payment-empty">Belum ada transaksi pada periode ini.</p></article>`;
    }
    const bar = payments.map((payment) => {
      const share = report.revenue ? payment.revenue / report.revenue * 100 : 0;
      return `<span class="${paymentClass(payment.key)}" style="width:${Math.max(share, 1)}%" title="${escapeHtml(payment.label)}: ${formatMoney(payment.revenue)}"></span>`;
    }).join('');
    const rows = payments.map((payment) => {
      const share = report.revenue ? payment.revenue / report.revenue * 100 : 0;
      return `<li>
        <span class="report-payment-name"><i class="${paymentClass(payment.key)}"></i>${escapeHtml(payment.label)}</span>
        <span class="report-payment-value">${formatMoney(payment.revenue)}</span>
        <span class="report-payment-meta"><span>${formatNumber(payment.count)} transaksi</span><span>${share.toFixed(1).replace('.', ',')}%</span></span>
      </li>`;
    }).join('');
    return `
      <article class="report-card report-payment-card">
        <div class="report-card__heading"><div><h2>Metode Pembayaran</h2><p>Rekap transaksi selesai pada periode ini</p></div></div>
        <div class="report-payment-total"><span>Total masuk</span><strong>${formatMoney(report.revenue)}</strong></div>
        <div class="report-payment-bar" aria-hidden="true">${bar}</div>
        <ul class="report-payment-list">${rows}</ul>
      </article>`;
  }

  function chartLabel(value) {
    const abs = Math.abs(value);
    if (abs >= 1000000) return 'Rp ' + (value / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
    if (abs >= 1000) return 'Rp ' + (value / 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' rb';
    return 'Rp ' + formatNumber(value);
  }

  function drawChart(report) {
    const container = document.getElementById('report-chart');
    if (!container) return;
    const values = report.trend.map((entry) => entry.value);
    const peak = Math.max(0, ...values);
    const maxValue = peak > 0 ? Math.ceil(peak / Math.pow(10, Math.floor(Math.log10(peak)) - 1)) * Math.pow(10, Math.floor(Math.log10(peak)) - 1) : 1000;
    const chartWidth = Math.max(container.clientWidth, 320);
    const chartHeight = 240;
    const left = 64;
    const right = 12;
    const top = 14;
    const bottom = 32;
    const plotWidth = chartWidth - left - right;
    const plotHeight = chartHeight - top - bottom;
    const points = report.trend.map((entry, index) => ({
      x: report.trend.length > 1 ? left + plotWidth * index / (report.trend.length - 1) : left + plotWidth / 2,
      y: top + plotHeight * (1 - entry.value / maxValue),
      value: entry.value,
      label: entry.label,
    }));
    const areaPath = points.length
      ? 'M ' + points[0].x + ' ' + (top + plotHeight) + ' L ' +
        points.map((point) => point.x + ' ' + point.y).join(' L ') + ' L ' +
        points[points.length - 1].x + ' ' + (top + plotHeight) + ' Z'
      : '';
    const grid = [0, 1, 2, 3].map((step) => {
      const y = top + plotHeight * step / 3;
      const value = maxValue * (1 - step / 3);
      return `<line class="report-chart__grid" x1="${left}" y1="${y}" x2="${chartWidth - right}" y2="${y}"></line><text class="report-chart__axis-label" x="0" y="${y + 3}">${escapeHtml(chartLabel(value))}</text>`;
    }).join('');
    const pointsText = points.map((point) =>
      `<circle class="report-chart__dot" cx="${point.x}" cy="${point.y}" r="3"><title>${escapeHtml(point.label)}: ${formatMoney(point.value)}</title></circle>`
    ).join('');
    const maxLabels = Math.min(points.length, 7);
    const labels = Array.from({ length: maxLabels }, (_, index) => {
      const pointIndex = maxLabels === 1 ? 0 : Math.round(index * (points.length - 1) / (maxLabels - 1));
      const point = points[pointIndex];
      return `<text class="report-chart__x-label" x="${point.x}" y="${chartHeight - 8}">${escapeHtml(point.label)}</text>`;
    }).join('');
    const line = points.map((point) => point.x + ',' + point.y).join(' ');
    container.innerHTML = `<svg viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none" aria-hidden="true">${grid}<path class="report-chart__area" d="${areaPath}"></path><polyline class="report-chart__line" points="${line}"></polyline>${pointsText}${labels}</svg>`;
    container.setAttribute('aria-label', `Grafik tren penjualan periode ${rangeLabel(report.filters)}, total ${formatMoney(report.revenue)}`);
  }

  function sortProducts(rows) {
    const sorted = rows.slice();
    sorted.sort((a, b) => {
      if (state.productSort === 'revenue') return b.revenue - a.revenue;
      if (state.productSort === 'profit') return b.profit - a.profit;
      return b.units - a.units;
    });
    const query = state.productSearch.trim().toLowerCase();
    return query ? sorted.filter((row) =>
      String(row.name).toLowerCase().includes(query) ||
      String(row.sku).toLowerCase().includes(query)
    ) : sorted;
  }

  function stockMarkup(product) {
    if (product.stock == null || !Number.isFinite(Number(product.stock))) {
      return '<span class="report-stock-badge report-stock-badge--unknown">Tidak tersedia</span>';
    }
    if (Number(product.stock) <= 0) return '<span class="report-stock-badge report-stock-badge--out">Habis (0)</span>';
    if (Number(product.stock) <= number(product.minStock)) {
      return `<span class="report-stock-badge report-stock-badge--low">Menipis (${formatNumber(product.stock)})</span>`;
    }
    return `<span class="report-stock-badge">Aman (${formatNumber(product.stock)})</span>`;
  }

  function productTableMarkup(report) {
    const rows = sortProducts(report.productRows);
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    state.productPage = Math.min(state.productPage, pages);
    const start = (state.productPage - 1) * PAGE_SIZE;
    const shown = rows.slice(start, start + PAGE_SIZE);
    const top = report.productRows.slice().sort((a, b) => b.units - a.units)[0];
    const topText = top ? `Produk terlaris: ${escapeHtml(top.name)} • ${formatNumber(top.units)} ${escapeHtml(top.unit)}` : '';
    const body = shown.length ? shown.map((product, index) => `
      <tr>
        <td>${String(start + index + 1).padStart(2, '0')}</td>
        <td><span class="report-product-name"><span class="report-product-thumb" aria-hidden="true">${escapeHtml(product.emoji || '📦')}</span><span class="report-product-copy"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku)}</small></span></span></td>
        <td><span class="report-product-category">${escapeHtml(product.categoryName)}</span></td>
        <td class="numeric">${formatNumber(product.units)} ${escapeHtml(product.unit)}</td>
        <td class="numeric">${formatMoney(product.averagePrice)}</td>
        <td class="numeric report-product-revenue">${formatMoney(product.revenue)}</td>
        <td class="numeric report-contribution">${product.contribution.toFixed(1).replace('.', ',')}%</td>
        <td>${stockMarkup(product)}</td>
      </tr>`).join('') : `<tr><td class="report-no-products" colspan="8">${report.productRows.length ? 'Produk tidak ditemukan. Coba kata kunci lain.' : 'Belum ada produk terjual pada periode ini.'}</td></tr>`;
    return `
      <section class="report-card report-products-panel" aria-labelledby="report-products-heading">
        <div class="report-card__heading">
          <div class="report-products-heading-copy"><h2 id="report-products-heading">Produk Terjual (Terlaris &amp; Performa)</h2><p>Performa produk dan kontribusi terhadap omzet periode ini</p></div>
        </div>
        <div class="report-product-controls">
          <label class="report-product-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg>
            <span class="visually-hidden">Cari SKU atau nama produk</span>
            <input id="report-product-search" type="search" value="${escapeHtml(state.productSearch)}" placeholder="Cari SKU atau nama produk...">
          </label>
          <span class="report-top-product">${topText}</span>
          <label class="report-product-sort">Urutkan
            <select id="report-product-sort">
              <option value="units" ${state.productSort === 'units' ? 'selected' : ''}>Unit terjual</option>
              <option value="revenue" ${state.productSort === 'revenue' ? 'selected' : ''}>Total penjualan</option>
              <option value="profit" ${state.productSort === 'profit' ? 'selected' : ''}>Laba kotor</option>
            </select>
          </label>
        </div>
        <div class="report-product-table-wrap">
          <table class="report-product-table">
            <thead><tr><th>No</th><th>Produk / SKU</th><th>Kategori</th><th>Terjual</th><th>Harga satuan</th><th>Total penjualan</th><th>Kontribusi</th><th>Status stok</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        <footer class="report-products-footer">
          <span>${rows.length ? `Menampilkan ${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} dari ${rows.length} produk` : 'Tidak ada produk untuk ditampilkan'}</span>
          <span class="report-pagination">
            <button type="button" data-action="product-page" data-page="${state.productPage - 1}" ${state.productPage <= 1 ? 'disabled' : ''} aria-label="Halaman produk sebelumnya">‹</button>
            ${Array.from({ length: pages }, (_, index) => `<button type="button" class="${state.productPage === index + 1 ? 'is-current' : ''}" data-action="product-page" data-page="${index + 1}" ${state.productPage === index + 1 ? 'aria-current="page"' : ''}>${index + 1}</button>`).join('')}
            <button type="button" data-action="product-page" data-page="${state.productPage + 1}" ${state.productPage >= pages ? 'disabled' : ''} aria-label="Halaman produk berikutnya">›</button>
          </span>
        </footer>
      </section>`;
  }

  function emptyMarkup(report) {
    return `
      <section class="product-panel report-empty-panel">
        <span class="report-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 12h8m-8 4h8"/></svg></span>
        <h2>Tidak ada transaksi</h2>
        <p>Belum ada transaksi selesai pada periode ${escapeHtml(rangeLabel(report.filters))}. Coba pilih periode lain atau reset filter laporan.</p>
        <button class="btn btn--primary" type="button" data-action="reset-report">Reset filter</button>
      </section>`;
  }

  function footerMarkup(report) {
    const updated = displayDateTime(new Date(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const costNote = report.missingCostLines
      ? `<span><strong>Catatan laba:</strong> ${report.missingCostLines} item tidak memiliki harga modal yang dapat dipastikan.</span>`
      : '';
    return `<footer class="report-footer-note"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>Laporan hanya mencakup transaksi selesai. Transaksi dibatalkan tidak dihitung.</span>${costNote}<span>Terakhir diperbarui: ${escapeHtml(updated)} WIB</span></footer>`;
  }

  function render() {
    state.report = buildReport(state.applied);
    const report = state.report;
    const noData = report.transactionCount === 0;
    main.innerHTML = `
      ${headingMarkup(report)}
      ${filterMarkup()}
      ${statsMarkup(report)}
      ${noData ? emptyMarkup(report) : `
        <section class="report-analytics-grid" aria-label="Analitik penjualan">
          ${trendMarkup(report)}
          ${paymentMarkup(report)}
        </section>
        ${productTableMarkup(report)}
      `}
      ${footerMarkup(report)}`;
    if (!noData) drawChart(report);
    bindMainEvents();
    updateExportSummary();
  }

  function bindMainEvents() {
    const form = document.getElementById('report-filter-form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      state.draft.cashierId = String(data.get('cashierId') || '');
      state.draft.categoryId = String(data.get('categoryId') || '');
      state.applied = { ...state.draft };
      state.productPage = 1;
      render();
      showToast('Laporan berhasil diperbarui.');
    });
    const search = document.getElementById('report-product-search');
    if (search) search.addEventListener('input', () => {
      state.productSearch = search.value;
      state.productPage = 1;
      const table = document.querySelector('.report-products-panel');
      if (table) {
        const report = state.report;
        table.outerHTML = productTableMarkup(report);
        bindProductEvents();
      }
    });
    bindProductEvents();
  }

  function bindProductEvents() {
    const sort = document.getElementById('report-product-sort');
    if (sort) sort.addEventListener('change', () => {
      state.productSort = sort.value;
      state.productPage = 1;
      const panel = document.querySelector('.report-products-panel');
      panel.outerHTML = productTableMarkup(state.report);
      bindProductEvents();
    });
  }

  function updateDraftPeriod(period) {
    const form = document.getElementById('report-filter-form');
    if (form) {
      state.draft.cashierId = String(form.elements.cashierId.value || '');
      state.draft.categoryId = String(form.elements.categoryId.value || '');
    }
    state.draft.period = period;
    if (period !== 'custom') {
      const range = rangeForPeriod(period);
      state.draft.startDate = range.startDate;
      state.draft.endDate = range.endDate;
    }
    render();
  }

  function openRangeDialog() {
    const start = document.getElementById('range-start');
    const end = document.getElementById('range-end');
    start.value = state.draft.startDate || state.applied.startDate;
    end.value = state.draft.endDate || state.applied.endDate;
    document.getElementById('range-error').hidden = true;
    document.getElementById('range-error').textContent = '';
    rangeDialog.showModal();
  }

  function resetReport() {
    const range = rangeForPeriod('7days');
    state.draft = { period: '7days', ...range, cashierId: '', categoryId: '' };
    state.applied = { ...state.draft };
    state.productSearch = '';
    state.productSort = 'units';
    state.productPage = 1;
    render();
  }

  function showToast(message, isError) {
    const toast = document.getElementById('report-toast');
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.toggle('is-error', Boolean(isError));
    if (state.toastTimer) window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4000);
  }

  function updateExportSummary() {
    const report = state.report;
    if (!report) return;
    document.getElementById('export-summary').innerHTML = `
      <div><span>Periode</span><strong>${escapeHtml(rangeLabel(report.filters))}</strong></div>
      <div><span>Filter</span><strong>${escapeHtml(selectedCashierName(report.filters.cashierId))} • ${escapeHtml(selectedCategoryName(report.filters.categoryId))}</strong></div>
      <div><span>Data laporan</span><strong>${formatNumber(report.transactionCount)} transaksi selesai • ${formatNumber(report.productCount)} produk</strong></div>`;
  }

  function selectedCashierName(id) {
    if (!id) return 'Semua kasir';
    const user = DB.getUsers().find((entry) => String(entry.id) === id);
    return user ? (user.nama || user.username) : 'Kasir terpilih';
  }

  function selectedCategoryName(id) {
    if (!id) return 'Semua kategori';
    const category = ProductStore.getCategories().find((entry) => String(entry.id) === id);
    return category ? (category.name || category.nama_kategori) : 'Kategori terpilih';
  }

  function openExport(format) {
    document.querySelectorAll('input[name="format"]').forEach((radio) => {
      radio.checked = radio.value === format;
    });
    document.querySelectorAll('input[name="sections"]').forEach((checkbox) => {
      checkbox.checked = true;
    });
    document.getElementById('export-error').hidden = true;
    document.getElementById('export-submit').textContent = format === 'pdf' ? 'Unduh PDF' : 'Unduh CSV';
    updateExportSummary();
    exportDialog.showModal();
  }

  function csvCell(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    let text = String(value == null ? '' : value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function downloadCsv(report, sections) {
    const rows = [
      ['Laporan Penjualan Brahamart'],
      ['Periode', rangeLabel(report.filters)],
      ['Kasir', selectedCashierName(report.filters.cashierId)],
      ['Kategori', selectedCategoryName(report.filters.categoryId)],
      ['Hanya transaksi selesai', 'Ya'],
      [],
    ];
    if (sections.includes('summary')) {
      rows.push(['Ringkasan']);
      rows.push(['Total penjualan', Math.round(report.revenue)]);
      rows.push(['Jumlah transaksi', report.transactionCount]);
      rows.push(['Rata-rata transaksi', Math.round(report.average)]);
      rows.push(['Item terjual', report.unitsSold]);
      rows.push(['Estimasi laba kotor', Math.round(report.grossProfit)]);
      rows.push([]);
      rows.push(['Tren penjualan']);
      rows.push(['Tanggal / periode', 'Penjualan']);
      report.trend.forEach((entry) => rows.push([entry.label, Math.round(entry.value)]));
      rows.push([]);
    }
    if (sections.includes('products')) {
      rows.push(['Produk Terjual']);
      rows.push(['Produk', 'SKU', 'Kategori', 'Qty', 'Harga rata-rata', 'Penjualan', 'Laba kotor']);
      report.productRows.slice().sort((a, b) => b.units - a.units).forEach((product) => {
        rows.push([product.name, product.sku, product.categoryName, product.units,
          Math.round(product.averagePrice), Math.round(product.revenue), Math.round(product.profit)]);
      });
      rows.push([]);
    }
    if (sections.includes('payments')) {
      rows.push(['Metode Pembayaran']);
      rows.push(['Metode', 'Jumlah transaksi', 'Penjualan']);
      report.paymentRows.forEach((payment) => rows.push([payment.label, payment.count, Math.round(payment.revenue)]));
    }
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'laporan-brahamart-' + report.filters.startDate + '-sampai-' + report.filters.endDate + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printTable(headers, rows) {
    return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function buildPrintReport(report, sections) {
    const filterLabel = selectedCashierName(report.filters.cashierId) + ' • ' + selectedCategoryName(report.filters.categoryId);
    let content = `<h1>Laporan Penjualan &amp; Analitik</h1><p>Brahamart · Periode ${escapeHtml(rangeLabel(report.filters))}</p><p>Filter: ${escapeHtml(filterLabel)} · Hanya transaksi selesai</p>`;
    if (sections.includes('summary')) {
      content += `<div class="print-summary-grid">
        <div><span>Total penjualan</span><strong>${formatMoney(report.revenue)}</strong></div>
        <div><span>Jumlah transaksi</span><strong>${formatNumber(report.transactionCount)} struk</strong></div>
        <div><span>Rata-rata transaksi</span><strong>${formatMoney(report.average)}</strong></div>
        <div><span>Item terjual</span><strong>${formatNumber(report.unitsSold)} item</strong></div>
        <div><span>Estimasi laba kotor</span><strong>${formatMoney(report.grossProfit)}</strong></div>
      </div>`;
      const chart = document.querySelector('#report-chart svg');
      if (chart) content += `<h2>Tren Penjualan</h2>${chart.outerHTML}`;
    }
    if (sections.includes('products')) {
      content += '<h2>Produk Terjual</h2>' + printTable(
        ['Produk', 'SKU', 'Kategori', 'Qty', 'Harga rata-rata', 'Penjualan', 'Laba kotor'],
        report.productRows.slice().sort((a, b) => b.units - a.units).map((product) => [
          product.name, product.sku, product.categoryName, formatNumber(product.units),
          formatMoney(product.averagePrice), formatMoney(product.revenue), formatMoney(product.profit),
        ])
      );
    }
    if (sections.includes('payments')) {
      content += '<h2>Metode Pembayaran</h2>' + printTable(
        ['Metode', 'Jumlah transaksi', 'Penjualan'],
        report.paymentRows.map((payment) => [payment.label, formatNumber(payment.count), formatMoney(payment.revenue)])
      );
    }
    content += `<p style="margin-top:18pt;color:#475569">Transaksi dibatalkan tidak disertakan · Dicetak ${escapeHtml(displayDateTime(new Date(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }))} WIB</p>`;
    printReport.innerHTML = content;
  }

  function submitExport(event) {
    event.preventDefault();
    const format = new FormData(event.currentTarget).get('format');
    const sections = Array.from(document.querySelectorAll('input[name="sections"]:checked')).map((checkbox) => checkbox.value);
    const error = document.getElementById('export-error');
    if (!sections.length) {
      error.textContent = 'Pilih setidaknya satu bagian laporan untuk diekspor.';
      error.hidden = false;
      return;
    }
    try {
      if (format === 'pdf') {
        buildPrintReport(state.report, sections);
        exportDialog.close();
        window.print();
        showToast('Dialog cetak PDF dibuka. Pilih “Simpan sebagai PDF” untuk mengunduh.');
      } else {
        downloadCsv(state.report, sections);
        exportDialog.close();
        showToast('Laporan CSV berhasil diunduh.');
      }
    } catch (failure) {
      console.error('Ekspor laporan gagal.', failure);
      error.textContent = 'Ekspor gagal. Periksa penyimpanan atau izin unduhan browser, lalu coba lagi.';
      error.hidden = false;
    }
  }

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    switch (action.dataset.action) {
      case 'open-range':
        openRangeDialog();
        break;
      case 'close-range':
        rangeDialog.close();
        break;
      case 'close-export':
        exportDialog.close();
        break;
      case 'open-export':
        openExport(action.dataset.format === 'pdf' ? 'pdf' : 'csv');
        break;
      case 'reset-report':
        resetReport();
        break;
      case 'product-page':
        state.productPage = Number(action.dataset.page) || 1;
        const panel = document.querySelector('.report-products-panel');
        if (panel) {
          panel.outerHTML = productTableMarkup(state.report);
          bindProductEvents();
        }
        break;
      case 'period':
        updateDraftPeriod(action.dataset.period);
        if (action.dataset.period === 'custom') openRangeDialog();
        break;
      default:
        break;
    }
  });

  document.getElementById('range-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const startDate = document.getElementById('range-start').value;
    const endDate = document.getElementById('range-end').value;
    const error = document.getElementById('range-error');
    const startField = document.getElementById('range-start');
    const endField = document.getElementById('range-end');
    const invalid = !startDate || !endDate || startDate > endDate;
    startField.setAttribute('aria-invalid', String(invalid && (!startDate || startDate > endDate)));
    endField.setAttribute('aria-invalid', String(invalid && (!endDate || startDate > endDate)));
    if (invalid) {
      error.textContent = 'Tanggal mulai harus sebelum atau sama dengan tanggal akhir.';
      error.hidden = false;
      return;
    }
    state.draft.period = 'custom';
    state.draft.startDate = startDate;
    state.draft.endDate = endDate;
    rangeDialog.close();
    render();
  });

  document.getElementById('export-form').addEventListener('submit', submitExport);
  document.querySelectorAll('input[name="format"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      document.getElementById('export-submit').textContent = radio.value === 'pdf' ? 'Unduh PDF' : 'Unduh CSV';
      document.getElementById('export-error').hidden = true;
    });
  });
  document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());
  document.getElementById('menu-toggle').addEventListener('click', () => {
    const sidebar = document.getElementById('products-sidebar');
    const isOpen = sidebar.classList.toggle('is-open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', String(isOpen));
    document.getElementById('products-backdrop').hidden = !isOpen;
  });
  document.getElementById('products-backdrop').addEventListener('click', () => {
    document.getElementById('products-sidebar').classList.remove('is-open');
    document.getElementById('products-backdrop').hidden = true;
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
  });
  window.addEventListener('resize', () => {
    if (state.report && state.report.transactionCount) drawChart(state.report);
  });

  const name = session.nama || session.username || 'Admin';
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'AD';
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('header-name').textContent = name;
  document.getElementById('current-date').textContent = displayDateTime(new Date(), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }) + ' WIB';

  render();
}());
