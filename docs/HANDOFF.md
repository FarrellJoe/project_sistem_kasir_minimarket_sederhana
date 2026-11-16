# Catatan Lanjutan (Handoff)

Terakhir diperbarui: 17 November 2026, dini hari
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
| Tahap 2 celah fungsional: FR-14, FR-19, NFR-02, NFR-03 | **Selesai, teruji di browser** |
| Tahap 3 (uji regresi formal 19 FR + SRS 1.5) | Belum |
| Audit ulang SRS 16 Nov: 5 selisih diperbaiki (filter kategori, laba, grafik tren, peringatan harga, guard nonaktifkan diri) | Selesai, teruji |
| Mark logo Brahamart diperbesar (88 px di tile 36 px, 128 px di tile 48 px) | Selesai |
| Tech stack Bab 2.7: Recharts 3 (grafik) + jsPDF 4 (PDF laporan), halaman berat di-lazy | Selesai, teruji |
| SRS naik ke 1.5 (Bab 8.7 status teknologi) + README/CONFORMANCE diperbarui | Selesai |

## 2. Yang selesai di Tahap 2

| Butir | Berkas | Bukti uji (16 Nov) |
| --- | --- | --- |
| FR-14 diskon per item + persetujuan Admin >10% | `stores/index.js` (`itemDiscounts`, `computeCartTotals`), `lib/api.js` (`verifyAdminApproval`), `pages/Kasir.jsx`, `pages/Riwayat.jsx` | Kasir memakai diskon 20% pada Rp 500 → diminta username/password Admin; setelah `admin`/`admin123` total jadi Rp 400, item tersimpan `discount: 100`, `discountType: percent`, `discountValue: 20`, `discountApprovedBy: "Rina Pratama"`, log `sale.discount.approve`. Admin sendiri tidak diminta persetujuan; diskon 5% tidak memicu blok Admin |
| FR-19 Profil Saya | `pages/Profil.jsx` (baru), `lib/api.js` (`getMyProfile`, `updateProfile`, `changePassword`), `App.jsx` route `/profil`, `components/Layout.jsx` menu + hint | Nama berubah → topbar & `kasir_session` ikut berubah; kontak tidak valid ditolak; password lama salah ditolak; password baru bisa dipakai login (lalu dikembalikan ke `admin123`) |
| NFR-02 pagination 10 baris | `components/ui.jsx` (`Pagination`), `Produk.jsx`, `Riwayat.jsx`, `Pengguna.jsx` | 24 produk → "Menampilkan 1–10 dari 24 produk", halaman 2 = baris 11–20; pencarian mengembalikan ke halaman 1 |
| NFR-03 timer idle 30 menit | `App.jsx` (efek aktivitas + interval 15 dtk), `lib/api.js` (`touchSession`, `getSession` tidak lagi memperpanjang saat dibaca) | `lastActivityAt` dimundurkan 31 menit → halaman dialihkan ke `#/login`, `kasir_session` terhapus |

Error JS selama uji akhir: 0. Ukuran font minimum terukur di `/profil` dan `/kasir`: 14 px.

## 3. Yang selesai di Tahap 1

1. Kotak hint sidebar per halaman (`HINTS` di `components/Layout.jsx`) — teks disamakan dengan versi-murni.
2. Topbar lengkap: tanggal, nama pengguna, kode staf, avatar inisial, lencana peran.
3. Header terminal kasir: "Terminal Kasir 01", shift otomatis dari jam, `Kasir ID` (staffCode), status "Lokal · siap transaksi", jumlah struk hari ini, sesi tidak aktif 30 menit.
4. Panel produk cepat (4 produk, prioritas id `plastic/tea/bread/lighter`) yang menambah langsung ke keranjang.
5. Struk: barcode dekoratif (`.receipt-barcode` di `index.css`), baris PPN, dan tombol ukuran 58/80 mm di dialog (menimpa nilai Pengaturan untuk sesi itu).

Bukti uji: header menampilkan `Shift Malam · Kasir ID: ADM-0101 ... Struk hari ini: 2`, klik produk cepat → keranjang 1 baris total Rp 500, struk `size=80`, barcode 34 px, tombol 58 mm mengubah `data-size`, nol error JS.

## 4. Yang belum (Tahap 3)

