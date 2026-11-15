# Audit Kode & Kesesuaian SRS — Brahamart POS

Tanggal audit: 15 November 2026
Objek audit: `versi-murni/` (kode yang ada sebelum restrukturisasi) + `docs/SRS Website Sistem Kasir Minimarket Sederhana.md` (versi 1.2)
Metode: pembacaan kode, `node --check` pada 13 berkas JS, validasi struktur HTML dengan parser, uji fungsional di Chrome (lewat CDP) pada 9 halaman, dan pencocokan perilaku dengan SRS.

## 1. Putusan Umum

Kode **sudah rapi untuk ukuran proyek tanpa build tool**. Strukturnya konsisten, tidak ada kesalahan sintaks, tidak ada HTML cacat, dan pemisahan tanggung jawabnya jelas:

| Lapisan | Berkas | Peran |
| --- | --- | --- |
| Akses penyimpanan | `assets/js/storage.js`, `product-store.js`, `settings-store.js` | satu pintu ke `localStorage`, termasuk rollback transaksi dan penyesuaian stok |
| Autentikasi & sesi | `assets/js/auth.js` | login, kunci percobaan, idle timeout 30 menit, `requireAuth(roles)` |
| Halaman | satu berkas JS per halaman (13 total) | render + event, dibungkus IIFE dan `'use strict'` |
| Gaya | sembilan berkas CSS per modul | tidak ada CSS framework, token warna lewat variabel |

Ukuran kode: 6.293 baris JS, 2.169 baris CSS, 1.345 baris HTML (10 halaman).

Yang benar-benar baik dan jarang ditemui pada proyek sekelas ini:

- Semua JS memakai IIFE + `'use strict'`, tanpa variabel global yang bocor (kecuali objek yang memang diekspos: `DB`, `Auth`, `ProductStore`, `SettingsStore`).
- `escapeHTML()` dipakai konsisten sebelum `innerHTML` (mis. `cashier.js`, `products.js`, `users.js`), jadi jalur XSS utama tertutup.
- `ProductStore.commitSale()` mengambil snapshot `localStorage` sebelum menulis produk, stok, dan transaksi, lalu memulihkannya bila salah satu penulisan gagal (`product-store.js:92-147`). Ini pengganti transaksi database yang jujur.
- Stok opname memakai pola *compare-and-set* (`expectedStock`), sehingga penyesuaian dari tab lain tidak menimpa data basi (`product-store.js:266`).
- Validasi tidak hanya di form: rentang harga/stok, tipe bilangan bulat, dan panjang teks diperiksa lagi di lapisan store.
- Semua halaman yang dirender JS memberi fokus ke `<main>` setelah navigasi, dan dialog memakai `<dialog>` native.

## 2. Temuan yang Sudah Diperbaiki

| # | Temuan | Lokasi sebelum perbaikan | Perbaikan | Verifikasi |
| --- | --- | --- | --- | --- |
| 1 | Produk stok 0 hilang dari pencarian kasir sehingga muncul "Produk tidak ditemukan" | `cashier.js:11` (`.filter(p => p.isActive && p.stock > 0)`) | Filter stok dihapus; baris hasil pencarian menampilkan label merah "Stok habis", diurutkan setelah produk tersedia, dan klik/pindai memunculkan pesan "<nama> sedang habis." | Cari "gula" → baris muncul dengan label "Stok habis"; pindai `89933441` → toast "Gula Pasir Gulaku 1kg sedang habis." |
| 2 | ID Kasir tampil angka `2`, bukan format desain `KSR-0881` | `cashier.js:665` (`session.userId`) | Ditambah atribut `staffCode` pada data pengguna (`storage.js`), seed `KSR-0881`/`ADM-0101`, migrasi otomatis untuk data lama, pembuatan kode berurutan untuk pengguna baru, dan tampilan kode di tabel Pengguna | Halaman Kasir menampilkan `KSR-0881` (kasir) dan `ADM-0101` (admin); pengguna baru mendapat `KSR-0882` dan bisa login |
| 3 | Kotak akun demo masih ada di halaman login | `login.html:83-88` | Dihapus, diganti satu kalimat arahan menghubungi Admin; aturan CSS `.demo-hint` → `.login__note`; kredensial dipindah ke README | `document.querySelector('.demo-hint')` → tidak ada |
| 4 | Shortcut keyboard berjalan tetapi SRS menyebutnya ditunda | `cashier.js:804-879` vs SRS 1.2 (1.2 & 7.7) | SRS diperbarui: Bab 8.4 mendaftar seluruh pintasan, dan dua tempat yang menyebut "ditunda" diberi rujukan | Uji F1/F4/F9/Enter berfungsi |
| 5 | Nama field kode berbahasa Inggris, SRS berbahasa Indonesia | seluruh berkas JS | SRS Bab 8.2 memuat tabel pemetaan lengkap per entitas (users, products, transactions, dst.) | Tabel diturunkan dari bentuk objek nyata di `localStorage` |
| 6 | Password SHA-256 tanpa salt, pembatasan peran hanya di browser | `storage.js:46-52`, `auth.js:176-203` | Tidak diubah (memang batas versi ini); SRS Bab 8.3 mendokumentasikan batasan, dampak, dan rencana perbaikannya | — |
| 7 | **Bug:** listener `storage` terjebak di dalam `forEach` tombol shortcut, sehingga terdaftar N kali (atau nol kali bila tidak ada tombol) | `cashier.js:811-825` | Ditutup di luar `forEach`, ditambah penanganan perubahan `KEYS.products` agar daftar produk cepat ikut menyegarkan | Tidak ada error; listener tunggal |
| 8 | Label kartu "Stok Habis" menulis "Tidak dapat discan kasir" — tidak lagi benar setelah perbaikan #1 | `products.js:99` | Diganti "Tidak dapat ditambahkan ke keranjang" | Teks kartu berubah |
| 9 | Nama merek tidak konsisten: "Brahmart" di halaman login vs "Brahamart" di seluruh halaman dan SRS | `login.html:25` | Diseragamkan menjadi "Brahamart" | — |

