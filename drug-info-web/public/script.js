// ==========================================
// 1. INITIALIZATION & USER ID & LANGUAGE STATE
// ==========================================
let userId = localStorage.getItem('mediBotUserId');
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('mediBotUserId', userId);
}

let currentLanguage = localStorage.getItem('mediBotLang') || 'en';

// --- THEME STATE MANAGEMENT (Light / Dark Mode) ---
let currentTheme = localStorage.getItem('mediBotTheme') || 'dark';

function applyTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('mediBotTheme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        if (theme === 'light') {
            themeIcon.className = 'fa-solid fa-sun text-amber-400 text-base';
        } else {
            themeIcon.className = 'fa-solid fa-moon text-cyan-400 text-base';
        }
    }
}

function toggleTheme() {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
}

// Initial theme application
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme);
});

const LANGUAGES = [
    // Pinned Core / Default
    { code: 'en', name: 'English', flag: '🇬🇧', badge: 'EN' },
    { code: 'hi', name: 'हिन्दी (Hindi)', flag: '🇮🇳', badge: 'HI' },
    { code: 'te', name: 'తెలుగు (Telugu)', flag: '🇮🇳', badge: 'TE' },
    { code: 'bn', name: 'বাংলা (Bengali)', flag: '🇮🇳', badge: 'BN' },
    { code: 'mr', name: 'मराठी (Marathi)', flag: '🇮🇳', badge: 'MR' },
    { code: 'ta', name: 'தமிழ் (Tamil)', flag: '🇮🇳', badge: 'TA' },
    { code: 'gu', name: 'ગુજરાતી (Gujarati)', flag: '🇮🇳', badge: 'GU' },
    { code: 'kn', name: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳', badge: 'KN' },
    { code: 'ml', name: 'മലയാളം (Malayalam)', flag: '🇮🇳', badge: 'ML' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳', badge: 'PA' },
    { code: 'ur', name: 'اردو (Urdu)', flag: '🇮🇳', badge: 'UR' },
    
    // Global Languages
    { code: 'es', name: 'Español (Spanish)', flag: '🇪🇸', badge: 'ES' },
    { code: 'fr', name: 'Français (French)', flag: '🇫🇷', badge: 'FR' },
    { code: 'de', name: 'Deutsch (German)', flag: '🇩🇪', badge: 'DE' },
    { code: 'ru', name: 'Русский (Russian)', flag: '🇷🇺', badge: 'RU' },
    { code: 'ja', name: '日本語 (Japanese)', flag: '🇯🇵', badge: 'JA' },
    { code: 'zh-CN', name: '中文 (Chinese)', flag: '🇨🇳', badge: 'ZH' },
    { code: 'ar', name: 'العربية (Arabic)', flag: '🇸🇦', badge: 'AR' }
];

const langLabels = LANGUAGES.reduce((acc, l) => { acc[l.code] = l.badge; return acc; }, {});

function toggleLangDropdown(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('langDropdownMenu');
    if (!menu) return;
    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
        menu.classList.remove('hidden');
        renderLanguageList();
        const searchInp = document.getElementById('langSearchInput');
        if (searchInp) {
            searchInp.value = '';
            searchInp.focus();
        }
    } else {
        menu.classList.add('hidden');
    }
}

function renderLanguageList(filterTerm = '') {
    const container = document.getElementById('langListContainer');
    if (!container) return;

    const query = filterTerm.toLowerCase().trim();
    const filtered = LANGUAGES.filter(l => 
        l.name.toLowerCase().includes(query) || 
        l.code.toLowerCase().includes(query) ||
        l.badge.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-3 text-center text-xs text-slate-400">No language found</div>`;
        return;
    }

    container.innerHTML = filtered.map(l => {
        const isSelected = l.code === currentLanguage;
        return `
            <button onclick="changeAppLanguage('${l.code}', '${l.name.replace(/'/g, "\\'")}', '${l.badge}')" 
                class="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${isSelected ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-200 hover:bg-slate-800 hover:text-white'}">
                <span class="flex items-center gap-2">
                    <span>${l.flag}</span>
                    <span>${l.name}</span>
                </span>
                ${isSelected ? '<i class="fa-solid fa-check text-cyan-400 text-xs"></i>' : ''}
            </button>
        `;
    }).join('');
}

function filterLanguages() {
    const input = document.getElementById('langSearchInput');
    renderLanguageList(input ? input.value : '');
}

function changeAppLanguage(code, name, badgeText) {
    currentLanguage = code;
    localStorage.setItem('mediBotLang', code);
    
    const labelEl = document.getElementById('currentLangLabel');
    if (labelEl) labelEl.innerText = badgeText || langLabels[code] || 'EN';

    const menu = document.getElementById('langDropdownMenu');
    if (menu) menu.classList.add('hidden');

    renderLanguageList();

    // --- AquaTrack Google Translate Driver ---
    const selectEl = document.querySelector('.goog-te-combo');
    if (selectEl) {
        selectEl.value = code;
        selectEl.dispatchEvent(new Event('change'));
    } else {
        // Fallback: set googtrans cookie and reload
        document.cookie = `googtrans=/en/${code}; path=/; domain=${window.location.hostname}`;
        document.cookie = `googtrans=/en/${code}; path=/;`;
        window.location.reload();
    }

    const chatBox = document.getElementById('chatMessages');
    if (chatBox) {
        chatBox.innerHTML += `
            <div class="msg-container msg-bot-container">
                <div class="msg-avatar bot-avatar"><i class="fa-solid fa-language"></i></div>
                <div class="msg-bubble msg-bot border-cyan-500/30 text-cyan-300">
                    🌐 Switched page language to <strong>${name}</strong>. How can I assist you with your health query today?
                </div>
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// AquaTrack MutationObserver for Google Translate Banner Suppression & Persistence Init
document.addEventListener('DOMContentLoaded', () => {
    // Suppress Google Translate Top Banner
    const observer = new MutationObserver(() => {
        const bannerFrame = document.querySelector('.goog-te-banner-frame, iframe[id=":1.container"]');
        if (bannerFrame && bannerFrame.style.display !== 'none') {
            bannerFrame.style.display = 'none';
            bannerFrame.style.visibility = 'hidden';
            document.body.style.top = '0px';
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Restore saved language on load
    const savedLang = localStorage.getItem('mediBotLang');
    if (savedLang && savedLang !== 'en') {
        setTimeout(() => {
            const selectEl = document.querySelector('.goog-te-combo');
            if (selectEl) {
                selectEl.value = savedLang;
                selectEl.dispatchEvent(new Event('change'));
            }
        }, 1000);
    }
});

// Close language dropdown on outside click
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('langDropdownMenu');
    const btn = document.getElementById('langDropdownBtn');
    if (dropdown && !dropdown.contains(e.target) && btn && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

const searchInput = document.getElementById('searchInput');
const resultsArea = document.getElementById('resultsArea');

// ==========================================
// AQUATRACK SMART SEARCH ENGINE (Fuzzy, Levenshtein, Highlighting)
// ==========================================
const PHARMA_DICTIONARY = [
    { name: "Paracetamol", category: "Analgesic & Antipyretic", desc: "Fever reducer and pain reliever" },
    { name: "Aspirin", category: "NSAID", desc: "Pain relief, blood thinner, inflammation" },
    { name: "Ibuprofen", category: "NSAID", desc: "Anti-inflammatory pain reliever" },
    { name: "Amoxicillin", category: "Antibiotic", desc: "Bacterial infection treatment" },
    { name: "Cetirizine", category: "Antihistamine", desc: "Allergy and hay fever relief" },
    { name: "Metformin", category: "Antidiabetic", desc: "Type 2 diabetes blood sugar management" },
    { name: "Omeprazole", category: "Antacid (PPI)", desc: "Heartburn and acid reflux relief" },
    { name: "Azithromycin", category: "Antibiotic", desc: "Respiratory and skin infections" },
    { name: "Pantoprazole", category: "Antacid (PPI)", desc: "Gastric acid controller" },
    { name: "Dolo 650", category: "Analgesic & Antipyretic", desc: "High fever & body ache reducer" },
    { name: "Montelukast", category: "Anti-asthmatic", desc: "Asthma & allergic rhinitis" },
    { name: "Atorvastatin", category: "Statin", desc: "Cholesterol reduction medication" },
    { name: "Losartan", category: "Antihypertensive", desc: "High blood pressure control" },
    { name: "Dispirin", category: "NSAID", desc: "Fast headache and fever relief" }
];

function levenshteinDistance(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

function fuzzyMatch(query, target, threshold = 2) {
    query = query.toLowerCase();
    target = target.toLowerCase();
    if (target.includes(query)) return true;
    if (query.length <= 3) return target.startsWith(query);
    return levenshteinDistance(query, target) <= threshold;
}

function highlightMatchText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, `<mark class="bg-cyan-500/30 text-cyan-200 px-1 py-0.5 rounded">$1</mark>`);
}

function onSearchInputChange() {
    const inputVal = searchInput ? searchInput.value.trim() : '';
    const popup = document.getElementById('searchSuggestionsPopup');
    const list = document.getElementById('suggestionsList');

    if (!inputVal || inputVal.length < 1) {
        if (popup) popup.classList.add('hidden');
        return;
    }

    const matches = PHARMA_DICTIONARY.filter(item => 
        fuzzyMatch(inputVal, item.name) || 
        fuzzyMatch(inputVal, item.category) ||
        fuzzyMatch(inputVal, item.desc)
    );

    if (matches.length === 0) {
        if (popup) popup.classList.add('hidden');
        return;
    }

    list.innerHTML = matches.map(item => `
        <div onclick="selectSuggestion('${item.name}')" class="p-3 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between transition group">
            <div>
                <div class="font-bold text-slate-100 group-hover:text-cyan-300 text-sm">
                    ${highlightMatchText(item.name, inputVal)}
                </div>
                <div class="text-xs text-slate-400">
                    ${highlightMatchText(item.desc, inputVal)}
                </div>
            </div>
            <span class="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                ${item.category}
            </span>
        </div>
    `).join('');

    if (popup) popup.classList.remove('hidden');
}

function selectSuggestion(drugName) {
    if (searchInput) searchInput.value = drugName;
    const popup = document.getElementById('searchSuggestionsPopup');
    if (popup) popup.classList.add('hidden');
    searchDrug();
}

// Close popup on click outside
document.addEventListener('click', (e) => {
    const popup = document.getElementById('searchSuggestionsPopup');
    const inputArea = document.getElementById('searchInput');
    if (popup && !popup.contains(e.target) && e.target !== inputArea) {
        popup.classList.add('hidden');
    }
});

// ==========================================
// 2. NEW: SCROLL ANIMATIONS & TYPING EFFECT
// ==========================================
// This handles the "fade in" effect when you scroll down
const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Run these when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // 1. Activate Scroll Animation for existing elements
    document.querySelectorAll('.scroll-hidden').forEach((el) => observer.observe(el));
    
    // 2. Start Typing Effect in Hero Section
    typeWriterEffect();

    // 3. Sync Saved Language Badge
    const labelEl = document.getElementById('currentLangLabel');
    if (labelEl) labelEl.innerText = langLabels[currentLanguage] || 'EN';
});

function typeWriterEffect() {
    const text = "Your Personal AI Health Guardian.";
    const element = document.getElementById('typing-text');
    if (!element) return;
    
    let i = 0;
    element.innerHTML = "";
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, 50); // Typing speed
        }
    }
    type();
}

// ==========================================
// 3. CHATBOT FEATURE (ENHANCED)
// ==========================================
function sendQuickPrompt(promptText) {
    const input = document.getElementById('chatInput');
    input.value = promptText;
    sendMessage();
}

function clearChat() {
    const chatBox = document.getElementById('chatMessages');
    chatBox.innerHTML = `
        <div class="msg-container msg-bot-container">
            <div class="msg-avatar bot-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="msg-bubble msg-bot">
                👋 Chat cleared! How else can I assist you with your health query today?
            </div>
        </div>
    `;
}

function formatChatResponse(text) {
    if (!text) return "";
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-slate-800 px-1 py-0.5 rounded text-blue-300">$1</code>')
        .replace(/\n/g, '<br>');
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    const chatBox = document.getElementById('chatMessages');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append User Message
    chatBox.innerHTML += `
        <div class="msg-container msg-user-container">
            <div class="msg-avatar user-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="msg-bubble msg-user">
                ${msg}
                <div class="text-[10px] text-blue-200/70 text-right mt-1 font-mono">${timeStr}</div>
            </div>
        </div>
    `;
    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    // Append Loading State
    const loadingId = 'loading-' + Date.now();
    chatBox.innerHTML += `
        <div id="${loadingId}" class="msg-container msg-bot-container">
            <div class="msg-avatar bot-avatar"><i class="fa-solid fa-robot animate-spin"></i></div>
            <div class="msg-bubble msg-bot flex items-center gap-2">
                <span class="inline-block w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                <span class="text-slate-400 text-xs font-mono">Analyzing health query...</span>
            </div>
        </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, lang: currentLanguage })
        });
        const data = await res.json();
        
        // Remove Loader
        const loader = document.getElementById(loadingId);
        if(loader) loader.remove();
        
        const msgId = 'bot-msg-' + Date.now();
        chatBox.innerHTML += `
            <div class="msg-container msg-bot-container">
                <div class="msg-avatar bot-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="msg-bubble msg-bot">
                    <div id="${msgId}">${formattedReply}</div>
                    <div class="flex items-center justify-between mt-2 pt-1 border-t border-slate-700/40 text-[10px] text-slate-400">
                        <span>MediChat AI</span>
                        <div class="flex items-center gap-2">
                            <button onclick="speakChatMessage('${msgId}')" class="hover:text-blue-400 p-0.5 transition" title="Read Aloud">
                                <i class="fa-solid fa-volume-high"></i>
                            </button>
                            <span class="font-mono">${timeStr}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        const loader = document.getElementById(loadingId);
        if(loader) loader.remove();
        chatBox.innerHTML += `
            <div class="msg-container msg-bot-container">
                <div class="msg-avatar bot-avatar"><i class="fa-solid fa-triangle-exclamation text-red-400"></i></div>
                <div class="msg-bubble msg-bot border-red-500/30 text-red-300">
                    ⚠️ Network error connecting to AI backend. Please check your connection.
                </div>
            </div>
        `;
    }
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Voice STT (Speech-to-Text) Input Logic for MediChat
let isListeningChat = false;
let recognitionChat = null;

function toggleChatVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Voice recognition is not supported in this browser.");
        return;
    }

    const micBtn = document.getElementById('chatMicBtn');

    if (isListeningChat && recognitionChat) {
        recognitionChat.stop();
        isListeningChat = false;
        if (micBtn) micBtn.classList.remove('text-red-400', 'animate-pulse');
        return;
    }

    try {
        recognitionChat = new SpeechRecognition();
        recognitionChat.continuous = false;
        recognitionChat.interimResults = false;

        const bcpMap = {
            en: 'en-US', hi: 'hi-IN', te: 'te-IN', bn: 'bn-IN', mr: 'mr-IN',
            ta: 'ta-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN',
            ur: 'ur-PK', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', ru: 'ru-RU',
            ja: 'ja-JP', 'zh-CN': 'zh-CN', ar: 'ar-SA'
        };

        recognitionChat.lang = bcpMap[currentLanguage] || 'en-US';

        recognitionChat.onstart = () => {
            isListeningChat = true;
            if (micBtn) micBtn.classList.add('text-red-400', 'animate-pulse');
        };

        recognitionChat.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                const input = document.getElementById('chatInput');
                input.value = transcript;
                sendMessage();
            }
            isListeningChat = false;
            if (micBtn) micBtn.classList.remove('text-red-400', 'animate-pulse');
        };

        recognitionChat.onerror = () => {
            isListeningChat = false;
            if (micBtn) micBtn.classList.remove('text-red-400', 'animate-pulse');
        };

        recognitionChat.onend = () => {
            isListeningChat = false;
            if (micBtn) micBtn.classList.remove('text-red-400', 'animate-pulse');
        };

        recognitionChat.start();
    } catch (e) {
        console.error("Speech recognition error:", e);
    }
}

// Speak Chat Message via Web Speech API (AquaTrack TTS Style)
function speakChatMessage(msgId) {
    const bubble = document.getElementById(msgId);
    if (!bubble) return;
    const text = bubble.innerText;

    if (!('speechSynthesis' in window)) {
        alert("Text-to-speech not supported in this browser.");
        return;
    }

    const synth = window.speechSynthesis;
    if (synth.speaking) {
        synth.cancel();
    }

    const cleanText = text.replace(/[*_~`#]/g, '').replace(/\[.*?\]\(.*?\)/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);

    const bcpMap = {
        en: 'en-US', hi: 'hi-IN', te: 'te-IN', bn: 'bn-IN', mr: 'mr-IN',
        ta: 'ta-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN',
        ur: 'ur-PK', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', ru: 'ru-RU',
        ja: 'ja-JP', 'zh-CN': 'zh-CN', ar: 'ar-SA'
    };

    utterance.lang = bcpMap[currentLanguage] || 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    synth.speak(utterance);
}

