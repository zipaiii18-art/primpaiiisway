# Primpaii's Way

Jurnal rekapan jualan pribadi: dashboard, rekapan transaksi, reminder renewal, riwayat order, dan setting — dibuat dengan HTML, CSS, dan JavaScript biasa (tanpa build step), plus satu Netlify Function untuk login Spotify.

## Isi paket
- `index.html` — website interaktif: Dashboard, Rekapan, Reminder, Riwayat Order, Setting.
- `Code.gs` — jembatan Google Apps Script untuk menulis dan membaca order dari Google Sheets.
- `netlify/functions/spotify.mjs` — login Spotify (OAuth) yang aman untuk My Little Playlist. Opsional.

## Jalankan lokal
Buka `index.html` di browser. Data disimpan di localStorage browser/perangkat yang sedang dipakai. Gunakan Backup JSON secara berkala.

## Deploy ke Netlify
1. Extract ZIP ini.
2. Login Netlify → Add new site → Deploy manually.
3. Drag folder yang berisi `index.html`, `Code.gs`, dan folder `netlify` ke area deploy Netlify (atau hubungkan repo Git).
4. Website akan mendapat URL Netlify. Tidak perlu build command untuk versi ini.

## Sambungkan Google Sheets
1. Buka spreadsheet: https://docs.google.com/spreadsheets/d/1F95-UMgaSWF8zIapli2j40NehaGPvCszQvnxsuxSmcM/edit
2. Pastikan akun Google yang dipakai punya akses Editor.
3. Di spreadsheet pilih Extensions → Apps Script.
4. Hapus kode contoh, lalu salin seluruh isi `Code.gs` dari paket ini ke editor Apps Script. Save.
5. Deploy → New deployment → pilih type **Web app**.
6. Execute as: **Me**. Who has access: **Anyone** (siapa pun yang memiliki URL dapat memanggil endpoint; jangan bagikan URL ini ke publik).
7. Klik Deploy, selesaikan otorisasi Google, lalu copy URL Web app yang berakhiran `/exec`.
8. Di website buka Setting → paste URL itu pada kolom Apps Script Web App URL → Save connection.
9. Order baru akan dikirim ke tab `Primpaii Orders` secara otomatis. Tombol **Sync all orders → Sheet** mengirim seluruh order lokal. Tombol **Import from Sheet** membaca baris dari tab itu dan menggabungkannya ke data lokal berdasarkan Order ID. Script akan memperbarui baris yang memiliki Order ID sama, jadi sync berulang tidak menggandakan order.

## Penting tentang spreadsheet
- Integrasi ini membuat tab khusus bernama `Primpaii Orders`; tidak mengubah tab lain yang sudah ada.
- Preview spreadsheet ditampilkan di Setting. Jika preview tidak muncul, ubah izin berbagi spreadsheet agar akun yang digunakan dapat melihatnya.
- Website memakai penyimpanan lokal browser sebagai sumber data utama. Untuk membuka data di perangkat/browser lain, deploy Apps Script lalu gunakan tombol Import from Sheet di Setting.
- POST browser memakai mode no-cors; website tidak dapat membaca konfirmasi balasan Google secara langsung. Periksa tab `Primpaii Orders` untuk memastikan data masuk.
- Profit dan total bersih dihitung dengan rumus: pemasukan − pengeluaran − diskon.
- Reminder menghitung tanggal habis dari tanggal order + durasi. Untuk durasi bulanan/tahunan, kalender mengikuti aturan tanggal JavaScript (misalnya tanggal 31 dapat bergeser pada bulan yang lebih pendek).

## Fitur
- Edit dan hapus order, pencarian, filter tanggal, export CSV, backup/restore JSON.
- Reminder aktif, urgent (3 hari atau kurang), dan expired.
- Ranking aplikasi paling sering diorder.
- 5 font, tema terang/gelap, pilihan simbol toolbar.
- Judul dengan font script + ornamen `꒷꒦︶꒷꒦︶ ๋ ࣭ ⭑꒷꒦`, dekorasi melayang (ꕤ ☁️ 𑄝੭ 𓆩♡𓆪 𝜗𝜚) yang ringan dan tidak menghalangi klik.
- **♫ My Little Playlist** (Setting): tambah lagu dari Spotify (embed resmi), YouTube (IFrame Player API resmi), atau URL audio langsung (MP3/WAV/OGG). Play/pause, next/prev, shuffle, repeat, volume & mute, progress bar (sesuai dukungan sumber), favorit, rename, urutkan, hapus. Mini player muncul di halaman lain saat musik aktif. Musik tidak pernah diputar otomatis. Playlist & preferensi disimpan di localStorage dan ikut masuk Backup JSON.

## Login Spotify (opsional)
Spotify embed bisa dipakai tanpa login. Untuk tombol **Connect Spotify** (memuat playlist akunmu):
1. Buat app di https://developer.spotify.com/dashboard.
2. Tambahkan Redirect URI: `https://<domain-kamu>/api/spotify/callback`.
3. Di Netlify → Project configuration → Environment variables, isi `SPOTIFY_CLIENT_ID` dan `SPOTIFY_CLIENT_SECRET` (opsional `SPOTIFY_COOKIE_SECRET`), lalu deploy ulang.
4. Website tidak pernah meminta password Spotify; token disimpan terenkripsi di cookie httpOnly, bukan di JavaScript/localStorage.

## Jalankan lokal dengan fungsi Netlify
`netlify dev` lalu buka URL yang ditampilkan. Membuka `index.html` langsung tetap bisa, hanya status login Spotify yang tidak tersedia.
