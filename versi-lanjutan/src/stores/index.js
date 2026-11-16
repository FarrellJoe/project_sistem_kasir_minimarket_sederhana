import { create } from 'zustand';

/* Sesi login. Disimpan juga di localStorage oleh lapisan api. */
export const useSessionStore = create((set) => ({
  session: null,
  ready: false,
  setSession: (session) => set({ session }),
  setReady: (ready) => set({ ready }),
  clearSession: () => set({ session: null }),
}));

/* Diskon nomor: persen dibatasi 0–100, nominal tidak melebihi dasar. */
const clampValue = (type, value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return type === 'percent' ? Math.min(100, numeric) : numeric;
};

/* Diskon satu baris keranjang. Nominal dihitung per unit (seperti versi-murni),
   persen dihitung dari subtotal baris. Hasil tidak pernah melebihi baris. */
export const lineDiscountAmount = (item, discount) => {
  const lineSubtotal = item.price * item.quantity;
  if (!discount || !discount.value) return 0;
  const value = clampValue(discount.type, discount.value);
  return discount.type === 'percent'
    ? Math.min(lineSubtotal, Math.round((lineSubtotal * value) / 100))
    : Math.min(lineSubtotal, value * item.quantity);
};

/* Perhitungan keranjang sebagai fungsi murni supaya Kasir dapat mempratinjau
   total sebelum diskon diterapkan (dipakai untuk aturan persetujuan Admin). */
export function computeCartTotals(items, itemDiscounts, discount) {
  const grossSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemDiscountMap = {};
  let itemDiscount = 0;
  items.forEach((item) => {
    const amount = lineDiscountAmount(item, itemDiscounts[item.productId]);
    if (amount) itemDiscountMap[item.productId] = amount;
    itemDiscount += amount;
  });
  const subtotal = Math.max(0, grossSubtotal - itemDiscount);
  const transactionDiscount = discount.type === 'percent'
    ? Math.min(subtotal, Math.round((subtotal * clampValue('percent', discount.value)) / 100))
    : Math.min(subtotal, clampValue('nominal', discount.value));
  const discountAmount = itemDiscount + transactionDiscount;
  return {
    grossSubtotal,
    itemDiscount,
    itemDiscountMap,
    subtotal,
    transactionDiscount,
    discountAmount,
    total: Math.max(0, subtotal - transactionDiscount),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    /* Persentase total diskon dipakai untuk aturan persetujuan Admin. */
    discountPercent: grossSubtotal ? (discountAmount / grossSubtotal) * 100 : 0,
  };
}

/* Keranjang kasir: satu sumber kebenaran untuk Kasir.jsx. */
export const useCartStore = create((set, get) => ({
  items: [],
  discount: { type: 'nominal', value: 0, approvedBy: '' },
  itemDiscounts: {},

  addItem: (product) => {
    const items = get().items;
    const existing = items.find((item) => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        return { ok: false, code: 'stock', name: product.name };
      }
      set({
        items: items.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item),
      });
      return { ok: true };
    }
    if (product.stock <= 0) return { ok: false, code: 'empty', name: product.name };
    set({
      items: [
        ...items,
        {
          productId: product.id,
          name: product.name,
          sku: product.code,
          unit: product.unit,
          price: product.salePrice,
          stock: product.stock,
          emoji: product.emoji || '📦',
          quantity: 1,
        },
      ],
    });
    return { ok: true };
  },

  setQuantity: (productId, quantity) => {
    const items = get().items;
    if (quantity <= 0) {
      set({ items: items.filter((item) => item.productId !== productId) });
      return;
    }
    set({
      items: items.map((item) =>
        item.productId === productId ? { ...item, quantity: Math.min(quantity, item.stock) } : item),
    });
  },

  removeItem: (productId) => {
    const { [productId]: removed, ...rest } = get().itemDiscounts;
    set({ items: get().items.filter((item) => item.productId !== productId), itemDiscounts: rest });
  },
  clear: () => set({ items: [], discount: { type: 'nominal', value: 0, approvedBy: '' }, itemDiscounts: {} }),
  setDiscount: (discount) => set({ discount }),

  /* Diskon item: nilai 0 menghapus diskon item tersebut. */
  setItemDiscount: (productId, discount) => {
    const next = { ...get().itemDiscounts };
    if (!discount || !Number(discount.value)) delete next[productId];
    else next[productId] = {
      type: discount.type,
      value: clampValue(discount.type, discount.value),
      approvedBy: discount.approvedBy || '',
    };
    set({ itemDiscounts: next });
  },

  totals: () => {
    const { items, discount, itemDiscounts } = get();
    return computeCartTotals(items, itemDiscounts, discount);
  },
}));