// ==========================================
// 4. VOICE SEARCH (Kept Original)
// ==========================================
function startVoiceSearch() {
    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'en-US';
        recognition.start();
        
        searchInput.placeholder = "Listening...";
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            searchInput.value = transcript;
            searchDrug();
            searchInput.placeholder = "Search generic or brand name...";
        };
        
        recognition.onerror = () => {
            alert("Voice error. Please try typing.");
            searchInput.placeholder = "Search generic or brand name...";
        };
    } else {
        alert("Voice search not supported in this browser.");
    }
}

// ==========================================
// 5. MAIN SEARCH & DISPLAY
// ==========================================
async function searchDrug(queryOverride = null) {
    const query = queryOverride || searchInput.value.trim();
    if (!query) return;

    // --- SKELETON SHIMMER LOADING UI ---
    resultsArea.innerHTML = `
        <div class="col-span-full space-y-6">
            <!-- AI Summary Skeleton -->
            <div class="bg-slate-900/60 border border-slate-800 p-6 md:p-8 rounded-3xl space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 skeleton shrink-0"></div>
                    <div class="space-y-2 w-full max-w-sm">
                        <div class="h-5 skeleton w-3/4"></div>
                        <div class="h-3 skeleton w-1/2"></div>
                    </div>
                </div>
                <div class="space-y-3 pt-4">
                    <div class="h-4 skeleton w-full"></div>
                    <div class="h-4 skeleton w-5/6"></div>
                    <div class="h-4 skeleton w-4/6"></div>
                </div>
            </div>

            <!-- FDA Cards Skeleton Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="h-48 skeleton"></div>
                <div class="h-48 skeleton"></div>
                <div class="h-48 skeleton"></div>
            </div>
        </div>
    `;

    try {
        const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, lang: currentLanguage })
        });
        const data = await res.json();
        displayResults(data.results, data.aiSummary, query);
    } catch (e) {
        resultsArea.innerHTML = `<p class="text-center text-red-400 col-span-full">⚠️ Server Error. Please try again.</p>`;
    }
}

