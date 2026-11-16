# Kesesuaian Kode terhadap SRS

Diperbarui: 17 November 2026
Acuan: `docs/SRS Website Sistem Kasir Minimarket Sederhana.md` versi 1.5
Varian yang dinilai: `versi-murni/` (HTML/CSS/JS) dan `versi-lanjutan/` (React 18 + Vite)

Legenda: **Ya** = terpenuhi dan teruji · **Sebagian** = ada tetapi belum lengkap · **Belum** = belum ada.

## 1. Kebutuhan Fungsional (Bab 4 SRS)

| ID | Kebutuhan | versi-murni | versi-lanjutan | Bukti / catatan |
| --- | --- | --- | --- | --- |
| FR-01 | Login dan logout | Ya | Ya | Kunci 5 percobaan/5 menit, akun nonaktif ditolak, sesi 30 menit |
| FR-02 | Kelola barang dan kategori | Ya | Ya | Kategori CRUD + kode unik + soft delete; peringatan "harga jual di bawah harga beli" (peringatan, bukan blokir) ada di kedua varian. versi-lanjutan belum punya unggah foto produk (versi-murni punya; SRS tidak mewajibkan) |
| FR-03 | Menampilkan stok | Ya | Ya | Halaman Stok, badge Aman/Menipis/Habis |
| FR-04 | Transaksi penjualan | Ya | Ya | Scan barcode, keranjang, qty, qty > stok ditolak |
| FR-05 | Subtotal, total, bayar, kembalian | Ya | Ya | Uji: Rp 6.500, bayar Rp 20.000 → kembalian Rp 13.500 |
| FR-06 | Stok berkurang setelah transaksi | Ya | Ya | Uji: Indomie 120→119; kartu stok tercatat |
| FR-07 | Menyimpan riwayat transaksi | Ya | Ya | `TRX-YYYYMMDD-NNNN`, snapshot harga |
| FR-08 | Laporan per periode | Ya | Ya | Hari ini/7 hari/bulan/rentang, filter kasir & kategori, ekspor CSV, grafik tren harian. Omzet dan laba dialokasikan per item (pola `reports.js`) sehingga filter kategori mengurangi omzet proporsional dan laba memakai omzet setelah diskon. Uji: TRX-0001 omzet Rp 3.975, laba Rp 925; filter Perlengkapan → omzet Rp 475, laba Rp 225 |
| FR-09 | Kelola pengguna (tambah, ubah, nonaktifkan, reset password) | Ya | Ya | Kode staf otomatis, Admin terakhir dilindungi. Nonaktifkan akun sendiri ditolak di lapisan layanan, bukan hanya tombol yang dinonaktifkan |
| FR-10 | Penyesuaian stok + alasan | Ya | Ya | Alasan wajib, kartu stok, compare-and-set `expectedStock` |
| FR-11 | Pengaturan toko dan opsi sistem | Ya | Ya | Nama/alamat/telepon, footer struk, ukuran kertas, PPN, pembulatan, stok minimum, metode bayar, backup |
| FR-12 | Dashboard ringkasan | Ya | Ya | Kartu ringkasan, tren 7 hari, produk terlaris, stok menipis |
| FR-13 | Peringatan stok menipis | Ya | Ya | Ambang `minStock` per produk |
| FR-14 | Diskon item **atau** transaksi; Kasir ≤10%, di atasnya perlu Admin | Ya | Ya | versi-murni: diskon per item + per transaksi + verifikasi username/password Admin. versi-lanjutan (Tahap 2): diskon per item di keranjang (nominal per unit atau persen per baris), dialog yang sama untuk diskon transaksi, persetujuan Admin diverifikasi di `verifyAdminApproval()` (`lib/api.js`) dan nama penyetuju disimpan pada item + log aktivitas. Uji: kasir 20% ditolak sampai username/password Admin benar (lalu `approvedBy: Rina Pratama`); Admin sendiri tidak diminta persetujuan |
| FR-15 | Metode pembayaran tunai/QRIS/debit | Ya | Ya | Diambil dari Pengaturan |
| FR-16 | Cetak struk lewat browser | Ya | Ya | Tombol cetak, CSS cetak khusus struk (58/80 mm) |
| FR-17 | Void transaksi + stok kembali | Ya | Ya | Admin saja; uji: status `dibatalkan`, stok 119→120 |
| FR-18 | Ekspor laporan CSV/PDF | Ya | Ya | CSV lewat Blob (`text/csv`), PDF lewat jsPDF 4 (ringkasan + tabel produk). Uji: berkas PDF 5.559 byte, header `%PDF-1.3`, 1 halaman, memuat "Laporan Penjualan Brahamart", "Ringkasan", dan "Produk terjual" |
| FR-19 | Ganti password dan perbarui profil sendiri | Ya | Ya | versi-murni: tab "Profil Saya" + ganti password. versi-lanjutan (Tahap 2): halaman `/profil` untuk Admin dan Kasir — nama, kontak, foto opsional (JPG/PNG ≤2 MB, diperkecil ke 256 px), ganti password dengan verifikasi password lama. Uji: password lama salah ditolak, password baru bisa dipakai login |

