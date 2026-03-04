// --- 1. Load All Our Tools ---
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { translate } = require('@vitalets/google-translate-api');
const { setupDatabase, getDb } = require('./database.js');

// --- 2. SETUP KEYS FROM ENVIRONMENT ---
require('dotenv').config(); // Load .env file
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;


// --- 3. Setup AI and Bot ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// This cache holds data to make buttons fast
const userCache = {}; 

// --- 4. Helper Function: Get Drug Data (FIXED SEARCH) ---
async function getDrugDataFromFDA(drugName) {
  const term = drugName.toLowerCase().trim();
  const cleanTerm = term.replace(/ /g, "+");
  
  // Search for brand OR generic name
  const fdaURL = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${cleanTerm}"+OR+openfda.generic_name:"${cleanTerm}"&limit=5`;
  
  try {
    const response = await axios.get(fdaURL);
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results; 
    } else {
      return []; 
    }
  } catch (error) {
    // Backup search if specific search fails
    if (error.response && error.response.status === 404) {
        try {
            const backupURL = `https://api.fda.gov/drug/label.json?search="${cleanTerm}"&limit=5`;
            const backupResponse = await axios.get(backupURL);
            return backupResponse.data.results || [];
        } catch (backupError) {
            return [];
        }
    }
    console.error('FDA Error:', error.message);
    return [];
  }
}

// --- 5. Helper Function: Get One Drug by ID ---
async function getDrugByID(id) {
  try {
    const fdaURL = `https://api.fda.gov/drug/label.json?search=id:"${id}"&limit=1`;
    const response = await axios.get(fdaURL);
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0];
    }
  } catch (error) {
    console.error('FDA ID Error:', error.message);
  }
  return null;
}

// --- 6. Helper Function: AI Warning Summarizer ---
async function getAIWarningSummary(warnings) {
  if (!warnings || warnings.toLowerCase() === 'not found') {
    return "No specific warnings available.";
  }
  try {
    // *** FIXED: USING GEMINI 2.5 FLASH ***
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Summarize the following complex "Warnings" text into 3 simple, easy-to-understand bullet points: "${warnings.substring(0, 5000)}"`;
    const result = await model.generateContent(prompt);
    return (await result.response).text();
  } catch (error) {
    console.error('AI Summary Error:', error.message);
    return "Could not summarize warnings (AI Error).";
  }
}

// --- 7. AI FUNCTION: AI Common Use Summarizer ---
async function getAICommonUseSummary(usageText) {
  if (!usageText || usageText.toLowerCase() === 'not found') {
    return "No common use information available.";
  }
  try {
    // *** FIXED: USING GEMINI 2.5 FLASH ***
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Summarize the following "Common Use" text into simple bullet points: "${usageText.substring(0, 5000)}"`;
    const result = await model.generateContent(prompt);
    return (await result.response).text();
  } catch (error) {
    console.error('AI Use Summary Error:', error.message);
    return usageText; 
  }
}

// --- 8. Helper Function: Fast Text Translator ---
async function translateText(text, targetLang) {
  if (!text || targetLang === 'en') return text;
  try {
    const result = await translate(text, { to: targetLang });
    return result.text;
  } catch (error) {
    console.error('Translate Error:', error.message);
    return text;
  }
}

// --- 9. Bot Commands ---

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
*Welcome to DrugInfoBot!* 🤖

I can help you find information on medications.
Just type the name of a drug (like *Tylenol* or *Advil*) to get started.

