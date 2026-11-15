/* =========================================================
   hold-store.js: transaksi yang ditahan (hold) per kasir
   Bergantung pada storage.js (DB, KEYS)
   ========================================================= */

(function () {
  'use strict';

  const MAX_HOLDS = 20;

  function readHolds() {
    const stored = DB.read(KEYS.holds, []);
    return Array.isArray(stored) ? stored : [];
  }

  function nextLabel(holds) {
    const numbers = holds
      .map((hold) => Number(String(hold.label || '').replace(/\D/g, '')))
      .filter((value) => Number.isInteger(value) && value > 0);
    const next = numbers.length ? Math.max(...numbers) + 1 : 1;
    return 'Tahanan ' + String(next).padStart(2, '0');
  }

  const HoldStore = {
    list() {
      return readHolds().slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    },

    count() {
      return readHolds().length;
    },

    /* payload: { items: [{productId, name, sku, price, quantity, unit}],
                  itemDiscounts: [{productId, type, value}],
                  discount: {type, value, approvedBy},
                  total } */
    save(payload) {
      if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
        return { ok: false, code: 'empty' };
      }
      const holds = readHolds();
      if (holds.length >= MAX_HOLDS) return { ok: false, code: 'limit' };

      const session = DB.read(KEYS.session, null) || {};
      const hold = {
        id: 'hold-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        label: nextLabel(holds),
        createdAt: new Date().toISOString(),
        cashierId: session.userId || null,
        cashierName: session.nama || 'Kasir',
        total: Number(payload.total) || 0,
        items: payload.items.map((item) => ({
          productId: String(item.productId),
          name: String(item.name || ''),
          sku: String(item.sku || ''),
          unit: String(item.unit || 'pcs'),
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 0,
        })),
        itemDiscounts: Array.isArray(payload.itemDiscounts) ? payload.itemDiscounts : [],
        discount: payload.discount || { type: 'nominal', value: 0, approvedBy: '' },
      };

      holds.push(hold);
      DB.write(KEYS.holds, holds);
      return { ok: true, hold };
    },

    remove(id) {
      const holds = readHolds();
      const next = holds.filter((hold) => String(hold.id) !== String(id));
      if (next.length === holds.length) return { ok: false, code: 'not-found' };
      DB.write(KEYS.holds, next);
      return { ok: true };
    },

    get(id) {
      return readHolds().find((hold) => String(hold.id) === String(id)) || null;
    },
  };

  window.HoldStore = HoldStore;
})();
