const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = '8407119460:AAHfNWjQojYn6JpbA_WmznRimybUfndU424';
const YOUR_USERNAME = 'Andrey720p';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Хранилища данных
let adminChatId = null;
const userLastMessage = new Map(); // Для антиспама
const subscribers = new Set(); // Для рассылки
const userStates = new Map(); // Для состояний пользователей

// Антиспам - проверка временного интервала
function isSpam(userId) {
  const lastMessageTime = userLastMessage.get(userId);
  const now = Date.now();
  
  if (lastMessageTime && (now - lastMessageTime) < 10000) { // 10 секунд
    return true;
  }
  
  userLastMessage.set(userId, now);
  return false;
}

// Команда старт
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  if (user.username === YOUR_USERNAME) {
    adminChatId = chatId;
    bot.sendMessage(chatId, 
      `👑 Режим администратора активирован!\n\n` +
      `Доступные команды:\n` +
      `📊 /stats - статистика\n` +
      `📢 /broadcast - рассылка\n` +
      `👥 /subscribers - список подписчиков`
    );
  } else {
    const welcomeText = 
      `👋 Привет, ${user.first_name}!\n\n` +
      `Это бот-предложка. Ты можешь:\n` +
      `💬 Отправить текст, фото, видео или файлы\n` +
      `📰 /subscribe - подписаться на рассылку\n` +
      `❓ /help - помощь\n\n` +
      `Просто напиши или отправь что-нибудь!`;
    
    bot.sendMessage(chatId, welcomeText);
  }
});

// Команда подписки на рассылку
bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  if (subscribers.has(chatId)) {
    bot.sendMessage(chatId, '✅ Вы уже подписаны на рассылку!');
    return;
  }
  
  subscribers.add(chatId);
  bot.sendMessage(chatId, 
    `📰 Вы успешно подписались на рассылку!\n\n` +
    `Теперь вы будете получать важные объявления и новости от администратора.`
  );
  
  // Уведомляем админа о новой подписке
  if (adminChatId) {
    bot.sendMessage(adminChatId, 
      `🆕 Новый подписчик!\n` +
      `👤 ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}\n` +
      `🆔 ID: ${user.id}\n` +
      `📱 @${user.username || 'нет username'}\n` +
      `👥 Всего подписчиков: ${subscribers.size}`
    );
  }
});

// Команда отписки от рассылки
bot.onText(/\/unsubscribe/, (msg) => {
  const chatId = msg.chat.id;
  
  if (subscribers.has(chatId)) {
    subscribers.delete(chatId);
    bot.sendMessage(chatId, '❌ Вы отписались от рассылки.');
  } else {
    bot.sendMessage(chatId, 'ℹ️ Вы не были подписаны на рассылку.');
  }
});

// Команда помощи
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    `❓ Как пользоваться ботом:\n\n` +
    `• Просто отправь сообщение - оно придёт админу\n` +
    `• Можно отправлять текст, фото, видео, файлы\n` +
    `• Антиспам: 1 сообщение в 10 секунд\n` +
    `• /subscribe - подписаться на новости\n` +
    `• /unsubscribe - отписаться от новостей`
  );
});

// ИСПРАВЛЕННАЯ КОМАНДА СТАТИСТИКИ
bot.onText(/\/stats/, async (msg) => {
  if (msg.from.username !== YOUR_USERNAME) return;
  
  try {
    // Получаем информацию о боте
    const botInfo = await bot.getMe();
    
    // Получаем количество участников чата с ботом
    const membersCount = await bot.getChatMembersCount(botInfo.id);
    
    // Статистика
    const statsMessage = 
      `📊 Статистика бота:\n\n` +
      `👥 Всего пользователей: ${membersCount}\n` +
      `📰 Подписчиков рассылки: ${subscribers.size}\n` +
      `⏰ Время работы: ${Math.floor(process.uptime() / 60)} минут\n` +
      `📈 Активных сессий: ${userLastMessage.size}`;
    
    bot.sendMessage(msg.chat.id, statsMessage);
    
  } catch (error) {
    console.log('Ошибка при получении статистики:', error);
    
    // Альтернативная статистика если API не доступно
    const fallbackStats = 
      `📊 Статистика бота:\n\n` +
      `📰 Подписчиков рассылки: ${subscribers.size}\n` +
      `⏰ Время работы: ${Math.floor(process.uptime() / 60)} минут\n` +
      `📈 Активных сессий: ${userLastMessage.size}\n\n` +
      `ℹ️ Некоторые данные могут быть неполными`;
    
    bot.sendMessage(msg.chat.id, fallbackStats);
  }
});

