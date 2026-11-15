/* =========================================================
   audit.js: log aktivitas pengguna (audit trail)
   Bergantung pada storage.js (DB, KEYS)
   Dipakai oleh modul lain lewat Audit.log({...}).
   ========================================================= */

(function () {
  'use strict';

  const MAX_ENTRIES = 500;

  /* Label yang tampil pada halaman Log Aktivitas. */
  const LABELS = {
    'auth.login': 'Masuk',
    'auth.logout': 'Keluar',
    'sale.create': 'Transaksi baru',
    'sale.void': 'Void transaksi',
    'sale.hold': 'Tahan transaksi',
    'sale.hold-delete': 'Hapus tahanan',
    'sale.resume': 'Lanjutkan transaksi',
    'product.create': 'Tambah produk',
    'product.update': 'Ubah produk',
    'product.toggle': 'Ubah status produk',
    'product.delete': 'Hapus produk',
    'category.create': 'Tambah kategori',
    'category.update': 'Ubah kategori',
    'category.delete': 'Hapus kategori',
    'stock.adjust': 'Penyesuaian stok',
    'user.create': 'Tambah pengguna',
    'user.update': 'Ubah pengguna',
    'user.toggle': 'Ubah status pengguna',
    'user.reset': 'Reset password',
    'settings.save': 'Simpan pengaturan',
    'settings.reset': 'Pulihkan pengaturan',
    'backup.export': 'Ekspor cadangan',
    'shift.close': 'Tutup kasir',
  };

  function readLog() {
    const stored = DB.read(KEYS.activity, []);
    return Array.isArray(stored) ? stored : [];
  }

  function currentActor() {
    const session = DB.read(KEYS.session, null);
    if (!session) return { userId: null, userName: 'Sistem', role: 'sistem', staffCode: '' };
    return {
      userId: session.userId,
      userName: session.nama || session.username || 'Pengguna',
      role: session.role || 'kasir',
      staffCode: session.staffCode || '',
    };
  }

  const Audit = {
    labels: LABELS,

    /* Mencatat satu peristiwa. Tidak pernah melempar error:
       kegagalan pencatatan tidak boleh menggagalkan aksi utama. */
    log(entry) {
      if (!entry || !entry.action) return null;
      try {
        const actor = currentActor();
        const record = {
          id: 'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
          at: new Date().toISOString(),
          action: String(entry.action),
          label: LABELS[entry.action] || entry.action,
          entity: entry.entity ? String(entry.entity) : '',
          entityId: entry.entityId == null ? '' : String(entry.entityId),
          summary: entry.summary ? String(entry.summary).slice(0, 240) : '',
          userId: entry.userId != null ? entry.userId : actor.userId,
          userName: entry.userName || actor.userName,
          role: entry.role || actor.role,
          staffCode: entry.staffCode || actor.staffCode,
        };
        const log = readLog();
        log.push(record);
        DB.write(KEYS.activity, log.slice(-MAX_ENTRIES));
        return record;
      } catch (error) {
        console.error('Log aktivitas gagal dicatat.', error);
        return null;
      }
    },

    list() {
      return readLog().slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
    },

    clear() {
      DB.write(KEYS.activity, []);
    },

    labelFor(action) {
      return LABELS[action] || action;
    },
  };

  window.Audit = Audit;
})();
