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
} = require('./admin');

/**
 * Deteksi dan penanganan pesan yang mengandung link tidak diizinkan.
 * @param {import('telegraf').Context} ctx
 */
async function handleAntiLink(ctx) {
  try {
    const message = ctx.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const userId = message.from.id;

    // Ambil konfigurasi grup, buat default bila belum ada
    let groupConfig = await getGroupConfig(chatId);
    if (!groupConfig) {
      groupConfig = {
        antiLink: true,
        antiLinkWhitelist: [],
        warningLimit: 3,
        muteDuration: 60, // detik
      };
      await setGroupConfig(chatId, groupConfig);
    }

    // Fitur anti‑link dimatikan?
    if (!groupConfig.antiLink) return;

    // Abaikan admin / creator
    const memberInfo = await ctx.getChatMember(userId);
    const isAdmin = ['creator', 'administrator'].includes(memberInfo.status);
    if (isAdmin) return;

    // Daftar whitelist (bisa berupa domain atau kata kunci)
    const whitelist = Array.isArray(groupConfig.antiLinkWhitelist)
      ? groupConfig.antiLinkWhitelist
      : [];

    // Regex sederhana untuk mendeteksi URL
    const linkRegex = /(https?:\/\/[^\s]+)/i;
    if (!linkRegex.test(message.text)) return;

    // Jika mengandung whitelist, abaikan
    const lowerText = message.text.toLowerCase();
    const isWhitelisted = whitelist.some((w) =>
      lowerText.includes(String(w).toLowerCase())
    );
    if (isWhitelisted) return;

    // Hapus pesan yang melanggar
    await ctx.deleteMessage(message.message_id).catch(() => {});

    // Tambah peringatan
    await addWarning(userId);
    const totalWarnings = await getWarnings(userId);
    const limit = Number(groupConfig.warningLimit) || 3;

    // Kirim notifikasi peringatan
    await ctx.replyWithMarkdown(
      `⚠️ <b>${message.from.first_name}</b>, mengirim link tidak diizinkan! (${totalWarnings}/${limit})`,
      { reply_to_message_id: message.message_id }
    );

    // Jika melebihi batas, mute otomatis
    if (totalWarnings >= limit) {
      const duration = Number(groupConfig.muteDuration) || 60; // detik
      await muteMember(userId, duration);
      await ctx.reply(
        `🔇 <b>${message.from.first_name}</b> dibisukan selama ${duration} detik karena melanggar batas peringatan.`,
        { parse_mode: 'HTML' }
      );
      await resetWarnings(userId);
    }
  } catch (err) {
    console.error('Error in handleAntiLink:', err);
  }
}

module.exports = {
  handleAntiLink,
};
