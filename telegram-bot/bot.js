// --- 1. Load All Our Tools ---
require('dotenv').config(); // Load .env file
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { translate } = require('@vitalets/google-translate-api');
const { setupDatabase, getDb } = require('./database.js');

// --- 2. SETUP KEYS ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8076590477:AAHKRo3APLjLwhVPfeH_5pP8m9PBVFFXtoE';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDr_Y99vNYXucDLVvPiD6AebKghw8wYoWQ';

// --- 3. Setup AI and Bot ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const userCache = {}; 

// --- 4. STATIC TRANSLATIONS (The Fix for "Too Many Requests") ---
// We look these up locally instead of asking Google every time.
const STATIC_TRANSLATIONS = {
  en: {
    generic_header: "Generic Name:",
    ingredient_header: "Active Ingredient:",
    btn_use: "Show Common Use",
    btn_warn: "Show AI Warnings",
    btn_hide: "Hide Details",
    btn_save: "Save to Cabinet 💾",
    saved_msg: "Saved to your cabinet!",
    cabinet_header: "📂 Your Medicine Cabinet:",
    cabinet_empty: "Your cabinet is empty. Save a drug after searching!",
    loading: "Loading...",
    ai_analyzing: "🧠 AI is analyzing...",
    error_search: "Sorry, search expired. Please search again.",
    not_found: "❌ Sorry, I could not find any information for",
    found_matches: "🔎 I found multiple matches. Which did you mean?"
  },
  es: {
    generic_header: "Nombre Genérico:",
    ingredient_header: "Ingrediente Activo:",
    btn_use: "Ver Uso Común",
    btn_warn: "Ver Advertencias IA",
    btn_hide: "Ocultar Detalles",
    btn_save: "Guardar en Botiquín 💾",
    saved_msg: "¡Guardado en tu botiquín!",
    cabinet_header: "📂 Tu Botiquín:",
    cabinet_empty: "Tu botiquín está vacío. ¡Guarda un medicamento después de buscar!",
    loading: "Cargando...",
    ai_analyzing: "🧠 IA analizando...",
    error_search: "Lo siento, la búsqueda expiró. Busca de nuevo.",
    not_found: "❌ Lo siento, no encontré información para",
    found_matches: "🔎 Encontré varias coincidencias. ¿Cuál querías decir?"
  },
  fr: {
    generic_header: "Nom Générique:",
    ingredient_header: "Ingrédient Actif:",
    btn_use: "Voir Usage Courant",
    btn_warn: "Voir Avertissements IA",
    btn_hide: "Masquer Détails",
    btn_save: "Sauvegarder 💾",
    saved_msg: "Sauvegardé dans votre armoire !",
    cabinet_header: "📂 Votre Armoire à Pharmacie :",
    cabinet_empty: "Votre armoire est vide.",
    loading: "Chargement...",
    ai_analyzing: "🧠 IA analyse...",
    error_search: "Désolé, recherche expirée.",
    not_found: "❌ Désolé, aucune info trouvée pour",
    found_matches: "🔎 J'ai trouvé plusieurs correspondances."
  },
  hi: {
    generic_header: "जेनेरिक नाम:",
    ingredient_header: "सक्रिय सामग्री:",
    btn_use: "सामान्य उपयोग देखें",
    btn_warn: "AI चेतावनी देखें",
    btn_hide: "विवरण छुपाएं",
    btn_save: "कैबिनेट में सहेजें 💾",
    saved_msg: "आपकी कैबिनेट में सहेज लिया गया!",
    cabinet_header: "📂 आपकी दवा कैबिनेट:",
    cabinet_empty: "आपकी कैबिनेट खाली है।",
    loading: "लोड हो रहा है...",
    ai_analyzing: "🧠 AI विश्लेषण कर रहा है...",
    error_search: "क्षमा करें, खोज समाप्त हो गई।",
    not_found: "❌ क्षमा करें, इसके लिए कोई जानकारी नहीं मिली:",
    found_matches: "🔎 मुझे कई परिणाम मिले। आपका क्या मतलब था?"
  }
};

// Helper to get static text safely
function getUIText(lang, key) {
  const selectedLang = STATIC_TRANSLATIONS[lang] || STATIC_TRANSLATIONS['en'];
  return selectedLang[key] || STATIC_TRANSLATIONS['en'][key];
}

