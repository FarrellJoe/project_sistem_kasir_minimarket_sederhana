/* =========================================================
   api.js: lapisan layanan data.
   Semua fungsi mengembalikan Promise agar konsisten dengan
   pola TanStack Query (queryFn/mutationFn), meskipun sumber
   datanya localStorage. Mengganti isi berkas ini dengan
   pemanggilan REST/Supabase tidak mengubah komponen.
   ========================================================= */

import { DB, KEYS, DEFAULT_SETTINGS, nextStaffSequence, seedIfEmpty, sha256, staffCodeFor } from './storage';
import { dayKey, todayKey, uid } from './format';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const SESSION_MINUTES = 30;

const readArray = (key) => {
  const value = DB.read(key, []);
  return Array.isArray(value) ? value : [];
};

const fail = (message, code) => {
  const error = new Error(message);
  if (code) error.code = code;
  throw error;
};

/* ---------- Log aktivitas ---------- */
export async function logActivity(entry, session) {
  try {
    const log = readArray(KEYS.activity);
    log.push({
      id: uid('audit'),
      at: new Date().toISOString(),
      action: entry.action,
      summary: entry.summary || '',
      entity: entry.entity || '',
      entityId: entry.entityId == null ? '' : String(entry.entityId),
      userId: session?.userId ?? null,
      userName: session?.nama || 'Sistem',
      role: session?.role || 'sistem',
      staffCode: session?.staffCode || '',
    });
    DB.write(KEYS.activity, log.slice(-500));
  } catch (error) {
    console.error('Log aktivitas gagal dicatat.', error);
  }
}

