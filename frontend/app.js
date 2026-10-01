/**
 * Chandra Asri Manufacturing Knowledge Hub
 * CALIBER 2026 - Case 1 Chandra Asri
 * Client Application Logic & Backend Integration
 */

// Backend endpoint configuration
let API_ENDPOINT = localStorage.getItem('knowledgehub_api_url') || 'http://localhost:8000/api/chat';

// State
const state = {
  currentTab: 'dashboard',
  selectedAssetTag: 'P-101A',
  isSending: false,
  isLiveBackend: false
};

// Realistic mock responses for fallback when localhost:8000 is offline
const CHANDRA_ASRI_KNOWLEDGE_BASE = {
  'P-101A': {
    answer: "Berdasarkan SOP Startup dan Dokumen Pemeliharaan Pompa Naphtha P-101A di Unit Olefins Chandra Asri, sebelum penyalaan pompa wajib dipastikan:\n1. Level suction lube oil reservoir berada di batas minimum 65% dan pressure gauge terbaca 2.1 bar.\n2. Lakukan venting pada casing pompa untuk memastikan tidak ada vapor lock (kantong uap naphtha).\n3. Pastikan seal flush plan (Plan 53A) bertekanan 1.5 bar di atas suction pressure.\n4. Jalankan motor aux lube oil pump minimal 5 menit sebelum start motor utama 350 kW.",
    citations: [
      {
        source: "CAP-SOP-MECH-P101-STARTUP.pdf",
        page: 18,
        revision: "Rev 4.2 (2025)",
        confidence_score: 0.965,
        snippet: "Bagian 3.2: Pra-penyalaan Pompa Sentrifugal Naphtha - Cek Suction & Seal Plan 53A"
      },
      {
        source: "VENDOR-SULZER-OH2-MANUAL.pdf",
        page: 42,
        revision: "Rev 2.0 (2022)",
        confidence_score: 0.912,
        snippet: "Section 4.1: Lubrication and Mechanical Seal Pressure Barrier Limits"
      }
    ]
  },
  'K-102': {
    answer: "Untuk Kompresor Gas Sintesis K-102 di Unit Polietilena, batas alarm vibrasi radial bearing adalah 45 µm pk-pk (peringatan) dan trip pada 68 µm pk-pk. Jika terjadi spike vibrasi 1X synchronous, periksa indikasi ketidakseimbangan rotor (fouling polimer pada impeller stage 2) atau degradasi pelumasan coupling.",
    citations: [
      {
        source: "CAP-INST-K102-VIBRATION-SPEC.pdf",
        page: 7,
        revision: "Rev 3.1 (2024)",
        confidence_score: 0.948,
        snippet: "Tabel 2.4: Vibration Thresholds & Interlock Trip Matrix K-102"
      },
      {
        source: "RCFA-2024-K102-POLYMER-FOULING.pdf",
        page: 3,
        revision: "Final Rev 1",
        confidence_score: 0.885,
        snippet: "Lesson Learned: Polimerisasi parsial pada gas recycle memicu vibrasi 1X"
      }
    ]
  },
  'F-101': {
    answer: "Histori kegagalan Furnace F-101 (Naphtha Cracking Unit): Pada tahun 2024 terjadi 1 kasus hotspot tube radiant akibat coke laydown yang tidak merata. Rekomendasi mitigasi: jadwal decoking berkala setiap 60 hari operasional dan monitoring continuous skin thermocouple pada zona bridgewall.",
    citations: [
      {
        source: "CAP-FURNACE-F101-INTEGRITY-REPORT.pdf",
        page: 25,
        revision: "Rev 5.0 (2025)",
        confidence_score: 0.972,
        snippet: "Analisis Metalurgi Tube HP-40 & Pengendalian Coke Deposition"
      },
      {
        source: "SOP-FURNACE-STEAM-AIR-DECOKING.pdf",
        page: 12,
        revision: "Rev 3.0 (2023)",
        confidence_score: 0.931,
        snippet: "Langkah-langkah Dekoking Termal Campuran Steam & Udara"
      }
    ]
  }
};