// --- 5. Helper Function: Get Drug Data ---
async function getDrugDataFromFDA(drugName) {
  const term = drugName.toLowerCase().trim();
  const cleanTerm = term.replace(/ /g, "+");
  const fdaURL = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${cleanTerm}"+OR+openfda.generic_name:"${cleanTerm}"&limit=5`;
  
  try {
    const response = await axios.get(fdaURL);
    if (response.data.results && response.data.results.length > 0) return response.data.results;
    return []; 
  } catch (error) {
    if (error.response && error.response.status === 404) {
        try {
            const backupURL = `https://api.fda.gov/drug/label.json?search="${cleanTerm}"&limit=5`;
            const backupResponse = await axios.get(backupURL);
            return backupResponse.data.results || [];
        } catch (backupError) { return []; }
    }
    return [];
  }
}

// --- 6. Helper: Get One Drug by ID ---
async function getDrugByID(id) {
  try {
    const fdaURL = `https://api.fda.gov/drug/label.json?search=id:"${id}"&limit=1`;
    const response = await axios.get(fdaURL);
    if (response.data.results && response.data.results.length > 0) return response.data.results[0];
  } catch (error) { console.error('FDA ID Error:', error.message); }
  return null;
}

// --- 7. Helper: AI Summarizers ---
async function getAIWarningSummary(warnings) {
  if (!warnings || warnings.toLowerCase() === 'not found') return "No specific warnings available.";
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Summarize the following complex "Warnings" text into 3 simple, easy-to-understand bullet points with emojis: "${warnings.substring(0, 5000)}"`;
    const result = await model.generateContent(prompt);
    return (await result.response).text();
  } catch (error) { return "Could not summarize warnings."; }
}

async function getAICommonUseSummary(usageText) {
  if (!usageText || usageText.toLowerCase() === 'not found') return "No common use information available.";
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Summarize the following "Common Use" text into simple bullet points with emojis: "${usageText.substring(0, 5000)}"`;
    const result = await model.generateContent(prompt);
    return (await result.response).text();
  } catch (error) { return usageText; }
}

// --- 8. Helper: Translator (Safe Mode) ---
async function translateText(text, targetLang) {
  if (!text || targetLang === 'en') return text;
  // Add a small delay to prevent rate limiting
  await new Promise(resolve => setTimeout(resolve, 500)); 
  try {
    const result = await translate(text, { to: targetLang });
    return result.text;
  } catch (error) { return text; }
}

// --- 9. Bot Commands ---

// START
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const photoUrl = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80';
  const caption = `
👋 *Welcome to DrugInfoBot!* 🤖

I am your AI-powered medical assistant.
I can help you find:
✅ *Official Uses*
⚠️ *Safety Warnings*
💊 *Active Ingredients*

_Type a medicine name below to begin!_
  `;

  bot.sendPhoto(chatId, photoUrl, {
    caption: caption,
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [[{ text: '/help' }, { text: '/language' }], [{ text: '/mymeds' }]],
      resize_keyboard: true, persistent: true,
    },
  });
});

// HELP
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
*Help & Commands* ⚙️

1. 🔎 *Search:* Type any drug name (e.g., *Advil*).
2. 💾 *Save:* Build your digital medicine cabinet.
3. 🌐 *Language:* Click /language to switch.
4. 📝 *Feedback:* Type \`/feedback [message]\` to send us suggestions.

_Need to share this bot?_
  `;
  bot.sendMessage(chatId, helpMessage, { 
    parse_mode: 'Markdown', 
    reply_markup: {
      inline_keyboard: [[{ text: '🚀 Share with Friends', switch_inline_query: '' }]]
    }
  });
});

// FEEDBACK
bot.onText(/\/feedback (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];
  const db = getDb();
  await db.run('INSERT INTO feedback (chatId, message, date) VALUES (?, ?, ?)', [chatId, text, new Date().toISOString()]);
  bot.sendMessage(chatId, "✅ *Thank you!* Your feedback has been recorded.", { parse_mode: 'Markdown' });
});

bot.onText(/\/language/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Please choose your language:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🇺🇸 English', callback_data: 'lang_en' }, { text: '🇪🇸 Español', callback_data: 'lang_es' }],
        [{ text: '🇫🇷 Français', callback_data: 'lang_fr' }, { text: '🇮🇳 Hindi', callback_data: 'lang_hi' }],
      ],
    },
  });
});