function displayResults(drugs, aiSummary, query) {
    resultsArea.innerHTML = '';

    // Render AI Intelligence Breakdown Header Card
    if (aiSummary) {
        const aiCard = document.createElement('div');
        aiCard.className = "col-span-full bg-slate-900/90 backdrop-blur-xl border border-cyan-500/40 p-6 md:p-8 rounded-3xl shadow-2xl text-left relative overflow-hidden mb-4";
        aiCard.innerHTML = `
            <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                        <i class="fa-solid fa-brain text-white"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-white">AI Medical Patient Breakdown</h3>
                        <p class="text-xs text-cyan-400">Synthesized from FDA Labels & Clinical Data for "${query}"</p>
                    </div>
                </div>
                <span class="text-xs font-semibold px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                    ✨ Gemini 2.0 AI
                </span>
            </div>
            <div class="prose prose-invert max-w-none text-slate-300 text-sm md:text-base leading-relaxed space-y-3">
                ${aiSummary}
            </div>
        `;
        resultsArea.appendChild(aiCard);
    }

    if (!drugs || drugs.length === 0) {
        if (!aiSummary) {
            resultsArea.innerHTML = `
                <div class="col-span-full text-center py-10 glass-card rounded-2xl">
                    <h3 class="text-xl font-bold text-white">No exact FDA labels found</h3>
                    <p class="text-slate-400 mt-2">Try generic drug names like "Ibuprofen" or "Paracetamol"</p>
                </div>
            `;
        }
        return;
    }

    const labelHeader = document.createElement('div');
    labelHeader.className = "col-span-full text-left font-bold text-slate-400 text-xs uppercase tracking-wider mt-4 mb-2 flex items-center gap-2";
    labelHeader.innerHTML = `<i class="fa-solid fa-file-medical text-blue-400"></i> Official FDA Label Records (${drugs.length})`;
    resultsArea.appendChild(labelHeader);

    drugs.forEach((drug, index) => {
        // 2. FIX: Smart Data Extraction (Fallbacks)
        // We try to find the Brand Name in the 'openfda' object first, then fallback to raw data.
        let brand = "Unknown Medicine";
        let generic = "General Information";

        if (drug.openfda) {
            if (drug.openfda.brand_name) brand = drug.openfda.brand_name[0];
            else if (drug.openfda.generic_name) brand = drug.openfda.generic_name[0]; // Use generic if brand is missing
            
            if (drug.openfda.generic_name) generic = drug.openfda.generic_name[0];
        } 
        // If openfda object was missing completely, try raw top-level fields
        else {
            if (drug.brand_name) brand = drug.brand_name;
            if (drug.generic_name) generic = drug.generic_name;
        }

        // Safely extract Warnings and Usage (handling potential missing arrays)
        let warnings = "No specific warnings provided by FDA for this entry.";
        if (drug.warnings && drug.warnings[0]) warnings = drug.warnings[0];
        else if (drug.boxed_warning && drug.boxed_warning[0]) warnings = drug.boxed_warning[0];

        let usage = "No specific usage details provided.";
        if (drug.indications_and_usage && drug.indications_and_usage[0]) usage = drug.indications_and_usage[0];

        // 3. FIX: Sanitize strings for HTML attributes
        // We remove single quotes (') from names so they don't break the onclick="" functions
        const safeBrand = brand.replace(/'/g, "");
        const safeGeneric = generic.replace(/'/g, "");
        // We escape quotes in long text so they don't break the data-text="" attribute
        const safeWarnings = warnings.replace(/"/g, "&quot;").replace(/'/g, "&apos;");
        const safeUsage = usage.replace(/"/g, "&quot;").replace(/'/g, "&apos;");

        const card = document.createElement('div');
        card.className = 'glass-card p-6 rounded-2xl scroll-hidden relative overflow-hidden group';
        card.innerHTML = `
            <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

            <div class="flex justify-between items-start mb-6 relative z-10">
                <div class="flex gap-4 items-center">
                    <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-lg border border-slate-600 text-3xl">💊</div>
                    <div>
                        <h2 class="text-2xl font-bold text-white">${brand}</h2>
                        <span class="text-xs font-bold px-2 py-1 rounded bg-slate-700/50 text-blue-300 border border-blue-500/20 uppercase">${generic.substring(0, 25)}</span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="downloadPDF('${safeBrand}', '${safeGeneric}')" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-400 transition flex items-center justify-center border border-slate-700" title="Download PDF">
                        <i class="fa-solid fa-file-pdf"></i>
                    </button>
                    <button onclick="saveDrug('${safeBrand}', '${drug.id}', this)" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-400 transition flex items-center justify-center border border-slate-700" title="Save to Cabinet">
                        <i class="fa-regular fa-bookmark"></i>
                    </button>
                </div>
            </div>
            
            <div class="space-y-3 relative z-10">
                <button onclick="analyzeText(this, 'usage')" data-text="${safeUsage}" 
                    class="w-full group/btn bg-slate-800/50 hover:bg-blue-600/10 border border-slate-700 hover:border-blue-500/50 p-3 rounded-xl transition-all flex items-center justify-between text-slate-200">
                    <span class="flex items-center gap-3"><i class="fa-solid fa-stethoscope text-blue-400"></i> Common Use</span>
                    <i class="fa-solid fa-chevron-right text-slate-600 text-sm"></i>
                </button>

                <button onclick="analyzeText(this, 'warning')" data-text="${safeWarnings}" 
                    class="w-full group/btn bg-slate-800/50 hover:bg-red-600/10 border border-slate-700 hover:border-red-500/50 p-3 rounded-xl transition-all flex items-center justify-between text-slate-200">
                    <span class="flex items-center gap-3"><i class="fa-solid fa-shield-virus text-red-400"></i> Warnings</span>
                    <i class="fa-solid fa-chevron-right text-slate-600 text-sm"></i>
                </button>
            </div>

            <div class="result-box hidden mt-5 pt-5 border-t border-slate-700/50">
                <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-600/50 relative">
                    <div class="flex justify-between items-center mb-3 text-blue-400 text-xs font-bold uppercase tracking-wider">
                        <span><i class="fa-solid fa-robot animate-pulse"></i> AI Analysis</span>
                        <button onclick="speakText(this)" class="text-slate-400 hover:text-white transition p-1 rounded hover:bg-slate-700" title="Read Aloud">
                            <i class="fa-solid fa-volume-high"></i>
                        </button>
                    </div>
                    <div class="content text-slate-300 text-sm leading-relaxed space-y-2"></div>
                </div>
            </div>
        `;
        resultsArea.appendChild(card);
        observer.observe(card); 
    });
}

// ==========================================
// 6. ANALYZE, SPEAK & SAVE (Kept Original)
// ==========================================
async function analyzeText(btn, type) {
    const text = btn.getAttribute('data-text');
    const card = btn.closest('.glass-card'); 
    const resultBox = card.querySelector('.result-box');
    const contentArea = resultBox.querySelector('.content');

    // Reset View
    resultBox.classList.add('hidden');
    contentArea.innerHTML = '';

    if (!text || text === "undefined" || text === "Not available") {
        resultBox.classList.remove('hidden');
        contentArea.innerHTML = "<span class='text-slate-500 italic'>No official data provided by FDA for this section.</span>";
        return;
    }
    
    // Loading State
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...`;
    
    try {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, type })
        });
        const data = await res.json();

        if (data.summary) {
            // 1. FIX: Remove the ```html and ``` tags sent by Gemini
            let cleanText = data.summary
                .replace(/```html/g, '') // Remove the top tag
                .replace(/```/g, '')     // Remove the bottom tag
                .trim();                 // Remove empty space

            // 2. Style the list items
            const styledHtml = cleanText
                .replace(/<li>/g, '<div class="ai-list-item flex gap-2 p-2 bg-slate-800/50 rounded border border-slate-700/50 mb-2"><i class="fa-solid fa-check text-blue-400 mt-1"></i><span>')
                .replace(/<\/li>/g, '</span></div>')
                .replace(/<ul>|<\/ul>/g, '');
            
            contentArea.innerHTML = styledHtml;
        } else {
            contentArea.innerText = "⚠️ AI Error: Could not generate summary.";
        }
        resultBox.classList.remove('hidden');
        
    } catch (e) {
        console.error(e);
        contentArea.innerHTML = "⚠️ Server Error. AI is currently unavailable.";
        resultBox.classList.remove('hidden');
    }
    
    btn.innerHTML = originalHtml;
}

// Track which button is currently talking
let currentSpeakerBtn = null;

function speakText(btn) {
    // 1. Get the text content
    let contentElement = btn.closest('.glass-card').querySelector('.content');
    let content = contentElement.innerText;

    // CLEANUP: Remove the ```html junk text seen in your screenshot
    content = content.replace(/```html/g, '').replace(/```/g, '');

    const icon = btn.querySelector('i');

    if (!('speechSynthesis' in window)) {
        alert("Sorry, your browser does not support Text-to-Speech.");
        return;
    }

    // 2. TOGGLE LOGIC:
    // If we are clicking the SAME button that is currently talking, STOP it.
    if (window.speechSynthesis.speaking && currentSpeakerBtn === btn) {
        window.speechSynthesis.cancel();
        // Reset icon back to Speaker
        icon.className = "fa-solid fa-volume-high";
        currentSpeakerBtn = null;
        return;
    }

    // 3. NEW SPEECH:
    // If something else was talking, stop it first
    window.speechSynthesis.cancel();
    
    // Reset the icon of the PREVIOUS button (if any)
    if (currentSpeakerBtn) {
        const prevIcon = currentSpeakerBtn.querySelector('i');
        if (prevIcon) prevIcon.className = "fa-solid fa-volume-high";
    }

    // Start the new speech
    const utterance = new SpeechSynthesisUtterance(content);
    
    // Change CURRENT icon to a "Stop" button
    icon.className = "fa-solid fa-stop text-red-400 animate-pulse";
    currentSpeakerBtn = btn;

    // 4. AUTO-RESET:
    // When the AI finishes reading, turn the icon back to normal automatically
    utterance.onend = () => {
        icon.className = "fa-solid fa-volume-high";
        currentSpeakerBtn = null;
    };

    window.speechSynthesis.speak(utterance);
}

async function saveDrug(name, id, btn) {
    const icon = btn.querySelector('i');
    icon.className = "fa-solid fa-circle-notch fa-spin";

    await fetch('/api/cabinet/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, drugName: name, drugId: id })
    });

    icon.className = "fa-solid fa-check text-emerald-400";
    setTimeout(() => icon.className = "fa-solid fa-bookmark text-emerald-400", 2000);
}

// ==========================================
// 7. CABINET, IMAGE & MODALS (Kept Original)
// ==========================================
async function showCabinet() {
    const modal = document.getElementById('cabinetModal');
    const list = document.getElementById('cabinetList');
    modal.classList.remove('hidden');
    
    const res = await fetch(`/api/cabinet/${userId}`);
    const data = await res.json();

    list.innerHTML = data.meds.length ? data.meds.map(med => `
        <div class="p-4 bg-slate-800 border border-slate-700 rounded-xl flex justify-between items-center hover:border-blue-500 transition group">
            <span class="font-semibold text-white">💊 ${med.drugName}</span>
            <i class="fa-solid fa-chevron-right text-slate-600 group-hover:text-blue-500"></i>
        </div>
    `).join('') : '<div class="text-center py-10 text-slate-500"><i class="fa-solid fa-box-open text-4xl mb-2"></i><p class="mt-2">Cabinet Empty</p></div>';
}

function handleImageUpload() {
    const input = document.getElementById('imageInput');
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async function() {
        const base64Image = reader.result;
        searchInput.value = "Analyzing Image...";
        
        try {
            const res = await fetch('/api/identify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64Image })
            });
            const data = await res.json();
            
            if (data.drugName) {
                searchInput.value = data.drugName;
                searchDrug(data.drugName);
            } else {
                alert("Could not identify drug.");
                searchInput.value = "";
            }
        } catch (e) {
            alert("Error analyzing image.");
            searchInput.value = "";
        }
    }
}

// Modal Functions
function openSymptomChecker() { document.getElementById('symptomModal').classList.remove('hidden'); }
async function checkSymptoms() {
    const symptoms = document.getElementById('symptomsInput').value;
    const resBox = document.getElementById('symptomResult');
    
    resBox.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...`;
    resBox.classList.remove('hidden');

    try {
        const res = await fetch('/api/symptom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symptoms })
        });
        const data = await res.json();
        resBox.innerHTML = data.analysis.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    } catch (e) {
        resBox.innerHTML = "AI Error.";
    }
}

function openInteractionModal() { document.getElementById('interactModal').classList.remove('hidden'); }
async function checkInteraction() {
    const d1 = document.getElementById('drug1').value;
    const d2 = document.getElementById('drug2').value;
    const resBox = document.getElementById('interactResult');

    resBox.innerHTML = "Checking...";
    resBox.classList.remove('hidden');

    const res = await fetch('/api/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug1: d1, drug2: d2 })
    });
    const data = await res.json();
    resBox.innerHTML = data.result;
}

function findPharmacy() { window.open('https://www.google.com/maps/search/pharmacy+near+me', '_blank'); }

function downloadPDF(brand) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Drug Report: ${brand}`, 10, 10);
    doc.save(`${brand}.pdf`);
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function toggleEmergency() { document.getElementById('emergencyModal').classList.toggle('hidden'); }
// --- BMI Calculator Logic ---
function openBMIModal() { document.getElementById('bmiModal').classList.remove('hidden'); }

function calculateBMI() {
    const height = parseFloat(document.getElementById('bmiHeight').value);
    const weight = parseFloat(document.getElementById('bmiWeight').value);
    const resultBox = document.getElementById('bmiResult');

    if (!height || !weight) {
        resultBox.classList.remove('hidden');
        resultBox.innerHTML = "Please enter valid numbers.";
        resultBox.className = "mt-4 p-4 rounded-xl text-center border border-red-500 bg-red-500/10 text-red-400";
        return;
    }

    // Formula: kg / (m * m)
    const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
    let category = "";
    let colorClass = "";

    if (bmi < 18.5) { category = "Underweight"; colorClass = "text-blue-400 border-blue-500 bg-blue-500/10"; }
    else if (bmi < 24.9) { category = "Normal Weight"; colorClass = "text-emerald-400 border-emerald-500 bg-emerald-500/10"; }
    else if (bmi < 29.9) { category = "Overweight"; colorClass = "text-yellow-400 border-yellow-500 bg-yellow-500/10"; }
    else { category = "Obese"; colorClass = "text-red-400 border-red-500 bg-red-500/10"; }

    resultBox.classList.remove('hidden');
    resultBox.className = `mt-4 p-4 rounded-xl text-center border ${colorClass}`;
    resultBox.innerHTML = `
        <div class="text-3xl font-bold mb-1">${bmi}</div>
        <div class="text-sm font-bold uppercase tracking-wide opacity-80">${category}</div>
    `;
}
// Add this to your existing functions
function openFirstAidModal() { document.getElementById('firstAidModal').classList.remove('hidden'); }

// ==========================================
// 8. DRAGGABLE & RESIZABLE CHAT
// ==========================================

const chatWindow = document.getElementById('chatWindow');
const chatHeader = document.getElementById('chatHeader');
const resizeHandle = document.getElementById('resizeHandle');

// --- DRAG LOGIC ---
let isDragging = false;
let startX, startY, initialLeft, initialTop;

chatHeader.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent text selection
    isDragging = true;
    
    // Get mouse start position
    startX = e.clientX;
    startY = e.clientY;
    
    // Get element start position
    const rect = chatWindow.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    // Switch to fixed positioning logic if not already
    chatWindow.style.position = 'fixed';
    chatWindow.style.right = 'auto';
    chatWindow.style.bottom = 'auto';
    chatWindow.style.left = initialLeft + 'px';
    chatWindow.style.top = initialTop + 'px';

    document.addEventListener('mousemove', dragChat);
    document.addEventListener('mouseup', stopDragChat);
});