Fitur yang SRS sebut **ditunda** (bukan celah): tahan transaksi, log aktivitas, rekap tutup kasir, cetak thermal langsung, scanner kamera, retur, supplier, multi-cabang.

## 2. Kebutuhan Non-Fungsional (Bab 5 SRS)

| ID | Aspek | versi-murni | versi-lanjutan | Catatan |
| --- | --- | --- | --- | --- |
| NFR-01 | Usability, teks ≥14 px, umpan balik aksi | Ya | Ya | Seluruh `font-size` dipaksa ≥14 px; 0 elemen <13,5 px terukur di 7 halaman; toast sukses/gagal ada |
| NFR-02 | Pencarian <1 dtk, 5.000 produk dengan pagination | Ya | Ya | Komponen `Pagination` 10 baris + "Sebelumnya/Berikutnya" di Produk, Riwayat, Pengguna. Uji 16 Nov dengan 5.009 produk: pencarian 29–37 ms, tambah produk ke keranjang 17 ms, simpan transaksi 86 ms, DOMContentLoaded 34 ms. Pencarian dan pagination sudah diukur pada 5.009 produk di Chrome desktop; belum diuji pada perangkat kelas bawah |
| NFR-03 | RBAC, hash password, proteksi XSS, sesi kedaluwarsa | Sebagian | Sebagian | XSS tertutup (escapeHTML / React escaping), hash SHA-256 tanpa salt, RBAC hanya di klien (didokumentasikan Bab 8.3). Sesi 30 menit kini aktif di **kedua** varian: `App.jsx` + `touchSession()` memperpanjang hanya saat ada aktivitas dan timer 15 detik mengakhiri sesi. Uji: `lastActivityAt` 31 menit lalu → dialihkan ke login, kunci sesi dihapus |
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
| Kotak hint sidebar ("Akses kasir", "Manajemen Produk") | Ada | Ada (`HINTS` per route di `Layout.jsx`) | Sesuai |
| Topbar: tanggal, nama, lencana peran, avatar | Ada | Tanggal, nama, kode staf, avatar, lencana peran | Sesuai |
| Header terminal kasir ("Terminal Kasir 01", shift, Kasir ID, struk hari ini) | Ada | Ada (Tahap 1) | Sesuai |
| Produk cepat (fast moving) di kasir | Ada | Ada (4 produk prioritas, Tahap 1) | Sesuai |
| Struk: catatan PPN, ukuran kertas, barcode | Ada | Ada (PPN, toggle 58/80 mm, barcode) | Sesuai |
| Pagination tabel | Ada, 7–8 baris/halaman (produk, riwayat, pengguna, laporan 5) | Ada, 10 baris/halaman (produk, riwayat, pengguna) | Setara, beda ukuran halaman |
| Diskon item di keranjang | Ada (baris keranjang + dialog) | Ada (baris keranjang + dialog, persetujuan Admin) | Sesuai |
| Profil Saya + ganti password | Tab di halaman Pengguna | Halaman `/profil` (menu samping) | Setara, beda penempatan |
| Timer sesi 30 menit | Interval 30 menit di `auth.js` | Efek di `App.jsx` + `touchSession()` | Sesuai |
| Filter riwayat: kasir + metode | Ada | **Baru ditambahkan** | Sesuai |
| Dialog bawaan | `<dialog>` native | Dialog kustom (portal) | Setara secara perilaku |

## 4. Rencana dan status

### Tahap 1 — konsistensi tampilan — **selesai**

1. Kotak hint sidebar per halaman + topbar lengkap (tanggal, nama, kode staf, avatar) di versi-lanjutan.
2. Header terminal kasir "Terminal Kasir 01" dengan shift otomatis, `Kasir ID`, jumlah struk hari ini.
3. Panel produk cepat (4 produk) di kasir versi-lanjutan.
4. Toggle ukuran struk 58/80 mm + barcode dekoratif di dialog struk.

### Tahap 2 — celah fungsional SRS — **selesai**