export async function listActivity() {
  return readArray(KEYS.activity).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/* ---------- Autentikasi ---------- */
/* Membaca sesi yang masih berlaku. Umur sesi TIDAK diperpanjang saat dibaca;
   perpanjangan hanya terjadi karena aktivitas pengguna (touchSession), sehingga
   memuat ulang halaman setelah 30 menit diam tetap mengakhiri sesi (NFR-03). */
export async function getSession() {
  const session = DB.read(KEYS.session, null);
  if (!session) return null;
  if (!Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
    DB.remove(KEYS.session);
    return null;
  }
  return session;
}

/* Memperpanjang sesi bila ada aktivitas pengguna. Mengembalikan null bila sesi
   sudah kedaluwarsa agar pemanggil dapat mengarahkan ke halaman login. */
export async function touchSession() {
  const session = DB.read(KEYS.session, null);
  if (!session) return null;
  const now = Date.now();
  if (!Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
    DB.remove(KEYS.session);
    return null;
  }
  const next = { ...session, lastActivityAt: now, expiresAt: now + SESSION_MINUTES * 60000 };
  DB.write(KEYS.session, next);
  return next;
}

export async function login({ identifier, password }) {
  await seedIfEmpty();
  const key = String(identifier || '').trim().toLowerCase();
  const attempts = DB.read(KEYS.attempts, {});
  const record = attempts[key] || { count: 0, lockedUntil: 0 };

  if (record.lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    fail('Terlalu banyak percobaan. Coba lagi dalam ' + minutesLeft + ' menit.', 'locked');
  }

  const users = readArray(KEYS.users);
  const user = users.find(
    (entry) => String(entry.username || '').toLowerCase() === key || String(entry.email || '').toLowerCase() === key,
  );
  const hash = await sha256(password);

  if (!user || user.passwordHash !== hash) {
    const count = record.count + 1;
    const lockedUntil = count >= MAX_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60000 : 0;
    DB.write(KEYS.attempts, { ...attempts, [key]: { count: lockedUntil ? 0 : count, lockedUntil } });
    if (lockedUntil) fail('Terlalu banyak percobaan. Akun dikunci sementara ' + LOCK_MINUTES + ' menit.', 'locked');
    fail('Username atau password salah.', 'invalid');
  }

  if (!user.isActive) fail('Akun tidak aktif. Hubungi admin.', 'inactive');

  const allAttempts = DB.read(KEYS.attempts, {});
  delete allAttempts[key];
  DB.write(KEYS.attempts, allAttempts);

  const nextUsers = users.map((entry) =>
    String(entry.id) === String(user.id) ? { ...entry, lastLoginAt: new Date().toISOString() } : entry,
  );
  DB.write(KEYS.users, nextUsers);

  const session = {
    userId: user.id,
    staffCode: user.staffCode || staffCodeFor(user.role, user.id),
    nama: user.nama,
    username: user.username,
    role: user.role,
    lastActivityAt: Date.now(),
    expiresAt: Date.now() + SESSION_MINUTES * 60000,
  };
  DB.write(KEYS.session, session);
  await logActivity({ action: 'auth.login', entity: 'user', entityId: user.id, summary: user.nama + ' (' + user.role + ')' }, session);
  return session;
}

/* Batas diskon yang boleh disetujui Kasir sendiri (FR-14). */
export const DISCOUNT_APPROVAL_PERCENT = 10;

export async function logout(session) {
  await logActivity({ action: 'auth.logout', entity: 'user', summary: 'Keluar dari sistem' }, session);
  DB.remove(KEYS.session);
}

/* Persetujuan Admin untuk diskon di atas 10% (FR-14). Verifikasi dilakukan di
   lapisan layanan, bukan hanya dengan menyembunyikan tombol di antarmuka. */
export async function verifyAdminApproval({ identifier, password }, session) {
  const key = String(identifier || '').trim().toLowerCase();
  if (!key || !password) fail('Masukkan username dan kata sandi Admin.', 'approval');
  const hash = await sha256(password);
  const admin = readArray(KEYS.users).find((user) =>
    user && user.role === 'admin' && user.isActive &&
    (String(user.username || '').toLowerCase() === key || String(user.email || '').toLowerCase() === key) &&
    user.passwordHash === hash);
  if (!admin) fail('Akun Admin atau kata sandi tidak valid.', 'approval');
  await logActivity({
    action: 'sale.discount.approve',
    entity: 'user',
    entityId: admin.id,
    summary: 'Menyetujui diskon di atas ' + DISCOUNT_APPROVAL_PERCENT + '%',
  }, session);
  return { id: admin.id, name: admin.nama || admin.username };
}

/* ---------- Produk dan kategori ---------- */
export async function listProducts() {
  return readArray(KEYS.products);
}

export async function listCategories() {
  return readArray(KEYS.categories);
}

export async function saveProduct(payload, session) {
  const products = readArray(KEYS.products);
  const duplicate = products.some(
    (product) =>
      product.id !== payload.id &&
      (product.code.toLowerCase() === payload.code.toLowerCase() ||
        String(product.barcode || '') === String(payload.barcode || '')),
  );
  if (duplicate) fail('Kode barang sudah digunakan.', 'duplicate');

  const now = new Date().toISOString();
  const product = {
    ...(payload.id ? products.find((entry) => entry.id === payload.id) || {} : {}),
    ...payload,
    id: payload.id || uid('product'),
    createdAt: payload.createdAt || now,
    updatedAt: now,
  };
  const next = payload.id
    ? products.map((entry) => (entry.id === payload.id ? product : entry))
    : [...products, product];
  DB.write(KEYS.products, next);
  await logActivity({
    action: payload.id ? 'product.update' : 'product.create',
    entity: 'product',
    entityId: product.id,
    summary: product.name + ' · ' + product.code,
  }, session);
  return product;
}

export async function toggleProduct({ id, isActive }, session) {
  const products = readArray(KEYS.products);
  const target = products.find((product) => product.id === id);
  if (!target) fail('Produk tidak ditemukan.', 'not-found');
  DB.write(KEYS.products, products.map((product) =>
    product.id === id ? { ...product, isActive, updatedAt: new Date().toISOString() } : product));
  await logActivity({
    action: 'product.toggle',
    entity: 'product',
    entityId: id,
    summary: target.name + ' · ' + (isActive ? 'diaktifkan' : 'dinonaktifkan'),
  }, session);
  return { id, isActive };
}

export async function deleteProduct({ id }, session) {
  const products = readArray(KEYS.products);
  const target = products.find((product) => product.id === id);
  if (!target) fail('Produk tidak ditemukan.', 'not-found');
  const used = readArray(KEYS.transactions).some((transaction) =>
    (transaction.items || []).some((item) => item.productId === id));
  if (used) fail('Produk yang pernah ditransaksikan hanya dapat dinonaktifkan.', 'used');
  DB.write(KEYS.products, products.filter((product) => product.id !== id));
  await logActivity({ action: 'product.delete', entity: 'product', entityId: id, summary: target.name }, session);
  return { id };
}

export async function saveCategory({ id, name }, session) {
  const categories = readArray(KEYS.categories);
  if (categories.some((category) => category.id !== id && category.name.toLowerCase() === name.toLowerCase())) {
    fail('Nama kategori sudah digunakan.', 'duplicate');
  }
  const category = id
    ? { ...categories.find((entry) => entry.id === id), name }
    : {
        id: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
        name,
        createdAt: new Date().toISOString(),
      };
  DB.write(KEYS.categories, id
    ? categories.map((entry) => (entry.id === id ? category : entry))
    : [...categories, category]);
  await logActivity({ action: id ? 'category.update' : 'category.create', entity: 'category', entityId: category.id, summary: name }, session);
  return category;
}

export async function deleteCategory({ id }, session) {
  const categories = readArray(KEYS.categories);
  const target = categories.find((category) => category.id === id);
  if (readArray(KEYS.products).some((product) => product.categoryId === id)) {
    fail('Kategori yang sedang digunakan tidak dapat dihapus.', 'used');
  }
  DB.write(KEYS.categories, categories.filter((category) => category.id !== id));
  await logActivity({ action: 'category.delete', entity: 'category', entityId: id, summary: target?.name || id }, session);
  return { id };
}

/* ---------- Stok ---------- */
export async function listStockMovements() {
  return readArray(KEYS.stockMovements).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function adjustStock({ productId, action, amount, reason, note, expectedStock }, session) {
  const products = readArray(KEYS.products);
  const product = products.find((entry) => entry.id === productId);
  if (!product) fail('Produk tidak ditemukan.', 'not-found');
  if (product.stock !== expectedStock) fail('Stok produk berubah. Muat ulang lalu tinjau kembali.', 'stale');

  const quantity = Number(amount);
  if (!Number.isInteger(quantity) || quantity < 0 || (action !== 'correction' && quantity < 1)) {
    fail('Jumlah penyesuaian harus bilangan bulat positif.', 'amount');
  }
  const stockAfter = action === 'add' ? product.stock + quantity
    : action === 'reduce' ? product.stock - quantity
    : quantity;
  if (stockAfter < 0) fail('Stok tidak boleh menjadi negatif.', 'negative');
  if (!reason) fail('Alasan penyesuaian wajib dipilih.', 'reason');

  const now = new Date().toISOString();
  const movement = {
    id: uid('movement'),
    productId,
    type: action === 'add' ? 'masuk' : 'koreksi',
    adjustmentType: action,
    quantity: stockAfter - product.stock,
    stockBefore: product.stock,
    stockAfter,
    reason,
    note: note || '',
    source: 'manual',
    userId: session?.userId ?? null,
    userName: session?.nama || '',
    createdAt: now,
  };

  DB.write(KEYS.products, products.map((entry) =>
    entry.id === productId ? { ...entry, stock: stockAfter, updatedAt: now } : entry));
  DB.write(KEYS.stockMovements, [...readArray(KEYS.stockMovements), movement]);
  await logActivity({
    action: 'stock.adjust',
    entity: 'product',
    entityId: productId,
    summary: product.name + ' · ' + product.stock + ' → ' + stockAfter + ' · ' + reason,
  }, session);
  return movement;
}

/* ---------- Transaksi ---------- */
export async function listTransactions() {
  return readArray(KEYS.transactions).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function getTransaction(id) {
  return readArray(KEYS.transactions).find((transaction) => transaction.id === id) || null;
}

export async function nextTransactionId() {
  const prefix = 'TRX-' + todayKey().replace(/-/g, '') + '-';
  const highest = readArray(KEYS.transactions).reduce((max, transaction) => {
    if (!transaction || typeof transaction.id !== 'string' || !transaction.id.startsWith(prefix)) return max;
    const sequence = Number(transaction.id.slice(prefix.length));
    return Number.isInteger(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return prefix + String(highest + 1).padStart(4, '0');
}

/* Menyimpan transaksi, memotong stok, dan menulis kartu stok sebagai satu kesatuan.
   Bila salah satu penulisan gagal, seluruh nilai lama dipulihkan. */
export async function commitSale(payload, session) {
  const products = readArray(KEYS.products);
  for (const item of payload.items) {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product || !product.isActive) fail(product ? product.name + ' sudah tidak tersedia.' : 'Produk tidak ditemukan.', 'unavailable');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || product.stock < item.quantity) {
      fail('Stok ' + product.name + ' tidak mencukupi.', 'stock');
    }
    if (product.salePrice !== item.price) fail('Harga ' + product.name + ' berubah. Muat ulang keranjang.', 'changed');
  }

  const now = new Date().toISOString();
  const id = await nextTransactionId();
  const itemCount = payload.items.reduce((sum, item) => sum + item.quantity, 0);
  const transaction = {
    id,
    createdAt: now,
    cashierId: session.userId,
    cashierName: session.nama,
    paymentMethod: payload.paymentMethod,
    itemCount,
    items: payload.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      return {
        ...item,
        /* Snapshot kategori dan harga beli agar laporan tetap akurat walau produk berubah. */
        categoryId: item.categoryId || product?.categoryId || '',
        purchasePrice: item.purchasePrice ?? product?.purchasePrice ?? 0,
        subtotal: item.subtotal ?? item.price * item.quantity,
      };
    }),
    subtotal: payload.totals.subtotal,
    grossSubtotal: payload.totals.grossSubtotal,
    itemDiscount: payload.totals.itemDiscount,
    discount: payload.totals.discount,
    totalDiscount: payload.totals.itemDiscount + payload.totals.discount,
    discountType: payload.totals.discountType,
    discountValue: payload.totals.discountValue,
    discountApprovedBy: payload.totals.discountApprovedBy || '',
    total: payload.totals.total,
    received: payload.received,
    change: Math.max(0, payload.received - payload.totals.total),
    status: 'selesai',
  };

  const before = {
    products: localStorage.getItem(KEYS.products),
    movements: localStorage.getItem(KEYS.stockMovements),
    transactions: localStorage.getItem(KEYS.transactions),
  };

  try {
    DB.write(KEYS.products, products.map((product) => {
      const sale = transaction.items.find((item) => item.productId === product.id);
      return sale ? { ...product, stock: product.stock - sale.quantity, updatedAt: now } : product;
    }));
    const movements = readArray(KEYS.stockMovements);
    transaction.items.forEach((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      movements.push({
        id: uid('movement'),
        productId: item.productId,
        type: 'penjualan',
        quantity: -item.quantity,
        stockBefore: product.stock,
        stockAfter: product.stock - item.quantity,
        reason: id,
        userId: session.userId,
        userName: session.nama,
        createdAt: now,
      });
    });
    DB.write(KEYS.stockMovements, movements);
    DB.write(KEYS.transactions, [...readArray(KEYS.transactions), transaction]);
  } catch (error) {
    [
      [KEYS.products, before.products],
      [KEYS.stockMovements, before.movements],
      [KEYS.transactions, before.transactions],
    ].forEach(([key, value]) => {
      if (value === null) DB.remove(key);
      else localStorage.setItem(key, value);
    });
    fail('Transaksi tidak tersimpan. Periksa ruang penyimpanan browser.', 'storage');
  }

  await logActivity({
    action: 'sale.create',
    entity: 'transaction',
    entityId: id,
    summary: itemCount + ' item · ' + payload.paymentMethod + ' · total ' + payload.totals.total,
  }, session);
  return transaction;
}

export async function voidTransaction({ id, reason }, session) {
  const transactions = readArray(KEYS.transactions);
  const transaction = transactions.find((entry) => entry.id === id);
  if (!transaction) fail('Transaksi tidak ditemukan.', 'not-found');
  if (transaction.status === 'dibatalkan') fail('Transaksi sudah dibatalkan.', 'void');
  if (!reason || !reason.trim()) fail('Alasan pembatalan wajib diisi.', 'reason');

  const products = readArray(KEYS.products);
  const restored = products.map((product) => {
    const item = transaction.items.find((entry) => entry.productId === product.id);
    return item ? { ...product, stock: product.stock + item.quantity, updatedAt: new Date().toISOString() } : product;
  });

  const movements = readArray(KEYS.stockMovements);
  transaction.items.forEach((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) return;
    movements.push({
      id: uid('movement'),
      productId: item.productId,
      type: 'void',
      quantity: item.quantity,
      stockBefore: product.stock,
      stockAfter: product.stock + item.quantity,
      reason: id,
      note: reason.trim(),
      source: 'void',
      userId: session?.userId ?? null,
      userName: session?.nama || '',
      createdAt: new Date().toISOString(),
    });
  });

  DB.write(KEYS.products, restored);
  DB.write(KEYS.stockMovements, movements);
  DB.write(KEYS.transactions, transactions.map((entry) => entry.id === id
    ? { ...entry, status: 'dibatalkan', voidReason: reason.trim(), voidedAt: new Date().toISOString(), voidedByName: session?.nama || '' }
    : entry));

  await logActivity({ action: 'sale.void', entity: 'transaction', entityId: id, summary: reason.trim() }, session);
  return { id };
}

/* ---------- Pengguna ---------- */
export async function listUsers() {
  return readArray(KEYS.users);
}

export async function saveUser(payload, session) {
  const users = readArray(KEYS.users);
  const duplicate = users.some((user) =>
    user.id !== payload.id &&
    (user.username === payload.username.toLowerCase() || String(user.email || '').toLowerCase() === String(payload.email || '').toLowerCase()));
  if (duplicate) fail('Username atau kontak sudah digunakan.', 'duplicate');

  const existing = payload.id ? users.find((user) => user.id === payload.id) : null;
  if (existing && String(existing.id) === String(session?.userId) && !payload.isActive) {
    fail('Anda tidak dapat menonaktifkan akun sendiri.', 'self');
  }
  if (existing && existing.role === 'admin' && (payload.role !== 'admin' || !payload.isActive)) {
    const otherAdmins = users.filter((user) => user.role === 'admin' && user.isActive && user.id !== existing.id);
    if (!otherAdmins.length) fail('Sistem harus memiliki minimal satu Admin aktif.', 'last-admin');
  }

  const user = {
    ...(existing || {}),
    id: existing ? existing.id : (users.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0) + 1),
    staffCode: existing?.staffCode || staffCodeFor(payload.role, nextStaffSequence(payload.role, users)),
    nama: payload.nama,
    username: payload.username.toLowerCase(),
    email: payload.email,
    role: payload.role,
    isActive: payload.isActive,
  };
  if (payload.password) user.passwordHash = await sha256(payload.password);

  DB.write(KEYS.users, existing
    ? users.map((entry) => (entry.id === existing.id ? user : entry))
    : [...users, user]);
  await logActivity({
    action: existing ? 'user.update' : 'user.create',
    entity: 'user',
    entityId: user.id,
    summary: user.nama + ' · ' + user.role + ' · ' + user.staffCode,
  }, session);
  return user;
}

