import { create } from 'zustand';

/* Sesi login. Disimpan juga di localStorage oleh lapisan api. */
export const useSessionStore = create((set) => ({
  session: null,
  ready: false,
  setSession: (session) => set({ session }),
  setReady: (ready) => set({ ready }),
  clearSession: () => set({ session: null }),
}));

/* Keranjang kasir: satu sumber kebenaran untuk kasir.jsx. */
export const useCartStore = create((set, get) => ({
  items: [],
  discount: { type: 'nominal', value: 0 },

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

  removeItem: (productId) => set({ items: get().items.filter((item) => item.productId !== productId) }),
  clear: () => set({ items: [], discount: { type: 'nominal', value: 0 } }),
  setDiscount: (discount) => set({ discount }),

  totals: () => {
    const items = get().items;
    const grossSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = get().discount;
    const discountAmount = discount.type === 'percent'
      ? Math.min(grossSubtotal, Math.round((grossSubtotal * Number(discount.value || 0)) / 100))
      : Math.min(grossSubtotal, Number(discount.value || 0));
    return {
      grossSubtotal,
      discountAmount,
      total: Math.max(0, grossSubtotal - discountAmount),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  },
}));
