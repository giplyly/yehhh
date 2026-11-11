const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { getGroupConfig } = require('../database');

/**
 * Mengambil statistik grup.
 * @param {number} groupId - ID grup Telegram.
 * @returns {Promise<Object>} Objek statistik grup.
 */
async function getGroupStats(groupId) {
  const dbPath = path.join(__dirname, '..', 'database', 'bot.db');

  // Buka koneksi database (readonly)
  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
      if (err) reject(err);
      else resolve(connection);
    });
  });

  try {
    const stats = { groupId };

    // Total peringatan (warning) di grup
    stats.totalWarnings = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) AS cnt FROM warnings WHERE group_id = ?',
        [groupId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.cnt : 0);
        }
      );
    });

    // Total mute yang pernah diberikan di grup
    stats.totalMutes = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) AS cnt FROM mutes WHERE group_id = ?',
        [groupId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.cnt : 0);
        }
      );
    });

    // Total kick yang pernah diberikan di grup
    stats.totalKicks = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) AS cnt FROM kicks WHERE group_id = ?',
        [groupId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.cnt : 0);
        }
      );
    });

    // Ambil konfigurasi grup (fitur aktif/tidak)
    const config = await getGroupConfig(groupId);
    stats.config = config || {};

    return stats;
  } finally {
    // Pastikan koneksi ditutup
    db.close();
  }
}

module.exports = {
  getGroupStats,
};