export async function toggleUser({ id, isActive }, session) {
  const users = readArray(KEYS.users);
  const target = users.find((user) => user.id === id);
  if (!target) fail('Pengguna tidak ditemukan.', 'not-found');
  if (!isActive && String(target.id) === String(session?.userId)) {
    fail('Anda tidak dapat menonaktifkan akun sendiri.', 'self');
  }
  if (target.role === 'admin' && !isActive) {
    const otherAdmins = users.filter((user) => user.role === 'admin' && user.isActive && user.id !== id);
    if (!otherAdmins.length) fail('Sistem harus memiliki minimal satu Admin aktif.', 'last-admin');
  }
  DB.write(KEYS.users, users.map((user) => (user.id === id ? { ...user, isActive } : user)));
  await logActivity({
    action: 'user.toggle',
    entity: 'user',
    entityId: id,
    summary: target.nama + ' · ' + (isActive ? 'diaktifkan' : 'dinonaktifkan'),
  }, session);
  return { id, isActive };
}

export async function resetUserPassword({ id, password }, session) {
  if (String(password).length < 8) fail('Password minimal 8 karakter.', 'password');
  const users = readArray(KEYS.users);
  const target = users.find((user) => user.id === id);
  if (!target) fail('Pengguna tidak ditemukan.', 'not-found');
  const passwordHash = await sha256(password);
  DB.write(KEYS.users, users.map((user) => (user.id === id ? { ...user, passwordHash } : user)));
  await logActivity({ action: 'user.reset', entity: 'user', entityId: id, summary: target.nama + ' · password direset' }, session);
  return { id };
}

