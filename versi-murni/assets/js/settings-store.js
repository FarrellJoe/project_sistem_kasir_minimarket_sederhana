(function () {
  'use strict';

  const defaults = {
    storeName: 'Brahamart',
    storeAddress: '',
    storePhone: '',
    receiptFooter: 'Terima kasih telah berbelanja',
    receiptPaperSize: '80',
    vatRate: 11,
    roundTo100: false,
    defaultMinStock: 10,
    paymentMethods: ['Tunai', 'QRIS', 'Debit/Transfer'],
  };
  const allowedPaymentMethods = ['Tunai', 'QRIS', 'Debit/Transfer'];

  const SettingsStore = {
    defaults,

    get() {
      const saved = DB.read(KEYS.settings, {});
      const settings = { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
      settings.paymentMethods = Array.isArray(settings.paymentMethods)
        ? allowedPaymentMethods.filter((method) => settings.paymentMethods.includes(method))
        : defaults.paymentMethods.slice();
      if (!settings.paymentMethods.length) settings.paymentMethods = defaults.paymentMethods.slice();
      return settings;
    },

    save(settings) {
      if (!settings || typeof settings !== 'object') throw new TypeError('Pengaturan tidak valid.');
      const paymentMethods = allowedPaymentMethods.filter((method) =>
        Array.isArray(settings.paymentMethods) && settings.paymentMethods.includes(method)
      );
      if (!paymentMethods.length) throw new RangeError('Pilih setidaknya satu metode pembayaran.');
      if (!Number.isFinite(settings.vatRate) || settings.vatRate < 0 || settings.vatRate > 100) {
        throw new RangeError('Tarif PPN harus berada pada rentang 0–100%.');
      }
      if (!Number.isInteger(settings.defaultMinStock) || settings.defaultMinStock < 0) {
        throw new RangeError('Stok minimum harus berupa bilangan bulat nol atau lebih.');
      }
      const next = {
        storeName: String(settings.storeName || '').trim(),
        storeAddress: String(settings.storeAddress || '').trim(),
        storePhone: String(settings.storePhone || '').trim(),
        receiptFooter: String(settings.receiptFooter || '').trim(),
        receiptPaperSize: settings.receiptPaperSize === '58' ? '58' : '80',
        vatRate: settings.vatRate,
        roundTo100: settings.roundTo100 === true,
        defaultMinStock: settings.defaultMinStock,
        paymentMethods,
      };
      if (!next.storeName) throw new RangeError('Nama toko wajib diisi.');
      if (next.storeName.length > 80 || next.storeAddress.length > 160 ||
          next.storePhone.length > 40 || next.receiptFooter.length > 160) {
        throw new RangeError('Panjang salah satu informasi toko melebihi batas.');
      }
      DB.write(KEYS.settings, next);
      return next;
    },
  };

  window.SettingsStore = SettingsStore;
})();
