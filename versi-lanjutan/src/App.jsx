import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getSession } from './lib/api';
import { useSessionStore } from './stores';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Kasir from './pages/Kasir.jsx';
import Produk from './pages/Produk.jsx';
import Stok from './pages/Stok.jsx';
import Riwayat from './pages/Riwayat.jsx';
import Laporan from './pages/Laporan.jsx';
import Pengguna from './pages/Pengguna.jsx';
import Pengaturan from './pages/Pengaturan.jsx';

function RequireAuth({ roles, children }) {
  const session = useSessionStore((state) => state.session);
  const ready = useSessionStore((state) => state.ready);
  const location = useLocation();

  if (!ready) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-sm text-ink-muted">Memuat sesi…</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(session.role)) {
    return <Navigate to={session.role === 'admin' ? '/dashboard' : '/kasir'} replace />;
  }
  return children;
}

export default function App() {
  const setSession = useSessionStore((state) => state.setSession);
  const setReady = useSessionStore((state) => state.setReady);

  useEffect(() => {
    let active = true;
    getSession().then((session) => {
      if (!active) return;
      setSession(session);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [setSession, setReady]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth roles={['admin']}>
            <Layout title="Dashboard" subtitle="Ringkasan penjualan dan stok hari ini">
              <Dashboard />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/kasir"
        element={
          <RequireAuth roles={['admin', 'kasir']}>
            <Layout title="Kasir" subtitle="Terminal transaksi penjualan">
              <Kasir />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/produk"
        element={
          <RequireAuth roles={['admin', 'kasir']}>
            <Layout title="Produk" subtitle="Katalog barang, harga, dan status">
              <Produk />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/stok"
        element={
          <RequireAuth roles={['admin', 'kasir']}>
            <Layout title="Stok" subtitle="Ketersediaan barang dan penyesuaian">
              <Stok />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/riwayat"
        element={
          <RequireAuth roles={['admin', 'kasir']}>
            <Layout title="Riwayat" subtitle="Transaksi tersimpan dan pembatalannya">
              <Riwayat />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/laporan"
        element={
          <RequireAuth roles={['admin']}>
            <Layout title="Laporan" subtitle="Rekap penjualan per periode">
              <Laporan />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/pengguna"
        element={
          <RequireAuth roles={['admin']}>
            <Layout title="Pengguna" subtitle="Akun admin dan kasir">
              <Pengguna />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/pengaturan"
        element={
          <RequireAuth roles={['admin']}>
            <Layout title="Pengaturan" subtitle="Identitas toko dan opsi sistem">
              <Pengaturan />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/kasir" replace />} />
    </Routes>
  );
}