/* ---------- Profil sendiri (FR-19) ---------- */
export async function getMyProfile(session) {
  const user = readArray(KEYS.users).find((entry) => String(entry.id) === String(session?.userId));
  if (!user) fail('Akun tidak ditemukan. Silakan masuk kembali.', 'not-found');
  return user;
}

/* Membatasi foto profil agar localStorage tidak cepat penuh. */
const MAX_PHOTO_CHARS = 400 * 1024;

export async function updateProfile({ nama, email, photo }, session) {
  const users = readArray(KEYS.users);
  const me = users.find((entry) => String(entry.id) === String(session?.userId));
  if (!me) fail('Akun tidak ditemukan. Silakan masuk kembali.', 'not-found');

  const cleanName = String(nama || '').trim();
  const cleanEmail = String(email || '').trim();
  if (!cleanName) fail('Nama lengkap wajib diisi.', 'nama');
  if (!cleanEmail) fail('Email atau nomor telepon wajib diisi.', 'email');
  const duplicate = users.some((user) =>
    String(user.id) !== String(me.id) && String(user.email || '').toLowerCase() === cleanEmail.toLowerCase());
  if (duplicate) fail('Email atau nomor telepon sudah digunakan akun lain.', 'duplicate');
  if (photo && String(photo).length > MAX_PHOTO_CHARS) fail('Ukuran foto terlalu besar.', 'photo');

  const updated = { ...me, nama: cleanName, email: cleanEmail };
  if (photo !== undefined) updated.photo = photo || '';
  DB.write(KEYS.users, users.map((user) => (String(user.id) === String(me.id) ? updated : user)));

  /* Nama pada sesi ikut diperbarui agar topbar dan struk berikutnya konsisten. */
  const current = DB.read(KEYS.session, null);
  if (current) DB.write(KEYS.session, { ...current, nama: updated.nama });

  await logActivity({
    action: 'profile.update',
    entity: 'user',
    entityId: me.id,
    summary: updated.nama + ' memperbarui profil sendiri',
  }, { ...session, nama: updated.nama });
  return updated;
}