/**
 * Initialize application on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupChat();
  setupQuickPrompts();
  setupSettings();
  setupSearchFilters();
  setupAuthFlowModal();
  checkBackendHealth();
});

/**
 * Setup Dynamic Tab Navigation (no page reload)
 */
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav[data-tab]');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

/**
 * Switch active screen dynamically
 * @param {string} tabId 
 */
function switchTab(tabId) {
  // Update state
  state.currentTab = tabId;

  // Update nav buttons
  document.querySelectorAll('.nav').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update screen visibility
  document.querySelectorAll('.screen').forEach(screen => {
    if (screen.id === tabId) {
      screen.classList.add('active');
    } else {
      screen.classList.remove('active');
    }
  });

  // Auto focus input if switching to AI Copilot
  if (tabId === 'ai-copilot') {
    const input = document.getElementById('chatInput');
    if (input) setTimeout(() => input.focus(), 100);
  }
}

/**
 * Check if the backend server is reachable
 */
async function checkBackendHealth() {
  const indicator = document.getElementById('backendStatus');
  if (!indicator) return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    // Test fetch to backend host
    await fetch(API_ENDPOINT.replace('/api/chat', '/docs') || API_ENDPOINT, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    state.isLiveBackend = true;
    indicator.className = 'backend-indicator live';
    indicator.innerHTML = '<span class="pulse"></span> Live Backend (Port 8000)';
  } catch (e) {
    state.isLiveBackend = false;
    indicator.className = 'backend-indicator mock';
    indicator.innerHTML = '<span class="pulse"></span> Standby / Fallback Mode';
  }
}

/**
 * Setup AI Copilot chat interactions
 */
function setupChat() {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const assetSelect = document.getElementById('assetTagSelect');

  if (assetSelect) {
    assetSelect.addEventListener('change', (e) => {
      state.selectedAssetTag = e.target.value;
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = input.value.trim();
      const assetTag = assetSelect ? assetSelect.value : state.selectedAssetTag;

      if (!query || state.isSending) return;

      input.value = '';
      await sendChatMessage(query, assetTag);
    });
  }
}

/**
 * Send chat message to backend and render response with citation cards
 * @param {string} query 
 * @param {string} assetTag 
 */
async function sendChatMessage(query, assetTag) {
  state.isSending = true;
  const chatLog = document.getElementById('chatLog');
  const sendBtn = document.getElementById('sendChatBtn');

  if (sendBtn) sendBtn.disabled = true;

  // 1. Render User Message Bubble
  appendUserMessage(query, assetTag);
  scrollToBottom();

  // 2. Render Animated Typing Indicator
  const typingId = 'typing-' + Date.now();
  appendTypingIndicator(typingId);
  scrollToBottom();

  const payload = {
    query: query,
    asset_tag: assetTag
  };

  try {
    console.log(`[KnowledgeHub] Sending POST request to ${API_ENDPOINT}:`, payload);

    // Call Backend API via fetch()
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[KnowledgeHub] Backend response received:', data);

    // Remove typing indicator
    removeTypingIndicator(typingId);

    // Parse response and citations
    const answerText = data.response || data.answer || data.reply || data.message || "Jawaban berhasil diterima dari server.";
    const citations = data.citations || data.sources || data.references || [];

    // Render Assistant Message with Citation Cards
    appendAssistantMessage(answerText, citations, false);
    
    // Update live status badge
    updateBackendBadge(true);

  } catch (error) {
    console.warn(`[KnowledgeHub] Backend request failed (${error.message}). Using intelligent offline fallback:`, error);
    
    // Remove typing indicator
    removeTypingIndicator(typingId);

    // Provide intelligent realistic response for Chandra Asri manufacturing plant
    const fallbackData = getSimulatedPlantKnowledge(query, assetTag);
    
    appendAssistantMessage(
      fallbackData.answer,
      fallbackData.citations,
      true,
      error.message
    );

    updateBackendBadge(false);
  } finally {
    state.isSending = false;
    if (sendBtn) sendBtn.disabled = false;
    scrollToBottom();
  }
}

