const { Telegraf } = require('telegraf');
const {
  getGroupConfig,
  setGroupConfig,
  getWarnings,
  addWarning,
  resetWarnings,
} = require('../database');
const {
  muteMember,
  // addAdmin, listAdmins, unmuteMember, kickMember, banMember,
  // unbanMember, clearMessages, lockGroup, unlockGroup,
  // setWarningLimit, setMuteDuration,
} = require('./admin');
const { OWNER_ID } = require('../config');

// Penyimpanan sementara untuk menghitung frekuensi pesan per pengguna
// key: `${chatId}:${userId}` -> array timestamp (ms)
const userMessageMap = new Map();

/**
 * Deteksi dan penanganan spam dalam grup.
 * @param {import('telegraf').Context} ctx
 */
async function handleAntiSpam(ctx) {
  try {
    const message = ctx.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const userId = message.from.id;

    // Bypass owner dan admin bot
    if (userId === Number(OWNER_ID)) return;

    // Ambil atau buat konfigurasi grup
    let groupConfig = await getGroupConfig(chatId);
    if (!groupConfig) {
      groupConfig = {
        antiSpam: true,
        warningLimit: 3,
        muteDuration: 60, // detik
      };
      await setGroupConfig(chatId, groupConfig);
    }

    // Jika fitur antiSpam dimatikan, tidak diproses
    if (!groupConfig.antiSpam) return;

    const key = `${chatId}:${userId}`;
    const now = Date.now();

    // Ambil riwayat pesan pengguna, bersihkan yang lebih lama dari interval
    const interval = 10 * 1000; // 10 detik
    let timestamps = userMessageMap.get(key) || [];
    timestamps = timestamps.filter((t) => now - t <= interval);
    timestamps.push(now);
    userMessageMap.set(key, timestamps);

    // Jika lebih dari 5 pesan dalam interval, dianggap spam
    const spamThreshold = 5;
    if (timestamps.length > spamThreshold) {
      // Hapus pesan yang melanggar
      await ctx.deleteMessage(message.message_id).catch(() => {});

      // Tambah peringatan
      await addWarning(userId);
      const warnings = await getWarnings(userId);

      // Kirim notifikasi peringatan
      await ctx.reply(
        `⚠️ <a href="tg://user?id=${userId}">${message.from.first_name}</a>, Anda mengirim pesan terlalu cepat! ` +
          `Peringatan: ${warnings}/${groupConfig.warningLimit}.`,
        { parse_mode: 'HTML' }
      );

      // Jika melebihi batas peringatan, mute pengguna
      if (warnings >= groupConfig.warningLimit) {
        const durationSec = groupConfig.muteDuration || 60;
        await muteMember(chatId, userId, durationSec);
        await ctx.reply(
          `🔇 <a href="tg://user?id=${userId}">${message.from.first_name}</a> telah dibisukan selama ${durationSec} detik karena spam.`,
          { parse_mode: 'HTML' }
        );
        await resetWarnings(userId);
        // Reset riwayat pesan untuk pengguna ini
        userMessageMap.delete(key);
      }
    }
  } catch (err) {
    console.error('Error in handleAntiSpam:', err);
  }
}

module.exports = {
  handleAntiSpam,
};
