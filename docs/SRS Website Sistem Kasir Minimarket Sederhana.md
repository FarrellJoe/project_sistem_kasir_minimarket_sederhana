# Software Requirements Specification (SRS)

## Website Sistem Kasir Minimarket Sederhana

Versi 1.6 | 17 November 2026 | Status: Draft untuk review

| Informasi | Keterangan |
| --- | --- |
| Judul | Software Requirements Specification: Website Sistem Kasir Minimarket Sederhana |
| Mata kuliah | Web Based Programming |
| Disusun oleh | Jonathan Farrell Abraham |
| NIM | 2910013263 |
| Program studi | Sistem Informasi |
| Dosen pengampu | **HAERUL, S.Kom., M.Kom.** |
| Institusi | SATU University |
| Tahun | 2026 |

**Riwayat revisi**

| Versi | Tanggal | Perubahan |
| --- | --- | --- |
| 1.0 | 9 Oktober 2026 | Draft awal berdasarkan project brief |
| 1.1 | 9 Oktober 2026 | Penyesuaian lingkup ke sisi frontend dan pemilihan teknologi |
| 1.2 | 9 Oktober 2026 | Penambahan use case diagram, class diagram, ERD, dan rencana pengerjaan |
| 1.3 | 15 November 2026 | Penambahan Bab 8: catatan implementasi, pemetaan nama field, dan batasan keamanan versi 1 |
| 1.4 | 15 November 2026 | Penyesuaian skala tipografi ke minimum 14 px dan penambahan keterangan dua varian repositori (Bab 8.6) |
| 1.5 | 17 November 2026 | Penyelesaian Tahap 2 (diskon item, profil, pagination, timer idle), audit kesesuaian 16 November, dan status teknologi versi-lanjutan terhadap Bab 2.7 (Bab 8.7) |
| 1.6 | 17 November 2026 | Penegasan bahwa Bab 2 sampai Bab 6 adalah rencana: penyimpanan Supabase pada 1.2, 2.1, 2.4, dan 6.3 dinyatakan sebagai rancangan dan dirujuk ke Bab 8; ekspor PDF untuk evaluasi |

## 1. PENDAHULUAN

### 1.1 Tujuan

Dokumen ini mendefinisikan kebutuhan perangkat lunak untuk **Website Sistem Kasir Minimarket Sederhana** (Point of Sale / POS). Dokumen berisi kebutuhan fungsional dan non-fungsional yang menjadi acuan bagi analis, perancang, pengembang, dan penguji dalam membangun sistem yang membantu kasir mencatat transaksi penjualan, serta membantu admin/pemilik mengelola produk, stok, pengguna, dan laporan penjualan.

Proyek ini difokuskan pada sisi frontend. Hasil yang dikumpulkan berupa dokumen SRS dalam format PDF, link desain Figma (wireframe dan mockup), serta source code website dalam HTML, CSS, dan JavaScript. Seluruh alat, library, database, dan layanan hosting yang digunakan bersifat gratis.

### 1.2 Lingkup Produk

Sistem adalah aplikasi berbasis web untuk satu minimarket (satu cabang) yang dibangun dengan HTML, CSS, dan JavaScript pada sisi frontend. **Rencana penyimpanan data** memakai database cloud gratis (Supabase/PostgreSQL) agar data tersimpan permanen dan dapat diakses dari beberapa perangkat tanpa membangun server backend sendiri. Rencana itu belum dijalankan pada versi 1 yang dikumpulkan: data masih disimpan di `localStorage` peramban sehingga terikat pada satu perangkat. Selisih rencana terhadap implementasi dijelaskan pada Bab 8.1, 8.3, dan 8.7.

**Yang termasuk dalam lingkup (in scope):**

- Autentikasi (login/logout) dengan dua peran: Admin dan Kasir.
- Manajemen data barang dan kategori (CRUD).
- Transaksi kasir: pencarian/scan kode barang, keranjang, qty, subtotal, diskon sederhana (opsional), total, pembayaran, kembalian.
- Pengurangan stok otomatis setelah transaksi dan pembaruan stok manual oleh Admin.
- Riwayat transaksi berdasarkan nomor transaksi dan tanggal.
- Laporan penjualan harian/periode dan produk terjual.
- Manajemen pengguna dan pengaturan toko.
- Fitur pendukung: dashboard ringkasan, peringatan stok menipis, pencatatan metode pembayaran (tunai dan non-tunai), cetak struk melalui browser, ekspor laporan (CSV/PDF), dan pembatalan transaksi (void) oleh Admin.

**Yang tidak termasuk (out of scope):** akuntansi/pembukuan lengkap, integrasi payment gateway, retur penjualan, manajemen supplier dan pembelian barang, promo berjenjang, multi-cabang, cetak langsung ke printer thermal, serta tahan transaksi (hold), log aktivitas, rekap tutup kasir, dan shortcut keyboard (tahan transaksi, log aktivitas, rekap tutup kasir, dan cetak thermal masuk pengembangan lanjutan; shortcut keyboard sudah tersedia pada versi 1, lihat Bab 8.4).

### 1.3 Definisi, Akronim, dan Singkatan

| Istilah | Penjelasan |
| --- | --- |
| SRS/SKPL | Software Requirements Specification / Spesifikasi Kebutuhan Perangkat Lunak |
| POS | Point of Sale, sistem titik penjualan |
| SKU/Kode Barang | Kode unik produk, dapat berasal dari barcode |
| Barcode Scanner | Alat pembaca barcode; pada versi ini bekerja sebagai input keyboard biasa |
| CRUD | Create, Read, Update, Delete |
| RBAC | Role-Based Access Control, pembatasan akses berdasarkan peran |
| REST API | Antarmuka komunikasi antara frontend dan backend berbasis HTTP |
| JWT | JSON Web Token, token autentikasi sesi pengguna |
| SPA | Single Page Application |
| Void | Pembatalan transaksi yang sudah tersimpan |
| Stok Minimum | Batas stok yang memicu peringatan stok menipis |

### 1.4 Tinjauan Umum Dokumen

Bagian 1 berisi penjelasan umum proyek. Bagian 2 menjelaskan deskripsi umum sistem, karakteristik pengguna, lingkungan operasi, dan analisis pemilihan teknologi. Bagian 3 menjelaskan kebutuhan antarmuka eksternal. Bagian 4 merinci kebutuhan fungsional. Bagian 5 merinci kebutuhan non-fungsional. Bagian 6 berisi model data (entitas, relasi, diagram ERD, dan penyimpanan data). Bagian 7 berisi lampiran: matriks hak akses, use case beserta deskripsinya, class diagram, rencana pengujian, kriteria keberhasilan, pengembangan lanjutan, rencana pengerjaan, dan ketentuan bisnis.

Satu kaidah berlaku untuk seluruh dokumen: **Bab 2 sampai Bab 6 memuat rencana dan acuan kebutuhan, bukan laporan hasil pekerjaan.** Realisasi yang benar-benar dijalankan pada versi 1, beserta selisih dan batasannya, dicatat pada Bab 8. Bila keduanya berbeda, Bab 8 yang berlaku untuk versi 1, sedangkan Bab 2 sampai Bab 6 tetap berlaku sebagai arah pengembangan berikutnya.

### 1.5 Referensi

- Project Brief Sistem Kasir Minimarket Sederhana.
- Gambar brief/mockup "Sistem Kasir Minimarket Sederhana" (menu: Kasir, Produk, Stok, Laporan, Pengguna, Pengaturan).
- IEEE Std 830-1998 / ISO/IEC/IEEE 29148 (acuan struktur SRS).

## 2. DESKRIPSI UMUM

