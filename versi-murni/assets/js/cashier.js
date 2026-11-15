(function () {
  'use strict';

  const session = Auth.requireAuth(['admin', 'kasir']);
  if (!session) return;

  ProductStore.ensureSeeded();
  let settings = SettingsStore.get();
  function getPosProducts() {
    return ProductStore.getProducts()
    .filter((product) => product.isActive)
    .map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.code,
      barcode: product.barcode || product.code,
      price: product.salePrice,
      stock: product.stock,
      unit: product.unit || 'pcs',
      emoji: product.emoji || '📦',
      thumb: product.thumb || 'product-thumb--plastic',
    }));
  }
  let products = getPosProducts();
  const quickProductIds = ['plastic', 'tea', 'bread', 'lighter'];
  const cart = new Map();
  const itemDiscounts = new Map();
  let discount = { type: 'nominal', value: 0, approvedBy: '' };
  let discountTargetProductId = null;
  let paymentMethod = settings.paymentMethods[0];
  let lastCompletedTransaction = null;

  const element = (id) => document.getElementById(id);
  const formatMoney = (value) => 'Rp ' + new Intl.NumberFormat('id-ID').format(value);
  const formatNumber = (value) => new Intl.NumberFormat('id-ID').format(value);
  const escapeHTML = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const now = new Date();
  const dateKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const localTodayKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const userName = session.nama || 'Kasir';
  const userRole = session.role || 'kasir';
  const initials = userName.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');

  function getTransactions() {
    const stored = DB.read(KEYS.transactions, []);
    return Array.isArray(stored) ? stored : [];
  }

  function getTransactionId() {
    const prefix = 'TRX-' + dateKey + '-';
    const highest = getTransactions().reduce((max, transaction) => {
      if (!transaction || typeof transaction.id !== 'string' || !transaction.id.startsWith(prefix)) return max;
      const sequence = Number(transaction.id.slice(prefix.length));
      return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
    }, 0);
    return prefix + String(highest + 1).padStart(4, '0');
  }

  function setTransactionId() {
    const id = getTransactionId();
    element('transaction-id').textContent = id;
    element('payment-transaction-id').textContent = id;
    element('dialog-transaction-id').textContent = id;
  }

  function getDailyReceiptCount() {
    return getTransactions().filter((transaction) => {
      if (!transaction || typeof transaction.createdAt !== 'string' || transaction.status === 'dibatalkan') return false;
      const createdAt = new Date(transaction.createdAt);
      return !Number.isNaN(createdAt.getTime()) &&
        [createdAt.getFullYear(), String(createdAt.getMonth() + 1).padStart(2, '0'), String(createdAt.getDate()).padStart(2, '0')].join('-') === localTodayKey;
    }).length;
  }

  function getSubtotal() {
    return Array.from(cart.entries()).reduce((sum, [id, quantity]) => {
      const product = products.find((item) => item.id === id);
      return product ? sum + product.price * quantity : sum;
    }, 0);
  }

  function getItemCount() {
    return Array.from(cart.values()).reduce((sum, quantity) => sum + quantity, 0);
  }

  function getTransactionDiscountAmount(subtotal) {
    if (discount.type === 'percent') return Math.min(subtotal, Math.round(subtotal * discount.value / 100));
    return Math.min(subtotal, discount.value);
  }

  function getItemDiscountAmount(id, quantity) {
    const itemDiscount = itemDiscounts.get(id);
    const product = products.find((entry) => entry.id === id);
    if (!itemDiscount || !product) return 0;
    const lineSubtotal = product.price * quantity;
    return itemDiscount.type === 'percent'
      ? Math.min(lineSubtotal, Math.round(lineSubtotal * itemDiscount.value / 100))
      : Math.min(lineSubtotal, itemDiscount.value * quantity);
  }

  function getTotalItemDiscount() {
    return Array.from(cart.entries()).reduce((sum, [id, quantity]) =>
      sum + getItemDiscountAmount(id, quantity), 0);
  }

  function getSubtotalAfterItemDiscount() {
    return Math.max(0, getSubtotal() - getTotalItemDiscount());
  }

  function getTotal() {
    const subtotal = getSubtotalAfterItemDiscount();
    const total = Math.max(0, subtotal - getTransactionDiscountAmount(subtotal));
    return settings.roundTo100 ? Math.round(total / 100) * 100 : total;
  }

  function getCashReceived() {
    const digits = element('cash-received').value.replace(/\D/g, '');
    return digits ? Number(digits) : 0;
  }

  function getDialogCashReceived() {
    const digits = element('cash-received-dialog').value.replace(/\D/g, '');
    return digits ? Number(digits) : 0;
  }

  function renderCart() {
    const body = element('cart-items');
    const table = document.querySelector('.cart-table');
    const entries = Array.from(cart.entries());
    table.hidden = entries.length === 0;
    element('cart-empty').hidden = entries.length > 0;
    element('item-count').textContent = getItemCount() + ' Item';
    element('total-item-count').textContent = getItemCount() + ' Item';

    body.innerHTML = entries.map(([id, quantity]) => {
      const product = products.find((item) => item.id === id);
      if (!product) return '';
      const itemDiscount = getItemDiscountAmount(id, quantity);
      return '<tr>' +
        '<td><div class="cart-product">' +
        '<span class="product-thumb ' + escapeHTML(product.thumb) + '" aria-hidden="true">' + escapeHTML(product.emoji) + '</span>' +
        '<span class="cart-product__copy"><strong>' + escapeHTML(product.name) + '</strong><span>' + escapeHTML(product.sku) + '</span><b>' + formatMoney(product.price) + ' / ' + escapeHTML(product.unit) + '</b>' +
        (itemDiscount ? '<small>Diskon item: − ' + formatMoney(itemDiscount) + '</small>' : '') +
        '<button class="text-button cart-item-discount" type="button" data-action="discount" data-id="' + escapeHTML(id) + '">' +
        (itemDiscount ? 'Ubah diskon item' : 'Tambah diskon item') + '</button></span>' +
        '</div></td>' +
        '<td><div class="quantity-control" aria-label="Jumlah ' + escapeHTML(product.name) + '">' +
        '<button type="button" data-action="decrease" data-id="' + escapeHTML(id) + '" aria-label="Kurangi ' + escapeHTML(product.name) + '">−</button>' +
        '<output>' + quantity + '</output>' +
        '<button type="button" data-action="increase" data-id="' + escapeHTML(id) + '" aria-label="Tambah ' + escapeHTML(product.name) + '">+</button>' +
        '</div></td>' +
        '<td class="cart-subtotal">' + formatMoney(product.price * quantity - itemDiscount) + '</td>' +
        '<td><button class="remove-item" type="button" data-action="remove" data-id="' + escapeHTML(id) + '" aria-label="Hapus ' + escapeHTML(product.name) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></button></td>' +
        '</tr>';
    }).join('');

    renderPayment();
  }

  function renderPayment() {
    const subtotal = getSubtotal();
    const discountAmount = getTotalItemDiscount() +
      getTransactionDiscountAmount(getSubtotalAfterItemDiscount());
    const total = getTotal();
    const received = getCashReceived();
    element('subtotal-value').textContent = formatMoney(subtotal);
    element('discount-value').textContent = formatMoney(discountAmount);
    element('total-value').textContent = formatMoney(total);
    element('exact-cash-btn').querySelector('span').textContent = formatMoney(total);
    element('change-value').textContent = formatMoney(Math.max(0, received - total));
    element('cash-error').hidden = true;
    element('pay-btn').disabled = cart.size === 0;
    renderPaymentDialog();
  }

  function renderPaymentDialog() {
    const total = getTotal();
    const itemCount = getItemCount();
    const dialog = element('payment-dialog');
    element('dialog-total').textContent = formatMoney(total);
    element('dialog-item-count').textContent = itemCount + ' produk dalam keranjang kasir';
    element('dialog-transaction-id').textContent = getTransactionId();
    element('dialog-change').textContent = formatMoney(
      paymentMethod === 'Tunai' ? Math.max(0, getDialogCashReceived() - total) : 0
    );
    element('dialog-cash-section').hidden = paymentMethod !== 'Tunai';
    element('dialog-noncash-note').hidden = paymentMethod === 'Tunai';
    element('finish-payment-btn').disabled = cart.size === 0;
    if (dialog.open) element('dialog-cash-error').hidden = true;
  }

  function setCashReceived(value, source) {
    const digits = String(value).replace(/\D/g, '').slice(0, 12);
    const formatted = digits ? formatNumber(Number(digits)) : '';
    if (source !== 'main') element('cash-received').value = formatted;
    if (source !== 'dialog') element('cash-received-dialog').value = formatted;
    element('cash-error').hidden = true;
    element('dialog-cash-error').hidden = true;
    renderPayment();
  }

  function addProduct(product) {
    const quantity = cart.get(product.id) || 0;
    if (quantity >= product.stock) {
      showToast(product.stock > 0 ? 'Stok ' + product.name + ' tidak mencukupi.' : product.name + ' sedang habis.', true);
      return;
    }
    products = getPosProducts();
    renderQuickProducts();
    if (quantity >= 99) {
      showToast('Jumlah maksimal untuk produk ini adalah 99.', true);
      return;
    }
    cart.set(product.id, quantity + 1);
    renderCart();
    element('product-query').value = '';
    element('search-results').hidden = true;
    element('product-query').focus();
    showToast(product.name + ' ditambahkan ke keranjang.');
  }

  function renderQuickProducts() {
    element('quick-products').innerHTML = quickProductIds.map((id) => {
      const product = products.find((item) => item.id === id);
      if (!product || product.stock <= 0) return '';
      return '<button class="quick-product" type="button" data-quick-id="' + escapeHTML(product.id) + '">' +
        '<strong>' + escapeHTML(product.name) + '</strong><span>' + formatMoney(product.price) + '</span></button>';
    }).join('');
  }

  function renderSearchResults(query) {
    const results = element('search-results');
    const normalized = query.trim().toLowerCase();
    const matches = (normalized
      ? products.filter((product) =>
          product.name.toLowerCase().includes(normalized) ||
          product.sku.toLowerCase().includes(normalized) ||
          product.barcode.includes(normalized)
        )
      : products
    ).slice().sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0));

    results.innerHTML = matches.length
      ? matches.map((product) => {
          const soldOut = product.stock <= 0;
          return '<button class="search-result' + (soldOut ? ' is-sold-out' : '') + '" type="button" role="option" ' +
          'aria-disabled="' + soldOut + '" data-result-id="' + escapeHTML(product.id) + '">' +
          '<span class="product-thumb ' + escapeHTML(product.thumb) + '" aria-hidden="true">' + escapeHTML(product.emoji) + '</span>' +
          '<span class="search-result__copy"><strong>' + escapeHTML(product.name) + '</strong><span>' + escapeHTML(product.sku) +
          (soldOut
            ? ' · <span class="search-result__soldout">Stok habis</span>'
            : ' · Stok ' + formatNumber(product.stock) + ' ' + escapeHTML(product.unit)) +
          '</span></span>' +
          '<span class="search-result__price">' + formatMoney(product.price) + '</span></button>';
        }).join('')
      : '<p class="search-empty">Produk tidak ditemukan. Periksa nama atau barcode.</p>';
    results.hidden = false;
  }

  function searchProduct() {
    const query = element('product-query').value.trim();
    if (!query) {
      renderSearchResults('');
      return;
    }
    const exact = products.find((product) => product.barcode === query || product.sku.toLowerCase() === query.toLowerCase());
    if (exact) {
      addProduct(exact);
      return;
    }
    renderSearchResults(query);
  }

  function showToast(message, isError) {
    const toast = element('pos-toast');
    toast.textContent = message;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3000);
  }

  function openCancelDialog() {
    if (cart.size === 0 && discount.value === 0 && itemDiscounts.size === 0) {
      showToast('Tidak ada barang di keranjang untuk dibatalkan.');
      return;
    }
    element('cancel-dialog').showModal();
  }

  function resetTransaction() {
    cart.clear();
    itemDiscounts.clear();
    discount = { type: 'nominal', value: 0, approvedBy: '' };
    discountTargetProductId = null;
    paymentMethod = settings.paymentMethods[0];
    element('cash-received').value = '';
    element('discount-type').value = 'nominal';
    element('discount-input').value = '0';
    element('discount-admin-username').value = '';
    element('discount-admin-password').value = '';
    element('discount-approval').hidden = true;
    renderMethods();
    updatePaymentMethod();
    renderCart();
    setTransactionId();
  }

  function updatePaymentMethod() {
    const isCash = paymentMethod === 'Tunai';
    element('cash-section').hidden = !isCash;
    element('noncash-note').hidden = isCash;
    element('pay-btn').textContent = isCash ? 'Proses Pembayaran' : 'Konfirmasi ' + paymentMethod;
    if (isCash) {
      const kbd = document.createElement('kbd');
      kbd.textContent = 'Enter';
      element('pay-btn').appendChild(kbd);
    }
    renderMethods();
    renderPayment();
  }

  function renderMethods() {
    const labels = { Tunai: 'Tunai', QRIS: 'QRIS', 'Debit/Transfer': 'Debit / Transfer' };
    [element('payment-methods'), element('dialog-payment-methods')].forEach((group) => {
      group.innerHTML = settings.paymentMethods.map((method) => {
        const selected = method === paymentMethod;
        const label = method === 'Tunai' && group.id === 'dialog-payment-methods'
          ? 'Tunai (Cash)'
          : method === 'QRIS' && group.id === 'dialog-payment-methods'
            ? 'QRIS (Manual)'
            : labels[method];
        return '<button type="button" role="tab" aria-selected="' + selected + '" class="' +
          (selected ? 'is-selected' : '') + '" data-method="' + method + '">' + label + '</button>';
      }).join('');
      group.style.gridTemplateColumns = 'repeat(' + settings.paymentMethods.length + ', minmax(0, 1fr))';
    });
  }

  function selectPaymentMethod(method) {
    if (!settings.paymentMethods.includes(method)) return;
    paymentMethod = method;
    element('cash-error').hidden = true;
    element('dialog-cash-error').hidden = true;
    updatePaymentMethod();
  }

  function openPaymentDialog() {
    if (cart.size === 0) {
      showToast('Tambahkan produk sebelum memproses pembayaran.', true);
      return;
    }
    element('dialog-cash-error').hidden = true;
    renderPaymentDialog();
    element('payment-dialog').showModal();
    if (paymentMethod === 'Tunai') element('cash-received-dialog').focus();
  }

  function completePayment() {
    if (!element('payment-dialog').open) return;
    if (cart.size === 0) {
      showToast('Tambahkan produk sebelum memproses pembayaran.', true);
      return;
    }
    const grossSubtotal = getSubtotal();
    const itemDiscount = getTotalItemDiscount();
    const subtotal = grossSubtotal - itemDiscount;
    const transactionDiscount = getTransactionDiscountAmount(subtotal);
    const discountAmount = itemDiscount + transactionDiscount;
    const total = getTotal();
    const rounding = total - (subtotal - transactionDiscount);
    const taxIncluded = settings.vatRate
      ? Math.round(total - total / (1 + settings.vatRate / 100))
      : 0;
    if (!settings.paymentMethods.includes(paymentMethod)) {
      showToast('Metode pembayaran ini sudah dinonaktifkan. Muat ulang halaman kasir.', true);
      return;
    }
    const received = paymentMethod === 'Tunai' ? getDialogCashReceived() : total;
    if (paymentMethod === 'Tunai' && received < total) {
      const error = element('dialog-cash-error');
      error.textContent = 'Uang diterima kurang ' + formatMoney(total - received) + '.';
      error.hidden = false;
      element('cash-received-dialog').focus();
      return;
    }

    const createdAt = new Date().toISOString();
    const transaction = {
      id: getTransactionId(),
      createdAt,
      cashierId: session.userId,
      cashierName: userName,
      paymentMethod,
      itemCount: getItemCount(),
      items: Array.from(cart.entries()).map(([id, quantity]) => {
        const product = products.find((item) => item.id === id);
        const itemDiscountDetails = itemDiscounts.get(id);
        const itemDiscountValue = getItemDiscountAmount(id, quantity);
        return {
          productId: id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          price: product.price,
          quantity,
          discount: itemDiscountValue,
          discountType: itemDiscountDetails ? itemDiscountDetails.type : '',
          discountValue: itemDiscountDetails ? itemDiscountDetails.value : 0,
          discountApprovedBy: itemDiscountDetails ? itemDiscountDetails.approvedBy : '',
          subtotal: product.price * quantity - itemDiscountValue,
        };
      }),
      subtotal,
      grossSubtotal,
      itemDiscount,
      discount: transactionDiscount,
      totalDiscount: discountAmount,
      discountType: discount.type,
      discountValue: discount.value,
      discountApprovedBy: discount.approvedBy,
      total,
      rounding,
      vatRate: settings.vatRate,
      taxIncluded,
      received,
      change: Math.max(0, received - total),
    };

    try {
      const result = ProductStore.commitSale(transaction);
      if (!result.ok) {
        const dialogError = element('dialog-cash-error');
        dialogError.textContent = result.code === 'changed'
          ? 'Harga atau status produk berubah. Muat ulang halaman kasir sebelum mencoba lagi.'
          : result.code === 'unavailable'
            ? result.productName + ' sudah tidak tersedia. Muat ulang halaman kasir sebelum mencoba lagi.'
            : 'Stok ' + result.productName + ' tidak mencukupi. Perbarui keranjang sebelum mencoba lagi.';
        dialogError.hidden = false;
        return;
      }
    } catch (error) {
      console.error('Gagal menyimpan transaksi.', error);
      const dialogError = element('dialog-cash-error');
      dialogError.textContent = 'Transaksi tidak tersimpan. Periksa ruang penyimpanan browser.';
      dialogError.hidden = false;
      return;
    }

    lastCompletedTransaction = transaction;
    element('payment-dialog').close();
    resetTransaction();
    element('receipt-count').textContent = formatNumber(getDailyReceiptCount());
    renderReceipt(transaction);
    element('receipt-dialog').showModal();
  }

  function methodLabel(method) {
    if (method === 'Tunai') return 'Tunai (Cash)';
    if (method === 'QRIS') return 'QRIS (Manual)';
    return 'Debit / Transfer';
  }

  function renderReceipt(transaction) {
    const date = new Date(transaction.createdAt);
    const dateTime = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(date);
    const dateShort = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date);
    const method = methodLabel(transaction.paymentMethod);

    element('success-transaction-id').textContent = transaction.id;
    element('success-transaction-date').textContent = dateShort;
    element('success-total').textContent = formatMoney(transaction.total);
    element('success-method').textContent = method;
    element('success-received').textContent = formatMoney(transaction.received);
    element('success-change').textContent = formatMoney(transaction.change);
    element('receipt-number').textContent = transaction.id;
    element('receipt-date').textContent = dateTime;
    element('receipt-cashier').textContent = userName + ' [' + (session.username || 'kasir') + ']';
    element('receipt-subtotal-label').textContent = 'Subtotal (' + transaction.itemCount + ' item)';
    element('receipt-subtotal').textContent = formatMoney(
      transaction.grossSubtotal == null ? transaction.subtotal + (transaction.itemDiscount || 0) : transaction.grossSubtotal
    );
    element('receipt-discount').textContent = formatMoney(transaction.discount);
    element('receipt-transaction-discount-row').hidden = !transaction.discount;
    element('receipt-item-discount-row').hidden = !transaction.itemDiscount;
    element('receipt-item-discount').textContent = formatMoney(transaction.itemDiscount || 0);
    const roundingRow = element('receipt-rounding-row');
    roundingRow.hidden = !transaction.rounding;
    element('receipt-rounding').textContent = formatMoney(transaction.rounding || 0);
    const taxRow = element('receipt-tax-row');
    taxRow.hidden = !transaction.vatRate;
    element('receipt-tax-label').textContent = 'PPN termasuk (' + transaction.vatRate + '%)';
    element('receipt-tax-value').textContent = formatMoney(transaction.taxIncluded || 0);
    element('receipt-total').textContent = formatMoney(transaction.total);
    element('receipt-method-label').textContent = method;
    element('receipt-received').textContent = formatMoney(transaction.received);
    element('receipt-change').textContent = formatMoney(transaction.change);
    element('receipt-barcode-text').textContent = transaction.id.replace(/-/g, '');
    element('receipt-store-name').textContent = settings.storeName;
    element('receipt-store-address').textContent = settings.storeAddress;
    element('receipt-store-phone').textContent = settings.storePhone ? 'Telp: ' + settings.storePhone : '';
    element('receipt-store-address').hidden = !settings.storeAddress;
    element('receipt-store-phone').hidden = !settings.storePhone;
    element('receipt-footer-text').textContent = settings.receiptFooter;
    element('receipt-tax-note').textContent = '*PPN ' + transaction.vatRate + '% sudah termasuk dalam harga';
    element('receipt-tax-note').hidden = !transaction.vatRate;
    element('receipt-dialog').dataset.paperSize = settings.receiptPaperSize;
    element('receipt-items').innerHTML = transaction.items.map((item) =>
      '<div class="receipt-paper__item">' +
      '<span>' + escapeHTML(item.name) + '</span>' +
      '<div><span>' + item.quantity + ' ' + escapeHTML(item.unit || 'pcs') + ' x ' + formatMoney(item.price) + '</span><strong>' +
      formatMoney(item.quantity * item.price) + '</strong></div>' +
      (item.discount ? '<div><span>Diskon item</span><strong>− ' + formatMoney(item.discount) + '</strong></div>' : '') +
      '<div><span>Subtotal</span><strong>' + formatMoney(item.subtotal == null ? item.price * item.quantity : item.subtotal) + '</strong></div></div>'
    ).join('');
  }

  function closeReceipt() {
    if (element('receipt-dialog').open) element('receipt-dialog').close();
    lastCompletedTransaction = null;
    element('product-query').focus();
  }

  function printReceipt() {
    if (!lastCompletedTransaction) return;
    window.print();
  }

  function openDiscountDialog(productId) {
    if (!cart.size) {
      showToast('Tambahkan produk sebelum menerapkan diskon.', true);
      return;
    }
    discountTargetProductId = productId || null;
    const itemDiscount = discountTargetProductId
      ? itemDiscounts.get(discountTargetProductId) || { type: 'nominal', value: 0 }
      : discount;
    const product = discountTargetProductId
      ? products.find((entry) => entry.id === discountTargetProductId)
      : null;
    element('discount-dialog-title').textContent = product ? 'Diskon Item' : 'Diskon Transaksi';
    element('discount-dialog-description').textContent = product
      ? 'Diskon nominal berlaku per unit untuk ' + product.name + '.'
      : 'Terapkan diskon untuk subtotal setelah diskon item.';
    element('discount-type').value = itemDiscount.type;
    element('discount-input').value = String(itemDiscount.value);
    element('discount-error').hidden = true;
    element('discount-approval').hidden = true;
    element('discount-admin-username').value = '';
    element('discount-admin-password').value = '';
    element('discount-dialog').showModal();
    element('discount-input').focus();
  }

  async function applyDiscount() {
    const value = Number(element('discount-input').value);
    const type = element('discount-type').value;
    const product = discountTargetProductId
      ? products.find((entry) => entry.id === discountTargetProductId)
      : null;
    const base = product ? product.price : getSubtotalAfterItemDiscount();
    const error = element('discount-error');
    if (discountTargetProductId && !product) {
      error.textContent = 'Produk tidak tersedia di keranjang.';
      error.hidden = false;
      return;
    }
    if (!Number.isFinite(value) || value < 0 ||
        (type === 'percent' && value > 100) ||
        (type === 'nominal' && value > base)) {
      error.textContent = type === 'percent'
        ? 'Persentase diskon harus antara 0 dan 100.'
        : 'Nominal diskon tidak boleh melebihi ' + (product ? 'harga per unit.' : 'subtotal.');
      error.hidden = false;
      return;
    }

    const grossSubtotal = getSubtotal();
    const currentItemDiscount = getTotalItemDiscount();
    let proposedItemDiscount = currentItemDiscount;
    let proposedTransactionDiscount = getTransactionDiscountAmount(getSubtotalAfterItemDiscount());
    if (product) {
      const quantity = cart.get(product.id) || 0;
      const lineSubtotal = product.price * quantity;
      const currentDiscount = getItemDiscountAmount(product.id, quantity);
      const nextDiscount = type === 'percent'
        ? Math.min(lineSubtotal, Math.round(lineSubtotal * value / 100))
        : Math.min(lineSubtotal, value * quantity);
      proposedItemDiscount += nextDiscount - currentDiscount;
      proposedTransactionDiscount = getTransactionDiscountAmount(grossSubtotal - proposedItemDiscount);
    } else {
      const transactionBase = getSubtotalAfterItemDiscount();
      proposedTransactionDiscount = type === 'percent'
        ? Math.min(transactionBase, Math.round(transactionBase * value / 100))
        : Math.min(transactionBase, value);
    }
    const totalDiscountPercent = grossSubtotal
      ? (proposedItemDiscount + proposedTransactionDiscount) / grossSubtotal * 100
      : 0;
    let approvedBy = '';
    if (userRole !== 'admin' && totalDiscountPercent > 10) {
      const approval = element('discount-approval');
      approval.hidden = false;
      const username = element('discount-admin-username').value.trim().toLowerCase();
      const password = element('discount-admin-password').value;
      if (!username || !password) {
        error.textContent = 'Masukkan username dan kata sandi Admin untuk menyetujui diskon di atas 10%.';
        error.hidden = false;
        (username ? element('discount-admin-password') : element('discount-admin-username')).focus();
        return;
      }
      let passwordHash;
      try {
        passwordHash = await sha256(password);
      } catch (failure) {
        console.error('Persetujuan diskon gagal diverifikasi.', failure);
        error.textContent = 'Persetujuan Admin tidak dapat diverifikasi pada browser ini.';
        error.hidden = false;
        return;
      }
      const admin = DB.getUsers().find((user) =>
        user && user.role === 'admin' && user.isActive &&
        (String(user.username || '').toLowerCase() === username ||
          String(user.email || '').toLowerCase() === username) &&
        user.passwordHash === passwordHash
      );
      if (!admin) {
        error.textContent = 'Akun Admin atau kata sandi tidak valid.';
        error.hidden = false;
        element('discount-admin-password').focus();
        return;
      }
      approvedBy = admin.nama || admin.username;
    }

    if (discountTargetProductId) {
      if (value) itemDiscounts.set(discountTargetProductId, { type, value, approvedBy });
      else itemDiscounts.delete(discountTargetProductId);
    } else {
      discount = { type, value, approvedBy };
    }
    element('discount-dialog').close();
    element('discount-admin-password').value = '';
    renderCart();
    showToast(value ? 'Diskon berhasil diterapkan.' : 'Diskon dihapus.');
  }

  element('header-name').textContent = userName;
  element('sidebar-name').textContent = userName;
  element('sidebar-role').textContent = userRole;
  element('role-badge').textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
  element('user-avatar').textContent = initials;
  element('sidebar-avatar').textContent = initials;
  element('current-date').textContent = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(now);
  element('shift-label').textContent = now.getHours() < 12 ? 'Shift Pagi' : now.getHours() < 18 ? 'Shift Siang' : 'Shift Malam';
  element('cashier-id').textContent = session.staffCode || staffCodeFor(session.role, session.userId);
  element('receipt-count').textContent = formatNumber(getDailyReceiptCount());
  element('vat-label').textContent = 'PPN (' + settings.vatRate + '%)';
  element('rounding-note').textContent = settings.roundTo100
    ? 'Pembulatan Rp100 aktif sesuai pengaturan toko'
    : 'Harga final tanpa pembulatan tambahan';
  document.querySelectorAll('[data-admin-only]').forEach((link) => {
    link.hidden = userRole !== 'admin';
  });
  renderMethods();
  setTransactionId();
  renderQuickProducts();
  renderCart();
  setCashReceived('');
  element('logout-btn').addEventListener('click', () => Auth.logout());

  element('product-search').addEventListener('submit', (event) => {
    event.preventDefault();
    searchProduct();
  });
  element('product-query').addEventListener('input', (event) => {
    const query = event.currentTarget.value.trim();
    if (query) renderSearchResults(query);
    else element('search-results').hidden = true;
  });
  element('product-query').addEventListener('focus', () => {
    if (element('product-query').value.trim()) renderSearchResults(element('product-query').value);
  });
  element('search-results').addEventListener('click', (event) => {
    const button = event.target.closest('[data-result-id]');
    if (!button) return;
    const product = products.find((item) => item.id === button.dataset.resultId);
    if (product) addProduct(product);
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.product-search')) element('search-results').hidden = true;
  });
  element('cart-items').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const quantity = cart.get(id) || 0;
    if (button.dataset.action === 'discount') {
      openDiscountDialog(id);
      return;
    }
    if (button.dataset.action === 'increase') {
      const product = products.find((item) => item.id === id);
      if (!product || quantity >= Math.min(99, product.stock)) {
        showToast('Stok produk tidak mencukupi.', true);
        return;
      }
      cart.set(id, quantity + 1);
    } else if (button.dataset.action === 'decrease') {
      if (quantity <= 1) {
        cart.delete(id);
        itemDiscounts.delete(id);
      }
      else cart.set(id, quantity - 1);
    } else if (button.dataset.action === 'remove') {
      cart.delete(id);
      itemDiscounts.delete(id);
    }
    renderCart();
  });
  element('quick-products').addEventListener('click', (event) => {
    const button = event.target.closest('[data-quick-id]');
    if (!button) return;
    const product = products.find((item) => item.id === button.dataset.quickId);
    if (product) addProduct(product);
  });

  element('payment-methods').addEventListener('click', (event) => {
    const button = event.target.closest('[data-method]');
    if (!button) return;
    selectPaymentMethod(button.dataset.method);
  });
  element('cash-received').addEventListener('input', (event) => {
    setCashReceived(event.currentTarget.value, 'main');
  });
  element('cash-received').addEventListener('blur', () => {
    setCashReceived(getCashReceived());
  });
  document.querySelectorAll('[data-cash-amount]').forEach((button) => {
    button.addEventListener('click', () => {
      setCashReceived(button.dataset.cashAmount);
      element('cash-received').focus();
    });
  });
  element('exact-cash-btn').addEventListener('click', () => {
    setCashReceived(getTotal());
    element('cash-received').focus();
  });
  element('pay-btn').addEventListener('click', openPaymentDialog);
  element('finish-payment-btn').addEventListener('click', completePayment);
  element('close-payment-dialog').addEventListener('click', () => element('payment-dialog').close());
  element('cancel-payment-dialog').addEventListener('click', () => element('payment-dialog').close());
  element('dialog-payment-methods').addEventListener('click', (event) => {
    const button = event.target.closest('[data-method]');
    if (button) selectPaymentMethod(button.dataset.method);
  });
  element('cash-received-dialog').addEventListener('input', (event) => {
    setCashReceived(event.currentTarget.value, 'dialog');
  });
  element('cash-received-dialog').addEventListener('blur', () => {
    setCashReceived(getDialogCashReceived());
  });
  document.querySelectorAll('[data-dialog-cash]').forEach((button) => {
    button.addEventListener('click', () => {
      setCashReceived(button.dataset.dialogCash);
      element('cash-received-dialog').focus();
    });
  });
  element('dialog-exact-cash').addEventListener('click', () => {
    setCashReceived(getTotal());
    element('cash-received-dialog').focus();
  });
  element('print-receipt-btn').addEventListener('click', printReceipt);
  element('new-transaction-btn').addEventListener('click', closeReceipt);

  element('discount-btn').addEventListener('click', () => openDiscountDialog());
  element('discount-form').addEventListener('submit', (event) => {
    event.preventDefault();
    applyDiscount();
  });
  element('remove-discount-btn').addEventListener('click', () => {
    if (discountTargetProductId) itemDiscounts.delete(discountTargetProductId);
    else discount = { type: 'nominal', value: 0, approvedBy: '' };
    renderCart();
    element('discount-dialog').close();
    showToast('Diskon dihapus.');
  });
  element('clear-cart-btn').addEventListener('click', openCancelDialog);
  element('cancel-transaction-btn').addEventListener('click', openCancelDialog);
  element('confirm-cancel-btn').addEventListener('click', () => {
    element('cancel-dialog').close();
    resetTransaction();
    showToast('Transaksi dibatalkan.');
  });
  document.querySelectorAll('[data-shortcut]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.shortcut === 'F1') element('product-query').focus();
      if (button.dataset.shortcut === 'F4') element('discount-btn').click();
      if (button.dataset.shortcut === 'F9') openCancelDialog();
    });
  });

  window.addEventListener('storage', (event) => {
    if (event.key === KEYS.transactions) {
      element('receipt-count').textContent = formatNumber(getDailyReceiptCount());
      setTransactionId();
    } else if (event.key === KEYS.settings) {
      settings = SettingsStore.get();
      if (!settings.paymentMethods.includes(paymentMethod)) paymentMethod = settings.paymentMethods[0];
      element('vat-label').textContent = 'PPN (' + settings.vatRate + '%)';
      element('rounding-note').textContent = settings.roundTo100
        ? 'Pembulatan Rp100 aktif sesuai pengaturan toko'
        : 'Harga final tanpa pembulatan tambahan';
      updatePaymentMethod();
    } else if (event.key === KEYS.products) {
      products = getPosProducts();
      renderQuickProducts();
      renderCart();
    }
  });

  const sidebar = element('pos-sidebar');
  const menuToggle = element('menu-toggle');
  const backdrop = element('sidebar-backdrop');
  function setMenuOpen(isOpen) {
    sidebar.classList.toggle('is-open', isOpen);
    backdrop.hidden = !isOpen;
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Tutup navigasi' : 'Buka navigasi');
  }
  menuToggle.addEventListener('click', () => setMenuOpen(!sidebar.classList.contains('is-open')));
  backdrop.addEventListener('click', () => setMenuOpen(false));

  document.addEventListener('keydown', (event) => {
    if (element('receipt-dialog').open) {
      if (event.key === 'F10') {
        event.preventDefault();
        printReceipt();
      } else if (event.key === 'F2' || event.key === 'Escape') {
        event.preventDefault();
        closeReceipt();
      }
      return;
    }

    if (element('payment-dialog').open) {
      if (event.key === 'F8') {
        event.preventDefault();
        element('cash-received-dialog').focus();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        completePayment();
      }
      return;
    }

    if (event.key === 'F1') {
      event.preventDefault();
      element('product-query').focus();
    } else if (event.key === 'F4') {
      event.preventDefault();
      element('discount-btn').click();
    } else if (event.key === 'F9') {
      event.preventDefault();
      openCancelDialog();
    } else if (
      event.key === 'Enter' &&
      !document.querySelector('dialog[open]') &&
      !['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)
    ) {
      event.preventDefault();
      openPaymentDialog();
    }
  });
})();
