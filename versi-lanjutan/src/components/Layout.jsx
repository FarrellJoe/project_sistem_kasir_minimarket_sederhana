import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3, History, LayoutDashboard, LogOut, Menu, Package, Settings, ShoppingCart, Users, Warehouse, X,
} from 'lucide-react';
import { useSessionStore } from '../stores';
import { initials } from '../lib/format';
import { logout } from '../lib/api';
import { Badge, Button, cn } from './ui';

const HINTS = {
  '/dashboard': { title: 'Ringkasan Toko', text: 'Pantau penjualan, stok menipis, dan produk terlaris.' },
  '/kasir': { title: 'Akses kasir', text: 'Fokus pada penjualan dan transaksi harian.' },
  '/produk': { title: 'Manajemen Produk', text: 'Kelola katalog, kategori, harga, dan ketersediaan barang.' },
  '/stok': { title: 'Manajemen Stok', text: 'Monitoring ketersediaan dan penyesuaian stok manual.' },
  '/riwayat': { title: 'Riwayat Transaksi', text: 'Telusuri transaksi tersimpan dan pembatalannya.' },
  '/laporan': { title: 'Laporan Penjualan', text: 'Analisis performa penjualan per periode.' },
  '/pengguna': { title: 'Manajemen Pengguna', text: 'Atur akun, peran, dan akses ke sistem toko.' },
  '/pengaturan': { title: 'Pengaturan Toko', text: 'Identitas toko dan opsi sistem.' },
};

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { to: '/kasir', label: 'Kasir', icon: ShoppingCart, roles: ['admin', 'kasir'] },
  { to: '/produk', label: 'Produk', icon: Package, roles: ['admin', 'kasir'] },
  { to: '/stok', label: 'Stok', icon: Warehouse, roles: ['admin', 'kasir'] },
  { to: '/riwayat', label: 'Riwayat', icon: History, roles: ['admin', 'kasir'] },
  { to: '/laporan', label: 'Laporan', icon: BarChart3, roles: ['admin'] },
  { to: '/pengguna', label: 'Pengguna', icon: Users, roles: ['admin'] },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings, roles: ['admin'] },
];

export default function Layout({ title, subtitle, actions, children }) {
  const session = useSessionStore((state) => state.session);
  const clearSession = useSessionStore((state) => state.clearSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const nav = NAV.filter((item) => item.roles.includes(session?.role));
  const hint = HINTS[location.pathname] || { title: 'Brahamart', text: 'Sistem kasir minimarket.' };
  const today = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  const handleLogout = async () => {
    await logout(session);
    clearSession();
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col bg-sidebar text-white transition-transform lg:static lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white" aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}brand/brahamart-mark.png`} alt="" className="h-9 w-9 object-contain" />
          </span>
          <span className="font-heading text-lg font-semibold">Brahamart</span>
          <button type="button" className="ml-auto rounded p-1 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Tutup navigasi">
            <X size={18} />
          </button>
        </div>

        <p className="px-5 pb-2 text-sm uppercase tracking-wide text-indigo-200/80">
          {session?.role === 'admin' ? 'Ruang kerja admin' : 'Ruang kerja kasir'}
        </p>

        <nav className="flex-1 space-y-1 px-3" aria-label="Navigasi utama">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-primary text-white' : 'text-indigo-100 hover:bg-sidebar-hover',
                )
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mx-3 mb-2 rounded-lg bg-white/5 p-3">
          <strong className="block text-sm font-semibold">{hint.title}</strong>
          <span className="mt-1 block text-sm leading-snug text-indigo-200/80">{hint.text}</span>
        </div>

        <div className="m-3 mt-0 rounded-lg bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-sm font-semibold">
              {initials(session?.nama)}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{session?.nama || 'Pengguna'}</strong>
              <span className="block text-sm text-indigo-200/80">{session?.staffCode || ''}</span>
            </span>
            <button type="button" onClick={handleLogout} className="rounded p-1.5 hover:bg-white/10" aria-label="Keluar">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Buka navigasi">
            <Menu size={18} />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-lg font-semibold text-ink">{title}</h1>
            {subtitle ? <p className="truncate text-sm text-ink-muted">{subtitle}</p> : null}
          </div>
          <div className="hidden items-center gap-3 md:flex">{actions}</div>
          <span className="hidden text-sm text-ink-muted lg:block tnum">{today}</span>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-right leading-tight">
              <strong className="block text-sm text-ink">{session?.nama || 'Pengguna'}</strong>
              <span className="block text-sm text-ink-muted">{session?.staffCode || ''}</span>
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-tint text-sm font-semibold text-primary-hover">
              {initials(session?.nama)}
            </span>
          </div>
          <Badge tone={session?.role === 'admin' ? 'info' : 'neutral'} className="capitalize">
            {session?.role || '-'}
          </Badge>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
