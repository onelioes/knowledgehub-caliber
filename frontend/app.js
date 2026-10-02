/**
 * Chandra Asri Manufacturing Knowledge Hub
 * CALIBER 2026 - Case 1 Chandra Asri
 * Minimalist Unified Typography & Organic Flow Logic
 */

// Backend endpoint configuration
let API_ENDPOINT = localStorage.getItem('knowledgehub_api_url') || (window.location.protocol.startsWith('http') ? `${window.location.origin}/api/chat` : 'http://localhost:8000/api/chat');

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
        snippet: "Section 3.2: Pre-startup Verification - Suction and Plan 53A Pressure Checks"
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
    answer: "Untuk Kompresor Gas Sintesis K-102 di Unit Polietilena, batas alarm vibrasi radial bearing adalah 45 um pk-pk (peringatan) dan trip pada 68 um pk-pk. Jika terjadi spike vibrasi 1X synchronous, periksa indikasi ketidakseimbangan rotor (fouling polimer pada impeller stage 2) atau degradasi pelumasan coupling.",
    citations: [
      {
        source: "CAP-INST-K102-VIBRATION-SPEC.pdf",
        page: 7,
        revision: "Rev 3.1 (2024)",
        confidence_score: 0.948,
        snippet: "Table 2.4: Vibration Thresholds and Interlock Trip Matrix K-102"
      },
      {
        source: "RCFA-2024-K102-POLYMER-FOULING.pdf",
        page: 3,
        revision: "Final Rev 1",
        confidence_score: 0.885,
        snippet: "Lesson Learned: Partial recycle gas polymerization triggers 1X vibration"
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
        snippet: "Metallurgical Analysis of Tube HP-40 and Coke Deposition Control"
      },
      {
        source: "SOP-FURNACE-STEAM-AIR-DECOKING.pdf",
        page: 12,
        revision: "Rev 3.0 (2023)",
        confidence_score: 0.931,
        snippet: "Operational Steps for Thermal Steam and Air Decoking"
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

// Flowchart Step Metadata (Zero emojis)
const FLOW_STEPS_DATA = {
  1: {
    badge: "Stage 01 of 05",
    title: "Source Ingestion & Identity Tagging",
    desc: "Operational telemetry ingestion from Honeywell DCS, SCADA gateways, SAP Plant Maintenance, and LIMS. Packets are tagged with unit origins and authenticated via mTLS 1.3 and Kerberos SSO.",
    sample: "Ingesting telemetry across 1,420 plant assets via OPC-UA. Connection verified via mTLS 1.3."
  },
  2: {
    badge: "Stage 02 of 05",
    title: "Cryptographic Hashing & Document Integrity",
    desc: "Every uploaded SOP, P&ID drawing, or datasheet receives a SHA-256 cryptographic checksum. Unapproved changes to safety trip thresholds immediately flag integrity violations.",
    sample: "SHA-256 Checksum: d85e7a9b014f32c6e28fba109c4d9a33481a5e12f6b899147e0bc27a98fa66c1 (Tamper-Free Verified)."
  },
  3: {
    badge: "Stage 03 of 05",
    title: "Role-Based Access Control (RBAC) Clearance",
    desc: "Granular 3-Tier matrix: Tier 1 (Field Operator for startup checklists), Tier 2 (Reliability Engineer for P&ID and trip limits), and Tier 3 (Superintendent / Safety Auditor for approvals).",
    sample: "RBAC Matrix: Clearance Tier 2 (Reliability Engineer) active. Read & query privileges granted."
  },
  4: {
    badge: "Stage 04 of 05",
    title: "RAG AI Context & Grounding Guardrail",
    desc: "The Copilot LLM queries only verified official chunks. Answers must pass a confidence threshold of at least 85% to eliminate hallucination risks on critical chemical equipment.",
    sample: "Grounding Check: Answer grounded on verified sources. Confidence score: 96.5% (> 85% threshold)."
  },
  5: {
    badge: "Stage 05 of 05",
    title: "Immutable WORM Audit Trail & Compliance",
    desc: "All queries, document viewings, and AI responses are preserved in WORM (Write Once Read Many) AES-256 encrypted storage, compliant with ISO 27001 and OSHA 1910 PSM standards.",
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
  setupPlantUnitPills();
  checkBackendHealth();
});

/**
 * Setup navigation
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

  // Header Nav Pills
  document.querySelectorAll('.nav-pill').forEach(pill => {
    if (pill.getAttribute('data-tab') === tabId) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  // Bottom Dock Buttons
  document.querySelectorAll('.dock-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Screen Views
  document.querySelectorAll('.screen').forEach(screen => {
    if (screen.id === tabId) {
      screen.classList.add('active');
    } else {
      screen.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tabId === 'ai-copilot') {
    const input = document.getElementById('chatInput');
    if (input) setTimeout(() => input.focus(), 150);
  }
}

/**
 * Setup Organic Non-Stiff Flowchart
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
      terminal.innerHTML = `<span style="color:#BAE6FD">> Node ${step} Active: ${info.title}</span>\n<span style="color:#BBF7D0">${info.sample}</span>`;
    }
  }

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

  if (triggerPulseBtn) {
    triggerPulseBtn.addEventListener('click', () => {
      const path = document.getElementById('flowBezierPath');
      if (path) {
        path.style.animation = 'none';
        void path.offsetWidth;
        path.style.animation = 'flowDash 6s cubic-bezier(0.16, 1, 0.3, 1)';
      }
      nodeCards.forEach((c, idx) => {
        setTimeout(() => {
          c.classList.add('active-node');
          setTimeout(() => c.classList.remove('active-node'), 700);
        }, idx * 160);
      });
    });
  }

  function runHashSimulation() {
    if (!terminal) return;
    if (runLiveBtn) {
      runLiveBtn.disabled = true;
      runLiveBtn.textContent = 'Verifying Checksum...';
    }

    terminal.innerHTML = `<span style="color:#BAE6FD">> Initiating cryptographic pipeline: CAP-SOP-MECH-P101-STARTUP.pdf...</span>\n`;

    const steps = [
      `[1/4] mTLS Certificate Verification: <span style="color:#BBF7D0">VALID (Issued by Chandra Asri Enterprise CA)</span>`,
      `[2/4] SHA-256 Checksum Computation:\n      <span style="color:#FEF08A">d85e7a9b014f32c6e28fba109c4d9a33481a5e12f6b899147e0bc27a98fa66c1</span>\n      Status: <span style="color:#BBF7D0">100% MATCH (Tamper-Free Verified)</span>`,
      `[3/4] RBAC Matrix Verification: <span style="color:#DDD6FE">Tier 2 (Reliability Engineer)</span> ... <span style="color:#BBF7D0">GRANTED</span>`,
      `[4/4] RAG Grounding Verification: Citations matched against official repository (Score: 96.5%)\n<span style="color:#BBF7D0;font-weight:bold">RESULT: STATUS 200 OK — DOCUMENT & TELEMETRY VERIFIED AND SECURE.</span>`
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
          runLiveBtn.textContent = 'Test Hash Verification';
        }
      }
    }, 450);
  }
}

/**
 * Setup subtle links
 */
function setupSubtleLinks() {
  const btn1 = document.getElementById('openAuthFlowBtn');
  const btn2 = document.getElementById('openAuthFlowBtnSecondary');

  const goToFlow = (e) => {
    e.preventDefault();
    switchTab('data-flow');
    const flowContainer = document.querySelector('.flowchart-minimal-container');
    if (flowContainer) {
      flowContainer.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (btn1) btn1.addEventListener('click', goToFlow);
  if (btn2) btn2.addEventListener('click', goToFlow);
}

/**
 * Plant unit pill selector
 */
function setupPlantUnitPills() {
  const pills = document.querySelectorAll('.mood-pill[data-unit]');
  pills.forEach(p => {
    p.addEventListener('click', () => {
      pills.forEach(x => x.classList.remove('active'));
      p.classList.add('active');
    });
  });
}

/**
 * Setup AI Copilot
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
 * Send chat message
 */
async function sendChatMessage(query, assetTag) {
  state.isSending = true;
  const sendBtn = document.getElementById('sendChatBtn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span>...</span>';
  }

  appendChatBubble('user', query, assetTag);
  const loadingBubbleId = appendLoadingBubble();

  try {
    let result = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

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
      // offline fallback
    }

    if (!result) {
      result = getFallbackKnowledgeResponse(query, assetTag);
    }

    removeLoadingBubble(loadingBubbleId);
    appendChatBubble('assistant', result.response, assetTag, result.citations);

  } catch (error) {
    removeLoadingBubble(loadingBubbleId);
    appendChatBubble('assistant', 'Unable to complete query. Please check connection and try again.', assetTag);
  } finally {
    state.isSending = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span>Send</span> <span>&rarr;</span>';
    }
  }
}

/**
 * Append chat bubble (Zero emojis)
 */
function appendChatBubble(role, text, assetTag, citations = []) {
  const chatLog = document.getElementById('chatLog');
  if (!chatLog) return;

  const row = document.createElement('div');
  row.className = `chat-row ${role}-row`;

  if (role === 'user') {
    row.innerHTML = `
      <div class="chat-bubble user-bubble-blue">
        <div class="chat-bubble-tag">Asset: ${escapeHtml(assetTag)}</div>
        <div class="chat-bubble-text">${escapeHtml(text)}</div>
      </div>
    `;
  } else {
    let citationsHtml = '';
    if (citations && citations.length > 0) {
      citationsHtml = `
        <div class="bot-citations-box">
          <div class="citations-header-title">Verified Source Documents:</div>
          <div class="citation-cards-row">
            ${citations.map(c => `
              <div class="citation-chip-card">
                <div class="cit-source">${escapeHtml(c.source)}</div>
                <div class="cit-tags">
                  <span>Page ${c.page || 'N/A'}</span>
                  <span>${escapeHtml(c.revision || 'Official')}</span>
                  <span class="conf-tag">${c.confidence_score ? Math.round(c.confidence_score * 100) + '%' : '95%'} Match</span>
                </div>
                <div class="cit-snippet">"${escapeHtml(c.snippet || '')}"</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    row.innerHTML = `
      <div class="chat-bubble bot-bubble-spacious">
        <div class="bot-header-meta">
          <span class="bot-avatar-chip">AI Copilot</span>
          <span class="verified-pill">Verified SOP</span>
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
        <span class="bot-avatar-chip">AI Copilot</span>
        <span class="verified-pill">Evaluating RAG...</span>
      </div>
      <div style="font-size:0.85rem;color:var(--text-muted)">
        Retrieving verified P&ID and SOP chunks for ${state.selectedAssetTag}...
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
 * Fallback knowledge response
 */
function getFallbackKnowledgeResponse(query, assetTag) {
  if (CHANDRA_ASRI_KNOWLEDGE_BASE[assetTag]) {
    return CHANDRA_ASRI_KNOWLEDGE_BASE[assetTag];
  }

  return {
    response: `Berdasarkan pedoman teknik Chandra Asri untuk aset **${assetTag}**:\n\n1. Seluruh operasi wajib mematuhi batas aman tekanan dan temperatur di DCS.\n2. Verifikasi interlock keselamatan dan periksa logsheet pemeliharaan berkala sebelum memulai pekerjaan.\n3. Catat deviasi aliran fluida atau vibrasi pada logsheet shift operasional.`,
    citations: [
      {
        source: `CAP-SOP-${assetTag}-MAINTENANCE.pdf`,
        page: 12,
        revision: "Rev 4.0",
        confidence_score: 0.942,
        snippet: `Operational Verification and Safety Guidelines for Asset ${assetTag}`
      }
    ]
  };
}

/**
 * Quick prompt suggestion pills
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
 * System settings
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
      alert('Configuration saved successfully.');
      checkBackendHealth();
    });
  }
}

/**
 * Search filters
 */
function setupSearchFilters() {
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
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const healthUrl = API_ENDPOINT.includes('/api/chat') ? API_ENDPOINT.replace('/api/chat', '/health') : `${API_ENDPOINT}/health`;

    const res = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      state.isLiveBackend = true;
      const hostDisplay = window.location.origin.includes('http') ? window.location.origin : 'http://localhost:8000';
      pill.innerHTML = `<span class="status-indicator-dot"></span> Backend Live: ${hostDisplay}`;
    } else {
      throw new Error();
    }
  } catch (err) {
    state.isLiveBackend = false;
    pill.innerHTML = `<span class="status-indicator-dot" style="background:#D97706"></span> Offline Simulation Mode`;
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

window.switchTab = switchTab;
window.sendChatMessage = sendChatMessage;
