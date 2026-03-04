require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { setupDatabase, getDb } = require('./database.js');

const app = express();
const PORT = 3000;

// ==========================================
// 1. SECURITY & MIDDLEWARE (Industry Grade)
// ==========================================

// Helmet secures HTTP headers (Protection against XSS, Sniffing, etc.)
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for local dev (allows inline scripts/images)
}));

// CORS allows your frontend to talk to this backend
app.use(cors());

// Rate Limiter: Prevents spam/DDOS attacks. 
// Limits each IP to 300 requests every 15 minutes.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
});
app.use('/api/', limiter);

// Body Parser: Increased limit to 50MB to allow High-Quality Image Uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public')); // Serves your HTML/CSS/JS

// ==========================================
// 2. AI CONFIGURATION
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use the model you confirmed works for you.
// If 2.5 gives errors later, switch this string to 'gemini-1.5-flash'
const AI_MODEL_NAME = 'gemini-2.0-flash'; 

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
        // If 404, it means the drug wasn't found. We move to Step 2.
        if (error.response && error.response.status === 404) {
            console.log(`⚠️ Direct search failed. Asking AI to identify generic name...`);
            
            // --- STEP 2: Ask AI for the Generic Name (The "Bridge") ---
            try {
                const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
                const prompt = `I am searching for a medicine named "${drugName}" in the US FDA database but it was not found. 
                Identify the active generic ingredient of "${drugName}" (e.g., if I say 'Dolo 650', you say 'Acetaminophen').
                Return ONLY the generic name in English. Do not write sentences.`;
                
                const result = await model.generateContent(prompt);
                const genericName = (await result.response).text().trim();
                
                console.log(`🤖 AI identified "${drugName}" as generic: "${genericName}"`);

                // --- STEP 3: Search FDA Again with the Generic Name ---
                const genericTerm = genericName.replace(/\s+/g, "+").toLowerCase();
                const backupURL = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${genericTerm}"+OR+openfda.brand_name:"${genericTerm}"&limit=5`;
                
                const backupResponse = await axios.get(backupURL);
                console.log("✅ Found FDA data using generic name!");
                return backupResponse.data.results || [];

            } catch (aiError) {
                console.error("❌ AI Bridge failed:", aiError.message);
                return [];
            }
        }
        return [];
    }
}

// ==========================================
// 4. API ROUTES
// ==========================================

// --- Route 1: Drug Search ---
app.post('/api/search', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.json({ results: [] });
    
    try {
        const results = await getDrugDataFromFDA(query);
        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: "Server Error during search" });
    }
});

// --- Route 2: AI Analysis (Usage/Warnings) ---
app.post('/api/analyze', async (req, res) => {
    const { text, type } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        
        let prompt;
        if (type === 'warning') {
            prompt = `You are a medical assistant. Summarize the following medical WARNINGS text into 3 simple, easy-to-read bullet points (using HTML <li> tags, do not use <ul>): \n\n"${text.substring(0, 5000)}"`;
        } else {
            prompt = `You are a medical assistant. Summarize the following COMMON USAGE text into simple bullet points (using HTML <li> tags, do not use <ul>): \n\n"${text.substring(0, 5000)}"`;
        }
        
        const result = await model.generateContent(prompt);
        const responseText = (await result.response).text();
        res.json({ summary: responseText });
        
    } catch (e) {
        console.error("AI Analysis Error:", e.message);
        res.status(500).json({ error: "AI service is busy." });
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
    const { message } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        const chat = model.startChat();
        
        const result = await chat.sendMessage(`
            You are MediBot AI, a helpful pharmaceutical assistant. 
            Keep answers short, professional, and safe. 
            User asks: ${message}
        `);
        
        res.json({ reply: (await result.response).text() });
    } catch (e) {
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

// ==========================================
// 5. START SERVER
// ==========================================
setupDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`
        =============================================
        🚀 MediBot AI Server is Running!
        📡 Local:   http://localhost:${PORT}
        🛠️  Mode:    Industry Grade (Secure)
        🧠 AI Model: ${AI_MODEL_NAME}
        =============================================
        `);
    });
}).catch(err => {
    console.error("❌ Database connection failed:", err);
});