const { Markup } = require('telegraf');
const { toggleFeature, getFeatureStatus } = require('./settings');

/**
 * Membuat menu utama inline keyboard.
 * @param {Number} chatId - ID grup/chat.
 * @returns {Markup.InlineKeyboardMarkup} Inline keyboard markup.
 */
function buildMainMenu(chatId) {
  // Daftar fitur yang akan ditampilkan pada menu utama
  const features = [
    { name: 'Anti Link', key: 'antiLink', emoji: '🛡️' },
    { name: 'Anti Promosi', key: 'antiPromo', emoji: '📢' },
    { name: 'Anti Spam', key: 'antiSpam', emoji: '🚫' },
    { name: 'Anti Flood', key: 'antiFlood', emoji: '🌊' },
    { name: 'Lock Group', key: 'lockGroup', emoji: '🔒' },
    { name: 'Unlock Group', key: 'unlockGroup', emoji: '🔓' },
    { name: 'Welcome', key: 'welcome', emoji: '👥' },
    { name: 'Captcha', key: 'captcha', emoji: '🤖' },
    { name: 'Warning', key: 'warning', emoji: '⚠️' },
    { name: 'Auto Mute', key: 'autoMute', emoji: '🔇' },
    { name: 'Admin Group', key: 'adminGroup', emoji: '👮' },
    { name: 'Daftar Member', key: 'listMembers', emoji: '📋' },
    { name: 'Pengaturan', key: 'settings', emoji: '⚙️' },
    { name: 'Statistik', key: 'statistics', emoji: '📊' },
    { name: 'Panduan', key: 'guide', emoji: '📖' },
    { name: 'Developer', key: 'developer', emoji: '👨‍💻' },
  ];

  // Membuat baris tombol, maksimal 2 tombol per baris untuk tampilan rapi
  const rows = [];
  for (let i = 0; i < features.length; i += 2) {
    const btn1 = features[i];
    const btn2 = features[i + 1];

    const row = [
      Markup.button.callback(
        `${btn1.emoji} ${btn1.name}`,
        `menu:${btn1.key}`
      ),
    ];

    if (btn2) {
      row.push(
        Markup.button.callback(
          `${btn2.emoji} ${btn2.name}`,
          `menu:${btn2.key}`
        )
      );
    }

    rows.push(row);
  }

  // Tambahkan tombol kembali ke dashboard (jika diperlukan)
  rows.push([
    Markup.button.callback('🔙 Kembali ke Dashboard', 'menu:dashboard')
  ]);

  return Markup.inlineKeyboard(rows);
}

/**
 * Menangani aksi callback query dari menu inline.
 * @param {import('telegraf').Context} ctx
 */
async function handleMenuAction(ctx) {
  try {
    const callbackData = ctx.callbackQuery?.data;
    if (!callbackData) return;

    // Pastikan data dimulai dengan prefix "menu:"
    if (!callbackData.startsWith('menu:')) {
      await ctx.answerCbQuery('❓ Aksi tidak dikenali.');
      return;
    }

    const action = callbackData.split(':')[1];
    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;

    // Daftar aksi yang didukung
    const toggleableFeatures = [
      'antiLink',
      'antiPromo',
      'antiSpam',
      'antiFlood',
      'welcome',
      'captcha',
      'warning',
      'autoMute',
      'adminGroup',
      'listMembers',
      'settings',
      'statistics',
      'guide',
      'developer',
      'lockGroup',
      'unlockGroup',
    ];

    if (toggleableFeatures.includes(action)) {
      // Dapatkan status saat ini, kemudian toggle
      const currentStatus = await getFeatureStatus(chatId, action);
      const newStatus = !currentStatus;
      await toggleFeature(chatId, action, newStatus);

      const statusText = newStatus ? '✅ Aktif' : '❌ Nonaktif';
      await ctx.answerCbQuery(`${action} ${statusText}`);

      // Update teks pesan agar pengguna melihat perubahan
      const updatedText = `🔧 *${action}* sekarang ${statusText}`;
      await ctx.editMessageText(updatedText, {
        parse_mode: 'Markdown',
        ...buildMainMenu(chatId),
      });
      return;
    }

    // Aksi khusus yang tidak berupa toggle
    switch (action) {
      case 'dashboard':
        await ctx.editMessageText('📊 *Dashboard Guard*', {
          parse_mode: 'Markdown',
          ...buildMainMenu(chatId),
        });
        await ctx.answerCbQuery();
        break;

      case 'developer':
        await ctx.answerCbQuery('👨‍💻 Dibuat oleh @zxgip21');
        break;

      case 'guide':
        await ctx.answerCbQuery('📖 Silakan gunakan /help untuk melihat panduan.');
        break;

      default:
        await ctx.answerCbQuery('⚠️ Aksi belum diimplementasikan.');
        break;
    }
  } catch (err) {
    console.error('Error handling menu action:', err);
    try {
      await ctx.answerCbQuery('❌ Terjadi kesalahan internal.');
    } catch (_) {
      // ignore secondary errors
    }
  }
}

module.exports = {
  buildMainMenu,
  handleMenuAction,
};
