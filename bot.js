require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || '').replace(/^@/, '');

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN. Copy .env.example to .env and set your token.');
  process.exit(1);
}

if (!ADMIN_USERNAME) {
  console.error('Missing ADMIN_USERNAME in .env');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let adminChatId = null;
const userLastMessage = new Map();
const subscribers = new Set();
const userStates = new Map();

function isAdmin(user) {
  return user && user.username === ADMIN_USERNAME;
}

function isSpam(userId) {
  const lastMessageTime = userLastMessage.get(userId);
  const now = Date.now();

  if (lastMessageTime && now - lastMessageTime < 10000) {
    return true;
  }

  userLastMessage.set(userId, now);
  return false;
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;

  if (isAdmin(user)) {
    adminChatId = chatId;
    bot.sendMessage(
      chatId,
      'Режим администратора активирован.\n\n' +
        'Команды:\n' +
        '/stats — статистика\n' +
        '/broadcast — рассылка\n' +
        '/subscribers — список подписчиков'
    );
    return;
  }

  bot.sendMessage(
    chatId,
    `Привет, ${user.first_name}!\n\n` +
      'Это бот-предложка. Ты можешь:\n' +
      '• отправить текст, фото, видео или файлы\n' +
      '• /subscribe — подписаться на рассылку\n' +
      '• /help — помощь\n\n' +
      'Просто напиши или отправь что-нибудь.'
  );
});

bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;

  if (subscribers.has(chatId)) {
    bot.sendMessage(chatId, 'Вы уже подписаны на рассылку.');
    return;
  }

  subscribers.add(chatId);
  bot.sendMessage(
    chatId,
    'Вы подписались на рассылку.\n' +
      'Будете получать объявления от администратора.'
  );

  if (adminChatId) {
    bot.sendMessage(
      adminChatId,
      'Новый подписчик\n' +
        `Имя: ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}\n` +
        `ID: ${user.id}\n` +
        `@${user.username || 'нет username'}\n` +
        `Всего подписчиков: ${subscribers.size}`
    );
  }
});

bot.onText(/\/unsubscribe/, (msg) => {
  const chatId = msg.chat.id;

  if (subscribers.has(chatId)) {
    subscribers.delete(chatId);
    bot.sendMessage(chatId, 'Вы отписались от рассылки.');
  } else {
    bot.sendMessage(chatId, 'Вы не были подписаны на рассылку.');
  }
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    'Как пользоваться ботом:\n\n' +
      '• Отправь сообщение — оно придёт админу\n' +
      '• Можно слать текст, фото, видео, файлы\n' +
      '• Антиспам: 1 сообщение в 10 секунд\n' +
      '• /subscribe — подписаться на новости\n' +
      '• /unsubscribe — отписаться'
  );
});

bot.onText(/\/stats/, async (msg) => {
  if (!isAdmin(msg.from)) return;

  try {
    const statsMessage =
      'Статистика бота:\n\n' +
      `Подписчиков рассылки: ${subscribers.size}\n` +
      `Время работы: ${Math.floor(process.uptime() / 60)} мин\n` +
      `Активных сессий: ${userLastMessage.size}`;

    bot.sendMessage(msg.chat.id, statsMessage);
  } catch (error) {
    console.error('Stats error:', error.message);
    bot.sendMessage(msg.chat.id, 'Не удалось получить статистику.');
  }
});

bot.onText(/\/subscribers/, (msg) => {
  if (!isAdmin(msg.from)) return;

  if (subscribers.size === 0) {
    bot.sendMessage(msg.chat.id, 'Нет подписчиков на рассылку.');
    return;
  }

  let subscribersList = `Подписчики (${subscribers.size}):\n\n`;
  let count = 0;
  const subscriberIds = Array.from(subscribers);

  function getNextSubscriber() {
    if (count >= subscriberIds.length) return;

    const subId = subscriberIds[count];
    bot
      .getChat(subId)
      .then((chat) => {
        subscribersList += `${count + 1}. ${chat.first_name || 'Пользователь'} (ID: ${chat.id})`;
        if (chat.username) subscribersList += ` @${chat.username}`;
        subscribersList += '\n';

        count += 1;
        if (count < subscriberIds.length) {
          getNextSubscriber();
        } else {
          bot.sendMessage(msg.chat.id, subscribersList);
        }
      })
      .catch(() => {
        subscribersList += `${count + 1}. Не удалось получить данные (ID: ${subId})\n`;
        count += 1;
        if (count < subscriberIds.length) {
          getNextSubscriber();
        } else {
          bot.sendMessage(msg.chat.id, subscribersList);
        }
      });
  }

  getNextSubscriber();
});

