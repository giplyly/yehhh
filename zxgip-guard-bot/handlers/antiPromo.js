const { Telegraf } = require('telegraf');
const {
  getGroupConfig,
  setGroupConfig,
  getWarnings,
  addWarning,
  resetWarnings,
} = require('../database');
const { muteMember } = require('./admin');
const { OWNER_ID } = require('../config');

/**
 * Deteksi dan penanganan pesan promosi / iklan.
 * @param {import('telegraf').Context} ctx
 */
async function handleAntiPromo(ctx) {
  try {
    const message = ctx.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const userId = message.from.id;

    // Bypass owner & bot admins
    if (userId === Number(OWNER_ID)) return;

    // Ambil atau buat konfigurasi grup
    let groupConfig = await getGroupConfig(chatId);
    if (!groupConfig) {
      groupConfig = {
        antiPromo: true,
        warningLimit: 3,
        muteDuration: 60, // detik
        admins: [], // optional
      };
      await setGroupConfig(chatId, groupConfig);
    }

    // Jika fitur anti promo dimatikan, lewati
    if (!groupConfig.antiPromo) return;

    // Daftar pola promosi yang umum
    const promoPatterns = [
      /(?:promo|sale|discount|offer|free|buy\s+now|subscribe|join\s+now)/i,
      /t\.me\/joinchat\/[A-Za-z0-9_-]+/i,
      /t\.me\/[A-Za-z0-9_]+/i,
      /https?:\/\/\S+/i,
      /(?:iklan|advertisement|spam|marketing)/i,
    ];

    const isPromo = promoPatterns.some((regex) => regex.test(message.text));
    if (!isPromo) return;

    // Hapus pesan promosi
    await ctx.deleteMessage(message.message_id).catch(() => {});

    // Tambah peringatan
    await addWarning(userId);
    const warnings = await getWarnings(userId);

    // Kirim notifikasi ke grup
    await ctx.replyWithMarkdown(
      `⚠️ *Peringatan!* @${message.from.username || message.from.first_name} ` +
        `mengirim promosi. (${warnings}/${groupConfig.warningLimit})`,
      { reply_to_message_id: message.message_id }
    );

    // Jika melebihi batas peringatan, mute member
    if (warnings >= groupConfig.warningLimit) {
      const durationSec = Number(groupConfig.muteDuration) || 60;
      await muteMember(chatId, userId, durationSec);
      await ctx.reply(
        `🔇 @${message.from.username || message.from.first_name} ` +
          `telah dibisukan selama ${durationSec} detik karena melanggar batas peringatan.`
      );
      // Reset peringatan setelah mute
      await resetWarnings(userId);
    }
  } catch (error) {
    console.error('Error in handleAntiPromo:', error);
  }
}

module.exports = {
  handleAntiPromo,
};
