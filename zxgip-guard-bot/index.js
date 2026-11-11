const path = require('path');
const fs = require('fs');
const { Telegraf, Markup } = require('telegraf');

const {
  BOT_TOKEN,
  OWNER_ID,
  BOT_NAME,
  DEVELOPER,
  SUPPORT,
} = require('./config');

// Validasi konfigurasi
if (
  !BOT_TOKEN ||
  BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE' ||
  !OWNER_ID ||
  OWNER_ID === 'YOUR_OWNER_ID_HERE'
) {
  console.error(
    '⚠️  Silakan isi BOT_TOKEN dan OWNER_ID di file config.js sebelum menjalankan bot.'
  );
  process.exit(1);
}

// Database
const {
  initDB,
  getGroupConfig,
  setGroupConfig,
  getWarnings,
  addWarning,
  resetWarnings,
} = require('./database');

// Handlers
const { handleAntiLink } = require('./handlers/antiLink');
const { handleAntiPromo } = require('./handlers/antiPromo');
const { handleAntiSpam } = require('./handlers/antiSpam');
const { welcomeNewMember, goodbyeMember } = require('./handlers/welcome');
const { verifyCaptcha } = require('./handlers/captcha');
const { buildMainMenu, handleMenuAction } = require('./handlers/menu');
const { toggleFeature, getFeatureStatus } = require('./handlers/settings');
const { getGroupStats } = require('./handlers/statistics');
const admin = require('./handlers/admin');

// Inisialisasi DB
initDB().catch((err) => {
  console.error('❌ Gagal menginisialisasi database:', err);
  process.exit(1);
});

const bot = new Telegraf(BOT_TOKEN);

// Middleware anti‑link / anti‑promo / anti‑spam
bot.use(async (ctx, next) => {
  try {
    if (!ctx.chat || !ctx.chat.id || !ctx.chat.type.includes('group')) {
      return next();
    }

    const config = await getGroupConfig(ctx.chat.id);

    // Anti Link
    if (config?.antiLink) {
      await handleAntiLink(ctx, config);
    }

    // Anti Promo
    if (config?.antiPromo) {
      await handleAntiPromo(ctx, config);
    }

    // Anti Spam
    if (config?.antiSpam) {
      await handleAntiSpam(ctx, config);
    }

    return next();
  } catch (err) {
    console.error('⚠️ Middleware error:', err);
    return next();
  }
});

// /start
bot.start((ctx) => {
  ctx.reply(
    `👋 Hai! Saya *${BOT_NAME}*.\nGunakan /help untuk melihat daftar perintah.`,
    { parse_mode: 'Markdown' }
  );
});