You can also use these commands:
/help - Get help
/language - Change my language
/mymeds - View your saved medicine cabinet
  `;
  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [[{ text: '/help' }, { text: '/language' }], [{ text: '/mymeds' }]],
      resize_keyboard: true, persistent: true,
    },
  });
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
*How to use me:*
1.  *Find a Drug:* Just type any drug name (e.g., *Advil*).
2.  *Save a Drug:* Use the "Save to Cabinet" button after a search.
3.  *View Your Cabinet:* Use the /mymeds command.
4.  *Change Language:* Click the /language button.
5.  *Use Inline:* In *any* chat, type \`@MedicalDrugInfo_Bot Tylenol\` to get info instantly.
  `;
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/language/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Please choose your language:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'English', callback_data: 'lang_en' }, { text: 'Español (Spanish)', callback_data: 'lang_es' }],
        [{ text: 'Français (French)', callback_data: 'lang_fr' }, { text: 'हिन्दी (Hindi)', callback_data: 'lang_hi' }],
      ],
    },
  });
});

bot.onText(/\/mymeds/, async (msg) => {
  const chatId = msg.chat.id;
  const db = getDb();
  const lang = (await db.get('SELECT language FROM users WHERE chatId = ?', [chatId]))?.language || 'en';

  const meds = await db.all('SELECT drugName, drugId FROM medications WHERE chatId = ?', [chatId]);
  
  if (!meds || meds.length === 0) {
    const emptyMsg = await translateText("Your medicine cabinet is empty. Use the 'Save' button after a search to add a drug.", lang);
    bot.sendMessage(chatId, emptyMsg);
    return;
  }
  
  const medButtons = meds.map((med) => {
    return [{ text: med.drugName, callback_data: `select_${med.drugId}` }];
  });
  
  const headerMsg = await translateText("Here is your saved Medicine Cabinet:", lang);
  bot.sendMessage(chatId, headerMsg, {
    reply_markup: {
      inline_keyboard: medButtons
    }
  });
});

// --- 10. Bot Listener: Main "text" Handler ---
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  const drugName = msg.text;

  if (drugName.startsWith('/')) return; // Ignore commands

  // Greeting Handler
  const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'hola', 'namaste'];
  if (greetings.includes(drugName.toLowerCase())) {
    const db = getDb();
    const lang = (await db.get('SELECT language FROM users WHERE chatId = ?', [chatId]))?.language || 'en';
    const reply = await translateText('Hello! I am the DrugInfoBot. Please send me a medicine name.', lang);
    bot.sendMessage(chatId, reply);
    return; 
  }

  bot.sendChatAction(chatId, 'typing');

  const db = getDb();
  await db.run('INSERT OR IGNORE INTO users (chatId) VALUES (?)', [chatId]);
  const lang = (await db.get('SELECT language FROM users WHERE chatId = ?', [chatId]))?.language || 'en';

  const results = await getDrugDataFromFDA(drugName);

  if (results.length === 0) {
    const notFoundMsg = await translateText(`Sorry, I could not find any information for "${drugName}".`, lang);
    bot.sendMessage(chatId, notFoundMsg);

  } else if (results.length === 1) {
    // Perfect match
    await sendInteractiveMenu(chatId, results[0], lang);

  } else {
    // Multiple matches
    const [t_header] = await Promise.all([
      translateText(`I found ${results.length} matches for "${drugName}". Which did you mean?`, lang)
    ]);
    
    const suggestionButtons = results.map((drug) => {
      const brandName = drug.openfda.brand_name ? drug.openfda.brand_name[0] : "Unknown Drug";
      // Limit text length to prevent errors
      const safeName = brandName.length > 30 ? brandName.substring(0, 30) + "..." : brandName;
      return [{ text: safeName, callback_data: `select_${drug.id}` }];
    });

    bot.sendMessage(chatId, t_header, {
      reply_markup: {
        inline_keyboard: suggestionButtons
      }
    });
  }
});

