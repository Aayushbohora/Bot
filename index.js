// index.js
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");

// === CONFIG ===
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const DAILY_LIMIT = 50;
const SPAM_INTERVAL = 3000; // 3 seconds between requests
const FROZEN_TIME = 60 * 60 * 1000; // 1 hour freeze

// Store user data { userId: { date, count, lastRequest, frozenUntil } }
let userLimits = {};
const LIMITS_FILE = "limits.json";

// Load saved limits if file exists
if (fs.existsSync(LIMITS_FILE)) {
  userLimits = JSON.parse(fs.readFileSync(LIMITS_FILE));
}

// Save limits every minute
setInterval(() => {
  fs.writeFileSync(LIMITS_FILE, JSON.stringify(userLimits));
}, 60 * 1000);

// Reset limits daily
function resetDailyLimits() {
  userLimits = {};
}
setInterval(resetDailyLimits, 24 * 60 * 60 * 1000);

// Escape markdown special chars
function escapeMarkdown(text) {
  return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, "\\$1");
}

// Start / Help message
const welcomeMessage = `👋 *Welcome to PIXi* 🎨  

I turn your imagination into AI-generated art!  

✨ How to use:
/paint <your idea>  

📌 Example:
/paint a car 🚗  

⚡ *Daily limit:* 50 images per user  
🚫 Spamming will freeze your access for a while!  

👨‍💻 Bot creator: @Nepomodz  

Enjoy creating! 🌟`;

bot.onText(/^\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: "Markdown" });
});

bot.onText(/^\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: "Markdown" });
});

// Auto-thank when bot is added to group
bot.on("new_chat_members", (msg) => {
  msg.new_chat_members.forEach((member) => {
    if (member.id === bot.botInfo.id) {
      bot.sendMessage(
        msg.chat.id,
        `🙏 Thanks *${msg.chat.title}* admins for inviting me here!  
Use /paint <prompt> to start creating awesome AI art ✨`,
        { parse_mode: "Markdown" },
      );
    }
  });
});

// Handle /paint command
bot.onText(/^\/paint (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const prompt = match[1];
  const safePrompt = escapeMarkdown(prompt);

  const today = new Date().toISOString().split("T")[0];
  if (!userLimits[userId] || userLimits[userId].date !== today) {
    userLimits[userId] = {
      date: today,
      count: 0,
      lastRequest: 0,
      frozenUntil: 0,
    };
  }

  const userData = userLimits[userId];

  // Check freeze
  if (Date.now() < userData.frozenUntil) {
    bot.sendMessage(
      chatId,
      `❌ You are temporarily frozen due to spamming.\n⏳ Try again later.`,
    );
    return;
  }

  // Spam check
  if (Date.now() - userData.lastRequest < SPAM_INTERVAL) {
    userData.frozenUntil = Date.now() + FROZEN_TIME;
    bot.sendMessage(
      chatId,
      `🚫 Too many requests too quickly!\nYou are frozen for 1 hour.`,
    );
    return;
  }

  // Daily limit check
  if (userData.count >= DAILY_LIMIT) {
    bot.sendMessage(
      chatId,
      "⚠️ You’ve reached your daily limit of 50 images. Come back tomorrow!",
    );
    return;
  }

  userData.lastRequest = Date.now();

  bot.sendMessage(chatId, `🎨 Creating masterpiece for: *${safePrompt}* ...`, {
    parse_mode: "MarkdownV2",
  });

  try {
    const response = await axios.get(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
      {
        responseType: "arraybuffer",
      },
    );

    userData.count++;

    bot.sendPhoto(chatId, response.data, {
      caption: `✅ Art created for: *${safePrompt}*\n\n🌟 Remaining today: ${
        DAILY_LIMIT - userData.count
      }`,
      parse_mode: "MarkdownV2",
    });
  } catch (err) {
    console.error(err);
    bot.sendMessage(
      chatId,
      "❌ Failed to generate image. Please try again later.",
    );
  }
});
