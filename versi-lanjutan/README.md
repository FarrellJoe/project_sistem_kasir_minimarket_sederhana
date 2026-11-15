# Brahamart POS — versi lanjutan (React 18 + Vite)

Versi ini memakai tech stack yang direncanakan pada SRS bab 2.7. Tujuannya bukan menambah fitur, melainkan menunjukkan bagaimana kebutuhan yang sama dibangun dengan komponen, state, dan data layer yang terpisah rapi.

## Tech stack

| Lapisan | Pilihan | Dipakai di |
| --- | --- | --- |
| Build tool | Vite 5 | `vite.config.js`, `npm run dev/build` |
| UI | React 18 | `src/pages/*.jsx`, `src/components/*` |
| Styling | Tailwind CSS 3 + komponen bergaya shadcn/ui | `tailwind.config.js`, `src/components/ui.jsx` |
| Routing | React Router 6 (HashRouter) | `src/App.jsx` |
| State global | Zustand | `src/stores/index.js` (sesi + keranjang) |
| Data fetching | TanStack Query 5 | semua halaman (`useQuery`/`useMutation`) |
| Form + validasi | React Hook Form + Zod | login, produk, stok, pengguna, pengaturan |
| Ikon | Lucide React | sidebar, tombol, kartu |

Komponen di `src/components/ui.jsx` mengikuti konvensi shadcn/ui (varian lewat `class-variance-authority`, `cn()` dari `clsx` + `tailwind-merge`, `Dialog`/`Card`/`Button`/`Badge`/`Field`) tetapi ditulis langsung di repo. Cara ini dipilih agar tidak perlu menjalankan `npx shadcn-ui init` yang interaktif dan agar hasil build tetap bisa direproduksi dari `npm install` saja.

## Menjalankan

```bash
cd versi-lanjutan
npm install
npm run dev      # http://localhost:5173
npm run build    # hasil statis di dist/
npm run preview  # menguji hasil build
```

Hasil `dist/` bisa diunggah ke Vercel/Netlify/Cloudflare Pages tanpa konfigurasi tambahan karena routing memakai `HashRouter` (tidak butuh aturan rewrite).

**Penting:** jalankan lewat server (dev/preview), jangan membuka `dist/index.html` langsung dari `file://`. Login memakai Web Crypto (`crypto.subtle.digest`), yang diblokir sebagian browser pada `file://`.

## Akun contoh

Dibuat otomatis pada login pertama:

| Peran | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin123` |
| Kasir | `kasir` | `kasir123` |

Kredensial ini hanya untuk demo. Ganti sebelum dipakai nyata.

## Struktur

```
versi-lanjutan/
  index.html
  vite.config.js
  tailwind.config.js
  postcss.config.js
  src/
    main.jsx            provider Query + Router
    App.jsx             daftar route + penjaga peran (RequireAuth)
    index.css           Tailwind + token dasar + gaya cetak struk
    lib/
      storage.js        KEYS, DB lokal, sha256, seed data
      api.js            lapisan layanan (Promise) untuk semua entitas
      format.js         Rupiah, tanggal, CSV, unduh berkas
    stores/index.js     Zustand: sesi login + keranjang
    components/
      ui.jsx            Button, Card, Badge, Dialog, Field, Toast
      Layout.jsx        sidebar per peran + topbar
    pages/              Login, Dashboard, Kasir, Produk, Stok,
                        Riwayat, Laporan, Pengguna, Pengaturan
```

## Perbedaan dengan `versi-murni/`

| Aspek | versi-murni | versi-lanjutan |
| --- | --- | --- |
| Teknologi | HTML/CSS/JS murni, satu berkas per halaman | React 18 + Vite, komponen |
| State keranjang | variabel `Map` di dalam IIFE | Zustand store |
| Pengambilan data | fungsi langsung dari `localStorage` | TanStack Query + `api.js` |
| Form | validasi manual per halaman | React Hook Form + Zod |
| Sumber data | `localStorage` | `localStorage` lewat `api.js` (titik ganti ke REST/Supabase sudah disiapkan) |
| Routing | perpindahan halaman HTML | React Router (HashRouter) |
| Ukuran build | 0 KB dependensi | ±440 kB JS (±129 kB gzip) |

## Batasan yang sama dengan versi-murni

Data masih di `localStorage`, password di-hash SHA-256 tanpa salt, dan pembatasan peran hanya di sisi klien. SRS bab 8.3 menjelaskan batasan ini beserta rencana perpindahan ke Supabase + Row Level Security. Untuk migrasi ke Supabase, yang perlu diganti hanya isi `src/lib/api.js`; komponen tidak perlu disentuh karena semuanya sudah memanggil fungsi `async`.
