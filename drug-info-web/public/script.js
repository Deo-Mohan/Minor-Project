// ==========================================
// 1. INITIALIZATION & USER ID
// ==========================================
let userId = localStorage.getItem('mediBotUserId');
if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('mediBotUserId', userId);
}

const searchInput = document.getElementById('searchInput');
const resultsArea = document.getElementById('resultsArea');

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
// 3. CHATBOT FEATURE
// ==========================================
function toggleChat() {
    const win = document.getElementById('chatWindow');
    win.classList.toggle('hidden');
    win.classList.toggle('chat-visible');
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    const chatBox = document.getElementById('chatMessages');
    chatBox.innerHTML += `<div class="msg-bubble msg-user">${msg}</div>`;
    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    // Added "Thinking..." indicator for better UX
    const loadingId = 'loading-' + Date.now();
    chatBox.innerHTML += `<div id="${loadingId}" class="msg-bubble msg-bot"><i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        
        // Remove loading bubble and show reply
        const loader = document.getElementById(loadingId);
        if(loader) loader.remove();
        
        chatBox.innerHTML += `<div class="msg-bubble msg-bot">${data.reply}</div>`;
    } catch (e) {
        const loader = document.getElementById(loadingId);
        if(loader) loader.remove();
        chatBox.innerHTML += `<div class="msg-bubble msg-bot">⚠️ Error connecting to AI.</div>`;
    }
    chatBox.scrollTop = chatBox.scrollHeight;
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

    resultsArea.innerHTML = `
        <div class="col-span-full text-center py-20">
            <div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-slate-400 animate-pulse">Searching FDA Database...</p>
        </div>
    `;

    try {
        const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await res.json();
        displayResults(data.results);
    } catch (e) {
        resultsArea.innerHTML = `<p class="text-center text-red-400 col-span-full">⚠️ Server Error.</p>`;
    }
}

function displayResults(drugs) {
    resultsArea.innerHTML = '';

    // 1. FIX: Check if drugs exist, but DO NOT filter strictly yet.
    if (!drugs || drugs.length === 0) {
        resultsArea.innerHTML = `<div class="col-span-full text-center py-10 glass-card rounded-2xl scroll-hidden visible"><h3 class="text-xl font-bold text-white">No results found</h3><p class="text-slate-400 mt-2">Try generic names like "Ibuprofen"</p></div>`;
        return;
    }

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