/**
 * Append user message bubble to chat log
 */
function appendUserMessage(text, assetTag) {
  const chatLog = document.getElementById('chatLog');
  const div = document.createElement('div');
  div.className = 'm u';
  div.innerHTML = `
    <span class="user-tag"><i class="tag-ico">🏷️</i> Asset: <b>${escapeHtml(assetTag)}</b></span>
    <div class="user-text">${escapeHtml(text)}</div>
  `;
  chatLog.appendChild(div);
}

/**
 * Append assistant message bubble with citation cards to chat log
 * @param {string} answer 
 * @param {Array} citations 
 * @param {boolean} isFallback 
 * @param {string} errDetails 
 */
function appendAssistantMessage(answer, citations, isFallback = false, errDetails = '') {
  const chatLog = document.getElementById('chatLog');
  const div = document.createElement('div');
  div.className = 'm a';

  let citationsHtml = '';
  if (citations && citations.length > 0) {
    citationsHtml = `
      <div class="citations-wrapper">
        <div class="citations-title">
          <span>📚</span> Dokumen Sumber Terverifikasi (${citations.length} Sitasi)
        </div>
        <div class="citations-grid">
          ${citations.map(c => renderCitationCard(c)).join('')}
        </div>
      </div>
    `;
  }

  let fallbackNotice = '';
  if (isFallback) {
    fallbackNotice = `
      <div style="margin-bottom:10px; padding:8px 12px; border-radius:10px; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); font-size:0.78rem; color:#92400E; display:flex; align-items:center; gap:8px;">
        <span>ℹ️</span> 
        <span><b>Mode Simulasi Pengetahuan Pabrik</b> (Endpoint backend <code>${API_ENDPOINT}</code> belum aktif: <i>${escapeHtml(errDetails || 'Koneksi gagal')}</i>). Menampilkan jawaban dari database lokal Chandra Asri:</span>
      </div>
    `;
  }

  div.innerHTML = `
    <div class="bub">
      <div class="copilot-meta-header">
        <div class="bot-icon">✦</div>
        <span>Chandra Asri Manufacturing Copilot</span>
        ${isFallback ? '<span class="tag wait" style="margin-left:auto;font-size:0.7rem">Simulated</span>' : '<span class="tag ok" style="margin-left:auto;font-size:0.7rem">Live Verified</span>'}
      </div>
      ${fallbackNotice}
      <div class="copilot-answer-text">${formatMarkdownText(answer)}</div>
      ${citationsHtml}
    </div>
  `;

  chatLog.appendChild(div);
}

/**
 * Render single citation card with source, page, revision, confidence score
 * @param {Object} item 
 */
function renderCitationCard(item) {
  const source = item.source || item.document || item.doc_name || "Dokumen Teknis Chandra Asri";
  const page = item.page !== undefined ? `Hal. ${item.page}` : (item.page_number ? `Hal. ${item.page_number}` : 'Hal. 1');
  const revision = item.revision || item.rev || item.version || "Rev 1.0";
  
  // Format confidence score
  let scoreRaw = item.confidence_score !== undefined ? item.confidence_score : (item.confidence !== undefined ? item.confidence : 0.95);
  let scorePct = scoreRaw <= 1 ? Math.round(scoreRaw * 100) : Math.round(scoreRaw);
  if (scorePct > 100) scorePct = 100;

  const confClass = scorePct >= 90 ? 'conf-high' : 'conf-med';
  const snippet = item.snippet || item.text || item.content || '';

  return `
    <div class="citation-card">
      <div class="citation-source" title="${escapeHtml(source)}">
        <span class="doc-icon">📄</span>
        <span>${escapeHtml(source)}</span>
      </div>
      <div class="citation-details">
        <span class="citation-pill">📖 ${escapeHtml(page)}</span>
        <span class="citation-pill">🔖 ${escapeHtml(revision)}</span>
        <span class="citation-pill conf ${confClass}">🎯 ${scorePct}% Akurasi</span>
      </div>
      ${snippet ? `<div class="citation-snippet">"${escapeHtml(snippet)}"</div>` : ''}
    </div>
  `;
}