// /help
bot.help((ctx) => {
  const helpMessage = `
📖 *Daftar Perintah ${BOT_NAME}*

/start – Mulai bot
/help – Bantuan
/panel – Buka panel kontrol
/status – Status grup
/admin – Perintah admin
/warn – Tambah peringatan
/mute – Mute anggota
/unmute – Unmute anggota
/kick – Kick anggota
/ban – Ban anggota
/unban – Unban anggota
/lock – Kunci grup
/unlock – Buka kunci grup
/resetwarn – Reset peringatan
/settings – Pengaturan fitur
`;
  ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// Helper: cek apakah user admin bot atau pemilik grup
async function isUserAuthorized(ctx) {
  const chatMember = await ctx.getChatMember(ctx.from.id);
  return (
    chatMember.status === 'creator' ||
    chatMember.status === 'administrator' ||
    ctx.from.id.toString() === OWNER_ID
  );
}

// /panel – menampilkan menu utama
bot.command('panel', async (ctx) => {
  if (!(await isUserAuthorized(ctx))) {
    return ctx.reply('❌ Anda tidak memiliki izin untuk mengakses panel ini.');
  }
  const menu = buildMainMenu();
  await ctx.reply('🛡️ *Dashboard Guard*', {
    parse_mode: 'Markdown',
    ...menu,
  });
});

// /status – menampilkan status konfigurasi grup
bot.command('status', async (ctx) => {
  if (!ctx.chat || !ctx.chat.id) {
    return ctx.reply('❌ Perintah ini hanya dapat digunakan di dalam grup.');
  }
  const config = await getGroupConfig(ctx.chat.id);
  const statusLines = Object.entries(config || {})
    .filter(([key]) => key.startsWith('anti') || key === 'welcome' || key === 'captcha')
    .map(
      ([key, value]) =>
        `• *${key}*: ${value ? '✅ Aktif' : '❌ Nonaktif'}`
    )
    .join('\n');

  ctx.reply(`📊 *Status Grup*\n${statusLines || 'Tidak ada konfigurasi.'}`, {
    parse_mode: 'Markdown',
  });
});

// /admin – contoh perintah admin (daftar admin)
bot.command('admin', async (ctx) => {
  if (!(await isUserAuthorized(ctx))) {
    return ctx.reply('❌ Hanya admin yang dapat menggunakan perintah ini.');
  }
  const admins = admin.listAdmins();
  const text = admins.length
    ? `👮 *Daftar Admin Bot*\n${admins.map((id) => `- ${id}`).join('\n')}`
    : 'Tidak ada admin bot yang terdaftar.';
  ctx.reply(text, { parse_mode: 'Markdown' });
});

// /settings – toggle fitur (contoh sederhana)
bot.command('settings', async (ctx) => {
  if (!(await isUserAuthorized(ctx))) {
    return ctx.reply('❌ Hanya admin yang dapat mengubah pengaturan.');
  }
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply(
      '⚙️ Penggunaan: /settings <fitur> <on|off>\nContoh: /settings antiLink on'
    );
  }
  const [feature, state] = args;
  const enable = state.toLowerCase() === 'on';
  const groupId = ctx.chat.id;
  await toggleFeature(groupId, feature, enable);
  ctx.reply(
    `✅ Fitur *${feature}* telah ${enable ? 'diaktifkan' : 'dinonaktifkan'}.`,
    { parse_mode: 'Markdown' }
  );
});

// Inline button callback handling
bot.action(/.*/, async (ctx) => {
  try {
    await handleMenuAction(ctx);
  } catch (err) {
    console.error('⚠️ Error handling menu action:', err);
    ctx.answerCbQuery('Terjadi kesalahan.');
  }
});

// Welcome & goodbye
bot.on('new_chat_members', async (ctx) => {
  try {
    await welcomeNewMember(ctx);
    // Jika captcha diaktifkan, jalankan verifikasi
    const config = await getGroupConfig(ctx.chat.id);
    if (config?.captcha) {
      await verifyCaptcha(ctx);
    }
  } catch (err) {
    console.error('⚠️ Welcome error:', err);
  }
});

bot.on('left_chat_member', async (ctx) => {
  try {
    await goodbyeMember(ctx);
  } catch (err) {
    console.error('⚠️ Goodbye error:', err);
  }
});

// Statistik grup (contoh penggunaan)
bot.command('stats', async (ctx) => {
  if (!ctx.chat || !ctx.chat.id) {
    return ctx.reply('❌ Perintah ini hanya dapat digunakan di dalam grup.');
  }
  const stats = await getGroupStats(ctx.chat.id);
  const text = `
📈 *Statistik Grup*
👥 Anggota: ${stats.members}
📨 Pesan hari ini: ${stats.messagesToday}
⚠️ Peringatan total: ${stats.totalWarnings}
`;
  ctx.reply(text, { parse_mode: 'Markdown' });
});

// Global error handling
bot.catch((err, ctx) => {
  console.error(`❌ Error for ${ctx.updateType}`, err);
});

// Launch bot
bot.launch().then(() => {
  console.log(`🚀 Bot ${BOT_NAME} berjalan dengan token ${BOT_TOKEN.slice(0, 5)}...`);
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
