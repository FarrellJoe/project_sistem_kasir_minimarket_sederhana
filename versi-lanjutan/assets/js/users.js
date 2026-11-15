(function () {
  'use strict';

  const session = Auth.requireAuth(['admin']);
  if (!session) return;

  const main = document.getElementById('users-main');
  const userDialog = document.getElementById('user-dialog');
  const userForm = document.getElementById('user-form');
  const resetDialog = document.getElementById('reset-dialog');
  const resetForm = document.getElementById('reset-form');
  const statusDialog = document.getElementById('status-dialog');
  const protectionDialog = document.getElementById('protection-dialog');
  const state = {
    users: [],
    query: '',
    role: '',
    status: '',
    page: 1,
    tab: 'list',
    editId: null,
    resetId: null,
    pendingStatus: null,
    dialogPhoto: '',
    profilePhoto: '',
    profileMessage: '',
    toastTimer: null,
  };
  const PAGE_SIZE = 8;
  const numberOf = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function loadUsers() {
    const users = DB.getUsers();
    if (!Array.isArray(users)) throw new Error('Daftar pengguna tidak valid.');
    state.users = users.filter((user) => user && typeof user === 'object');
  }

  function activeAdminCount(users) {
    return users.filter((user) => user.role === 'admin' && user.isActive).length;
  }

  function userById(id) {
    return state.users.find((user) => String(user.id) === String(id));
  }

  function currentUser() {
    return userById(session.userId);
  }

  function formatRole(role) {
    return role === 'admin' ? 'Admin' : 'Kasir';
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return 'Belum tercatat';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(date);
  }

  function initials(name) {
    return String(name || 'Pengguna').trim().split(/\s+/).slice(0, 2)
      .map((part) => part.charAt(0)).join('').toUpperCase() || 'U';
  }

  function safePhoto(value) {
    return /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(String(value || ''))
      ? String(value)
      : '';
  }

  function avatarMarkup(name, photo, large) {
    const safeImage = safePhoto(photo);
    return `<span class="users-avatar${large ? ' users-avatar--large' : ''}">${safeImage
      ? `<img src="${escapeHtml(safeImage)}" alt="">`
      : escapeHtml(initials(name))}</span>`;
  }

  function roleBadge(role) {
    return `<span class="users-role${role === 'admin' ? ' users-role--admin' : ''}">${formatRole(role)}</span>`;
  }

  function statusBadge(isActive) {
    return `<span class="users-status ${isActive ? 'users-status--active' : 'users-status--inactive'}">${isActive ? 'Aktif' : 'Nonaktif'}</span>`;
  }

  function showToast(message, isError) {
    const toast = document.getElementById('users-toast');
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.toggle('is-error', Boolean(isError));
    if (state.toastTimer) window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3600);
  }

  function setFormError(form, message) {
    const error = form.querySelector('[data-form-error]');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }

  function setFieldError(form, field, message) {
    const input = form.elements[field];
    const error = form.querySelector(`[data-error-for="${field}"]`);
    if (input) input.setAttribute('aria-invalid', String(Boolean(message)));
    if (error) error.textContent = message || '';
  }

  function persistUsers(nextUsers, errorTarget) {
    try {
      DB.saveUsers(nextUsers);
      state.users = nextUsers;
      return true;
    } catch (error) {
      console.error('Penyimpanan data pengguna gagal.', error);
      if (errorTarget) setFormError(errorTarget, 'Perubahan tidak tersimpan. Periksa ruang penyimpanan browser lalu coba lagi.');
      showToast('Perubahan tidak tersimpan. Periksa ruang penyimpanan browser lalu coba lagi.', true);
      return false;
    }
  }

  function updateSessionUser(user) {
    const activeSession = DB.read(KEYS.session, null);
    if (!activeSession || String(activeSession.userId) !== String(user.id)) return;
    DB.write(KEYS.session, {
      ...activeSession,
      nama: user.nama,
      username: user.username,
      role: user.role,
      staffCode: user.staffCode || activeSession.staffCode,
    });
    session.nama = user.nama;
    session.username = user.username;
    session.role = user.role;
    session.staffCode = user.staffCode || session.staffCode;
    updateHeader();
  }

  function updateHeader() {
    const user = currentUser();
    const name = user ? user.nama : (session.nama || session.username || 'Admin');
    const mark = initials(name);
    document.getElementById('sidebar-avatar').textContent = mark;
    document.getElementById('user-avatar').textContent = mark;
    document.getElementById('sidebar-name').textContent = name;
    document.getElementById('header-name').textContent = name;
    document.getElementById('current-date').textContent = formatDateTime(new Date());
  }

  function tabsMarkup(activeTab) {
    return `<div class="users-tabs" role="tablist" aria-label="Menu pengguna">
      <button type="button" role="tab" aria-selected="${activeTab === 'list'}" class="${activeTab === 'list' ? 'is-active' : ''}" data-action="show-list">Daftar Pengguna</button>
      <button type="button" role="tab" aria-selected="${activeTab === 'profile'}" class="${activeTab === 'profile' ? 'is-active' : ''}" data-action="show-profile">Profil Saya</button>
    </div>`;
  }

  function headingMarkup(isProfile) {
    return `<section class="users-heading">
      <div><h1>${isProfile ? 'Profil Saya' : 'Manajemen Pengguna'}</h1>
      <p>${isProfile ? 'Perbarui informasi pribadi dan jaga keamanan akun Anda.' : 'Kelola akun kasir dan admin beserta hak akses sistem toko.'}</p></div>
      ${isProfile ? '' : '<button type="button" class="btn btn--primary" data-action="add-user">+ Tambah Pengguna</button>'}
    </section>`;
  }

  function statsMarkup() {
    const total = state.users.length;
    const active = state.users.filter((user) => user.isActive).length;
    const inactive = total - active;
    const cashiers = state.users.filter((user) => user.role === 'kasir').length;
    const admins = state.users.filter((user) => user.role === 'admin').length;
    const cards = [
      ['Total Pengguna', total, 'Akun'],
      ['Status Aktif', active, 'Akun'],
      ['Nonaktif', inactive, 'Akun'],
      ['Role Kasir', cashiers, 'User'],
      ['Role Admin', admins, 'User'],
    ];
    return `<section class="users-stats" aria-label="Ringkasan pengguna">${cards.map(([label, count, suffix]) =>
      `<article class="users-stat"><span>${label}</span><strong>${count}</strong><small>${suffix}</small></article>`
    ).join('')}</section>`;
  }

  function filteredUsers() {
    const query = state.query.trim().toLowerCase();
    return state.users.filter((user) => {
      const matchesQuery = !query ||
        [user.nama, user.username, user.email].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesRole = !state.role || user.role === state.role;
      const matchesStatus = !state.status ||
        (state.status === 'active' ? Boolean(user.isActive) : !user.isActive);
      return matchesQuery && matchesRole && matchesStatus;
    }).sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
  }

  function tableRegionMarkup() {
    const users = filteredUsers();
    const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
    state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * PAGE_SIZE;
    const rows = users.slice(start, start + PAGE_SIZE);
    const body = rows.length ? rows.map((user, index) => {
      const isCurrent = String(user.id) === String(session.userId);
      const loginNote = isCurrent ? 'Sesi aktif' : (user.lastLoginAt ? 'Login terakhir' : 'Belum tercatat');
      const actionLabel = user.isActive ? 'Nonaktif' : 'Aktifkan';
      return `<tr>
        <td class="users-number">${start + index + 1}</td>
        <td><div class="users-identity">${avatarMarkup(user.nama, user.photo, false)}<span class="users-identity__copy"><strong>${escapeHtml(user.nama || 'Tanpa nama')}${isCurrent ? ' · Anda' : ''}</strong><span>${escapeHtml(user.email || 'Kontak belum ditambahkan')}</span></span></div></td>
        <td>${escapeHtml(user.username || '-')}<span class="users-code">${escapeHtml(user.staffCode || staffCodeFor(user.role, user.id))}</span></td>
        <td>${roleBadge(user.role)}</td>
        <td>${statusBadge(Boolean(user.isActive))}</td>
        <td><span class="users-login-copy"><strong>${escapeHtml(formatDateTime(user.lastLoginAt))}</strong><span class="${isCurrent ? 'users-session' : ''}">${loginNote}</span></span></td>
        <td><div class="users-actions">
          <button type="button" class="users-action" data-action="edit-user" data-user-id="${escapeHtml(user.id)}">Ubah</button>
          <button type="button" class="users-action" data-action="reset-password" data-user-id="${escapeHtml(user.id)}">Reset</button>
          <button type="button" class="users-action ${user.isActive ? 'users-action--danger' : ''}" data-action="toggle-status" data-user-id="${escapeHtml(user.id)}">${actionLabel}</button>
        </div></td>
      </tr>`;
    }).join('') : '<tr><td class="users-table-empty" colspan="7">Tidak ada pengguna yang sesuai dengan pencarian atau filter.</td></tr>';
    return `<div class="users-table-wrap"><table class="users-table">
      <thead><tr><th>No</th><th>Nama Lengkap</th><th>Username</th><th>Peran</th><th>Status</th><th>Login Terakhir</th><th>Aksi</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    <div class="users-pagination"><span>Menampilkan ${users.length ? start + 1 : 0}–${Math.min(start + PAGE_SIZE, users.length)} dari ${users.length} pengguna terfilter • ${state.users.length} akun terdaftar</span>
      <div class="users-pagination__controls">
        <button type="button" data-action="page" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>Sebelumnya</button>
        <button type="button" class="users-page-current" aria-current="page" disabled>${state.page}</button>
        <button type="button" data-action="page" data-page="${state.page + 1}" ${state.page >= pageCount ? 'disabled' : ''}>Berikutnya</button>
      </div>
    </div>`;
  }

  function securityNote() {
    return `<aside class="users-security-note" aria-label="Keamanan dan hak akses">
      <strong>Keamanan dan hak akses</strong>
      <span>Admin tidak dapat menonaktifkan akunnya sendiri. Minimal satu Admin harus tetap aktif.</span>
      <span>Akun yang memiliki transaksi hanya dapat dinonaktifkan agar seluruh riwayat tetap tersimpan.</span>
    </aside>`;
  }

  function renderList() {
    state.tab = 'list';
    main.innerHTML = `${headingMarkup(false)}${tabsMarkup('list')}${statsMarkup()}
      <section class="users-panel" aria-label="Daftar akun pengguna">
        <form class="users-filters" id="users-filter-form">
          <input type="search" name="query" id="users-search" value="${escapeHtml(state.query)}" placeholder="Cari nama atau username pengguna..." aria-label="Cari nama atau username pengguna">
          <select name="role" aria-label="Filter peran"><option value="">Semua Peran</option><option value="admin" ${state.role === 'admin' ? 'selected' : ''}>Admin</option><option value="kasir" ${state.role === 'kasir' ? 'selected' : ''}>Kasir</option></select>
          <select name="status" aria-label="Filter status"><option value="">Semua Status</option><option value="active" ${state.status === 'active' ? 'selected' : ''}>Aktif</option><option value="inactive" ${state.status === 'inactive' ? 'selected' : ''}>Nonaktif</option></select>
          <button type="button" class="btn btn--secondary" data-action="reset-filters">Reset Filter</button>
        </form>
        <div id="users-table-region">${tableRegionMarkup()}</div>
      </section>
      ${securityNote()}`;
    bindListEvents();
  }

  function profileMarkup(user) {
    const photo = safePhoto(state.profilePhoto || user.photo);
    const currentName = escapeHtml(user.nama || '');
    const currentEmail = escapeHtml(user.email || '');
    return `${headingMarkup(true)}${tabsMarkup('profile')}
      ${state.profileMessage ? `<div class="users-profile-alert" role="status">${escapeHtml(state.profileMessage)}</div>` : ''}
      <div class="users-profile-grid">
        <form class="product-panel users-profile-card" id="profile-form" novalidate>
          <h2>Informasi Profil</h2><p>Data pribadi yang digunakan pada akun Brahamart.</p>
          <div class="users-profile-photo">
            <span class="users-avatar users-avatar--large" id="profile-avatar">${photo ? `<img src="${escapeHtml(photo)}" alt="">` : escapeHtml(initials(user.nama))}</span>
            <div class="users-photo-actions">
              <span>Foto profil opsional · JPG atau PNG, maks. 2 MB</span>
              <button type="button" class="btn btn--secondary" data-action="select-profile-photo">Ubah Foto</button>
              <button type="button" class="users-remove-photo" data-action="remove-profile-photo">Hapus Foto</button>
              <input type="file" id="profile-photo-input" accept="image/jpeg,image/png" hidden>
            </div>
          </div>
          <div class="users-fields-grid">
            <label class="users-field">Nama Lengkap *<input name="nama" maxlength="80" value="${currentName}" required autocomplete="name"><span class="users-field-error" data-error-for="nama"></span></label>
            <label class="users-field">Email / No. Telepon *<input name="email" maxlength="120" value="${currentEmail}" required autocomplete="email"><span class="users-field-error" data-error-for="email"></span></label>
            <label class="users-field">Username<input value="${escapeHtml(user.username || '')} · Tidak dapat diubah" readonly></label>
            <label class="users-field">Peran<input value="${formatRole(user.role)} · Dikelola oleh Admin" readonly></label>
          </div>
          <div class="users-profile-buttons"><button type="submit" class="btn btn--primary">Simpan Profil</button></div>
        </form>
        <form class="product-panel users-profile-card" id="profile-password-form" novalidate>
          <h2>Ganti Password</h2><p>Gunakan password yang unik untuk melindungi akun.</p>
          <div class="users-fields-grid">
            <label class="users-field">Password Saat Ini *<input type="password" name="currentPassword" required autocomplete="current-password"><span class="users-field-error" data-error-for="currentPassword"></span></label>
            <label class="users-field">Password Baru *<input type="password" name="newPassword" minlength="8" required autocomplete="new-password" placeholder="Minimal 8 karakter"><span class="users-field-error" data-error-for="newPassword"></span></label>
            <label class="users-field">Konfirmasi Password Baru *<input type="password" name="confirmPassword" required autocomplete="new-password" placeholder="Ketik ulang password baru"><span class="users-field-error" data-error-for="confirmPassword"></span></label>
          </div>
          <p class="users-hint">Password baru minimal 8 karakter dan harus sama dengan konfirmasi password.</p>
          <div class="users-profile-buttons"><button type="submit" class="btn btn--primary">Ganti Password</button></div>
        </form>
      </div>
      <aside class="users-security-note users-profile-note"><strong>Keamanan Sesi</strong><span>Sesi berakhir setelah 30 menit tidak aktif. Setelah 5 kali login gagal, akun dikunci sementara selama 5 menit.</span></aside>`;
  }

  function renderProfile() {
    const user = currentUser();
    if (!user) {
      showToast('Akun yang sedang digunakan tidak ditemukan. Silakan masuk kembali.', true);
      Auth.logout();
      return;
    }
    state.tab = 'profile';
    state.profilePhoto = user.photo || '';
    main.innerHTML = profileMarkup(user);
    bindProfileEvents();
  }

  function render() {
    if (state.tab === 'profile') renderProfile();
    else renderList();
  }

  function bindListEvents() {
    const form = document.getElementById('users-filter-form');
    const search = document.getElementById('users-search');
    search.addEventListener('input', () => {
      state.query = search.value;
      state.page = 1;
      document.getElementById('users-table-region').innerHTML = tableRegionMarkup();
    });
    form.elements.role.addEventListener('change', () => {
      state.role = form.elements.role.value;
      state.page = 1;
      document.getElementById('users-table-region').innerHTML = tableRegionMarkup();
    });
    form.elements.status.addEventListener('change', () => {
      state.status = form.elements.status.value;
      state.page = 1;
      document.getElementById('users-table-region').innerHTML = tableRegionMarkup();
    });
    form.addEventListener('submit', (event) => event.preventDefault());
  }

  function roleOptions(selectedRole) {
    return `<fieldset class="users-fieldset"><legend>Peran &amp; Akses Sistem *</legend>
      <div class="users-role-options">
        <label class="users-role-choice"><span>Kasir <small>${selectedRole === 'kasir' ? 'Terpilih' : 'Pilih'}</small></span><small>Transaksi POS, lihat produk dan stok, serta riwayat transaksi sendiri.</small><input type="radio" name="role" value="kasir" ${selectedRole === 'kasir' ? 'checked' : ''} required></label>
        <label class="users-role-choice"><span>Admin <small>${selectedRole === 'admin' ? 'Terpilih' : 'Pilih'}</small></span><small>Kelola produk, stok, pengguna, laporan, pengaturan, dan void transaksi.</small><input type="radio" name="role" value="admin" ${selectedRole === 'admin' ? 'checked' : ''} required></label>
      </div>
    </fieldset>`;
  }

  function openUserDialog(mode, user) {
    state.editId = user ? user.id : null;
    state.dialogPhoto = user ? (user.photo || '') : '';
    const isEdit = mode === 'edit';
    const selectedRole = user ? user.role : 'kasir';
    const active = user ? Boolean(user.isActive) : true;
    userForm.innerHTML = `
      <div class="users-dialog-header"><div><h2 id="user-dialog-title">${isEdit ? 'Ubah Pengguna' : 'Tambah Pengguna Baru'}</h2><p>${isEdit ? `Perbarui data dan hak akses ${escapeHtml(user.nama)}.` : 'Buat akun kasir atau admin dengan hak akses yang sesuai.'}</p></div><button type="button" class="users-close" data-action="close-user">Tutup</button></div>
      <div class="users-dialog-body">
        <div class="users-photo-row">
          <span class="users-avatar users-avatar--large" id="user-photo-preview">${avatarMarkup(user ? user.nama : 'Pengguna', state.dialogPhoto, true).replace(/^<span class="users-avatar users-avatar--large">|<\/span>$/g, '')}</span>
          <div class="users-photo-actions"><span>Foto Profil (opsional) · JPG atau PNG, maks. 2 MB</span><button type="button" class="btn btn--secondary" data-action="select-user-photo">${isEdit ? 'Ubah Foto' : 'Unggah Foto'}</button><button type="button" class="users-remove-photo" data-action="remove-user-photo">Hapus Foto</button><input type="file" id="user-photo-input" accept="image/jpeg,image/png" hidden></div>
        </div>
        <div class="users-fields-grid">
          <label class="users-field">Nama Lengkap *<input name="nama" maxlength="80" value="${escapeHtml(user ? user.nama : '')}" placeholder="cth. Ahmad Fauzi" required><span class="users-field-error" data-error-for="nama"></span></label>
          <label class="users-field">Username *<input name="username" maxlength="30" value="${escapeHtml(user ? user.username : '')}" placeholder="cth. ahmad.kasir" required autocomplete="username"><span class="users-field-error" data-error-for="username"></span></label>
          <label class="users-field users-field--wide">Email / No. Telepon (opsional)<input name="email" maxlength="120" value="${escapeHtml(user ? user.email || '' : '')}" placeholder="nama@brahamart.id atau 08123456789"><span class="users-field-error" data-error-for="email"></span></label>
        </div>
        ${roleOptions(selectedRole)}
        ${isEdit ? `<div class="users-inline-note"><strong>Pengelolaan password</strong><span>Password tidak ditampilkan. Gunakan aksi Reset pada daftar akun untuk membuat password baru.</span></div>` : `<div class="users-fields-grid">
          <label class="users-field">Password Sementara *<input type="password" name="password" minlength="8" required autocomplete="new-password" placeholder="Minimal 8 karakter"><span class="users-field-error" data-error-for="password"></span></label>
          <label class="users-field">Konfirmasi Password *<input type="password" name="confirmPassword" required autocomplete="new-password" placeholder="Ketik ulang password"><span class="users-field-error" data-error-for="confirmPassword"></span></label>
          <p class="users-hint users-field--wide">Gunakan minimal 8 karakter. Kombinasi huruf dan angka disarankan.</p>
        </div>`}
        <label class="users-status-toggle"><span>Status Akun ${isEdit ? '' : 'Aktif'}<small>Pengguna dapat login dan mengakses fitur sesuai peran.</small></span><span class="users-switch-label"><input type="checkbox" name="isActive" ${active ? 'checked' : ''}><span class="users-switch" aria-hidden="true"></span><span>${active ? 'Aktif' : 'Nonaktif'}</span></span></label>
      </div>
      <p class="users-form-error" data-form-error role="alert" hidden></p>
      <div class="users-dialog-footer"><button type="button" class="btn btn--secondary" data-action="close-user">Batal</button><button type="submit" class="btn btn--primary">${isEdit ? 'Simpan Perubahan' : 'Simpan Pengguna'}</button></div>`;
    userDialog.showModal();
  }

  function openResetDialog(user) {
    state.resetId = user.id;
    resetForm.innerHTML = `
      <div class="users-dialog-header"><div><h2 id="reset-dialog-title">Reset Password</h2><p>Buat password baru untuk akun pengguna.</p></div><button type="button" class="users-close" data-action="close-reset">Tutup</button></div>
      <div class="users-confirm-body">
        <div class="users-confirm-user">${avatarMarkup(user.nama, user.photo, false)}<span><strong>${escapeHtml(user.nama)}</strong><small>${escapeHtml(user.username)} • ${formatRole(user.role)} • ${user.isActive ? 'Aktif' : 'Nonaktif'}</small></span></div>
        <label class="users-field">Password Baru *<input type="password" name="password" minlength="8" required autocomplete="new-password" placeholder="Minimal 8 karakter"><span class="users-field-error" data-error-for="password"></span></label>
        <label class="users-field">Konfirmasi Password Baru *<input type="password" name="confirmPassword" required autocomplete="new-password" placeholder="Ketik ulang password baru"><span class="users-field-error" data-error-for="confirmPassword"></span></label>
        <div class="users-alert users-alert--success"><strong>Password lama tidak dapat digunakan lagi.</strong><span>Sampaikan password baru kepada pengguna melalui saluran yang aman.</span></div>
      </div>
      <p class="users-form-error" data-form-error role="alert" hidden></p>
      <div class="users-dialog-footer"><button type="button" class="btn btn--secondary" data-action="close-reset">Batal</button><button type="submit" class="btn btn--primary">Reset Password</button></div>`;
    resetDialog.showModal();
  }

  function transactionCountFor(userId) {
    const transactions = DB.read(KEYS.transactions, []);
    return Array.isArray(transactions)
      ? transactions.filter((transaction) => String(transaction.cashierId) === String(userId)).length
      : 0;
  }

  function openStatusDialog(user) {
    const activating = !user.isActive;
    state.pendingStatus = { id: user.id, active: activating };
    const historyCount = transactionCountFor(user.id);
    const description = activating
      ? `Pengguna dapat kembali login sebagai ${formatRole(user.role)}.`
      : 'Pengguna tidak dapat login setelah dinonaktifkan.';
    const extra = activating
      ? 'Hak akses mengikuti peran akun. Aktivasi tidak mengubah password dan riwayat transaksi.'
      : `Seluruh transaksi dan riwayat akun tetap tersimpan. Akun dapat diaktifkan kapan saja.${historyCount ? ` Akun ini memiliki ${historyCount} transaksi.` : ''}`;
    document.getElementById('status-dialog-content').innerHTML = `
      <div class="users-dialog-header"><div><h2 id="status-dialog-title">${activating ? 'Aktifkan Akun?' : 'Nonaktifkan Akun?'}</h2><p>${activating ? 'Pulihkan akses pengguna ke sistem Brahamart.' : 'Tinjau dampak perubahan sebelum melanjutkan.'}</p></div><button type="button" class="users-close" data-action="close-status">Tutup</button></div>
      <div class="users-confirm-body">
        <div class="users-confirm-user">${avatarMarkup(user.nama, user.photo, false)}<span><strong>${escapeHtml(user.nama)}</strong><small>${escapeHtml(user.username)} • ${formatRole(user.role)} • ${user.isActive ? 'Aktif' : 'Nonaktif'}</small></span></div>
        <div class="users-alert${activating ? ' users-alert--success' : ''}"><strong>${description}</strong><span>${extra}</span></div>
      </div>
      <div class="users-dialog-footer users-dialog-footer--right"><button type="button" class="btn btn--secondary" data-action="close-status">Batal</button><button type="button" class="btn ${activating ? 'btn--primary' : 'btn--danger'}" data-action="confirm-status">${activating ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan'}</button></div>`;
    statusDialog.showModal();
  }

  function openProtectionDialog(user, reason) {
    document.getElementById('protection-dialog-content').innerHTML = `
      <div class="users-dialog-header"><div><h2 id="protection-dialog-title">Akun Admin Dilindungi</h2><p>Tindakan ini tidak dapat dilanjutkan.</p></div><button type="button" class="users-close" data-action="close-protection">Tutup</button></div>
      <div class="users-confirm-body">
        <div class="users-confirm-user">${avatarMarkup(user.nama, user.photo, false)}<span><strong>${escapeHtml(user.nama)}${String(user.id) === String(session.userId) ? ' · Akun Anda' : ''}</strong><small>${escapeHtml(user.username)} • ${formatRole(user.role)} • ${user.isActive ? 'Aktif' : 'Nonaktif'}</small></span></div>
        <div class="users-alert"><strong>${escapeHtml(reason)}</strong><span>Sistem harus selalu memiliki minimal satu Admin aktif.</span></div>
        <p class="users-hint">Gunakan Admin aktif lain untuk mengelola akun ini. Tambahkan Admin lain terlebih dahulu sebelum mengubah peran Admin terakhir.</p>
      </div>
      <div class="users-dialog-footer users-dialog-footer--right"><span class="users-hint">Akun tetap aktif.</span><button type="button" class="btn btn--primary" data-action="close-protection">Mengerti</button></div>`;
    protectionDialog.showModal();
  }

  function displayPhoto(preview, photo, name) {
    if (!preview) return;
    preview.replaceChildren();
    const safeImage = safePhoto(photo);
    if (safeImage) {
      const image = document.createElement('img');
      image.src = safeImage;
      image.alt = '';
      preview.appendChild(image);
    } else {
      preview.textContent = initials(name);
    }
  }

  function processPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file || !['image/jpeg', 'image/png'].includes(file.type)) {
        reject(new Error('Pilih file JPG atau PNG.'));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        reject(new Error('Ukuran foto maksimal 2 MB.'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Foto tidak dapat dibaca.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('File foto tidak valid.'));
        image.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 256;
          const scale = Math.max(size / image.width, size / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('Browser tidak dapat memproses foto.'));
            return;
          }
          canvas.width = size;
          canvas.height = size;
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, size, size);
          context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function validateContact(value) {
    if (!value) return '';
    if (value.includes('@')) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'Format email belum benar.';
    }
    return /^\+?[\d ()-]{6,20}$/.test(value) ? '' : 'Masukkan email atau nomor telepon yang valid.';
  }

  function nextUserId(users) {
    const numericIds = users.map((user) => Number(user.id)).filter((id) => Number.isSafeInteger(id) && id > 0);
    return (numericIds.length ? Math.max(...numericIds) : 0) + 1;
  }

  function validateAdminTransition(existing, nextUser, users) {
    if (String(nextUser.id) === String(session.userId) && !nextUser.isActive) {
      return 'Anda tidak dapat menonaktifkan akun sendiri.';
    }
    const nextUsers = users.map((user) => String(user.id) === String(nextUser.id) ? nextUser : user);
    if (!users.some((user) => String(user.id) === String(nextUser.id))) nextUsers.push(nextUser);
    if (activeAdminCount(nextUsers) < 1) {
      return 'Tidak dapat mengubah akun ini. Sistem harus selalu memiliki minimal satu Admin aktif.';
    }
    if (existing && existing.role === 'admin' && existing.isActive &&
        (nextUser.role !== 'admin' || !nextUser.isActive) && activeAdminCount(users) <= 1) {
      return 'Admin aktif terakhir tidak dapat dinonaktifkan atau diubah perannya.';
    }
    return '';
  }

  function validateUnique(values, existingId) {
    const username = values.username.toLowerCase();
    const contact = values.email.toLowerCase();
    const duplicateUsername = state.users.some((user) =>
      String(user.id) !== String(existingId) && String(user.username || '').toLowerCase() === username
    );
    const duplicateContact = contact && state.users.some((user) =>
      String(user.id) !== String(existingId) && String(user.email || '').toLowerCase() === contact
    );
    return {
      username: duplicateUsername ? 'Username sudah digunakan.' : '',
      email: duplicateContact ? 'Email atau nomor telepon sudah digunakan.' : '',
    };
  }

  async function submitUserForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError(form, '');
    ['nama', 'username', 'email', 'password', 'confirmPassword'].forEach((field) => setFieldError(form, field, ''));
    const data = new FormData(form);
    const values = {
      nama: String(data.get('nama') || '').trim(),
      username: String(data.get('username') || '').trim().toLowerCase(),
      email: String(data.get('email') || '').trim(),
      role: String(data.get('role') || ''),
      isActive: data.get('isActive') === 'on',
      password: String(data.get('password') || ''),
      confirmPassword: String(data.get('confirmPassword') || ''),
    };
    let valid = true;
    if (!values.nama) { setFieldError(form, 'nama', 'Nama lengkap wajib diisi.'); valid = false; }
    if (!values.username || /\s/.test(values.username)) { setFieldError(form, 'username', 'Username wajib diisi tanpa spasi.'); valid = false; }
    const unique = validateUnique(values, state.editId);
    if (unique.username) { setFieldError(form, 'username', unique.username); valid = false; }
    const contactError = validateContact(values.email);
    if (contactError || unique.email) { setFieldError(form, 'email', contactError || unique.email); valid = false; }
    if (!['admin', 'kasir'].includes(values.role)) { setFormError(form, 'Pilih peran Admin atau Kasir.'); valid = false; }
    const existing = state.editId == null ? null : userById(state.editId);
    if (state.editId != null && !existing) {
      setFormError(form, 'Akun tidak ditemukan. Muat ulang halaman lalu coba lagi.');
      return;
    }
    if (!existing && values.password.length < 8) { setFieldError(form, 'password', 'Password harus minimal 8 karakter.'); valid = false; }
    if (!existing && values.password !== values.confirmPassword) { setFieldError(form, 'confirmPassword', 'Password tidak cocok.'); valid = false; }
    if (!valid) return;

    const id = existing ? existing.id : nextUserId(state.users);
    const nextUser = {
      ...(existing || {}),
      id,
      staffCode: existing
        ? (existing.staffCode || staffCodeFor(values.role, id))
        : staffCodeFor(values.role, nextStaffSequence(values.role, state.users)),
      nama: values.nama,
      username: values.username,
      email: values.email,
      role: values.role,
      isActive: values.isActive,
      photo: state.dialogPhoto || '',
    };
    const guard = validateAdminTransition(existing, nextUser, state.users);
    if (guard) {
      setFormError(form, guard);
      return;
    }
    if (!existing) nextUser.passwordHash = await sha256(values.password);
    const nextUsers = existing
      ? state.users.map((user) => String(user.id) === String(id) ? nextUser : user)
      : [...state.users, nextUser];
    if (!persistUsers(nextUsers, form)) return;

    const roleChanged = existing && String(existing.id) === String(session.userId) && existing.role !== nextUser.role;
    updateSessionUser(nextUser);
    userDialog.close();
    render();
    Audit.log({
      action: existing ? 'user.update' : 'user.create',
      entity: 'user',
      entityId: nextUser.id,
      summary: nextUser.nama + ' · ' + nextUser.role + ' · ' + nextUser.staffCode,
    });
    showToast(existing ? 'Perubahan pengguna berhasil disimpan.' : 'Pengguna berhasil ditambahkan.');
    if (roleChanged) window.location.replace(Auth.homeFor(nextUser.role));
  }

  async function submitResetForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError(form, '');
    setFieldError(form, 'password', '');
    setFieldError(form, 'confirmPassword', '');
    const data = new FormData(form);
    const password = String(data.get('password') || '');
    const confirmPassword = String(data.get('confirmPassword') || '');
    if (password.length < 8) { setFieldError(form, 'password', 'Password harus minimal 8 karakter.'); return; }
    if (password !== confirmPassword) { setFieldError(form, 'confirmPassword', 'Password tidak cocok.'); return; }
    const user = userById(state.resetId);
    if (!user) { setFormError(form, 'Akun tidak ditemukan. Muat ulang halaman lalu coba lagi.'); return; }
    const passwordHash = await sha256(password);
    const nextUsers = state.users.map((entry) => String(entry.id) === String(user.id)
      ? { ...entry, passwordHash }
      : entry);
    if (!persistUsers(nextUsers, form)) return;
    resetDialog.close();
    render();
    Audit.log({ action: 'user.reset', entity: 'user', entityId: user.id, summary: user.nama + ' · password direset Admin' });
    showToast(`Password ${user.nama} berhasil direset.`);
  }

  function handleStatusToggle() {
    const pending = state.pendingStatus;
    if (!pending) return;
    const user = userById(pending.id);
    if (!user) { statusDialog.close(); showToast('Akun tidak ditemukan. Muat ulang halaman.', true); return; }
    const nextUser = { ...user, isActive: pending.active };
    const guard = validateAdminTransition(user, nextUser, state.users);
    if (guard) {
      statusDialog.close();
      openProtectionDialog(user, guard);
      return;
    }
    const nextUsers = state.users.map((entry) => String(entry.id) === String(user.id) ? nextUser : entry);
    if (!persistUsers(nextUsers)) return;
    statusDialog.close();
    render();
    Audit.log({
      action: 'user.toggle',
      entity: 'user',
      entityId: user.id,
      summary: user.nama + ' · ' + (pending.active ? 'diaktifkan' : 'dinonaktifkan'),
    });
    showToast(pending.active ? 'Akun berhasil diaktifkan.' : 'Akun berhasil dinonaktifkan.');
    state.pendingStatus = null;
  }

  function bindProfileEvents() {
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('profile-password-form');
    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFieldError(profileForm, 'nama', '');
      setFieldError(profileForm, 'email', '');
      const data = new FormData(profileForm);
      const nama = String(data.get('nama') || '').trim();
      const email = String(data.get('email') || '').trim();
      if (!nama) { setFieldError(profileForm, 'nama', 'Nama lengkap wajib diisi.'); return; }
      const contactError = validateContact(email);
      if (!email || contactError) { setFieldError(profileForm, 'email', contactError || 'Email atau nomor telepon wajib diisi.'); return; }
      const duplicate = state.users.some((user) =>
        String(user.id) !== String(session.userId) && String(user.email || '').toLowerCase() === email.toLowerCase()
      );
      if (duplicate) { setFieldError(profileForm, 'email', 'Email atau nomor telepon sudah digunakan.'); return; }
      const user = currentUser();
      if (!user) { showToast('Akun tidak ditemukan. Silakan masuk kembali.', true); return; }
      const updated = { ...user, nama, email, photo: state.profilePhoto || '' };
      const nextUsers = state.users.map((entry) => String(entry.id) === String(user.id) ? updated : entry);
      if (!persistUsers(nextUsers, profileForm)) return;
      updateSessionUser(updated);
      state.profileMessage = 'Profil berhasil diperbarui.';
      renderProfile();
      showToast('Profil berhasil diperbarui.');
    });

    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      ['currentPassword', 'newPassword', 'confirmPassword'].forEach((field) => setFieldError(passwordForm, field, ''));
      const data = new FormData(passwordForm);
      const currentPassword = String(data.get('currentPassword') || '');
      const newPassword = String(data.get('newPassword') || '');
      const confirmPassword = String(data.get('confirmPassword') || '');
      if (!currentPassword) { setFieldError(passwordForm, 'currentPassword', 'Password saat ini wajib diisi.'); return; }
      if (newPassword.length < 8) { setFieldError(passwordForm, 'newPassword', 'Password baru harus minimal 8 karakter.'); return; }
      if (newPassword !== confirmPassword) { setFieldError(passwordForm, 'confirmPassword', 'Password tidak cocok.'); return; }
      const user = currentUser();
      if (!user || user.passwordHash !== await sha256(currentPassword)) {
        setFieldError(passwordForm, 'currentPassword', 'Password saat ini tidak sesuai.');
        return;
      }
      const passwordHash = await sha256(newPassword);
      const nextUsers = state.users.map((entry) => String(entry.id) === String(user.id)
        ? { ...entry, passwordHash }
        : entry);
      if (!persistUsers(nextUsers, passwordForm)) return;
      state.profileMessage = 'Password berhasil diperbarui.';
      renderProfile();
      Audit.log({ action: 'user.update', entity: 'user', entityId: user.id, summary: 'Password diubah sendiri oleh ' + user.nama });
      showToast('Password berhasil diperbarui.');
    });
  }

  async function handlePhotoInput(input) {
    if (!input.files || !input.files[0]) return;
    try {
      const photo = await processPhoto(input.files[0]);
      if (input.id === 'user-photo-input') {
        state.dialogPhoto = photo;
        const user = state.editId == null ? { nama: userForm.elements.nama.value } : userById(state.editId);
        displayPhoto(document.getElementById('user-photo-preview'), photo, user ? user.nama : 'Pengguna');
      } else {
        state.profilePhoto = photo;
        const user = currentUser();
        displayPhoto(document.getElementById('profile-avatar'), photo, user ? user.nama : 'Admin');
      }
    } catch (error) {
      console.error('Pemrosesan foto pengguna gagal.', error);
      showToast(error.message || 'Foto tidak dapat diproses.', true);
    } finally {
      input.value = '';
    }
  }

  function handleClick(event) {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    switch (action.dataset.action) {
      case 'show-list':
        state.profileMessage = '';
        state.tab = 'list';
        render();
        break;
      case 'show-profile':
        state.profileMessage = '';
        state.tab = 'profile';
        render();
        break;
      case 'add-user':
        openUserDialog('add', null);
        break;
      case 'edit-user': {
        const user = userById(action.dataset.userId);
        if (user) openUserDialog('edit', user);
        break;
      }
      case 'reset-password': {
        const user = userById(action.dataset.userId);
        if (user) openResetDialog(user);
        break;
      }
      case 'toggle-status': {
        const user = userById(action.dataset.userId);
        if (!user) break;
        if (user.isActive && String(user.id) === String(session.userId)) {
          openProtectionDialog(user, 'Anda tidak dapat menonaktifkan akun sendiri.');
        } else if (user.isActive && user.role === 'admin' && activeAdminCount(state.users) <= 1) {
          openProtectionDialog(user, 'Akun ini adalah satu-satunya Admin aktif.');
        } else {
          openStatusDialog(user);
        }
        break;
      }
      case 'confirm-status':
        handleStatusToggle();
        break;
      case 'page':
        state.page = Math.max(1, Number(action.dataset.page) || 1);
        document.getElementById('users-table-region').innerHTML = tableRegionMarkup();
        break;
      case 'reset-filters':
        state.query = '';
        state.role = '';
        state.status = '';
        state.page = 1;
        renderList();
        break;
      case 'select-user-photo':
        document.getElementById('user-photo-input').click();
        break;
      case 'remove-user-photo':
        state.dialogPhoto = '';
        displayPhoto(document.getElementById('user-photo-preview'), '', userForm.elements.nama.value);
        break;
      case 'select-profile-photo':
        document.getElementById('profile-photo-input').click();
        break;
      case 'remove-profile-photo':
        state.profilePhoto = '';
        displayPhoto(document.getElementById('profile-avatar'), '', currentUser().nama);
        break;
      case 'close-user':
        userDialog.close();
        break;
      case 'close-reset':
        resetDialog.close();
        break;
      case 'close-status':
        state.pendingStatus = null;
        statusDialog.close();
        break;
      case 'close-protection':
        protectionDialog.close();
        break;
      default:
        break;
    }
  }

  userForm.addEventListener('submit', submitUserForm);
  resetForm.addEventListener('submit', submitResetForm);
  document.addEventListener('click', handleClick);
  document.addEventListener('change', (event) => {
    if (event.target.id === 'user-photo-input' || event.target.id === 'profile-photo-input') {
      handlePhotoInput(event.target);
    }
    if (event.target.matches('.users-status-toggle input')) {
      const label = event.target.closest('.users-status-toggle').querySelector('.users-switch-label > span:last-child');
      label.textContent = event.target.checked ? 'Aktif' : 'Nonaktif';
    }
  });
  document.querySelectorAll('dialog.users-dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
  document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());
  document.getElementById('menu-toggle').addEventListener('click', () => {
    const sidebar = document.getElementById('products-sidebar');
    const isOpen = sidebar.classList.toggle('is-open');
    document.getElementById('menu-toggle').setAttribute('aria-expanded', String(isOpen));
    document.getElementById('products-backdrop').hidden = !isOpen;
  });
  document.getElementById('products-backdrop').addEventListener('click', () => {
    document.getElementById('products-sidebar').classList.remove('is-open');
    document.getElementById('products-backdrop').hidden = true;
    document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
  });

  try {
    loadUsers();
    updateHeader();
    render();
  } catch (error) {
    console.error('Halaman pengguna gagal dimuat.', error);
    main.innerHTML = '<section class="product-panel users-table-empty"><h1>Data pengguna tidak dapat dimuat</h1><p>Periksa penyimpanan browser lalu muat ulang halaman.</p></section>';
  }
}());
