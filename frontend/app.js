/**
 * Chandra Asri Manufacturing Knowledge Hub
 * CALIBER 2026 - Case 1 Chandra Asri
 * Dynamic Organic UI, Non-Stiff Flowchart & AI Integration
 */

// Backend endpoint configuration
let API_ENDPOINT = localStorage.getItem('knowledgehub_api_url') || 'http://localhost:8000/api/chat';

// State
const state = {
  currentTab: 'dashboard',
  selectedAssetTag: 'P-101A',
  isSending: false,
  isLiveBackend: false,
  activeFlowNode: 2
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
  },
  'C-201': {
    answer: "Untuk Kolom Fraksinasi C-201 (C2 Splitter Kompleks Olefins), delta P abnormal di atas 0.85 bar menunjukkan gejala flooding atau foaming pada tray nomor 18-24. Tindakan wajib: turunkan reflux ratio secara bertahap 5%, verifikasi feed temperature, dan pantau differential pressure transmitter dP-2010.",
    citations: [
      {
        source: "CAP-PID-C201-FRACTIONATION.dwg.pdf",
        page: 4,
        revision: "Rev 6.1 (2024)",
        confidence_score: 0.952,
        snippet: "Section 2.2: Fractionation Tray Flooding Limits and Pressure Differential Control"
      }
    ]
  }
};

// Flowchart Step Metadata
const FLOW_STEPS_DATA = {
  1: {
    badge: "Tahap 01 / 05",
    title: "Source Ingestion & Identity Tagging",
    desc: "Ingesti data operasional secara streaming dari DCS Honeywell Experion, SCADA Gateway, SAP PM, dan DMS Engineering. Tiap paket data disematkan tag asal unit dan diotentikasi melalui mTLS 1.3 serta tiket Kerberos SSO.",
    sample: "Ingesting 1,420 asset telemetry packets via DCS OPC-UA gateway... Authenticated via TLS 1.3."
  },
  2: {
    badge: "Tahap 02 / 05",
    title: "Cryptographic Hashing & Document Integrity",
    desc: "Setiap kali SOP, P&ID, atau lembar data teknis diunggah, mesin keamanan menghitung nilai hash kriptografis SHA-256 secara independen. Modifikasi ilegal pada angka batas toleransi keselamatan akan langsung ditolak sistem.",
    sample: "SHA-256 Checksum: d85e7a9b014f32c6e28fba109c4d9a33481a5e12f6b899147e0bc27a98fa66c1 (Tamper-Free Verified)."
  },
  3: {
    badge: "Tahap 03 / 05",
    title: "Role-Based Access Control (RBAC) Clearance",
    desc: "Sistem menerapkan otorisasi 3-Tier: Tier 1 (Operator Lapangan untuk checklist startup harian), Tier 2 (Reliability Engineer untuk P&ID dan parameter trip), dan Tier 3 (Superintendent / Auditor untuk persetujuan revisi dokumen).",
    sample: "RBAC Matrix: Clearance Tier 2 (Reliability Engineer) active. Read & query privileges granted."
  },
  4: {
    badge: "Tahap 04 / 05",
    title: "RAG AI Context & Grounding Guardrail",
    desc: "Model AI Copilot diwajibkan hanya merujuk pada chunk dokumen yang terverifikasi resmi. Setiap respon disaring menggunakan ambang akurasi (Confidence Score ≥ 85%) guna mencegah halusinasi teknis berbahaya.",
    sample: "RAG Evaluation: Answer grounded on verified sources. Confidence Score: 96.5% (> 85% threshold)."
  },
  5: {
    badge: "Tahap 05 / 05",
    title: "Immutable WORM Audit Trail & Kepatuhan",
    desc: "Setiap sesi konsultasi, riwayat pembacaan SOP, dan respon AI dicatat dalam media penyimpanan WORM (Write Once Read Many) terenkripsi AES-256 untuk pemenuhan regulasi keselamatan kerja ISO 27001 dan OSHA 1910 PSM.",
    sample: "Audit Log committed to WORM storage. Signature ID: CAP-SEC-AUDIT-2026-9921. Status: Permanent."
  }
};

