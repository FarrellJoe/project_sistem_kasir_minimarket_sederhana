(function () {
  'use strict';

  const session = Auth.requireAuth(['admin', 'kasir']);
  if (!session) return;

  const canManage = session.role === 'admin';
  const main = document.getElementById('stock-main');
  const toast = document.getElementById('stock-toast');
  const pageSize = 7;
  const historyPageSize = 8;
  const state = {
    search: '',
    category: '',
    status: '',
    onlyAttention: false,
    page: 1,
    historySearch: '',
    historyType: '',
    historyUser: '',
    historyFrom: '',
    historyTo: '',
    historyPage: 1,
    cardPage: 1,
    formDraft: null,
    pendingAdjustment: null,
    saveError: '',
  };
  let storageError = null;
  try {
    ProductStore.ensureSeeded();
  } catch (error) {
    storageError = error;
    console.error('Data stok tidak dapat dimuat.', error);
  }

  const escapeHTML = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const products = () => ProductStore.getProducts();
  const categories = () => ProductStore.getCategories();
  const movements = () => ProductStore.getStockMovements();
  const numberFormat = new Intl.NumberFormat('id-ID');
  const number = (value) => numberFormat.format(Number(value) || 0);
  const initials = (name) => String(name || 'User').trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join('');
  const stockStatus = (product) => product.stock <= 0 ? 'out' : product.stock <= product.minStock ? 'low' : 'safe';
  const stockLabel = (status) => status === 'out' ? 'Habis' : status === 'low' ? 'Menipis' : 'Aman';
  const productThumb = (product) => {
    const image = product.image
      ? '<img src="' + escapeHTML(product.image) + '" alt="">'
      : escapeHTML(product.emoji || '📦');
    return '<span class="product-emoji" aria-hidden="true">' + image + '</span>';
  };
  const categoryName = (id) => {
    const category = categories().find((entry) => entry.id === id);
    return category ? category.name : 'Tanpa kategori';
  };
  const actorName = (movement) => {
    if (movement.userName) return movement.userName;
    const user = DB.getUsers().find((entry) => String(entry.id) === String(movement.userId));
    return user ? user.nama : 'Pengguna';
  };
  const formatDateTime = (value, withZone) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const formatted = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date);
    return withZone ? formatted + ' WIB' : formatted;
  };
  const localDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  };
  const signedQuantity = (value) => (value > 0 ? '+' : '') + number(value);
  const route = () => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'list';
    return {
      view: ['list', 'adjust', 'confirm', 'success', 'history', 'card'].includes(view) ? view : 'list',
      id: params.get('id'),
    };
  };

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function navigate(view, id, options) {
    const url = new URL(window.location.href);
    if (view === 'list') {
      url.search = '';
    } else {
      url.searchParams.set('view', view);
      if (id) url.searchParams.set('id', id);
      else url.searchParams.delete('id');
    }
    if (!options || !options.replace) window.history.pushState({}, '', url);
    else window.history.replaceState({}, '', url);
    render();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }

  function statusBadge(status) {
    return '<span class="stock-badge stock-badge--' + status + '">' + stockLabel(status) + '</span>';
  }

  function renderStats(allProducts) {
    const low = allProducts.filter((product) => stockStatus(product) === 'low').length;
    const out = allProducts.filter((product) => stockStatus(product) === 'out').length;
    return '<section class="product-stats stock-stats" aria-label="Ringkasan stok">' +
      '<article class="product-stat stock-stat"><span>Total Produk Terdaftar</span><strong>' + allProducts.length + ' SKU</strong><small>Semua barang terdaftar</small><span class="stock-stat__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M4 8h16m-11 4h6"/></svg></span></article>' +
      '<article class="product-stat stock-stat product-stat--low"><span>Stok Menipis</span><strong>' + low + ' Produk</strong><small>Stok ≤ batas minimum</small><span class="stock-stat__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 10 18H2z"/><path d="M12 9v5m0 3h.01"/></svg></span></article>' +
      '<article class="product-stat stock-stat product-stat--out"><span>Stok Habis</span><strong>' + out + ' Produk</strong><small>Stok 0, tidak dapat dijual</small><span class="stock-stat__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg></span></article>' +
      '</section>';
  }

  function renderTabs(active) {
    return '<div class="stock-tabs" role="tablist" aria-label="Halaman stok">' +
      '<button type="button" role="tab" aria-selected="' + (active === 'list') + '" class="' + (active === 'list' ? 'is-active' : '') + '" data-action="show-list">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M4 8h16m-11 4h6"/></svg>Daftar Stok</button>' +
      (canManage ? '<button type="button" role="tab" aria-selected="' + (active === 'history') + '" class="' + (active === 'history' ? 'is-active' : '') + '" data-action="show-history">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/></svg>Riwayat Stok (Mutasi)</button>' : '') +
      '</div>';
  }

  function renderPagination(group, page, count, size, label) {
    const totalPages = Math.max(1, Math.ceil(count / size));
    const from = count ? (page - 1) * size + 1 : 0;
    const to = Math.min(page * size, count);
    return '<div class="product-pagination stock-pagination"><span>' + label(from, to, count) + '</span><div class="stock-pagination__buttons">' +
      '<button class="btn btn--secondary" type="button" data-action="page" data-group="' + group + '" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>Sebelumnya</button>' +
      '<span class="stock-page-number" aria-current="page">' + page + '</span>' +
      '<button class="btn btn--secondary" type="button" data-action="page" data-group="' + group + '" data-page="' + (page + 1) + '"' + (page >= totalPages ? ' disabled' : '') + '>Selanjutnya</button></div></div>';
  }

  function filteredProducts() {
    const query = state.search.trim().toLowerCase();
    return products().filter((product) => {
      if (!canManage && !product.isActive) return false;
      if (query && ![product.name, product.code, product.barcode].some((value) => String(value || '').toLowerCase().includes(query))) return false;
      if (state.category && product.categoryId !== state.category) return false;
      const status = stockStatus(product);
      if (state.status && status !== state.status) return false;
      if (state.onlyAttention && status === 'safe') return false;
      return true;
    });
  }

  function renderList() {
    const allProducts = products();
    const lowCount = allProducts.filter((product) => stockStatus(product) === 'low').length;
    const outCount = allProducts.filter((product) => stockStatus(product) === 'out').length;
    const attentionCount = lowCount + outCount;
    const visibleProducts = filteredProducts();
    const pageCount = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
    state.page = Math.min(state.page, pageCount);
    const pageItems = visibleProducts.slice((state.page - 1) * pageSize, state.page * pageSize);
    const rows = pageItems.map((product) => {
      const status = stockStatus(product);
      const stockClass = status === 'safe' ? '' : ' stock-number--' + status;
      return '<tr>' +
        '<td class="product-code">' + escapeHTML(product.code) + '</td>' +
        '<td><div class="product-name-cell">' + productThumb(product) + '<span><a class="stock-card-link" href="stok.html?view=card&amp;id=' + encodeURIComponent(product.id) + '" data-action="card" data-id="' + escapeHTML(product.id) + '"><strong>' + escapeHTML(product.name) + '</strong></a></span></div></td>' +
        '<td>' + escapeHTML(categoryName(product.categoryId)) + '</td>' +
        '<td class="stock-number' + stockClass + '">' + number(product.stock) + ' <span class="stock-unit">' + escapeHTML(product.unit || 'unit') + '</span></td>' +
        '<td>' + number(product.minStock) + ' <span class="stock-unit">' + escapeHTML(product.unit || 'unit') + '</span></td>' +
        '<td>' + statusBadge(status) + '</td>' +
        '<td class="stock-updated">' + escapeHTML(formatDateTime(product.updatedAt || product.createdAt)) + '</td>' +
        (canManage ? '<td><button class="stock-row-action" type="button" data-action="adjust" data-id="' + escapeHTML(product.id) + '">Sesuaikan</button></td>' : '') +
        '</tr>';
    }).join('');
    const categoriesOptions = categories().map((category) =>
      '<option value="' + escapeHTML(category.id) + '"' + (state.category === category.id ? ' selected' : '') + '>' + escapeHTML(category.name) + '</option>'
    ).join('');
    const resultLabel = state.onlyAttention
      ? 'Menampilkan ' + pageItems.length + ' dari ' + visibleProducts.length + ' produk perlu perhatian'
      : 'Menampilkan ' + pageItems.length + ' dari ' + visibleProducts.length + ' total produk';

    return '<section class="product-page-heading stock-heading"><div><h1>' + (canManage ? 'Manajemen Stok' : 'Stok Produk') + '</h1><p>' +
      (canManage ? 'Monitoring ketersediaan barang dan penyesuaian stok manual.' : 'Periksa ketersediaan produk sebelum melakukan penjualan.') +
      '</p></div>' + (canManage ? '<div class="product-heading-actions"><button type="button" class="btn btn--secondary" data-action="export-products">Unduh Laporan Stok</button><button type="button" class="btn btn--primary" data-action="opname">＋ Stock Opname</button></div>' : '') + '</section>' +
      renderStats(allProducts) +
      (canManage
        ? (attentionCount ? '<div class="stock-notice stock-notice--warning"><strong>' + attentionCount + ' produk perlu perhatian · ' + lowCount + ' menipis, ' + outCount + ' habis</strong><span>Produk dengan stok ≤ minimum muncul pada daftar peringatan dan stok 0 tidak dapat ditambahkan ke penjualan.</span></div>' : '<div class="stock-notice stock-notice--success"><strong>Semua stok dalam kondisi aman</strong><span>Tidak ada produk yang berada di bawah batas minimum.</span></div>')
        : '<div class="stock-notice stock-notice--info"><strong>Mode lihat · Kasir</strong><span>Penyesuaian stok hanya dapat dilakukan oleh Admin. Hubungi Admin jika stok fisik berbeda.</span></div>') +
      '<section class="product-panel stock-panel">' + renderTabs('list') +
      '<form class="product-filters stock-filters" id="stock-list-filter-form">' +
      '<input id="stock-search" name="search" type="search" value="' + escapeHTML(state.search) + '" placeholder="Cari produk atau barcode..." aria-label="Cari produk atau barcode">' +
      '<select id="stock-category" name="category" aria-label="Filter kategori"><option value="">Semua Kategori</option>' + categoriesOptions + '</select>' +
      '<select id="stock-status" name="status" aria-label="Filter status stok"><option value="">Semua status</option><option value="safe"' + (state.status === 'safe' ? ' selected' : '') + '>Aman</option><option value="low"' + (state.status === 'low' ? ' selected' : '') + '>Menipis</option><option value="out"' + (state.status === 'out' ? ' selected' : '') + '>Habis</option></select>' +
      '<button class="btn stock-filter-toggle' + (state.onlyAttention ? ' is-active' : '') + '" type="button" data-action="attention" aria-pressed="' + state.onlyAttention + '">Hanya Menipis &amp; Habis</button>' +
      '</form>' +
      (rows
        ? '<div class="product-table-wrap"><table class="product-table stock-table' + (canManage ? '' : ' stock-table--readonly') + '"><thead><tr><th>Kode barang</th><th>Nama produk</th><th>Kategori</th><th>Stok fisik</th><th>Minimum</th><th>Status</th><th>Diperbarui</th>' + (canManage ? '<th>Aksi</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
          renderPagination('list', state.page, visibleProducts.length, pageSize, () => resultLabel)
        : '<div class="empty-state stock-empty"><strong>' + (state.search || state.category || state.status || state.onlyAttention ? 'Produk tidak ditemukan' : 'Belum ada produk') + '</strong><span>' + (state.onlyAttention && !attentionCount ? 'Semua produk sudah berada di atas stok minimum.' : 'Ubah kata pencarian atau filter untuk melihat produk lain.') + '</span></div>') +
      '</section>';
  }

  function movementAction(movement) {
    if (movement.adjustmentType === 'add' || movement.type === 'masuk') return 'Masuk · Manual';
    if (movement.adjustmentType === 'reduce') return 'Keluar · Manual';
    if (movement.adjustmentType === 'correction') return 'Koreksi · Manual';
    if (movement.type === 'penjualan') return 'Penjualan · Otomatis';
    if (movement.type === 'void') return 'Void · Otomatis';
    return 'Koreksi';
  }

  function movementReason(movement) {
    const reason = movement.reason || '';
    const note = movement.note || '';
    if (movement.type === 'penjualan') return 'Transaksi ' + reason;
    if (movement.type === 'void') return [note, reason ? 'Transaksi ' + reason : 'Transaksi dibatalkan'].filter(Boolean).join(' · ');
    return [reason, note].filter(Boolean).join(' · ');
  }

  function movementProduct(movement) {
    return products().find((product) => product.id === movement.productId);
  }

  function historyUsers() {
    const known = DB.getUsers().map((user) => ({ id: String(user.id), name: user.nama }));
    if (!known.some((user) => user.name === session.nama)) known.push({ id: String(session.userId), name: session.nama });
    return known;
  }

  function filteredMovements(productId) {
    const query = state.historySearch.trim().toLowerCase();
    return movements().filter((movement) => {
      if (productId && movement.productId !== productId) return false;
      const product = movementProduct(movement);
      if (!product) return false;
      if (query && ![product.name, product.code, product.barcode, movement.reason, movement.note, actorName(movement)]
        .some((value) => String(value || '').toLowerCase().includes(query))) return false;
      if (state.historyType === 'sale' && movement.type !== 'penjualan') return false;
      if (state.historyType === 'add' && !(movement.adjustmentType === 'add' || movement.type === 'masuk')) return false;
      if (state.historyType === 'reduce' && movement.adjustmentType !== 'reduce') return false;
      if (state.historyType === 'correction' && !(movement.adjustmentType === 'correction' || movement.type === 'koreksi' && !movement.adjustmentType)) return false;
      if (state.historyType === 'void' && movement.type !== 'void') return false;
      if (state.historyUser && String(movement.userId) !== state.historyUser) return false;
      const date = localDateKey(movement.createdAt);
      if (state.historyFrom && date < state.historyFrom) return false;
      if (state.historyTo && date > state.historyTo) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  function renderMovementRows(items) {
    return items.map((movement) => {
      const product = movementProduct(movement);
      const quantity = Number(movement.quantity) || 0;
      const amountClass = quantity > 0 ? ' movement-amount--positive' : quantity < 0 ? ' movement-amount--negative' : '';
      return '<tr><td class="movement-date">' + escapeHTML(formatDateTime(movement.createdAt)) + '</td>' +
        '<td><div class="product-name-cell">' + productThumb(product) + '<span><a class="stock-card-link" href="stok.html?view=card&amp;id=' + encodeURIComponent(product.id) + '" data-action="card" data-id="' + escapeHTML(product.id) + '"><strong>' + escapeHTML(product.name) + '</strong></a><small>' + escapeHTML(product.code) + '</small></span></div></td>' +
        '<td><div class="movement-kind">' + escapeHTML(movementAction(movement)) + '<small>' + escapeHTML(movementReason(movement)) + '</small></div></td>' +
        '<td class="movement-amount' + amountClass + '">' + signedQuantity(quantity) + '</td>' +
        '<td>' + number(movement.stockBefore) + '</td><td>' + number(movement.stockAfter) + '</td>' +
        '<td>' + escapeHTML(actorName(movement)) + (movement.type === 'penjualan' ? '<br><small>' + escapeHTML(movement.reason || '') + '</small>' : '') + '</td></tr>';
    }).join('');
  }

  function renderHistory(productId) {
    const items = filteredMovements(productId);
    const pageSizeForRoute = productId ? historyPageSize : historyPageSize;
    const currentPage = productId ? state.cardPage : state.historyPage;
    const pages = Math.max(1, Math.ceil(items.length / pageSizeForRoute));
    if (productId) state.cardPage = Math.min(state.cardPage, pages);
    else state.historyPage = Math.min(state.historyPage, pages);
    const pageItems = items.slice((currentPage - 1) * pageSizeForRoute, currentPage * pageSizeForRoute);
    const userOptions = historyUsers().map((user) =>
      '<option value="' + escapeHTML(user.id) + '"' + (state.historyUser === user.id ? ' selected' : '') + '>' + escapeHTML(user.name) + '</option>'
    ).join('');
    const filterForm = '<form class="product-filters stock-filters stock-filters--history" id="stock-history-filter-form">' +
      '<input name="search" type="search" value="' + escapeHTML(state.historySearch) + '" placeholder="Cari nama produk atau kode..." aria-label="Cari nama produk atau kode">' +
      '<input name="from" type="date" value="' + escapeHTML(state.historyFrom) + '" aria-label="Tanggal mulai">' +
      '<input name="to" type="date" value="' + escapeHTML(state.historyTo) + '" aria-label="Tanggal akhir">' +
      '<select name="type" aria-label="Filter jenis"><option value="">Semua jenis</option><option value="sale"' + (state.historyType === 'sale' ? ' selected' : '') + '>Penjualan otomatis</option><option value="add"' + (state.historyType === 'add' ? ' selected' : '') + '>Stok masuk</option><option value="reduce"' + (state.historyType === 'reduce' ? ' selected' : '') + '>Stok keluar</option><option value="correction"' + (state.historyType === 'correction' ? ' selected' : '') + '>Koreksi</option><option value="void"' + (state.historyType === 'void' ? ' selected' : '') + '>Void</option></select>' +
      '<select name="user" aria-label="Filter pelaku"><option value="">Semua pelaku</option>' + userOptions + '</select>' +
      '<div class="stock-history-filter-actions"><button class="btn btn--primary" type="submit">Terapkan filter</button><button class="btn btn--secondary" type="button" data-action="reset-history">Reset</button><button class="btn btn--secondary" type="button" data-action="export-history">Export CSV</button></div>' +
      '</form>';
    return '<section class="product-page-heading stock-heading"><div><h1>Riwayat Stok (Mutasi)</h1><p>Telusuri perubahan stok otomatis dan penyesuaian manual.</p></div><div class="product-heading-actions"><button type="button" class="btn btn--secondary" data-action="show-list">Kembali ke Daftar Stok</button></div></section>' +
      '<div class="stock-notice stock-notice--info"><strong>Semua perubahan tercatat</strong><span>Penjualan mengurangi stok otomatis; penyesuaian manual menyimpan alasan, stok sebelum/sesudah, dan pelaku.</span></div>' +
      '<section class="product-panel stock-panel">' + renderTabs('history') + filterForm +
      (pageItems.length
        ? '<div class="product-table-wrap"><table class="product-table stock-history-table"><thead><tr><th>Waktu (WIB)</th><th>Produk</th><th>Jenis mutasi</th><th>Jumlah</th><th>Sebelum</th><th>Sesudah</th><th>Pelaku</th></tr></thead><tbody>' + renderMovementRows(pageItems) + '</tbody></table></div>' +
          renderPagination('history', currentPage, items.length, historyPageSize, (from, to, count) => 'Menampilkan ' + (count ? from + '–' + to + ' dari ' : '') + count + ' mutasi · Urutan terbaru')
        : '<div class="empty-state stock-empty"><strong>Tidak ada mutasi stok</strong><span>' + (movements().length ? 'Tidak ada catatan yang cocok dengan filter.' : 'Perubahan stok dari penjualan dan penyesuaian akan muncul di sini.') + '</span></div>') +
      '</section>';
  }

  function renderCard(product) {
    const status = stockStatus(product);
    const alert = status === 'safe'
      ? '<div class="stock-notice stock-notice--success"><strong>Stok aman</strong><span>Persediaan berada di atas minimum ' + number(product.minStock) + ' ' + escapeHTML(product.unit) + '.</span></div>'
      : '<div class="stock-notice stock-notice--warning"><strong>Stok perlu diisi kembali</strong><span>' + number(product.stock) + ' ' + escapeHTML(product.unit) + ' tersedia dari minimum ' + number(product.minStock) + ' ' + escapeHTML(product.unit) + '. Produk dengan stok ≤ minimum muncul pada daftar peringatan.</span></div>';
    return '<section class="product-page-heading stock-heading"><div><h1>Kartu Stok Produk</h1><p>Detail persediaan dan riwayat ' + escapeHTML(product.name) + '.</p></div><div class="product-heading-actions"><button class="btn btn--secondary" type="button" data-action="show-history">Kembali ke Riwayat</button></div></section>' +
      '<section class="stock-product-card stock-card-summary"><div class="stock-card-product">' + productThumb(product) + '<div><h2>' + escapeHTML(product.name) + '</h2><p>' + escapeHTML(product.code) + ' · ' + escapeHTML(categoryName(product.categoryId)) + ' · Satuan ' + escapeHTML(product.unit) + '</p><div class="stock-card-status">' + statusBadge(status) + '</div></div></div>' +
      '<div class="stock-card-metric"><span>Stok saat ini</span><strong>' + number(product.stock) + ' ' + escapeHTML(product.unit) + '</strong></div>' +
      '<div class="stock-card-metric"><span>Stok minimum</span><strong>' + number(product.minStock) + ' ' + escapeHTML(product.unit) + '</strong></div>' +
      (canManage ? '<button type="button" class="btn btn--primary" data-action="adjust" data-id="' + escapeHTML(product.id) + '">Sesuaikan stok</button>' : '') + '</section>' +
      '<section class="product-panel stock-panel"><div class="product-panel__heading"><h2>Riwayat perubahan</h2><span class="product-panel__count">' + filteredMovements(product.id).length + ' mutasi</span></div>' +
      (filteredMovements(product.id).length
        ? '<div class="product-table-wrap"><table class="product-table stock-history-table"><thead><tr><th>Waktu (WIB)</th><th>Jenis &amp; alasan</th><th>Jumlah</th><th>Sebelum</th><th>Sesudah</th><th>Pelaku / referensi</th></tr></thead><tbody>' +
          filteredMovements(product.id).slice((state.cardPage - 1) * historyPageSize, state.cardPage * historyPageSize).map((movement) => {
            const quantity = Number(movement.quantity) || 0;
            const amountClass = quantity > 0 ? ' movement-amount--positive' : quantity < 0 ? ' movement-amount--negative' : '';
            return '<tr><td>' + escapeHTML(formatDateTime(movement.createdAt)) + '</td><td><div class="stock-card-row-detail">' + escapeHTML(movementAction(movement)) + '<small>' + escapeHTML(movementReason(movement)) + '</small></div></td>' +
              '<td class="movement-amount' + amountClass + '">' + signedQuantity(quantity) + '</td><td>' + number(movement.stockBefore) + '</td><td>' + number(movement.stockAfter) + '</td>' +
              '<td class="stock-card-row-detail">' + escapeHTML(actorName(movement)) + '<small>' + escapeHTML(movement.type === 'penjualan' ? movement.reason || '' : 'Penyesuaian manual') + '</small></td></tr>';
          }).join('') + '</tbody></table></div>' +
          renderPagination('card', state.cardPage, filteredMovements(product.id).length, historyPageSize, (from, to, count) => 'Menampilkan ' + from + '–' + to + ' dari ' + count + ' mutasi · Terbaru')
        : '<div class="empty-state stock-empty"><strong>Belum ada riwayat perubahan</strong><span>Mutasi stok produk akan tampil setelah stok berubah.</span></div>') +
      '</section>' + alert;
  }

  function reasonsFor(action) {
    if (action === 'add') return ['Barang masuk', 'Retur barang'];
    if (action === 'reduce') return ['Barang rusak', 'Kedaluwarsa', 'Kehilangan', 'Pemakaian internal'];
    return ['Hasil stock opname', 'Koreksi data'];
  }

  function ensureDraft(productId) {
    if (state.pendingAdjustment && state.pendingAdjustment.productId === productId) {
      return {
        productId: state.pendingAdjustment.productId,
        action: state.pendingAdjustment.action,
        amount: String(state.pendingAdjustment.amount),
        reason: state.pendingAdjustment.reason,
        note: state.pendingAdjustment.note,
      };
    }
    if (state.formDraft && (!productId || state.formDraft.productId === productId)) return state.formDraft;
    const defaultProduct = products().find((product) => product.id === productId) || products()[0];
    return {
      productId: defaultProduct ? defaultProduct.id : '',
      action: 'add',
      amount: '',
      reason: '',
      note: '',
    };
  }

  function calculateAdjustment(draft, product) {
    if (!product) return { valid: false, error: 'Pilih produk terlebih dahulu.', delta: null, after: null };
    const amountText = String(draft.amount == null ? '' : draft.amount).trim();
    if (!amountText) return { valid: false, error: 'Masukkan jumlah perubahan stok.', delta: null, after: null };
    const amount = Number(amountText);
    if (!Number.isInteger(amount) || amount < 0) return { valid: false, error: 'Masukkan bilangan bulat yang valid.', delta: null, after: null };
    if (draft.action !== 'correction' && amount < 1) return { valid: false, error: 'Jumlah perubahan harus lebih dari 0.', delta: null, after: null };
    const delta = draft.action === 'add' ? amount : draft.action === 'reduce' ? -amount : amount - product.stock;
    const after = product.stock + delta;
    if (after < 0) return { valid: false, error: 'Jumlah tidak boleh melebihi stok tersedia (' + number(product.stock) + ' ' + product.unit + ').', delta, after };
    if (!draft.reason) return { valid: false, error: 'Pilih alasan penyesuaian.', delta, after };
    return { valid: true, error: '', delta, after };
  }

  function renderAdjustment(productId) {
    if (!canManage) return '';
    const draft = ensureDraft(productId);
    const product = products().find((entry) => entry.id === draft.productId);
    const result = calculateAdjustment(draft, product);
    const reasonOptions = reasonsFor(draft.action).map((reason) =>
      '<option value="' + escapeHTML(reason) + '"' + (draft.reason === reason ? ' selected' : '') + '>' + escapeHTML(reason) + '</option>'
    ).join('');
    const productOptions = products().map((entry) =>
      '<option value="' + escapeHTML(entry.id) + '"' + (draft.productId === entry.id ? ' selected' : '') + '>' + escapeHTML(entry.name) + ' · ' + escapeHTML(entry.code) + '</option>'
    ).join('');
    const changeLabel = draft.action === 'add' ? 'Tambahan stok' : draft.action === 'reduce' ? 'Pengurangan stok' : 'Perubahan stok';
    const actionLabel = draft.action === 'add' ? 'Tambah Stok' : draft.action === 'reduce' ? 'Kurangi Stok' : 'Koreksi / Stock Opname';
    const signedDelta = result.delta == null ? '—' : (result.delta > 0 ? '+' : '') + number(result.delta) + ' ' + escapeHTML(product ? product.unit : 'unit');
    const statusClass = !result.valid ? 'invalid' : result.after === 0 ? 'out' : result.after <= (product ? product.minStock : 0) ? 'low' : 'safe';
    const statusText = !result.valid ? result.error : statusClass === 'safe' ? 'Aman setelah perubahan' : statusClass === 'low' ? 'Stok masih menipis' : 'Stok akan habis';
    const statusHint = !product ? '' : 'Batas minimum: ' + number(product.minStock) + ' ' + escapeHTML(product.unit);
    const userLabel = session.nama + ' · ' + (canManage ? 'Admin' : 'Kasir');

    state.formDraft = draft;
    return '<section class="product-page-heading stock-heading"><div><p class="stock-breadcrumb"><button type="button" data-action="show-list">Manajemen Stok</button><span>/</span>Penyesuaian manual</p><h1>' + actionLabel + '</h1><p>Perbarui persediaan dengan alasan yang jelas. Hanya Admin yang dapat menyimpan perubahan.</p></div></section>' +
      (state.saveError ? '<div class="stock-notice stock-notice--error"><strong>Perubahan belum tersimpan</strong><span>' + escapeHTML(state.saveError) + '</span></div>' : '') +
      '<div class="stock-adjust-layout"><form class="stock-form-card" id="stock-adjust-form" novalidate><h2>Detail penyesuaian</h2>' +
      '<div class="stock-form-field"><span>Jenis penyesuaian</span><div class="stock-adjust-types">' +
      '<button type="button" data-action="adjust-type" data-type="add" class="' + (draft.action === 'add' ? 'is-active' : '') + '" aria-pressed="' + (draft.action === 'add') + '">＋ Tambah</button>' +
      '<button type="button" data-action="adjust-type" data-type="reduce" class="' + (draft.action === 'reduce' ? 'is-active' : '') + '" aria-pressed="' + (draft.action === 'reduce') + '">− Kurang</button>' +
      '<button type="button" data-action="adjust-type" data-type="correction" class="' + (draft.action === 'correction' ? 'is-active' : '') + '" aria-pressed="' + (draft.action === 'correction') + '">Koreksi / Opname</button>' +
      '</div></div>' +
      '<label class="stock-form-field">Produk *<div class="stock-product-select">' + (product ? productThumb(product) : '') +
      '<select id="adjust-product" name="productId" required aria-label="Pilih produk">' + productOptions + '</select></div>' +
      '<small id="adjust-product-meta">' + (product ? escapeHTML(product.code) + ' · ' + escapeHTML(categoryName(product.categoryId)) + ' · Stok saat ini: ' + number(product.stock) + ' ' + escapeHTML(product.unit) : 'Belum ada produk.') + '</small></label>' +
      '<label class="stock-form-field"><span id="adjust-amount-label">' + (draft.action === 'correction' ? 'Stok fisik hasil hitung *' : 'Jumlah perubahan *') + '</span><div class="stock-field-with-unit">' +
      '<input id="adjust-amount" name="amount" type="number" min="' + (draft.action === 'correction' ? '0' : '1') + '" step="1" value="' + escapeHTML(draft.amount) + '" aria-describedby="adjust-amount-help adjust-amount-error" required>' +
      '<span>' + escapeHTML(product ? product.unit : 'unit') + '</span></div>' +
      '<small id="adjust-amount-help">' + (draft.action === 'correction' ? 'Masukkan jumlah fisik yang dihitung, bukan selisihnya.' : 'Gunakan bilangan bulat positif.') + '</small>' +
      '<small id="adjust-amount-error" class="stock-quantity-error" role="alert">' + (result.valid || !draft.amount ? '' : escapeHTML(result.error)) + '</small></label>' +
      '<label class="stock-form-field">Alasan penyesuaian *<select id="adjust-reason" name="reason" required><option value="">Pilih alasan penyesuaian</option>' + reasonOptions + '</select>' +
      '<small id="adjust-reason-error" class="stock-quantity-error" role="alert">' + (draft.reason ? '' : (draft.amount ? 'Alasan wajib dipilih sebelum meninjau.' : '')) + '</small></label>' +
      '<label class="stock-form-field">Catatan<input id="adjust-note" name="note" type="text" maxlength="240" value="' + escapeHTML(draft.note) + '" placeholder="Tambahkan keterangan penyesuaian..."></label>' +
      '<div class="stock-form-actions"><button class="btn btn--secondary" type="button" data-action="show-list">Batal</button><button class="btn btn--primary" id="review-adjustment" type="submit"' + (!result.valid ? ' disabled' : '') + '>Tinjau Penyesuaian</button></div></form>' +
      '<aside class="stock-summary-card" aria-live="polite"><h2>Ringkasan Stok</h2><dl>' +
      '<div><dt>Stok saat ini</dt><dd>' + (product ? number(product.stock) + ' ' + escapeHTML(product.unit) : '—') + '</dd></div>' +
      '<div><dt>' + changeLabel + '</dt><dd class="' + (result.delta > 0 ? 'is-change-positive' : result.delta < 0 ? 'is-change-negative' : '') + '">' + signedDelta + '</dd></div>' +
      '<div><dt>Stok setelah disimpan</dt><dd class="' + (!result.valid ? 'is-invalid' : '') + '">' + (result.valid ? number(result.after) + ' ' + escapeHTML(product.unit) : 'Tidak valid') + '</dd></div></dl>' +
      '<div class="stock-summary-status stock-summary-status--' + statusClass + '"><strong>' + escapeHTML(statusText) + '</strong><span>' + escapeHTML(statusHint) + '</span></div>' +
      '<p class="stock-record-note"><strong>Tercatat di kartu stok</strong><br>Waktu, jenis, jumlah, stok sebelum/sesudah, alasan, dan pelaku disimpan bersama perubahan stok.<br><br>Pelaku: ' + escapeHTML(userLabel) + '</p></aside></div>';
  }

  function renderConfirm() {
    const adjustment = state.pendingAdjustment;
    if (!adjustment) return '<section class="product-panel empty-state"><strong>Data penyesuaian tidak ditemukan</strong><span>Mulai kembali dari daftar stok.</span><button class="btn btn--primary" type="button" data-action="show-list">Kembali ke Daftar Stok</button></section>';
    const product = products().find((entry) => entry.id === adjustment.productId);
    if (!product) return '<section class="product-panel empty-state"><strong>Produk tidak ditemukan</strong><button class="btn btn--primary" type="button" data-action="show-list">Kembali ke Daftar Stok</button></section>';
    const delta = adjustment.action === 'add' ? adjustment.amount : adjustment.action === 'reduce' ? -adjustment.amount : adjustment.amount - adjustment.expectedStock;
    const after = adjustment.expectedStock + delta;
    const amountLabel = adjustment.action === 'add' ? 'Tambahan stok' : adjustment.action === 'reduce' ? 'Pengurangan stok' : 'Penyesuaian stok';
    return '<section class="product-page-heading stock-heading"><div><p class="stock-breadcrumb"><button type="button" data-action="edit-adjustment">Manajemen Stok</button><span>/</span>Konfirmasi penyesuaian</p><h1>Konfirmasi Penyesuaian</h1><p>Periksa kembali rincian sebelum memperbarui persediaan.</p></div></section>' +
      '<section class="stock-confirm-card"><div class="stock-confirm-product">' + productThumb(product) + '<div><h2>' + escapeHTML(product.name) + '</h2><p>' + escapeHTML(product.code) + ' · ' + escapeHTML(categoryName(product.categoryId)) + '</p></div><span class="stock-confirm-badge">Belum disimpan</span></div>' +
      '<div class="stock-confirm-grid"><div><span>Stok sebelum</span><strong>' + number(adjustment.expectedStock) + ' ' + escapeHTML(product.unit) + '</strong></div>' +
      '<div><span>' + amountLabel + '</span><strong class="' + (delta > 0 ? 'is-positive' : delta < 0 ? 'is-negative' : '') + '">' + (delta > 0 ? '+' : '') + number(delta) + ' ' + escapeHTML(product.unit) + '</strong></div>' +
      '<div><span>Stok sesudah</span><strong>' + number(after) + ' ' + escapeHTML(product.unit) + '</strong></div></div>' +
      '<div class="stock-confirm-details"><div><span>Alasan penyesuaian</span><strong>' + escapeHTML(adjustment.reason) + '</strong>' + (adjustment.note ? '<p>' + escapeHTML(adjustment.note) + '</p>' : '') + '</div>' +
      '<div><span>Dilakukan oleh</span><strong>' + escapeHTML(session.nama) + ' · Admin</strong><p>Waktu dicatat saat perubahan disimpan</p></div></div>' +
      '<div class="stock-notice stock-notice--info"><strong>Perubahan ini akan dicatat di riwayat stok</strong><span>Stok dan riwayat diperbarui bersama. Jika penyimpanan gagal, stok tidak akan berubah.</span></div>' +
      (state.saveError ? '<div class="stock-notice stock-notice--error"><strong>Perubahan belum tersimpan</strong><span>' + escapeHTML(state.saveError) + '</span></div>' : '') +
      '<div class="stock-result-actions"><button class="btn btn--secondary" type="button" data-action="edit-adjustment">Ubah kembali</button><button class="btn btn--primary" type="button" data-action="save-adjustment">Simpan Penyesuaian</button></div></section>';
  }

  function renderSuccess(movementId) {
    const movement = movements().find((entry) => entry.id === movementId);
    if (!movement) return '<section class="product-panel empty-state"><strong>Catatan penyesuaian tidak ditemukan</strong><button class="btn btn--primary" type="button" data-action="show-list">Kembali ke Daftar Stok</button></section>';
    const product = movementProduct(movement);
    const delta = Number(movement.quantity) || 0;
    const status = stockStatus(product);
    const actionLabel = movement.adjustmentType === 'add' ? 'Stok berhasil ditambahkan.' : movement.adjustmentType === 'reduce' ? 'Stok berhasil dikurangi.' : 'Stok berhasil dikoreksi.';
    const statusNotice = status === 'safe'
      ? '<div class="stock-summary-status stock-summary-status--safe"><strong>Persediaan aman · Minimum ' + number(product.minStock) + ' ' + escapeHTML(product.unit) + '</strong><span>Perubahan stok telah tercatat bersama alasan, pelaku, dan stok sebelum/sesudah.</span></div>'
      : '<div class="stock-summary-status stock-summary-status--low"><strong>' + (status === 'out' ? 'Stok habis' : 'Stok masih menipis') + ' · Minimum ' + number(product.minStock) + ' ' + escapeHTML(product.unit) + '</strong><span>Produk tetap muncul pada daftar peringatan stok.</span></div>';
    return '<section class="product-page-heading stock-heading"><div><h1>Penyesuaian Berhasil</h1><p>Persediaan dan riwayat stok sudah diperbarui.</p></div></section>' +
      '<div class="stock-notice stock-notice--success"><strong>' + escapeHTML(actionLabel) + ' ' + escapeHTML(product.name) + ' kini tersedia ' + number(movement.stockAfter) + ' ' + escapeHTML(product.unit) + '.</strong></div>' +
      '<section class="stock-result-card"><div class="stock-confirm-product">' + productThumb(product) + '<div><h2>' + escapeHTML(product.name) + '</h2><p>' + escapeHTML(product.code) + ' · ' + escapeHTML(categoryName(product.categoryId)) + '</p></div><span class="stock-confirm-badge stock-confirm-badge--saved">Tersimpan</span></div>' +
      '<div class="stock-result-summary"><div><span>Stok sebelum</span><strong>' + number(movement.stockBefore) + ' ' + escapeHTML(product.unit) + '</strong></div>' +
      '<div><span>' + (delta >= 0 ? 'Tambahan stok' : 'Pengurangan stok') + '</span><strong class="' + (delta > 0 ? 'is-positive' : delta < 0 ? 'is-negative' : '') + '">' + (delta > 0 ? '+' : '') + number(delta) + ' ' + escapeHTML(product.unit) + '</strong></div>' +
      '<div><span>Stok sesudah</span><strong>' + number(movement.stockAfter) + ' ' + escapeHTML(product.unit) + '</strong></div></div>' +
      '<div class="stock-result-meta"><div><span>Alasan penyesuaian</span><strong>' + escapeHTML(movement.reason) + '</strong>' + (movement.note ? '<p>' + escapeHTML(movement.note) + '</p>' : '') + '</div>' +
      '<div><span>Dilakukan oleh</span><strong>' + escapeHTML(actorName(movement)) + '</strong><p>' + escapeHTML(formatDateTime(movement.createdAt, true)) + '</p></div></div>' +
      statusNotice + '<div class="stock-result-actions"><button class="btn btn--secondary" type="button" data-action="show-list">Kembali ke Daftar Stok</button><button class="btn btn--primary" type="button" data-action="card" data-id="' + escapeHTML(product.id) + '">Lihat Kartu Stok</button></div></section>' +
      '<section class="stock-history-card"><h2>Mutasi terbaru</h2><p>' + escapeHTML(formatDateTime(movement.createdAt, true)) + ' · ' + escapeHTML(movementAction(movement)) + ' · ' + signedQuantity(delta) + ' ' + escapeHTML(product.unit) + ' · ' + number(movement.stockBefore) + ' → ' + number(movement.stockAfter) + ' · ' + escapeHTML(actorName(movement)) + '</p></section>';
  }

  function render() {
    const name = session.nama || 'Pengguna';
    const role = session.role || 'kasir';
    document.getElementById('sidebar-name').textContent = name;
    document.getElementById('header-name').textContent = name;
    document.getElementById('sidebar-role').textContent = role === 'admin' ? 'Administrator' : 'Kasir';
    document.getElementById('role-badge').textContent = role === 'admin' ? 'Admin' : 'Kasir';
    document.getElementById('sidebar-avatar').textContent = initials(name);
    document.getElementById('user-avatar').textContent = initials(name);
    document.getElementById('current-date').textContent = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date());
    document.querySelectorAll('[data-admin-only]').forEach((link) => { link.hidden = !canManage; });

    if (storageError) {
      main.innerHTML = '<section class="product-panel empty-state"><strong>Data stok gagal dimuat</strong><span>Periksa penyimpanan browser, lalu muat ulang halaman.</span></section>';
      return;
    }
    const current = route();
    if (!canManage && current.view !== 'list') {
      navigate('list', null, { replace: true });
      showToast('Akses Kasir hanya dapat melihat stok produk.', true);
      return;
    }
    if (current.view === 'list') main.innerHTML = renderList();
    else if (current.view === 'history') main.innerHTML = canManage ? renderHistory() : renderList();
    else if (current.view === 'adjust') main.innerHTML = canManage ? renderAdjustment(current.id) : renderList();
    else if (current.view === 'confirm') main.innerHTML = canManage ? renderConfirm() : renderList();
    else if (current.view === 'success') main.innerHTML = canManage ? renderSuccess(current.id) : renderList();
    else {
      const product = products().find((entry) => entry.id === current.id);
      main.innerHTML = product
        ? renderCard(product)
        : '<section class="product-panel empty-state"><strong>Produk tidak ditemukan</strong><button class="btn btn--primary" type="button" data-action="show-list">Kembali ke Daftar Stok</button></section>';
    }
  }

  function readAdjustmentDraft() {
    const form = document.getElementById('stock-adjust-form');
    if (!form) return state.formDraft;
    return {
      productId: form.elements.productId.value,
      action: state.formDraft ? state.formDraft.action : 'add',
      amount: form.elements.amount.value,
      reason: form.elements.reason.value,
      note: form.elements.note.value,
    };
  }

  function updateAdjustmentPreview() {
    const draft = readAdjustmentDraft();
    if (!draft) return false;
    state.formDraft = draft;
    const product = products().find((entry) => entry.id === draft.productId);
    const result = calculateAdjustment(draft, product);
    const errorEl = document.getElementById('adjust-amount-error');
    const reasonError = document.getElementById('adjust-reason-error');
    const amountEl = document.getElementById('adjust-amount');
    const reasonEl = document.getElementById('adjust-reason');
    const actionLabel = draft.action === 'add' ? 'Tambahan stok' : draft.action === 'reduce' ? 'Pengurangan stok' : 'Perubahan stok';
    const statusClass = !result.valid ? 'invalid' : result.after === 0 ? 'out' : result.after <= product.minStock ? 'low' : 'safe';
    const statusText = !result.valid ? result.error : statusClass === 'safe' ? 'Aman setelah perubahan' : statusClass === 'low' ? 'Stok masih menipis' : 'Stok akan habis';
    document.getElementById('adjust-product-meta').textContent = product
      ? product.code + ' · ' + categoryName(product.categoryId) + ' · Stok saat ini: ' + number(product.stock) + ' ' + product.unit
      : 'Belum ada produk.';
    const productImage = document.querySelector('.stock-product-select .product-emoji');
    if (productImage) productImage.innerHTML = productThumb(product || {}).replace(/^<span[^>]*>|<\/span>$/g, '');
    document.querySelector('.stock-field-with-unit span').textContent = product ? product.unit : 'unit';
    document.querySelector('.stock-summary-card dt').textContent = 'Stok saat ini';
    document.querySelectorAll('.stock-summary-card dd')[0].textContent = product ? number(product.stock) + ' ' + product.unit : '—';
    document.querySelectorAll('.stock-summary-card dt')[1].textContent = actionLabel;
    const delta = document.querySelectorAll('.stock-summary-card dd')[1];
    delta.textContent = result.delta == null ? '—' : (result.delta > 0 ? '+' : '') + number(result.delta) + ' ' + (product ? product.unit : 'unit');
    delta.classList.toggle('is-change-positive', result.delta > 0);
    delta.classList.toggle('is-change-negative', result.delta < 0);
    document.querySelectorAll('.stock-summary-card dd')[2].textContent = result.valid ? number(result.after) + ' ' + product.unit : 'Tidak valid';
    document.querySelectorAll('.stock-summary-card dd')[2].classList.toggle('is-invalid', !result.valid);
    const statusEl = document.querySelector('.stock-summary-status');
    statusEl.className = 'stock-summary-status stock-summary-status--' + statusClass;
    statusEl.innerHTML = '<strong>' + escapeHTML(statusText) + '</strong><span>' + (product ? 'Batas minimum: ' + number(product.minStock) + ' ' + escapeHTML(product.unit) : '') + '</span>';
    const quantityInvalid = !result.valid && result.error !== 'Pilih alasan penyesuaian.';
    errorEl.textContent = quantityInvalid && draft.amount ? result.error : '';
    amountEl.setAttribute('aria-invalid', String(Boolean(draft.amount) && quantityInvalid));
    const reasonRequired = !draft.reason;
    reasonEl.setAttribute('aria-invalid', String(reasonRequired && Boolean(draft.amount)));
    reasonError.textContent = reasonRequired && draft.amount ? 'Alasan wajib dipilih sebelum meninjau.' : '';
    document.getElementById('review-adjustment').disabled = !result.valid;
    return result.valid;
  }

  function reviewAdjustment(event) {
    event.preventDefault();
    const draft = readAdjustmentDraft();
    state.formDraft = draft;
    const product = products().find((entry) => entry.id === draft.productId);
    const result = calculateAdjustment(draft, product);
    if (!result.valid) {
      updateAdjustmentPreview();
      return;
    }
    state.pendingAdjustment = {
      productId: product.id,
      action: draft.action,
      amount: Number(draft.amount),
      reason: draft.reason,
      note: draft.note.trim(),
      expectedStock: product.stock,
      userId: session.userId,
      userName: session.nama,
    };
    state.saveError = '';
    navigate('confirm', product.id);
  }

  function saveAdjustment() {
    const adjustment = state.pendingAdjustment;
    if (!adjustment) return;
    try {
      const result = ProductStore.adjustStock(adjustment);
      if (!result.ok) {
        state.saveError = result.code === 'stale'
          ? 'Stok produk berubah sebelum disimpan. Periksa stok terbaru lalu tinjau ulang penyesuaian.'
          : result.code === 'negative'
            ? 'Stok tidak boleh menjadi negatif. Periksa kembali jumlah perubahan.'
            : result.code === 'reason'
              ? 'Alasan penyesuaian wajib dipilih.'
              : 'Penyesuaian tidak dapat disimpan. Periksa data lalu coba lagi.';
        state.formDraft = {
          productId: adjustment.productId,
          action: adjustment.action,
          amount: String(adjustment.amount),
          reason: adjustment.reason,
          note: adjustment.note,
        };
        navigate('adjust', adjustment.productId);
        return;
      }
      const adjustedProduct = products().find((entry) => entry.id === adjustment.productId);
      Audit.log({
        action: 'stock.adjust',
        entity: 'product',
        entityId: adjustment.productId,
        summary: (adjustedProduct ? adjustedProduct.name : adjustment.productId) + ' · ' +
          result.movement.stockBefore + ' → ' + result.movement.stockAfter + ' · ' + adjustment.reason,
      });
      state.pendingAdjustment = null;
      state.formDraft = null;
      state.saveError = '';
      navigate('success', result.movement.id);
    } catch (error) {
      console.error('Penyesuaian stok gagal disimpan.', error);
      state.saveError = error.name === 'StockRollbackError'
        ? 'Penyimpanan dan pemulihan otomatis gagal. Muat ulang halaman, lalu periksa stok dan riwayat sebelum mencoba kembali.'
        : 'Penyimpanan gagal. Stok dan riwayat tidak berubah. Periksa penyimpanan browser, lalu coba lagi.';
      render();
    }
  }

  function exportCSV(rows, filename, headers, getValues) {
    const csvRows = [headers].concat(rows.map(getValues));
    const csv = '\uFEFF' + csvRows.map((row) => row.map((value) =>
      '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'
    ).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function exportProducts() {
    const rows = filteredProducts();
    exportCSV(rows, 'laporan-stok-brahamart.csv',
      ['Kode', 'Produk', 'Barcode', 'Kategori', 'Stok', 'Satuan', 'Minimum', 'Status', 'Diperbarui'],
      (product) => [product.code, product.name, product.barcode, categoryName(product.categoryId), product.stock, product.unit, product.minStock, stockLabel(stockStatus(product)), formatDateTime(product.updatedAt || product.createdAt)]);
  }

  function exportHistory() {
    exportCSV(filteredMovements(), 'riwayat-mutasi-stok-brahamart.csv',
      ['Waktu', 'Kode Produk', 'Nama Produk', 'Jenis', 'Jumlah', 'Stok Sebelum', 'Stok Sesudah', 'Alasan', 'Catatan', 'Pelaku'],
      (movement) => {
        const product = movementProduct(movement);
        return [formatDateTime(movement.createdAt), product.code, product.name, movementAction(movement), movement.quantity, movement.stockBefore, movement.stockAfter, movement.reason, movement.note, actorName(movement)];
      });
  }

  function handleAction(action, id, target) {
    if (action === 'show-list') {
      state.pendingAdjustment = null;
      state.saveError = '';
      navigate('list');
    } else if (action === 'show-history') {
      if (!canManage) {
        showToast('Akses Kasir hanya dapat melihat daftar stok.', true);
        return;
      }
      navigate('history');
    } else if (action === 'adjust' || action === 'opname') {
      if (!canManage) {
        showToast('Penyesuaian stok hanya dapat dilakukan oleh Admin.', true);
        return;
      }
      state.saveError = '';
      state.pendingAdjustment = null;
      state.formDraft = {
        productId: id || (products()[0] && products()[0].id) || '',
        action: action === 'opname' ? 'correction' : 'add',
        amount: '',
        reason: '',
        note: '',
      };
      navigate('adjust', state.formDraft.productId);
    } else if (action === 'card') {
      navigate('card', id);
    } else if (action === 'attention') {
      state.onlyAttention = !state.onlyAttention;
      state.page = 1;
      render();
    } else if (action === 'page') {
      const nextPage = Number(target.dataset.page);
      if (target.dataset.group === 'list') state.page = nextPage;
      else if (target.dataset.group === 'history') state.historyPage = nextPage;
      else state.cardPage = nextPage;
      render();
    } else if (action === 'adjust-type') {
      const draft = readAdjustmentDraft();
      draft.action = target.dataset.type;
      if (!reasonsFor(draft.action).includes(draft.reason)) draft.reason = '';
      state.formDraft = draft;
      state.pendingAdjustment = null;
      state.saveError = '';
      navigate('adjust', draft.productId, { replace: true });
    } else if (action === 'edit-adjustment') {
      navigate('adjust', state.pendingAdjustment && state.pendingAdjustment.productId);
    } else if (action === 'save-adjustment') {
      saveAdjustment();
    } else if (action === 'reset-history') {
      state.historySearch = '';
      state.historyType = '';
      state.historyUser = '';
      state.historyFrom = '';
      state.historyTo = '';
      state.historyPage = 1;
      render();
    } else if (action === 'export-products') {
      exportProducts();
    } else if (action === 'export-history') {
      exportHistory();
    }
  }

  main.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    event.preventDefault();
    handleAction(target.dataset.action, target.dataset.id, target);
  });
  main.addEventListener('input', (event) => {
    if (event.target.id === 'stock-search') {
      const selection = event.target.selectionStart;
      state.search = event.target.value;
      state.page = 1;
      render();
      const input = document.getElementById('stock-search');
      input.focus();
      input.setSelectionRange(selection, selection);
    } else if (event.target.id === 'adjust-amount' || event.target.id === 'adjust-note') {
      updateAdjustmentPreview();
    }
  });
  main.addEventListener('change', (event) => {
    if (event.target.id === 'stock-category') {
      state.category = event.target.value;
      state.page = 1;
      render();
    } else if (event.target.id === 'stock-status') {
      state.status = event.target.value;
      state.page = 1;
      render();
    } else if (event.target.id === 'adjust-product' || event.target.id === 'adjust-reason') {
      state.formDraft = readAdjustmentDraft();
      if (event.target.id === 'adjust-product') state.formDraft.reason = '';
      state.pendingAdjustment = null;
      render();
    }
  });
  main.addEventListener('submit', (event) => {
    if (event.target.id === 'stock-adjust-form') {
      reviewAdjustment(event);
    } else if (event.target.id === 'stock-history-filter-form') {
      event.preventDefault();
      const form = event.target;
      state.historySearch = form.elements.search.value;
      state.historyType = form.elements.type.value;
      state.historyUser = form.elements.user.value;
      state.historyFrom = form.elements.from.value;
      state.historyTo = form.elements.to.value;
      state.historyPage = 1;
      state.cardPage = 1;
      render();
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());
  window.addEventListener('popstate', render);

  const sidebar = document.getElementById('products-sidebar');
  const menuToggle = document.getElementById('menu-toggle');
  const backdrop = document.getElementById('products-backdrop');
  function setMenuOpen(isOpen) {
    sidebar.classList.toggle('is-open', isOpen);
    backdrop.hidden = !isOpen;
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('menu-open', isOpen);
  }
  menuToggle.addEventListener('click', () => setMenuOpen(!sidebar.classList.contains('is-open')));
  backdrop.addEventListener('click', () => setMenuOpen(false));
  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenuOpen(false);
  });

  render();
}());
