/* =========================================================
   shift.js: halaman rekap tutup kasir (Admin)
   Bergantung pada storage.js, auth.js, audit.js, shift-store.js
   ========================================================= */

(function () {
  'use strict';

  const session = Auth.requireAuth(['admin']);
  if (!session) return;

  ProductStore.ensureSeeded();
  const settings = SettingsStore.get();
  const main = document.getElementById('shift-main');
  const toast = document.getElementById('shift-toast');

  const state = {
    openingCash: 0,
    countedCash: '',
    note: '',
    error: '',
    result: null,
  };

  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const money = (value) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(value) || 0));
  const number = (value) => new Intl.NumberFormat('id-ID').format(Number(value) || 0);

  function initialsOf(name) {
    return String(name || '?').split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function currentSummary() {
    return ShiftStore.summary();
  }

  function liveDifference(summary) {
    const counted = Number(String(state.countedCash).replace(/\D/g, '')) || 0;
    const expected = (Number(state.openingCash) || 0) + summary.cashSales;
    return { counted, expected, difference: counted - expected };
  }

  function summaryCards(summary) {
    return `<section class="shift-stats">
      <article class="shift-stat shift-stat--primary"><span>Penjualan Selesai</span><strong>${money(summary.totalSales)}</strong><small>${summary.transactionCount} transaksi · ${number(summary.itemCount)} item</small></article>
      <article class="shift-stat"><span>Tunai</span><strong>${money(summary.cashSales)}</strong><small>masuk ke laci kasir</small></article>
      <article class="shift-stat"><span>Non-Tunai</span><strong>${money(summary.nonCashSales)}</strong><small>QRIS dan debit/transfer</small></article>
      <article class="shift-stat ${summary.voidCount ? 'shift-stat--warn' : ''}"><span>Transaksi Dibatalkan</span><strong>${summary.voidCount}</strong><small>${summary.voidCount ? money(summary.voidAmount) + ' tidak dihitung' : 'tidak ada void hari ini'}</small></article>
    </section>`;
  }

  function resultMarkup(record) {
    const difference = record.difference;
    const status = difference === 0 ? 'Cocok' : difference > 0 ? 'Surplus' : 'Kurang';
    const statusClass = difference === 0 ? 'is-ok' : difference > 0 ? 'is-surplus' : 'is-short';
    return `<section class="shift-result" id="shift-result">
      <header class="shift-result__header">
        <div><h2>Kasir Ditutup</h2><p>${escapeHtml(formatDate(record.closedAt))} · oleh ${escapeHtml(record.closedByName)}</p></div>
        <div class="shift-result__actions">
          <button type="button" class="btn btn--secondary" id="shift-print">Cetak Rekap</button>
          <button type="button" class="btn btn--primary" id="shift-new">Tutup Kasir Berikutnya</button>
        </div>
      </header>
      <dl class="shift-result__grid">
        <div><dt>Kas Awal</dt><dd>${money(record.openingCash)}</dd></div>
        <div><dt>Penjualan Tunai</dt><dd>${money(record.cashSales)}</dd></div>
        <div><dt>Kas Seharusnya</dt><dd>${money(record.expectedCash)}</dd></div>
        <div><dt>Uang Dihitung</dt><dd>${money(record.countedCash)}</dd></div>
        <div class="shift-result__diff ${statusClass}"><dt>Selisih (${status})</dt><dd>${money(difference)}</dd></div>
      </dl>
      ${record.note ? `<p class="shift-result__note"><strong>Catatan</strong> ${escapeHtml(record.note)}</p>` : ''}
      <p class="shift-result__foot">Rekap ini tersimpan sebagai riwayat penutupan. Transaksi berikutnya dihitung pada penutupan baru.</p>
    </section>`;
  }

  function calcMarkup(summary, live) {
    return `<div class="shift-calc" id="shift-calc">
          <div><span>Kas awal</span><strong>${money(state.openingCash)}</strong></div>
          <div><span>Penjualan tunai</span><strong>${money(summary.cashSales)}</strong></div>
          <div><span>Kas seharusnya</span><strong>${money(live.expected)}</strong></div>
          <div><span>Uang dihitung</span><strong>${money(live.counted)}</strong></div>
          <div class="shift-calc__diff ${live.difference === 0 ? 'is-ok' : live.difference > 0 ? 'is-surplus' : 'is-short'}"><span>Selisih</span><strong>${money(live.difference)}</strong></div>
        </div>`;
  }

  function closingForm(summary) {
    const live = liveDifference(summary);
    return `<section class="shift-panel" aria-labelledby="shift-form-title">
      <div class="shift-panel__header"><h2 id="shift-form-title">Hitung Uang Fisik</h2><p>Masukkan jumlah uang kertas dan logam yang ada di laci kasir.</p></div>
      <form class="shift-form" id="shift-form" novalidate>
        <label class="shift-field"><span>Kas awal (Rp)</span>
          <input id="shift-opening" name="openingCash" type="number" min="0" step="100" inputmode="numeric" value="${escapeHtml(state.openingCash)}">
          <small>Uang modal yang disiapkan sebelum transaksi.</small>
        </label>
        <label class="shift-field"><span>Uang dihitung (Rp)</span>
          <input id="shift-counted" name="countedCash" type="number" min="0" step="100" inputmode="numeric" value="${escapeHtml(state.countedCash)}" placeholder="0">
          <small>Jumlah fisik yang benar-benar dihitung.</small>
        </label>
        <label class="shift-field shift-field--wide"><span>Catatan (opsional)</span>
          <input id="shift-note" name="note" type="text" maxlength="240" value="${escapeHtml(state.note)}" placeholder="Contoh: selisih karena uang kembalian">
        </label>
        ${calcMarkup(summary, live)}
        <p class="shift-error" id="shift-error" role="alert" ${state.error ? '' : 'hidden'}>${escapeHtml(state.error)}</p>
        <div class="shift-form__actions">
          <button type="button" class="btn btn--secondary" id="shift-refresh">Muat Ulang Data</button>
          <button type="submit" class="btn btn--primary">Tutup Kasir</button>
        </div>
      </form>
    </section>`;
  }

  function historyMarkup() {
    const closings = ShiftStore.list().slice(0, 12);
    if (!closings.length) {
      return `<section class="shift-history"><h2>Riwayat Penutupan</h2><p class="shift-history__empty">Belum ada penutupan kasir yang tercatat.</p></section>`;
    }
    return `<section class="shift-history"><h2>Riwayat Penutupan</h2>
      <div class="shift-history__wrap"><table class="shift-history__table">
        <thead><tr><th>Waktu</th><th>Oleh</th><th>Transaksi</th><th>Kas Seharusnya</th><th>Uang Dihitung</th><th>Selisih</th></tr></thead>
        <tbody>${closings.map((entry) => {
          const cls = entry.difference === 0 ? 'is-ok' : entry.difference > 0 ? 'is-surplus' : 'is-short';
          return `<tr>
            <td>${escapeHtml(formatDate(entry.closedAt))}</td>
            <td>${escapeHtml(entry.closedByName)}</td>
            <td>${number(entry.transactionCount)}</td>
            <td>${money(entry.expectedCash)}</td>
            <td>${money(entry.countedCash)}</td>
            <td class="${cls}">${money(entry.difference)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>`;
  }

  function render() {
    const summary = currentSummary();
    main.innerHTML = `
      <section class="shift-head">
        <div><h1>Rekap Tutup Kasir</h1><p>Hitung uang laci, bandingkan dengan penjualan tunai, lalu simpan rekap penutupan ${escapeHtml(settings.storeName || 'toko')}.</p></div>
        <span class="shift-date">${escapeHtml(formatDate(new Date()))}</span>
      </section>
      ${summaryCards(summary)}
      ${state.result ? resultMarkup(state.result) : closingForm(summary)}
      ${historyMarkup()}`;
  }

  function refreshCalc() {
    const block = document.getElementById('shift-calc');
    if (!block) return;
    const summary = currentSummary();
    block.outerHTML = calcMarkup(summary, liveDifference(summary));
    const error = document.getElementById('shift-error');
    if (error && state.error) {
      error.hidden = true;
      state.error = '';
    }
  }

  main.addEventListener('input', (event) => {
    if (event.target.id === 'shift-opening') {
      state.openingCash = Math.max(0, Number(event.target.value) || 0);
      refreshCalc();
    } else if (event.target.id === 'shift-counted') {
      state.countedCash = event.target.value;
      refreshCalc();
    } else if (event.target.id === 'shift-note') {
      state.note = event.target.value;
    }
  });

  main.addEventListener('submit', (event) => {
    if (event.target.id !== 'shift-form') return;
    event.preventDefault();
    const summary = currentSummary();
    const counted = Number(String(state.countedCash).replace(/\D/g, '')) || 0;
    if (state.countedCash === '' || String(state.countedCash).trim() === '') {
      state.error = 'Isi jumlah uang yang dihitung sebelum menutup kasir.';
      render();
      return;
    }
    if (summary.transactionCount === 0 && counted === 0) {
      state.error = 'Belum ada transaksi dan uang dihitung masih nol. Periksa kembali perhitungan Anda.';
      render();
      return;
    }
    const result = ShiftStore.close({
      openingCash: state.openingCash,
      countedCash: counted,
      note: state.note.trim(),
    }, summary);
    if (!result.ok) {
      state.error = 'Rekap tutup kasir tidak dapat disimpan.';
      render();
      return;
    }
    Audit.log({
      action: 'shift.close',
      entity: 'closing',
      entityId: result.record.id,
      summary: 'Tutup kasir · selisih ' + money(result.record.difference),
    });
    state.result = result.record;
    state.error = '';
    render();
    showToast('Rekap tutup kasir tersimpan.');
  });

  main.addEventListener('click', (event) => {
    if (event.target.id === 'shift-refresh') {
      state.error = '';
      render();
      showToast('Data penjualan dimuat ulang.');
      return;
    }
    if (event.target.id === 'shift-print') {
      window.print();
      return;
    }
    if (event.target.id === 'shift-new') {
      state.result = null;
      state.countedCash = '';
      state.note = '';
      render();
    }
  });

  /* Identitas pengguna pada header */
  const name = session.nama || 'Admin';
  document.getElementById('header-name').textContent = name;
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('user-avatar').textContent = initialsOf(name);
  document.getElementById('sidebar-avatar').textContent = initialsOf(name);
  document.getElementById('current-date').textContent = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
  document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());

  const sidebar = document.getElementById('products-sidebar');
  const backdrop = document.getElementById('products-backdrop');
  const menuToggle = document.getElementById('menu-toggle');
  menuToggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    backdrop.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('is-open');
    backdrop.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  });

  render();
})();
