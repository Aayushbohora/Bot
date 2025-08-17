// index.js
const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

// === BOT CONFIG ===
const BOT_TOKEN = "8389337410:AAEW5N2rbw2oYjhOfQaG62voVOcETb5t42I"; // put your bot token here
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const DAILY_LIMIT = 50;
const SPAM_LIMIT = 5; // how many quick requests before freeze
const FREEZE_TIME = 60 * 60 * 1000; // 1 hour

// User tracking
let userUsage = {}; // { userId: { count, date, lastTime, spamCount, frozenUntil } }

// Reset usage daily
setInterval(() => { userUsage = {}; }, 24 * 60 * 60 * 1000);

// === START HANDLER ===
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `👋 Hello *${msg.from.first_name || "friend"}*!  

✨ Use me to create AI images with *Pollinations AI*!  

📌 Command:  
\`/paint <prompt>\`  

🎨 Example:  
\`/paint a car 🚗\`  

⚡ *Limit*: 50 images per day per user  
🚫 Spammers will be frozen for 1 hour`,
    { parse_mode: "Markdown" }
  );
});

// === THANK ADMIN WHEN ADDED TO GROUP ===
bot.on("new_chat_members", (msg) => {
  const newMembers = msg.new_chat_members;
  newMembers.forEach((member) => {
    if (member.username === bot.me?.username) {
      bot.sendMessage(
        msg.chat.id,
        `🙏 Thanks *Admin* for adding me here!  
I can now generate AI images with:  
\`/paint <prompt>\` 🎨`,
        { parse_mode: "Markdown" }
      );
    }
  });
});

// === PAINT HANDLER ===
bot.onText(/\/paint (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const prompt = match[1].trim();

  // Track user usage
  if (!userUsage[userId]) {
    userUsage[userId] = {
      count: 0,
      date: new Date().toDateString(),
      lastTime: 0,
      spamCount: 0,
      frozenUntil: 0,
    };
  }
  const userData = userUsage[userId];

  // Spam check
  const now = Date.now();
  if (now - userData.lastTime < 5000) {
    userData.spamCount++;
  } else {
    userData.spamCount = 0;
  }
  userData.lastTime = now;

  if (userData.spamCount >= SPAM_LIMIT) {
    userData.frozenUntil = now + FREEZE_TIME;
    return bot.sendMessage(
      chatId,
      `🚫 ${msg.from.first_name}, you are frozen for spamming. Try again after 1 hour.`
    );
  }

  if (userData.frozenUntil > now) {
    return bot.sendMessage(
      chatId,
      `⏳ You are frozen. Please wait until your freeze time ends.`
    );
  }

  // Daily limit check
  if (userData.date !== new Date().toDateString()) {
    userData.count = 0;
    userData.date = new Date().toDateString();
  }
  if (userData.count >= DAILY_LIMIT) {
    return bot.sendMessage(
      chatId,
      `⚡ You have reached your *daily limit* of ${DAILY_LIMIT} images. Come back tomorrow!`,
      { parse_mode: "Markdown" }
    );
  }

  userData.count++;

  // Fetch Pollinations image
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}`;

  bot.sendMessage(chatId, `🎨 Generating your image for: *${prompt}* ...`, {
    parse_mode: "Markdown",
  });

  try {
    await bot.sendPhoto(chatId, imageUrl, {
      caption: `✨ Here’s your image for: *${prompt}*  
⚡ (${userData.count}/${DAILY_LIMIT} today)`,
      parse_mode: "Markdown",
    });
  } catch (err) {
    bot.sendMessage(chatId, "❌ Failed to generate image. Try again later.");
  }
});
