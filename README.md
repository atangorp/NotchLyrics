# 🎵 NotchLyrics for macOS

> **Dynamic Island & Notch-style Real-time Sing-along Lyrics for Mac**  
> Menampilkan lirik lagu sebaris (*single-line rolling lyrics*) yang tersinkronisasi langsung saat memutar lagu di **Spotify** atau **YouTube** di macOS.

---

## 🌟 Kenapa NotchLyrics?

Banyak aplikasi media bar atau notch di macOS (seperti NotchBox, MediaMate, dll) hanya menampilkan **logo musik, cover album, atau judul lagu saja**, tetapi **tidak memiliki lirik lagu real-time**.

**NotchLyrics** diciptakan untuk kamu yang suka bernyanyi sambil mendengarkan musik:
- 🎤 **Single-Line Compact Bar**: Tampilan minimalis sebaris yang menempel pas di bawah notch MacBook (atau melayang di layar).
- ⚡ **Auto-Sync Lyrics (LRCLIB Engine)**: Mengambil lirik bersinkronisasi waktu (*timestamped LRC*) secara otomatis tanpa butuh API key berbayar.
- 🟢 **Spotify Native Support**: Mengambil lagu dan posisi detik pemutaran langsung dari Spotify Desktop via AppleScript dengan latensi 0ms.
- ▶️ **YouTube Browser Support**: Mendeteksi video musik YouTube yang sedang diputar di browser (Chrome, Brave, Safari, Arc).
- 👻 **Ghost Mode (Click-Through)**: Bar lirik tetap terlihat di atas semua aplikasi namun tembus klik mouse, jadi tidak mengganggu saat bekerja atau browsing!
- 🎛️ **Micro-Sync Offset (+/- 0.5s)**: Fitur penyesuaian jika lirik sedikit lebih cepat atau lambat dari audio.
- 🔍 **Manual Search & Demo Mode**: Bisa mencari lirik lagu apa saja secara manual atau memutar lagu demo untuk mengetes karaoke.

---

## 🚀 Cara Menjalankan

Buka Terminal di Mac kamu:

```bash
cd ~/NotchLyrics
```

### 1. Mode Desktop App (Native macOS Floating Notch)
Menampilkan bar lirik transparan yang melayang di atas semua aplikasi Mac:
```bash
npm start
```
*(Atau `npx electron .`)*

### 2. Mode Web Preview (Buka di Browser)
Jika ingin melihat dan mencoba langsung di browser Chrome/Safari:
```bash
npm run web
```
Lalu buka: **[http://localhost:3939](http://localhost:3939)**

---

## 🧭 Panduan Penggunaan & Fitur

| Fitur | Cara Menggunakan |
| :--- | :--- |
| **Pindah Posisi (Drag)** | Klik dan tahan baris notch lalu geser ke mana saja di layar. |
| **Buka Menu Kontrol** | Arahkan kursor (*hover*) ke notch atau klik tombol panah bawah di sisi kanan bar. |
| **Ghost Mode 👻** | Klik tombol `Ghost` di menu expanded agar klik mouse tembus ke jendela di bawahnya. |
| **Atur Sync Waktu** | Klik `-0.5s` atau `+0.5s` untuk menyesuaikan sinkronisasi lirik. |
| **Mode Demo ✨** | Klik tombol `Demo` untuk mencoba lirik lagu populer (Adele, NIKI, Bruno Mars). |
| **Cari Lirik Manual 🔍** | Klik ikon kaca pembesar dan ketik judul lagu yang sedang didengarkan. |

---

## 📂 Struktur Proyek

```
~/NotchLyrics/
├── package.json         # Konfigurasi project & script run
├── main.js              # Electron main process (window notch, tray, & permissions)
├── preload.js           # Bridge komunikasi IPC antar proses
├── server.js            # Web preview server (http://localhost:3939)
├── services/
│   ├── spotify.js       # Integrasi AppleScript Spotify Desktop
│   ├── youtube.js       # Detektor tab & pemutaran YouTube di browser
│   ├── lyricsEngine.js  # Mesin pencari lirik LRCLIB dengan cache lokal
│   └── tracker.js       # Koordinator sinkronisasi waktu & lirik
└── ui/
    ├── index.html       # Tampilan Notch Pill & Dynamic Island
    ├── style.css        # Desain Apple Liquid Glass & animasi karaoke
    └── renderer.js      # Logika ticker lirik, interpolasi 60 FPS
```

---

## 💡 Tips Penggunaan di Mac

1. **Spotify Desktop App**:
   - Pastikan aplikasi Spotify terinstal di Mac. Lirik akan langsung otomatis mendeteksi detik lagu yang sedang diputar.
2. **YouTube di Browser (Google Chrome / Brave / Safari)**:
   - Cukup putar video musik di YouTube. NotchLyrics akan otomatis membaca judul video, mengekstrak nama lagu & artis, serta memuat liriknya.
   - *Tips untuk Chrome*: Agar deteksi detik video lebih presisi, kamu bisa mengaktifkan **View > Developer > Allow JavaScript from Apple Events** di menu bar Chrome.