// Список подписчиков для админа
bot.onText(/\/subscribers/, (msg) => {
  if (msg.from.username !== YOUR_USERNAME) return;
  
  if (subscribers.size === 0) {
    bot.sendMessage(msg.chat.id, '❌ Нет подписчиков на рассылку.');
    return;
  }
  
  let subscribersList = `📰 Список подписчиков (${subscribers.size}):\n\n`;
  
  // Получаем информацию о каждом подписчике
  let count = 0;
  const subscriberIds = Array.from(subscribers);
  
  function getNextSubscriber() {
    if (count >= subscriberIds.length) return;
    
    const subId = subscriberIds[count];
    bot.getChat(subId).then(chat => {
      subscribersList += `${count + 1}. ${chat.first_name || 'Пользователь'} (ID: ${chat.id})`;
      if (chat.username) subscribersList += ` @${chat.username}`;
      subscribersList += '\n';
      
      count++;
      if (count < subscriberIds.length) {
        getNextSubscriber();
      } else {
        bot.sendMessage(msg.chat.id, subscribersList);
      }
    }).catch(err => {
      subscribersList += `${count + 1}. Не удалось получить данные (ID: ${subId})\n`;
      count++;
      if (count < subscriberIds.length) {
        getNextSubscriber();
      } else {
        bot.sendMessage(msg.chat.id, subscribersList);
      }
    });
  }
  
  getNextSubscriber();
});

// Рассылка для админа
bot.onText(/\/broadcast/, (msg) => {
  if (msg.from.username !== YOUR_USERNAME) return;
  
  userStates.set(msg.chat.id, { mode: 'broadcast' });
  bot.sendMessage(msg.chat.id, 
    `📢 Режим рассылки\n\n` +
    `Введите сообщение для отправки ${subscribers.size} подписчикам:\n\n` +
    `❌ Отправьте /cancel для отмены`
  );
});

// Отмена действий
bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  
  if (userStates.has(chatId)) {
    userStates.delete(chatId);
    bot.sendMessage(chatId, '❌ Действие отменено.');
  }
});

// Ответ на предложения для админа
bot.onText(/\/reply_(.+)/, (msg, match) => {
  if (msg.from.username !== YOUR_USERNAME) return;
  
  const targetUserId = match[1];
  userStates.set(msg.chat.id, { mode: 'reply', targetUserId });
  bot.sendMessage(msg.chat.id, 
    `💬 Введите ответ для пользователя ${targetUserId}:\n\n` +
    `❌ /cancel - отмена`
  );
});

// Обработка всех сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  // Игнорируем команды
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  // Режим ответа от админа
  if (user.username === YOUR_USERNAME && userStates.has(chatId)) {
    const state = userStates.get(chatId);
    
    if (state.mode === 'reply') {
      bot.sendMessage(state.targetUserId, 
        `📨 Ответ от администратора:\n\n${msg.text}`
      );
      bot.sendMessage(chatId, '✅ Ответ отправлен пользователю!');
      userStates.delete(chatId);
      return;
    }
    
    if (state.mode === 'broadcast') {
      broadcastMessage(msg.text, chatId);
      userStates.delete(chatId);
      return;
    }
  }
  
  // Если сообщение от админа без специального режима
  if (user.username === YOUR_USERNAME) {
    bot.sendMessage(chatId, 'ℹ️ Используйте команды для управления ботом');
    return;
  }
  
  // Проверка антиспама
  if (isSpam(user.id)) {
    bot.sendMessage(chatId, 
      `⏰ Слишком часто! Можно отправлять 1 сообщение в 10 секунд.\n` +
      `Пожалуйста, подождите немного.`
    );
    return;
  }
  
  // Обработка предложений от пользователей
  processSuggestion(msg);
});