function dragChat(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    chatWindow.style.left = `${initialLeft + dx}px`;
    chatWindow.style.top = `${initialTop + dy}px`;
}

function stopDragChat() {
    isDragging = false;
    document.removeEventListener('mousemove', dragChat);
    document.removeEventListener('mouseup', stopDragChat);
}

// --- RESIZE LOGIC ---
let isResizing = false;
let startW, startH, startResizeX, startResizeY;

resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizing = true;
    startW = parseInt(document.defaultView.getComputedStyle(chatWindow).width, 10);
    startH = parseInt(document.defaultView.getComputedStyle(chatWindow).height, 10);
    startResizeX = e.clientX;
    startResizeY = e.clientY;
    
    document.addEventListener('mousemove', resizeChat);
    document.addEventListener('mouseup', stopResizeChat);
});

function resizeChat(e) {
    if (!isResizing) return;
    const width = startW + (e.clientX - startResizeX);
    const height = startH + (e.clientY - startResizeY);
    
    // Apply min constraints (300px)
    if (width > 300) chatWindow.style.width = width + 'px';
    if (height > 300) chatWindow.style.height = height + 'px';
}

function stopResizeChat() {
    isResizing = false;
    document.removeEventListener('mousemove', resizeChat);
    document.removeEventListener('mouseup', stopResizeChat);
}

// UPDATE toggleChat function to work with new styles
function toggleChat() {
    const win = document.getElementById('chatWindow');
    
    if (win.classList.contains('hidden')) {
        // Opening
        win.classList.remove('hidden');
        // Small delay to allow display:block to apply before opacity transition
        setTimeout(() => win.classList.add('chat-visible'), 10);
    } else {
        // Closing
        win.classList.remove('chat-visible');
        setTimeout(() => win.classList.add('hidden'), 300);
    }
}