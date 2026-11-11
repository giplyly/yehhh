const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

let db = null;

/**
 * Inisialisasi database SQLite dan buat tabel yang diperlukan.
 */
async function initDB() {
  const dbDir = path.resolve(__dirname, 'database');
  const dbPath = path.join(dbDir, 'bot.db');

  // Pastikan folder database ada
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Buka atau buat file database
  await new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Helper untuk menjalankan query secara async
  const run = (sql) =>
    new Promise((resolve, reject) => {
      db.run(sql, (err) => (err ? reject(err) : resolve()));
    });

  // Tabel konfigurasi grup
  await run(`CREATE TABLE IF NOT EXISTS group_configs (
    group_id TEXT PRIMARY KEY,
    config TEXT NOT NULL
  );`);

  // Tabel peringatan (warnings)
  await run(`CREATE TABLE IF NOT EXISTS warnings (
    user_id TEXT PRIMARY KEY,
    count INTEGER NOT NULL
  );`);
}

/**
 * Ambil konfigurasi grup.
 * @param {string|number} groupId
 * @returns {Promise<Object>} konfigurasi dalam bentuk objek (default {}).
 */
function getGroupConfig(groupId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT config FROM group_configs WHERE group_id = ?`,
      [groupId],
      (err, row) => {
        if (err) return reject(err);
        if (row && row.config) {
          try {
            resolve(JSON.parse(row.config));
          } catch (_) {
            resolve({});
          }
        } else {
          resolve({});
        }
      }
    );
  });
}

/**
 * Simpan atau perbarui konfigurasi grup.
 * @param {string|number} groupId
 * @param {Object} config
 * @returns {Promise<void>}
 */
function setGroupConfig(groupId, config) {
  return new Promise((resolve, reject) => {
    const cfgStr = JSON.stringify(config);
    db.run(
      `INSERT INTO group_configs (group_id, config) VALUES (?, ?)
       ON CONFLICT(group_id) DO UPDATE SET config = excluded.config`,
      [groupId, cfgStr],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

/**
 * Dapatkan jumlah peringatan (warnings) seorang user.
 * @param {string|number} userId
 * @returns {Promise<number>}
 */
function getWarnings(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT count FROM warnings WHERE user_id = ?`,
      [userId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.count : 0);
      }
    );
  });
}

/**
 * Tambah satu peringatan untuk user. Mengembalikan total peringatan setelah penambahan.
 * @param {string|number} userId
 * @returns {Promise<number>}
 */
function addWarning(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO warnings (user_id, count) VALUES (?, 1)
       ON CONFLICT(user_id) DO UPDATE SET count = count + 1`,
      [userId],
      function (err) {
        if (err) return reject(err);
        // Ambil nilai terbaru
        db.get(
          `SELECT count FROM warnings WHERE user_id = ?`,
          [userId],
          (err2, row) => {
            if (err2) return reject(err2);
            resolve(row ? row.count : 0);
          }
        );
      }
    );
  });
}

/**
 * Reset peringatan seorang user (menghapus record).
 * @param {string|number} userId
 * @returns {Promise<void>}
 */
function resetWarnings(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM warnings WHERE user_id = ?`,
      [userId],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

module.exports = {
  initDB,
  getGroupConfig,
  setGroupConfig,
  getWarnings,
  addWarning,
  resetWarnings,
};