/**
 * Initialize on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupOrganicFlowchart();
  setupChat();
  setupQuickPrompts();
  setupSettings();
  setupSearchFilters();
  setupSubtleLinks();
  setupTelemetryFilterPills();
  checkBackendHealth();
});

/**
 * Setup navigation (Top Pills + Bottom Floating Dock)
 */
function setupNavigation() {
  const allNavBtns = document.querySelectorAll('[data-tab]');
  allNavBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId) {
        e.preventDefault();
        switchTab(tabId);
      }
    });
  });
}

/**
 * Switch active screen dynamically
 * @param {string} tabId 
 */
function switchTab(tabId) {
  state.currentTab = tabId;

  // Update Top Nav Pills
  document.querySelectorAll('.nav-pill').forEach(pill => {
    if (pill.getAttribute('data-tab') === tabId) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  // Update Bottom Dock Buttons
  document.querySelectorAll('.dock-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update Screens
  document.querySelectorAll('.screen').forEach(screen => {
    if (screen.id === tabId) {
      screen.classList.add('active');
    } else {
      screen.classList.remove('active');
    }
  });

  // Smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Auto focus input if switching to AI Copilot
  if (tabId === 'ai-copilot') {
    const input = document.getElementById('chatInput');
    if (input) setTimeout(() => input.focus(), 150);
  }
}

/**
 * Setup Organic Non-Stiff Flowchart Interactions
 */
function setupOrganicFlowchart() {
  const nodeCards = document.querySelectorAll('.organic-node-card');
  const stageBadge = document.getElementById('drawerStageBadge');
  const stageTitle = document.getElementById('drawerStageTitle');
  const stageDesc = document.getElementById('drawerStageDesc');
  const terminal = document.getElementById('drawerTerminalOutput');
  const runLiveBtn = document.getElementById('runLiveHashSampleBtn');
  const triggerPulseBtn = document.getElementById('triggerFlowPulseBtn');
  const triggerFlowTestBtn = document.getElementById('triggerFlowTestBtn');

  // Node selection
  nodeCards.forEach(card => {
    card.addEventListener('click', () => {
      const step = card.getAttribute('data-step');
      selectFlowNode(step);
    });
  });

  function selectFlowNode(step) {
    state.activeFlowNode = step;
    nodeCards.forEach(c => {
      if (c.getAttribute('data-step') === String(step)) {
        c.classList.add('active-node');
      } else {
        c.classList.remove('active-node');
      }
    });

    const info = FLOW_STEPS_DATA[step] || FLOW_STEPS_DATA[2];
    if (stageBadge) stageBadge.textContent = info.badge;
    if (stageTitle) stageTitle.textContent = info.title;
    if (stageDesc) stageDesc.textContent = info.desc;
    if (terminal) {
      terminal.innerHTML = `<span style="color:#BAE6FD">> Node ${step} Aktif: ${info.title}</span>\n<span style="color:#BBF7D0">${info.sample}</span>`;
    }
  }

  // Live simulation in drawer
  if (runLiveBtn) {
    runLiveBtn.addEventListener('click', () => {
      runHashSimulation();
    });
  }

  if (triggerFlowTestBtn) {
    triggerFlowTestBtn.addEventListener('click', () => {
      switchTab('data-flow');
      runHashSimulation();
    });
  }

  // Animation pulse trigger
  if (triggerPulseBtn) {
    triggerPulseBtn.addEventListener('click', () => {
      const path = document.getElementById('flowBezierPath');
      if (path) {
        path.style.animation = 'none';
        void path.offsetWidth; // trigger reflow
        path.style.animation = 'flowDash 6s cubic-bezier(0.16, 1, 0.3, 1)';
      }
      nodeCards.forEach((c, idx) => {
        setTimeout(() => {
          c.classList.add('active-node');
          setTimeout(() => c.classList.remove('active-node'), 700);
        }, idx * 180);
      });
    });
  }

  function runHashSimulation() {
    if (!terminal) return;
    if (runLiveBtn) {
      runLiveBtn.disabled = true;
      runLiveBtn.textContent = '⏳ Menguji Kriptografi...';
    }

    terminal.innerHTML = `<span style="color:#BAE6FD">> Inisialisasi pipeline verifikasi integritas data: CAP-SOP-MECH-P101-STARTUP.pdf...</span>\n`;

    const steps = [
      `[1/4] Verifikasi Sertifikat mTLS: <span style="color:#BBF7D0">VALID (Issued by Chandra Asri Enterprise CA)</span>`,
      `[2/4] Komputasi Checksum SHA-256:\n      <span style="color:#FEF08A">d85e7a9b014f32c6e28fba109c4d9a33481a5e12f6b899147e0bc27a98fa66c1</span>\n      Status: <span style="color:#BBF7D0">100% MATCH (Bebas Manipulasi)</span>`,
      `[3/4] Validasi Hak Akses RBAC: <span style="color:#DDD6FE">Tier 2 (Reliability Engineer)</span> ... <span style="color:#BBF7D0">GRANTED</span>`,
      `[4/4] Verifikasi Grounding RAG: Citations verified against official plant repository (Confidence: 96.5%)\n<span style="color:#BBF7D0;font-weight:bold">✔ HASIL AKHIR: STATUS 200 OK — DOKUMEN & TELEMETRI TERAUTENTIKASI LENGKAP & AMAN.</span>`
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        terminal.innerHTML += `${steps[i]}\n`;
        terminal.scrollTop = terminal.scrollHeight;
        i++;
      } else {
        clearInterval(interval);
        if (runLiveBtn) {
          runLiveBtn.disabled = false;
          runLiveBtn.textContent = '⚡ Tes Ulang Verifikasi Hash';
        }
      }
    }, 450);
  }
}

/**
 * Setup Subtle Links for "Flow Autentikasi Data"
 */
function setupSubtleLinks() {
  const btn1 = document.getElementById('openAuthFlowBtn');
  const btn2 = document.getElementById('openAuthFlowBtnSecondary');

  const goToFlow = (e) => {
    e.preventDefault();
    switchTab('data-flow');
    // Scroll to the organic flow container
    const flowContainer = document.querySelector('.organic-flow-container');
    if (flowContainer) {
      flowContainer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (btn1) btn1.addEventListener('click', goToFlow);
  if (btn2) btn2.addEventListener('click', goToFlow);
}

/**
 * Telemetry Spline Filter Pills (Olefins, PE, Cracker, etc.)
 */
function setupTelemetryFilterPills() {
  const pills = document.querySelectorAll('.unit-filter-pill');
  const peakVal = document.querySelector('.peak-val');
  const peakLbl = document.querySelector('.peak-lbl');

  const unitMetrics = {
    'olefins': { score: '99.4%', time: 'Peak Accuracy · 19:00' },
    'pe': { score: '98.8%', time: 'Peak Accuracy · 15:00' },
    'furnace': { score: '99.1%', time: 'Decoking Monitor · 11:00' },
    'splitter': { score: '97.9%', time: 'Delta P Steady · 07:00' },
    'utility': { score: '99.6%', time: 'Steam Flow Bal. · 23:00' }
  };

  pills.forEach(p => {
    p.addEventListener('click', () => {
      pills.forEach(x => x.classList.remove('active'));
      p.classList.add('active');

      const unit = p.getAttribute('data-unit');
      if (unitMetrics[unit] && peakVal && peakLbl) {
        peakVal.textContent = unitMetrics[unit].score;
        peakLbl.textContent = unitMetrics[unit].time;
      }
    });
  });
}

/**
 * Setup AI Copilot Chat Interactions
 */
function setupChat() {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const assetSelect = document.getElementById('assetTagSelect');

  if (assetSelect) {
    assetSelect.addEventListener('change', () => {
      state.selectedAssetTag = assetSelect.value;
    });
  }

  if (form && input) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (!query || state.isSending) return;

      input.value = '';
      await sendChatMessage(query, state.selectedAssetTag);
    });
  }
}

