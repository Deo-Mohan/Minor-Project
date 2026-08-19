require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { setupDatabase, getDb } = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. SECURITY & MIDDLEWARE (Industry Grade)
// ==========================================

// Helmet secures HTTP headers (Protection against XSS, Sniffing, etc.)
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for local dev (allows inline scripts/images)
}));

// CORS allows your frontend to talk to this backend
app.use(cors());

const path = require('path');

// Body Parser: Increased limit to 50MB to allow High-Quality Image Uploads
app.use(express.json({ limit: '50mb' }));

// Rate Limiter: Prevents spam/DDOS attacks.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, 'public'))); // Serves fullstack HTML/CSS/JS assets

// Wildcard Fallback Middleware: Serves index.html for all non-API GET requests (Single-Deployment Fullstack Architecture)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
    next();
});

// ==========================================
// 2. AI CONFIGURATION
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use the latest available Gemini model
const AI_MODEL_NAME = 'gemini-2.5-flash'; 

console.log(`🤖 AI System Initialized with model: ${AI_MODEL_NAME}`);

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

/**
 * Searches the openFDA database.
 * Strategy: Tries specific Brand/Generic search first.
 * Fallback: If that fails (404), tries a general text search.
 */
async function getDrugDataFromFDA(drugName) {
    const cleanTerm = drugName.replace(/\s+/g, "+").toLowerCase().trim();
    
    // --- STEP 1: Try Direct Search (US Brands) ---
    try {
        console.log(`🔍 Attempt 1: Direct FDA Search for "${drugName}"...`);
        const fdaURL = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${cleanTerm}"+OR+openfda.generic_name:"${cleanTerm}"&limit=5`;
        const response = await axios.get(fdaURL);
        return response.data.results || [];
    } catch (error) {
        console.log(`⚠️ Direct search failed for "${drugName}". Asking AI for generic name...`);
        
        // --- STEP 2: Ask AI for Generic Name ---
        try {
            const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
            const prompt = `I am searching for a medicine named "${drugName}". Identify its primary generic active ingredients (e.g., for 'Combiflam', return 'Ibuprofen'). Return ONLY the primary generic name in English. Do not write full sentences.`;
            
            const result = await model.generateContent(prompt);
            const genericName = (await result.response).text().trim().replace(/[*`]/g, '');
            
            console.log(`🤖 AI identified "${drugName}" generic: "${genericName}"`);

            // --- STEP 3: Search FDA Again with Generic Name ---
            const genericTerm = genericName.replace(/\s+/g, "+").toLowerCase();
            const backupURL = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${genericTerm}"+OR+openfda.brand_name:"${genericTerm}"&limit=5`;
            
            const backupResponse = await axios.get(backupURL);
            console.log("✅ Found FDA data using generic bridge!");
            return backupResponse.data.results || [];
        } catch (aiError) {
            console.log("ℹ️ Generic bridge fetch completed/skipped, proceeding to AI synthesis.");
            return [];
        }
    }
}

// ==========================================
// 4. API ROUTES
// ==========================================

// --- Route 1: Drug Search (FDA API + AI Intelligence Synthesis) ---
app.post('/api/search', async (req, res) => {
    const { query, lang = 'en' } = req.body;
    if (!query) return res.json({ results: [], aiSummary: null });
    
    try {
        const results = await getDrugDataFromFDA(query);
        let aiSummary = null;

        // If FDA results or partial label data found, trigger Gemini AI to synthesize into plain-English patient summary
        if (results && results.length > 0) {
            try {
                const label = results[0];
                const brandName = label.openfda?.brand_name?.[0] || query;
                const genericName = label.openfda?.generic_name?.[0] || "N/A";
                const purpose = label.purpose?.[0] || label.indications_and_usage?.[0] || "General medication";
                const warnings = label.warnings?.[0] || label.boxed_warning?.[0] || "Consult a doctor.";
                const dosage = label.dosage_and_administration?.[0] || "Follow prescription instructions.";

                const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
                const prompt = `
                You are a senior clinical pharmacist explaining a medication to a patient.
                Medicine Name: "${brandName}" (Generic: "${genericName}")
                FDA Data Summary:
                - Indications/Purpose: ${purpose.substring(0, 1000)}
                - Key Warnings: ${warnings.substring(0, 1000)}
                - Dosage Guidance: ${dosage.substring(0, 1000)}

                Generate a friendly, clear, high-level patient summary formatted in clean HTML (use <h4> headers, <ul> bullet points, and <strong> tags).
                Structure it as:
                1. 💊 What it is & Main Purpose
                2. 💡 How to Use & Typical Dosage
                3. ⚠️ Important Warnings & Safety Tips
                4. 🩺 When to see a doctor
                Do not include markdown backticks. Return raw clean HTML content.
                `;

                const aiResult = await model.generateContent(prompt);
                aiSummary = (await aiResult.response).text();
            } catch (aiErr) {
                console.error("AI FDA Synthesis Error:", aiErr.message);
            }
        } else {
            // Direct Gemini fallback whenever FDA has no entry
            try {
                const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
                const prompt = `
                The user searched for medicine "${query}". 
                Provide a structured, easy-to-understand medical breakdown in clean HTML:
                1. 💊 Active Ingredients & Primary Uses
                2. 💡 Recommended Usage & General Dosage
                3. ⚠️ Common Side Effects & Key Warnings
                4. 🩺 Doctor Consultation Note
                Return raw clean HTML without markdown backticks.
                `;
                const aiResult = await model.generateContent(prompt);
                aiSummary = (await aiResult.response).text().replace(/```html|```/g, '');
            } catch (fallbackErr) {
                console.error("Direct AI Fallback Error:", fallbackErr.message);
            }
        }

        res.json({ results, aiSummary });
    } catch (error) {
        console.error("Search Route Error:", error);
        res.status(500).json({ error: "Server Error during search" });
    }
});

// --- Route 2: AI Analysis (Usage/Warnings) ---
app.post('/api/analyze', async (req, res) => {
    const { text, type } = req.body;
    if (!text || text.trim().length === 0) {
        return res.json({ summary: "<li>Consult prescription or medical professional for specific label instructions.</li>" });
    }

    try {
        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        const cleanText = text.substring(0, 3000);
        
        let prompt;
        if (type === 'warning') {
            prompt = `You are a medical pharmacist. Summarize the following drug warnings into 2-3 clear bullet points using HTML <li> tags (do not include <ul> wrapper or markdown backticks):\n\n${cleanText}`;
        } else {
            prompt = `You are a medical pharmacist. Summarize the main uses of this drug into 2-3 simple bullet points using HTML <li> tags (do not include <ul> wrapper or markdown backticks):\n\n${cleanText}`;
        }
        
        const result = await model.generateContent(prompt);
        const responseText = (await result.response).text().replace(/```html|```/g, '');
        res.json({ summary: responseText });
        
    } catch (e) {
        console.error("AI Card Analysis Error:", e.message);
        // Fallback summary if AI rate limit or token limit occurs
        const fallbackText = text.length > 200 ? text.substring(0, 200) + "..." : text;
        res.json({ summary: `<li>${fallbackText}</li>` });
    }
});

// --- Route 3: Visual Pill Identifier (Vision) ---
app.post('/api/identify', async (req, res) => {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "No image provided" });

    try {
        console.log("📷 Processing Image...");
        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        
        const imagePart = {
            inlineData: {
                data: imageBase64.split(',')[1], // Strip the header
                mimeType: "image/jpeg"
            }
        };

        const prompt = "Analyze this image. If it is a medicine, return ONLY the Brand Name or Generic Name. Do not write sentences. If it is not a medicine, say 'Not a medicine'.";
        
        const result = await model.generateContent([prompt, imagePart]);
        const drugName = (await result.response).text().trim();
        
        console.log(`✅ Identified: ${drugName}`);
        res.json({ drugName });
        
    } catch (e) {
        console.error("Vision Error:", e.message);
        res.status(500).json({ error: "Could not identify image" });
    }
});

