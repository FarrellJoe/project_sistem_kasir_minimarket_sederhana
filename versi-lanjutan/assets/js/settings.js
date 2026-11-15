(function () {
  'use strict';

  const session = Auth.requireAuth(['admin']);
  if (!session) return;

  const form = document.getElementById('settings-form');
  const errorElement = document.getElementById('settings-error');
  const toast = document.getElementById('settings-toast');
  const name = session.nama || 'Admin';
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  document.getElementById('header-name').textContent = name;
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('current-date').textContent = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3500);
  }

  function setFormValues(settings) {
    form.elements.storeName.value = settings.storeName;
    form.elements.storeAddress.value = settings.storeAddress;
    form.elements.storePhone.value = settings.storePhone;
    form.elements.receiptFooter.value = settings.receiptFooter;
    form.elements.receiptPaperSize.value = settings.receiptPaperSize;
    form.elements.vatRate.value = settings.vatRate;
    form.elements.defaultMinStock.value = settings.defaultMinStock;
    form.elements.roundTo100.checked = settings.roundTo100;
    form.querySelectorAll('input[name="paymentMethods"]').forEach((input) => {
      input.checked = settings.paymentMethods.includes(input.value);
    });
  }

  function getFormValues() {
    return {
      storeName: form.elements.storeName.value,
      storeAddress: form.elements.storeAddress.value,
      storePhone: form.elements.storePhone.value,
      receiptFooter: form.elements.receiptFooter.value,
      receiptPaperSize: form.elements.receiptPaperSize.value,
      vatRate: Number(form.elements.vatRate.value),
      defaultMinStock: Number(form.elements.defaultMinStock.value),
      roundTo100: form.elements.roundTo100.checked,
      paymentMethods: Array.from(form.querySelectorAll('input[name="paymentMethods"]:checked'))
        .map((input) => input.value),
    };
  }

  function getBackupData() {
    const users = DB.getUsers().map((user) => {
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    });
    return {
      exportedAt: new Date().toISOString(),
      settings: SettingsStore.get(),
      data: {
        products: DB.read(KEYS.products, []),
        categories: DB.read(KEYS.categories, []),
        stockMovements: DB.read(KEYS.stockMovements, []),
        transactions: DB.read(KEYS.transactions, []),
        users,
      },
    };
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    try {
      download('backup-brahamart-' + new Date().toISOString().slice(0, 10) + '.json',
        JSON.stringify(getBackupData(), null, 2), 'application/json;charset=utf-8');
      Audit.log({ action: 'backup.export', entity: 'backup', summary: 'Cadangan JSON' });
      showToast('Cadangan JSON berhasil diunduh.');
    } catch (error) {
      console.error('Cadangan JSON gagal dibuat.', error);
      showToast('Cadangan gagal dibuat. Periksa penyimpanan browser.', true);
    }
  }

  function exportCsv() {
    try {
      const backup = getBackupData();
      const rows = [['entitas', 'id', 'data']];
      Object.entries(backup.data).forEach(([entity, records]) => {
        records.forEach((record, index) => {
          rows.push([entity, record && record.id != null ? record.id : index + 1, JSON.stringify(record)]);
        });
      });
      rows.push(['settings', 'store', JSON.stringify(backup.settings)]);
      const csv = '\uFEFF' + rows.map((row) =>
        row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(',')
      ).join('\r\n');
      download('backup-brahamart-' + new Date().toISOString().slice(0, 10) + '.csv',
        csv, 'text/csv;charset=utf-8');
      Audit.log({ action: 'backup.export', entity: 'backup', summary: 'Cadangan CSV' });
      showToast('Cadangan CSV berhasil diunduh.');
    } catch (error) {
      console.error('Cadangan CSV gagal dibuat.', error);
      showToast('Cadangan gagal dibuat. Periksa penyimpanan browser.', true);
    }
  }

  try {
    setFormValues(SettingsStore.get());
  } catch (error) {
    console.error('Pengaturan toko gagal dimuat.', error);
    errorElement.textContent = 'Pengaturan gagal dimuat. Periksa penyimpanan browser.';
    errorElement.hidden = false;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    errorElement.hidden = true;
    try {
      const saved = SettingsStore.save(getFormValues());
      Audit.log({ action: 'settings.save', entity: 'settings', summary: saved.storeName + ' · PPN ' + saved.vatRate + '%' });
      showToast('Pengaturan berhasil disimpan dan diterapkan.');
    } catch (error) {
      errorElement.textContent = error.message || 'Pengaturan gagal disimpan.';
      errorElement.hidden = false;
    }
  });

  document.getElementById('restore-defaults-btn').addEventListener('click', () => {
    if (!window.confirm('Pulihkan semua pengaturan ke nilai default?')) return;
    try {
      SettingsStore.save({ ...SettingsStore.defaults, paymentMethods: SettingsStore.defaults.paymentMethods.slice() });
      setFormValues(SettingsStore.get());
      errorElement.hidden = true;
      Audit.log({ action: 'settings.reset', entity: 'settings', summary: 'Pengaturan dikembalikan ke nilai default' });
      showToast('Pengaturan default berhasil dipulihkan.');
    } catch (error) {
      console.error('Pengaturan default gagal dipulihkan.', error);
      errorElement.textContent = 'Pengaturan default gagal dipulihkan. Periksa penyimpanan browser.';
      errorElement.hidden = false;
    }
  });
  document.getElementById('backup-json-btn').addEventListener('click', exportJson);
  document.getElementById('backup-csv-btn').addEventListener('click', exportCsv);
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
})();