5. **FR-14**: diskon per item di keranjang + persetujuan Admin (username/password diverifikasi di lapisan layanan) untuk total diskon >10%. Diskon item tersimpan per baris transaksi (`discount`, `discountType`, `discountValue`, `discountApprovedBy`) dan tampil di struk, detail riwayat, serta laporan.
6. **FR-19**: halaman `/profil` — ubah nama, kontak, foto opsional, dan ganti password sendiri dengan verifikasi password lama.
7. **NFR-02**: pagination 10 baris pada Produk, Riwayat, dan Pengguna (`Pagination` di `components/ui.jsx`), kembali ke halaman 1 saat filter berubah.
8. **NFR-03**: timer idle 30 menit di `App.jsx`; sesi hanya diperpanjang oleh aktivitas nyata (`touchSession()`), tidak lagi saat sesi dibaca.

### Tahap 3 — penguatan dokumen dan uji — **sisa**

9. Uji regresi formal 19 FR di kedua varian dan perbarui matriks bukti di `docs/AUDIT.md`.
10. Tambahkan catatan Tahap 2 (diskon item, profil, pagination, idle) ke SRS Bab 8 sebagai catatan implementasi versi 1.5.
11. Opsional: tampilkan foto profil pada topbar versi-lanjutan (sekarang avatar memakai inisial; foto tampil di halaman Profil dan daftar Pengguna), dan samakan ukuran halaman pagination (7–8 di versi-murni vs 10 di versi-lanjutan).

## 5. Kesimpulan

Dari 19 kebutuhan fungsional: **19 terpenuhi** pada kedua varian. Dari 10 kebutuhan non-fungsional: 8 terpenuhi penuh, 2 sebagian (NFR-03 — keamanan masih di sisi klien, dan NFR-08 pada versi-murni yang statis).

Setelah Tahap 1 dan 2, selisih antarvariansi tinggal detail kecil yang disengaja: ukuran halaman pagination (7–8 vs 10), foto profil hanya di halaman Profil/daftar Pengguna (topbar tetap inisial), dan sumber ikon (SVG inline vs Lucide). Keduanya memakai kunci `localStorage` yang sama dan logika bisnis yang setara.

## 6. Catatan audit 16 November 2026

Audit ulang terhadap SRS (bukan hanya membaca tabel di atas) menemukan lima selisih di `versi-lanjutan`. Semuanya sudah diperbaiki dan diuji ulang pada hari yang sama:

| Temuan | Dampak | Perbaikan | Bukti |
| --- | --- | --- | --- |
| Filter kategori di Laporan tidak pernah cocok (`item.categoryId` tidak pernah ada di transaksi) | Memilih kategori membuat item terjual & laba jadi 0, omzet tetap | `buildReport` menerima daftar produk, mencocokkan kategori dari produk, dan mengalokasikan omzet per item | Filter Perlengkapan → omzet Rp 475, item 1, laba Rp 225 |
| Estimasi laba kotor memakai harga jual tanpa harga beli (`purchasePrice` tidak tersimpan di item) | Laba dilaporkan sama dengan omzet (Rp 4.000 untuk omzet Rp 3.975) | Snapshot `purchasePrice` + `categoryId` saat transaksi; laba = omzet setelah diskon − harga beli | Laba Rp 925 untuk omzet Rp 3.975 |
| Laporan tanpa grafik tren penjualan (SRS Bab 4.7) | Output FR-08 tidak lengkap | Kartu "Tren penjualan" dengan bar harian, total periode, rata-rata harian | 1 bar untuk 1 hari transaksi, muncul tanpa error |
| Tidak ada peringatan "harga jual di bawah harga beli" (SRS Bab 4.3) | Aturan bisnis FR-02 tidak tampil | Peringatan kuning di formulir produk, tetap boleh disimpan | Diuji dengan harga beli 5.000 / jual 3.000 |
| Larangan menonaktifkan akun sendiri hanya di antarmuka | Bisa dilewati lewat pemanggilan layanan | Guard `session.userId` di `saveUser` dan `toggleUser` | Kode + tombol nonaktif untuk akun sendiri |
| Tech stack Bab 2.7: grafik tidak memakai library, PDF tidak memakai jsPDF | Dua baris rencana teknologi tidak terpenuhi | Recharts 3 untuk Dashboard & Laporan (chunk terpisah), jsPDF 4 untuk ekspor PDF | Chart SVG ter-render (`svg.recharts-surface`), berkas PDF nyata `%PDF-1.3` 1 halaman |

Selisih yang **masih** ada dan disengaja: backend Supabase belum dipakai sehingga RBAC dan atomisitas hanya di sisi klien (SRS 8.3), foto produk hanya ada di versi-murni, tautan Figma belum dicantumkan, dan uji kompatibilitas baru dilakukan di Chrome. Status teknologi per baris ada di `docs/SRS …` Bab 8.7.

Hasil uji tambahan: 5.009 produk → pencarian 29–37 ms, simpan transaksi 86 ms, `DOMContentLoaded` 34 ms; font minimum 14 px di seluruh halaman; 0 error JS; void menghapus transaksi dari laporan dan mengembalikan stok (199 → 200).