// --- Route 4: Drug Interaction Checker ---
app.post('/api/interact', async (req, res) => {
    const { drug1, drug2 } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        const prompt = `Check for drug interactions between "${drug1}" and "${drug2}". 
        If there is a danger, start with "⚠️ **WARNING**". 
        If safe, start with "✅ **SAFE**". 
        Keep the explanation under 50 words.`;
        
        const result = await model.generateContent(prompt);
        res.json({ result: (await result.response).text() });
    } catch (e) {
        res.status(500).json({ error: "AI Busy" });
    }
});

// --- Route 5: Symptom Checker (Triage) ---
app.post('/api/symptom', async (req, res) => {
    const { symptoms } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        const prompt = `Act as a medical triage assistant. The user has these symptoms: "${symptoms}". 
        1. List 3 potential causes.
        2. Provide 1 recommendation.
        3. Format using HTML <br> tags for new lines.
        4. Start with: "⚠️ **Disclaimer: This is AI-generated info, not medical advice.**"`;
        
        const result = await model.generateContent(prompt);
        res.json({ analysis: (await result.response).text() });
    } catch (e) {
        res.status(500).json({ error: "AI Busy" });
    }
});

// --- Route 6: MediChatBot (General Chat) ---
app.post('/api/chat', async (req, res) => {
    const { message, lang = 'en' } = req.body;
    try {
        const langMap = {
            en: "English",
            hi: "Hindi (हिंदी)",
            te: "Telugu (తెలుగు)",
            es: "Spanish (Español)",
            fr: "French (Français)"
        };
        const targetLang = langMap[lang] || "English";

        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        const chat = model.startChat();
        
        const result = await chat.sendMessage(`
            You are MediBot AI, an advanced medical & pharmaceutical assistant. 
            Respond ONLY in ${targetLang}. 
            Keep answers clear, highly structured, safe, empathetic, and professional. 
            User asks: ${message}
        `);
        
        res.json({ reply: (await result.response).text() });
    } catch (e) {
        console.error("Chat API error:", e.message);
        res.status(500).json({ error: "Chat Error" });
    }
});

