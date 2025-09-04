// CommonJS версия — не забывай задать BOT_TOKEN в окружении
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('ERROR: переменная окружения BOT_TOKEN не установлена.');
  process.exit(1);
}

// Поменяй на URL своего GitHub Pages (обязательно с trailing slash '/')
const WEBAPP_URL = 'https://<your-github-username>.github.io/tg-city-cases/';

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Привет! Жми «Открыть кейс» 👇', {
    reply_markup: {
      keyboard: [[{ text: 'Открыть кейс', web_app: { url: WEBAPP_URL } }]],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
});

// Получаем web_app_data (tg.sendData) из мини-аппа
bot.on('message', async (msg) => {
  if (!msg.web_app_data) return;
  try {
    const payload = JSON.parse(msg.web_app_data.data);
    if (payload.action === 'claim') {
      const caption = `Твоя карта: <b>${payload.title}</b>\nРедкость: <b>${payload.rarity?.toUpperCase() || ''}</b>`;
      const imgUrl = `${WEBAPP_URL}${payload.image}`;
      // отправляем картинку как фото
      await bot.sendPhoto(msg.chat.id, imgUrl, { caption, parse_mode: 'HTML' });
    }
  } catch (e) {
    console.error('Ошибка при обработке web_app_data:', e);
  }
});