bot.onText(/\/mymeds/, async (msg) => {
  const chatId = msg.chat.id;
  const db = getDb();
  // DB Fix: Ensure we check if the user exists or default to en
  const userRecord = await db.get('SELECT language FROM users WHERE chatId = ?', [chatId]);
  const lang = userRecord ? userRecord.language : 'en';

  const meds = await db.all('SELECT drugName, drugId FROM medications WHERE chatId = ?', [chatId]);
  
  if (!meds || meds.length === 0) {
    bot.sendMessage(chatId, getUIText(lang, 'cabinet_empty'));
    return;
  }
  
  const medButtons = meds.map(med => [{ text: `💊 ${med.drugName}`, callback_data: `select_${med.drugId}` }]);
  const header = getUIText(lang, 'cabinet_header');
  bot.sendMessage(chatId, header, { reply_markup: { inline_keyboard: medButtons } });
});

// --- 10. Main Search Logic ---
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  const drugName = msg.text;
  if (drugName.startsWith('/')) return;

  const greetings = ['hello', 'hi', 'hey', 'good morning', 'namaste'];
  if (greetings.includes(drugName.toLowerCase())) {
    return bot.sendMessage(chatId, "👋 Hello! Please type a medicine name to search.");
  }

  bot.sendChatAction(chatId, 'typing');
  const db = getDb();
  await db.run('INSERT OR IGNORE INTO users (chatId) VALUES (?)', [chatId]);
  const userRecord = await db.get('SELECT language FROM users WHERE chatId = ?', [chatId]);
  const lang = userRecord ? userRecord.language : 'en';

  const results = await getDrugDataFromFDA(drugName);

  if (results.length === 0) {
    const msg = `${getUIText(lang, 'not_found')} "${drugName}".`;
    bot.sendMessage(chatId, msg);
  } else if (results.length === 1) {
    await sendInteractiveMenu(chatId, results[0], lang);
  } else {
    const header = getUIText(lang, 'found_matches');
    const buttons = results.map(d => {
       const name = (d.openfda.brand_name ? d.openfda.brand_name[0] : "Drug").substring(0, 30);
       return [{ text: name, callback_data: `select_${d.id}` }];
    });
    bot.sendMessage(chatId, header, { reply_markup: { inline_keyboard: buttons } });
  }
});

// --- 11. Button Handler ---
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const db = getDb();
  const userRecord = await db.get('SELECT language FROM users WHERE chatId = ?', [chatId]);
  const lang = userRecord ? userRecord.language : 'en';

  if (data.startsWith('lang_')) {
    const newLang = data.split('_')[1];
    await db.run('INSERT INTO users (chatId, language) VALUES (?, ?) ON CONFLICT(chatId) DO UPDATE SET language = ?', [chatId, newLang, newLang]);
    bot.sendMessage(chatId, `✅ Language updated.`);
    bot.answerCallbackQuery(query.id);
  }

  if (data.startsWith('select_')) {
    const drugId = data.split('_')[1];
    bot.answerCallbackQuery(query.id, { text: getUIText(lang, 'loading') });
    const drugData = await getDrugByID(drugId);
    if (drugData) await sendInteractiveMenu(chatId, drugData, lang);
  }

  if (data.startsWith('show_')) {
    // "Toast" Notification
    bot.answerCallbackQuery(query.id, { text: getUIText(lang, 'ai_analyzing'), show_alert: false });
    await handleShowButton(query);
  }

  if (data.startsWith('save_')) {
    const drugId = data.split('_')[1];
    const drugData = userCache[chatId];
    if (drugData && drugData.id === drugId) {
       const drugName = drugData.openfda.brand_name ? drugData.openfda.brand_name[0] : "Unknown";
       try {
         await db.run('INSERT INTO medications (chatId, drugName, drugId) VALUES (?, ?, ?)', [chatId, drugName, drugId]);
         const msg = getUIText(lang, 'saved_msg');
         bot.answerCallbackQuery(query.id, { text: msg });
       } catch (e) {
         bot.answerCallbackQuery(query.id, { text: "Already Saved" });
       }
    } else {
       bot.answerCallbackQuery(query.id, { text: getUIText(lang, 'error_search') });
    }
  }
});

