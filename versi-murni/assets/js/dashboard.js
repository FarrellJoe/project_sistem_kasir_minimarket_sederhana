(function () {
  'use strict';

  const session = Auth.requireAuth(['admin']);
  if (!session) return;

  const formatMoney = (value) => 'Rp ' + new Intl.NumberFormat('id-ID').format(value);
  const formatDate = (date, options) => new Intl.DateTimeFormat('id-ID', options).format(date);
  const now = new Date();
  const todayLabel = formatDate(now, { day: 'numeric', month: 'short', year: 'numeric' });

  const displayName = session.nama || 'Admin';
  document.getElementById('header-name').textContent = displayName;
  document.getElementById('sidebar-name').textContent = displayName;
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('header-date').textContent =
    formatDate(now, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  document.getElementById('heading-date').textContent = todayLabel;
  document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());

  const numberFormat = new Intl.NumberFormat('id-ID');
  const escapeHTML = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function renderStockAlerts() {
    const list = document.getElementById('dashboard-stock-list');
    const criticalCount = document.getElementById('stock-critical-count');
    const alertText = document.getElementById('stock-alert-text');
    try {
      ProductStore.ensureSeeded();
      const critical = ProductStore.getProducts()
        .filter((product) => product.isActive && product.stock <= product.minStock)
        .sort((a, b) => a.stock - b.stock);
      criticalCount.textContent = critical.length + ' Produk Perlu Tindakan';
      alertText.textContent = critical.length
        ? 'Peringatan aktif saat stok ≤ minimum. Produk dengan stok 0 tidak dapat ditambahkan ke penjualan.'
        : 'Semua produk aktif berada di atas batas stok minimum.';
      list.innerHTML = critical.length
        ? critical.slice(0, 5).map((product) => {
          const status = product.stock <= 0 ? 'out' : 'low';
          const thumb = product.image
            ? '<img src="' + escapeHTML(product.image) + '" alt="">'
            : escapeHTML(product.emoji || '📦');
          return '<li class="stock-item"><span class="product-thumb" aria-hidden="true">' + thumb + '</span>' +
            '<div class="stock-item__info"><strong>' + escapeHTML(product.name) + '</strong><span><b>Sisa: ' +
            numberFormat.format(product.stock) + ' ' + escapeHTML(product.unit || 'unit') + '</b><i>•</i>Batas min: ' +
            numberFormat.format(product.minStock) + '</span></div><span class="stock-badge stock-badge--' + status + '">' +
            (status === 'out' ? 'Habis' : 'Menipis') + '</span></li>';
        }).join('')
        : '<li class="stock-item"><div class="stock-item__info"><strong>Tidak ada stok kritis</strong><span>Persediaan semua produk aktif aman.</span></div></li>';
    } catch (error) {
      console.error('Ringkasan stok dashboard gagal dimuat.', error);
      criticalCount.textContent = 'Data stok tidak tersedia';
      alertText.textContent = 'Periksa penyimpanan browser sebelum menggunakan daftar stok.';
      list.innerHTML = '<li class="stock-item"><div class="stock-item__info"><strong>Data stok gagal dimuat</strong><span>Muat ulang halaman atau periksa penyimpanan browser.</span></div></li>';
    }
  }
  renderStockAlerts();

  function localDateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function offsetDate(date, offset) {
    const result = new Date(date);
    result.setDate(result.getDate() + offset);
    return result;
  }

  function completedTransactions() {
    const stored = DB.read(KEYS.transactions, []);
    return Array.isArray(stored)
      ? stored.filter((transaction) => transaction && transaction.status !== 'dibatalkan')
      : [];
  }

  function transactionsForDate(date) {
    const key = localDateKey(date);
    return completedTransactions().filter((transaction) => {
      const createdAt = new Date(transaction.createdAt);
      return !Number.isNaN(createdAt.getTime()) && localDateKey(createdAt) === key;
    });
  }

  function summarize(transactions) {
    return transactions.reduce((summary, transaction) => {
      const total = Number.isFinite(Number(transaction.total))
        ? Number(transaction.total)
        : Math.max(0, (Number(transaction.subtotal) || 0) - (Number(transaction.discount) || 0));
      summary.sales += total;
      summary.transactions += 1;
      (Array.isArray(transaction.items) ? transaction.items : []).forEach((item) => {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        summary.itemsSold += quantity;
        const cost = Number(item.purchasePrice) || 0;
        summary.grossProfit += (Number(item.price) - cost) * quantity - (Number(item.discount) || 0);
      });
      summary.grossProfit -= Number(transaction.discount) || 0;
      summary.grossProfit -= Number(transaction.rounding) || 0;
      return summary;
    }, { sales: 0, transactions: 0, itemsSold: 0, grossProfit: 0 });
  }

  function getProductSales(transactions) {
    const products = ProductStore.getProducts();
    const categories = ProductStore.getCategories();
    const totals = new Map();
    transactions.forEach((transaction) => {
      const items = Array.isArray(transaction.items) ? transaction.items : [];
      const baseTotal = items.reduce((sum, item) => {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const price = Number(item.price) || 0;
        return sum + (item.subtotal == null
          ? Math.max(0, price * quantity - (Number(item.discount) || 0))
          : Math.max(0, Number(item.subtotal) || 0));
      }, 0);
      const saleTotal = Number.isFinite(Number(transaction.total))
        ? Number(transaction.total)
        : Math.max(0, baseTotal - (Number(transaction.discount) || 0));
      const allocationRate = baseTotal > 0 ? saleTotal / baseTotal : 0;
      items.forEach((item) => {
        const key = item.productId || item.sku || item.name;
        if (!key) return;
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const price = Number(item.price) || 0;
        const lineBase = item.subtotal == null
          ? Math.max(0, price * quantity - (Number(item.discount) || 0))
          : Math.max(0, Number(item.subtotal) || 0);
        const current = totals.get(key) || { quantity: 0, revenue: 0, item };
        current.quantity += quantity;
        current.revenue += lineBase * allocationRate;
        totals.set(key, current);
      });
    });
    return Array.from(totals.entries()).map(([key, total]) => {
      const product = products.find((entry) => entry.id === key || entry.code === key);
      const category = categories.find((entry) =>
        entry.id === (product ? product.categoryId : total.item.categoryId)
      );
      return {
        name: total.item.name || (product && product.name) || 'Produk',
        unit: total.item.unit || (product && product.unit) || 'unit',
        quantity: total.quantity,
        revenue: total.revenue,
        category: category ? category.name : 'Tanpa kategori',
        image: product && product.image,
        emoji: (product && product.emoji) || '📦',
        thumb: (product && product.thumb) || '',
      };
    }).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
  }

  const dateFilter = document.getElementById('date-filter');

  function renderSummary() {
    const date = dateFilter.value === 'today' ? now : offsetDate(now, -1);
    const transactions = transactionsForDate(date);
    const previous = summarize(transactionsForDate(offsetDate(date, -1)));
    const summary = summarize(transactions);
    const average = summary.transactions ? Math.round(summary.sales / summary.transactions) : 0;
    document.getElementById('sales-value').textContent = formatMoney(summary.sales);
    document.getElementById('transaction-value').textContent = numberFormat.format(summary.transactions);
    document.getElementById('average-value').textContent = formatMoney(average);
    document.querySelector('.stat-card__label').textContent =
      dateFilter.value === 'today' ? 'Penjualan Hari Ini' : 'Penjualan Kemarin';
    document.getElementById('items-sold-value').textContent = numberFormat.format(summary.itemsSold);
    document.getElementById('sold-variants-value').textContent = numberFormat.format(getProductSales(transactions).length);
    document.getElementById('gross-profit-value').textContent = formatMoney(summary.grossProfit);
    const change = document.getElementById('sales-change');
    if (!previous.sales) {
      change.textContent = summary.sales ? 'Transaksi baru' : '— dibanding hari sebelumnya';
    } else {
      const percent = ((summary.sales - previous.sales) / previous.sales) * 100;
      change.textContent = (percent >= 0 ? '↗ +' : '↘ ') +
        new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(percent) + '% vs hari sebelumnya';
    }
    renderTopProducts(transactions);
  }

  function renderTopProducts(transactions) {
    const rows = getProductSales(transactions).slice(0, 5);
    document.getElementById('top-products-body').innerHTML = rows.length
      ? rows.map((product, index) => {
        const thumb = product.image
          ? '<img src="' + escapeHTML(product.image) + '" alt="">'
          : escapeHTML(product.emoji);
        const categoryClass = ['purple', 'blue', 'amber'][index % 3];
        return '<tr><td>' + (index + 1) + '</td><td><span class="table-product"><span class="product-thumb ' +
          escapeHTML(product.thumb) + '" aria-hidden="true">' + thumb + '</span>' + escapeHTML(product.name) +
          '</span></td><td><span class="category-pill category-pill--' + categoryClass + '">' +
          escapeHTML(product.category) + '</span></td><td class="number-cell"><strong>' +
          numberFormat.format(product.quantity) + ' ' + escapeHTML(product.unit) +
          '</strong></td><td class="number-cell"><strong>' + formatMoney(product.revenue) +
          '</strong></td></tr>';
      }).join('')
      : '<tr><td colspan="5" class="dashboard-empty-cell">Belum ada transaksi pada tanggal ini.</td></tr>';
  }

  function drawChart(period) {
    const chart = document.getElementById('sales-chart');
    const startOffset = period === 'week' ? -6 : -13;
    const dates = Array.from({ length: 7 }, (_, index) => offsetDate(now, startOffset + index));
    const series = {
      dates,
      values: dates.map((date) => summarize(transactionsForDate(date)).sales),
    };
    const total = series.values.reduce((sum, value) => sum + value, 0);
    const width = Math.max(chart.clientWidth, 300);
    const height = 210;
    const left = 32;
    const right = 10;
    const top = 14;
    const bottom = 32;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const peak = Math.max.apply(null, series.values);
    const magnitude = peak ? Math.pow(10, Math.floor(Math.log10(peak))) : 1000;
    const normalizedPeak = peak / magnitude;
    const maxValue = (normalizedPeak <= 1 ? 1 : normalizedPeak <= 2 ? 2 : normalizedPeak <= 5 ? 5 : 10) * magnitude;
    const gridValues = [maxValue, maxValue * 2 / 3, maxValue / 3, 0];
    const points = series.values.map((value, index) => ({
      x: left + (plotWidth * index) / (series.values.length - 1),
      y: top + plotHeight * (1 - value / maxValue),
      value,
    }));
    const pointString = points.map((point) => point.x + ',' + point.y).join(' ');
    const areaPath = 'M ' + points[0].x + ' ' + (top + plotHeight) + ' L ' +
      points.map((point) => point.x + ' ' + point.y).join(' L ') + ' L ' +
      points[points.length - 1].x + ' ' + (top + plotHeight) + ' Z';
    const grid = gridValues.map((value) => {
      const y = top + plotHeight * (1 - value / maxValue);
      const label = value >= 1000000
        ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value / 1000000) + ' Jt'
        : value >= 1000
          ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value / 1000) + ' rb'
          : numberFormat.format(Math.round(value));
      return '<line class="chart__grid" x1="' + left + '" y1="' + y + '" x2="' + (width - right) + '" y2="' + y + '"></line>' +
        '<text class="chart__axis-label" x="0" y="' + (y + 4) + '">' + label + '</text>';
    }).join('');
    const dayLabels = series.dates.map((date, index) => {
      const lines = [
        formatDate(date, { day: '2-digit' }),
        formatDate(date, { weekday: 'short' }).charAt(0).toUpperCase(),
      ];
      const point = points[index];
      const labelClass = index === points.length - 1 ? 'chart__day-label is-current' : 'chart__day-label';
      return '<text class="' + labelClass + '" x="' + point.x + '" y="' + (height - 13) + '">' +
        '<tspan x="' + point.x + '" dy="0">' + lines[0] + '</tspan>' +
        '<tspan x="' + point.x + '" dy="13">' + lines[1] + '</tspan></text>';
    }).join('');
    const dots = points.map((point, index) =>
      '<circle class="chart__dot" cx="' + point.x + '" cy="' + point.y + '" r="2.7"><title>' +
      formatDate(series.dates[index], { day: 'numeric', month: 'short' }) + ': ' + formatMoney(point.value) +
      '</title></circle>'
    ).join('');
    const currentPoint = points[points.length - 1];
    const tooltipWidth = Math.min(180, Math.max(100, formatMoney(currentPoint.value).length * 6));
    const tooltipX = Math.min(Math.max(currentPoint.x - tooltipWidth + 10, left), width - tooltipWidth);
    const tooltipY = Math.max(currentPoint.y - 44, 2);

    chart.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" aria-hidden="true">' +
      grid +
      '<path class="chart__area" d="' + areaPath + '"></path>' +
      '<polyline class="chart__line" points="' + pointString + '"></polyline>' +
      dots +
      '<g transform="translate(' + tooltipX + ' ' + tooltipY + ')">' +
      '<rect class="chart__tooltip" width="' + tooltipWidth + '" height="34" rx="6"></rect>' +
      '<text class="chart__tooltip-text" x="' + (tooltipWidth / 2) + '" y="13">' +
      formatDate(series.dates[series.dates.length - 1], { day: 'numeric', month: 'short' }) + '</text>' +
      '<text class="chart__tooltip-text" x="' + (tooltipWidth / 2) + '" y="26">' + formatMoney(currentPoint.value) + '</text>' +
      '</g>' + dayLabels + '</svg>';

    document.getElementById('week-total').textContent = formatMoney(total);
    chart.setAttribute('aria-label', 'Grafik penjualan ' +
      (period === 'week' ? 'minggu ini' : 'minggu lalu') + ', total ' + formatMoney(total));
  }

  dateFilter.addEventListener('change', renderSummary);
  const chartFilter = document.getElementById('chart-filter');
  chartFilter.addEventListener('change', () => drawChart(chartFilter.value));
  window.addEventListener('resize', () => drawChart(chartFilter.value));

  const toast = document.getElementById('dashboard-toast');
  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3500);
  }

  document.getElementById('export-btn').addEventListener('click', () => {
    const selectedDate = dateFilter.value === 'today' ? now : offsetDate(now, -1);
    const data = summarize(transactionsForDate(selectedDate));
    const average = data.transactions ? Math.round(data.sales / data.transactions) : 0;
    const rows = [
      ['Ringkasan Penjualan ' + displayName],
      ['Tanggal', formatDate(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' })],
      ['Penjualan', formatMoney(data.sales)],
      ['Jumlah transaksi', data.transactions],
      ['Rata-rata transaksi', formatMoney(average)],
      ['Item terjual', data.itemsSold],
      ['Laba kotor', formatMoney(data.grossProfit)],
    ];
    const csv = '\uFEFF' + rows.map((row) =>
      row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(',')
    ).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ringkasan-brahamart-' + localDateKey(selectedDate) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Ringkasan berhasil diunduh.');
  });

  document.getElementById('stock-action').addEventListener('click', () => {
    window.location.href = 'stok.html';
  });
  renderSummary();
  drawChart(chartFilter.value);
  window.addEventListener('storage', (event) => {
    if ([KEYS.transactions, KEYS.products, KEYS.categories].includes(event.key)) {
      renderStockAlerts();
      renderSummary();
      drawChart(chartFilter.value);
    }
  });

  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menu-toggle');
  const backdrop = document.getElementById('sidebar-backdrop');
  function setMenuOpen(isOpen) {
    sidebar.classList.toggle('is-open', isOpen);
    backdrop.hidden = !isOpen;
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Tutup navigasi' : 'Buka navigasi');
  }
  menuToggle.addEventListener('click', () => setMenuOpen(!sidebar.classList.contains('is-open')));
  backdrop.addEventListener('click', () => setMenuOpen(false));
})();