/**
 * Render typing indicator bubble
 */
function appendTypingIndicator(id) {
  const chatLog = document.getElementById('chatLog');
  const div = document.createElement('div');
  div.id = id;
  div.className = 'm a';
  div.innerHTML = `
    <div class="bub typing-bubble">
      <span style="font-size:0.8rem;color:var(--muted);margin-right:6px">Copilot sedang menganalisis P&ID & SOP...</span>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  chatLog.appendChild(div);
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/**
 * Update backend status badge
 */
function updateBackendBadge(isLive) {
  const indicator = document.getElementById('backendStatus');
  if (!indicator) return;
  if (isLive) {
    indicator.className = 'backend-indicator live';
    indicator.innerHTML = '<span class="pulse"></span> Live Backend (Port 8000)';
  } else {
    indicator.className = 'backend-indicator mock';
    indicator.innerHTML = '<span class="pulse"></span> Standby / Fallback Mode';
  }
}

/**
 * Scroll chat log to bottom
 */
function scrollToBottom() {
  const chatLog = document.getElementById('chatLog');
  if (chatLog) {
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}

/**
 * Quick Prompt Suggestions Setup
 */
function setupQuickPrompts() {
  const quickBtns = document.querySelectorAll('.quick-prompt-btn');
  const input = document.getElementById('chatInput');
  const assetSelect = document.getElementById('assetTagSelect');

  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const promptText = btn.getAttribute('data-prompt');
      const assetTag = btn.getAttribute('data-asset') || 'P-101A';

      if (assetSelect) {
        assetSelect.value = assetTag;
        state.selectedAssetTag = assetTag;
      }

      if (input) {
        input.value = promptText;
        input.focus();
      }
    });
  });
}

/**
 * Settings Screen Handlers
 */
function setupSettings() {
  const saveBtn = document.getElementById('saveSettingsBtn');
  const endpointInput = document.getElementById('apiEndpointInput');

  if (endpointInput) {
    endpointInput.value = API_ENDPOINT;
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (endpointInput) {
        API_ENDPOINT = endpointInput.value.trim() || 'http://localhost:8000/api/chat';
        localStorage.setItem('knowledgehub_api_url', API_ENDPOINT);
        alert(`Pengaturan tersimpan!\nEndpoint API: ${API_ENDPOINT}`);
        checkBackendHealth();
      }
    });
  }

  // Model provider pills
  const providerPills = document.querySelectorAll('#providerSelector span');
  providerPills.forEach(pill => {
    pill.addEventListener('click', () => {
      providerPills.forEach(p => p.classList.remove('on'));
      pill.classList.add('on');
    });
  });
}

/**
 * Search & Filter in Asset & Docs and Failure Memory
 */
function setupSearchFilters() {
  const docSearch = document.getElementById('docSearchInput');
  const docRows = document.querySelectorAll('#docsTable tbody tr');

  if (docSearch) {
    docSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      docRows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  const failureSearch = document.getElementById('failureSearchInput');
  const failureCards = document.querySelectorAll('.failure-record');

  if (failureSearch) {
    failureSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      failureCards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }
}

/**
 * Generate high-quality realistic fallback answers for Chandra Asri plant
 */
function getSimulatedPlantKnowledge(query, assetTag) {
  if (CHANDRA_ASRI_KNOWLEDGE_BASE[assetTag]) {
    return CHANDRA_ASRI_KNOWLEDGE_BASE[assetTag];
  }

  return {
    answer: `Berdasarkan Technical Documentation & RCFA database Chandra Asri untuk unit ${escapeHtml(assetTag)}:\n\n1. Operasional normal memerlukan pemantauan kontinu terhadap parameter temperatur, differential pressure, dan laju alir (flow rate).\n2. Seluruh aktivitas intervensi pemeliharaan wajib mematuhi permit kerja LOTO (Lockout/Tagout) dan prosedur isolasi energi kimia.\n3. Lakukan inspeksi visual setiap shift untuk mendeteksi potensi leakage pada flange sambungan dan gland packing.`,
    citations: [
      {
        source: `CAP-SOP-${assetTag || 'PLANT'}-OPERATION.pdf`,
        page: 15,
        revision: "Rev 2.4",
        confidence_score: 0.942,
        snippet: "Prosedur Standar Operasi & Safety Interlock Pabrik Chandra Asri"
      },
      {
        source: "CAP-MAINT-STANDARD-MANUAL.pdf",
        page: 88,
        revision: "Rev 4.0",
        confidence_score: 0.895,
        snippet: "Pedoman Pemeliharaan Preventif dan Prediktif Peralatan Statis & Dinamis"
      }
    ]
  };
}

/**
 * Format simple markdown bold and newlines
 */
function formatMarkdownText(text) {
  if (!text) return '';
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<i>$1</i>');
  formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:rgba(0,85,160,0.1);padding:2px 5px;border-radius:4px;font-family:monospace">$1</code>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

/**
 * Escape HTML utility
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global exposure for direct inline calls if needed
window.switchTab = switchTab;
window.sendChatMessage = sendChatMessage;

/**
 * Setup Data Authentication & Governance Flow Modal
 */
function setupAuthFlowModal() {
  const modal = document.getElementById('authFlowModal');
  const openBtn = document.getElementById('openAuthFlowBtn');
  const openBtnSecondary = document.getElementById('openAuthFlowBtnSecondary');
  const closeBtn = document.getElementById('closeAuthFlowBtn');
  const closeFooterBtn = document.getElementById('closeAuthFlowFooterBtn');
  const runSimBtn = document.getElementById('runAuthSimBtn');
  const simOutput = document.getElementById('authSimOutput');

  if (!modal) return;

  const openModal = () => {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (openBtnSecondary) openBtnSecondary.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);

  // Close on clicking backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });

  // Interactive Hash Verification Simulator
  if (runSimBtn && simOutput) {
    runSimBtn.addEventListener('click', () => {
      runSimBtn.disabled = true;
      runSimBtn.innerHTML = '⏳ Menjalankan Verifikasi...';
      simOutput.innerHTML = `<span style="color:#8CC1E9">> Inisialisasi pipeline autentikasi data untuk target dokumen: CAP-SOP-MECH-P101-STARTUP.pdf...</span>\n`;

      const steps = [
        `[Step 1/4] Memeriksa sertifikat mTLS & PKI Kerberos: <span style="color:#10B981">VALID</span> (Issuer: Chandra Asri Enterprise CA)`,
        `[Step 2/4] Komputasi Checksum SHA-256:\n          <span style="color:#FFB703">d85e7a9b014f32c6e28fba109c4d9a33481a5e12f6b899147e0bc27a98fa66c1</span>\n          Status Integritas: <span style="color:#10B981">100% MATCH (Tamper-Free Verified)</span>`,
        `[Step 3/4] Validasi Otorisasi Pengguna: <span style="color:#438BC4">RBAC Tier 2 (Reliability Engineer)</span> ... <span style="color:#10B981">GRANTED</span>`,
        `[Step 4/4] Verifikasi Grounding RAG Copilot: Sitasi terikat ke metadata terdaftar (Score: 96.5% > Threshold 85%)\n<span style="color:#10B981;font-weight:bold">✔ HASIL AKHIR: STATUS 200 OK — DOKUMEN & TELEMETRI TERAUTENTIKASI LENGKAP & AMAN.</span>`
      ];

      let currentStep = 0;
      const interval = setInterval(() => {
        if (currentStep < steps.length) {
          simOutput.innerHTML += `${steps[currentStep]}\n`;
          simOutput.scrollTop = simOutput.scrollHeight;
          currentStep++;
        } else {
          clearInterval(interval);
          runSimBtn.disabled = false;
          runSimBtn.innerHTML = '⚡ Jalankan Verifikasi Ulang';
        }
      }, 450);
    });
  }
}