// --- 12. Function: Send Interactive Menu ---
async function sendInteractiveMenu(chatId, drugData, lang) {
  bot.sendChatAction(chatId, 'typing'); 

  const brandName = drugData.openfda.brand_name ? drugData.openfda.brand_name[0] : "Unknown";
  const genericName = drugData.openfda.generic_name ? drugData.openfda.generic_name[0] : "Not Found";
  const activeIngredient = drugData.active_ingredient ? drugData.active_ingredient[0] : "Not Found";

  // Pre-load AI Summaries
  const warnings = drugData.warnings ? drugData.warnings[0] : "Not Found";
  const use = drugData.indications_and_usage ? drugData.indications_and_usage[0] : "Not Found";

  // We only translate the DYNAMIC data (Drug name/ingredient) via API
  // Buttons and Headers come from our STATIC Dictionary
  const [t_generic, t_ingredient] = await Promise.all([
    translateText(genericName, lang),
    translateText(activeIngredient, lang)
  ]);

  // We do NOT translate the brand name usually as it is a proper noun, but you can if you want.
  
  const [aiWarningSummary, aiUseSummary] = await Promise.all([
    getAIWarningSummary(warnings),
    getAICommonUseSummary(use)
  ]);

  userCache[chatId] = {
    ...drugData, 
    aiWarningSummary, 
    aiUseSummary      
  };

  // Use Dictionary for headers
  const header_generic = getUIText(lang, 'generic_header');
  const header_ingredient = getUIText(lang, 'ingredient_header');

  const baseMessage = `
💊 *${brandName}*
_${header_generic} ${t_generic}_

🧪 *${header_ingredient}*
\`${t_ingredient}\`

👇 *Select an option:*
  `;
  
  // Use Dictionary for Buttons
  const btn_use = getUIText(lang, 'btn_use');
  const btn_warn = getUIText(lang, 'btn_warn');
  const btn_hide = getUIText(lang, 'btn_hide');
  const btn_save = getUIText(lang, 'btn_save');

  const inlineKeyboard = {
    inline_keyboard: [
      [{ text: btn_use, callback_data: 'show_use' }, { text: btn_warn, callback_data: 'show_warn' }],
      [{ text: btn_save, callback_data: `save_${drugData.id}` }],
      [{ text: btn_hide, callback_data: 'show_hide' }]
    ]
  };

  bot.sendMessage(chatId, baseMessage, {
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  });
}

// --- 13. Function: Handle Interactive Button Clicks ---
async function handleShowButton(query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const buttonType = query.data;
  const db = getDb();
  const userRecord = await db.get('SELECT language FROM users WHERE chatId = ?', [chatId]);
  const lang = userRecord ? userRecord.language : 'en';

  const drugData = userCache[chatId]; 
  if (!drugData) {
    bot.sendMessage(chatId, getUIText(lang, 'error_search'));
    return;
  }

  // Reconstruct base message (similar to sendInteractiveMenu)
  const brandName = drugData.openfda.brand_name ? drugData.openfda.brand_name[0] : "Unknown";
  const genericName = drugData.openfda.generic_name ? drugData.openfda.generic_name[0] : "Not Found";
  const activeIngredient = drugData.active_ingredient ? drugData.active_ingredient[0] : "Not Found";

  const [t_generic, t_ingredient] = await Promise.all([
    translateText(genericName, lang),
    translateText(activeIngredient, lang)
  ]);

  const header_generic = getUIText(lang, 'generic_header');
  const header_ingredient = getUIText(lang, 'ingredient_header');

  let baseMessage = `
💊 *${brandName}*
_${header_generic} ${t_generic}_

🧪 *${header_ingredient}*
\`${t_ingredient}\`

👇 *Select an option:*
  `;
  
  let extraInfo = "";

  if (buttonType === 'show_use') {
    const translatedContent = await translateText(drugData.aiUseSummary, lang);
    extraInfo = `\n\n✅ *Common Use:*\n${translatedContent}`;
  } else if (buttonType === 'show_warn') {
    const translatedContent = await translateText(drugData.aiWarningSummary, lang);
    extraInfo = `\n\n⚠️ *Warnings:*\n${translatedContent}`;
  } 

  // Use Dictionary for Buttons
  const btn_use = getUIText(lang, 'btn_use');
  const btn_warn = getUIText(lang, 'btn_warn');
  const btn_hide = getUIText(lang, 'btn_hide');
  const btn_save = getUIText(lang, 'btn_save');

  const inlineKeyboard = {
    inline_keyboard: [
      [{ text: btn_use, callback_data: 'show_use' }, { text: btn_warn, callback_data: 'show_warn' }],
      [{ text: btn_save, callback_data: `save_${drugData.id}` }],
      [{ text: btn_hide, callback_data: 'show_hide' }]
    ]
  };

  bot.editMessageText(baseMessage + extraInfo, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: inlineKeyboard
  }).catch((err) => {
    // Ignore edit errors
  });
}

// --- 14. Start the Bot ---
async function startBot() {
  try {
    await setupDatabase(); 
    console.log('Bot is running with Database and ALL features!');
  } catch (e) {
    console.error('Failed to start bot:', e);
    process.exit(1);
  }
}

startBot();