/* =========================================================
   auth.js: login, sesi, dan pembatasan akses per peran
   Bergantung pada storage.js (DB, KEYS, sha256)
   ========================================================= */

const SESSION_MINUTES = 30;  // sesi berakhir jika tidak aktif
const MAX_ATTEMPTS = 5;      // batas gagal login berturut-turut
const LOCK_MINUTES = 5;      // lama akun terkunci sementara

const Auth = {
  _activityBound: false,
  _lastActivityAt: 0,
  _lastSessionWriteAt: 0,
  _redirectingForExpiry: false,

  /* Halaman awal setiap peran setelah login */
  homeFor(role) {
    return role === 'admin' ? 'dashboard.html' : 'kasir.html';
  },

  /* ----- Pembatasan percobaan login ----- */
  _attemptsFor(identifier) {
    const all = DB.read(KEYS.attempts, {});
    return all[identifier] || { count: 0, lockedUntil: 0 };
  },

  _saveAttempts(identifier, record) {
    const all = DB.read(KEYS.attempts, {});
    all[identifier] = record;
    DB.write(KEYS.attempts, all);
  },

  _clearAttempts(identifier) {
    const all = DB.read(KEYS.attempts, {});
    delete all[identifier];
    DB.write(KEYS.attempts, all);
  },

  /* ----- Login ----- */
  /* Hasil: { ok: true, user } atau { ok: false, code, minutesLeft? }
     code: 'locked' | 'invalid' | 'inactive' */
  async login(identifier, password) {
    const key = identifier.trim().toLowerCase();
    const attempts = this._attemptsFor(key);
    const now = Date.now();

    if (attempts.lockedUntil > now) {
      const minutesLeft = Math.ceil((attempts.lockedUntil - now) / 60000);
      return { ok: false, code: 'locked', minutesLeft };
    }

    const users = DB.getUsers();
    const user = users.find(
      (u) => String(u.username || '').toLowerCase() === key ||
        String(u.email || '').toLowerCase() === key
    );
    const hash = await sha256(password);

    if (!user || user.passwordHash !== hash) {
      const count = attempts.count + 1;
      const lockedUntil = count >= MAX_ATTEMPTS ? now + LOCK_MINUTES * 60000 : 0;
      this._saveAttempts(key, { count: lockedUntil ? 0 : count, lockedUntil });

      if (lockedUntil) return { ok: false, code: 'locked', minutesLeft: LOCK_MINUTES };
      return { ok: false, code: 'invalid' };
    }

    if (!user.isActive) return { ok: false, code: 'inactive' };

    this._clearAttempts(key);
    user.lastLoginAt = new Date(now).toISOString();
    DB.saveUsers(users);
    this._startSession(user);
    if (window.Audit) {
      Audit.log({
        action: 'auth.login',
        entity: 'user',
        entityId: user.id,
        summary: user.nama + ' (' + user.role + ')',
        userId: user.id,
        userName: user.nama,
        role: user.role,
        staffCode: user.staffCode || '',
      });
    }
    return { ok: true, user };
  },

  /* ----- Sesi ----- */
  _startSession(user) {
    const now = Date.now();
    DB.write(KEYS.session, {
      userId: user.id,
      staffCode: user.staffCode || staffCodeFor(user.role, user.id),
      nama: user.nama,
      username: user.username,
      role: user.role,
      lastActivityAt: now,
      expiresAt: now + SESSION_MINUTES * 60000,
    });
  },

  _expireSession() {
    DB.remove(KEYS.session);
    if (this._redirectingForExpiry) return;
    this._redirectingForExpiry = true;
    window.location.replace('login.html');
  },

  _bindSessionLifecycle() {
    if (this._activityBound) return;
    this._activityBound = true;
    const session = DB.read(KEYS.session, null);
    this._lastActivityAt = session && Number(session.lastActivityAt) || Date.now();

    const recordActivity = () => {
      const now = Date.now();
      const stored = DB.read(KEYS.session, null);
      if (!stored) {
        this._expireSession();
        return;
      }
      const lastActivity = Math.max(this._lastActivityAt, Number(stored.lastActivityAt) || 0);
      if (now - lastActivity >= SESSION_MINUTES * 60000) {
        this._expireSession();
        return;
      }
      this._lastActivityAt = now;
      if (now - this._lastSessionWriteAt < 5000) return;
      stored.lastActivityAt = now;
      stored.expiresAt = now + SESSION_MINUTES * 60000;
      DB.write(KEYS.session, stored);
      this._lastSessionWriteAt = now;
    };

    ['click', 'keydown', 'pointerdown', 'touchstart'].forEach((eventName) => {
      document.addEventListener(eventName, recordActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') recordActivity();
    });
    window.setInterval(() => {
      const now = Date.now();
      const stored = DB.read(KEYS.session, null);
      if (!stored) {
        this._expireSession();
        return;
      }
      const lastActivity = Math.max(this._lastActivityAt, Number(stored.lastActivityAt) || 0);
      if (now - lastActivity >= SESSION_MINUTES * 60000) {
        this._expireSession();
        return;
      }
      this._lastActivityAt = lastActivity;
      if (lastActivity > this._lastSessionWriteAt) {
        stored.lastActivityAt = lastActivity;
        stored.expiresAt = lastActivity + SESSION_MINUTES * 60000;
        DB.write(KEYS.session, stored);
        this._lastSessionWriteAt = now;
      }
    }, 15000);
  },

  /* Mengembalikan sesi aktif, atau null jika tidak ada/kedaluwarsa.
     Setiap pemanggilan memperpanjang sesi (idle timeout). */
  getSession() {
    const session = DB.read(KEYS.session, null);
    if (!session) return null;

    const now = Date.now();
    if (!Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
      DB.remove(KEYS.session);
      return null;
    }

    session.lastActivityAt = now;
    session.expiresAt = now + SESSION_MINUTES * 60000;
    DB.write(KEYS.session, session);
    return session;
  },

  logout() {
    if (window.Audit) Audit.log({ action: 'auth.logout', entity: 'user', summary: 'Keluar dari sistem' });
    DB.remove(KEYS.session);
    window.location.replace('login.html');
  },

  /* Panggil di awal halaman yang dilindungi.
     roles: daftar peran yang boleh masuk, contoh ['admin'] atau ['admin', 'kasir'] */
  requireAuth(roles) {
    const session = this.getSession();

    if (!session) {
      window.location.replace('login.html');
      return null;
    }

    const user = DB.getUsers().find((entry) => String(entry.id) === String(session.userId));
    if (!user || !user.isActive) {
      DB.remove(KEYS.session);
      window.location.replace('login.html');
      return null;
    }

    session.nama = user.nama;
    session.username = user.username;
    session.role = user.role;
    session.staffCode = user.staffCode || staffCodeFor(user.role, user.id);
    DB.write(KEYS.session, session);

    if (roles && !roles.includes(session.role)) {
      window.location.replace(this.homeFor(session.role));
      return null;
    }

    this._bindSessionLifecycle();
    return session;
  },
};
