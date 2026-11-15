# Kesesuaian Kode terhadap SRS

Diperbarui: 15 November 2026
Acuan: `docs/SRS Website Sistem Kasir Minimarket Sederhana.md` versi 1.4
Varian yang dinilai: `versi-murni/` (HTML/CSS/JS) dan `versi-lanjutan/` (React 18 + Vite)

Legenda: **Ya** = terpenuhi dan teruji · **Sebagian** = ada tetapi belum lengkap · **Belum** = belum ada.

## 1. Kebutuhan Fungsional (Bab 4 SRS)

| ID | Kebutuhan | versi-murni | versi-lanjutan | Bukti / catatan |
| --- | --- | --- | --- | --- |
| FR-01 | Login dan logout | Ya | Ya | Kunci 5 percobaan/5 menit, akun nonaktif ditolak, sesi 30 menit |
| FR-02 | Kelola barang dan kategori | Ya | Ya | Kategori CRUD + kode unik + soft delete. versi-lanjutan belum punya unggah foto produk (versi-murni punya; SRS tidak mewajibkan) |
| FR-03 | Menampilkan stok | Ya | Ya | Halaman Stok, badge Aman/Menipis/Habis |
| FR-04 | Transaksi penjualan | Ya | Ya | Scan barcode, keranjang, qty, qty > stok ditolak |
| FR-05 | Subtotal, total, bayar, kembalian | Ya | Ya | Uji: Rp 6.500, bayar Rp 20.000 → kembalian Rp 13.500 |
| FR-06 | Stok berkurang setelah transaksi | Ya | Ya | Uji: Indomie 120→119; kartu stok tercatat |
| FR-07 | Menyimpan riwayat transaksi | Ya | Ya | `TRX-YYYYMMDD-NNNN`, snapshot harga |
| FR-08 | Laporan per periode | Ya | Ya | Hari ini/7 hari/bulan/rentang, filter kasir & kategori, ekspor CSV |
| FR-09 | Kelola pengguna | Ya | Ya | Tambah/ubah/nonaktifkan/reset password, kode staf otomatis, Admin terakhir dilindungi |
| FR-10 | Penyesuaian stok + alasan | Ya | Ya | Alasan wajib, kartu stok, compare-and-set `expectedStock` |
| FR-11 | Pengaturan toko dan opsi sistem | Ya | Ya | Nama/alamat/telepon, footer struk, ukuran kertas, PPN, pembulatan, stok minimum, metode bayar, backup |
| FR-12 | Dashboard ringkasan | Ya | Ya | Kartu ringkasan, tren 7 hari, produk terlaris, stok menipis |
| FR-13 | Peringatan stok menipis | Ya | Ya | Ambang `minStock` per produk |
| FR-14 | Diskon item **atau** transaksi; Kasir ≤10%, di atasnya perlu Admin | Ya | **Sebagian** | versi-murni: diskon per item + per transaksi + verifikasi username/password Admin. versi-lanjutan: hanya diskon transaksi, tanpa verifikasi Admin (baru berupa catatan teks) |
| FR-15 | Metode pembayaran tunai/QRIS/debit | Ya | Ya | Diambil dari Pengaturan |
| FR-16 | Cetak struk lewat browser | Ya | Ya | Tombol cetak, CSS cetak khusus struk (58/80 mm) |
| FR-17 | Void transaksi + stok kembali | Ya | Ya | Admin saja; uji: status `dibatalkan`, stok 119→120 |
| FR-18 | Ekspor laporan CSV/PDF | Ya | Ya | CSV berkas nyata; PDF lewat dialog cetak (bukan jsPDF seperti SRS) |
| FR-19 | Ganti password dan perbarui profil sendiri | Ya | **Belum** | versi-murni punya tab "Profil Saya" + ganti password. versi-lanjutan hanya punya reset password oleh Admin |

Fitur yang SRS sebut **ditunda** (bukan celah): tahan transaksi, log aktivitas, rekap tutup kasir, cetak thermal langsung, scanner kamera, retur, supplier, multi-cabang.

## 2. Kebutuhan Non-Fungsional (Bab 5 SRS)

| ID | Aspek | versi-murni | versi-lanjutan | Catatan |
| --- | --- | --- | --- | --- |
| NFR-01 | Usability, teks ≥14 px, umpan balik aksi | Ya | Ya | Seluruh `font-size` dipaksa ≥14 px; 0 elemen <13,5 px terukur di 7 halaman; toast sukses/gagal ada |
| NFR-02 | Pencarian <1 dtk, 5.000 produk dengan pagination | Sebagian | **Sebagian** | Pencarian cepat pada data kecil; versi-murni punya pagination tabel, versi-lanjutan belum (semua baris dirender) |
| NFR-03 | RBAC, hash password, proteksi XSS, sesi kedaluwarsa | Sebagian | Sebagian | XSS tertutup (escapeHTML / React escaping), hash SHA-256 tanpa salt, RBAC hanya di klien (didokumentasikan Bab 8.3). **versi-lanjutan belum punya timer idle 30 menit** — hanya memperpanjang `expiresAt` saat dibaca |
| NFR-04 | Integritas data, transaksi atomik | Ya | Ya | Rollback manual saat penyimpanan gagal, snapshot harga |
| NFR-05 | Reliability, backup data | Ya | Ya | Backup JSON + CSV produk di Pengaturan |
| NFR-06 | Maintainability, modul + README | Ya | Ya | Lapisan layanan terpisah (`product-store.js` / `src/lib/api.js`), komentar, README per varian |
| NFR-07 | Kompatibilitas peramban | Ya | Ya | Chrome diuji; React butuh peramban ber-ES module |
| NFR-08 | Portability, `npm run dev`, kunci di `.env` | Sebagian | Ya | versi-murni statis (server lokal); tidak ada kunci rahasia karena tanpa backend |
| NFR-09 | Bahasa Indonesia, Rupiah, WIB | Ya | Ya | Format `id-ID`; zona waktu mengikuti perangkat, WIB eksplisit belum dipaksa |
| NFR-10 | Scalability | Ya | Ya | Titik ganti backend terpusat di satu berkas layanan |

