# Catatan Lanjutan (Handoff)

Terakhir diperbarui: 15 November 2026, sesi malam
Repo: https://github.com/FarrellJoe/project_sistem_kasir_minimarket_sederhana (branch `main`)
Lokal: `D:\brahamart-kasir\brahamart-kasir`

Dokumen ini untuk melanjutkan pekerjaan di sesi berikutnya tanpa membaca ulang seluruh percakapan.

## 1. Status hari ini

| Area | Status |
| --- | --- |
| Audit kode + 9 temuan diperbaiki (versi-murni) | Selesai, teruji |
| SRS diperbarui ke 1.4 (Bab 8 catatan implementasi, 8.6 dua varian) | Selesai |
| versi-lanjutan dibangun ulang dengan React 18 + Vite + Tailwind + shadcn-style | Selesai, `npm run build` sukses |
| Tipografi dinaikkan ke ≥14 px di kedua varian | Selesai, terukur 0 elemen di bawah ambang |
| Tahap 1 konsistensi tampilan (React) | Selesai, teruji |
| Tahap 2 (celah fungsional) | **Belum dikerjakan** |
| Tahap 3 (uji regresi + dokumen) | Belum |

## 2. Yang selesai di Tahap 1

1. Kotak hint sidebar per halaman (`HINTS` di `components/Layout.jsx`) — teks disamakan dengan versi-murni.
2. Topbar lengkap: tanggal, nama pengguna, kode staf, avatar inisial, lencana peran.
3. Header terminal kasir: "Terminal Kasir 01", shift otomatis dari jam, `Kasir ID` (staffCode), status "Lokal · siap transaksi", jumlah struk hari ini, sesi tidak aktif 30 menit.
4. Panel produk cepat (4 produk, prioritas id `plastic/tea/bread/lighter`) yang menambah langsung ke keranjang.
5. Struk: barcode dekoratif (`.receipt-barcode` di `index.css`), baris PPN, dan tombol ukuran 58/80 mm di dialog (menimpa nilai Pengaturan untuk sesi itu).

Bukti uji: header menampilkan `Shift Malam · Kasir ID: ADM-0101 ... Struk hari ini: 2`, klik produk cepat → keranjang 1 baris total Rp 500, struk `size=80`, barcode 34 px, tombol 58 mm mengubah `data-size`, nol error JS.

## 3. Yang belum (Tahap 2) — rencana rinci

| # | Kebutuhan | Berkas sasaran | Catatan teknis |
| --- | --- | --- | --- |
| 5 | FR-14 diskon per item + persetujuan Admin untuk >10% | `src/pages/Kasir.jsx`, `src/stores/index.js`, `src/lib/api.js` | Port dari `versi-murni/assets/js/cashier.js` (`itemDiscounts`, `applyDiscount`, verifikasi `passwordHash` Admin). Simpan `itemDiscount` per item pada transaksi. |
| 6 | FR-19 Profil Saya + ganti password | baru: `src/pages/Profil.jsx` + route `/profil` | Pakai `saveUser` (sudah ada) dan verifikasi password lama seperti `users.js` versi-murni. |
| 7 | NFR-02 pagination 10 baris | `Produk.jsx`, `Riwayat.jsx`, `Pengguna.jsx` | Pola: `useState({ page })`, `slice`, kontrol "Sebelumnya/Berikutnya" seperti `users-pagination` versi-murni. |
| 8 | NFR-03 timer idle 30 menit | `src/App.jsx`, `src/lib/api.js` | Tambah `touchSession()` + `setInterval` 15 detik; jika lewat 30 menit → `logout` + `Navigate` ke login. |

Tahap 3: uji regresi 19 FR di kedua varian, perbarui `docs/AUDIT.md` dan `docs/CONFORMANCE.md` (status FR-14, FR-19, NFR-02, NFR-03).

## 4. Cara menjalankan dan menguji

```bash
# versi-murni
cd versi-murni && python -m http.server 8000     # http://localhost:8000/login.html

# versi-lanjutan (dev)
cd versi-lanjutan && npm install && npm run dev   # http://localhost:5173

# versi-lanjutan (uji hasil build)
cd versi-lanjutan && npm run build
cd dist && python -m http.server 8125             # http://localhost:8125/
```

Akun: `admin` / `admin123` (ADM-0101), `kasir` / `kasir123` (KSR-0881). Login otomatis membuat data seed.

Uji browser otomatis dipakai lewat CDP dengan skrip di `%LOCALAPPDATA%\hermes\cache\scratch\cdp.mjs` (driver bebas dependensi: `goto`, `reload`, `wait`, `eval`, `shot`, `inject`). Chrome dijalankan headless dengan `--remote-debugging-port=9333`.

## 5. Kontrak yang harus dijaga

- **Kunci localStorage sama di kedua varian**: `kasir_users`, `kasir_session`, `kasir_products`, `kasir_categories`, `kasir_transactions`, `kasir_stock_movements`, `kasir_settings`, `kasir_activity`, `kasir_holds`, `kasir_shifts`.
- **Titik ganti backend**: hanya `versi-lanjutan/src/lib/api.js` (semua fungsi `async`) dan `versi-murni/assets/js/product-store.js`.
- **Token desain**: indigo `#4F46E5`, sidebar `#312E81`, amber `#F59E0B`, hijau `#22C55E`, merah `#EF4444`, biru `#3B82F6`; Poppins untuk judul, Inter untuk isi; teks isi minimal 14 px.
- **Aset merek**: `versi-lanjutan/public/brand/brahamart-mark.png` (dipakai sidebar & login) harus tetap sama berkasnya dengan `versi-murni/assets/img/Brahamart_keranjang-removebg-preview.png`.
- **Format nomor**: transaksi `TRX-YYYYMMDD-NNNN`, staf `KSR-0881` / `ADM-0101`.

## 6. Jebakan yang sudah ditemui (jangan diulang)

1. `crypto.subtle` tidak tersedia pada `file://` di sebagian peramban → selalu pakai server (localhost).
2. CSS cetak `body * { visibility: hidden }` hanya menampilkan `.print-area`; halaman Laporan pernah tercetak kosong karena elemennya tidak diberi kelas itu.
3. Chrome menyimpan CSS lama saat diuji dengan `python -m http.server` → pakai `Page.reload {ignoreCache:true}` sebelum mengukur ulang.
4. Data uji menempel di `localStorage` (mis. nama toko "Brahamart React Test"); bersihkan sebelum mengambil tangkapan layar untuk laporan.
5. `npm install` perlu izin postinstall `esbuild`; build tetap berjalan karena biner platform `@esbuild/win32-x64` terpasang.
6. Jangan menaruh listener `window.addEventListener('storage', …)` di dalam `forEach` (bug asli yang ditemukan di `cashier.js`).

## 7. Langkah pertama sesi berikutnya

1. Buka `docs/CONFORMANCE.md`, kerjakan Tahap 2 nomor 5 (FR-14) lebih dulu karena paling berdampak pada aturan bisnis.
2. Setelah tiap butir: `npm run build`, uji di browser, lalu perbarui tabel di `CONFORMANCE.md`.
3. Commit dengan format `versi-lanjutan tahap 2: <butir>` dan push ke `main`.