export async function changePassword({ currentPassword, newPassword }, session) {
  if (String(newPassword || '').length < 8) fail('Password baru minimal 8 karakter.', 'password');
  if (String(currentPassword || '') === String(newPassword || '')) fail('Password baru harus berbeda dari password lama.', 'password');

  const users = readArray(KEYS.users);
  const me = users.find((entry) => String(entry.id) === String(session?.userId));
  if (!me) fail('Akun tidak ditemukan. Silakan masuk kembali.', 'not-found');
  const currentHash = await sha256(currentPassword || '');
  if (me.passwordHash !== currentHash) fail('Password saat ini tidak sesuai.', 'password');

  const passwordHash = await sha256(newPassword);
  DB.write(KEYS.users, users.map((user) => (String(user.id) === String(me.id) ? { ...user, passwordHash } : user)));
  await logActivity({
    action: 'profile.password',
    entity: 'user',
    entityId: me.id,
    summary: me.nama + ' mengganti password sendiri',
  }, session);
  return { id: me.id };
}

/* ---------- Pengaturan ---------- */
export async function getSettings() {
  const saved = DB.read(KEYS.settings, {});
  const settings = { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  settings.paymentMethods = Array.isArray(settings.paymentMethods) && settings.paymentMethods.length
    ? settings.paymentMethods.filter((method) => DEFAULT_SETTINGS.paymentMethods.includes(method))
    : DEFAULT_SETTINGS.paymentMethods.slice();
  return settings;
}

export async function saveSettings(settings, session) {
  const next = {
    ...DEFAULT_SETTINGS,
    ...settings,
    storeName: String(settings.storeName || '').trim(),
    vatRate: Number(settings.vatRate) || 0,
    roundTo100: Boolean(settings.roundTo100),
    defaultMinStock: Number(settings.defaultMinStock) || 0,
  };
  if (!next.storeName) fail('Nama toko wajib diisi.', 'storeName');
  if (!next.paymentMethods.length) fail('Pilih setidaknya satu metode pembayaran.', 'payment');
  DB.write(KEYS.settings, next);
  await logActivity({ action: 'settings.save', entity: 'settings', summary: next.storeName + ' · PPN ' + next.vatRate + '%' }, session);
  return next;
}

/* ---------- Laporan ---------- */
/* Laporan mengalokasikan total transaksi ke item secara proporsional, sehingga
   filter kategori mengurangi omzet dan laba secara proporsional (pola yang sama
   dengan reports.js versi-murni). Laba kotor memakai omzet setelah diskon. */
export function buildReport(transactions, { from, to, cashierId, categoryId, products = [] } = {}) {
  const productById = new Map((products || []).map((product) => [String(product.id), product]));
  const records = [];
  const productTotals = new Map();
  const paymentTotals = new Map();
  const dailyTotals = new Map();
  let missingCostLines = 0;

  (transactions || []).forEach((transaction) => {
    if (transaction.status === 'dibatalkan') return;
    if (cashierId && String(transaction.cashierId) !== String(cashierId)) return;
    const dateKey = dayKey(transaction.createdAt);
    if (from && dateKey < from) return;
    if (to && dateKey > to) return;

    const allLines = (transaction.items || []).map((item) => {
      const product = productById.get(String(item.productId));
      const price = Number(item.price ?? product?.salePrice ?? 0);
      const quantity = Number(item.quantity || 0);
      const lineBase = item.subtotal != null
        ? Math.max(0, Number(item.subtotal))
        : price * quantity;
      const cost = item.purchasePrice != null
        ? Number(item.purchasePrice)
        : product && Number.isFinite(Number(product.purchasePrice))
          ? Number(product.purchasePrice)
          : null;
      return {
        ...item,
        categoryId: item.categoryId || product?.categoryId || '',
        quantity,
        lineBase,
        cost,
      };
    }).filter((line) => line.quantity > 0);
    if (!allLines.length) return;

    const matching = categoryId
      ? allLines.filter((line) => String(line.categoryId) === String(categoryId))
      : allLines;
    if (!matching.length) return;

    const baseTotal = allLines.reduce((sum, line) => sum + line.lineBase, 0);
    const saleTotal = Number(transaction.total || 0);
    const allocationRate = baseTotal > 0 ? saleTotal / baseTotal : 0;

    const recordItems = matching.map((line) => {
      const revenue = line.lineBase * allocationRate;
      const costAmount = line.cost == null ? null : line.cost * line.quantity;
      return { ...line, revenue, costAmount, profit: costAmount == null ? null : revenue - costAmount };
    });

    const revenue = recordItems.reduce((sum, line) => sum + line.revenue, 0);
    const profit = recordItems.reduce((sum, line) => sum + (line.profit ?? 0), 0);
    missingCostLines += recordItems.filter((line) => line.profit == null).length;

    records.push({
      transaction,
      dateKey,
      items: recordItems,
      revenue,
      units: recordItems.reduce((sum, line) => sum + line.quantity, 0),
    });

    recordItems.forEach((line) => {
      const key = String(line.productId || line.name);
      const row = productTotals.get(key) || { productId: key, name: line.name, quantity: 0, revenue: 0 };
      row.quantity += line.quantity;
      row.revenue += line.revenue;
      productTotals.set(key, row);
    });

    const method = transaction.paymentMethod || 'Tunai';
    const payment = paymentTotals.get(method) || { revenue: 0, count: 0 };
    payment.revenue += revenue;
    payment.count += 1;
    paymentTotals.set(method, payment);

    dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + revenue);
  });

  const revenue = records.reduce((sum, record) => sum + record.revenue, 0);
  const grossProfit = records.reduce((sum, record) =>
    sum + record.items.reduce((inner, line) => inner + (line.profit ?? 0), 0), 0);
  const dailySeries = Array.from(dailyTotals.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, revenue: value }));

  return {
    transactionCount: records.length,
    itemCount: records.reduce((sum, record) => sum + record.units, 0),
    revenue,
    average: records.length ? Math.round(revenue / records.length) : 0,
    grossProfit,
    missingCostLines,
    dailySeries,
    byMethod: Object.fromEntries(Array.from(paymentTotals.entries()).map(([method, value]) => [method, value.revenue])),
    topProducts: Array.from(productTotals.values()).sort((a, b) => b.quantity - a.quantity),
    transactions: records.map((record) => record.transaction),
    records,
  };
}
