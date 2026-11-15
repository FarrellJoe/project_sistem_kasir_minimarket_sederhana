/* =========================================================
   shift-store.js: rekap tutup kasir (closing) per hari
   Bergantung pada storage.js (DB, KEYS)
   ========================================================= */

(function () {
  'use strict';

  function dayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function readShifts() {
    const stored = DB.read(KEYS.shifts, []);
    return Array.isArray(stored) ? stored : [];
  }

  function readTransactions() {
    const stored = DB.read(KEYS.transactions, []);
    return Array.isArray(stored) ? stored : [];
  }

  const ShiftStore = {
    dayKey,

    list() {
      return readShifts().slice().sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt)));
    },

    lastClosing(dateKey) {
      return this.list().find((entry) => entry.dateKey === dateKey) || null;
    },

    /* Ringkasan transaksi sejak penutupan terakhir (atau awal hari). */
    summary(dateKey) {
      const key = dateKey || dayKey(new Date());
      const lastClosing = this.lastClosing(key);
      const since = lastClosing ? lastClosing.closedAt : '';
      const transactions = readTransactions().filter((transaction) => {
        if (!transaction || !transaction.createdAt) return false;
        if (dayKey(transaction.createdAt) !== key) return false;
        return since ? String(transaction.createdAt) > since : true;
      });

      const completed = transactions.filter((transaction) => transaction.status !== 'dibatalkan');
      const voided = transactions.filter((transaction) => transaction.status === 'dibatalkan');
      const cashSales = completed
        .filter((transaction) => transaction.paymentMethod === 'Tunai')
        .reduce((sum, transaction) => sum + (Number(transaction.total) || 0), 0);
      const nonCashSales = completed
        .filter((transaction) => transaction.paymentMethod !== 'Tunai')
        .reduce((sum, transaction) => sum + (Number(transaction.total) || 0), 0);

      return {
        dateKey: key,
        since,
        lastClosing,
        transactionCount: completed.length,
        voidCount: voided.length,
        voidAmount: voided.reduce((sum, transaction) => sum + (Number(transaction.total) || 0), 0),
        cashSales,
        nonCashSales,
        totalSales: cashSales + nonCashSales,
        itemCount: completed.reduce((sum, transaction) => sum + (Number(transaction.itemCount) || 0), 0),
      };
    },

    /* details: { openingCash, countedCash, note } */
    close(details, summary) {
      const data = summary || this.summary();
      const openingCash = Math.max(0, Number(details && details.openingCash) || 0);
      const countedCash = Math.max(0, Number(details && details.countedCash) || 0);
      const expectedCash = openingCash + data.cashSales;
      if (!Number.isFinite(countedCash)) return { ok: false, code: 'amount' };

      const session = DB.read(KEYS.session, null) || {};
      const record = {
        id: 'closing-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        dateKey: data.dateKey,
        closedAt: new Date().toISOString(),
        closedBy: session.userId || null,
        closedByName: session.nama || 'Admin',
        openingCash,
        countedCash,
        expectedCash,
        difference: countedCash - expectedCash,
        cashSales: data.cashSales,
        nonCashSales: data.nonCashSales,
        totalSales: data.totalSales,
        transactionCount: data.transactionCount,
        voidCount: data.voidCount,
        itemCount: data.itemCount,
        note: String((details && details.note) || '').slice(0, 240),
      };

      const shifts = readShifts();
      shifts.push(record);
      DB.write(KEYS.shifts, shifts);
      return { ok: true, record };
    },
  };

  window.ShiftStore = ShiftStore;
})();