1. Uji regresi formal 19 FR di **kedua** varian, isi matriks bukti di `docs/AUDIT.md`.
2. SRS naik ke 1.5: catat Tahap 2 di Bab 8 (diskon item + persetujuan Admin di lapisan layanan, halaman Profil, pagination 10 baris, timer idle yang tidak memperpanjang sesi saat dibaca).
3. Opsional: foto profil di topbar; samakan ukuran pagination versi-murni (7–8) dengan versi-lanjutan (10).

## 5. Cara menjalankan dan menguji

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

## 6. Kontrak yang harus dijaga

- **Kunci localStorage sama di kedua varian**: `kasir_users`, `kasir_session`, `kasir_products`, `kasir_categories`, `kasir_transactions`, `kasir_stock_movements`, `kasir_settings`, `kasir_activity`, `kasir_holds`, `kasir_shifts`.
- **Titik ganti backend**: hanya `versi-lanjutan/src/lib/api.js` (semua fungsi `async`) dan `versi-murni/assets/js/product-store.js`.
- **Token desain**: indigo `#4F46E5`, sidebar `#312E81`, amber `#F59E0B`, hijau `#22C55E`, merah `#EF4444`, biru `#3B82F6`; Poppins untuk judul, Inter untuk isi; teks isi minimal 14 px.
- **Aset merek**: `versi-lanjutan/public/brand/brahamart-mark.png` (dipakai sidebar & login) harus tetap sama berkasnya dengan `versi-murni/assets/img/Brahamart_keranjang-removebg-preview.png`.
- **Format nomor**: transaksi `TRX-YYYYMMDD-NNNN`, staf `KSR-0881` / `ADM-0101`.

## 7. Jebakan yang sudah ditemui (jangan diulang)

1. `crypto.subtle` tidak tersedia pada `file://` di sebagian peramban → selalu pakai server (localhost).
2. CSS cetak `body * { visibility: hidden }` hanya menampilkan `.print-area`; halaman Laporan pernah tercetak kosong karena elemennya tidak diberi kelas itu.
3. Chrome menyimpan CSS lama saat diuji dengan `python -m http.server` → pakai `Page.reload {ignoreCache:true}` sebelum mengukur ulang.
4. Data uji menempel di `localStorage` (mis. nama toko "Brahamart React Test"); bersihkan sebelum mengambil tangkapan layar untuk laporan.
5. `npm install` perlu izin postinstall `esbuild`; build tetap berjalan karena biner platform `@esbuild/win32-x64` terpasang.
6. Jangan menaruh listener `window.addEventListener('storage', …)` di dalam `forEach` (bug asli yang ditemukan di `cashier.js`).
7. Uji CDP: `[role=dialog]` bisa menangkap dialog struk yang masih terbuka dari langkah sebelumnya karena navigasi hash tidak memuat ulang halaman. Paksa muat ulang dengan query berbeda (`http://127.0.0.1:8125/?r=n#/kasir`) dan pilih dialog berdasarkan judulnya, bukan `querySelector('[role=dialog]')`.
8. `getSession()` sengaja **tidak** memperpanjang umur sesi; hanya `touchSession()` yang memperpanjang, dan itu dipanggil dari efek aktivitas di `App.jsx`. Jangan menambah perpanjangan lain tanpa memeriksa timer idle.
9. Diskon item dihitung per baris (`Math.round`) seperti `cashier.js`: nominal per unit × qty, persen dari subtotal baris. Jangan menghitung ulang dari total transaksi, karena hasilnya bisa selisih Rp 1 dari versi-murni.

## 8. Langkah pertama sesi berikutnya

1. Isi matriks bukti 19 FR × 2 varian di `docs/AUDIT.md` (Tahap 3 sisa). Bahan baku sudah ada di `docs/CONFORMANCE.md` bagian 1–6.
2. Keputusan produk: lanjut ke Supabase atau tetap localStorage. Bila lanjut, skema SQL + RLS + RPC `checkout`/`void_transaction`/`adjust_stock` dibuat terpisah, lalu isi `src/lib/api.js` diganti tanpa menyentuh komponen. Rujukan: SRS Bab 6 dan 8.7.
3. Lengkapi dua hal administratif: tautan berkas Figma (masukkan ke README + `docs/design.md`) dan URL deploy statis (`dist/` sudah siap diunggah; HashRouter + `base: './'` tidak butuh aturan rewrite).
4. Opsional: foto produk di versi-lanjutan (paritas dengan versi-murni), foto profil di topbar, dialog konfirmasi sebelum F9 membatalkan transaksi.