### 2.1 Perspektif Produk

Sistem merupakan produk mandiri berbasis web yang digunakan di dalam toko. Kasir dan admin mengakses sistem melalui browser pada komputer, laptop, atau tablet. Frontend dirancang sebagai Single Page Application yang terhubung langsung ke Supabase (database PostgreSQL, autentikasi, dan fungsi database) melalui API, sehingga tidak diperlukan server backend sendiri. Pada versi 1 sambungan itu belum ada: data disediakan lapisan layanan (folder `services`) dari `localStorage` dan aplikasi berjalan tanpa jaringan (Bab 8.7). Hasil build berupa file HTML, CSS, dan JavaScript statis yang di-hosting secara gratis.

### 2.2 Fungsi Produk

1. **Autentikasi & Otorisasi:** login/logout dan pembatasan fitur berdasarkan peran.
2. **Transaksi Kasir:** proses penjualan cepat via scan barcode atau pencarian produk.
3. **Manajemen Produk & Kategori:** kelola data barang, harga, dan satuan.
4. **Manajemen Stok:** stok berkurang otomatis, penyesuaian stok manual, peringatan stok menipis.
5. **Riwayat Transaksi:** pencarian dan detail transaksi.
6. **Laporan Penjualan:** rekap harian/bulanan/periode, produk terlaris, ekspor.
7. **Manajemen Pengguna & Pengaturan:** kelola akun kasir/admin dan identitas toko.

### 2.3 Karakteristik Pengguna

| Aktor | Deskripsi | Hak Akses Utama |
| --- | --- | --- |
| Admin / Pemilik | Pengelola minimarket, familiar dengan data stok dan laporan | Kelola barang, kategori, stok, pengguna, pengaturan; lihat seluruh transaksi dan laporan; void transaksi |
| Kasir | Operator di meja kasir, memerlukan antarmuka cepat dan sederhana | Login, melakukan transaksi, melihat data barang, melihat riwayat transaksi miliknya |

### 2.4 Lingkungan Operasi

- **Perangkat keras klien:** PC/laptop atau tablet (minimal layar 1024 px), opsional barcode scanner USB (mode keyboard) dan printer struk.
- **Perangkat lunak klien:** browser modern (Chrome, Firefox, Edge, Safari) dengan JavaScript aktif.
- **Server:** tanpa server sendiri; frontend statis di-hosting gratis (Vercel/Netlify/Cloudflare Pages). Database di Supabase (paket gratis) masih berupa rencana pengembangan dan belum dipakai pada versi 1 (Bab 8.7).
- **Jaringan:** pada rancangan, koneksi internet diperlukan untuk memuat dan menyimpan data ke Supabase; pada versi 1 aplikasi berjalan tanpa jaringan karena data berada di peramban (Bab 8.7).

### 2.5 Batasan Desain dan Implementasi

- Satu minimarket/cabang pada versi awal.
- Tidak ada integrasi payment gateway; pembayaran non-tunai hanya dicatat sebagai metode pembayaran.
- Barcode scanner dianggap sebagai input kode barang biasa.
- Kode terstruktur per modul (auth, produk, transaksi, laporan, pengguna) dengan satu lapisan layanan data (services) yang memisahkan antarmuka dari database.
- Skala sederhana, cocok untuk proyek pembelajaran, namun arsitektur disiapkan agar dapat dikembangkan. Framework, library, database, dan backend bebas dipilih (hasil akhir tetap HTML, CSS, JavaScript) dengan syarat seluruhnya gratis selama pengembangan, termasuk paket gratis layanan cloud dan hosting. Batas paket gratis harus dipantau.

### 2.6 Asumsi dan Ketergantungan

- Kasir memiliki satu akun pribadi dan tidak berbagi akun.
- Satu transaksi hanya memiliki satu kasir dan satu metode pembayaran (versi awal).
- Harga jual sudah termasuk PPN; tarif (default 11%) dapat diatur atau dinonaktifkan di Pengaturan, dan struk menampilkan informasi PPN yang sudah termasuk.
- Koneksi internet tersedia selama kasir bekerja (mode offline belum didukung). Penggunaan sistem tidak melebihi batas paket gratis layanan cloud.

### 2.7 Pemilihan Teknologi

Hasil akhir proyek harus berupa HTML, CSS, dan JavaScript, sedangkan framework, library, database, dan backend boleh dipilih bebas selama gratis. Dengan mempertimbangkan keranjang kasir yang sering berubah, halaman bergaya dashboard, serta kebutuhan data transaksi dan stok yang konsisten, teknologi yang digunakan adalah sebagai berikut.

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Frontend | React 18 + Vite (JavaScript atau TypeScript) | Komponen reusable; hasil build berupa HTML, CSS, JavaScript statis |
| Styling | Tailwind CSS + shadcn/ui (alternatif: Bootstrap 5) | Cepat membuat sidebar, kartu, tabel, dan modal sesuai mockup |
| Routing | React Router | Navigasi Kasir, Produk, Stok, Laporan, dan seterusnya |
| State keranjang | Zustand | Ringan dan cepat untuk keranjang belanja |
| Data server | supabase-js + TanStack Query | Cache dan status loading rapi |
| Form dan validasi | React Hook Form + Zod | Validasi input konsisten |
| Grafik | Recharts (alternatif: Chart.js) | Grafik penjualan dashboard dan laporan |
| Database dan backend | Supabase: PostgreSQL, Auth, Row Level Security, fungsi database (RPC) | Gratis, relasional, tanpa server sendiri |
| Ekspor | Blob (CSV), jsPDF (PDF), window.print (struk) | Tanpa server |
| Desain | Figma (akun Free) | Syarat output tugas |
| Versi dan hosting | Git, GitHub, Vercel / Netlify / Cloudflare Pages | Gratis, HTTPS otomatis |
| Editor | VS Code | Gratis |

React dan Vite dipilih karena komponen yang dapat dipakai ulang cocok untuk antarmuka kasir dan hasil build-nya berupa file HTML, CSS, dan JavaScript statis. Alternatif yang dipertimbangkan adalah Vue 3, yang lebih mudah dipelajari, dan JavaScript murni, yang tidak memerlukan build tool tetapi membuat pengelolaan keranjang dan tabel menjadi lebih rumit.

Untuk sisi data dipilih Supabase sebagai backend-as-a-service. Pendekatan tanpa backend (data di Local Storage) paling cepat dikerjakan, tetapi data hilang jika cache browser dibersihkan, tidak dapat dibagi antar perangkat, dan pembatasan peran dapat dimanipulasi dari browser sehingga tidak memenuhi kriteria Security dan Data Integrity pada brief. Backend buatan sendiri (misalnya Node.js dengan PostgreSQL) memberi kontrol penuh, tetapi pekerjaannya jauh lebih banyak dan hosting backend gratis biasanya terbatas. Supabase menyediakan database relasional, autentikasi, Row Level Security, dan fungsi database sehingga penyimpanan transaksi dan pengurangan stok dapat berjalan atomik tanpa server sendiri.

Kekurangannya adalah kurva belajar SQL dan Row Level Security, ketergantungan pada layanan pihak ketiga, serta batas paket gratis. Proyek yang lama tidak aktif dapat dijeda, sehingga perlu diaktifkan kembali dari dashboard sebelum digunakan.

## 3. KEBUTUHAN ANTARMUKA EKSTERNAL

### 3.1 Antarmuka Pengguna

Antarmuka dirancang dengan gaya **modern, bersih, dan sederhana** mengikuti gambar brief: sidebar navigasi di sisi kiri berwarna biru tua/indigo, area konten berwarna terang, serta kartu dan tabel yang rapi.