bot.onText(/\/broadcast/, (msg) => {
  if (!isAdmin(msg.from)) return;

  userStates.set(msg.chat.id, { mode: 'broadcast' });
  bot.sendMessage(
    msg.chat.id,
    `Режим рассылки\n\nВведите сообщение для ${subscribers.size} подписчиков.\n` +
      '/cancel — отмена'
  );
});

bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;

  if (userStates.has(chatId)) {
    userStates.delete(chatId);
    bot.sendMessage(chatId, 'Действие отменено.');
  }
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;

  if (msg.text && msg.text.startsWith('/')) {
    return;
  }

  if (isAdmin(user) && userStates.has(chatId)) {
    const state = userStates.get(chatId);

    if (state.mode === 'reply') {
      bot.sendMessage(state.targetUserId, `Ответ от администратора:\n\n${msg.text}`);
      bot.sendMessage(chatId, 'Ответ отправлен.');
      userStates.delete(chatId);
      return;
    }

    if (state.mode === 'broadcast') {
      broadcastMessage(msg.text, chatId);
      userStates.delete(chatId);
      return;
    }
  }

  if (isAdmin(user)) {
    bot.sendMessage(chatId, 'Используйте команды для управления ботом.');
    return;
  }

  if (isSpam(user.id)) {
    bot.sendMessage(
      chatId,
      'Слишком часто. Можно отправлять 1 сообщение в 10 секунд.'
    );
    return;
  }

  processSuggestion(msg);
});

function broadcastMessage(message, adminId) {
  if (subscribers.size === 0) {
    bot.sendMessage(adminId, 'Нет подписчиков для рассылки.');
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let processed = 0;
  const total = subscribers.size;

  bot.sendMessage(adminId, `Начинаю рассылку для ${total} пользователей...`);

  subscribers.forEach((subscriberId) => {
    bot
      .sendMessage(subscriberId, `Рассылка от администратора:\n\n${message}`)
      .then(() => {
        successCount += 1;
      })
      .catch((err) => {
        failCount += 1;
        if (err.response && err.response.statusCode === 403) {
          subscribers.delete(subscriberId);
        }
      })
      .finally(() => {
        processed += 1;
        if (processed === total) {
          bot.sendMessage(
            adminId,
            'Результаты рассылки:\n\n' +
              `Успешно: ${successCount}\n` +
              `Не доставлено: ${failCount}\n` +
              `Осталось подписчиков: ${subscribers.size}`
          );
        }
      });
  });
}

function processSuggestion(msg) {
  const chatId = msg.chat.id;
  const user = msg.from;

  let userInfo = 'НОВОЕ ПРЕДЛОЖЕНИЕ\n';
  userInfo += `От: ${user.first_name || ''} ${user.last_name || ''}\n`;
  userInfo += `ID: ${user.id}\n`;
  if (user.username) userInfo += `@${user.username}\n`;
  userInfo += `Время: ${new Date().toLocaleString('ru-RU')}\n`;
  userInfo += `Подписан: ${subscribers.has(chatId) ? 'да' : 'нет'}`;

  let forwardMessage = userInfo;

  if (msg.text) {
    forwardMessage += `\n\nСообщение:\n${msg.text}`;
  } else if (msg.photo) {
    forwardMessage += '\n\nФото';
  } else if (msg.video) {
    forwardMessage += '\n\nВидео';
  } else if (msg.document) {
    forwardMessage += `\n\nДокумент: ${msg.document.file_name}`;
  } else if (msg.voice) {
    forwardMessage += '\n\nГолосовое сообщение';
  } else if (msg.sticker) {
    forwardMessage += '\n\nСтикер';
  } else {
    forwardMessage += '\n\nМедиа-файл';
  }

  const replyKeyboard = {
    inline_keyboard: [[{ text: 'Ответить', callback_data: `reply_${user.id}` }]],
  };

  if (adminChatId) {
    bot.sendMessage(adminChatId, forwardMessage, { reply_markup: replyKeyboard });
    if (!msg.text) {
      bot.forwardMessage(adminChatId, chatId, msg.message_id);
    }
  }

  bot.sendMessage(chatId, 'Спасибо! Предложение отправлено.');
  console.log(`Suggestion from ${user.first_name} (${user.id})`);
}

bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  if (data.startsWith('reply_') && msg.chat.id === adminChatId) {
    const targetUserId = data.split('_')[1];
    userStates.set(adminChatId, { mode: 'reply', targetUserId });

    bot.answerCallbackQuery(callbackQuery.id);
    bot.sendMessage(
      adminChatId,
      `Введите ответ для пользователя (ID: ${targetUserId}).\n/cancel — отмена`
    );
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code || error.message);
});

console.log('Proposal bot started.');