## 3. Konsistensi Antarvariansi (desain)

| Butir | versi-murni | versi-lanjutan | Status |
| --- | --- | --- | --- |
| Logo Brahamart | `Brahamart_keranjang-removebg-preview.png` di 9 halaman + login | **Baru diperbaiki**: PNG yang sama di `public/brand/`, kotak putih di sidebar dan panel login | Sesuai |
| Nama merek | "Brahamart" konsisten | "Brahamart" | Sesuai |
| Token warna | `#4F46E5`, `#312E81`, `#F59E0B`, `#22C55E`, `#EF4444`, `#3B82F6` | idem via `tailwind.config.js` | Sesuai |
| Tipografi | Poppins (judul) + Inter (isi), ≥14 px | idem, `small` dipaksa 14 px | Sesuai |
| Ikon | SVG inline | Lucide (outline) | Setara, beda sumber |
| Kotak hint sidebar ("Akses kasir", "Manajemen Produk") | Ada | Belum ada | **Belum konsisten** |
| Topbar: tanggal, nama, lencana peran, avatar | Ada | Hanya judul + lencana peran | **Belum konsisten** |
| Header terminal kasir ("Terminal Kasir 01", shift, Kasir ID, struk hari ini) | Ada | Belum ada | **Belum konsisten** |
| Produk cepat (fast moving) di kasir | Ada | Belum ada | **Belum konsisten** |
| Struk: catatan PPN, ukuran kertas, barcode | Ada | Catatan PPN + ukuran kertas **baru ditambahkan**; barcode belum | Sebagian |
| Pagination tabel | Ada (produk, pengguna) | Belum ada | **Belum konsisten** |
| Filter riwayat: kasir + metode | Ada | **Baru ditambahkan** | Sesuai |
| Dialog bawaan | `<dialog>` native | Dialog kustom (portal) | Setara secara perilaku |

## 4. Rencana Selanjutnya

Urut dari yang paling terasa oleh pengguna dan paling ringan dikerjakan.

### Tahap 1 — konsistensi tampilan (≈3 jam)

1. Kotak hint sidebar per halaman + topbar lengkap (tanggal, nama, avatar) di versi-lanjutan.
2. Header terminal kasir: "Terminal Kasir 01", shift otomatis dari jam, `Kasir ID`, jumlah struk hari ini.
3. Panel produk cepat (4 produk terlaris/fast moving) di kasir versi-lanjutan.
4. Toggle ukuran struk 58/80 mm di dialog struk (sekarang hanya mengikuti Pengaturan).

### Tahap 2 — celah fungsional SRS (≈7 jam)

5. **FR-14**: diskon per item di keranjang + verifikasi Admin untuk diskon >10% (port dari `cashier.js`).
6. **FR-19**: halaman/tab "Profil Saya" — ubah nama, kontak, foto, dan ganti password sendiri.
7. **NFR-02**: pagination 10 baris + pencarian di sisi data untuk Produk, Riwayat, Pengguna.
8. **NFR-03/4.2**: timer idle 30 menit aktif di versi-lanjutan (reset pada aktivitas, redirect ke login).

### Tahap 3 — penguatan dokumen dan uji (≈2 jam)

9. Tambah `docs/CONFORMANCE.md` (dokumen ini) ke rujukan SRS Bab 8.6 dan README.
10. Uji regresi kedua varian untuk 19 FR (tabel bukti diperbarui di `docs/AUDIT.md`).
11. Catat status FR-14/FR-19/NFR-02 sebagai "belum" sampai Tahap 2 selesai, agar dokumen tidak menjanjikan lebih dari kode.

## 5. Kesimpulan

Dari 19 kebutuhan fungsional: **17 terpenuhi penuh, 1 sebagian (FR-14), 1 belum (FR-19)** pada versi-lanjutan; **19 terpenuhi** pada versi-murni. Dari 10 kebutuhan non-fungsional: 7 terpenuhi, 3 sebagian (NFR-02, NFR-03, NFR-08 pada varian murni).

Selisih terbesar bukan pada fitur inti, melainkan pada **detail tampilan dan dua fitur pelengkap** yang sudah ada di versi-murni. Rencana Tahap 1 dan 2 di atas menutup keduanya tanpa mengubah arsitektur.