- **Tipografi:** Heading menggunakan Poppins; isi teks menggunakan Inter/Open Sans. Ukuran font isi minimal 14 px; nominal di layar kasir dibuat besar (minimal 24 px).
- **Skema warna** (nilai dapat disesuaikan dengan desain akhir):

| Peran Warna | Warna | Penggunaan |
| --- | --- | --- |
| Primary | Indigo (#4F46E5) | Sidebar, tombol utama, judul |
| Accent | Kuning/Oranye (#F59E0B) | Highlight, ikon produk, label penting |
| Success | Hijau (#22C55E) | Transaksi sukses, stok aman |
| Danger | Merah (#EF4444) | Tombol Batal, stok habis, error |
| Info | Biru (#3B82F6) | Tombol Proses Pembayaran, tautan |
| Background | Putih keabuan (#F8FAFC) | Latar halaman |
| Text | Slate gelap (#1E293B) | Teks utama |

- **Navigasi (sidebar):** Kasir, Produk, Stok, Laporan, Pengguna, Pengaturan. Selain itu terdapat menu Dashboard dan Riwayat Transaksi. Menu ditampilkan sesuai peran (Kasir hanya melihat Kasir, Produk (lihat), dan Riwayat).
- **Layar utama:**
  1. Halaman Login.
  2. Dashboard (ringkasan penjualan hari ini, jumlah transaksi, stok menipis, produk terlaris).
  3. Transaksi Kasir: kolom "Scan barcode atau cari produk", tabel keranjang (No, Produk, Harga, Qty, Subtotal), total, tombol **Batal** dan **Proses Pembayaran**, dialog pembayaran.
  4. Produk & Kategori: tabel dengan pencarian, filter, tambah/ubah/hapus.
  5. Stok: daftar stok, penyesuaian stok, riwayat perubahan stok.
  6. Riwayat Transaksi dan Detail Transaksi.
  7. Laporan: filter periode, ringkasan, tabel produk terjual, tombol ekspor.
  8. Pengguna dan Pengaturan.
- **Responsif:** optimal untuk desktop dan tablet; tetap dapat digunakan pada layar kecil untuk menu admin.

### 3.2 Antarmuka Perangkat Keras

- **Barcode scanner:** terhubung USB/Bluetooth sebagai perangkat keyboard (keyboard wedge); mengirim kode lalu tombol Enter.
- **Printer struk:** versi awal memakai fitur cetak browser (window.print) dengan format struk lebar 58/80 mm. Integrasi printer thermal langsung termasuk pengembangan lanjutan.

### 3.3 Antarmuka Perangkat Lunak

- **Sistem operasi:** independen (berjalan di browser).
- **API internal:** library supabase-js untuk berkomunikasi dengan Supabase (REST dan Auth).
- **Database:** PostgreSQL melalui Supabase.
- **Library ekspor:** CSV dan PDF (misalnya jsPDF/pdfmake) untuk laporan.

### 3.4 Antarmuka Komunikasi

Komunikasi ke Supabase menggunakan HTTPS; hosting gratis (Vercel/Netlify/Cloudflare Pages) menyediakan HTTPS otomatis. Token sesi dikelola oleh Supabase Auth.

## 4. FITUR SISTEM (FUNCTIONAL REQUIREMENTS)

Kebutuhan fungsional dikelompokkan berdasarkan prioritas: Tinggi (wajib dikerjakan) dan Sedang (dikerjakan sesuai sisa waktu).

### 4.1 Ringkasan Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-01 | Sistem menyediakan login dan logout | Tinggi |
| FR-02 | Admin dapat mengelola data barang dan kategori | Tinggi |
| FR-03 | Sistem dapat menampilkan stok barang | Tinggi |
| FR-04 | Kasir dapat membuat transaksi penjualan | Tinggi |
| FR-05 | Sistem menghitung subtotal, total, pembayaran, dan kembalian | Tinggi |
| FR-06 | Sistem mengurangi stok setelah transaksi berhasil | Tinggi |
| FR-07 | Sistem menyimpan riwayat transaksi | Tinggi |
| FR-08 | Sistem menyediakan laporan penjualan berdasarkan periode | Sedang |
| FR-09 | Admin dapat mengelola pengguna (tambah, ubah, nonaktifkan, reset password) | Tinggi |
| FR-10 | Admin dapat memperbarui stok manual beserta alasan | Tinggi |
| FR-11 | Admin dapat mengatur identitas toko dan opsi sistem | Sedang |
| FR-12 | Sistem menampilkan dashboard ringkasan penjualan dan stok | Sedang |
| FR-13 | Sistem menampilkan peringatan stok menipis berdasarkan stok minimum | Sedang |
| FR-14 | Kasir dapat memberikan diskon sederhana pada item atau total transaksi | Sedang |
| FR-15 | Kasir dapat memilih metode pembayaran: tunai, QRIS, atau debit/transfer (dicatat manual) | Sedang |
| FR-16 | Sistem dapat mencetak struk melalui browser | Sedang |
| FR-17 | Admin dapat membatalkan (void) transaksi dan stok dikembalikan | Sedang |
| FR-18 | Admin dapat mengekspor laporan ke CSV/PDF | Sedang |
| FR-19 | Pengguna dapat mengganti password dan memperbarui profil | Sedang |

### 4.2 Fitur 1: Autentikasi (FR-01, FR-19)

**Deskripsi:** pengguna masuk dan keluar dari sistem; akses dibatasi berdasarkan peran.

- **Aktor:** Admin, Kasir.
- **Input:** username/email dan password.
- **Proses:** validasi kelengkapan input; verifikasi kredensial melalui Supabase Auth (password di-hash oleh layanan); penyimpanan sesi; pengalihan sesuai peran (Kasir ke halaman Kasir, Admin ke Dashboard).
- **Output:** akses masuk, atau pesan "Username atau password salah".
- **Aturan bisnis:** akun nonaktif tidak dapat login; setelah 5 kali gagal berturut-turut akun dikunci sementara 5 menit; sesi berakhir otomatis setelah tidak aktif 30 menit; logout menghapus sesi. Pembatasan peran ditegakkan di database melalui Row Level Security, bukan hanya di antarmuka.

### 4.3 Fitur 2: Manajemen Barang dan Kategori (FR-02, FR-03)

**Deskripsi:** Admin mengelola data barang dan kategori.

- **Aktor:** Admin (Kasir hanya melihat).
- **Input barang:** kode barang (unik), nama, kategori, harga beli, harga jual, stok awal, stok minimum, satuan (pcs, pack, dus), status aktif.
- **Proses:** validasi wajib isi; kode barang harus unik; harga dan stok tidak boleh negatif; harga jual disarankan tidak lebih rendah dari harga beli (peringatan, bukan blokir).
- **Output:** daftar barang dengan pencarian, filter kategori, pagination, dan penanda stok (Aman / Menipis / Habis).
- **Aturan bisnis:** barang yang sudah pernah ditransaksikan tidak dihapus permanen, melainkan dinonaktifkan (soft delete) agar riwayat tetap utuh; kategori yang masih dipakai barang tidak dapat dihapus.

### 4.4 Fitur 3: Transaksi Kasir (FR-04, FR-05, FR-14, FR-15, FR-16)

**Deskripsi:** inti sistem, yaitu proses penjualan dari awal hingga selesai.

- **Aktor:** Kasir (Admin juga dapat).
- **Skenario utama:**
  1. Kasir membuka halaman Kasir.
  2. Kasir memindai/mengetik kode barang atau mencari nama barang; tekan Enter.
  3. Sistem menampilkan barang pada keranjang (nama, harga, qty 1, subtotal). Memindai barang yang sama menambah qty.
  4. Kasir dapat mengubah qty atau menghapus item.
  5. Sistem menghitung total secara otomatis.
  6. Kasir menekan **Proses Pembayaran**, memilih metode, dan memasukkan nominal bayar.
  7. Sistem menghitung kembalian dan memvalidasi pembayaran.
  8. Kasir menyimpan transaksi; sistem membuat nomor transaksi, mengurangi stok, menyimpan riwayat, dan menampilkan struk.
- **Rumus:** Subtotal item = harga × qty − diskon item; Total = Σ subtotal − diskon transaksi (PPN sudah termasuk dalam harga); Kembalian = Bayar − Total.
- **Aturan bisnis:**
  - Qty harus berupa bilangan bulat positif.
  - Qty tidak boleh melebihi stok tersedia; sistem menampilkan pesan stok tidak cukup.
  - Barang nonaktif atau tidak ditemukan tidak dapat ditambahkan ("Barang tidak ditemukan").
  - Pembayaran tunai wajib ≥ total; non-tunai otomatis sama dengan total.
  - Harga yang tersimpan pada detail transaksi adalah harga saat transaksi (snapshot) sehingga perubahan harga berikutnya tidak mengubah riwayat.
  - Diskon tidak boleh melebihi subtotal; diskon yang diberikan Kasir maksimal 10% dari subtotal; di atas itu memerlukan persetujuan Admin (login Admin atau PIN).
  - Format nomor transaksi: `TRX-YYYYMMDD-NNNN` (reset urutan tiap hari).
  - Penyimpanan transaksi, detail transaksi, dan pengurangan stok dilakukan sebagai satu kesatuan operasi (satu fungsi database/RPC dalam satu database transaction) agar atomik.
- **Output:** transaksi tersimpan, struk (nomor transaksi, tanggal, kasir, daftar item, total, bayar, kembalian), keranjang dikosongkan untuk pelanggan berikutnya.

### 4.5 Fitur 4: Manajemen Stok (FR-03, FR-06, FR-10, FR-13)

- **Aktor:** Admin; Kasir hanya melihat stok.
- **Fungsi:** melihat stok seluruh barang; penyesuaian stok (tambah/kurang/koreksi) dengan alasan wajib (barang masuk, rusak, kedaluwarsa, hasil stock opname); riwayat perubahan stok (kartu stok) berisi waktu, jenis, jumlah, stok sebelum/sesudah, dan pelaku.
- **Aturan bisnis:** stok tidak boleh negatif; setiap perubahan stok (otomatis maupun manual) wajib tercatat pada riwayat stok; barang dengan stok ≤ stok minimum tampil pada daftar peringatan dan dashboard.

### 4.6 Fitur 5: Riwayat Transaksi (FR-07, FR-17)

- **Aktor:** Admin (semua transaksi), Kasir (transaksi miliknya).
- **Fungsi:** daftar transaksi dengan pencarian nomor transaksi dan filter tanggal/kasir/metode pembayaran; detail transaksi (item, harga, qty, subtotal, total, bayar, kembalian); cetak ulang struk.
- **Void (Admin):** membatalkan transaksi dengan alasan wajib; status berubah menjadi "Dibatalkan", stok dikembalikan, transaksi tidak dihitung pada laporan; data asli tidak dihapus.

### 4.7 Fitur 6: Laporan Penjualan (FR-08, FR-18)

- **Aktor:** Admin.
- **Input:** periode (hari ini, 7 hari, bulan ini, rentang tanggal), filter kasir/kategori (opsional).
- **Output:** total penjualan, jumlah transaksi, rata-rata nilai transaksi, total item terjual, estimasi laba kotor (harga jual − harga beli), tabel produk terjual dan terlaris, rekap per metode pembayaran, grafik tren penjualan.
- **Ekspor:** CSV dan PDF.
- **Aturan bisnis:** hanya transaksi berstatus selesai yang dihitung.

### 4.8 Fitur 7: Manajemen Pengguna (FR-09)

- **Aktor:** Admin.
- **Fungsi:** tambah, ubah, nonaktifkan/aktifkan akun; atur peran (Admin/Kasir); reset password.
- **Aturan bisnis:** username unik; password minimal 8 karakter dan disimpan ter-hash; Admin tidak dapat menonaktifkan akunnya sendiri; sistem harus selalu memiliki minimal satu Admin aktif; pengguna yang memiliki transaksi tidak dihapus permanen.

### 4.9 Fitur 8: Pengaturan (FR-11)

- **Aktor:** Admin.
- **Fungsi:** nama toko, alamat, nomor telepon, teks footer struk, ukuran kertas struk, tarif PPN yang sudah termasuk dalam harga (default 11%), pembulatan total ke Rp100 (opsional), stok minimum default, daftar metode pembayaran aktif, dan ekspor backup data (JSON/CSV).

### 4.10 Fitur 9: Dashboard dan Peringatan (FR-12, FR-13)

- **Aktor:** Admin.
- **Output:** kartu ringkasan (penjualan hari ini, jumlah transaksi, item terjual, laba kotor), grafik penjualan 7 hari, 5 produk terlaris, daftar stok menipis/habis.

## 5. KEBUTUHAN NON-FUNGSIONAL

| ID | Aspek | Kriteria |
| --- | --- | --- |
| NFR-01 | Usability | Antarmuka sederhana; kasir baru dapat menyelesaikan transaksi pertama setelah pelatihan maksimal 15 menit; teks isi min. 14 px; setiap aksi memberi umpan balik (notifikasi sukses/gagal, loading indikator) |
| NFR-02 | Performance | Pencarian barang < 1 detik; penambahan item ke keranjang < 0,5 detik; penyimpanan transaksi < 2 detik pada kondisi normal (hingga 5.000 produk dengan pagination dan pencarian di sisi database); halaman dimuat < 3 detik di jaringan lokal |
| NFR-03 | Security | RBAC ditegakkan di database (Row Level Security) dan di antarmuka (menu/halaman sesuai peran); password di-hash oleh Supabase Auth; proteksi XSS (sanitasi input/output, tanpa innerHTML mentah); sesi kedaluwarsa; HTTPS; pembatasan percobaan login; kunci rahasia (service role) tidak disimpan di frontend |
| NFR-04 | Data Integrity | Total transaksi dan perubahan stok konsisten (satu fungsi database atomik); constraint unik dan kunci asing di database; snapshot harga pada detail transaksi; data transaksi tidak dihapus fisik |
| NFR-05 | Reliability | Ekspor data (JSON/CSV) tersedia di menu Pengaturan sebagai backup; pesan error yang jelas dan sistem tidak crash pada input tidak valid |
| NFR-06 | Maintainability | Kode terstruktur per modul (auth, produk, transaksi, laporan, pengguna); konvensi penamaan konsisten; komentar kode dan README; penggunaan Git |
| NFR-07 | Compatibility | Berjalan pada dua versi terbaru Chrome, Firefox, Edge, dan Safari; resolusi minimal 1024×600 |
| NFR-08 | Portability | Dijalankan lokal dengan npm run dev dan di-deploy gratis ke Vercel/Netlify/Cloudflare Pages; kunci layanan dipisah di file environment (.env) |
| NFR-09 | Localization | Bahasa antarmuka Indonesia; mata uang Rupiah (Rp 15.500); zona waktu WIB |
| NFR-10 | Scalability | Struktur data dan API siap dikembangkan untuk multi-cabang, supplier, dan retur |

## 6. MODEL DATA

### 6.1 Entitas dan Atribut

| Entitas | Atribut |
| --- | --- |
| users | id (PK), nama, username/email (unik), password (dikelola Supabase Auth), role (admin/kasir), is\_active, last\_login, created\_at, updated\_at |
| categories | id (PK), nama\_kategori (unik), created\_at |
| products | id (PK), kode (unik), nama, category\_id (FK), harga\_beli, harga\_jual, stok, stok\_minimum, satuan, is\_active, created\_at, updated\_at |
| transactions | id (PK), nomor\_transaksi (unik), tanggal, user\_id (FK kasir), subtotal, diskon, pajak, total, metode\_pembayaran, pembayaran, kembalian, status (selesai/dibatalkan), alasan\_void, created\_at |
| transaction\_items | id (PK), transaction\_id (FK), product\_id (FK), nama\_produk (snapshot), harga (snapshot), qty, diskon, subtotal |
| stock\_movements | id (PK), product\_id (FK), tipe (penjualan/masuk/koreksi/void), jumlah, stok\_sebelum, stok\_sesudah, alasan, user\_id (FK), created\_at |
| settings | key, value |

### 6.2 Relasi

- Satu kategori memiliki banyak produk.
- Satu pengguna (kasir) memiliki banyak transaksi.
- Satu transaksi memiliki banyak detail transaksi; satu produk dapat muncul pada banyak detail transaksi.
- Satu produk memiliki banyak pergerakan stok.

**Diagram ERD**

&#91;embedded content: ERD · 6 tabel\]

Tabel settings (key-value) berdiri sendiri sehingga tidak digambarkan pada diagram.

### 6.3 Penyimpanan Data

Rancangan penyimpanan data memakai Supabase (PostgreSQL). Semua halaman mengakses data melalui satu lapisan layanan (folder `services`), tidak langsung dari komponen antarmuka, sehingga pemindahan backend cukup mengganti isi lapisan itu.

Tabel berikut adalah **rancangan skema, bukan keadaan yang sudah berjalan**. Pada versi 1, data masih disimpan di `localStorage` peramban dengan kunci berawalan `kasir_`; tabel dan fungsi di bawah belum dibuat. Pemetaan antara rancangan dan kode yang ada dicatat pada Bab 8.1 dan 8.2, batasannya pada Bab 8.3, dan status teknologinya pada Bab 8.7.

| Entitas | Tabel (rancangan) | Catatan |
| --- | --- | --- |
| users | profiles | Terhubung ke auth.users; berisi nama, role, is\_active |
| categories | categories | Nama kategori unik |
| products | products | Kode unik; soft delete lewat is\_active |
| transactions | transactions | Nomor transaksi unik; status selesai/dibatalkan |
| transaction\_items | transaction\_items | Menyimpan snapshot nama dan harga |
| stock\_movements | stock\_movements | Mencatat setiap perubahan stok |
| settings | settings | Pasangan key-value |
| Fungsi database | checkout, void\_transaction, adjust\_stock | Atomik: transaksi, detail, stok, dan riwayat stok dalam satu proses |

Pada rancangan, Row Level Security membatasi akses per peran: Kasir hanya dapat membaca produk dan transaksinya sendiri, Admin dapat mengakses semuanya. Skema SQL, kebijakan keamanan, fungsi database, dan data awal (seed: 1 akun Admin, 1 akun Kasir, 5 kategori, 30 produk contoh) direncanakan sebagai skrip SQL di repositori (struktur folder pada Bab 7.8); berkas tersebut belum ada pada versi 1, dan pembatasan peran baru ditegakkan di antarmuka (Bab 8.3).

## 7. LAMPIRAN

### 7.1 Matriks Hak Akses

| Fitur | Admin | Kasir |
| --- | --- | --- |
| Login/logout, ganti password | Ya | Ya |
| Dashboard | Ya | Tidak |
| Transaksi kasir | Ya | Ya |
| Lihat data barang dan stok | Ya | Ya |
| Tambah/ubah/nonaktifkan barang dan kategori | Ya | Tidak |
| Penyesuaian stok | Ya | Tidak |
| Riwayat transaksi | Semua | Milik sendiri |
| Void transaksi | Ya | Tidak |
| Laporan dan ekspor | Ya | Tidak |
| Manajemen pengguna | Ya | Tidak |
| Pengaturan sistem | Ya | Tidak |

### 7.2 Use Case

&#91;embedded content: use case diagram · 2 aktor, 14 use case\]

Admin mewarisi seluruh use case Kasir; perbedaannya, Kasir hanya melihat riwayat transaksinya sendiri, sedangkan Admin melihat semua transaksi.

### 7.3 Use Case Description

**A. Use Case: Login**

| Elemen | Deskripsi |
| --- | --- |
| Aktor | Admin, Kasir |
| Precondition | Akun terdaftar dan aktif; halaman login terbuka |
| Flow | 1. Aktor mengisi username dan password. 2. Aktor menekan Login. 3. Sistem memvalidasi input dan kredensial. 4. Sistem membuat sesi dan mengarahkan sesuai peran |
| Exception | Input kosong; kredensial salah; akun nonaktif atau terkunci |
| Postcondition | Aktor masuk dan hanya melihat menu sesuai perannya |

**B. Use Case: Melakukan Transaksi**

| Elemen | Deskripsi |
| --- | --- |
| Aktor | Kasir |
| Precondition | Kasir sudah login; data barang dan stok tersedia |
| Flow | 1. Kasir membuka halaman Kasir. 2. Kasir memindai/mencari barang. 3. Sistem menampilkan barang di keranjang dan menghitung subtotal/total. 4. Kasir mengubah qty atau menghapus item bila perlu. 5. Kasir menekan Proses Pembayaran dan memilih metode. 6. Kasir memasukkan nominal bayar. 7. Sistem menghitung kembalian. 8. Kasir menyimpan transaksi. 9. Sistem mengurangi stok, menyimpan transaksi, dan menampilkan struk |
| Exception | Barang tidak ditemukan; stok tidak cukup; pembayaran kurang dari total; keranjang kosong; kegagalan penyimpanan (rollback, stok tidak berubah) |
| Postcondition | Transaksi tersimpan, stok berkurang, riwayat stok tercatat |

**C. Use Case: Kelola Barang**

| Elemen | Deskripsi |
| --- | --- |
| Aktor | Admin |
| Precondition | Admin sudah login |
| Flow | 1. Admin membuka menu Produk. 2. Admin memilih tambah atau ubah barang. 3. Admin mengisi form. 4. Sistem memvalidasi (kode unik, harga/stok valid). 5. Sistem menyimpan data dan menampilkan notifikasi sukses |
| Exception | Kode barang duplikat; data wajib kosong; nilai negatif; barang pernah ditransaksikan (hanya dapat dinonaktifkan) |
| Postcondition | Data barang diperbarui |

**D. Use Case: Melihat Laporan Penjualan**

| Elemen | Deskripsi |
| --- | --- |
| Aktor | Admin |
| Precondition | Admin sudah login; terdapat data transaksi |
| Flow | 1. Admin membuka menu Laporan. 2. Admin memilih periode. 3. Sistem mengambil data transaksi selesai pada periode. 4. Sistem menampilkan ringkasan, tabel produk terjual, dan grafik. 5. Admin dapat mengekspor CSV/PDF |
| Exception | Tidak ada data pada periode (tampilkan "Tidak ada transaksi"); rentang tanggal tidak valid |
| Postcondition | Laporan tampil/terunduh |

**E. Use Case: Void Transaksi**

| Elemen | Deskripsi |
| --- | --- |
| Aktor | Admin |
| Precondition | Transaksi berstatus selesai |
| Flow | 1. Admin membuka detail transaksi. 2. Admin menekan Void dan mengisi alasan. 3. Sistem meminta konfirmasi. 4. Sistem mengubah status, mengembalikan stok, dan mencatat pergerakan stok |
| Exception | Alasan kosong; transaksi sudah dibatalkan |
| Postcondition | Transaksi tidak dihitung pada laporan; stok kembali |

### 7.4 Domain Class Diagram (Ringkas)

&#91;embedded content: class diagram · 8 class\]

Garis putus-putus menandakan ketergantungan (Cart menjadi item transaksi saat checkout, Report membaca Transaction); garis lurus menandakan relasi dengan multiplicity.

### 7.5 Rencana Pengujian (Ringkas)

| ID | Skenario | Hasil yang Diharapkan | FR |
| --- | --- | --- | --- |
| TC-01 | Login kredensial valid dan tidak valid | Valid masuk sesuai peran; tidak valid ditolak dengan pesan | FR-01 |
| TC-02 | Kasir mengakses halaman Produk (ubah) / Laporan | Akses ditolak | FR-01 |
| TC-03 | Admin tambah barang kode duplikat | Ditolak dengan pesan | FR-02 |
| TC-04 | Tambah barang ke keranjang lewat kode | Item muncul, subtotal benar | FR-04 |
| TC-05 | Total 15.500, bayar 20.000 | Kembalian 4.500 | FR-05 |
| TC-06 | Bayar kurang dari total | Ditolak dengan pesan | FR-05 |
| TC-07 | Qty melebihi stok | Ditolak dengan pesan stok tidak cukup | FR-04 |
| TC-08 | Simpan transaksi 3 item | Stok masing-masing berkurang sesuai qty | FR-06 |
| TC-09 | Cari transaksi berdasarkan nomor dan tanggal | Transaksi tampil dengan detail benar | FR-07 |
| TC-10 | Laporan periode tertentu | Total sesuai jumlah transaksi selesai | FR-08 |
| TC-11 | Void transaksi | Stok kembali, tidak dihitung pada laporan | FR-17 |
| TC-12 | Kegagalan saat simpan transaksi | Rollback, stok tidak berubah | NFR-04 |

### 7.6 Kriteria Keberhasilan

- Kasir dapat login dan membuat transaksi tanpa error.
- Total dan kembalian dihitung dengan benar.
- Stok berkurang sesuai jumlah barang terjual.
- Transaksi tersimpan dan dapat dilihat kembali.
- Admin dapat mengelola produk dan melihat laporan.
- Seluruh kebutuhan fungsional berprioritas Tinggi lulus pengujian.

### 7.7 Pengembangan Lanjutan

Fitur yang direncanakan pada pengembangan lanjutan: tahan transaksi (hold), log aktivitas, rekap tutup kasir, cetak struk thermal langsung, scanner barcode berbasis kamera, manajemen supplier dan pembelian barang, retur penjualan, promo dan diskon bertingkat, member dan poin pelanggan, mode offline (PWA), integrasi pembayaran digital (QRIS dinamis), multi-cabang dengan sinkronisasi cloud, notifikasi barang kedaluwarsa, dan grafik analitik lanjutan. Shortcut keyboard yang semula direncanakan ditunda sudah diimplementasikan pada versi 1 (Bab 8.4), sehingga tidak lagi termasuk daftar ini.

### 7.8 Output Tugas dan Rencana Pengembangan

| Output | Isi | Alat |
| --- | --- | --- |
| Dokumen SRS (PDF) | Dokumen ini, diekspor ke PDF | Menu ekspor dokumen |
| Desain Figma | Wireframe low-fidelity lalu mockup high-fidelity untuk 11 layar: Login, Dashboard, Kasir, Dialog Pembayaran, Struk, Produk, Stok, Riwayat, Laporan, Pengguna, Pengaturan; frame desktop 1440 px dan tablet 1024 px; style warna/tipografi dan komponen (tombol, input, tabel, modal, kartu) | Figma Free |
| Source code | Folder proyek (HTML, CSS, JavaScript/framework), hasil build berupa HTML, CSS, JavaScript statis, skema SQL, dan README berisi cara menjalankan | VS Code, Git, GitHub Pages |

Struktur folder source code:

```
kasir-minimarket/
  index.html
  package.json
  .env.example          (URL dan anon key Supabase)
  supabase/
    schema.sql
    policies.sql        (Row Level Security)
    functions.sql       (checkout, void, adjust_stock)
    seed.sql
  src/
    main.jsx
    pages/              (Login, Dashboard, Kasir, Produk, Stok,
                         Riwayat, Laporan, Pengguna, Pengaturan)
    components/         (Sidebar, Cart, PaymentDialog, Receipt, DataTable)
    services/           (supabaseClient, auth, products,
                         transactions, reports)
    store/cart.js
    utils/format.js     (format Rupiah, tanggal)
    styles/
  dist/                 (hasil build: HTML, CSS, JavaScript statis)
  README.md
```

Rencana pengerjaan:

| Tahap | Jadwal 2026 | Isi | Kebutuhan |
| --- | --- | --- | --- |
| 0. Desain | 9 s.d. 18 Okt | Wireframe dan mockup Figma untuk semua layar; belajar dasar React | Semua layar |
| 1. Fondasi | 19 s.d. 25 Okt | Setup proyek, skema Supabase, Row Level Security, seed, login | FR-01 |
| 2. Inti | 26 Okt s.d. 15 Nov | Barang dan kategori, kasir dengan fungsi checkout, stok otomatis, riwayat, pengguna, penyesuaian stok | FR-02 s.d. FR-07, FR-09, FR-10 |
| 3. Pelengkap | 16 s.d. 22 Nov | Laporan, diskon, metode pembayaran, struk, stok minimum, dashboard dasar, pengaturan; void, ekspor, dan ganti password hanya jika waktu cukup | FR-08, FR-11 s.d. FR-19 |
| 4. Finalisasi | 23 s.d. 29 Nov | Pengujian TC-01 s.d. TC-12, perbaikan, deploy gratis, README, ekspor SRS ke PDF, rapikan link Figma | Semua |
| Cadangan | 30 Nov | Buffer untuk keterlambatan |  |
| Pengumpulan | 1 Des (Selasa) | SRS (PDF), link Figma, source code |  |

Tenggat pengumpulan adalah 1 Desember 2026. Tahap 0, 1, 2, dan 4 merupakan jalur wajib karena mencakup seluruh kebutuhan berprioritas Tinggi, sedangkan Tahap 3 dikerjakan sesuai sisa waktu. Layar Kasir dikerjakan lebih dulu sebelum layar lainnya. Jika Tahap 2 terlambat lebih dari tiga hari, isi Tahap 3 dikurangi.

### 7.9 Ketentuan Bisnis

Ketentuan berikut menjadi dasar perancangan sistem.

| Hal | Ketentuan | Dasar |
| --- | --- | --- |
| Diskon | Diskon per item dan per transaksi (persen atau nominal); Kasir maksimal 10%, lebih dari itu perlu persetujuan Admin; promo berjenjang di luar lingkup | Diskon di minimarket umumnya promo harga atau potongan manual terbatas |
| Pajak | Harga sudah termasuk PPN (default 11%, dapat diatur); tidak ada pajak tambahan di atas harga | Harga rak ritel di Indonesia umumnya sudah termasuk PPN; sesuaikan dengan aturan yang berlaku |
| Pembulatan | Opsional ke Rp100 terdekat, default nonaktif | Praktik umum saat uang receh terbatas |
| Satuan dan qty | Qty bilangan bulat (pcs, pack, dus); tanpa timbangan | Mayoritas barang minimarket berkemasan |
| Metode pembayaran | Tunai, QRIS (konfirmasi manual oleh kasir), debit/transfer | Tanpa integrasi payment gateway |

## 8. CATATAN IMPLEMENTASI

Bab ini mencatat selisih antara rencana pada Bab 2 sampai Bab 6 dan kode yang benar-benar dijalankan sebagai **versi 1** (folder `versi-murni/`). Tujuannya agar dokumen dan kode dapat dibaca berpasangan: Bab 2 sampai Bab 6 tetap menjadi acuan kebutuhan dan arah pengembangan lanjutan (folder `versi-lanjutan/`), sedangkan bab ini menjelaskan bagaimana kebutuhan tersebut dipenuhi pada versi 1 yang dibangun tanpa backend.

### 8.1 Ringkasan Perbedaan dengan Rencana Awal

| Aspek | Rencana (Bab 2–6) | Implementasi versi 1 |
| --- | --- | --- |
| Teknologi antarmuka | React 18 + Vite + Tailwind/shadcn | HTML, CSS, dan JavaScript murni tanpa build tool; setiap halaman HTML memuat berkas di `assets/css` dan `assets/js` |
| Penyimpanan data | Supabase (PostgreSQL) | `localStorage` browser dengan kunci berawalan `kasir_`, diakses melalui `storage.js`, `product-store.js`, dan `settings-store.js` |
| Autentikasi | Supabase Auth (JWT) | Objek `Auth` pada `auth.js` dengan hash SHA-256 melalui Web Crypto API |
| Otorisasi | Row Level Security di database | `Auth.requireAuth([...])` dipanggil di awal setiap halaman |
| Atomisitas transaksi | Fungsi database/RPC `checkout`, `void_transaction`, `adjust_stock` | Metode `ProductStore.commitSale()`, `voidTransaction()`, dan `adjustStock()` dengan pencatatan nilai lama dan pemulihan (rollback) manual bila penyimpanan gagal |
| Nomor transaksi | `TRX-YYYYMMDD-NNNN` | Sama, urutan dihitung dari transaksi hari berjalan |
| Identitas kasir | Angka `user_id` | Kode staf berformat `KSR-0881` / `ADM-0101` sesuai desain Figma, disimpan pada atribut `staffCode` |
| Struktur folder | Berbasis `src/` React | `versi-murni/` berisi halaman HTML, `assets/css`, `assets/js`, dan `assets/img` |

Konsekuensi yang perlu diketahui pembaca: seluruh batasan keamanan dan integritas data pada NFR-03 dan NFR-04 baru terpenuhi sebagian (lihat 8.3), dan istilah "database" pada bab sebelumnya berarti `localStorage` pada versi 1.

### 8.2 Pemetaan Nama Field

Kode menggunakan penamaan bahasa Inggris dengan gaya `camelCase`, sedangkan SRS memakai istilah Indonesia. Tabel berikut adalah padanan resminya; tidak ada perbedaan perilaku, hanya perbedaan penamaan.

| Entitas | Nama di SRS | Nama di kode | Catatan |
| --- | --- | --- | --- |
| users | id | `id` | bilangan bulat |
| users | nama | `nama` | tetap bahasa Indonesia |
| users | username / email | `username`, `email` | keduanya dapat dipakai untuk login |
| users | password (dikelola Auth) | `passwordHash` | hash SHA-256 heksadesimal, bukan password asli |
| users | role | `role` | nilai `admin` atau `kasir` |
| users | is_active | `isActive` | boolean |
| users | last_login | `lastLoginAt` | ISO 8601 |
| users | — (baru) | `staffCode` | kode tampilan `KSR-0881`, `ADM-0101` |
| users | — (baru) | `photo` | foto profil sebagai data URL, opsional |
| categories | id, nama_kategori, created_at | `id`, `name`, `createdAt` | |
| products | kode | `code` | unik |
| products | — (baru) | `barcode` | digit barcode untuk pemindaian |
| products | nama | `name` | |
| products | category_id | `categoryId` | kunci asing ke `categories.id` |
| products | harga_beli | `purchasePrice` | untuk estimasi laba kotor |
| products | harga_jual | `salePrice` | |
| products | stok | `stock` | bilangan bulat, tidak boleh negatif |
| products | stok_minimum | `minStock` | ambang peringatan stok menipis |
| products | satuan | `unit` | `pcs`, `pack`, `dus`, `pouch` |
| products | is_active | `isActive` | soft delete |
| products | created_at, updated_at | `updatedAt` | `createdAt` tidak dipakai pada data seed |
| transactions | nomor_transaksi | `id` | format `TRX-YYYYMMDD-NNNN` |
| transactions | tanggal | `createdAt` | ISO 8601 |
| transactions | user_id | `cashierId`, `cashierName` | nama kasir disalin sebagai snapshot |
| transactions | subtotal | `subtotal` | setelah diskon item |
| transactions | diskon | `itemDiscount`, `discount`, `totalDiscount`, `discountType`, `discountValue`, `discountApprovedBy` | dipecah per item dan per transaksi |
| transactions | pajak | `vatRate`, `taxIncluded` | PPN sudah termasuk harga |
| transactions | total | `total`, `grossSubtotal`, `rounding` | `grossSubtotal` sebelum diskon, `rounding` selisih pembulatan |
| transactions | metode_pembayaran | `paymentMethod` | `Tunai`, `QRIS`, `Debit/Transfer` |
| transactions | pembayaran | `received` | nominal uang diterima |
| transactions | kembalian | `change` | |
| transactions | status | `status` | `selesai` atau `dibatalkan` |
| transactions | alasan_void | `voidReason`, `voidedAt`, `voidedBy`, `voidedByName` | |
| transaction_items | product_id | `productId` | |
| transaction_items | nama_produk | `name` | snapshot |
| transaction_items | harga | `price` | snapshot |
| transaction_items | qty | `quantity` | |
| transaction_items | diskon | `discount`, `discountType`, `discountValue`, `discountApprovedBy` | |
| transaction_items | subtotal | `subtotal` | |
| transaction_items | — (baru) | `purchasePrice`, `categoryId`, `sku`, `unit` | snapshot untuk laporan |
| stock_movements | tipe | `type` | `penjualan`, `masuk`, `koreksi`, `void` |
| stock_movements | jumlah | `quantity` | negatif untuk pengurangan |
| stock_movements | stok_sebelum / stok_sesudah | `stockBefore` / `stockAfter` | |
| stock_movements | alasan | `reason`, `note`, `source`, `adjustmentType` | |
| stock_movements | user_id | `userId`, `userName` | |
| settings | key, value | satu objek dengan kunci `storeName`, `storeAddress`, `storePhone`, `receiptFooter`, `receiptPaperSize`, `vatRate`, `roundTo100`, `defaultMinStock`, `paymentMethods` | tidak lagi pasangan key-value terpisah |

### 8.3 Batasan Keamanan Versi 1

Poin-poin berikut adalah keterbatasan yang **diterima** pada versi 1 dan menjadi alasan versi lanjutan disiapkan. Semuanya perlu disebut agar tidak menimbulkan kesan bahwa NFR-03 sudah terpenuhi penuh.

| Hal | Kondisi versi 1 | Dampak | Rencana perbaikan |
| --- | --- | --- | --- |
| Penyimpanan password | SHA-256 tanpa salt, hash disimpan di `localStorage` | Hash dapat dibaca dan diserang dengan tabel pelangi bila perangkat dipakai bersama | Pindah ke Supabase Auth atau algoritma dengan salt (bcrypt/Argon2) di versi lanjutan |
| Penegakan peran | Hanya di browser (`Auth.requireAuth` dan penyembunyian menu) | Pengguna yang membuka DevTools dapat memanggil fungsi data secara langsung | Row Level Security di database |
| Pembatasan percobaan login | 5 kali gagal, kunci 5 menit, dihitung di `localStorage` | Bisa direset dengan membersihkan penyimpanan browser | Ditegakkan di server |
| Sesi | Penanda sesi di `localStorage`, berakhir setelah 30 menit tidak aktif | Tidak ada token bertanda tangan; sesi dapat disalin manual | JWT/refresh token dari penyedia autentikasi |
| Integritas transaksi | Rollback manual bila `localStorage` menolak penulisan | Konsisten untuk satu tab; penulisan dari beberapa tab secara bersamaan belum diuji | Transaksi database atomik |

Mitigasi yang sudah diterapkan pada versi 1: seluruh keluaran dinamis dilewatkan `escapeHTML` sebelum masuk `innerHTML`, validasi tipe dan rentang nilai dilakukan di lapisan store (bukan hanya di form), dan setiap kegagalan penyimpanan mengembalikan data ke kondisi sebelumnya.

### 8.4 Perilaku yang Sudah Diimplementasikan

1. **Shortcut keyboard pada halaman Kasir** sudah aktif, sehingga tidak lagi termasuk pengembangan lanjutan: `F1` fokus kolom cari, `F4` dialog diskon, `F8` fokus nominal bayar, `F9` batal transaksi, `Enter` membuka/proses pembayaran, `F10` cetak ulang struk, `F2`/`Esc` menutup struk. Daftar ini juga tampil pada bar pintasan di bawah keranjang.
2. **Produk dengan stok 0 tetap muncul pada pencarian kasir.** Baris hasil pencarian menampilkan label merah "Stok habis" dan produk tidak dapat ditambahkan ke keranjang; pesan "Produk tidak ditemukan" hanya muncul bila kode atau nama benar-benar tidak ada. Pemindaian barcode produk habis menghasilkan pesan "<nama produk> sedang habis.".
3. **Identitas kasir pada halaman Kasir** ditampilkan sebagai kode staf (`KSR-0881` untuk akun kasir contoh, `ADM-0101` untuk akun admin), bukan angka id. Kode baru dibuat otomatis berurutan (`KSR-0882`, dan seterusnya) saat Admin menambah pengguna, dan ikut tampil di tabel Pengguna.
4. **Halaman login tidak lagi menampilkan kotak akun demo.** Kredensial akun contoh didokumentasikan pada README repositori, bukan pada antarmuka yang dipakai pengguna.

### 8.5 Akun Contoh dan Data Awal

Data awal dibuat otomatis saat halaman login pertama kali dibuka: dua akun (satu Admin, satu Kasir), enam kategori, dan sembilan produk contoh. Akun contoh hanya untuk pengujian dan wajib diganti sebelum pemakaian nyata. Perubahan data tersimpan di browser yang dipakai; menghapus data situs pada browser akan mengembalikan data ke kondisi awal.

### 8.6 Dua Varian dalam Repositori

Repositori memuat dua implementasi dari kebutuhan yang sama, sehingga pembaca dapat membandingkan pendekatan tanpa berpindah dokumen.

| Varian | Teknologi | Isi |
| --- | --- | --- |
| `versi-murni/` | HTML, CSS, dan JavaScript murni tanpa build tool | Seluruh kebutuhan berprioritas Tinggi dan Sedang; data di `localStorage`; menjadi acuan Bab 8.2–8.5 |
| `versi-lanjutan/` | React 18 + Vite, Tailwind CSS dengan komponen bergaya shadcn/ui, React Router, Zustand, TanStack Query, React Hook Form + Zod, Lucide Icons | Cakupan fitur sama dengan `versi-murni/`, dibangun dengan pemisahan komponen, state, dan lapisan layanan data sesuai tabel teknologi Bab 2.7 |

Status pemenuhan setiap kebutuhan fungsional dan non-fungsional pada kedua varian dicatat pada `docs/CONFORMANCE.md`. Dokumen tersebut juga memuat butir tampilan yang belum seragam (logo, header kasir, pagination) beserta rencana penutupannya, sehingga selisih antarvariansi tidak perlu ditebak dari kode.

Keduanya memakai kunci penyimpanan yang sama (`kasir_products`, `kasir_transactions`, dan seterusnya) sehingga data satu varian dapat dibaca varian lain pada peramban yang sama. Batasan pada 8.3 berlaku untuk keduanya; perbedaan antarvariansi terletak pada cara kode disusun, bukan pada perilaku bisnis atau tingkat keamanan. Perpindahan ke Supabase direncanakan dengan mengganti isi lapisan layanan (`versi-lanjutan/src/lib/api.js`) tanpa mengubah komponen antarmuka.

### 8.7 Status Teknologi versi-lanjutan terhadap Bab 2.7

Bab 2.7 menetapkan rencana teknologi. Tabel berikut mencatat statusnya pada `versi-lanjutan/` per 17 November 2026, setelah audit kesesuaian.

| Lapisan | Rencana (Bab 2.7) | Status | Catatan |
| --- | --- | --- | --- |
| Frontend | React 18 + Vite | Terpenuhi | React 18.3.1, Vite 5.4; hasil build berupa HTML/CSS/JS statis |
| Styling | Tailwind CSS + shadcn/ui | Terpenuhi dengan penyesuaian | Tailwind 3.4; komponen ditulis sendiri mengikuti konvensi shadcn/ui (`class-variance-authority`, `clsx`, `tailwind-merge`) tanpa CLI/paket shadcn |
| Routing | React Router | Terpenuhi | `react-router-dom` 6 dengan HashRouter, 9 rute, dan penjaga peran |
| State keranjang | Zustand | Terpenuhi | Sesi, keranjang, dan diskon item |
| Data server | supabase-js + TanStack Query | Sebagian | TanStack Query 5 dipakai di seluruh halaman; `supabase-js` tidak dipakai karena belum ada backend, data dilayani `src/lib/api.js` dari `localStorage` |
| Form dan validasi | React Hook Form + Zod | Terpenuhi | Delapan formulir (login, produk, stok, pengguna, pengaturan, diskon, profil) |
| Grafik | Recharts (alternatif Chart.js) | Terpenuhi | Recharts 3 pada Dashboard dan Laporan, dimuat sebagai chunk terpisah |
| Database dan backend | Supabase (PostgreSQL, Auth, RLS, RPC) | Belum | Penyimpangan terbesar; batasan NFR-03/NFR-04 pada 8.3 berlaku. Titik ganti backend tetap `src/lib/api.js` |
| Ekspor | Blob CSV, jsPDF, `window.print` | Terpenuhi | CSV lewat Blob, PDF laporan lewat jsPDF 4 (ringkasan + produk), struk lewat `window.print` |
| Desain | Figma (akun Free) | Sebagian | Hasil desain ada di `docs/mockup/`; tautan berkas Figma belum dicantumkan di repositori |
| Versi dan hosting | Git, Vercel/Netlify/Cloudflare Pages | Sebagian | Git dan GitHub aktif; `dist/` siap unggah, URL deploy belum tersedia |
| Editor | VS Code | Tidak dinilai | Tidak dapat diverifikasi dari repositori |

Konsekuensi yang perlu dicatat pembaca: selama Supabase belum dipakai, otorisasi dan integritas transaksi hanya ditegakkan di sisi peramban (8.3) dan data tidak tersinkron antar perangkat. Selebihnya, stack versi ini mengikuti Bab 2.7; dua butir yang sebelumnya menyimpang (Recharts dan jsPDF) sudah diselaraskan pada 17 November 2026.
