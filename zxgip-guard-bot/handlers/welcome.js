const { BOT_NAME } = require('../config');
const { getGroupConfig } = require('../database');

/**
 * Kirim pesan selamat datang ketika ada anggota baru.
 * @param {import('telegraf').Context} ctx
 */
async function welcomeNewMember(ctx) {
  try {
    const message = ctx.message;
    if (!message || !message.new_chat_members) return;

    const chatId = message.chat.id;
    const groupConfig = await getGroupConfig(chatId);
    const customWelcome = groupConfig && groupConfig.welcomeMessage;

    for (const member of message.new_chat_members) {
      // Abaikan bot sendiri
      if (member.is_bot) continue;

      const name = member.username
        ? `@${member.username}`
        : `${member.first_name || ''} ${member.last_name || ''}`.trim();

      const welcomeText = customWelcome
        ? customWelcome.replace(/{{user}}/g, name).replace(/{{group}}/g, message.chat.title)
        : `👋 Selamat datang ${name} di *${message.chat.title}*!\n\n🤖 Saya *${BOT_NAME}*, bot pengelola grup. Silakan perkenalkan diri Anda.`;

      await ctx.replyWithMarkdown(welcomeText);
    }
  } catch (err) {
    console.error('Error in welcomeNewMember:', err);
  }
}

/**
 * Kirim pesan perpisahan ketika ada anggota yang keluar atau dihapus.
 * @param {import('telegraf').Context} ctx
 */
async function goodbyeMember(ctx) {
  try {
    const message = ctx.message;
    if (!message || !message.left_chat_member) return;

    const chatId = message.chat.id;
    const groupConfig = await getGroupConfig(chatId);
    const customGoodbye = groupConfig && groupConfig.goodbyeMessage;

    const member = message.left_chat_member;
    const name = member.username
      ? `@${member.username}`
      : `${member.first_name || ''} ${member.last_name || ''}`.trim();

    const goodbyeText = customGoodbye
      ? customGoodbye.replace(/{{user}}/g, name).replace(/{{group}}/g, message.chat.title)
      : `👋 ${name} telah meninggalkan *${message.chat.title}*.\nSemoga kita bertemu lagi!`;

    await ctx.replyWithMarkdown(goodbyeText);
  } catch (err) {
    console.error('Error in goodbyeMember:', err);
  }
}

module.exports = {
  welcomeNewMember,
  goodbyeMember,
};
