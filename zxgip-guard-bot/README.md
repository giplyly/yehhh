zxgip-guard-bot/
│
├─ config.js                 // konfigurasi bot (token, owner, dll)
├─ index.js                  // entry point, inisialisasi bot & middleware
├─ database.js               // manajemen SQLite (initDB, get/set config, warnings)
├─ package.json              // dependensi dan script npm
│
├─ database/                 // folder berisi file bot.db (dibuat otomatis)
│
├─ handlers/                 // semua handler fitur
│   ├─ antiLink.js           // deteksi & penanganan link
│   ├─ antiPromo.js          // deteksi & penanganan promosi
│   ├─ antiSpam.js           // deteksi & penanganan spam
│   ├─ admin.js              // perintah admin (mute, kick, dll)
│   ├─ menu.js               // build & handle menu inline
│   ├─ settings.js           // toggle fitur per grup
│   ├─ welcome.js            // welcome & goodbye message
│   ├─ captcha.js            // captcha verification
│   └─ statistics.js         // statistik grup
│
└─ README.md                 // dokumentasi (Anda sedang membacanya)
