/* =========================================================
   activity.js: halaman log aktivitas (Admin)
   Bergantung pada storage.js, auth.js, audit.js
   ========================================================= */

(function () {
  'use strict';

  const session = Auth.requireAuth(['admin']);
  if (!session) return;

  const main = document.getElementById('activity-main');
  const toast = document.getElementById('activity-toast');
  const PAGE_SIZE = 15;

  const state = {
    search: '',
    action: '',
    page: 1,
  };

  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const initials = (name) => String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  function formatClock(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
  }

  function isToday(value) {
    const date = new Date(value);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function filtered() {
    const query = state.search.trim().toLowerCase();
    return Audit.list().filter((entry) => {
      if (state.action && entry.action !== state.action) return false;
      if (!query) return true;
      return [entry.userName, entry.action, entry.label, entry.summary, entry.entityId, entry.staffCode]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }

  function actionOptions() {
    const used = new Set(Audit.list().map((entry) => entry.action));
    const options = Object.keys(Audit.labels)
      .filter((action) => used.has(action))
      .map((action) => `<option value="${escapeHtml(action)}"${state.action === action ? ' selected' : ''}>${escapeHtml(Audit.labelFor(action))}</option>`)
      .join('');
    return `<option value="">Semua aksi</option>${options}`;
  }

  function badgeClass(action) {
    if (action.startsWith('sale.')) return 'activity-badge activity-badge--sale';
    if (action.startsWith('stock.')) return 'activity-badge activity-badge--stock';
    if (action.startsWith('user.') || action.startsWith('auth.')) return 'activity-badge activity-badge--user';
    if (action.startsWith('settings.') || action.startsWith('backup.')) return 'activity-badge activity-badge--setting';
    return 'activity-badge';
  }

  function summaryCards(entries) {
    const today = entries.filter((entry) => isToday(entry.at)).length;
    const people = new Set(entries.map((entry) => String(entry.userName || ''))).size;
    const last = entries[0];
    return `<section class="activity-stats">
      <article class="activity-stat"><span>Total Entri</span><strong>${entries.length}</strong><small>maksimal 500 entri terakhir</small></article>
      <article class="activity-stat"><span>Hari Ini</span><strong>${today}</strong><small>aktivitas tercatat</small></article>
      <article class="activity-stat"><span>Pengguna</span><strong>${people}</strong><small>pelaku berbeda</small></article>
      <article class="activity-stat"><span>Aktivitas Terakhir</span><strong class="activity-stat__small">${last ? escapeHtml(formatClock(last.at)) : '-'}</strong><small>${last ? escapeHtml(last.userName) : 'belum ada'}</small></article>
    </section>`;
  }

  function tableMarkup(entries) {
    const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pageCount);
    const start = (state.page - 1) * PAGE_SIZE;
    const rows = entries.slice(start, start + PAGE_SIZE);

    const body = rows.length
      ? rows.map((entry) => `<tr>
          <td class="activity-when"><strong>${escapeHtml(formatClock(entry.at))}</strong><span>${escapeHtml(formatDateTime(entry.at))}</span></td>
          <td><div class="activity-actor"><span class="activity-avatar">${escapeHtml(initials(entry.userName))}</span><span class="activity-actor__copy"><strong>${escapeHtml(entry.userName)}</strong><span>${escapeHtml(entry.staffCode || entry.role || '')}</span></span></div></td>
          <td><span class="${badgeClass(entry.action)}">${escapeHtml(entry.label || entry.action)}</span></td>
          <td class="activity-summary">${escapeHtml(entry.summary || '-')}</td>
        </tr>`).join('')
      : `<tr><td class="activity-empty" colspan="4">Belum ada aktivitas yang sesuai dengan filter.</td></tr>`;

    return `<div class="activity-table-wrap"><table class="activity-table">
        <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Ringkasan</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>
      <div class="users-pagination"><span>Menampilkan ${entries.length ? start + 1 : 0}–${Math.min(start + PAGE_SIZE, entries.length)} dari ${entries.length} entri</span>
        <div class="users-pagination__controls">
          <button type="button" data-activity-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>Sebelumnya</button>
          <button type="button" class="users-page-current" aria-current="page" disabled>${state.page}</button>
          <button type="button" data-activity-page="${state.page + 1}" ${state.page >= pageCount ? 'disabled' : ''}>Berikutnya</button>
        </div>
      </div>`;
  }

  function render() {
    const entries = filtered();
    main.innerHTML = `
      <section class="activity-head">
        <div><h1>Log Aktivitas</h1><p>Jejak perubahan data: transaksi, stok, produk, pengguna, dan pengaturan.</p></div>
        <div class="activity-head__actions">
          <button type="button" class="btn btn--secondary" id="activity-clear">Bersihkan Log</button>
        </div>
      </section>
      ${summaryCards(Audit.list())}
      <div class="activity-toolbar">
        <label class="activity-search"><span class="visually-hidden">Cari aktivitas</span>
          <input id="activity-search" type="search" placeholder="Cari nama, ringkasan, atau ID" value="${escapeHtml(state.search)}">
        </label>
        <label class="activity-filter"><span class="visually-hidden">Filter aksi</span>
          <select id="activity-action">${actionOptions()}</select>
        </label>
        <button type="button" class="btn btn--secondary" id="activity-reset">Reset</button>
        <span class="activity-note">Hanya Admin yang dapat melihat log ini.</span>
      </div>
      ${tableMarkup(entries)}`;
  }

  main.addEventListener('input', (event) => {
    if (event.target.id !== 'activity-search') return;
    state.search = event.target.value;
    state.page = 1;
    render();
    const input = document.getElementById('activity-search');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  main.addEventListener('change', (event) => {
    if (event.target.id !== 'activity-action') return;
    state.action = event.target.value;
    state.page = 1;
    render();
  });

  main.addEventListener('click', (event) => {
    const pageButton = event.target.closest('[data-activity-page]');
    if (pageButton) {
      state.page = Number(pageButton.dataset.activityPage) || 1;
      render();
      return;
    }
    if (event.target.id === 'activity-reset') {
      state.search = '';
      state.action = '';
      state.page = 1;
      render();
      return;
    }
    if (event.target.id === 'activity-clear') {
      if (!window.confirm('Hapus seluruh log aktivitas? Tindakan ini tidak dapat dibatalkan.')) return;
      Audit.clear();
      Audit.log({ action: 'settings.save', entity: 'activity', summary: 'Log aktivitas dibersihkan' });
      state.page = 1;
      render();
      showToast('Log aktivitas dibersihkan.');
    }
  });

  /* Identitas pengguna pada header */
  const now = new Date();
  const name = session.nama || 'Admin';
  document.getElementById('header-name').textContent = name;
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('header-avatar') && (document.getElementById('header-avatar').textContent = initials(name));
  document.getElementById('user-avatar').textContent = initials(name);
  document.getElementById('sidebar-avatar').textContent = initials(name);
  document.getElementById('current-date').textContent = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(now);

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
