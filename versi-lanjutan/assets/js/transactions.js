(function () {
  'use strict';

  const session = Auth.requireAuth(['admin', 'kasir']);
  if (!session) return;

  ProductStore.ensureSeeded();

  const PAGE_SIZE = 8;
  const main = document.getElementById('transaction-main');
  const reasonDialog = document.getElementById('void-reason-dialog');
  const confirmDialog = document.getElementById('void-confirm-dialog');
  const receiptDialog = document.getElementById('receipt-dialog');
  const state = {
    search: '',
    date: '',
    cashierId: '',
    paymentMethod: '',
    sort: 'newest',
    page: 1,
    pendingTransactionId: '',
    pendingReason: '',
    receiptSize: SettingsStore.get().receiptPaperSize,
    toastTimer: null,
    voiding: false,
  };

  const formatCurrency = (value) => 'Rp ' + Math.max(0, number(value)).toLocaleString('id-ID');
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const normalizePaymentMethod = (method) => {
    const value = String(method || '').trim().toLowerCase();
    if (value === 'cash' || value === 'tunai') return 'tunai';
    if (value === 'debit' || value === 'transfer' || value === 'debit/transfer') return 'debit/transfer';
    return value;
  };
  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function paymentLabel(method) {
    const labels = { cash: 'Tunai', tunai: 'Tunai', qris: 'QRIS', debit: 'Debit/Transfer', transfer: 'Debit/Transfer', 'debit/transfer': 'Debit/Transfer' };
    const normalized = String(method || '').toLowerCase();
    return labels[normalized] || (method ? String(method) : 'Tidak diketahui');
  }

  function transactionDate(value, options) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', options).format(date);
  }

  function localDateValue(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function transactions() {
    const all = ProductStore.getTransactions();
    if (session.role !== 'kasir') return all;
    return all.filter((transaction) => String(transaction.cashierId) === String(session.userId));
  }

  function isCancelled(transaction) {
    return transaction.status === 'dibatalkan' || Boolean(transaction.voidedAt);
  }

  function transactionTotal(transaction) {
    if (Number.isFinite(Number(transaction.total))) return number(transaction.total);
    return Math.max(0, number(transaction.subtotal) - number(transaction.discount));
  }

  function itemsOf(transaction) {
    return Array.isArray(transaction.items) ? transaction.items : [];
  }

  function itemCount(transaction) {
    return itemsOf(transaction).reduce((sum, item) => sum + Math.max(0, number(item.quantity)), 0);
  }

  function updateHeader() {
    const name = session.nama || session.username || 'Pengguna';
    const isAdmin = session.role === 'admin';
    const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'BR';
    document.getElementById('sidebar-avatar').textContent = initials;
    document.getElementById('user-avatar').textContent = initials;
    document.getElementById('sidebar-name').textContent = name;
    document.getElementById('header-name').textContent = name;
    document.getElementById('sidebar-role').textContent = isAdmin ? 'Administrator' : 'Kasir';
    document.getElementById('role-badge').textContent = isAdmin ? 'Admin' : 'Kasir';
    document.getElementById('current-date').textContent = transactionDate(new Date(), {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    document.querySelectorAll('[data-admin-only]').forEach((element) => {
      element.hidden = !isAdmin;
    });
    if (!isAdmin) {
      document.querySelector('.products-sidebar__hint strong').textContent = 'Riwayat Kasir';
      document.querySelector('.products-sidebar__hint span').textContent = 'Hanya transaksi yang Anda proses yang ditampilkan.';
    }
  }

  function visibleTransactions() {
    return transactions();
  }

  function filteredTransactions() {
    const query = state.search.trim().toLowerCase();
    const selectedDate = state.date;
    const rows = visibleTransactions().filter((transaction) => {
      const cashierName = transaction.cashierName || '';
      const matchesQuery = !query ||
        String(transaction.id || '').toLowerCase().includes(query) ||
        String(cashierName).toLowerCase().includes(query) ||
        itemsOf(transaction).some((item) => String(item.name || '').toLowerCase().includes(query));
      const matchesDate = !selectedDate || localDateValue(transaction.createdAt) === selectedDate;
      const matchesCashier = session.role !== 'admin' || !state.cashierId ||
        String(transaction.cashierId) === state.cashierId;
      const matchesMethod = !state.paymentMethod ||
        normalizePaymentMethod(transaction.paymentMethod) === state.paymentMethod;
      return matchesQuery && matchesDate && matchesCashier && matchesMethod;
    });
    rows.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return state.sort === 'oldest' ? timeA - timeB : timeB - timeA;
    });
    return rows;
  }

  function statsMarkup(rows) {
    const completed = rows.filter((transaction) => !isCancelled(transaction));
    const cancelled = rows.filter(isCancelled);
    const revenue = completed.reduce((sum, transaction) => sum + transactionTotal(transaction), 0);
    const voidedAmount = cancelled.reduce((sum, transaction) => sum + transactionTotal(transaction), 0);
    return `
      <section class="transaction-stats" aria-label="Ringkasan transaksi terfilter">
        <article class="transaction-stat">
          <span class="transaction-stat__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8m-8 4h8m-8 4h5"/></svg></span>
          <span class="transaction-stat__body"><span>Total transaksi</span><strong>${rows.length}</strong><small>${completed.length} selesai · ${cancelled.length} dibatalkan</small></span>
        </article>
        <article class="transaction-stat transaction-stat--amount">
          <span class="transaction-stat__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 7h18v13H3z"/><path d="M3 10h18m-5 5h2M7 4h13"/></svg></span>
          <span class="transaction-stat__body"><span>Total penjualan bersih</span><strong>${formatCurrency(revenue)}</strong><small>Transaksi selesai</small></span>
        </article>
        <article class="transaction-stat transaction-stat--void">
          <span class="transaction-stat__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg></span>
          <span class="transaction-stat__body"><span>Transaksi dibatalkan</span><strong>${cancelled.length}</strong><small>Nilai dikecualikan ${formatCurrency(voidedAmount)}</small></span>
        </article>
      </section>`;
  }

  function cashierOptions() {
    if (session.role !== 'admin') return '';
    const users = DB.getUsers();
    const entries = Array.isArray(users) ? users : [];
    return entries
      .filter((user) => user.role === 'admin' || user.role === 'kasir')
      .map((user) => `<option value="${escapeHtml(user.id)}" ${String(user.id) === state.cashierId ? 'selected' : ''}>${escapeHtml(user.nama || user.username)}</option>`)
      .join('');
  }

  function filterMarkup() {
    const cashierFilter = session.role === 'admin'
      ? `<label class="transaction-field">Kasir
          <select name="cashierId"><option value="">Semua kasir</option>${cashierOptions()}</select>
        </label>`
      : `<label class="transaction-field">Kasir
          <input type="text" value="${escapeHtml(session.nama || session.username)}" readonly aria-label="Kasir yang sedang masuk">
        </label>`;
    return `
      <section class="product-panel transaction-filter-panel" aria-labelledby="transaction-filter-heading">
        <div class="product-panel__heading"><h2 id="transaction-filter-heading">Filter Riwayat</h2><span class="product-panel__count">${state.date ? 'Tanggal ' + transactionDate(state.date + 'T12:00:00', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Semua periode'}</span></div>
        <form id="transaction-filter-form">
          <div class="transaction-filters">
            <label class="transaction-field">Cari transaksi
              <input type="search" name="search" value="${escapeHtml(state.search)}" placeholder="Nomor transaksi atau nama produk">
            </label>
            <label class="transaction-field">Tanggal
              <input type="date" name="date" value="${escapeHtml(state.date)}">
            </label>
            ${cashierFilter}
            <label class="transaction-field">Metode pembayaran
              <select name="paymentMethod">
                <option value="">Semua metode</option>
                <option value="tunai" ${state.paymentMethod === 'tunai' ? 'selected' : ''}>Tunai</option>
                <option value="qris" ${state.paymentMethod === 'qris' ? 'selected' : ''}>QRIS</option>
                <option value="debit/transfer" ${state.paymentMethod === 'debit/transfer' ? 'selected' : ''}>Debit/Transfer</option>
              </select>
            </label>
          </div>
          <div class="transaction-filter-footer">
            <span>Riwayat ditampilkan sesuai hak akses akun.</span>
            <div class="transaction-filter-actions">
              <button class="text-link" type="button" data-action="reset-filters">Reset filter</button>
              <button class="btn btn--primary" type="submit">Terapkan Filter</button>
            </div>
          </div>
        </form>
      </section>`;
  }

  function rowMarkup(transaction) {
    const cancelled = isCancelled(transaction);
    const status = cancelled
      ? '<span class="transaction-status transaction-status--void">Dibatalkan</span>'
      : '<span class="transaction-status">Selesai</span>';
    return `<tr>
      <td><span class="transaction-id-cell"><strong>${escapeHtml(transaction.id || 'Tanpa nomor')}</strong><small>${itemsOf(transaction).length} jenis produk · ${itemCount(transaction)} item</small></span></td>
      <td><span class="transaction-date-cell"><span>${transactionDate(transaction.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</span><small>${transactionDate(transaction.createdAt, { hour: '2-digit', minute: '2-digit', hour12: false })} WIB</small></span></td>
      ${session.role === 'admin' ? `<td><span class="transaction-cashier-cell"><strong>${escapeHtml(transaction.cashierName || 'Kasir')}</strong><small>${escapeHtml(transaction.cashierId || '-')}</small></span></td>` : ''}
      <td class="transaction-payment-cell">${escapeHtml(paymentLabel(transaction.paymentMethod))}</td>
      <td class="transaction-amount-cell">${formatCurrency(transactionTotal(transaction))}</td>
      <td>${status}</td>
      <td><button class="transaction-row-action" type="button" data-action="open-detail" data-id="${escapeHtml(transaction.id)}">Detail</button></td>
    </tr>`;
  }

  function listMarkup(rows) {
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);
    const empty = rows.length === 0;
    const colSpan = session.role === 'admin' ? 7 : 6;
    const tableRows = empty
      ? `<tr><td colspan="${colSpan}">
          <div class="empty-state transaction-empty">
            <span class="transaction-empty__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8m-8 4h8m-8 4h5"/></svg></span>
            <strong>${visibleTransactions().length ? 'Transaksi tidak ditemukan' : 'Belum ada transaksi'}</strong>
            <span>${visibleTransactions().length ? 'Coba ubah kata kunci atau filter yang digunakan.' : 'Transaksi yang selesai dibayar akan muncul di halaman ini.'}</span>
            ${visibleTransactions().length ? '<button class="btn btn--secondary" type="button" data-action="reset-filters">Hapus filter</button>' : ''}
          </div>
        </td></tr>`
      : pageRows.map(rowMarkup).join('');
    const columns = session.role === 'admin'
      ? '<th>Nomor transaksi</th><th>Tanggal &amp; waktu</th><th>Kasir</th><th>Pembayaran</th><th>Total</th><th>Status</th><th>Aksi</th>'
      : '<th>Nomor transaksi</th><th>Tanggal &amp; waktu</th><th>Pembayaran</th><th>Total</th><th>Status</th><th>Aksi</th>';
    return `
      <section class="product-panel transaction-list-panel" aria-labelledby="transaction-list-heading">
        <div class="product-panel__heading">
          <h2 id="transaction-list-heading">${session.role === 'admin' ? 'Semua Transaksi' : 'Transaksi Saya'}</h2>
          <label class="transaction-sort">Urutkan
            <select id="transaction-sort">
              <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Terbaru</option>
              <option value="oldest" ${state.sort === 'oldest' ? 'selected' : ''}>Terlama</option>
            </select>
          </label>
        </div>
        <div class="product-table-wrap">
          <table class="product-table transaction-table">
            <thead><tr>${columns}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <footer class="product-pagination">
          <span class="transaction-pagination-note">${empty ? 'Tidak ada transaksi untuk ditampilkan' : `Menampilkan ${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} dari ${rows.length} transaksi`}</span>
          <span class="pagination-controls">
            <button type="button" data-action="page" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya">‹</button>
            <button class="is-current" type="button" aria-current="page">${state.page} / ${pages}</button>
            <button type="button" data-action="page" data-page="${state.page + 1}" ${state.page >= pages ? 'disabled' : ''} aria-label="Halaman berikutnya">›</button>
          </span>
        </footer>
      </section>`;
  }

  function renderList() {
    const rows = filteredTransactions();
    const label = session.role === 'admin'
      ? 'Pantau transaksi penjualan, telusuri detail pembayaran, dan cetak ulang struk.'
      : 'Lihat transaksi yang Anda proses dan cetak ulang struk pembayaran.';
    main.innerHTML = `
      <div class="product-page-heading transaction-page-heading">
        <div><h1>Riwayat Transaksi</h1><p>${label}</p></div>
        <span class="transaction-role-note">${session.role === 'admin' ? 'Admin · Semua transaksi' : 'Kasir · Transaksi pribadi'}</span>
      </div>
      ${statsMarkup(rows)}
      ${filterMarkup()}
      ${listMarkup(rows)}`;
    bindListEvents();
  }

  function bindListEvents() {
    const form = document.getElementById('transaction-filter-form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      state.search = String(data.get('search') || '').trim();
      state.date = String(data.get('date') || '');
      state.cashierId = session.role === 'admin' ? String(data.get('cashierId') || '') : '';
      state.paymentMethod = String(data.get('paymentMethod') || '');
      state.page = 1;
      renderList();
    });
    document.getElementById('transaction-sort').addEventListener('change', (event) => {
      state.sort = event.target.value;
      state.page = 1;
      renderList();
    });
  }

  function totalQuantity(transaction) {
    return itemCount(transaction);
  }

  function detailItemsMarkup(transaction) {
    return itemsOf(transaction).map((item) => {
      const quantity = number(item.quantity);
      const price = number(item.price);
      const lineTotal = item.subtotal == null
        ? Math.max(0, price * quantity - number(item.discount))
        : number(item.subtotal);
      return `<tr>
        <td><span class="transaction-item-name"><strong>${escapeHtml(item.name || 'Produk')}</strong><small>${escapeHtml(item.sku || item.productId || '-')}</small></span></td>
        <td class="numeric">${formatCurrency(price)}</td>
        <td class="numeric">${quantity} ${escapeHtml(item.unit || 'pcs')}</td>
        <td>${item.discount ? `Diskon ${formatCurrency(item.discount)}<br>` : ''}${formatCurrency(lineTotal)}</td>
      </tr>`;
    }).join('');
  }

  function detailMarkup(transaction) {
    const cancelled = isCancelled(transaction);
    const total = transactionTotal(transaction);
    const grossSubtotal = transaction.grossSubtotal == null
      ? number(transaction.subtotal) + number(transaction.itemDiscount)
      : number(transaction.grossSubtotal);
    const payment = paymentLabel(transaction.paymentMethod);
    const paid = transaction.received == null ? total : number(transaction.received);
    const change = transaction.change == null ? Math.max(0, paid - total) : number(transaction.change);
    const cashier = transaction.cashierName || 'Kasir';
    const timeLabel = transactionDate(transaction.createdAt, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    const isAdmin = session.role === 'admin';
    const canVoid = isAdmin && !cancelled && (!transaction.status || transaction.status === 'selesai');
    const status = cancelled
      ? '<span class="transaction-status transaction-status--void">Dibatalkan</span>'
      : '<span class="transaction-status">Selesai</span>';
    const voidNote = cancelled
      ? `<div class="transaction-cancel-note"><strong>Transaksi dibatalkan</strong><p>${escapeHtml(transaction.voidReason || 'Alasan tidak tercatat.')}</p><small>${transactionDate(transaction.voidedAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} WIB · ${escapeHtml(transaction.voidedByName || 'Admin')}</small></div>`
      : '';
    const adminAction = canVoid
      ? `<section class="product-card transaction-admin-actions">
          <h2>Aksi Admin</h2>
          <p>Void transaksi jika terjadi kesalahan. Stok produk akan dikembalikan secara otomatis.</p>
          <button class="btn btn--danger" type="button" data-action="start-void" data-id="${escapeHtml(transaction.id)}">Void Transaksi</button>
          <small>Alasan wajib diisi. Transaksi tidak dihapus dari riwayat.</small>
        </section>`
      : '';
    return `
      <div class="transaction-detail-heading">
        <a class="page-back" href="riwayat.html" data-action="back-list">← Kembali ke Riwayat</a>
        <div class="product-page-heading">
          <div>
            <div class="transaction-detail-title"><h1>Detail Transaksi</h1>${status}</div>
            <p>Periksa rincian pembayaran dan item dalam transaksi.</p>
          </div>
          <div class="transaction-detail-actions">
            <button class="btn btn--secondary" type="button" data-action="open-receipt" data-id="${escapeHtml(transaction.id)}">Cetak Ulang Struk</button>
          </div>
        </div>
      </div>
      <div class="transaction-detail-layout">
        <div class="transaction-detail-main">
          <section class="product-card transaction-detail-card">
            <h2>Informasi Transaksi</h2>
            <dl class="transaction-metadata">
              <div><dt>Nomor transaksi</dt><dd>${escapeHtml(transaction.id || '-')}</dd></div>
              <div><dt>Status transaksi</dt><dd>${cancelled ? 'Dibatalkan' : 'Selesai'}</dd></div>
              <div><dt>Tanggal &amp; waktu</dt><dd>${timeLabel} WIB</dd></div>
              <div><dt>Kasir</dt><dd>${escapeHtml(cashier)}<small>ID: ${escapeHtml(transaction.cashierId || '-')}</small></dd></div>
              <div><dt>Terminal</dt><dd>${escapeHtml(transaction.terminalName || 'Terminal Kasir 01')}</dd></div>
              <div><dt>Jumlah item</dt><dd>${itemsOf(transaction).length} jenis produk · ${totalQuantity(transaction)} item</dd></div>
            </dl>
          </section>
          <section class="product-card transaction-detail-card">
            <h2>Rincian Produk</h2>
            <div class="transaction-items-wrap">
              <table class="transaction-items-table">
                <thead><tr><th>Produk</th><th class="numeric">Harga</th><th class="numeric">Jumlah</th><th>Subtotal</th></tr></thead>
                <tbody>${detailItemsMarkup(transaction) || '<tr><td colspan="4">Tidak ada rincian produk.</td></tr>'}</tbody>
              </table>
            </div>
          </section>
          <section class="product-card transaction-detail-card">
            <h2>Ringkasan Pembayaran</h2>
            <div class="transaction-totals">
              <div class="transaction-total-row"><span>Subtotal</span><strong>${formatCurrency(grossSubtotal)}</strong></div>
              ${number(transaction.itemDiscount) ? `<div class="transaction-total-row"><span>Diskon item</span><strong>− ${formatCurrency(transaction.itemDiscount)}</strong></div>` : ''}
              ${number(transaction.discount) ? `<div class="transaction-total-row"><span>Diskon</span><strong>− ${formatCurrency(transaction.discount)}</strong></div>` : ''}
              <div class="transaction-total-row transaction-total-row--grand"><span>Total pembayaran</span><strong>${formatCurrency(total)}</strong></div>
              <div class="transaction-total-row"><span>Jumlah dibayar</span><strong>${formatCurrency(paid)}</strong></div>
              <div class="transaction-total-row"><span>Kembalian</span><strong>${formatCurrency(change)}</strong></div>
            </div>
          </section>
        </div>
        <aside class="transaction-detail-aside">
          <section class="product-card transaction-detail-card transaction-payment-card">
            <h2>Metode Pembayaran</h2>
            <div class="transaction-payment-method">
              <span class="transaction-payment-method__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h3"/></svg></span>
              <span><strong>${escapeHtml(payment)}</strong><small>${cancelled ? 'Pembayaran dibatalkan' : 'Pembayaran berhasil'}</small></span>
            </div>
            <div class="transaction-total-row"><span>Total transaksi</span><strong>${formatCurrency(total)}</strong></div>
          </section>
          <section class="product-card transaction-detail-card transaction-status-card">
            <h2>Status &amp; Pembatalan</h2>
            ${status}
            ${voidNote || `<p class="product-note">Transaksi yang selesai akan dicatat pada riwayat penjualan.</p>`}
          </section>
          ${adminAction}
        </aside>
      </div>`;
  }

  function renderDetail(transactionId) {
    const transaction = visibleTransactions().find((entry) => entry.id === transactionId);
    if (!transaction) {
      main.innerHTML = `<div class="product-page-heading"><div><h1>Transaksi tidak ditemukan</h1><p>Transaksi tidak tersedia atau Anda tidak memiliki akses untuk melihatnya.</p></div></div><button class="btn btn--secondary" type="button" data-action="back-list">Kembali ke Riwayat</button>`;
      return;
    }
    main.innerHTML = detailMarkup(transaction);
  }

  function currentTransaction(id) {
    return visibleTransactions().find((transaction) => transaction.id === id) || null;
  }

  function receiptMarkup(transaction) {
    const settings = SettingsStore.get();
    const cancelled = isCancelled(transaction);
    const total = transactionTotal(transaction);
    const received = transaction.received == null ? total : number(transaction.received);
    const change = transaction.change == null ? Math.max(0, received - total) : number(transaction.change);
    const grossSubtotal = transaction.grossSubtotal == null
      ? number(transaction.subtotal) + number(transaction.itemDiscount)
      : number(transaction.grossSubtotal);
    const itemMarkup = itemsOf(transaction).map((item) => {
      const price = number(item.price);
      const quantity = number(item.quantity);
      const lineTotal = item.subtotal == null
        ? Math.max(0, price * quantity - number(item.discount))
        : number(item.subtotal);
      return `<div class="receipt-item">
        <span>${escapeHtml(item.name || 'Produk')}</span>
        <span>${quantity} x ${formatCurrency(price)}</span>
        ${number(item.discount) ? `<span>Diskon item: − ${formatCurrency(item.discount)}</span>` : ''}
        <span class="receipt-item__total"><span>Subtotal</span><strong>${formatCurrency(lineTotal)}</strong></span>
      </div>`;
    }).join('');
    document.getElementById('receipt-paper').dataset.size = state.receiptSize;
    document.getElementById('receipt-paper-content').innerHTML = `
      <header class="history-receipt-header">
        <h3>${escapeHtml(settings.storeName)}</h3>
        ${settings.storeAddress ? `<p>${escapeHtml(settings.storeAddress)}</p>` : ''}
        ${settings.storePhone ? `<p>${escapeHtml(settings.storePhone)}</p>` : ''}
      </header>
      <div class="receipt-meta-row"><span>No.</span><span>${escapeHtml(transaction.id || '-')}</span></div>
      <div class="receipt-meta-row"><span>Tanggal</span><span>${transactionDate(transaction.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span></div>
      <div class="receipt-meta-row"><span>Kasir</span><span>${escapeHtml(transaction.cashierName || 'Kasir')}</span></div>
      <div class="receipt-meta-row"><span>Pembayaran</span><span>${escapeHtml(paymentLabel(transaction.paymentMethod))}</span></div>
      <hr class="receipt-divider">
      ${itemMarkup}
      <hr class="receipt-divider">
      <div class="receipt-total-list">
        <div class="receipt-meta-row"><span>Subtotal</span><span>${formatCurrency(grossSubtotal)}</span></div>
        ${number(transaction.itemDiscount) ? `<div class="receipt-meta-row"><span>Diskon item</span><span>− ${formatCurrency(transaction.itemDiscount)}</span></div>` : ''}
        ${number(transaction.discount) ? `<div class="receipt-meta-row"><span>Diskon</span><span>− ${formatCurrency(transaction.discount)}</span></div>` : ''}
        ${number(transaction.rounding) ? `<div class="receipt-meta-row"><span>Pembulatan</span><span>${number(transaction.rounding) > 0 ? '+' : '−'} ${formatCurrency(Math.abs(number(transaction.rounding)))}</span></div>` : ''}
        ${number(transaction.taxIncluded) ? `<div class="receipt-meta-row"><span>PPN termasuk (${transaction.vatRate != null ? number(transaction.vatRate) : settings.vatRate}%)</span><span>${formatCurrency(transaction.taxIncluded)}</span></div>` : ''}
        <div class="receipt-meta-row receipt-grand-total"><span>TOTAL</span><span>${formatCurrency(total)}</span></div>
        <div class="receipt-meta-row"><span>Dibayar</span><span>${formatCurrency(received)}</span></div>
        <div class="receipt-meta-row"><span>Kembalian</span><span>${formatCurrency(change)}</span></div>
      </div>
      ${cancelled ? `<hr class="receipt-divider"><p><strong>TRANSAKSI DIBATALKAN</strong></p><p>Alasan: ${escapeHtml(transaction.voidReason || '-')}</p>` : ''}
      <p class="receipt-footer">${cancelled ? 'Salinan transaksi batal' : escapeHtml(settings.receiptFooter)}<br>${escapeHtml(settings.storeName)}</p>`;
  }

  function showReceipt(transactionId) {
    const transaction = currentTransaction(transactionId);
    if (!transaction) return;
    receiptMarkup(transaction);
    syncReceiptSizeButtons();
    receiptDialog.showModal();
  }

  function syncReceiptSizeButtons() {
    receiptDialog.querySelectorAll('[data-action="receipt-size"]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.size === state.receiptSize);
    });
  }

  function setVoidError(message) {
    const error = document.getElementById('void-save-error');
    error.textContent = message;
    error.hidden = !message;
  }

  function beginVoid(transactionId) {
    if (session.role !== 'admin') return;
    const transaction = currentTransaction(transactionId);
    if (!transaction || isCancelled(transaction)) return;
    state.pendingTransactionId = transactionId;
    state.pendingReason = '';
    document.getElementById('void-reason').value = '';
    document.getElementById('void-reason-error').textContent = '';
    document.getElementById('void-reason-summary').innerHTML =
      `<strong>${escapeHtml(transaction.id)}</strong><span>${transactionDate(transaction.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} · ${escapeHtml(transaction.cashierName || 'Kasir')}</span><strong>${formatCurrency(transactionTotal(transaction))}</strong>`;
    document.getElementById('void-stock-summary').textContent =
      `Sebanyak ${totalQuantity(transaction)} item dari ${itemsOf(transaction).length} produk akan dikembalikan ke stok.`;
    setVoidError('');
    reasonDialog.showModal();
    document.getElementById('void-reason').focus();
  }

  function beginVoidConfirmation(reason) {
    const transaction = currentTransaction(state.pendingTransactionId);
    if (!transaction || isCancelled(transaction)) {
      reasonDialog.close();
      showToast('Transaksi tidak tersedia atau sudah dibatalkan.', true);
      return;
    }
    state.pendingReason = reason;
    document.getElementById('void-confirm-summary').innerHTML =
      `<strong>${escapeHtml(transaction.id)} · ${formatCurrency(transactionTotal(transaction))}</strong><span>${totalQuantity(transaction)} item akan dikembalikan ke stok.</span>`;
    document.getElementById('void-confirm-reason').textContent = reason;
    setVoidError('');
    reasonDialog.close();
    confirmDialog.showModal();
  }

  function voidFailureMessage(code, result) {
    const messages = {
      forbidden: 'Aksi void hanya dapat dilakukan oleh Admin.',
      'not-found': 'Transaksi tidak ditemukan.',
      'already-void': 'Transaksi ini sudah dibatalkan.',
      'not-completed': 'Hanya transaksi yang selesai yang dapat dibatalkan.',
      reason: 'Alasan pembatalan wajib diisi.',
      'reason-length': 'Alasan pembatalan maksimal 240 karakter.',
      'invalid-items': 'Rincian produk pada transaksi tidak valid. Stok tidak diubah.',
      'product-not-found': `Produk ${result.productName || ''} tidak ditemukan. Stok tidak diubah.`,
      'invalid-stock': `Data stok ${result.productName || 'produk'} tidak valid. Stok tidak diubah.`,
    };
    return messages[code] || 'Transaksi gagal dibatalkan. Tidak ada perubahan yang disimpan.';
  }

  function confirmVoid(event) {
    event.preventDefault();
    if (state.voiding) return;
    const transaction = currentTransaction(state.pendingTransactionId);
    if (!transaction) {
      setVoidError('Transaksi tidak ditemukan. Silakan kembali ke riwayat.');
      return;
    }
    state.voiding = true;
    const button = document.getElementById('confirm-void-button');
    button.disabled = true;
    button.textContent = 'Menyimpan...';
    try {
      const result = ProductStore.voidTransaction({
        transactionId: state.pendingTransactionId,
        reason: state.pendingReason,
        role: session.role,
        userId: session.userId,
        userName: session.nama || session.username,
      });
      if (!result.ok) {
        setVoidError(voidFailureMessage(result.code, result));
        return;
      }
      Audit.log({
        action: 'sale.void',
        entity: 'transaction',
        entityId: state.pendingTransactionId,
        summary: 'Void · ' + state.pendingReason,
      });
      confirmDialog.close();
      renderCurrentRoute();
      showToast(`Transaksi ${result.transaction.id} berhasil di-void. Stok telah dikembalikan.`);
      state.pendingTransactionId = '';
      state.pendingReason = '';
    } catch (error) {
      console.error('Gagal menyimpan pembatalan transaksi.', error);
      setVoidError('Pembatalan gagal disimpan. Periksa penyimpanan browser lalu coba lagi.');
    } finally {
      state.voiding = false;
      button.disabled = false;
      button.textContent = 'Ya, Void Transaksi';
    }
  }

  function showToast(message, isError) {
    const toast = document.getElementById('transaction-toast');
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.toggle('is-error', Boolean(isError));
    if (state.toastTimer) window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  }

  function routeTransactionId() {
    return new URLSearchParams(window.location.search).get('id') || '';
  }

  function renderCurrentRoute() {
    const id = routeTransactionId();
    if (id) renderDetail(id);
    else renderList();
  }

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const id = action.dataset.id || '';
    switch (action.dataset.action) {
      case 'open-detail':
        event.preventDefault();
        window.history.pushState(null, '', 'riwayat.html?id=' + encodeURIComponent(id));
        renderDetail(id);
        main.focus();
        break;
      case 'back-list':
        event.preventDefault();
        window.history.pushState(null, '', 'riwayat.html');
        renderList();
        main.focus();
        break;
      case 'page':
        state.page = Number(action.dataset.page) || 1;
        renderList();
        break;
      case 'reset-filters':
        state.search = '';
        state.date = '';
        state.cashierId = '';
        state.paymentMethod = '';
        state.page = 1;
        renderList();
        break;
      case 'start-void':
        beginVoid(id);
        break;
      case 'open-receipt':
        showReceipt(id);
        break;
      case 'close-void':
        reasonDialog.close();
        break;
      case 'back-to-void':
        confirmDialog.close();
        reasonDialog.showModal();
        break;
      case 'close-receipt':
        receiptDialog.close();
        break;
      case 'print-receipt':
        window.print();
        break;
      case 'receipt-size':
        state.receiptSize = action.dataset.size === '58' ? '58' : '80';
        const receiptTransaction = currentTransaction(routeTransactionId());
        if (receiptTransaction) receiptMarkup(receiptTransaction);
        syncReceiptSizeButtons();
        break;
      default:
        break;
    }
  });

  document.getElementById('void-reason-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const reason = document.getElementById('void-reason').value.trim();
    const error = document.getElementById('void-reason-error');
    if (!reason) {
      error.textContent = 'Alasan pembatalan wajib diisi.';
      document.getElementById('void-reason').focus();
      return;
    }
    if (reason.length > 240) {
      error.textContent = 'Alasan pembatalan maksimal 240 karakter.';
      document.getElementById('void-reason').focus();
      return;
    }
    error.textContent = '';
    beginVoidConfirmation(reason);
  });
  document.getElementById('void-reason').addEventListener('input', () => {
    document.getElementById('void-reason-error').textContent = '';
  });
  document.getElementById('void-confirm-form').addEventListener('submit', confirmVoid);
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
  window.addEventListener('popstate', renderCurrentRoute);

  updateHeader();
  renderCurrentRoute();
}());
