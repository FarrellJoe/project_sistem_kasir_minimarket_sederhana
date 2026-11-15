/* =========================================================
   storage.js: satu pintu ke penyimpanan lokal.
   Kunci sengaja sama dengan versi-murni agar data bisa dibaca
   silang saat pengujian, dan agar satu-satunya perbedaan
   antarvariasi adalah lapisan antarmuka.
   ========================================================= */

export const KEYS = {
  users: 'kasir_users',
  session: 'kasir_session',
  attempts: 'kasir_login_attempts',
  transactions: 'kasir_transactions',
  products: 'kasir_products',
  categories: 'kasir_categories',
  stockMovements: 'kasir_stock_movements',
  settings: 'kasir_settings',
  activity: 'kasir_activity',
  holds: 'kasir_holds',
  shifts: 'kasir_shifts',
};

export const DB = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.error('Data rusak pada ' + key, error);
      return fallback;
    }
  },
  write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  },
};

export async function sha256(text) {
  const data = new TextEncoder().encode(String(text));
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function staffCodeFor(role, sequence) {
  const prefix = role === 'admin' ? 'ADM' : 'KSR';
  const number = Number.isInteger(sequence) && sequence > 0 ? sequence : 1;
  return prefix + '-' + String(number).padStart(4, '0');
}

export function nextStaffSequence(role, users) {
  const prefix = role === 'admin' ? 'ADM-' : 'KSR-';
  const base = role === 'admin' ? 101 : 881;
  const numbers = (users || [])
    .filter((user) => user && typeof user.staffCode === 'string' && user.staffCode.startsWith(prefix))
    .map((user) => Number(user.staffCode.slice(prefix.length)))
    .filter(Number.isInteger);
  return numbers.length ? Math.max(...numbers) + 1 : base;
}

export const SEED_CATEGORIES = [
  { id: 'makanan-instan', name: 'Makanan Instan', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'minuman', name: 'Minuman', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'makanan-ringan', name: 'Makanan Ringan', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'roti', name: 'Roti', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'minyak-bumbu', name: 'Minyak & Bumbu', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'perlengkapan', name: 'Perlengkapan', createdAt: '2026-01-01T00:00:00.000Z' },
];

export const SEED_PRODUCTS = [
  { id: 'indomie', code: 'SKU-89912345', barcode: '89912345', name: 'Indomie Goreng Original 85g', categoryId: 'makanan-instan', purchasePrice: 2400, salePrice: 3000, stock: 120, minStock: 10, unit: 'pcs', isActive: true, emoji: '🍜' },
  { id: 'aqua', code: 'SKU-89954321', barcode: '89954321', name: 'Aqua Air Mineral 600ml', categoryId: 'minuman', purchasePrice: 2500, salePrice: 4000, stock: 8, minStock: 10, unit: 'pcs', isActive: true, emoji: '💧' },
  { id: 'chitato', code: 'SKU-89987654', barcode: '89987654', name: 'Chitato Sapi Panggang 68gr', categoryId: 'makanan-ringan', purchasePrice: 4200, salePrice: 5500, stock: 24, minStock: 8, unit: 'pcs', isActive: true, emoji: '🥔' },
  { id: 'plastic', code: 'SKU-87123456', barcode: '87123456', name: 'Kantong Plastik M', categoryId: 'perlengkapan', purchasePrice: 250, salePrice: 500, stock: 200, minStock: 20, unit: 'pcs', isActive: true, emoji: '🛍️' },
  { id: 'tea', code: 'SKU-88811111', barcode: '88811111', name: 'Teh Pucuk 350ml', categoryId: 'minuman', purchasePrice: 2800, salePrice: 3500, stock: 30, minStock: 10, unit: 'pcs', isActive: true, emoji: '🧃' },
  { id: 'bread', code: 'SKU-88822222', barcode: '88822222', name: 'Roti Sari Roti', categoryId: 'roti', purchasePrice: 4500, salePrice: 6000, stock: 15, minStock: 5, unit: 'pack', isActive: true, emoji: '🍞' },
  { id: 'lighter', code: 'SKU-77711222', barcode: '77711222', name: 'Korek Gas Tokai', categoryId: 'perlengkapan', purchasePrice: 1800, salePrice: 3000, stock: 10, minStock: 5, unit: 'pcs', isActive: true, emoji: '🔥' },
  { id: 'sugar', code: 'SKU-89933441', barcode: '89933441', name: 'Gula Pasir Gulaku 1kg', categoryId: 'minyak-bumbu', purchasePrice: 14500, salePrice: 17000, stock: 0, minStock: 8, unit: 'pack', isActive: true, emoji: '🧂' },
  { id: 'oil', code: 'SKU-89955220', barcode: '89955220', name: 'Minyak Goreng Bimoli 2L', categoryId: 'minyak-bumbu', purchasePrice: 33000, salePrice: 38000, stock: 2, minStock: 5, unit: 'pouch', isActive: true, emoji: '🧴' },
];

export const SEED_USERS = [
  { id: 1, staffCode: 'ADM-0101', nama: 'Rina Pratama', username: 'admin', email: 'rina@brahamart.test', role: 'admin', isActive: true, password: 'admin123' },
  { id: 2, staffCode: 'KSR-0881', nama: 'Siti Aminah', username: 'kasir', email: 'siti@brahamart.test', role: 'kasir', isActive: true, password: 'kasir123' },
];

export const DEFAULT_SETTINGS = {
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

/* Membuat data awal bila penyimpanan masih kosong. */
export async function seedIfEmpty() {
  if (!DB.read(KEYS.users, null)) {
    const users = [];
    for (const user of SEED_USERS) {
      users.push({
        id: user.id,
        staffCode: user.staffCode,
        nama: user.nama,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        passwordHash: await sha256(user.password),
      });
    }
    DB.write(KEYS.users, users);
  }

  if (!DB.read(KEYS.categories, null)) DB.write(KEYS.categories, SEED_CATEGORIES);
  if (!DB.read(KEYS.products, null)) DB.write(KEYS.products, SEED_PRODUCTS);
  if (!DB.read(KEYS.stockMovements, null)) DB.write(KEYS.stockMovements, []);
  if (!DB.read(KEYS.transactions, null)) DB.write(KEYS.transactions, []);
  if (!DB.read(KEYS.settings, null)) DB.write(KEYS.settings, DEFAULT_SETTINGS);
  if (!DB.read(KEYS.activity, null)) DB.write(KEYS.activity, []);
  if (!DB.read(KEYS.holds, null)) DB.write(KEYS.holds, []);
  if (!DB.read(KEYS.shifts, null)) DB.write(KEYS.shifts, []);
}