// --- 11. Bot Listener: All Button Clicks ---
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const db = getDb();
  const lang = (await db.get('SELECT language FROM users WHERE chatId = ?', [chatId]))?.language || 'en';

  // Handle Language Clicks
  if (data.startsWith('lang_')) {
    const langCode = data.split('_')[1];
    await db.run('INSERT INTO users (chatId, language) VALUES (?, ?) ON CONFLICT(chatId) DO UPDATE SET language = ?', [chatId, langCode, langCode]);
    
    let langName = 'English';
    if (langCode === 'es') langName = 'Español';
    if (langCode === 'fr') langName = 'Français';
    if (langCode === 'hi') langName = 'हिन्दी';
    
    bot.sendMessage(chatId, `Language set to ${langName}.`);
    bot.answerCallbackQuery(query.id);
  }

  // Handle Drug Selection
  if (data.startsWith('select_')) {
    const drugId = data.split('_')[1];
    bot.answerCallbackQuery(query.id, { text: 'Loading...' });
    const drugData = await getDrugByID(drugId);
    if (drugData) {
      await sendInteractiveMenu(chatId, drugData, lang);
    }
  }

  // Handle Show Use / Show Warnings
  if (data.startsWith('show_')) {
    bot.answerCallbackQuery(query.id); 
    await handleShowButton(query); 
  }
  
  // Handle Save to Cabinet
  if (data.startsWith('save_')) {
    const drugId = data.split('_')[1]; 
    
    const drugData = userCache[chatId];
    
    if (!drugData || drugData.id !== drugId) {
      const expiredMsg = await translateText('Search expired. Please search again.', lang);
      bot.answerCallbackQuery(query.id, { text: expiredMsg });
      return;
    }
    
    const drugName = drugData.openfda.brand_name ? drugData.openfda.brand_name[0] : "Unknown";

    try {
      await db.run('INSERT INTO medications (chatId, drugName, drugId) VALUES (?, ?, ?)', [chatId, drugName, drugId]);
      const savedMsg = await translateText(`Saved ${drugName} to your cabinet!`, lang);
      bot.answerCallbackQuery(query.id, { text: savedMsg });
    } catch (e) {
      const alreadySavedMsg = await translateText('Already in your cabinet!', lang);
      bot.answerCallbackQuery(query.id, { text: alreadySavedMsg });
    }
  }
});

