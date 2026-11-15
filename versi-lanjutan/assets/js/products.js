(function () {
  'use strict';

  const session = Auth.requireAuth(['admin', 'kasir']);
  if (!session) return;

  const canManage = session.role === 'admin';
  const main = document.getElementById('products-main');
  const toast = document.getElementById('products-toast');
  const state = {
    search: '',
    category: '',
    stock: '',
    status: '',
    categorySearch: '',
    page: 1,
    pageSize: 7,
    editingCategoryId: null,
    pendingAction: null,
  };
  let formProductImage = '';
  let formProductEmoji = '📦';
  let storageError = null;
  try {
    ProductStore.ensureSeeded();
  } catch (error) {
    storageError = error;
    console.error('Katalog produk tidak dapat dimuat.', error);
  }

  const formatMoney = (value) => 'Rp ' + new Intl.NumberFormat('id-ID').format(value || 0);
  const escapeHTML = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const products = () => ProductStore.getProducts();
  const categories = () => ProductStore.getCategories();
  const categoryName = (id) => {
    const category = categories().find((item) => item.id === id);
    return category ? category.name : 'Tanpa kategori';
  };
  const stockStatus = (product) => {
    if (product.stock <= 0) return 'out';
    return product.stock <= product.minStock ? 'low' : 'safe';
  };
  const stockLabel = (status) => status === 'out' ? 'Habis' : status === 'low' ? 'Menipis' : 'Aman';
  const initials = (name) => String(name || 'User').trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join('');
  const productThumb = (product, large) => {
    const image = product.image
      ? '<img src="' + escapeHTML(product.image) + '" alt="">'
      : escapeHTML(product.emoji || '📦');
    return '<span class="' + (large ? 'product-detail-emoji' : 'product-emoji') + '" aria-hidden="true">' + image + '</span>';
  };

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function navigate(view, id) {
    const url = new URL(window.location.href);
    if (view === 'list') {
      url.search = '';
    } else {
      url.searchParams.set('view', view);
      if (id) url.searchParams.set('id', id);
      else url.searchParams.delete('id');
    }
    window.history.pushState({}, '', url);
    render();
    window.scrollTo(0, 0);
    main.focus();
  }

  function currentRoute() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'list';
    return {
      view: ['list', 'form', 'detail', 'categories'].includes(view) ? view : 'list',
      id: params.get('id'),
    };
  }

  function renderStats(allProducts) {
    const safe = allProducts.filter((product) => stockStatus(product) === 'safe').length;
    const low = allProducts.filter((product) => stockStatus(product) === 'low').length;
    const out = allProducts.filter((product) => stockStatus(product) === 'out').length;
    const active = allProducts.filter((product) => product.isActive).length;
    return '<section class="product-stats" aria-label="Ringkasan katalog">' +
      '<article class="product-stat"><span>Total Katalog</span><strong>' + allProducts.length + '</strong><small>' + active + ' aktif dijual</small></article>' +
      '<article class="product-stat product-stat--safe"><span>Stok Aman</span><strong>' + safe + '</strong><small>Persediaan optimal</small></article>' +
      '<article class="product-stat product-stat--low"><span>Stok Menipis</span><strong>' + low + '</strong><small>Perlu restock segera</small></article>' +
      '<article class="product-stat product-stat--out"><span>Stok Habis</span><strong>' + out + '</strong><small>Tidak dapat ditambahkan ke keranjang</small></article>' +
      '</section>';
  }

  function renderList() {
    const allProducts = products();
    const allCategories = categories();
    const visibleProducts = allProducts.filter((product) => {
      if (!canManage && !product.isActive) return false;
      if (state.search) {
        const query = state.search.toLowerCase();
        if (!product.name.toLowerCase().includes(query) &&
            !product.code.toLowerCase().includes(query) &&
            !(product.barcode || '').toLowerCase().includes(query)) return false;
      }
      if (state.category && product.categoryId !== state.category) return false;
      if (state.stock && stockStatus(product) !== state.stock) return false;
      if (state.status === 'active' && !product.isActive) return false;
      if (state.status === 'inactive' && product.isActive) return false;
      return true;
    });
    const pageCount = Math.max(1, Math.ceil(visibleProducts.length / state.pageSize));
    state.page = Math.min(state.page, pageCount);
    const pageItems = visibleProducts.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
    const from = visibleProducts.length ? (state.page - 1) * state.pageSize + 1 : 0;
    const to = Math.min(state.page * state.pageSize, visibleProducts.length);
    const categoriesOptions = allCategories.map((category) =>
      '<option value="' + escapeHTML(category.id) + '"' + (state.category === category.id ? ' selected' : '') + '>' +
      escapeHTML(category.name) + '</option>'
    ).join('');
    const rows = pageItems.map((product) => {
      const status = stockStatus(product);
      const actions = canManage
        ? '<button type="button" data-action="detail" data-id="' + escapeHTML(product.id) + '">Detail</button>' +
          '<button type="button" data-action="edit" data-id="' + escapeHTML(product.id) + '">Ubah</button>' +
          '<button type="button" class="' + (product.isActive ? 'text-danger' : '') + '" data-action="toggle-product" data-id="' + escapeHTML(product.id) + '">' + (product.isActive ? 'Nonaktifkan' : 'Aktifkan') + '</button>'
        : '<button type="button" data-action="detail" data-id="' + escapeHTML(product.id) + '">Detail</button>';
      return '<tr>' +
        '<td class="product-code">' + escapeHTML(product.code) + '</td>' +
        '<td><div class="product-name-cell">' + productThumb(product, false) + '<span><strong>' + escapeHTML(product.name) + '</strong><small>' + escapeHTML(product.barcode || product.code) + '</small></span></div></td>' +
        '<td>' + escapeHTML(categoryName(product.categoryId)) + '</td>' +
        '<td class="product-price">' + formatMoney(product.salePrice) + '</td>' +
        '<td class="product-stock">' + escapeHTML(product.stock) + '</td>' +
        '<td>' + escapeHTML(product.unit) + '</td>' +
        '<td><span class="stock-badge stock-badge--' + status + '">' + stockLabel(status) + '</span></td>' +
        (canManage ? '<td><span class="product-status product-status--' + (product.isActive ? 'active' : 'inactive') + '">' + (product.isActive ? 'Aktif' : 'Nonaktif') + '</span></td>' : '') +
        '<td><div class="product-row-actions">' + actions + '</div></td>' +
        '</tr>';
    }).join('');
    const tableHead = '<thead><tr><th scope="col">Kode (SKU)</th><th scope="col">Nama Produk</th><th scope="col">Kategori</th><th scope="col">Harga Jual</th><th scope="col">Stok</th><th scope="col">Satuan</th><th scope="col">Status Stok</th>' +
      (canManage ? '<th scope="col">Status</th>' : '') + '<th scope="col">Aksi</th></tr></thead>';
    const empty = visibleProducts.length
      ? '<div class="product-table-wrap"><table class="product-table">' + tableHead + '<tbody>' + rows + '</tbody></table></div>' +
        '<div class="product-pagination"><span>Menampilkan ' + from + '–' + to + ' dari ' + visibleProducts.length + ' produk</span>' +
        '<div class="pagination-controls"><button type="button" data-action="page" data-page="' + (state.page - 1) + '"' + (state.page <= 1 ? ' disabled' : '') + '>Sebelumnya</button>' +
        '<span>Halaman ' + state.page + ' dari ' + pageCount + '</span>' +
        '<button type="button" data-action="page" data-page="' + (state.page + 1) + '"' + (state.page >= pageCount ? ' disabled' : '') + '>Berikutnya</button></div></div>'
      : '<div class="empty-state"><strong>' + (allProducts.length ? 'Produk tidak ditemukan' : 'Katalog belum memiliki produk') + '</strong><span>' +
        (allProducts.length ? 'Coba ubah kata pencarian atau filter produk.' : 'Tambahkan barang pertama agar kasir dapat mulai berjualan.') + '</span>' +
        (canManage && allProducts.length === 0 ? '<button class="btn btn--primary" type="button" data-action="add-product">Tambah Produk</button>' : '') + '</div>';

    return '<div class="product-page-heading"><div><h1>' + (canManage ? 'Manajemen Produk' : 'Katalog Produk') + '</h1><p>' +
      (canManage ? 'Kelola katalog barang, barcode, harga jual, dan status ketersediaan.' : 'Lihat data barang, harga jual, dan ketersediaan stok.') +
      '</p></div><div class="product-heading-actions">' +
      (canManage ? '<button class="btn btn--secondary" type="button" data-action="categories">Kelola Kategori</button><button class="btn btn--primary" type="button" data-action="add-product">＋ Tambah Produk</button>' : '') +
      '</div></div>' +
      renderStats(allProducts) +
      '<section class="product-panel" aria-labelledby="product-list-title"><div class="product-panel__heading"><h2 id="product-list-title">Daftar Produk</h2><span class="product-panel__count">' +
      allProducts.length + ' produk · ' + allProducts.filter((product) => product.isActive).length + ' aktif · ' + allProducts.filter((product) => !product.isActive).length + ' nonaktif</span></div>' +
      '<form class="product-filters" id="product-filter-form">' +
      '<input id="filter-search" type="search" value="' + escapeHTML(state.search) + '" placeholder="Cari nama barang atau kode barcode..." aria-label="Cari produk">' +
      '<select id="filter-category" aria-label="Filter kategori"><option value="">Semua Kategori</option>' + categoriesOptions + '</select>' +
      '<select id="filter-stock" aria-label="Filter status stok"><option value="">Semua Status Stok</option>' +
      '<option value="safe"' + (state.stock === 'safe' ? ' selected' : '') + '>Aman</option><option value="low"' + (state.stock === 'low' ? ' selected' : '') + '>Menipis</option><option value="out"' + (state.stock === 'out' ? ' selected' : '') + '>Habis</option></select>' +
      (canManage ? '<select id="filter-status" aria-label="Filter status produk"><option value="">Semua Status</option><option value="active"' + (state.status === 'active' ? ' selected' : '') + '>Aktif</option><option value="inactive"' + (state.status === 'inactive' ? ' selected' : '') + '>Nonaktif</option></select>' : '<span></span>') +
      '<button class="btn btn--secondary" type="reset">Reset</button></form>' + empty + '</section>' +
      '<p class="product-note">' + (canManage ? 'Menipis: stok ≤ stok minimum. Produk nonaktif tidak tersedia di kasir.' : 'Akses Kasir: hanya melihat produk aktif dan stok. Perubahan data dilakukan oleh Admin.') + '</p>';
  }

  function renderForm(product) {
    const isEditing = Boolean(product);
    const defaultMinStock = SettingsStore.get().defaultMinStock;
    formProductImage = product && product.image ? product.image : '';
    formProductEmoji = product && product.emoji ? product.emoji : '📦';
    const selectedCategory = product ? product.categoryId : '';
    const categoryOptions = categories().map((category) =>
      '<option value="' + escapeHTML(category.id) + '"' + (selectedCategory === category.id ? ' selected' : '') + '>' +
      escapeHTML(category.name) + '</option>'
    ).join('');
    const inactive = product && !product.isActive;
    return '<a class="page-back" href="produk.html" data-action="back">← Kembali ke Produk</a>' +
      '<div class="product-page-heading"><div><h1>' + (isEditing ? 'Ubah Produk' : 'Tambah Produk') + '</h1><p>' +
      (isEditing ? 'Perbarui informasi produk. Kolom bertanda * wajib diisi.' : 'Tambahkan barang baru ke katalog. Kolom bertanda * wajib diisi.') +
      '</p></div></div>' +
      '<div class="form-alert" id="product-form-error" role="alert" hidden></div>' +
      '<form id="product-form" novalidate><div class="product-form-layout"><div class="product-form-main">' +
      '<section class="product-card"><h2>Informasi Produk</h2><div class="product-form-grid">' +
      '<label class="product-field">Kode barang / barcode *<input id="product-code" name="code" maxlength="60" required value="' + escapeHTML(product ? product.code : '') + '" placeholder="Masukkan kode unik"><span class="field-error" data-error-for="code" hidden></span></label>' +
      '<label class="product-field">Nama produk *<input id="product-name" name="name" maxlength="100" required value="' + escapeHTML(product ? product.name : '') + '" placeholder="Masukkan nama produk"><span class="field-error" data-error-for="name" hidden></span></label>' +
      '<label class="product-field">Kategori *<select id="product-category" name="categoryId" required><option value="">Pilih kategori</option>' + categoryOptions + '</select><span class="field-error" data-error-for="categoryId" hidden></span></label>' +
      '<label class="product-field">Satuan *<select id="product-unit" name="unit" required>' +
      ['pcs', 'pack', 'dus', 'pouch'].map((unit) => '<option value="' + unit + '"' + (product && product.unit === unit ? ' selected' : '') + '>' + unit + '</option>').join('') +
      '</select></label></div>' + (categories().length ? '' : '<p class="form-alert">Buat kategori terlebih dahulu sebelum menambahkan produk.</p>') + '</section>' +
      '<section class="product-card"><h2>Harga</h2><div class="product-form-grid">' +
      '<label class="product-field">Harga beli (Rp) *<input id="product-purchase-price" name="purchasePrice" type="number" min="0" step="1" required value="' + escapeHTML(product ? product.purchasePrice : 0) + '"></label>' +
      '<label class="product-field">Harga jual (Rp) *<input id="product-sale-price" name="salePrice" type="number" min="0" step="1" required value="' + escapeHTML(product ? product.salePrice : 0) + '"></label></div>' +
      '<p class="form-warning" id="price-warning"' + (!product || product.salePrice >= product.purchasePrice ? ' hidden' : '') + '>Harga jual di bawah harga beli. Anda tetap dapat menyimpan.</p></section>' +
      '<section class="product-card"><h2>Persediaan</h2><div class="product-form-grid">' +
      '<label class="product-field">' + (isEditing ? 'Stok saat ini' : 'Stok awal *') + '<input id="product-stock" name="stock" type="number" min="0" step="1" required value="' + escapeHTML(product ? product.stock : 0) + '"' + (isEditing ? ' readonly' : '') + '>' +
      '<span>' + (isEditing ? 'Stok diubah melalui menu Stok agar riwayat tetap tercatat.' : 'Bilangan bulat, tidak boleh negatif.') + '</span></label>' +
      '<label class="product-field">Stok minimum *<input id="product-min-stock" name="minStock" type="number" min="0" step="1" required value="' + escapeHTML(product ? product.minStock : defaultMinStock) + '"><span>Peringatan muncul saat stok ≤ batas ini.</span></label></div></section>' +
      '<section class="product-card product-status-toggle"><div><strong>Status aktif</strong><p>Produk aktif tersedia untuk dicari dan ditambahkan di kasir.</p></div>' +
      '<button class="toggle-switch' + (product && product.isActive ? ' is-on' : !isEditing ? ' is-on' : '') + '" id="product-active-toggle" type="button" aria-pressed="' + (product ? String(product.isActive) : 'true') + '" data-active="' + (product ? String(product.isActive) : 'true') + '">' +
      ((product ? product.isActive : true) ? '✓ Aktif dijual' : 'Nonaktif') + '</button></section>' +
      '<div class="product-form-footer"><button class="btn btn--secondary" type="button" data-action="back">Batal</button><button class="btn btn--primary" type="submit">' + (isEditing ? 'Simpan Perubahan' : 'Simpan Produk') + '</button></div>' +
      '</div><aside class="product-form-aside">' +
      '<section class="product-card"><h2>Foto Produk</h2><div class="product-photo-preview" id="product-photo-preview">' +
      productThumb({ image: formProductImage, emoji: formProductEmoji }, true) + '</div>' +
      '<input class="product-image-input" id="product-image-file" type="file" accept="image/jpeg,image/png" aria-label="Pilih foto produk">' +
      '<div class="product-photo-actions"><button class="btn btn--secondary" type="button" data-action="choose-photo">Ganti Foto</button><button class="btn btn--secondary" type="button" data-action="remove-photo">Hapus</button></div>' +
      '<p>JPG / PNG · Maks. 2 MB</p></section>' +
      '<section class="product-card"><h2>' + (isEditing ? 'Produk yang Diubah' : 'Sebelum Menyimpan') + '</h2>' +
      (isEditing ? '<strong>' + escapeHTML(product.name) + '</strong><p>Kode: ' + escapeHTML(product.code) + '</p><p>Stok saat ini: ' + escapeHTML(product.stock) + ' ' + escapeHTML(product.unit) + '</p><p>Status: ' + (product.isActive ? 'Aktif dijual' : 'Nonaktif') + '</p>' :
        '<ol><li>Gunakan kode barang yang unik.</li><li>Harga dan stok tidak boleh negatif.</li><li>Pilih kategori dan satuan yang sesuai.</li><li>Atur stok minimum untuk peringatan.</li></ol>') +
      '</section><section class="product-card"><h2>Stok Tetap Tercatat</h2><p>' + (isEditing ? 'Stok tidak diubah langsung dari formulir produk. Gunakan penyesuaian stok dengan alasan agar riwayat tetap utuh.' : 'Stok awal akan menjadi saldo pertama produk. Penyesuaian berikutnya dilakukan melalui menu Stok dengan alasan.') + '</p></section>' +
      (canManage ? '<section class="product-card"><h2>Kategori Produk</h2><p>Kategori membantu produk lebih mudah ditemukan dan difilter.</p><button class="text-link" type="button" data-action="categories">Kelola kategori →</button></section>' : '') +
      '</aside></div></form>';
  }

  function renderDetail(product) {
    const status = stockStatus(product);
    const sold = ProductStore.hasBeenSold(product.id);
    const hasStockHistory = ProductStore.hasStockMovements(product.id);
    const stockText = status === 'out' ? 'Stok Habis' : status === 'low' ? 'Stok Menipis' : 'Stok Aman';
    return '<a class="page-back" href="produk.html" data-action="back">← Kembali ke Produk</a>' +
      '<div class="product-page-heading"><div><h1>Detail Produk</h1><p>Informasi lengkap dan status penjualan produk.</p></div>' +
      (canManage ? '<div class="product-heading-actions"><button class="btn btn--secondary" type="button" data-action="toggle-product" data-id="' + escapeHTML(product.id) + '">' + (product.isActive ? 'Nonaktifkan' : 'Aktifkan') + '</button><button class="btn btn--primary" type="button" data-action="edit" data-id="' + escapeHTML(product.id) + '">Ubah Produk</button></div>' : '') + '</div>' +
      '<div class="product-detail-layout"><div class="product-detail-main">' +
      '<section class="product-card product-detail-card"><h2>' + escapeHTML(product.name) + '</h2><div class="product-detail-overview">' +
      productThumb(product, true) +
      '<dl class="product-detail-grid"><div><dt>Kode barang / barcode</dt><dd>' + escapeHTML(product.code) + '</dd></div>' +
      '<div><dt>Kategori</dt><dd>' + escapeHTML(categoryName(product.categoryId)) + '</dd></div>' +
      '<div><dt>Satuan</dt><dd>' + escapeHTML(product.unit) + '</dd></div>' +
      '<div><dt>Status penjualan</dt><dd><span class="product-status product-status--' + (product.isActive ? 'active' : 'inactive') + '">' + (product.isActive ? 'Aktif dijual' : 'Nonaktif') + '</span></dd></div></dl></div></section>' +
      '<section class="product-card"><h2>Harga &amp; Persediaan</h2><dl class="product-detail-grid">' +
      '<div><dt>Harga beli</dt><dd>' + formatMoney(product.purchasePrice) + '</dd></div><div><dt>Harga jual</dt><dd>' + formatMoney(product.salePrice) + '</dd></div>' +
      '<div><dt>Stok saat ini</dt><dd>' + escapeHTML(product.stock) + ' ' + escapeHTML(product.unit) + '</dd></div><div><dt>Stok minimum</dt><dd>' + escapeHTML(product.minStock) + ' ' + escapeHTML(product.unit) + '</dd></div></dl></section>' +
      '<section class="product-card"><h2>Riwayat Produk Tetap Utuh</h2><p>' + (sold || hasStockHistory ? 'Produk ini memiliki riwayat transaksi atau stok. Untuk menghentikan penjualan, nonaktifkan produk tanpa menghapus riwayatnya.' : 'Produk ini belum pernah dicatat pada transaksi atau perubahan stok. Produk dapat dihapus permanen oleh Admin.') + '</p></section>' +
      '</div><aside class="product-detail-aside">' +
      '<section class="product-card product-detail-stock" data-status="' + status + '"><h2>' + stockText + '</h2><strong>' + escapeHTML(product.stock) + ' ' + escapeHTML(product.unit) + '</strong><p>' + (status === 'out' ? 'Produk tidak dapat ditambahkan ke transaksi kasir.' : 'Batas stok minimum ' + escapeHTML(product.minStock) + ' ' + escapeHTML(product.unit) + '.') + '</p><button class="btn btn--secondary" type="button" data-action="stock" data-id="' + escapeHTML(product.id) + '">Buka Manajemen Stok</button></section>' +
      '<section class="product-card"><h2>' + (product.isActive ? 'Aktif Dijual' : 'Produk Nonaktif') + '</h2><p>' + (product.isActive ? 'Produk dapat dicari dan ditambahkan ke transaksi kasir selama stok tersedia.' : 'Produk tidak ditampilkan dalam pencarian kasir.') + '</p></section>' +
      (canManage ? '<section class="product-card product-detail-actions"><h2>Tindakan Produk</h2><button class="text-link" type="button" data-action="edit" data-id="' + escapeHTML(product.id) + '">Ubah informasi produk</button>' +
        (product.isActive ? '<button class="text-link text-danger" type="button" data-action="toggle-product" data-id="' + escapeHTML(product.id) + '">Nonaktifkan produk</button>' :
          '<button class="text-link" type="button" data-action="toggle-product" data-id="' + escapeHTML(product.id) + '">Aktifkan produk</button>') +
        (!sold && !hasStockHistory ? '<button class="text-link text-danger" type="button" data-action="delete-product" data-id="' + escapeHTML(product.id) + '">Hapus permanen</button>' : '<p>Produk dengan riwayat transaksi atau stok tidak dapat dihapus permanen.</p>') + '</section>' : '') +
      '</aside></div>';
  }

  function renderCategories() {
    const allCategories = categories();
    const query = state.categorySearch.trim().toLowerCase();
    const rows = allCategories.filter((category) => category.name.toLowerCase().includes(query)).map((category, index) => {
      const count = products().filter((product) => product.categoryId === category.id).length;
      return '<tr><td>' + (index + 1) + '</td><td><strong>' + escapeHTML(category.name) + '</strong></td><td>' + count + ' produk</td>' +
        '<td>' + (count ? 'Digunakan' : 'Belum digunakan') + '</td><td><div class="product-row-actions">' +
        '<button type="button" data-action="edit-category" data-id="' + escapeHTML(category.id) + '">Ubah</button>' +
        (count ? '<span class="text-muted">Terkunci</span>' : '<button type="button" class="text-danger" data-action="delete-category" data-id="' + escapeHTML(category.id) + '">Hapus</button>') +
        '</div></td></tr>';
    }).join('');
    return '<a class="page-back" href="produk.html" data-action="back">← Kembali ke Produk</a>' +
      '<div class="product-page-heading"><div><h1>Kategori Produk</h1><p>Kelompokkan barang agar katalog mudah ditelusuri.</p></div>' +
      '<div class="product-heading-actions"><button class="btn btn--primary" type="button" data-action="add-category">＋ Tambah Kategori</button></div></div>' +
      '<div class="category-notice"><strong>Kategori yang sedang digunakan tidak dapat dihapus.</strong>Pindahkan produk ke kategori lain terlebih dahulu untuk menghapus kategori.</div>' +
      '<section class="product-panel"><div class="product-panel__heading"><h2>Daftar Kategori</h2><span class="product-panel__count">' + allCategories.length + ' kategori · ' + products().length + ' produk</span></div>' +
      '<div class="product-filters"><input id="filter-category-search" type="search" value="' + escapeHTML(state.categorySearch) + '" placeholder="Cari nama kategori..." aria-label="Cari kategori"><span></span><span></span><span></span></div>' +
      (rows ? '<div class="product-table-wrap"><table class="product-table category-table"><thead><tr><th>No.</th><th>Nama Kategori</th><th>Jumlah Produk</th><th>Penggunaan</th><th>Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
        '<div class="empty-state"><strong>' + (allCategories.length ? 'Kategori tidak ditemukan' : 'Belum ada kategori') + '</strong><span>Tambahkan kategori untuk mengelompokkan produk.</span></div>') +
      '<div class="product-pagination"><span>Menampilkan ' + (rows ? allCategories.filter((category) => category.name.toLowerCase().includes(query)).length : 0) + ' dari ' + allCategories.length + ' kategori</span></div></section>';
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
      main.innerHTML = '<section class="product-panel empty-state"><strong>Data katalog gagal dimuat</strong><span>Periksa penyimpanan browser, lalu muat ulang halaman.</span></section>';
      return;
    }

    const route = currentRoute();
    if (!canManage && (route.view === 'form' || route.view === 'categories')) {
      navigate('list');
      showToast('Akses Kasir hanya dapat melihat katalog produk.', true);
      return;
    }
    if (route.view === 'list') main.innerHTML = renderList();
    else if (route.view === 'categories') main.innerHTML = renderCategories();
    else {
      const product = route.id ? products().find((entry) => entry.id === route.id) : null;
      if (route.view === 'detail') {
        main.innerHTML = product
          ? renderDetail(product)
          : '<section class="product-panel empty-state"><strong>Produk tidak ditemukan</strong><button class="btn btn--secondary" type="button" data-action="back">Kembali ke Produk</button></section>';
      } else {
        main.innerHTML = route.id && !product
          ? '<section class="product-panel empty-state"><strong>Produk tidak ditemukan</strong><button class="btn btn--secondary" type="button" data-action="back">Kembali ke Produk</button></section>'
          : renderForm(product);
      }
    }
  }

  function openCategoryDialog(category) {
    state.editingCategoryId = category ? category.id : null;
    document.getElementById('category-dialog-title').textContent = category ? 'Ubah Kategori' : 'Tambah Kategori';
    document.getElementById('category-name').value = category ? category.name : '';
    document.getElementById('category-error').hidden = true;
    document.getElementById('category-dialog').showModal();
    document.getElementById('category-name').focus();
  }

  function askConfirmation(action, title, message, confirmLabel, isDanger) {
    state.pendingAction = action;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const button = document.getElementById('confirm-action-btn');
    button.textContent = confirmLabel;
    button.classList.toggle('btn--danger', Boolean(isDanger));
    document.getElementById('confirm-dialog').showModal();
  }

  function confirmProductToggle(product) {
    const nextActive = !product.isActive;
    askConfirmation(
      { type: 'toggle-product', id: product.id, active: nextActive },
      nextActive ? 'Aktifkan Produk?' : 'Nonaktifkan Produk?',
      nextActive
        ? product.name + ' akan tersedia kembali di pencarian kasir.'
        : product.name + ' tidak akan dapat ditambahkan di kasir. Riwayat transaksi tetap disimpan.',
      nextActive ? 'Aktifkan Produk' : 'Nonaktifkan Produk',
      !nextActive
    );
  }

  function handleAction(action, id) {
    if (action === 'back') {
      navigate('list');
      return;
    }
    if (action === 'add-product') {
      navigate('form');
      return;
    }
    if (action === 'edit') {
      navigate('form', id);
      return;
    }
    if (action === 'detail') {
      navigate('detail', id);
      return;
    }
    if (action === 'categories') {
      navigate('categories');
      return;
    }
    if (action === 'add-category') {
      openCategoryDialog(null);
      return;
    }
    if (action === 'edit-category') {
      const category = categories().find((entry) => entry.id === id);
      if (category) openCategoryDialog(category);
      return;
    }
    if (action === 'toggle-product') {
      const product = products().find((entry) => entry.id === id);
      if (product) confirmProductToggle(product);
      return;
    }
    if (action === 'delete-product') {
      const product = products().find((entry) => entry.id === id);
      if (!product) return;
      if (ProductStore.hasBeenSold(product.id) || ProductStore.hasStockMovements(product.id)) {
        showToast('Produk dengan riwayat transaksi atau stok hanya dapat dinonaktifkan.', true);
        return;
      }
      askConfirmation(
        { type: 'delete-product', id: product.id },
        'Hapus Produk Permanen?',
        product.name + ' belum pernah ditransaksikan. Data ini akan dihapus permanen dan tidak dapat dikembalikan.',
        'Hapus Permanen',
        true
      );
      return;
    }
    if (action === 'delete-category') {
      const category = categories().find((entry) => entry.id === id);
      if (!category) return;
      if (products().some((product) => product.categoryId === id)) {
        showToast('Kategori yang sedang digunakan tidak dapat dihapus.', true);
        return;
      }
      askConfirmation(
        { type: 'delete-category', id },
        'Hapus Kategori?',
        'Kategori ' + category.name + ' akan dihapus permanen.',
        'Hapus Kategori',
        true
      );
      return;
    }
    if (action === 'stock') window.location.href = 'stok.html?view=adjust&id=' + encodeURIComponent(id);
    if (action === 'choose-photo') document.getElementById('product-image-file').click();
    if (action === 'remove-photo') {
      formProductImage = '';
      document.getElementById('product-image-file').value = '';
      document.getElementById('product-photo-preview').innerHTML = productThumb({ emoji: formProductEmoji }, true);
    }
  }

  function updateProductPhoto(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      showToast('Pilih foto JPG atau PNG dengan ukuran maksimal 2 MB.', true);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => showToast('Foto produk gagal dibaca.', true);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => showToast('File yang dipilih bukan gambar yang valid.', true);
      image.onload = () => {
        try {
          const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas tidak tersedia.');
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          formProductImage = canvas.toDataURL('image/jpeg', 0.78);
          document.getElementById('product-photo-preview').innerHTML = productThumb({
            image: formProductImage,
            emoji: formProductEmoji,
          }, true);
        } catch (error) {
          console.error('Foto produk gagal diproses.', error);
          showToast('Foto produk gagal diproses. Coba pilih gambar lain.', true);
        }
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function completeConfirmation() {
    const action = state.pendingAction;
    state.pendingAction = null;
    if (!action) return;
    if (action.type === 'toggle-product') {
      const list = products();
      const index = list.findIndex((product) => product.id === action.id);
      if (index < 0) return;
      list[index] = { ...list[index], isActive: action.active, updatedAt: new Date().toISOString() };
      try {
        ProductStore.saveProducts(list);
      } catch (error) {
        console.error('Status produk gagal disimpan.', error);
        showToast('Status produk gagal disimpan. Periksa ruang penyimpanan browser.', true);
        return;
      }
      const toggled = list[index];
      Audit.log({
        action: 'product.toggle',
        entity: 'product',
        entityId: toggled.id,
        summary: toggled.name + ' · ' + (action.active ? 'diaktifkan' : 'dinonaktifkan'),
      });
      document.getElementById('confirm-dialog').close();
      render();
      showToast(action.active ? 'Produk berhasil diaktifkan.' : 'Produk dinonaktifkan. Riwayat transaksi tetap tersimpan.');
      return;
    }
    if (action.type === 'delete-product') {
      const removedProduct = products().find((product) => product.id === action.id);
      if (ProductStore.hasBeenSold(action.id)) {
        document.getElementById('confirm-dialog').close();
        showToast('Produk yang pernah ditransaksikan hanya dapat dinonaktifkan.', true);
        return;
      }
      try {
        ProductStore.saveProducts(products().filter((product) => product.id !== action.id));
      } catch (error) {
        console.error('Produk gagal dihapus.', error);
        showToast('Produk gagal dihapus. Periksa ruang penyimpanan browser.', true);
        return;
      }
      Audit.log({
        action: 'product.delete',
        entity: 'product',
        entityId: action.id,
        summary: (removedProduct ? removedProduct.name : '') || action.id,
      });
      document.getElementById('confirm-dialog').close();
      navigate('list');
      showToast('Produk berhasil dihapus permanen.');
      return;
    }
    if (action.type === 'delete-category') {
      if (products().some((product) => product.categoryId === action.id)) {
        document.getElementById('confirm-dialog').close();
        showToast('Kategori yang sedang digunakan tidak dapat dihapus.', true);
        return;
      }
      try {
        ProductStore.saveCategories(categories().filter((category) => category.id !== action.id));
      } catch (error) {
        console.error('Kategori gagal dihapus.', error);
        showToast('Kategori gagal dihapus. Periksa ruang penyimpanan browser.', true);
        return;
      }
      Audit.log({ action: 'category.delete', entity: 'category', entityId: action.id, summary: action.name || action.id });
      document.getElementById('confirm-dialog').close();
      render();
      showToast('Kategori berhasil dihapus.');
    }
  }

  function setFormError(message, fields) {
    const alert = document.getElementById('product-form-error');
    alert.textContent = message;
    alert.hidden = false;
    (fields || []).forEach((field) => {
      const input = document.getElementById('product-' + field);
      if (input) input.setAttribute('aria-invalid', 'true');
    });
    alert.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function saveProduct(event) {
    event.preventDefault();
    main.querySelectorAll('[aria-invalid="true"]').forEach((input) => input.removeAttribute('aria-invalid'));
    main.querySelectorAll('[data-error-for]').forEach((message) => {
      message.textContent = '';
      message.hidden = true;
    });
    const route = currentRoute();
    const existing = route.id ? products().find((product) => product.id === route.id) : null;
    const code = document.getElementById('product-code').value.trim();
    const name = document.getElementById('product-name').value.trim();
    const categoryId = document.getElementById('product-category').value;
    const unit = document.getElementById('product-unit').value;
    const purchasePriceValue = document.getElementById('product-purchase-price').value.trim();
    const salePriceValue = document.getElementById('product-sale-price').value.trim();
    const stockValue = document.getElementById('product-stock').value.trim();
    const minStockValue = document.getElementById('product-min-stock').value.trim();
    const purchasePrice = Number(purchasePriceValue);
    const salePrice = Number(salePriceValue);
    const stock = existing ? existing.stock : Number(stockValue);
    const minStock = Number(minStockValue);
    const activeButton = document.getElementById('product-active-toggle');
    const isActive = activeButton.dataset.active === 'true';
    const errors = [];
    if (!code) errors.push('code');
    if (!name) errors.push('name');
    if (!categoryId || !categories().some((category) => category.id === categoryId)) errors.push('category');
    if (!purchasePriceValue || !Number.isFinite(purchasePrice) || purchasePrice < 0) errors.push('purchase-price');
    if (!salePriceValue || !Number.isFinite(salePrice) || salePrice < 0) errors.push('sale-price');
    if (!stockValue || !Number.isInteger(stock) || stock < 0) errors.push('stock');
    if (!minStockValue || !Number.isInteger(minStock) || minStock < 0) errors.push('min-stock');
    const normalizedCode = code.toLowerCase();
    const duplicate = products().some((product) =>
      product.id !== (existing && existing.id) &&
      (product.code.toLowerCase() === normalizedCode || (product.barcode || '').toLowerCase() === normalizedCode)
    );
    if (duplicate) errors.push('code');
    if (errors.length) {
      const uniqueCode = duplicate;
      setFormError(
        uniqueCode ? 'Kode barang sudah digunakan. Periksa kembali kolom yang ditandai.' : 'Periksa kolom wajib. Harga dan stok harus bernilai nol atau lebih, dan stok harus berupa bilangan bulat.',
        errors
      );
      if (uniqueCode) {
        const fieldError = document.querySelector('[data-error-for="code"]');
        fieldError.textContent = 'Kode barang sudah digunakan.';
        fieldError.hidden = false;
      }
      return;
    }

    const now = new Date().toISOString();
    const product = {
      ...(existing || {}),
      id: existing ? existing.id : 'product-' + Date.now(),
      code,
      barcode: existing && existing.code === code ? existing.barcode : code.replace(/^SKU-/i, ''),
      name,
      categoryId,
      purchasePrice,
      salePrice,
      stock,
      minStock,
      unit,
      isActive,
      image: formProductImage,
      emoji: existing ? existing.emoji : '📦',
      thumb: existing ? existing.thumb : 'product-thumb--plastic',
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    const list = products();
    if (existing) {
      const index = list.findIndex((entry) => entry.id === existing.id);
      list[index] = product;
    } else {
      list.push(product);
      state.page = Math.ceil(list.length / state.pageSize);
    }
    try {
      ProductStore.saveProducts(list);
    } catch (error) {
      console.error('Produk gagal disimpan.', error);
      setFormError('Produk gagal disimpan. Periksa ruang penyimpanan browser, lalu coba lagi.');
      return;
    }
    state.search = '';
    state.category = '';
    state.stock = '';
    state.status = '';
    Audit.log({
      action: existing ? 'product.update' : 'product.create',
      entity: 'product',
      entityId: product.id,
      summary: name + ' · ' + code,
    });
    navigate('list');
    showToast(existing ? 'Perubahan produk berhasil disimpan.' : 'Produk berhasil ditambahkan.');
  }

  function saveCategory(event) {
    event.preventDefault();
    const name = document.getElementById('category-name').value.trim();
    const error = document.getElementById('category-error');
    const duplicate = categories().some((category) =>
      category.id !== state.editingCategoryId && category.name.toLowerCase() === name.toLowerCase()
    );
    if (!name || duplicate) {
      error.textContent = duplicate ? 'Nama kategori sudah digunakan.' : 'Nama kategori wajib diisi.';
      error.hidden = false;
      return;
    }
    const list = categories();
    const now = new Date().toISOString();
    if (state.editingCategoryId) {
      const index = list.findIndex((category) => category.id === state.editingCategoryId);
      if (index < 0) return;
      list[index] = { ...list[index], name, updatedAt: now };
    } else {
      list.push({
        id: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now(),
        name,
        createdAt: now,
      });
    }
    try {
      ProductStore.saveCategories(list);
    } catch (saveError) {
      console.error('Kategori gagal disimpan.', saveError);
      error.textContent = 'Kategori gagal disimpan. Periksa ruang penyimpanan browser, lalu coba lagi.';
      error.hidden = false;
      return;
    }
    Audit.log({
      action: state.editingCategoryId ? 'category.update' : 'category.create',
      entity: 'category',
      entityId: state.editingCategoryId || name,
      summary: name,
    });
    document.getElementById('category-dialog').close();
    state.editingCategoryId = null;
    render();
    showToast('Kategori berhasil disimpan.');
  }

  function refreshListFilters() {
    state.search = document.getElementById('filter-search').value.trim();
    state.category = document.getElementById('filter-category').value;
    state.stock = document.getElementById('filter-stock').value;
    const status = document.getElementById('filter-status');
    state.status = status ? status.value : '';
    state.page = 1;
    render();
    const search = document.getElementById('filter-search');
    if (search) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
  }

  main.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (button) {
      const action = button.dataset.action;
      if (action === 'page') {
        state.page = Number(button.dataset.page);
        render();
      } else {
        handleAction(action, button.dataset.id);
      }
      return;
    }
    if (event.target.id === 'product-active-toggle') {
      const button = event.target;
      const active = button.dataset.active !== 'true';
      button.dataset.active = String(active);
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-on', active);
      button.textContent = active ? '✓ Aktif dijual' : 'Nonaktif';
    }
  });

  main.addEventListener('input', (event) => {
    if (event.target.id === 'filter-search') {
      state.search = event.target.value.trim();
      state.page = 1;
      const position = event.target.selectionStart;
      render();
      const input = document.getElementById('filter-search');
      input.focus();
      input.setSelectionRange(position, position);
    } else if (event.target.id === 'filter-category-search') {
      state.categorySearch = event.target.value;
      const position = event.target.selectionStart;
      render();
      const input = document.getElementById('filter-category-search');
      input.focus();
      input.setSelectionRange(position, position);
    } else if (event.target.id === 'product-sale-price' || event.target.id === 'product-purchase-price') {
      const sale = Number(document.getElementById('product-sale-price').value);
      const purchase = Number(document.getElementById('product-purchase-price').value);
      document.getElementById('price-warning').hidden = !Number.isFinite(sale) || !Number.isFinite(purchase) || sale >= purchase;
    }
  });
  main.addEventListener('change', (event) => {
    if (event.target.id === 'filter-category' || event.target.id === 'filter-stock' || event.target.id === 'filter-status') {
      refreshListFilters();
    } else if (event.target.id === 'product-image-file') {
      updateProductPhoto(event.target.files[0]);
    }
  });
  main.addEventListener('reset', (event) => {
    if (event.target.id !== 'product-filter-form') return;
    event.preventDefault();
    state.search = '';
    state.category = '';
    state.stock = '';
    state.status = '';
    state.page = 1;
    render();
  });
  main.addEventListener('submit', (event) => {
    if (event.target.id === 'product-form') saveProduct(event);
  });

  document.getElementById('category-form').addEventListener('submit', saveCategory);
  document.querySelector('[data-close-category]').addEventListener('click', () => {
    document.getElementById('category-dialog').close();
  });
  document.getElementById('confirm-form').addEventListener('submit', (event) => {
    event.preventDefault();
    completeConfirmation();
  });
  document.querySelector('[data-cancel-confirm]').addEventListener('click', () => {
    state.pendingAction = null;
    document.getElementById('confirm-dialog').close();
  });
  document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());
  const sidebar = document.getElementById('products-sidebar');
  const menuToggle = document.getElementById('menu-toggle');
  const backdrop = document.getElementById('products-backdrop');
  function setMenuOpen(isOpen) {
    sidebar.classList.toggle('is-open', isOpen);
    backdrop.hidden = !isOpen;
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Tutup navigasi' : 'Buka navigasi');
  }
  menuToggle.addEventListener('click', () => setMenuOpen(!sidebar.classList.contains('is-open')));
  backdrop.addEventListener('click', () => setMenuOpen(false));
  window.addEventListener('popstate', render);
  render();
})();
