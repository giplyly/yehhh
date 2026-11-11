const { Markup } = require('telegraf');

// Penyimpanan sementara captcha yang sedang menunggu verifikasi
// key: `${chatId}:${userId}` -> answer (string)
const pendingCaptchas = new Map();

/**
 * Membuat soal captcha sederhana (penjumlahan dua angka).
 * @returns {{question: string, answer: string}}
 */
function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return {
    question: `🧩 Silakan selesaikan: ${a} + ${b} = ?`,
    answer: (a + b).toString(),
  };
}

/**
 * Mengirimkan captcha ke anggota baru.
 * Fungsi ini dapat dipanggil dari handler welcome ketika anggota baru bergabung.
 * @param {import('telegraf').Context} ctx
 */
async function sendCaptcha(ctx) {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  const { question, answer } = generateCaptcha();
  const key = `${chatId}:${userId}`;
  pendingCaptchas.set(key, answer);

  await ctx.reply(
    `${question}\n\nTekan tombol di bawah jika sudah menjawab dengan benar.`,
    Markup.inlineKeyboard([
      Markup.button.callback('✅ Saya sudah menjawab', `captcha:${answer}`),
    ])
  );
}

/**
 * Handler untuk memproses aksi captcha (callback query).
 * @param {import('telegraf').Context} ctx
 */
async function verifyCaptcha(ctx) {
  try {
    const callback = ctx.callbackQuery;
    if (!callback) return;

    const data = callback.data; // format: "captcha:<jawaban>"
    const [prefix, userAnswer] = data.split(':');
    if (prefix !== 'captcha') return;

    const chatId = callback.message.chat.id;
    const userId = callback.from.id;
    const key = `${chatId}:${userId}`;

    const correctAnswer = pendingCaptchas.get(key);
    if (!correctAnswer) {
      await ctx.answerCbQuery('❌ Tidak ada captcha yang menunggu verifikasi.', { show_alert: true });
      return;
    }

    if (userAnswer === correctAnswer) {
      pendingCaptchas.delete(key);
      await ctx.answerCbQuery('✅ Verifikasi berhasil!', { show_alert: true });
      await ctx.reply(`🎉 Selamat datang, ${callback.from.first_name}!`);
    } else {
      await ctx.answerCbQuery('❌ Jawaban salah, silakan coba lagi.', { show_alert: true });
    }
  } catch (err) {
    console.error('Error in verifyCaptcha:', err);
  }
}

module.exports = {
  verifyCaptcha,
  // Export tambahan untuk dipanggil dari handler lain (misalnya welcome.js)
  sendCaptcha,
};
