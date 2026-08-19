# 🏥 MediBot AI — Next-Gen Medical & Drug Intelligence System

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://krishnamohandeo.netlify.app)
[![Google Gemini AI](https://img.shields.io/badge/Google_Gemini-2.5_Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![OpenFDA API](https://img.shields.io/badge/FDA_Database-OpenFDA-0268B8?style=for-the-badge&logo=usps&logoColor=white)](https://open.fda.gov/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

**MediBot AI** is an enterprise-grade AI healthcare platform designed to bridge the gap between complex pharmaceutical databases and everyday users. Powered by **Google Gemini 2.5 Flash** and the **OpenFDA Clinical Database**, MediBot AI delivers instant medication safety checks, pill vision recognition, drug-interaction analysis, symptom triage, and an integrated Telegram Bot.

---

## 🌟 Key Features

* **🔍 Smart Drug Search & Interaction Analysis:** Instant lookup for US/Global brand & generic drugs with official FDA warnings, side effects, and interaction matrix.
* **💊 Gemini Vision Pill Identification:** Upload pill photos to analyze shape, color, imprint, and active ingredients using Gemini Multimodal AI.
* **🩺 AI Symptom Triage:** Natural language symptom checker providing structured preliminary recommendations.
* **📱 Unified Telegram Bot (`@MedicalDrugInfo_Bot`):** Direct serverless webhook integration on Vercel for 24/7 instant messaging assistance on Telegram.
* **🎨 Dual Light/Dark Theme Engine:** High-contrast Light Mode (#9FA1FF / #A47251 palette) and sleek Dark Mode (#121358 / #2C2C2C palette) with zero color bleeding.
* **🌍 Multi-Language Support:** Instant live translation supporting English, Hindi (हिंदी), Telugu (తెలుగు), Spanish, French, and 50+ languages via search dropdown.
* **📲 Mobile-First Responsive Design:** Optimized left-side floating dock and chat widget tailored for smartphones, tablets, and desktop devices.
* **📦 Saved Medicine Cabinet:** Local & SQLite-backed persistent cabinet for tracking personal medications.

---

## 🏗️ Architecture & Technology Stack

* **Frontend:** HTML5, Modern Vanilla JavaScript (ES6+), Tailwind CSS, FontAwesome 6, jsPDF.
* **Backend:** Node.js, Express.js (Single-Deploy Serverless Architecture).
* **AI Engine:** Google Gemini 2.5 Flash SDK (`@google/generative-ai`).
* **Database:** OpenFDA REST API + SQLite / In-Memory persistence (`sqlite3` / `sqlite`).
* **Deployment:** Vercel Serverless Functions (`vercel.json`) with Telegram Webhooks.

---

## 📁 Repository Structure

```
Minor-Project/
├── README.md                      # Comprehensive Technical Documentation
├── vercel.json                    # Vercel Single-Source Deployment Configuration
├── drug-info-web/                 # Main Full-Stack Application
│   ├── server.js                  # Express API Server & Telegram Webhook Routes
│   ├── database.js                # SQLite Database Connector
│   ├── package.json               # Node Dependencies & Scripts
│   ├── .env                       # Environment Configuration
│   └── public/                    # Web Application Static Assets
│       ├── index.html             # Main Dashboard & UI Architecture
│       ├── features.html          # Extended Features Showcase
│       ├── script.js              # Client-Side Application Logic
│       ├── robots.txt             # Search Engine Crawler Instructions
│       └── sitemap.xml            # XML Sitemap for SEO Indexing
└── telegram-bot/                  # Standalone Bot Worker (Optional)
    ├── bot.js
    └── package.json
```

---

## 🚀 Quick Setup & Local Installation

### Prerequisites
* **Node.js** v18.0 or higher
* **npm** or **yarn**
* **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Deo-Mohan/Minor-Project.git
   cd Minor-Project/drug-info-web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in `drug-info-web/.env`:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key_here
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   ```

4. **Start Local Development Server:**
   ```bash
   npm start
   ```
   Open `http://localhost:3000` in your web browser.

---

## ⚡ Deployment to Vercel (Unified Single Source)

MediBot AI is configured for **Single-Source Deployment** on Vercel. Both the web interface and the Telegram Bot run within the same Vercel serverless functions.

1. Install the Vercel CLI or connect your GitHub repository directly to Vercel:
   ```bash
   npm install -g vercel
   vercel
   ```
2. Set Environment Variables in Vercel Dashboard:
   - `GEMINI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
3. Link your Telegram Bot Webhook by opening this URL in your browser once deployed:
   ```
   https://your-vercel-app.vercel.app/api/set-telegram-webhook
   ```

---

## 👨‍💻 Developer & Author

Developed with ❤️ by **Krishna Mohan Deo**

* 🌐 **Portfolio:** [krishnamohandeo.netlify.app](https://krishnamohandeo.netlify.app)
* 🐙 **GitHub:** [@Deo-Mohan](https://github.com/Deo-Mohan)
* 💼 **LinkedIn:** [Krishna Mohan Kumar](https://www.linkedin.com/in/krishna-mohan-kumar)
* 💬 **Telegram Bot:** [@MedicalDrugInfo_Bot](https://t.me/MedicalDrugInfo_Bot)

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
