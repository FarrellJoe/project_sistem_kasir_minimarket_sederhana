/* =========================================================
   storage.js: akses penyimpanan bersama untuk sesi dan transaksi.
   Operasi katalog produk dibungkus oleh product-store.js.
   ========================================================= */

const KEYS = {
  users: 'kasir_users',
  session: 'kasir_session',
  attempts: 'kasir_login_attempts',
  transactions: 'kasir_transactions',
  products: 'kasir_products',
  categories: 'kasir_categories',
  stockMovements: 'kasir_stock_movements',
  settings: 'kasir_settings',
  holds: 'kasir_holds',
  activity: 'kasir_activity',
  shifts: 'kasir_shifts',
};

const DB = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  },

  write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  getUsers() {
    return this.read(KEYS.users, []);
  },

  saveUsers(users) {
    this.write(KEYS.users, users);
  },
};

/* Hash password dengan SHA-256 (Web Crypto API).
   Catatan: berjalan di localhost / HTTPS. Gunakan Live Server. */
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* Kode staf yang tampil di antarmuka (contoh: KSR-0881).
   Format mengikuti desain Figma: prefiks peran + empat digit. */
function staffCodeFor(role, sequence) {
  const prefix = role === 'admin' ? 'ADM' : 'KSR';
  const number = Number.isInteger(sequence) && sequence > 0 ? sequence : 1;
  return prefix + '-' + String(number).padStart(4, '0');
}

/* Nomor urut berikutnya untuk peran tertentu (0881 untuk KSR, 0101 untuk ADM). */
function nextStaffSequence(role, users) {
  const prefix = role === 'admin' ? 'ADM-' : 'KSR-';
  const base = role === 'admin' ? 101 : 881;
  const numbers = (users || [])
    .filter((user) => user && typeof user.staffCode === 'string' && user.staffCode.startsWith(prefix))
    .map((user) => Number(user.staffCode.slice(prefix.length)))
    .filter(Number.isInteger);
  return numbers.length ? Math.max(...numbers) + 1 : base;
}

/* Lengkapi staffCode untuk pengguna lama (data seed versi sebelumnya). */
function migrateStaffCodes() {
  const users = DB.getUsers();
  if (!users.length) return;
  const assigned = users.slice();
  let changed = false;
  const next = users.map((user) => {
    if (!user || user.staffCode) return user;
    const code = staffCodeFor(user.role, nextStaffSequence(user.role, assigned));
    assigned.push({ staffCode: code });
    changed = true;
    return { ...user, staffCode: code };
  });
  if (changed) DB.saveUsers(next);
}

/* Data awal (seed). Hanya dibuat jika belum ada pengguna. */
async function seedUsers() {
  if (DB.getUsers().length > 0) {
    migrateStaffCodes();
    return;
  }

  DB.saveUsers([
    {
      id: 1,
      staffCode: 'ADM-0101',
      nama: 'Rina Pratama',
      username: 'admin',
      email: 'rina@brahamart.test',
      role: 'admin',
      isActive: true,
      passwordHash: await sha256('admin123'),
    },
    {
      id: 2,
      staffCode: 'KSR-0881',
      nama: 'Siti Aminah',
      username: 'kasir',
      email: 'siti@brahamart.test',
      role: 'kasir',
      isActive: true,
      passwordHash: await sha256('kasir123'),
    },
  ]);
}