/**
 * Send chat message to backend or fallback
 */
async function sendChatMessage(query, assetTag) {
  state.isSending = true;
  const sendBtn = document.getElementById('sendChatBtn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span>✦</span>';
  }

  // Append user bubble
  appendChatBubble('user', query, assetTag);

  // Append loading assistant bubble
  const loadingBubbleId = appendLoadingBubble();

  try {
    let result = null;

    // Attempt real backend call
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, asset_tag: assetTag }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (res.ok) {
        result = await res.json();
      }
    } catch (err) {
      // Backend offline, fallback to internal knowledge base
    }

    // Fallback if backend wasn't reachable
    if (!result) {
      result = getFallbackKnowledgeResponse(query, assetTag);
    }

    // Replace loading bubble with rich assistant response
    removeLoadingBubble(loadingBubbleId);
    appendChatBubble('assistant', result.response, assetTag, result.citations);

  } catch (error) {
    removeLoadingBubble(loadingBubbleId);
    appendChatBubble('assistant', 'Terjadi kendala saat memproses pertanyaan. Silakan coba kembali.', assetTag);
  } finally {
    state.isSending = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span>Kirim</span> <span>➔</span>';
    }
  }
}

/**
 * Append chat bubble to chat log
 */
function appendChatBubble(role, text, assetTag, citations = []) {
  const chatLog = document.getElementById('chatLog');
  if (!chatLog) return;

  const row = document.createElement('div');
  row.className = `chat-row ${role}-row`;

  if (role === 'user') {
    row.innerHTML = `
      <div class="chat-bubble user-bubble">
        <div class="chat-bubble-tag">🏷️ Aset: ${escapeHtml(assetTag)}</div>
        <div class="chat-bubble-text">${escapeHtml(text)}</div>
      </div>
    `;
  } else {
    let citationsHtml = '';
    if (citations && citations.length > 0) {
      citationsHtml = `
        <div class="bot-citations-box">
          <div class="citations-header-title">📚 Dokumen Sumber Terverifikasi:</div>
          <div class="citation-cards-row">
            ${citations.map(c => `
              <div class="citation-chip-card">
                <div class="cit-source">📄 ${escapeHtml(c.source)}</div>
                <div class="cit-tags">
                  <span>Hal. ${c.page || 'N/A'}</span>
                  <span>${escapeHtml(c.revision || 'Official')}</span>
                  <span class="conf-tag">${c.confidence_score ? Math.round(c.confidence_score * 100) + '%' : '95%'} Akurat</span>
                </div>
                <div class="cit-snippet">"${escapeHtml(c.snippet || '')}"</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    row.innerHTML = `
      <div class="chat-bubble bot-bubble">
        <div class="bot-header-meta">
          <span class="bot-avatar-chip">✦ Copilot</span>
          <span class="verified-pill">✓ Verified SOP</span>
        </div>
        <div class="bot-text-body">
          ${formatMarkdownText(text)}
        </div>
        ${citationsHtml}
      </div>
    `;
  }

  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function appendLoadingBubble() {
  const chatLog = document.getElementById('chatLog');
  if (!chatLog) return null;

  const id = 'loading-' + Date.now();
  const row = document.createElement('div');
  row.id = id;
  row.className = 'chat-row bot-row';
  row.innerHTML = `
    <div class="chat-bubble bot-bubble" style="opacity:0.85">
      <div class="bot-header-meta">
        <span class="bot-avatar-chip">✦ Copilot</span>
        <span class="verified-pill">Menganalisis RAG...</span>
      </div>
      <div style="font-size:0.85rem;color:var(--text-muted)">
        Memindai dokumen P&ID, SOP, dan catatan kegagalan untuk ${state.selectedAssetTag}...
      </div>
    </div>
  `;
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
  return id;
}

function removeLoadingBubble(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

/**
 * Fallback domain knowledge generator
 */
function getFallbackKnowledgeResponse(query, assetTag) {
  if (CHANDRA_ASRI_KNOWLEDGE_BASE[assetTag]) {
    return CHANDRA_ASRI_KNOWLEDGE_BASE[assetTag];
  }

  return {
    response: `Berdasarkan arsip pedoman teknik pabrik Chandra Asri untuk aset **${assetTag}**:\n\n1. Seluruh operasi wajib mematuhi batas aman tekanan dan temperatur yang terdaftar pada lembar data DCS.\n2. Verifikasi interlock keselamatan dan periksa apakah ada notifikasi anomali pada sistem pemeliharaan berkala sebelum memulai pekerjaan.\n3. Catat deviasi aliran fluida atau getaran pada logsheet shift operasional.`,
    citations: [
      {
        source: `CAP-SOP-${assetTag}-MAINTENANCE.pdf`,
        page: 12,
        revision: "Rev 4.0",
        confidence_score: 0.942,
        snippet: `Standar Pemeliharaan & Prosedur Verifikasi Operasi Aman Aset ${assetTag}`
      }
    ]
  };
}

/**
 * Setup quick prompt suggestion pills
 */
function setupQuickPrompts() {
  const pills = document.querySelectorAll('.quick-prompt-pill');
  pills.forEach(p => {
    p.addEventListener('click', () => {
      const asset = p.getAttribute('data-asset') || 'P-101A';
      const prompt = p.getAttribute('data-prompt');

      const select = document.getElementById('assetTagSelect');
      if (select) {
        select.value = asset;
        state.selectedAssetTag = asset;
      }

      const input = document.getElementById('chatInput');
      if (input && prompt) {
        input.value = prompt;
        sendChatMessage(prompt, asset);
      }
    });
  });
}

/**
 * Setup system settings
 */
function setupSettings() {
  const saveBtn = document.getElementById('saveSettingsBtn');
  const endpointInput = document.getElementById('apiEndpointInput');
  const ragRange = document.getElementById('ragThreshold');
  const thresholdVal = document.getElementById('thresholdVal');
  const providerPills = document.querySelectorAll('.toggle-pill');

  providerPills.forEach(p => {
    p.addEventListener('click', () => {
      providerPills.forEach(x => x.classList.remove('active'));
      p.classList.add('active');
    });
  });

  if (ragRange && thresholdVal) {
    ragRange.addEventListener('input', () => {
      thresholdVal.textContent = ragRange.value + '%';
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (endpointInput) {
        API_ENDPOINT = endpointInput.value.trim() || 'http://localhost:8000/api/chat';
        localStorage.setItem('knowledgehub_api_url', API_ENDPOINT);
      }
      alert('Konfigurasi berhasil disimpan! Sistem siap digunakan.');
      checkBackendHealth();
    });
  }
}

/**
 * Setup search filters for docs and failure memory
 */
function setupSearchFilters() {
  // Docs search
  const docInput = document.getElementById('docSearchInput');
  const docRows = document.querySelectorAll('#docsTable tbody tr');

  if (docInput) {
    docInput.addEventListener('input', () => {
      const q = docInput.value.toLowerCase().trim();
      docRows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  // Failure search
  const failInput = document.getElementById('failureSearchInput');
  const failCards = document.querySelectorAll('.failure-card-item');

  if (failInput) {
    failInput.addEventListener('input', () => {
      const q = failInput.value.toLowerCase().trim();
      failCards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }
}

/**
 * Check backend health
 */
async function checkBackendHealth() {
  const pill = document.getElementById('backendStatusPill');
  if (!pill) return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(API_ENDPOINT.replace('/api/chat', '/docs') || API_ENDPOINT, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      state.isLiveBackend = true;
      pill.innerHTML = `<span class="pulse-dot"></span> Backend Live: http://localhost:8000`;
      pill.className = 'cute-tag mint';
    } else {
      throw new Error();
    }
  } catch (err) {
    state.isLiveBackend = false;
    pill.innerHTML = `<span>⚡</span> Mode Offline Simulator (Ready)`;
    pill.className = 'cute-tag yellow';
  }
}

/**
 * Simple markdown formatter
 */
function formatMarkdownText(text) {
  if (!text) return '';
  let f = escapeHtml(text);
  f = f.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  f = f.replace(/\*(.*?)\*/g, '<i>$1</i>');
  f = f.replace(/`([^`]+)`/g, '<code style="background:rgba(24,22,34,0.06);padding:2px 6px;border-radius:6px;font-family:monospace">$1</code>');
  f = f.replace(/\n/g, '<br>');
  return f;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global exposure
window.switchTab = switchTab;
window.sendChatMessage = sendChatMessage;
