(function () {
  'use strict';

  const categories = [
    { id: 'makanan-instan', name: 'Makanan Instan', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'minuman', name: 'Minuman', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'makanan-ringan', name: 'Makanan Ringan', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'roti', name: 'Roti', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'minyak-bumbu', name: 'Minyak & Bumbu', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'perlengkapan', name: 'Perlengkapan', createdAt: '2026-01-01T00:00:00.000Z' },
  ];

  const products = [
    { id: 'indomie', code: 'SKU-89912345', barcode: '89912345', name: 'Indomie Goreng Original 85g', categoryId: 'makanan-instan', purchasePrice: 2400, salePrice: 3000, stock: 120, minStock: 10, unit: 'pcs', isActive: true, emoji: '🍜', thumb: 'product-thumb--noodle' },
    { id: 'aqua', code: 'SKU-89954321', barcode: '89954321', name: 'Aqua Air Mineral 600ml', categoryId: 'minuman', purchasePrice: 2500, salePrice: 4000, stock: 8, minStock: 10, unit: 'pcs', isActive: true, emoji: '💧', thumb: 'product-thumb--water' },
    { id: 'chitato', code: 'SKU-89987654', barcode: '89987654', name: 'Chitato Sapi Panggang 68gr', categoryId: 'makanan-ringan', purchasePrice: 4200, salePrice: 5500, stock: 24, minStock: 8, unit: 'pcs', isActive: true, emoji: '🥔', thumb: 'product-thumb--chips' },
    { id: 'plastic', code: 'SKU-87123456', barcode: '87123456', name: 'Kantong Plastik M', categoryId: 'perlengkapan', purchasePrice: 250, salePrice: 500, stock: 200, minStock: 20, unit: 'pcs', isActive: true, emoji: '🛍️', thumb: 'product-thumb--plastic' },
    { id: 'tea', code: 'SKU-88811111', barcode: '88811111', name: 'Teh Pucuk 350ml', categoryId: 'minuman', purchasePrice: 2800, salePrice: 3500, stock: 30, minStock: 10, unit: 'pcs', isActive: true, emoji: '🧃', thumb: 'product-thumb--tea' },
    { id: 'bread', code: 'SKU-88822222', barcode: '88822222', name: 'Roti Sari Roti', categoryId: 'roti', purchasePrice: 4500, salePrice: 6000, stock: 15, minStock: 5, unit: 'pack', isActive: true, emoji: '🍞', thumb: 'product-thumb--bread' },
    { id: 'lighter', code: 'SKU-77711222', barcode: '77711222', name: 'Korek Gas Tokai', categoryId: 'perlengkapan', purchasePrice: 1800, salePrice: 3000, stock: 10, minStock: 5, unit: 'pcs', isActive: true, emoji: '🔥', thumb: 'product-thumb--lighter' },
    { id: 'sugar', code: 'SKU-89933441', barcode: '89933441', name: 'Gula Pasir Gulaku 1kg', categoryId: 'minyak-bumbu', purchasePrice: 14500, salePrice: 17000, stock: 0, minStock: 8, unit: 'pack', isActive: true, emoji: '🧂', thumb: 'product-thumb--plastic' },
    { id: 'oil', code: 'SKU-89955220', barcode: '89955220', name: 'Minyak Goreng Bimoli 2L', categoryId: 'minyak-bumbu', purchasePrice: 33000, salePrice: 38000, stock: 2, minStock: 5, unit: 'pouch', isActive: true, emoji: '🧴', thumb: 'product-thumb--tea' },
  ];

  function readArray(key) {
    const value = DB.read(key, []);
    return Array.isArray(value) ? value : [];
  }

  const ProductStore = {
    ensureSeeded() {
      if (localStorage.getItem(KEYS.categories) === null) DB.write(KEYS.categories, categories);
      if (localStorage.getItem(KEYS.products) === null) DB.write(KEYS.products, products);
      if (localStorage.getItem(KEYS.stockMovements) === null) DB.write(KEYS.stockMovements, []);
    },

    getProducts() {
      return readArray(KEYS.products);
    },

    saveProducts(value) {
      DB.write(KEYS.products, value);
    },

    getCategories() {
      return readArray(KEYS.categories);
    },

    saveCategories(value) {
      DB.write(KEYS.categories, value);
    },

    getStockMovements() {
      return readArray(KEYS.stockMovements);
    },

    getTransactions() {
      return readArray(KEYS.transactions);
    },

    hasBeenSold(productId) {
      return readArray(KEYS.transactions).some((transaction) =>
        transaction && Array.isArray(transaction.items) &&
        transaction.items.some((item) => item.productId === productId)
      );
    },

    hasStockMovements(productId) {
      return readArray(KEYS.stockMovements).some((movement) => movement.productId === productId);
    },

    commitSale(transaction) {
      const currentProducts = this.getProducts();
      const updates = [];

      for (const item of transaction.items) {
        const product = currentProducts.find((entry) => entry.id === item.productId);
        if (!product || !product.isActive) {
          return { ok: false, code: 'unavailable', productName: item.name };
        }
        if (!Number.isInteger(item.quantity) || item.quantity < 1 ||
            !Number.isInteger(product.stock) || product.stock < item.quantity) {
          return { ok: false, code: 'stock', productName: item.name };
        }
        if (product.salePrice !== item.price) {
          return { ok: false, code: 'changed', productName: item.name };
        }
        updates.push({ product, quantity: item.quantity });
      }

      const updatedAt = transaction.createdAt;
      const beforeProducts = localStorage.getItem(KEYS.products);
      const beforeMovements = localStorage.getItem(KEYS.stockMovements);
      const beforeTransactions = localStorage.getItem(KEYS.transactions);
      const nextProducts = currentProducts.map((product) => {
        const sale = updates.find((entry) => entry.product.id === product.id);
        return sale ? { ...product, stock: product.stock - sale.quantity, updatedAt } : product;
      });
      const movements = this.getStockMovements();
      updates.forEach(({ product, quantity }) => {
        movements.push({
          id: 'movement-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + product.id,
          productId: product.id,
          type: 'penjualan',
          quantity: -quantity,
          stockBefore: product.stock,
          stockAfter: product.stock - quantity,
          reason: transaction.id,
          userId: transaction.cashierId,
          userName: transaction.cashierName,
          createdAt: updatedAt,
        });
      });
      const transactions = readArray(KEYS.transactions);
      const productSnapshots = new Map(updates.map(({ product }) => [product.id, product]));
      transactions.push({
        ...transaction,
        items: transaction.items.map((item) => {
          const product = productSnapshots.get(item.productId);
          return {
            ...item,
            purchasePrice: product.purchasePrice,
            categoryId: product.categoryId,
          };
        }),
        status: 'selesai',
      });

      try {
        DB.write(KEYS.products, nextProducts);
        DB.write(KEYS.stockMovements, movements);
        DB.write(KEYS.transactions, transactions);
      } catch (error) {
        try {
          [
            [KEYS.products, beforeProducts],
            [KEYS.stockMovements, beforeMovements],
            [KEYS.transactions, beforeTransactions],
          ].forEach(([key, value]) => {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
          });
        } catch (rollbackError) {
          console.error('Gagal memulihkan data setelah penyimpanan transaksi gagal.', rollbackError);
        }
        throw error;
      }

      return { ok: true };
    },

    voidTransaction(details) {
      if (!details || details.role !== 'admin') return { ok: false, code: 'forbidden' };
      const transactions = this.getTransactions();
      const transactionIndex = transactions.findIndex((entry) => entry && entry.id === details.transactionId);
      if (transactionIndex < 0) return { ok: false, code: 'not-found' };

      const transaction = transactions[transactionIndex];
      if (transaction.status === 'dibatalkan' || transaction.voidedAt) {
        return { ok: false, code: 'already-void' };
      }
      if (transaction.status && transaction.status !== 'selesai') {
        return { ok: false, code: 'not-completed' };
      }
      if (typeof details.reason !== 'string' || !details.reason.trim()) return { ok: false, code: 'reason' };
      if (details.reason.trim().length > 240) return { ok: false, code: 'reason-length' };
      if (!Array.isArray(transaction.items) || transaction.items.length === 0) {
        return { ok: false, code: 'invalid-items' };
      }

      const currentProducts = this.getProducts();
      const restoreByProduct = new Map();
      for (const item of transaction.items) {
        if (!item || !Number.isInteger(item.quantity) || item.quantity < 1) {
          return { ok: false, code: 'invalid-items' };
        }
        const product = currentProducts.find((entry) => entry.id === item.productId);
        if (!product) return { ok: false, code: 'product-not-found', productName: item.name };
        const restore = restoreByProduct.get(product.id) || { product, quantity: 0 };
        restore.quantity += item.quantity;
        if (!Number.isSafeInteger(restore.quantity)) return { ok: false, code: 'invalid-items' };
        restoreByProduct.set(product.id, restore);
      }

      const now = new Date().toISOString();
      const restored = Array.from(restoreByProduct.values());
      for (const entry of restored) {
        if (!Number.isInteger(entry.product.stock) ||
            !Number.isSafeInteger(entry.product.stock + entry.quantity)) {
          return { ok: false, code: 'invalid-stock', productName: entry.product.name };
        }
      }

      const beforeProducts = localStorage.getItem(KEYS.products);
      const beforeMovements = localStorage.getItem(KEYS.stockMovements);
      const beforeTransactions = localStorage.getItem(KEYS.transactions);
      const nextProducts = currentProducts.map((product) => {
        const restore = restoreByProduct.get(product.id);
        return restore
          ? { ...product, stock: product.stock + restore.quantity, updatedAt: now }
          : product;
      });
      const stockMovements = this.getStockMovements();
      restored.forEach(({ product, quantity }) => {
        stockMovements.push({
          id: 'movement-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + product.id,
          productId: product.id,
          type: 'void',
          quantity,
          stockBefore: product.stock,
          stockAfter: product.stock + quantity,
          reason: transaction.id,
          note: details.reason.trim(),
          reference: transaction.id,
          source: 'void',
          userId: details.userId,
          userName: details.userName,
          createdAt: now,
        });
      });
      const voidedTransaction = {
        ...transaction,
        status: 'dibatalkan',
        voidedAt: now,
        voidedBy: details.userId,
        voidedByName: details.userName,
        voidReason: details.reason.trim(),
      };
      const nextTransactions = transactions.slice();
      nextTransactions[transactionIndex] = voidedTransaction;

      try {
        DB.write(KEYS.products, nextProducts);
        DB.write(KEYS.stockMovements, stockMovements);
        DB.write(KEYS.transactions, nextTransactions);
      } catch (error) {
        const rollbackErrors = [];
        [
          [KEYS.products, beforeProducts],
          [KEYS.stockMovements, beforeMovements],
          [KEYS.transactions, beforeTransactions],
        ].forEach(([key, value]) => {
          try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
          } catch (failure) {
            rollbackErrors.push({ key, error: failure });
          }
        });
        if (rollbackErrors.length) {
          console.error('Gagal memulihkan data setelah pembatalan transaksi gagal.', rollbackErrors);
          const failure = new Error('Penyimpanan dan pemulihan otomatis data transaksi gagal.');
          failure.name = 'TransactionRollbackError';
          throw failure;
        }
        throw error;
      }

      return { ok: true, transaction: voidedTransaction, movements: restored.length };
    },

    adjustStock(adjustment) {
      const currentProducts = this.getProducts();
      const product = currentProducts.find((entry) => entry.id === adjustment.productId);
      if (!product) return { ok: false, code: 'not-found' };
      if (!Number.isInteger(product.stock) || product.stock !== adjustment.expectedStock) {
        return { ok: false, code: 'stale', currentStock: product.stock };
      }
      if (!adjustment.reason || !adjustment.reason.trim()) return { ok: false, code: 'reason' };

      let stockAfter;
      if (adjustment.action === 'add' || adjustment.action === 'reduce') {
        if (!Number.isInteger(adjustment.amount) || adjustment.amount <= 0) {
          return { ok: false, code: 'amount' };
        }
        stockAfter = product.stock + (adjustment.action === 'add' ? adjustment.amount : -adjustment.amount);
      } else if (adjustment.action === 'correction') {
        if (!Number.isInteger(adjustment.amount) || adjustment.amount < 0) {
          return { ok: false, code: 'amount' };
        }
        stockAfter = adjustment.amount;
      } else {
        return { ok: false, code: 'action' };
      }

      if (stockAfter < 0) return { ok: false, code: 'negative' };
      const now = new Date().toISOString();
      const movement = {
        id: 'movement-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + product.id,
        productId: product.id,
        type: adjustment.action === 'add' ? 'masuk' : 'koreksi',
        adjustmentType: adjustment.action,
        quantity: stockAfter - product.stock,
        stockBefore: product.stock,
        stockAfter,
        reason: adjustment.reason.trim(),
        note: (adjustment.note || '').trim(),
        source: 'manual',
        userId: adjustment.userId,
        userName: adjustment.userName,
        createdAt: now,
      };
      const nextProducts = currentProducts.map((entry) =>
        entry.id === product.id ? { ...entry, stock: stockAfter, updatedAt: now } : entry
      );
      const beforeProducts = localStorage.getItem(KEYS.products);
      const beforeMovements = localStorage.getItem(KEYS.stockMovements);
      const movements = this.getStockMovements();
      movements.push(movement);

      try {
        DB.write(KEYS.products, nextProducts);
        DB.write(KEYS.stockMovements, movements);
      } catch (error) {
        let rollbackError = null;
        try {
          [
            [KEYS.products, beforeProducts],
            [KEYS.stockMovements, beforeMovements],
          ].forEach(([key, value]) => {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
          });
        } catch (failure) {
          rollbackError = failure;
          console.error('Gagal memulihkan data setelah penyesuaian stok gagal.', rollbackError);
        }
        if (rollbackError) {
          const failure = new Error('Penyimpanan dan pemulihan otomatis data stok gagal.');
          failure.name = 'StockRollbackError';
          throw failure;
        }
        throw error;
      }

      return { ok: true, movement };
    },
  };

  window.ProductStore = ProductStore;
})();
