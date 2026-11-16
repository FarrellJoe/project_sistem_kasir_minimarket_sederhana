# Brahamart — Sistem Kasir Minimarket Sederhana

Proyek mata kuliah Web Based Programming (Sistem Informasi, SATU University). Repositori ini memuat **dua implementasi** dari kebutuhan yang sama, dokumen SRS, dan hasil audit kode.

| Folder | Isi |
| --- | --- |
| `versi-murni/` | HTML, CSS, dan JavaScript murni tanpa build tool. Data di `localStorage`. |
| `versi-lanjutan/` | React 18 + Vite + Tailwind CSS (komponen bergaya shadcn/ui), React Router, Zustand, TanStack Query, React Hook Form + Zod, Lucide Icons. |
| `docs/` | SRS (versi 1.4), design system, laporan audit, dan mockup Figma. |

## Menjalankan

### versi-murni (tanpa instalasi)

```bash
cd versi-murni
python -m http.server 8000     # atau ekstensi Live Server di VS Code
# buka http://localhost:8000/login.html
```

Halaman harus dibuka lewat server (`http://`), bukan `file://`, karena login memakai `crypto.subtle` yang diblokir sebagian peramban pada protokol file.

### versi-lanjutan (React)

```bash
cd versi-lanjutan
npm install
npm run dev       # http://localhost:5173
npm run build     # hasil statis di dist/
```

## Akun contoh

Dibuat otomatis saat halaman login pertama kali dibuka.

| Peran | Username | Password | Kode staf |
| --- | --- | --- | --- |
| Admin | `admin` | `admin123` | `ADM-0101` |
| Kasir | `kasir` | `kasir123` | `KSR-0881` |

Kredensial ini hanya untuk demo dan tidak ditampilkan pada halaman login. Ganti sebelum dipakai nyata.

## Fitur yang tersedia di kedua varian

- Login/logout dengan dua peran, kunci 5 percobaan gagal, sesi berakhir setelah 30 menit idle.
- Kasir: pencarian/scan barcode, keranjang, qty, diskon item & transaksi (di atas 10% perlu persetujuan Admin), pembayaran tunai/QRIS/debit, kembalian, struk cetak, pengurangan stok otomatis.
- Produk: CRUD barang dan kategori, pencarian, filter kategori/status stok, nonaktifkan (soft delete), pagination 10 baris.
- Stok: daftar ketersediaan, penyesuaian dengan alasan wajib, kartu stok.
- Riwayat: daftar transaksi (pagination), detail, cetak ulang, void oleh Admin dengan pengembalian stok.
- Laporan: filter periode/kasir/kategori, ringkasan, produk terjual, ekspor CSV (dan cetak PDF).
- Pengguna: tambah/ubah/nonaktifkan akun, reset password, perlindungan Admin terakhir, kode staf otomatis.
- Profil Saya: ubah nama/kontak/foto dan ganti password sendiri.
- Pengaturan: identitas toko, PPN, pembulatan, metode pembayaran, cadangan JSON/CSV.
- Shortcut kasir: `F1` cari, `F4` diskon, `F9` batal, `Enter` proses bayar.

## Dokumen

- `docs/SRS Website Sistem Kasir Minimarket Sederhana.md` — SRS v1.4. Bab 8 memuat catatan implementasi: perbedaan rencana vs kode, pemetaan nama field Indonesia ↔ Inggris, batasan keamanan, dan keterangan dua varian.
- `docs/AUDIT.md` — audit kode: kekuatan, temuan yang diperbaiki, temuan terbuka, dan matriks pengujian.
- `docs/CONFORMANCE.md` — matriks kesesuaian FR-01…FR-19 dan NFR-01…NFR-10 per varian, plus daftar butir tampilan yang belum konsisten dan rencana penutupannya.
- `docs/design.md` — design system (warna, tipografi, komponen).
- `docs/mockup/` — gambar mockup per layar.

## Catatan desain

Seluruh teks isi minimal 14 px sesuai `docs/design.md` §3 dan NFR-01. Warna mengikuti token: indigo `#4F46E5`, sidebar `#312E81`, amber `#F59E0B`, hijau `#22C55E`, merah `#EF4444`, biru `#3B82F6`.

## Batasan yang diketahui

Data disimpan di `localStorage` peramban: tidak tersinkron antar perangkat dan hilang bila data situs dibersihkan. Password di-hash SHA-256 tanpa salt, dan pembatasan peran hanya ditegakkan di sisi klien. Rincian dan rencana perbaikan ada di SRS Bab 8.3.

## Deployment

- `versi-murni/` — unggah folder apa adanya ke Netlify/Vercel/GitHub Pages sebagai situs statis.
- `versi-lanjutan/` — `npm run build`, lalu unggah `dist/`. Routing memakai `HashRouter` sehingga tidak memerlukan aturan rewrite.