// Функция рассылки
function broadcastMessage(message, adminChatId) {
  if (subscribers.size === 0) {
    bot.sendMessage(adminChatId, '❌ Нет подписчиков для рассылки.');
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  let processed = 0;
  
  bot.sendMessage(adminChatId, `📢 Начинаю рассылку для ${subscribers.size} пользователей...`);
  
  subscribers.forEach(subscriberId => {
    bot.sendMessage(subscriberId, 
      `📢 Рассылка от администратора:\n\n${message}`
    ).then(() => {
      successCount++;
    }).catch(err => {
      failCount++;
      // Если пользователь заблокировал бота, удаляем из подписчиков
      if (err.response && err.response.statusCode === 403) {
        subscribers.delete(subscriberId);
      }
    }).finally(() => {
      processed++;
      
      // Когда все сообщения обработаны, отправляем отчет
      if (processed === subscribers.size) {
        bot.sendMessage(adminChatId,
          `📢 Результаты рассылки:\n\n` +
          `✅ Успешно: ${successCount}\n` +
          `❌ Не доставлено: ${failCount}\n` +
          `👥 Осталось подписчиков: ${subscribers.size}`
        );
      }
    });
  });
}

// Обработка предложений от пользователей
function processSuggestion(msg) {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  // Формируем информацию о пользователе
  let userInfo = `🎯 НОВОЕ ПРЕДЛОЖЕНИЕ\n┌─────────────────\n`;
  userInfo += `│ 👤 От: ${user.first_name || ''} ${user.last_name || ''}\n`;
  userInfo += `│ 🆔 ID: ${user.id}\n`;
  if (user.username) userInfo += `│ 📱 @${user.username}\n`;
  userInfo += `│ 🕐 ${new Date().toLocaleString('ru-RU')}\n`;
  userInfo += `│ 📰 Подписан: ${subscribers.has(chatId) ? '✅' : '❌'}\n`;
  userInfo += `└─────────────────`;
  
  let forwardMessage = userInfo;
  
  // Обработка разных типов сообщений
  if (msg.text) {
    forwardMessage += `\n\n💬 Сообщение:\n${msg.text}`;
  } else if (msg.photo) {
    forwardMessage += `\n\n🖼 Фото`;
  } else if (msg.video) {
    forwardMessage += `\n\n🎥 Видео`;
  } else if (msg.document) {
    forwardMessage += `\n\n📄 Документ: ${msg.document.file_name}`;
  } else if (msg.voice) {
    forwardMessage += `\n\n🎤 Голосовое сообщение`;
  } else if (msg.sticker) {
    forwardMessage += `\n\n😊 Стикер`;
  } else {
    forwardMessage += `\n\n📎 Медиа-файл`;
  }
  
  // Кнопка для ответа
  const replyKeyboard = {
    inline_keyboard: [[
      {
        text: '💬 Ответить',
        callback_data: `reply_${user.id}`
      }
    ]]
  };
  
  // Отправляем админу
  if (adminChatId) {
    bot.sendMessage(adminChatId, forwardMessage, {
      reply_markup: replyKeyboard
    });
    
    // Пересылаем медиа-файлы
    if (!msg.text) {
      bot.forwardMessage(adminChatId, chatId, msg.message_id);
    }
  }
  
  // Подтверждение пользователю
  bot.sendMessage(chatId, 
    `✅ Спасибо! Ваше предложение отправлено!\n\n` +
    `Мы рассмотрим его в ближайшее время.`
  );
  
  // Логируем в консоль
  console.log(`Новое предложение от ${user.first_name} (ID: ${user.id}) в ${new Date().toLocaleString()}`);
}

// Обработка callback кнопок
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  
  if (data.startsWith('reply_') && msg.chat.id === adminChatId) {
    const targetUserId = data.split('_')[1];
    userStates.set(adminChatId, { mode: 'reply', targetUserId });
    
    bot.answerCallbackQuery(callbackQuery.id);
    bot.sendMessage(adminChatId, 
      `💬 Введите ответ для пользователя (ID: ${targetUserId}):\n\n` +
      `❌ /cancel - отмена`
    );
  }
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.log('Ошибка polling:', error.code);
});

console.log('🚀 Бот запущен с антиспамом и рассылкой!');
