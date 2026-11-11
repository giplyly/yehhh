const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { getGroupConfig, setGroupConfig } = require('../database');

// Path ke file database (sama dengan yang dipakai di database.js)
const dbPath = path.join(__dirname, '..', 'database', 'bot.db');

let db = null;

/**
 * Membuka koneksi SQLite (singleton)
 */
function getDB() {
  if (db) return db;
  // Pastikan folder database ada
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new sqlite3.Database(dbPath);
  // Buat tabel admin & settings bila belum ada
  db.run(
    `CREATE TABLE IF NOT EXISTS bot_admins (
      user_id INTEGER PRIMARY KEY
    )`,
    (err) => {
      if (err) console.error('❌ Gagal membuat tabel bot_admins:', err);
    }
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
    (err) => {
      if (err) console.error('❌ Gagal membuat tabel bot_settings:', err);
    }
  );
  return db;
}

/**
 * Tambahkan user sebagai admin bot.
 * @param {number} userId
 * @returns {Promise<boolean>} true bila berhasil atau sudah ada
 */
async function addAdmin(userId) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.run(
      `INSERT OR IGNORE INTO bot_admins (user_id) VALUES (?)`,
      [userId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Daftar semua admin bot.
 * @returns {Promise<number[]>}
 */
async function listAdmins() {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.all(`SELECT user_id FROM bot_admins`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map((r) => r.user_id));
    });
  });
}

/**
 * Mute anggota grup.
 * @param {import('telegraf').Context} ctx - Context Telegraf (harus memiliki chat.id)
 * @param {number} userId - ID pengguna yang akan dimute
 * @param {number} [duration] - Durasi mute dalam detik (jika tidak diberikan, gunakan default)
 */
async function muteMember(ctx, userId, duration) {
  try {
    const chatId = ctx.chat.id;
    // Ambil durasi default bila tidak diberikan
    if (!duration) {
      const setting = await getSetting('mute_duration');
      duration = setting ? parseInt(setting, 10) : 60; // default 60 detik
    }
    const untilDate = Math.floor(Date.now() / 1000) + duration;
    await ctx.restrictChatMember(userId, {
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
      },
      until_date: untilDate,
    });
    return true;
  } catch (e) {
    console.error('❌ Gagal mute member:', e);
    return false;
  }
}

/**
 * Unmute anggota grup.
 * @param {import('telegraf').Context} ctx
 * @param {number} userId
 */
async function unmuteMember(ctx, userId) {
  try {
    const chatId = ctx.chat.id;
    await ctx.restrictChatMember(userId, {
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
      },
      until_date: 0,
    });
    return true;
  } catch (e) {
    console.error('❌ Gagal unmute member:', e);
    return false;
  }
}

/**
 * Kick anggota grup (tanpa ban permanen).
 * @param {import('telegraf').Context} ctx
 * @param {number} userId
 */
async function kickMember(ctx, userId) {
  try {
    const chatId = ctx.chat.id;
    await ctx.kickChatMember(userId);
    // Opsional: unban segera agar dapat bergabung kembali
    await ctx.unbanChatMember(userId, { only_if_banned: false });
    return true;
  } catch (e) {
    console.error('❌ Gagal kick member:', e);
    return false;
  }
}

/**
 * Ban anggota grup secara permanen.
 * @param {import('telegraf').Context} ctx
 * @param {number} userId
 */
async function banMember(ctx, userId) {
  try {
    const chatId = ctx.chat.id;
    await ctx.banChatMember(userId);
    return true;
  } catch (e) {
    console.error('❌ Gagal ban member:', e);
    return false;
  }
}

/**
 * Unban anggota grup.
 * @param {import('telegraf').Context} ctx
 * @param {number} userId
 */
async function unbanMember(ctx, userId) {
  try {
    const chatId = ctx.chat.id;
    await ctx.unbanChatMember(userId);
    return true;
  } catch (e) {
    console.error('❌ Gagal unban member:', e);
    return false;
  }
}

/**
 * Hapus sejumlah pesan terbaru di grup.
 * @param {import('telegraf').Context} ctx
 * @param {number} chatId
 * @param {number} limit - Jumlah pesan yang ingin dihapus (maks 100)
 */
async function clearMessages(ctx, chatId, limit) {
  try {
    // Telegram tidak menyediakan bulk delete, jadi kita iterasi ID pesan terakhir.
    // Kita asumsikan bot memiliki akses ke pesan terakhir melalui ctx.message.message_id.
    const startId = ctx.message ? ctx.message.message_id : null;
    if (!startId) return false;

    const deletePromises = [];
    for (let i = 0; i < limit; i++) {
      const msgId = startId - i;
      if (msgId <= 0) break;
      deletePromises.push(
        ctx.telegram
          .deleteMessage(chatId, msgId)
          .catch(() => {}) // Abaikan error bila pesan tidak dapat dihapus
      );
    }
    await Promise.all(deletePromises);
    return true;
  } catch (e) {
    console.error('❌ Gagal clear messages:', e);
    return false;
  }
}

/**
 * Kunci grup (nonaktifkan semua pesan kecuali admin).
 * @param {import('telegraf').Context} ctx
 * @param {number} chatId
 */
async function lockGroup(ctx, chatId) {
  try {
    // Simpan status lock di konfigurasi grup
    let cfg = await getGroupConfig(chatId);
    if (!cfg) cfg = {};
    cfg.locked = true;
    await setGroupConfig(chatId, cfg);
    // Restriksi semua anggota (kecuali admin) untuk mengirim pesan
    await ctx.setChatPermissions({
      can_send_messages: false,
      can_send_media_messages: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false,
    });
    return true;
  } catch (e) {
    console.error('❌ Gagal lock group:', e);
    return false;
  }
}

/**
 * Buka kunci grup.
 * @param {import('telegraf').Context} ctx
 * @param {number} chatId
 */
async function unlockGroup(ctx, chatId) {
  try {
    let cfg = await getGroupConfig(chatId);
    if (!cfg) cfg = {};
    cfg.locked = false;
    await setGroupConfig(chatId, cfg);
    await ctx.setChatPermissions({
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
    });
    return true;
  } catch (e) {
    console.error('❌ Gagal unlock group:', e);
    return false;
  }
}

/**
 * Simpan nilai setting umum (key/value) di tabel bot_settings.
 * @param {string} key
 * @param {string|number} value
 */
function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.run(
      `INSERT INTO bot_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [key, String(value)],
      function (err) {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

/**
 * Ambil nilai setting umum.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
function getSetting(key) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.get(`SELECT value FROM bot_settings WHERE key = ?`, [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
}

/**
 * Atur batas peringatan (warning limit) secara global.
 * @param {number} limit
 */
async function setWarningLimit(limit) {
  await setSetting('warning_limit', limit);
}

/**
 * Atur durasi mute default (detik) secara global.
 * @param {number} duration
 */
async function setMuteDuration(duration) {
  await setSetting('mute_duration', duration);
}

// Export semua fungsi sesuai kontrak
module.exports = {
  addAdmin,
  listAdmins,
  muteMember,
  unmuteMember,
  kickMember,
  banMember,
  unbanMember,
  clearMessages,
  lockGroup,
  unlockGroup,
  setWarningLimit,
  setMuteDuration,
};