// --- 12. Function: Send Interactive Menu (with Pre-loaded AI) ---
async function sendInteractiveMenu(chatId, drugData, lang) {
  bot.sendChatAction(chatId, 'typing'); 

  const brandName = drugData.openfda.brand_name ? drugData.openfda.brand_name[0] : "Unknown";
  const genericName = drugData.openfda.generic_name ? drugData.openfda.generic_name[0] : "Not Found";
  const activeIngredient = drugData.active_ingredient ? drugData.active_ingredient[0] : "Not Found";

  // Pre-load AI Summaries
  const warnings = drugData.warnings ? drugData.warnings[0] : "Not Found";
  const use = drugData.indications_and_usage ? drugData.indications_and_usage[0] : "Not Found";

  const [aiWarningSummary, aiUseSummary] = await Promise.all([
    getAIWarningSummary(warnings),
    getAICommonUseSummary(use)
  ]);

  userCache[chatId] = {
    ...drugData, 
    aiWarningSummary, 
    aiUseSummary      
  };

  const [
    t_title,
    t_generic_header, t_generic_content,
    t_ingredient_header, t_ingredient_content
  ] = await Promise.all([
    translateText(brandName.toUpperCase(), lang),
    translateText('Generic Name:', lang),
    translateText(genericName, lang),
    translateText('Active Ingredient:', lang),
    translateText(activeIngredient, lang)
  ]);
  
  const baseMessage = `
*${t_title}*

*${t_generic_header}*
_${t_generic_content}_

*${t_ingredient_header}*
${t_ingredient_content}
  `;
  
  const [t_btn_use, t_btn_warn, t_btn_hide, t_btn_save] = await Promise.all([
    translateText('Show Common Use', lang),
    translateText('Show AI Warnings', lang),
    translateText('Hide Details', lang),
    translateText('Save to Cabinet 💾', lang)
  ]);

  const inlineKeyboard = {
    inline_keyboard: [
      [{ text: t_btn_use, callback_data: 'show_use' }, { text: t_btn_warn, callback_data: 'show_warn' }],
      [{ text: t_btn_save, callback_data: `save_${drugData.id}` }],
      [{ text: t_btn_hide, callback_data: 'show_hide' }]
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
  const lang = (await db.get('SELECT language FROM users WHERE chatId = ?', [chatId]))?.language || 'en';

  const drugData = userCache[chatId]; 
  if (!drugData) {
    bot.sendMessage(chatId, "Sorry, that search has expired. Please search again.");
    return;
  }

  const brandName = drugData.openfda.brand_name ? drugData.openfda.brand_name[0] : "Unknown";
  const genericName = drugData.openfda.generic_name ? drugData.openfda.generic_name[0] : "Not Found";
  const activeIngredient = drugData.active_ingredient ? drugData.active_ingredient[0] : "Not Found";

  const [
    t_title,
    t_generic_header, t_generic_content,
    t_ingredient_header, t_ingredient_content
  ] = await Promise.all([
    translateText(brandName.toUpperCase(), lang),
    translateText('Generic Name:', lang),
    translateText(genericName, lang),
    translateText('Active Ingredient:', lang),
    translateText(activeIngredient, lang)
  ]);
  
  let baseMessage = `
*${t_title}*

*${t_generic_header}*
_${t_generic_content}_

*${t_ingredient_header}*
${t_ingredient_content}
  `;
  
  let extraInfo = "";

  if (buttonType === 'show_use') {
    const [header, content] = await Promise.all([
      translateText('Common Use (AI Summary):', lang),
      translateText(drugData.aiUseSummary, lang) 
    ]);
    extraInfo = `\n\n*${header}*\n${content}`;

  } else if (buttonType === 'show_warn') {
    const [header, content] = await Promise.all([
      translateText('AI-Summarized Warnings:', lang),
      translateText(drugData.aiWarningSummary, lang) 
    ]);
    extraInfo = `\n\n*${header}*\n${content}`;
  } 

  const [t_btn_use, t_btn_warn, t_btn_hide, t_btn_save] = await Promise.all([
    translateText('Show Common Use', lang),
    translateText('Show AI Warnings', lang),
    translateText('Hide Details', lang),
    translateText('Save to Cabinet 💾', lang)
  ]);
  
  const inlineKeyboard = {
    inline_keyboard: [
      [{ text: t_btn_use, callback_data: 'show_use' }, { text: t_btn_warn, callback_data: 'show_warn' }],
      [{ text: t_btn_save, callback_data: `save_${drugData.id}` }],
      [{ text: t_btn_hide, callback_data: 'show_hide' }]
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

// --- 14. Bot Listener: Inline Mode ---
bot.on('inline_query', async (query) => {
  const drugName = query.query;
  if (!drugName || drugName.length < 3) {
    bot.answerInlineQuery(query.id, [], { cache_time: 0 });
    return;
  }

  const results = await getDrugDataFromFDA(drugName);
  if (results.length === 0) {
    bot.answerInlineQuery(query.id, [], { cache_time: 0 });
    return;
  }

  const inlineResults = results.map((drug) => {
    const brandName = drug.openfda.brand_name ? drug.openfda.brand_name[0] : "Unknown";
    const genericName = drug.openfda.generic_name ? drug.openfda.generic_name[0] : "N/A";
    const usage = drug.indications_and_usage ? drug.indications_and_usage[0] : "Not Found";

    const message_text = `
*${brandName.toUpperCase()}* (_${genericName}_)

*Common Use:*
${usage.substring(0, 200)}...

*Disclaimer: This is for informational purposes only. Always consult a doctor.*
    `;

    return {
      type: 'article',
      id: drug.id,
      title: `${brandName} (${genericName})`,
      input_message_content: {
        message_text: message_text,
        parse_mode: 'Markdown',
      },
      description: `Use: ${usage.substring(0, 50)}...`,
    };
  });

  bot.answerInlineQuery(query.id, inlineResults, { cache_time: 0 });
});

// --- 15. Start the Bot ---
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