// --- Route 7: Medicine Cabinet (Add) ---
app.post('/api/cabinet/add', async (req, res) => {
    const { userId, drugName, drugId } = req.body;
    const db = getDb();
    try {
        await db.run(
            'INSERT INTO cabinet (userId, drugName, drugId) VALUES (?, ?, ?)', 
            [userId, drugName, drugId]
        );
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: "Already saved" });
    }
});

// --- Route 8: Medicine Cabinet (Get) ---
app.get('/api/cabinet/:userId', async (req, res) => {
    const db = getDb();
    try {
        const meds = await db.all('SELECT * FROM cabinet WHERE userId = ?', [req.params.userId]);
        res.json({ meds });
    } catch (e) {
        res.json({ meds: [] });
    }
});

// --- Route 9: Telegram Bot Webhook (For Vercel Unified Serverless Deployment) ---
app.post('/api/telegram-webhook', async (req, res) => {
    try {
        const update = req.body;
        console.log("📩 Received Telegram Webhook update:", JSON.stringify(update));

        if (update && update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const userMsg = update.message.text.trim();
            const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN;

            if (!botToken) {
                console.error("⚠️ TELEGRAM_BOT_TOKEN missing in environment variables.");
                return res.sendStatus(200); // Acknowledge to Telegram so it stops retrying
            }

            let responseText = "";

            if (userMsg === '/start') {
                responseText = `👋 *Welcome to MediBot AI!* 🏥\n\nI am your intelligent AI medical & drug info assistant.\n\n*What I can do:*\n• Ask me any question about medicines (e.g., "What is Paracetamol used for?")\n• Check drug side effects, dosages, or safety warnings\n• Get medical advice for general symptoms\n\nType your question below to start! 💊`;
            } else if (userMsg === '/help') {
                responseText = `💡 *MediBot AI Help*\n\nJust send me the name of any medicine or ask your health question directly.\n\n*Examples:*\n- *Combiflam usage and dosage*\n- *Is Ibuprofen safe during pregnancy?*\n- *What are side effects of Amoxicillin?*`;
            } else {
                // Generate answer using Gemini 2.5 Flash model
                try {
                    const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
                    const prompt = `You are MediBot AI, a helpful, safe medical and drug information assistant responding in Telegram.
User asked: "${userMsg}".
Give a clear, highly readable, structured, and helpful response. Use Telegram markdown formatting where appropriate (bold with *, bullet points with •). Keep responses concise for messaging. End with a short reminder that this is educational info, not medical advice.`;

                    const result = await model.generateContent(prompt);
                    responseText = (await result.response).text();
                } catch (aiErr) {
                    console.error("Telegram Gemini Error:", aiErr);
                    responseText = "⚠️ Sorry, I'm having trouble processing your query right now. Please try again in a moment.";
                }
            }

            // Send message back to Telegram API
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: chatId,
                text: responseText,
                parse_mode: 'Markdown'
            }).catch(async (sendErr) => {
                // If markdown parsing fails, fallback to plain text
                console.warn("Markdown failed, resending as plain text...");
                await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    chat_id: chatId,
                    text: responseText.replace(/[*_`]/g, '')
                });
            });
        }

        res.sendStatus(200); // Always respond 200 OK to Telegram
    } catch (err) {
        console.error("❌ Telegram Webhook Handler Error:", err.message);
        res.sendStatus(200);
    }
});

// --- Route 10: Set Telegram Webhook Helper ---
app.get('/api/set-telegram-webhook', async (req, res) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN;
    const appUrl = req.query.url || `https://${req.get('host')}`;
    
    if (!botToken) {
        return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN or TELEGRAM_TOKEN is not set in environment variables." });
    }

    const webhookUrl = `${appUrl}/api/telegram-webhook`;
    try {
        const telegramRes = await axios.get(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
        res.json({ 
            success: true, 
            webhookUrl: webhookUrl, 
            telegramResponse: telegramRes.data 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.response ? err.response.data : err.message 
        });
    }
});

// Ensure database is initialized for serverless functions
app.use(async (req, res, next) => {
    try {
        await setupDatabase();
    } catch (e) {
        // Already initialized
    }
    next();
});

// ==========================================
// 5. START SERVER / EXPORT FOR VERCEL
// ==========================================
setupDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 MediBot AI Server is Running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error("❌ Database connection failed:", err);
});

module.exports = app;