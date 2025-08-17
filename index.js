// index.js
const TelegramBot = require("node-telegram-bot-api");

// === CONFIG ===
const BOT_TOKEN = process.env.BOT_TOKEN || "8389337410:AAEW5N2rbw2oYjhOfQaG62voVOcETb5t42I";
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const DAILY_LIMIT = 50;
const SPAM_INTERVAL = 5000; // 5 seconds between requests
const SPAM_MAX = 3; // max spam counts before freeze
const FREEZE_TIME = 60 * 60 * 1000; // 1 hour freeze

// User tracking
let userData = {}; // { userId: { count, lastRequest, spamCount, frozenUntil } }

let botUsername = "";

// Initialize bot username
bot.getMe().then((me) => {
  botUsername = me.username;
});

// Escape MarkdownV2 special characters
function escapeMDV2(text) {
  return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, "\\$1");
}

// Reset daily counts at midnight
setInterval(() => {
  for (let id in userData) {
    userData[id].count = 0;
    userData[id].spamCount = 0;
  }
}, 24 * 60 * 60 * 1000);

// === START / HELP ===
bot.onText(/^\/start|\/help/, (msg) => {
  const chatId = msg.chat.id;
  const name = escapeMDV2(msg.from.first_name || "friend");
  const welcome = `👋 Hello *${name}*!

✨ Use me to create AI images with *Pollinations AI*.

📌 Command:
/paint <prompt>

🎨 Example:
/paint a car 🚗

⚡ Daily limit: 50 images per user
🚫 Spammers are frozen for 1 hour

👨‍💻 Bot creator: @Nepomodz
Enjoy creating! 🌟`;

  bot.sendMessage(chatId, welcome, { parse_mode: "MarkdownV2" });
});

// === THANK ADMIN WHEN ADDED TO GROUP ===
bot.on("new_chat_members", (msg) => {
  msg.new_chat_members.forEach((member) => {
    if (member.username === botUsername) {
      bot.sendMessage(
        msg.chat.id,
        `🙏 Thanks *Admin* for adding me here!
I can now generate AI images using:
/paint <prompt> 🎨`,
        { parse_mode: "MarkdownV2" }
      );
    }
  });
});

// === /PAINT COMMAND ===
bot.onText(/^\/paint (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const prompt = match[1].trim();
  const safePrompt = escapeMDV2(prompt);
  const now = Date.now();

  // Initialize user data
  if (!userData[userId]) {
    userData[userId] = {
      count: 0,
      lastRequest: 0,
      spamCount: 0,
      frozenUntil: 0,
    };
  }

  const u = userData[userId];

  // Freeze check
  if (now < u.frozenUntil) {
    return bot.sendMessage(
      chatId,
      `⏳ You are frozen for spamming. Try again later.`
    );
  }

  // Spam detection
  if (now - u.lastRequest < SPAM_INTERVAL) {
    u.spamCount++;
  } else {
    u.spamCount = 0;
  }
  u.lastRequest = now;

  if (u.spamCount >= SPAM_MAX) {
    u.frozenUntil = now + FREEZE_TIME;
    return bot.sendMessage(
      chatId,
      `🚫 You are frozen for 1 hour due to spamming!`
    );
  }

  // Daily limit
  if (u.count >= DAILY_LIMIT) {
    return bot.sendMessage(
      chatId,
      `⚡ You have reached your daily limit of ${DAILY_LIMIT} images. Come back tomorrow!`,
      { parse_mode: "MarkdownV2" }
    );
  }

  u.count++;

  bot.sendMessage(
    chatId,
    `🎨 Generating your image for: *${safePrompt}* ...`,
    { parse_mode: "MarkdownV2" }
  );

  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}`;
    await bot.sendPhoto(chatId, imageUrl, {
      caption: `✨ Here’s your image for: *${safePrompt}*
⚡ (${u.count}/${DAILY_LIMIT} today)`,
      parse_mode: "MarkdownV2",
    });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Failed to generate image. Try again later.");
  }
});