## 3. Temuan Terbuka (belum diubah)

Diurutkan berdasarkan dampak.

| # | Temuan | Bukti | Dampak | Saran |
| --- | --- | --- | --- | --- |
| A | **Ukuran teks jauh di bawah standar desain sendiri.** 371 dari 461 deklarasi `font-size` bernilai 10–13 px (terbanyak 11 px dan 12 px) | `grep -c "font-size"` per berkas CSS; `design.md` §3 menetapkan "Body 14 px (never smaller)"; NFR-01 menetapkan minimal 14 px | NFR-01 tidak terpenuhi; teks kecil menyulitkan kasir di layar 1024 px | Naikkan skala: body 14 px, label 13 px, angka tabel 14 px; sesuaikan padding tabel dan lebar sidebar |
| B | Item dengan stok habis tetap bisa diklik (sengaja, agar muncul pesan), tetapi `role="option"` + `aria-disabled="true"` pada elemen yang masih menerima klik adalah kombinasi yang membingungkan pembaca layar | `cashier.js` `renderSearchResults()` | Aksesibilitas | Ganti menjadi `role="option"` tanpa `aria-disabled`, atau tampilkan sebagai grup terpisah "Stok habis" |
| C | `commitSale()` menolak transaksi bila `salePrice` produk berubah sejak item masuk keranjang (`code: 'changed'`), sehingga kasir harus mengulang transaksi | `product-store.js:85-87` | Alur kasir terhenti tanpa penjelasan rinci | Tampilkan nama produk + harga lama/baru pada pesan, atau perbarui harga otomatis dengan notifikasi |
| D | Pencarian kasir memuat seluruh produk aktif ke memori tanpa pagination | `cashier.js:9-23` | NFR-02 menargetkan 5.000 produk; pada jumlah itu render hasil pencarian akan lambat | Batasi 20 hasil teratas, atau pindahkan pencarian ke indeks |
| E | 26 berkas memakai CRLF, 6 berkas memakai LF | pemindaian byte | Diff Git berisik | Tambahkan `.gitattributes` dengan `* text=auto eol=lf` |
| F | Belum ada pengujian otomatis, linter, atau formatter | — | Regresi hanya tertangkap manual | Tambahkan `package.json` dengan `eslint` + `prettier` (opsional, tidak wajib untuk tugas) |
| G | Ekspor PDF laporan memakai `window.print()` pada dokumen terpisah, bukan jsPDF; hasilnya bergantung dialog cetak browser | `reports.js` | Cocok untuk cetak, kurang cocok untuk lampiran digital | Tidak masalah untuk lingkup tugas; catat di README |
| H | Tidak ada `createdAt` pada produk seed dan tidak ada `lastLoginAt` sampai login pertama | data seed | Kolom "Login terakhir" menampilkan "Belum tercatat" | Boleh dibiarkan; sudah sesuai mockup |

## 4. Hasil Uji Fungsional (Chrome, viewport 1440×900)

| Halaman | Yang diuji | Hasil |
| --- | --- | --- |
| Login | login valid (admin & kasir), pesan error, kotak demo hilang | Lulus |
| Kasir | cari nama, pindai barcode, produk habis, qty +/−, diskon, bayar kurang, bayar pas, struk, stok berkurang, riwayat stok | Lulus (total Rp 11.000, bayar Rp 20.000 → kembalian Rp 9.000; stok Aqua 8 → 6) |
| Dashboard | kartu ringkasan, grafik 7 hari, stok menipis | Lulus |
| Produk | daftar, pencarian, tambah produk, kode duplikat ditolak, simpan | Lulus |
| Stok | daftar, alasan wajib, tinjau, simpan (+5), kartu stok | Lulus (119 → 124, mutasi tercatat) |
| Riwayat | daftar, detail lewat URL `?id=`, void alasan wajib, stok kembali | Lulus (status `dibatalkan`, Aqua 6 → 8) |
| Laporan | filter periode, ringkasan, transaksi void tidak dihitung, ekspor CSV | Lulus (blob `text/csv` 682 byte) |
| Pengguna | daftar, kode staf, tambah pengguna, login akun baru | Lulus |
| Pengaturan | muat nilai, simpan, persistensi | Lulus |
| Otorisasi | Kasir membuka `laporan.html` dan `pengaturan.html` | Dialihkan ke `kasir.html` |
| Galat JS | `window.onerror` + `unhandledrejection` di semua halaman | Tidak ada |

## 5. Kesimpulan

Tidak ada temuan yang membuat sistem gagal berjalan. Enam temuan yang dilaporkan semuanya terkonfirmasi dan sudah diperbaiki, ditambah tiga temuan lain (satu di antaranya bug listener yang nyata) dan satu ketidaksesuaian dokumentasi. Temuan terbuka yang paling perlu keputusan adalah **A (ukuran teks)**, karena menyangkut kepatuhan pada design system dan NFR-01, bukan sekadar kerapian kode.
