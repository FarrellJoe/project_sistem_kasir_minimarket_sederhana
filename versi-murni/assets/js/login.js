/* =========================================================
   login.js: perilaku halaman login
   ========================================================= */

(async function () {
  // Siapkan data awal, lalu lewati halaman login jika sudah masuk
  await seedUsers();

  const existing = Auth.getSession();
  if (existing) {
    window.location.replace(Auth.homeFor(existing.role));
    return;
  }

  const form = document.getElementById('login-form');
  const identifierInput = document.getElementById('identifier');
  const passwordInput = document.getElementById('password');
  const identifierError = document.getElementById('identifier-error');
  const passwordError = document.getElementById('password-error');
  const formError = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');
  const submitLabel = submitBtn.querySelector('.btn__label');
  const toggleBtn = document.getElementById('toggle-password');

  /* ----- Helper tampilan ----- */
  function setFieldError(input, errorEl, message) {
    if (message) {
      errorEl.textContent = message;   // textContent: aman dari XSS
      errorEl.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorEl.id);
    } else {
      errorEl.hidden = true;
      errorEl.textContent = '';
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function setFormError(message) {
    formError.textContent = message;
    formError.hidden = !message;
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('is-loading', isLoading);
    submitLabel.textContent = isLoading ? 'Memproses...' : 'Masuk';
  }

  function clearErrors() {
    setFormError('');
    setFieldError(identifierInput, identifierError, '');
    setFieldError(passwordInput, passwordError, '');
  }

  /* ----- Tampilkan / sembunyikan password ----- */
  toggleBtn.addEventListener('click', function () {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', String(show));
    toggleBtn.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
  });

  /* Hapus pesan error saat pengguna mulai mengetik lagi */
  identifierInput.addEventListener('input', function () {
    setFieldError(identifierInput, identifierError, '');
    setFormError('');
  });
  passwordInput.addEventListener('input', function () {
    setFieldError(passwordInput, passwordError, '');
    setFormError('');
  });

  /* ----- Kirim form ----- */
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearErrors();

    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;

    // Validasi kelengkapan
    let valid = true;
    if (!identifier) {
      setFieldError(identifierInput, identifierError, 'Username atau email wajib diisi.');
      valid = false;
    }
    if (!password) {
      setFieldError(passwordInput, passwordError, 'Password wajib diisi.');
      valid = false;
    }
    if (!valid) {
      (identifier ? passwordInput : identifierInput).focus();
      return;
    }

    /* Web Crypto hanya tersedia pada konteks aman (https, localhost, atau sebagian browser pada file://).
       Tanpa ini, sha256() gagal dan tombol akan berhenti di status "Memproses...". */
    if (!(window.crypto && window.crypto.subtle)) {
      setFormError('Browser ini memblokir Web Crypto pada alamat file://. Jalankan lewat server lokal (lihat README).');
      return;
    }

    setLoading(true);
    const result = await Auth.login(identifier, password);

    if (result.ok) {
      window.location.replace(Auth.homeFor(result.user.role));
      return;
    }

    setLoading(false);

    if (result.code === 'locked') {
      setFormError(
        'Terlalu banyak percobaan. Coba lagi dalam ' + result.minutesLeft + ' menit.'
      );
    } else if (result.code === 'inactive') {
      setFormError('Akun tidak aktif. Hubungi admin.');
    } else {
      setFormError('Username atau password salah.');
      passwordInput.value = '';
      passwordInput.focus();
    }
  });
})();
