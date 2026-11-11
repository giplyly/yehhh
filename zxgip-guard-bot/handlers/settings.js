const { getGroupConfig, setGroupConfig } = require('../database');

/**
 * Mengaktifkan atau menonaktifkan fitur tertentu pada grup.
 * @param {number|string} groupId - ID grup Telegram.
 * @param {string} feature - Nama fitur (mis: 'antiLink', 'antiPromo', 'antiSpam', dll.).
 * @returns {Promise<boolean>} Status terbaru fitur (true = aktif, false = nonaktif).
 */
async function toggleFeature(groupId, feature) {
  if (!groupId) throw new Error('groupId diperlukan');
  if (!feature) throw new Error('feature diperlukan');

  // Ambil konfigurasi grup, buat default bila belum ada
  let config = await getGroupConfig(groupId);
  if (!config) {
    config = {};
  }

  // Pastikan properti fitur ada, default false
  const current = Boolean(config[feature]);
  const newStatus = !current;
  config[feature] = newStatus;

  await setGroupConfig(groupId, config);
  return newStatus;
}

/**
 * Mengambil status fitur pada grup.
 * @param {number|string} groupId - ID grup Telegram.
 * @param {string} feature - Nama fitur.
 * @returns {Promise<boolean>} true jika fitur aktif, false jika tidak.
 */
async function getFeatureStatus(groupId, feature) {
  if (!groupId) throw new Error('groupId diperlukan');
  if (!feature) throw new Error('feature diperlukan');

  const config = await getGroupConfig(groupId);
  if (!config) return false;
  return Boolean(config[feature]);
}

module.exports = {
  toggleFeature,
  getFeatureStatus,
};
