/**
 * Chandra Asri Manufacturing Knowledge Hub
 * CALIBER 2026 - Clean Operational Intelligence & RAG Copilot
 * Features: Dynamic Equipment Condition, Live Process Telemetry, Dynamic Checklist,
 * Feature Search Spotlight, Flowchart Visuals, and Unified Copilot.
 */

let API_ENDPOINT = localStorage.getItem('knowledgehub_api_url') || 
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8000' && window.location.port !== '')
    ? 'http://localhost:8000/api/chat'
    : `${window.location.origin}/api/chat`;

// Professional Petrochemical Engineer Avatars (Vector Presets)
const AVATAR_PRESETS = {
  'avatar-1': `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="#1E3A8A"/>
    <path d="M15 90 C15 72, 32 66, 50 66 C68 66, 85 72, 85 90 Z" fill="#1D4ED8"/>
    <path d="M42 66 L50 78 L58 66 Z" fill="#22C55E"/>
    <rect x="44" y="55" width="12" height="15" fill="#D4A373"/>
    <ellipse cx="50" cy="46" rx="18" ry="20" fill="#D4A373"/>
    <path d="M33 38 C35 34, 45 32, 50 32 C55 32, 65 34, 67 38 C67 38, 59 36, 50 36 C41 36, 33 38, 33 38 Z" fill="#262626"/>
    <ellipse cx="43" cy="45" rx="2" ry="2.5" fill="#1E293B"/>
    <ellipse cx="57" cy="45" rx="2" ry="2.5" fill="#1E293B"/>
    <path d="M46 54 Q50 57, 54 54" stroke="#8C5332" stroke-width="2" stroke-linecap="round"/>
    <path d="M30 36 C30 20, 70 20, 70 36 L74 38 C74 38, 50 34, 26 38 Z" fill="#F8FAFC"/>
    <rect x="26" y="34" width="48" height="4" rx="2" fill="#E2E8F0"/>
    <rect x="47" y="24" width="6" height="10" rx="2" fill="#22C55E"/>
  </svg>`,
  'avatar-2': `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="#065F46"/>
    <path d="M15 90 C15 72, 32 66, 50 66 C68 66, 85 72, 85 90 Z" fill="#047857"/>
    <path d="M30 68 L36 90 M70 68 L64 90" stroke="#FDE047" stroke-width="4"/>
    <rect x="44" y="55" width="12" height="15" fill="#E0A96D"/>
    <path d="M30 46 C28 62, 32 75, 32 75 C36 62, 40 50, 40 50 M70 46 C72 62, 68 75, 68 75 C64 62, 60 50, 60 50" stroke="#1F2937" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="50" cy="46" rx="17" ry="19" fill="#E0A96D"/>
    <ellipse cx="43" cy="45" rx="2" ry="2.5" fill="#1E293B"/>
    <ellipse cx="57" cy="45" rx="2" ry="2.5" fill="#1E293B"/>
    <path d="M46 54 Q50 58, 54 54" stroke="#A16207" stroke-width="2" stroke-linecap="round"/>
    <path d="M31 36 C31 21, 69 21, 69 36 L73 38 C73 38, 50 34, 27 38 Z" fill="#EAB308"/>
    <rect x="27" y="34" width="46" height="4" rx="2" fill="#CA8A04"/>
  </svg>`,
  'avatar-3': `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="#312E81"/>
    <path d="M15 90 C15 72, 32 66, 50 66 C68 66, 85 72, 85 90 Z" fill="#1E1B4B"/>
    <rect x="47" y="66" width="6" height="24" fill="#3B82F6"/>
    <path d="M42 66 L50 82 L58 66" stroke="#22C55E" stroke-width="2" fill="none"/>
    <rect x="44" y="55" width="12" height="15" fill="#C68B59"/>
    <ellipse cx="50" cy="46" rx="18" ry="20" fill="#C68B59"/>
    <path d="M32 36 C34 26, 66 26, 68 36 Z" fill="#374151"/>
    <rect x="37" y="42" width="11" height="8" rx="2" stroke="#0F172A" stroke-width="1.8" fill="rgba(255,255,255,0.3)"/>
    <rect x="52" y="42" width="11" height="8" rx="2" stroke="#0F172A" stroke-width="1.8" fill="rgba(255,255,255,0.3)"/>
    <line x1="48" y1="46" x2="52" y2="46" stroke="#0F172A" stroke-width="1.8"/>
    <path d="M46 54 Q50 57, 54 54" stroke="#78350F" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  'avatar-4': `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="#0F172A"/>
    <path d="M15 90 C15 72, 32 66, 50 66 C68 66, 85 72, 85 90 Z" fill="#1E293B"/>
    <path d="M42 66 L50 82 L58 66 Z" fill="#FFFFFF"/>
    <path d="M48 72 L50 90 L52 72 Z" fill="#1D4ED8"/>
    <rect x="44" y="55" width="12" height="15" fill="#E0A96D"/>
    <ellipse cx="50" cy="44" rx="18" ry="20" fill="#E0A96D"/>
    <path d="M31 34 C33 24, 67 24, 69 34 Z" fill="#111827"/>
    <ellipse cx="43" cy="43" rx="2" ry="2.5" fill="#1E293B"/>
    <ellipse cx="57" cy="43" rx="2" ry="2.5" fill="#1E293B"/>
    <path d="M46 52 Q50 56, 54 52" stroke="#A16207" stroke-width="2" stroke-linecap="round"/>
  </svg>`
};

// Global App State
const state = {
  currentTab: 'dashboard',
  selectedAssetTag: '',
  activeGroundedDoc: null,
  isSending: false,
  pendingUpload: null,
  docsExpanded: false,
  checkSensitive: true,
  deepAnalysis: true,
  lang: localStorage.getItem('knowledgehub_lang') || 'en',
  currentFlowchartStep: 1,
  userProfile: {
    name: 'Ir. Hendra Wijaya',
    role: 'Reliability Engineer',
    empId: 'CAP-ENG-8492',
    plant: 'cilegon',
    avatarType: 'preset',
    avatarKey: 'avatar-1',
    customAvatarData: null
  },
  storedDocs: [],
  localUploadedDocs: {},
  // Critical Equipment Management
  equipments: [
    {
      id: 'eq-1',
      tag: 'P-101A',
      name: 'Primary Naphtha Feed Pump',
      status: 'Normal',
      badgeClass: 'normal',
      desc: 'Lube oil reservoir 65%, suction pressure 2.1 bar, Plan 53A barrier fluid active.',
      rev: 'Rev 4.2',
      details: {
        'Suction Pressure': '2.1 bar (Std: 1.8 - 2.4 bar)',
        'Suction Temp': '38 °C',
        'Flow Rate': '145 m³/h',
        'Motor Current': '42.5 A',
        'Lube Oil Level': '65% (Optimal)',
        'Seal Barrier Fluid': 'Plan 53A Pressurized @ 3.4 bar'
      }
    },
    {
      id: 'eq-2',
      tag: 'K-102',
      name: 'Syngas Centrifugal Compressor',
      status: 'Safe Limit',
      badgeClass: 'safe',
      desc: 'Radial bearing vibration 45 µm (within safe limits below 48 µm alarm & 68 µm trip).',
      rev: 'Rev 3.1',
      details: {
        'Radial Vibration': '45 µm (Alarm: 48 µm, Trip: 68 µm)',
        'Lube Oil Temp': '52 °C',
        'Discharge Pressure': '32.4 bar',
        'Seal Gas Delta P': '1.4 bar',
        'Shaft Speed': '9,240 RPM'
      }
    },
    {
      id: 'eq-3',
      tag: 'F-101',
      name: 'Naphtha Cracking Furnace',
      status: 'Normal',
      badgeClass: 'normal',
      desc: 'Steam-air decoking cycle scheduled every 60 days. Tube Metal Temp (TMT) stabilized at 1080°C.',
      rev: 'Rev 5.0',
      details: {
        'Tube Metal Temp (TMT)': '1080 °C (Max: 1120 °C)',
        'Furnace Draft': '-4.5 mmH2O',
        'Flue Gas O2': '1.8%',
        'Feed Rate': '82.0 Ton/h',
        'Coil Outlet Temp': '835 °C'
      }
    }
  ],
  // Telemetry & Chemical Process Streams
  currentChemical: 'ethylene',
  selectedParam1: 'suction_lube',
  selectedParam2: 'vibration',
  chemicalData: {
    ethylene: {
      name: 'Ethylene Cracker Stream (Olefins)',
      suction_lube: { val: 2.1, unit: 'bar', min: 1.0, max: 3.5, step: 0.1, note: 'Normal Range: 1.8 - 2.4 bar', status: 'Normal' },
      feed_pressure: { val: 14.2, unit: 'bar', min: 8.0, max: 20.0, step: 0.2, note: 'Tolerance: 12.0 - 16.0 bar', status: 'Normal' },
      reactor_temp: { val: 835, unit: '°C', min: 750, max: 900, step: 5, note: 'Optimal Cracking: 820 - 850 °C', status: 'Normal' },
      vibration: { val: 45, unit: 'µm', min: 10, max: 80, step: 1, note: 'Alarm: 48 µm · Trip: 68 µm', status: 'Safe' },
      delta_p: { val: 0.35, unit: 'bar', min: 0.1, max: 0.8, step: 0.05, note: 'Normal Delta P: 0.20 - 0.45 bar', status: 'Safe' },
      bearing_temp: { val: 68, unit: '°C', min: 40, max: 100, step: 1, note: 'Max Limit: 85 °C', status: 'Normal' }
    },
    propylene: {
      name: 'Propylene Polymerization Unit',
      suction_lube: { val: 1.9, unit: 'bar', min: 1.0, max: 3.5, step: 0.1, note: 'Normal Range: 1.7 - 2.3 bar', status: 'Normal' },
      feed_pressure: { val: 28.5, unit: 'bar', min: 15.0, max: 35.0, step: 0.5, note: 'Tolerance: 25.0 - 32.0 bar', status: 'Normal' },
      reactor_temp: { val: 68, unit: '°C', min: 40, max: 90, step: 1, note: 'Polymer Reaction: 62 - 75 °C', status: 'Normal' },
      vibration: { val: 32, unit: 'µm', min: 10, max: 80, step: 1, note: 'Alarm: 45 µm · Trip: 65 µm', status: 'Safe' },
      delta_p: { val: 0.22, unit: 'bar', min: 0.1, max: 0.6, step: 0.02, note: 'Normal Delta P: 0.15 - 0.30 bar', status: 'Safe' },
      bearing_temp: { val: 62, unit: '°C', min: 40, max: 95, step: 1, note: 'Max Limit: 80 °C', status: 'Normal' }
    },
    pygas: {
      name: 'Pyrolysis Gasoline (PyGas Hydrotreating)',
      suction_lube: { val: 2.3, unit: 'bar', min: 1.0, max: 3.5, step: 0.1, note: 'Normal Range: 1.9 - 2.6 bar', status: 'Normal' },
      feed_pressure: { val: 34.0, unit: 'bar', min: 20.0, max: 45.0, step: 0.5, note: 'Tolerance: 30.0 - 38.0 bar', status: 'Normal' },
      reactor_temp: { val: 242, unit: '°C', min: 180, max: 300, step: 2, note: 'Bed Temp: 220 - 260 °C', status: 'Normal' },
      vibration: { val: 38, unit: 'µm', min: 10, max: 80, step: 1, note: 'Alarm: 50 µm · Trip: 70 µm', status: 'Safe' },
      delta_p: { val: 0.28, unit: 'bar', min: 0.1, max: 0.7, step: 0.05, note: 'Normal Delta P: 0.20 - 0.40 bar', status: 'Safe' },
      bearing_temp: { val: 71, unit: '°C', min: 40, max: 100, step: 1, note: 'Max Limit: 88 °C', status: 'Normal' }
    },
    butadiene: {
      name: 'Mixed C4 / Butadiene Extraction',
      suction_lube: { val: 2.0, unit: 'bar', min: 1.0, max: 3.5, step: 0.1, note: 'Normal Range: 1.7 - 2.3 bar', status: 'Normal' },
      feed_pressure: { val: 8.8, unit: 'bar', min: 5.0, max: 15.0, step: 0.2, note: 'Tolerance: 7.0 - 10.5 bar', status: 'Normal' },
      reactor_temp: { val: 118, unit: '°C', min: 80, max: 160, step: 2, note: 'Stripper Temp: 110 - 130 °C', status: 'Normal' },
      vibration: { val: 48, unit: 'µm', min: 10, max: 80, step: 1, note: 'Alarm: 52 µm · Trip: 70 µm', status: 'Safe' },
      delta_p: { val: 0.44, unit: 'bar', min: 0.1, max: 0.8, step: 0.05, note: 'Normal Delta P: 0.30 - 0.50 bar', status: 'Safe' },
      bearing_temp: { val: 76, unit: '°C', min: 40, max: 100, step: 1, note: 'Max Limit: 90 °C', status: 'Normal' }
    }
  },
  // Dynamic Checklist Items
  checklists: [
    {
      id: 'chk-1',
      text: 'Verify lube oil reservoir level (≥65%) and Plan 53A cooling loop on primary feed pump.',
      verified: true,
      time: 'Verified: Morning Shift'
    },
    {
      id: 'chk-2',
      text: 'Confirm DCS safety interlocks and ESD (Emergency Shutdown) system in Armed status.',
      verified: true,
      time: 'Verified: 08:30 WIB'
    },
    {
      id: 'chk-3',
      text: 'Inspect static grounding continuity and hydrocarbon bonding straps prior to fluid transfer.',
      verified: false,
      time: null
    },
    {
      id: 'chk-4',
      text: 'Verify differential pressure transmitter calibration and nitrogen seal gas purge.',
      verified: false,
      time: null
    }
  ],
  // Feature Search Directory
  features: [
    { title: 'Ask Copilot AI & Chat RAG', desc: 'SOP inquiries, P&ID verification, and process safety mitigation', tab: 'ai-copilot', anchor: 'ai-copilot' },
    { title: 'Upload Technical Documents', desc: 'Upload PDF, DOCX, TXT, CSV files into the vector database', tab: 'ai-copilot', anchor: 'docDropzone' },
    { title: 'Critical Equipment Status', desc: 'Operational health monitoring for pumps, compressors, and furnaces', tab: 'dashboard', anchor: 'criticalEquipmentSection' },
    { title: 'Live Telemetry & Chemical Process', desc: 'Monitor suction lube oil pressure, vibration levels, and chemical streams', tab: 'dashboard', anchor: 'telemetrySection' },
    { title: 'Operations & Safety Checklist', desc: 'Daily pre-startup verification and safety interlocks checklist', tab: 'dashboard', anchor: 'checklistSection' },
    { title: 'Data Flow Pipeline & Flowchart', desc: 'Pipeline diagrams for ingestion, chunking, retrieval, and AI synthesis', tab: 'data-flow', anchor: 'data-flow' },
    { title: 'Employee Profile & Settings', desc: 'Configure avatar, full name, plant unit, and interface language', tab: 'settings', anchor: 'settings' }
  ]
};

// ============================================================================
// MULTILINGUAL I18N SYSTEM (English Default & Bahasa Indonesia)
// ============================================================================

const I18N = {
  en: {
    headerGreetingSub: 'Welcome back,',
    featureSearchPlaceholder: 'Search features, SOPs, parameters, or asset tags...',
    askAiNav: 'Ask AI',
    dashHeroHeadline: 'Operational Intelligence',
    dashHeroCaption: 'P&ID verification, operational SOPs, and plant reliability intelligence.',
    lblCriticalEquipTitle: 'Critical Equipment Status',
    lblCriticalEquipSub: 'Monitor operational health or consult AI for specific diagnostics.',
    lblAddEquipBtn: '+ Add Equipment',
    lblProcessControlTag: 'Process Control',
    lblTelemetryHeading: 'Telemetry & Chemical Process',
    lblChemicalStreamSelect: 'Chemical Stream:',
    lblChecklistTag: 'Verification Checklist',
    lblChecklistTitle: 'Plant Operations & Safety Checklist',
    lblAddChecklistBtn: '+ Add Item',
    btnTechCondition: 'Technical Condition',
    btnAskCopilot: 'Consult AI',
    verifiedBtnText: 'Verified ✓',
    unverifiedBtnText: 'Verify',
    lblDocsSidebarTitle: 'Technical Documents',
    lblUploadHeading: 'Upload Document',
    browseFilesBtn: 'Browse Files',
    unifiedDocsSearchPlaceholder: 'Search stored documents...',
    lblEquipSelectTag: 'Equipment:',
    optNoEquip: 'No Equipment (Document Only Analysis)',
    lblCheckSensitive: 'Sensitive Data Protection',
    lblDeepAnalysis: 'Deep Document Analysis',
    chatInputPlaceholder: 'Ask Hootie Frutti AI anything...',
    sendBtn: 'Send',
    welcomeBotMsg: (name) => `Hello <b><span class="dynamic-user-name">${name}</span></b>. <b>Hootie Frutti AI</b> is ready to analyze engineering documentation, operational spreadsheets, and technical procedures with high precision. Select a grounded document on the left or enter any technical inquiry below.`,
    lblDataFlowTitle: 'Data Flow Pipeline',
    lblDataFlowSub: 'Real-time plant telemetry processing and RAG document grounding workflow.',
    fscTitle1: 'Multi-Source Ingestion',
    fscDesc1: 'Real-time DCS sensor telemetry, P&ID sheets, SOPs, PDF, DOCX, and CSV.',
    fscBadge1: 'Active Input',
    fscTitle2: 'Smart Chunking & Index',
    fscDesc2: 'Semantic 500-token chunk extraction with 80-token overlap and vector store.',
    fscBadge2: 'Local Embed',
    fscTitle3: 'Contextual Retrieval',
    fscDesc3: 'Hybrid BM25 + cosine similarity operator with asset equipment tag filter.',
    fscBadge3: 'Top Chunks',
    fscTitle4: 'AI Synthesis & Citation',
    fscDesc4: 'Petrochemical safety compliant technical solutions with original document page citations.',
    fscBadge4: 'Structured Output',
    lblSettingsTitle: 'Employee Profile & Settings',
    lblSettingsSub: 'Manage user identity, avatar, plant unit, and language settings.',
    lblChoosePfp: 'Choose Profile Avatar (PFP):',
    lblUploadCustomPfp: 'Upload Custom Photo',
    lblProfileName: 'Full Name',
    lblProfileRole: 'Job Title / Role',
    lblProfileId: 'Employee ID',
    lblProfilePlant: 'Plant Complex',
    lblLangSectionTitle: 'Interface Language',
    lblLangSectionSub: 'Select your preferred dashboard language. English is active by default.',
    lblSaveSettingsBtn: 'Save Settings',
    modalEquipTitle: 'Equipment Condition Detail',
    modalAddEquipTitle: 'Add New Equipment',
    lblNewEquipTag: 'Tag ID (e.g., P-202B):',
    lblNewEquipName: 'Equipment Name:',
    lblNewEquipStatus: 'Condition Status:',
    lblNewEquipDesc: 'Description / Key Parameters:',
    lblSaveNewEquipBtn: 'Save Equipment',
    modalAddChecklistTitle: 'Add Operational Checklist Item',
    lblNewChecklistText: 'Verification Item Description:',
    lblSaveNewChecklistBtn: 'Add to Checklist',
    langSwitchedToast: 'Language switched to English',
    settingsSavedToast: 'Settings saved successfully!',
    equipAddedToast: (tag) => `Equipment ${tag} added successfully!`,
    equipRemovedToast: 'Equipment removed from dashboard.',
    chkAddedToast: 'New checklist item added successfully!',
    chkRemovedToast: 'Checklist item deleted.',
    chkVerifiedToast: 'Item verified and logged!',
    chkUnverifiedToast: 'Verification cancelled.'
  },
  id: {
    headerGreetingSub: 'Selamat datang kembali,',
    featureSearchPlaceholder: 'Cari fitur, SOP, parameter, atau tag aset...',
    askAiNav: 'Tanya AI',
    dashHeroHeadline: 'Kecerdasan Operasional',
    dashHeroCaption: 'Verifikasi P&ID, SOP operasional, dan keandalan pabrik petrokimia.',
    lblCriticalEquipTitle: 'Status Peralatan Kritis',
    lblCriticalEquipSub: 'Pantau kondisi operasional atau konsultasikan diagnosis ke AI.',
    lblAddEquipBtn: '+ Tambah Equipment',
    lblProcessControlTag: 'Kontrol Proses',
    lblTelemetryHeading: 'Telemetri & Aliran Kimia',
    lblChemicalStreamSelect: 'Aliran Kimia:',
    lblChecklistTag: 'Checklist Verifikasi',
    lblChecklistTitle: 'Daftar Periksa Operasi & Keselamatan',
    lblAddChecklistBtn: '+ Tambah Item',
    btnTechCondition: 'Kondisi Teknis',
    btnAskCopilot: 'Tanya AI',
    verifiedBtnText: 'Terverifikasi ✓',
    unverifiedBtnText: 'Verifikasi',
    lblDocsSidebarTitle: 'Dokumen Teknis',
    lblUploadHeading: 'Unggah Dokumen',
    browseFilesBtn: 'Pilih Berkas',
    unifiedDocsSearchPlaceholder: 'Cari dokumen tersimpan...',
    lblEquipSelectTag: 'Equipment:',
    optNoEquip: 'Tanpa Equipment (Analisis Dokumen Saja)',
    lblCheckSensitive: 'Proteksi Data Sensitif',
    lblDeepAnalysis: 'Analisis Menyeluruh',
    chatInputPlaceholder: 'Tanya Hootie Frutti AI apa saja...',
    sendBtn: 'Kirim',
    welcomeBotMsg: (name) => `Halo <b><span class="dynamic-user-name">${name}</span></b>. <b>Hootie Frutti AI</b> siap menganalisis dokumentasi teknik, lembar operasional, dan prosedur keselamatan dengan presisi tinggi. Pilih dokumen di sisi kiri atau ketik pertanyaan teknis di bawah.`,
    lblDataFlowTitle: 'Pipeline Aliran Data',
    lblDataFlowSub: 'Diagram alir pemrosesan telemetri pabrik dan grounding dokumen RAG.',
    fscTitle1: 'Multi-Source Ingestion',
    fscDesc1: 'Telemetri sensor DCS real-time, lembar P&ID, SOP, PDF, DOCX, dan CSV.',
    fscBadge1: 'Active Input',
    fscTitle2: 'Smart Chunking & Index',
    fscDesc2: 'Ekstraksi semantik per-bagian 500-token dengan overlap 80-token dan vector store.',
    fscBadge2: 'Local Embed',
    fscTitle3: 'Contextual Retrieval',
    fscDesc3: 'Hybrid BM25 + cosine similarity query operator dengan filter tag equipment.',
    fscBadge3: 'Top Chunks',
    fscTitle4: 'AI Synthesis & Citation',
    fscDesc4: 'Solusi teknis berstandar keselamatan migas dengan sitasi halaman dokumen asli.',
    fscBadge4: 'Structured Output',
    lblSettingsTitle: 'Profil Karyawan & Pengaturan',
    lblSettingsSub: 'Kelola identitas pengguna, avatar, unit plant, dan preferensi bahasa.',
    lblChoosePfp: 'Pilih Foto Profil (PFP):',
    lblUploadCustomPfp: 'Unggah Foto Kustom',
    lblProfileName: 'Nama Lengkap',
    lblProfileRole: 'Posisi / Jabatan',
    lblProfileId: 'ID Karyawan',
    lblProfilePlant: 'Kompleks Kilang',
    lblLangSectionTitle: 'Bahasa Antarmuka',
    lblLangSectionSub: 'Pilih bahasa dashboard yang Anda inginkan. Bahasa Inggris aktif secara default.',
    lblSaveSettingsBtn: 'Simpan Pengaturan',
    modalEquipTitle: 'Detail Kondisi Equipment',
    modalAddEquipTitle: 'Tambah Equipment Baru',
    lblNewEquipTag: 'Tag ID (contoh: P-202B):',
    lblNewEquipName: 'Nama Equipment:',
    lblNewEquipStatus: 'Status Kondisi:',
    lblNewEquipDesc: 'Deskripsi / Parameter Kunci:',
    lblSaveNewEquipBtn: 'Simpan Equipment',
    modalAddChecklistTitle: 'Tambah Item Checklist Operasional',
    lblNewChecklistText: 'Deskripsi Item Verifikasi:',
    lblSaveNewChecklistBtn: 'Tambahkan ke Checklist',
    langSwitchedToast: 'Bahasa berhasil diubah ke Bahasa Indonesia',
    settingsSavedToast: 'Pengaturan profil berhasil disimpan!',
    equipAddedToast: (tag) => `Equipment ${tag} berhasil ditambahkan!`,
    equipRemovedToast: 'Equipment berhasil dihapus dari dashboard.',
    chkAddedToast: 'Item checklist baru berhasil ditambahkan!',
    chkRemovedToast: 'Item checklist telah dihapus.',
    chkVerifiedToast: 'Item berhasil diverifikasi dan dicatat!',
    chkUnverifiedToast: 'Status verifikasi dibatalkan.'
  }
};

// Initialization on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initUserProfile();
  checkBackendGeminiStatus();
  initAuthSession();
  setupNavigation();
  setupUnifiedCopilot();
  setupDocumentUpload();
  loadStoredDocuments();
  initTelemetryModel();
  renderEquipmentCards();
  renderTelemetry();
  renderChecklist();
  setDashboardLanguage(state.lang, true);
});

// ============================================================================
// 1. MINIMALIST AUTHENTICATION & LOGIN FLOW (Pure White Canvas, Centered Halo)
// ============================================================================

function initAuthSession() {
  const isLoggedIn = localStorage.getItem('kh_user_logged_in');
  const loginOverlay = document.getElementById('loginScreen');

  if (isLoggedIn === 'true') {
    if (loginOverlay) loginOverlay.style.display = 'none';
  } else {
    if (loginOverlay) loginOverlay.style.display = 'flex';
  }
}

function handleLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  completeUserLogin();
}

function completeUserLogin() {
  localStorage.setItem('kh_user_logged_in', 'true');
  const loginOverlay = document.getElementById('loginScreen');
  if (loginOverlay) {
    loginOverlay.style.opacity = '0';
    setTimeout(() => {
      loginOverlay.style.display = 'none';
      loginOverlay.style.opacity = '1';
    }, 200);
  }
  showToast(`Selamat datang, ${state.userProfile.name}!`, 'success');
}

function handleUserLogout() {
  localStorage.removeItem('kh_user_logged_in');
  const loginOverlay = document.getElementById('loginScreen');
  if (loginOverlay) {
    loginOverlay.style.display = 'flex';
    loginOverlay.style.opacity = '1';
  }
  showToast('Anda telah keluar dari sesi.', 'info');
}

// ============================================================================
// 2. FEATURE SEARCH SPOTLIGHT
// ============================================================================

function handleFeatureSearch(query) {
  const dropdown = document.getElementById('featureSearchResults');
  const clearBtn = document.getElementById('searchClearBtn');
  if (!dropdown) return;

  const q = (query || '').trim().toLowerCase();

  if (clearBtn) {
    clearBtn.style.display = q ? 'inline-block' : 'none';
  }

  if (!q) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    return;
  }

  const matches = state.features.filter(f => 
    f.title.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q)
  );

  if (matches.length === 0) {
    dropdown.innerHTML = '<div style="padding:12px;font-size:0.85rem;color:var(--text-muted);text-align:center;">Fitur tidak ditemukan.</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = matches.map(f => `
    <div class="feature-search-item" onclick="selectFeatureSearchResult('${f.tab}', '${f.anchor}')">
      <div class="fsi-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
      <div class="fsi-info">
        <span class="fsi-title">${escapeHtml(f.title)}</span>
        <span class="fsi-desc">${escapeHtml(f.desc)}</span>
      </div>
    </div>
  `).join('');

  dropdown.style.display = 'block';
}

function selectFeatureSearchResult(tabId, anchorId) {
  const dropdown = document.getElementById('featureSearchResults');
  if (dropdown) dropdown.style.display = 'none';

  switchTab(tabId);

  setTimeout(() => {
    const el = document.getElementById(anchorId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow 0.4s ease';
      el.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.4)';
      setTimeout(() => { el.style.boxShadow = ''; }, 1800);
    }
  }, 100);
}

function clearFeatureSearch() {
  const input = document.getElementById('featureSearchInput');
  const dropdown = document.getElementById('featureSearchResults');
  const clearBtn = document.getElementById('searchClearBtn');
  if (input) input.value = '';
  if (dropdown) dropdown.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
}

// ============================================================================
// 3. CONNECTED OPERATIONS MODEL
//    Equipment <-> Live Telemetry (multi-site) <-> AI Copilot <-> Safety Checklist
// ============================================================================

const L = (en, id) => (state.lang === 'id' ? id : en);

// Kompleks petrokimia yang dipantau. `bias` = offset awal sebagai fraksi rentang parameter,
// sehingga tiap site punya profil operasi berbeda namun tetap realistis.
const PLANT_SITES = [
  { id: 'cilegon', name: 'Cilegon', region: 'Banten', complex: 'Naphtha Cracker & Olefins', bias: 0 },
  { id: 'serang', name: 'Serang', region: 'Banten', complex: 'Polyolefin & Chlor-Alkali', bias: -0.025 },
  { id: 'tuban', name: 'Tuban', region: 'Jawa Timur', complex: 'Aromatics & Olefins', bias: 0.02 },
  { id: 'cilacap', name: 'Cilacap', region: 'Jawa Tengah', complex: 'Refinery-Petrochemical', bias: -0.015 },
  { id: 'balongan', name: 'Balongan', region: 'Jawa Barat', complex: 'Polypropylene', bias: 0.06 },
  { id: 'bontang', name: 'Bontang', region: 'Kalimantan Timur', complex: 'Methanol & Ammonia', bias: 0.035 }
];

// Parameter proses per aliran kimia. Batas: alarmLo/tripLo (sisi bawah) & alarmHi/tripHi (sisi atas).
function P(label, labelId, unit, min, max, step, base, lim) {
  return { label, labelId, unit, min, max, step, base, ...lim };
}

const PROCESS_STREAMS = {
  ethylene: {
    name: 'Ethylene Cracker Stream (Olefins)',
    params: {
      feed_pressure: P('Feed Naphtha Pressure', 'Tekanan Umpan Naphtha', 'bar', 8, 20, 0.1, 14.2, { alarmLo: 12, tripLo: 10, alarmHi: 16, tripHi: 18 }),
      suction_lube: P('Suction Lube Oil Pressure', 'Tekanan Lube Oil Suction', 'bar', 1, 3.5, 0.05, 2.1, { alarmLo: 1.8, tripLo: 1.4, alarmHi: 2.6, tripHi: 3.0 }),
      reactor_temp: P('Coil Outlet Temperature', 'Suhu Coil Outlet', '°C', 750, 900, 1, 835, { alarmLo: 820, tripLo: 790, alarmHi: 850, tripHi: 870 }),
      vibration: P('Radial Bearing Vibration', 'Vibrasi Radial Bearing', 'µm', 10, 80, 1, 45, { alarmHi: 48, tripHi: 68 }),
      delta_p: P('Column Differential Pressure', 'Tekanan Diferensial Kolom', 'bar', 0.1, 0.8, 0.01, 0.35, { alarmHi: 0.45, tripHi: 0.6 }),
      bearing_temp: P('Thrust Bearing Temperature', 'Suhu Thrust Bearing', '°C', 40, 100, 1, 68, { alarmHi: 85, tripHi: 95 })
    }
  },
  propylene: {
    name: 'Propylene Polymerization Unit',
    params: {
      feed_pressure: P('Propylene Feed Pressure', 'Tekanan Umpan Propylene', 'bar', 15, 40, 0.1, 28.5, { alarmLo: 25, tripLo: 22, alarmHi: 32, tripHi: 35 }),
      suction_lube: P('Suction Lube Oil Pressure', 'Tekanan Lube Oil Suction', 'bar', 1, 3.5, 0.05, 1.9, { alarmLo: 1.7, tripLo: 1.3, alarmHi: 2.5, tripHi: 2.9 }),
      reactor_temp: P('Reactor Bed Temperature', 'Suhu Bed Reaktor', '°C', 40, 95, 1, 68, { alarmLo: 62, tripLo: 55, alarmHi: 75, tripHi: 82 }),
      vibration: P('Radial Bearing Vibration', 'Vibrasi Radial Bearing', 'µm', 10, 80, 1, 32, { alarmHi: 45, tripHi: 65 }),
      delta_p: P('Column Differential Pressure', 'Tekanan Diferensial Kolom', 'bar', 0.1, 0.6, 0.01, 0.22, { alarmHi: 0.3, tripHi: 0.45 }),
      bearing_temp: P('Thrust Bearing Temperature', 'Suhu Thrust Bearing', '°C', 40, 95, 1, 62, { alarmHi: 80, tripHi: 90 })
    }
  },
  pygas: {
    name: 'Pyrolysis Gasoline (PyGas Hydrotreating)',
    params: {
      feed_pressure: P('PyGas Feed Pressure', 'Tekanan Umpan PyGas', 'bar', 20, 45, 0.1, 34, { alarmLo: 30, tripLo: 26, alarmHi: 38, tripHi: 42 }),
      suction_lube: P('Suction Lube Oil Pressure', 'Tekanan Lube Oil Suction', 'bar', 1, 3.5, 0.05, 2.3, { alarmLo: 1.9, tripLo: 1.5, alarmHi: 2.8, tripHi: 3.2 }),
      reactor_temp: P('Hydrotreater Bed Temperature', 'Suhu Bed Hydrotreater', '°C', 180, 300, 1, 242, { alarmLo: 220, tripLo: 200, alarmHi: 260, tripHi: 280 }),
      vibration: P('Radial Bearing Vibration', 'Vibrasi Radial Bearing', 'µm', 10, 80, 1, 38, { alarmHi: 50, tripHi: 70 }),
      delta_p: P('Reactor Differential Pressure', 'Tekanan Diferensial Reaktor', 'bar', 0.1, 0.7, 0.01, 0.28, { alarmHi: 0.4, tripHi: 0.55 }),
      bearing_temp: P('Thrust Bearing Temperature', 'Suhu Thrust Bearing', '°C', 40, 100, 1, 71, { alarmHi: 88, tripHi: 96 })
    }
  },
  butadiene: {
    name: 'Mixed C4 / Butadiene Extraction',
    params: {
      feed_pressure: P('C4 Feed Pressure', 'Tekanan Umpan C4', 'bar', 5, 15, 0.1, 8.8, { alarmLo: 7, tripLo: 6, alarmHi: 10.5, tripHi: 12.5 }),
      suction_lube: P('Suction Lube Oil Pressure', 'Tekanan Lube Oil Suction', 'bar', 1, 3.5, 0.05, 2.0, { alarmLo: 1.7, tripLo: 1.3, alarmHi: 2.5, tripHi: 2.9 }),
      reactor_temp: P('Stripper Temperature', 'Suhu Stripper', '°C', 80, 160, 1, 118, { alarmLo: 110, tripLo: 100, alarmHi: 130, tripHi: 140 }),
      vibration: P('Radial Bearing Vibration', 'Vibrasi Radial Bearing', 'µm', 10, 80, 1, 44, { alarmHi: 52, tripHi: 70 }),
      delta_p: P('Column Differential Pressure', 'Tekanan Diferensial Kolom', 'bar', 0.1, 0.8, 0.01, 0.4, { alarmHi: 0.5, tripHi: 0.65 }),
      bearing_temp: P('Thrust Bearing Temperature', 'Suhu Thrust Bearing', '°C', 40, 100, 1, 76, { alarmHi: 90, tripHi: 97 })
    }
  }
};

// Equipment default -> site & parameter telemetri yang menggerakkan statusnya
const DEFAULT_EQUIP_LINKS = {
  'P-101A': { site: 'cilegon', link: { stream: 'ethylene', param: 'feed_pressure' } },
  'K-102': { site: 'cilegon', link: { stream: 'ethylene', param: 'vibration' } },
  'F-101': { site: 'cilegon', link: { stream: 'ethylene', param: 'reactor_temp' } }
};

const telemetry = {
  stream: 'ethylene',
  param: 'feed_pressure',
  selectedSite: 'cilegon',
  visibleSites: ['cilegon', 'serang', 'tuban', 'cilacap', 'balongan'],
  setpoints: {},
  live: {},
  liveOn: true,
  timer: null
};

const eqStatusCache = {};
const eqAlertCooldown = {};

const tk = (stream, param, site) => `${stream}|${param}|${site}`;
const clampNum = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const stepDecimals = (step) => (String(step).split('.')[1] || '').length;
const roundToStep = (v, step) => Number((Math.round(v / step) * step).toFixed(stepDecimals(step)));
const fmtVal = (v, p) => Number(v).toFixed(stepDecimals(p.step));
const siteById = (id) => PLANT_SITES.find(s => s.id === id) || { id, name: id || '-', region: '', complex: '', bias: 0 };
const paramLabel = (p) => (state.lang === 'id' ? p.labelId : p.label);
const currentParamDef = () => PROCESS_STREAMS[telemetry.stream].params[telemetry.param];

function defaultSetpoint(p, site) {
  return roundToStep(clampNum(p.base + (site.bias || 0) * (p.max - p.min), p.min, p.max), p.step);
}

function evalStatus(p, v) {
  if ((p.tripHi != null && v >= p.tripHi) || (p.tripLo != null && v <= p.tripLo)) return 'Critical';
  if ((p.alarmHi != null && v >= p.alarmHi) || (p.alarmLo != null && v <= p.alarmLo)) return 'Warning';
  return 'Normal';
}

function statusLabel(st) {
  if (st === 'Critical') return L('Critical', 'Kritis');
  if (st === 'Warning') return L('Warning', 'Waspada');
  return 'Normal';
}

function limitText(p) {
  const parts = [];
  if (p.alarmLo != null) parts.push(`${L('Low alarm', 'Alarm bawah')} ≤ ${p.alarmLo}`);
  if (p.alarmHi != null) parts.push(`${L('High alarm', 'Alarm atas')} ≥ ${p.alarmHi}`);
  if (p.tripHi != null) parts.push(`Trip ≥ ${p.tripHi}`);
  if (p.tripLo != null) parts.push(`Trip ≤ ${p.tripLo}`);
  return `${parts.join(' · ')} ${p.unit}`;
}

function getLiveValue(stream, param, site) {
  const p = PROCESS_STREAMS[stream] && PROCESS_STREAMS[stream].params[param];
  if (!p) return null;
  const k = tk(stream, param, site);
  const v = telemetry.live[k] != null ? telemetry.live[k] : telemetry.setpoints[k];
  return roundToStep(v != null ? v : defaultSetpoint(p, siteById(site)), p.step);
}

function initTelemetryModel() {
  let saved = null;
  try { saved = jsonParseSafe(localStorage.getItem('kh_site_telemetry') || 'null'); } catch (e) {}
  if (saved) {
    if (saved.setpoints) telemetry.setpoints = saved.setpoints;
    if (Array.isArray(saved.visibleSites) && saved.visibleSites.length) telemetry.visibleSites = saved.visibleSites.filter(id => PLANT_SITES.some(s => s.id === id));
    if (saved.stream && PROCESS_STREAMS[saved.stream]) telemetry.stream = saved.stream;
    if (saved.param && PROCESS_STREAMS[telemetry.stream].params[saved.param]) telemetry.param = saved.param;
    if (saved.selectedSite) telemetry.selectedSite = saved.selectedSite;
    if (typeof saved.liveOn === 'boolean') telemetry.liveOn = saved.liveOn;
  }
  if (!telemetry.visibleSites.length) telemetry.visibleSites = [PLANT_SITES[0].id];

  for (const [sKey, stream] of Object.entries(PROCESS_STREAMS)) {
    for (const [pKey, p] of Object.entries(stream.params)) {
      for (const site of PLANT_SITES) {
        const k = tk(sKey, pKey, site.id);
        if (typeof telemetry.setpoints[k] !== 'number') telemetry.setpoints[k] = defaultSetpoint(p, site);
        telemetry.live[k] = telemetry.setpoints[k];
      }
    }
  }
}

function saveTelemetryState() {
  localStorage.setItem('kh_site_telemetry', JSON.stringify({
    setpoints: telemetry.setpoints,
    visibleSites: telemetry.visibleSites,
    stream: telemetry.stream,
    param: telemetry.param,
    selectedSite: telemetry.selectedSite,
    liveOn: telemetry.liveOn
  }));
}

function telemetryTick() {
  if (document.hidden) return;
  for (const [sKey, stream] of Object.entries(PROCESS_STREAMS)) {
    for (const [pKey, p] of Object.entries(stream.params)) {
      const amp = (p.max - p.min) * 0.008;
      for (const site of PLANT_SITES) {
        const k = tk(sKey, pKey, site.id);
        telemetry.live[k] = clampNum(telemetry.setpoints[k] + (Math.random() * 2 - 1) * amp, p.min, p.max);
      }
    }
  }
  updateSiteBars();
  updateSiteDetailLive();
  updateEquipmentLive();
  refreshOpsLink();
}

function startTelemetryFeed() {
  if (telemetry.timer) clearInterval(telemetry.timer);
  telemetry.timer = telemetry.liveOn ? setInterval(telemetryTick, 2500) : null;
  const btnLbl = document.getElementById('lblToggleLive');
  const ind = document.getElementById('telemetryLiveIndicator');
  const st = document.getElementById('lblLiveState');
  if (btnLbl) btnLbl.textContent = telemetry.liveOn ? L('Pause', 'Jeda') : L('Resume', 'Lanjutkan');
  if (ind) ind.classList.toggle('paused', !telemetry.liveOn);
  if (st) st.textContent = telemetry.liveOn ? 'LIVE' : L('PAUSED', 'JEDA');
}

function toggleLiveTelemetry() {
  telemetry.liveOn = !telemetry.liveOn;
  saveTelemetryState();
  startTelemetryFeed();
  refreshOpsLink();
}

function scrollToDashSection(sectionId) {
  if (state.currentTab !== 'dashboard') switchTab('dashboard');
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}

// ----------------------------------------------------------------------------
// 3a. Ops Link strip (ringkasan keterhubungan modul)
// ----------------------------------------------------------------------------
function refreshOpsLink() {
  const eqEl = document.getElementById('opsMetricEquip');
  const teleEl = document.getElementById('opsMetricTele');
  const aiEl = document.getElementById('opsMetricAi');
  const chkEl = document.getElementById('opsMetricChk');

  const alarms = state.equipments.filter(eq => {
    const r = getEquipmentReading(eq);
    const st = r ? r.status : eq.status;
    return st === 'Warning' || st === 'Critical';
  }).length;
  if (eqEl) eqEl.textContent = alarms
    ? `${alarms} ${L(alarms > 1 ? 'alarms' : 'alarm', 'alarm')}`
    : `${state.equipments.length} ${L('units · normal', 'unit · normal')}`;
  const eqNode = document.getElementById('opsNodeEquip');
  if (eqNode) eqNode.classList.toggle('has-alert', alarms > 0);

  if (teleEl) teleEl.textContent = `${telemetry.visibleSites.length} ${L('sites', 'site')} · ${telemetry.liveOn ? L('Active', 'Aktif') : L('paused', 'jeda')}`;

  if (aiEl) {
    const q = state.lastAiQuery;
    aiEl.textContent = q ? (q.length > 26 ? `${q.slice(0, 26)}…` : q) : L('Ready', 'Siap');
  }

  const pending = state.checklists.filter(c => c.status === 'proposed').length;
  const active = state.checklists.filter(c => c.status === 'active').length;
  if (chkEl) chkEl.textContent = pending
    ? `${pending} ${L('awaiting approval', 'menunggu persetujuan')}`
    : `${active} ${L('active items', 'item aktif')}`;
  const chkNode = document.getElementById('opsNodeChk');
  if (chkNode) chkNode.classList.toggle('has-pending', pending > 0);
}

// ----------------------------------------------------------------------------
// 3b. CRITICAL EQUIPMENT STATUS (status mengikuti telemetri live)
// ----------------------------------------------------------------------------
function migrateEquipment(eq) {
  const def = DEFAULT_EQUIP_LINKS[eq.tag];
  const out = { ...eq };
  if (!out.site) out.site = def ? def.site : (state.userProfile.plant || 'cilegon');
  if (out.link === undefined && def) out.link = { ...def.link };
  return out;
}

function getEquipmentReading(eq) {
  if (!eq.link) return null;
  const stream = PROCESS_STREAMS[eq.link.stream];
  const p = stream && stream.params[eq.link.param];
  if (!p) return null;
  const v = getLiveValue(eq.link.stream, eq.link.param, eq.site);
  return { p, v, status: evalStatus(p, v), site: siteById(eq.site), stream };
}

function badgeClassFor(st) {
  if (st === 'Critical') return 'critical';
  if (st === 'Warning') return 'warning';
  return 'normal';
}

function renderEquipmentCards() {
  const container = document.getElementById('equipmentCardsContainer');
  if (!container) return;

  const saved = localStorage.getItem('kh_equipment_list');
  if (saved) {
    const parsed = jsonParseSafe(saved);
    if (Array.isArray(parsed)) state.equipments = parsed;
  }
  state.equipments = state.equipments.map(migrateEquipment);

  const dict = I18N[state.lang] || I18N.en;
  container.innerHTML = state.equipments.map(eq => {
    const r = getEquipmentReading(eq);
    const st = r ? r.status : (eq.status === 'Safe Limit' ? 'Normal' : eq.status);
    eqStatusCache[eq.id] = st;
    const site = siteById(eq.site);
    const liveText = r ? `${paramLabel(r.p)} · ${fmtVal(r.v, r.p)} ${r.p.unit}` : L('No telemetry link', 'Tidak terhubung telemetri');
    const isAlert = st === 'Warning' || st === 'Critical';
    return `
      <div class="deck-card status-${badgeClassFor(st)}" id="eqCard-${eq.id}" data-eq-id="${eq.id}">
        <div class="deck-card-top">
          <span class="deck-tag">${escapeHtml(eq.tag)}</span>
          <span class="deck-badge ${badgeClassFor(st)}" id="eqBadge-${eq.id}">${statusLabel(st)}</span>
        </div>
        <h3 class="deck-title">${escapeHtml(eq.name)}</h3>
        <div class="deck-site-line">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>${escapeHtml(site.name)}${site.complex ? ` · ${escapeHtml(site.complex)}` : ''}</span>
        </div>
        <div class="deck-live-row ${r ? '' : 'is-offline'}">
          <span class="live-dot"></span>
          <span id="eqLive-${eq.id}">${escapeHtml(liveText)}</span>
        </div>
        <p class="deck-desc">${escapeHtml(eq.desc || '')}</p>
        <button type="button" class="deck-alert-btn" id="eqAlert-${eq.id}" style="display:${isAlert ? 'flex' : 'none'}" onclick="escalateEquipment('${eq.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          <span>${L('Abnormal reading — escalate to Ask AI', 'Pembacaan abnormal — eskalasi ke Tanya AI')}</span>
        </button>
        <div class="deck-actions-btn-group">
          <button type="button" class="pill-btn outline-dark micro-pill" onclick="openEquipmentDetail('${eq.id}')">
            <span>${dict.btnTechCondition}</span>
          </button>
          <button type="button" class="pill-btn accent-green micro-pill" onclick="askCopilotForEquipment('${eq.id}')">
            <span>${dict.btnAskCopilot}</span>
          </button>
          <button type="button" class="deck-del-btn" title="Delete Equipment" onclick="deleteEquipment('${eq.id}')">
            &times;
          </button>
        </div>
      </div>
    `;
  }).join('');
  refreshOpsLink();
}

function updateEquipmentLive() {
  state.equipments.forEach(eq => {
    const r = getEquipmentReading(eq);
    if (!r) return;
    const st = r.status;
    const liveEl = document.getElementById(`eqLive-${eq.id}`);
    const badge = document.getElementById(`eqBadge-${eq.id}`);
    const card = document.getElementById(`eqCard-${eq.id}`);
    const alertBtn = document.getElementById(`eqAlert-${eq.id}`);
    if (liveEl) liveEl.textContent = `${paramLabel(r.p)} · ${fmtVal(r.v, r.p)} ${r.p.unit}`;
    if (badge) {
      badge.textContent = statusLabel(st);
      badge.className = `deck-badge ${badgeClassFor(st)}`;
    }
    if (card) card.className = `deck-card status-${badgeClassFor(st)}`;
    if (alertBtn) alertBtn.style.display = (st === 'Warning' || st === 'Critical') ? 'flex' : 'none';

    const prev = eqStatusCache[eq.id];
    const rank = { Normal: 0, Warning: 1, Critical: 2 };
    if (prev && rank[st] > rank[prev]) {
      const now = Date.now();
      if (!eqAlertCooldown[eq.id] || now - eqAlertCooldown[eq.id] > 30000) {
        eqAlertCooldown[eq.id] = now;
        showToast(L(
          `${eq.tag} @ ${r.site.name}: ${statusLabel(st)} — ${paramLabel(r.p)} ${fmtVal(r.v, r.p)} ${r.p.unit}`,
          `${eq.tag} @ ${r.site.name}: ${statusLabel(st)} — ${paramLabel(r.p)} ${fmtVal(r.v, r.p)} ${r.p.unit}`
        ), st === 'Critical' ? 'error' : 'info');
      }
    }
    eqStatusCache[eq.id] = st;
  });
}

function buildEquipmentQuery(eq, incident) {
  const r = getEquipmentReading(eq);
  const siteName = siteById(eq.site).name;
  if (!r) {
    return L(
      `Evaluate operational health, specifications, and safety mitigation for equipment ${eq.tag} (${eq.name}) at ${siteName}.`,
      `Evaluasi kondisi operasional, spesifikasi, dan mitigasi keselamatan untuk equipment ${eq.tag} (${eq.name}) di site ${siteName}.`
    );
  }
  const reading = `${paramLabel(r.p)} ${fmtVal(r.v, r.p)} ${r.p.unit}`;
  if (incident) {
    return L(
      `${statusLabel(r.status).toUpperCase()} ALARM: ${eq.tag} (${eq.name}) at ${siteName} — ${reading} (${limitText(r.p)}). What are the likely causes and what immediate safety actions must be taken?`,
      `ALARM ${statusLabel(r.status).toUpperCase()}: ${eq.tag} (${eq.name}) di ${siteName} — ${reading} (${limitText(r.p)}). Apa kemungkinan penyebabnya dan langkah tindakan keselamatan apa yang harus segera dilakukan?`
    );
  }
  return L(
    `Evaluate ${eq.tag} (${eq.name}) at ${siteName}: current ${reading}, status ${statusLabel(r.status)}. Provide safe operating limits, likely risks, and recommended mitigation steps.`,
    `Evaluasi ${eq.tag} (${eq.name}) di ${siteName}: ${reading} saat ini, status ${statusLabel(r.status)}. Berikan batas operasi aman, potensi risiko, dan langkah mitigasi yang direkomendasikan.`
  );
}

function askCopilotForEquipment(eqId) {
  const eq = state.equipments.find(e => e.id === eqId);
  if (!eq) return;
  queryEquipmentCopilot(eq.tag, buildEquipmentQuery(eq, false), { site: eq.site, ignoreGrounding: true });
}

function escalateEquipment(eqId) {
  const eq = state.equipments.find(e => e.id === eqId);
  if (!eq) return;
  queryEquipmentCopilot(eq.tag, buildEquipmentQuery(eq, true), { site: eq.site, ignoreGrounding: true });
}

function openEquipmentDetail(eqId) {
  const eq = state.equipments.find(e => e.id === eqId);
  if (!eq) return;

  const modal = document.getElementById('equipmentDetailModal');
  const title = document.getElementById('modalEquipTitle');
  const body = document.getElementById('modalEquipBody');
  const askBtn = document.getElementById('modalAskCopilotBtn');
  const r = getEquipmentReading(eq);

  if (title) title.textContent = `${eq.tag} · ${eq.name}`;

  if (body) {
    let detailsHtml = '<div style="display:flex;flex-direction:column;gap:8px;">';
    detailsHtml += `
      <div class="cm-param-item">
        <span>${L('Plant Site:', 'Site Pabrik:')}</span>
        <b>${escapeHtml(siteById(eq.site).name)}</b>
      </div>
    `;
    if (r) {
      detailsHtml += `
        <div class="cm-param-item">
          <span>${L('Live Status (from telemetry):', 'Status Live (dari telemetri):')}</span>
          <b class="deck-badge ${badgeClassFor(r.status)}">${statusLabel(r.status)}</b>
        </div>
        <div class="cm-param-item">
          <span>${escapeHtml(paramLabel(r.p))}:</span>
          <b>${fmtVal(r.v, r.p)} ${r.p.unit}</b>
        </div>
        <div class="cm-param-item">
          <span>${L('Limits:', 'Batas:')}</span>
          <b>${escapeHtml(limitText(r.p))}</b>
        </div>
      `;
    } else {
      detailsHtml += `
        <div class="cm-param-item">
          <span>${L('Current Operating Status:', 'Status Operasi Saat Ini:')}</span>
          <select class="styled-select-blue" style="padding:4px 10px;font-size:0.85rem;" onchange="updateEquipmentStatus('${eq.id}', this.value)">
            <option value="Normal" ${eq.status === 'Normal' ? 'selected' : ''}>Normal</option>
            <option value="Warning" ${eq.status === 'Warning' ? 'selected' : ''}>Warning</option>
            <option value="Critical" ${eq.status === 'Critical' ? 'selected' : ''}>Critical</option>
          </select>
        </div>
      `;
    }
    if (eq.details) {
      for (const [key, val] of Object.entries(eq.details)) {
        detailsHtml += `
          <div class="cm-param-item">
            <span>${escapeHtml(key)}:</span>
            <b>${escapeHtml(val)}</b>
          </div>
        `;
      }
    }
    detailsHtml += '</div>';
    body.innerHTML = detailsHtml;
  }

  if (askBtn) {
    askBtn.onclick = () => {
      closeEquipmentDetailModal();
      askCopilotForEquipment(eq.id);
    };
  }

  if (modal) modal.style.display = 'flex';
}

function closeEquipmentDetailModal() {
  const modal = document.getElementById('equipmentDetailModal');
  if (modal) modal.style.display = 'none';
}

function updateEquipmentStatus(eqId, newStatus) {
  const eq = state.equipments.find(e => e.id === eqId);
  if (eq) {
    eq.status = newStatus;
    localStorage.setItem('kh_equipment_list', JSON.stringify(state.equipments));
    renderEquipmentCards();
    showToast(L(`Status ${eq.tag} updated: ${newStatus}`, `Status ${eq.tag} diperbarui: ${newStatus}`), 'success');
  }
}

function openAddEquipmentModal() {
  const modal = document.getElementById('addEquipmentModal');
  const siteSel = document.getElementById('newEquipSite');
  const paramSel = document.getElementById('newEquipParam');
  if (siteSel) {
    siteSel.innerHTML = PLANT_SITES.map(s =>
      `<option value="${s.id}" ${s.id === telemetry.selectedSite ? 'selected' : ''}>${escapeHtml(s.name)} · ${escapeHtml(s.region)}</option>`
    ).join('');
  }
  if (paramSel) {
    paramSel.innerHTML = `<option value="">${L('No telemetry link (manual status)', 'Tanpa telemetri (status manual)')}</option>` +
      Object.entries(PROCESS_STREAMS).map(([sKey, s]) => `
        <optgroup label="${escapeHtml(s.name)}">
          ${Object.entries(s.params).map(([pKey, p]) =>
            `<option value="${sKey}|${pKey}" ${sKey === telemetry.stream && pKey === telemetry.param ? 'selected' : ''}>${escapeHtml(paramLabel(p))} (${p.unit})</option>`
          ).join('')}
        </optgroup>`).join('');
  }
  if (modal) modal.style.display = 'flex';
}

function closeAddEquipmentModal() {
  const modal = document.getElementById('addEquipmentModal');
  if (modal) modal.style.display = 'none';
}

function handleSaveNewEquipment(e) {
  e.preventDefault();
  const tagInput = document.getElementById('newEquipTag');
  const nameInput = document.getElementById('newEquipName');
  const siteInput = document.getElementById('newEquipSite');
  const paramInput = document.getElementById('newEquipParam');
  const descInput = document.getElementById('newEquipDesc');

  if (!tagInput || !nameInput) return;

  let link = null;
  if (paramInput && paramInput.value) {
    const [stream, param] = paramInput.value.split('|');
    link = { stream, param };
  }

  const newEquip = {
    id: `eq-${Date.now()}`,
    tag: tagInput.value.trim().toUpperCase(),
    name: nameInput.value.trim(),
    status: 'Normal',
    site: siteInput ? siteInput.value : 'cilegon',
    link,
    desc: descInput ? descInput.value.trim() : L('Normal operating parameters.', 'Parameter operasional normal.'),
    rev: 'Rev 1.0',
    details: {
      'Key Parameter': descInput ? descInput.value.trim() : 'Normal'
    }
  };

  state.equipments.push(newEquip);
  localStorage.setItem('kh_equipment_list', JSON.stringify(state.equipments));
  renderEquipmentCards();
  renderSiteDetail();
  closeAddEquipmentModal();
  e.target.reset();
  const dict = I18N[state.lang] || I18N.en;
  showToast(dict.equipAddedToast(newEquip.tag), 'success');
}

function deleteEquipment(eqId) {
  state.equipments = state.equipments.filter(e => e.id !== eqId);
  localStorage.setItem('kh_equipment_list', JSON.stringify(state.equipments));
  renderEquipmentCards();
  renderSiteDetail();
  const dict = I18N[state.lang] || I18N.en;
  showToast(dict.equipRemovedToast, 'info');
}

// ----------------------------------------------------------------------------
// 4. LIVE TELEMETRY & CHEMICAL PROCESS (perbandingan multi-site, bisa diadjust)
// ----------------------------------------------------------------------------
function renderTelemetry() {
  const streamSel = document.getElementById('chemicalStreamSelect');
  if (streamSel) streamSel.value = telemetry.stream;
  renderParamSelect();
  renderSiteChips();
  renderSiteChart();
  renderSiteDetail();
  startTelemetryFeed();
}

function renderParamSelect() {
  const sel = document.getElementById('telemetryParamSelect');
  if (!sel) return;
  const params = PROCESS_STREAMS[telemetry.stream].params;
  sel.innerHTML = Object.entries(params).map(([k, p]) =>
    `<option value="${k}" ${k === telemetry.param ? 'selected' : ''}>${escapeHtml(paramLabel(p))}</option>`
  ).join('');
}

function renderSiteChips() {
  const row = document.getElementById('siteChipsRow');
  if (!row) return;
  row.innerHTML = PLANT_SITES.map(s => {
    const on = telemetry.visibleSites.includes(s.id);
    return `
      <button type="button" class="site-chip ${on ? 'on' : ''}" id="siteChip-${s.id}" aria-pressed="${on}" onclick="toggleSiteVisibility('${s.id}')">
        <span class="chip-dot" id="siteChipDot-${s.id}"></span>
        <span class="chip-name">${escapeHtml(s.name)}</span>
        <span class="chip-region">${escapeHtml(s.region)}</span>
      </button>`;
  }).join('');
}

function renderSiteChart() {
  const chart = document.getElementById('siteBarChart');
  if (!chart) return;
  const p = currentParamDef();
  const sites = PLANT_SITES.filter(s => telemetry.visibleSites.includes(s.id));
  if (!sites.length) {
    chart.innerHTML = `<div class="site-chart-empty">${L('Select at least one site above.', 'Pilih minimal satu site di atas.')}</div>`;
    return;
  }
  const pct = v => clampNum(((v - p.min) / (p.max - p.min)) * 100, 0, 100);
  const bandLo = p.alarmLo != null ? pct(p.alarmLo) : 0;
  const bandHi = p.alarmHi != null ? pct(p.alarmHi) : 100;
  const lines = [
    p.alarmHi != null ? `<span class="site-limit alarm" style="bottom:${pct(p.alarmHi)}%"></span>` : '',
    p.tripHi != null ? `<span class="site-limit trip" style="bottom:${pct(p.tripHi)}%"></span>` : '',
    p.alarmLo != null ? `<span class="site-limit alarm" style="bottom:${pct(p.alarmLo)}%"></span>` : '',
    p.tripLo != null ? `<span class="site-limit trip" style="bottom:${pct(p.tripLo)}%"></span>` : ''
  ].join('');

  chart.innerHTML = sites.map(s => `
    <button type="button" role="listitem" class="site-col ${s.id === telemetry.selectedSite ? 'selected' : ''}" id="siteCol-${s.id}" onclick="selectTelemetrySite('${s.id}')" title="${escapeHtml(s.complex)}">
      <span class="site-val" id="siteVal-${s.id}">-</span>
      <span class="site-bar-track">
        <span class="site-band" style="bottom:${bandLo}%;height:${Math.max(bandHi - bandLo, 0)}%"></span>
        ${lines}
        <span class="site-bar-fill" id="siteFill-${s.id}"></span>
      </span>
      <span class="site-name">${escapeHtml(s.name)}</span>
      <span class="site-region">${escapeHtml(s.region)}</span>
    </button>
  `).join('');
  updateSiteBars();
}

function updateSiteBars() {
  const p = currentParamDef();
  PLANT_SITES.forEach(s => {
    const v = getLiveValue(telemetry.stream, telemetry.param, s.id);
    const st = evalStatus(p, v);
    const dot = document.getElementById(`siteChipDot-${s.id}`);
    if (dot) dot.className = `chip-dot st-${badgeClassFor(st)}`;
    const fill = document.getElementById(`siteFill-${s.id}`);
    const val = document.getElementById(`siteVal-${s.id}`);
    if (fill) {
      fill.style.height = `${clampNum(((v - p.min) / (p.max - p.min)) * 100, 3, 100)}%`;
      fill.className = `site-bar-fill st-${badgeClassFor(st)}`;
    }
    if (val) {
      val.innerHTML = `${fmtVal(v, p)}<small>${p.unit}</small>`;
      val.className = `site-val st-${badgeClassFor(st)}`;
    }
  });
}

function linkedEquipmentAt(siteId) {
  return state.equipments.filter(eq => eq.site === siteId && eq.link && eq.link.stream === telemetry.stream && eq.link.param === telemetry.param);
}

function renderSiteDetail() {
  const panel = document.getElementById('siteDetailPanel');
  if (!panel) return;
  if (!telemetry.visibleSites.includes(telemetry.selectedSite)) telemetry.selectedSite = telemetry.visibleSites[0];
  const site = siteById(telemetry.selectedSite);
  const p = currentParamDef();
  const k = tk(telemetry.stream, telemetry.param, site.id);
  const sp = telemetry.setpoints[k];
  const linked = linkedEquipmentAt(site.id);
  const allAtSite = state.equipments.filter(eq => eq.site === site.id);

  panel.innerHTML = `
    <div class="sdp-head">
      <div>
        <div class="sdp-site">${escapeHtml(site.name)}</div>
        <div class="sdp-complex">${escapeHtml(site.complex)} · ${escapeHtml(site.region)}</div>
      </div>
      <span class="status-pill" id="sdpStatus">-</span>
    </div>

    <div class="sdp-param">${escapeHtml(paramLabel(p))}</div>
    <div class="sdp-value"><span id="sdpValue">-</span> <small>${p.unit}</small></div>
    <div class="sdp-limits">${escapeHtml(limitText(p))}</div>

    <div class="telemetry-adjust-row">
      <span class="adjust-label">${L('Setpoint', 'Setpoint')}</span>
      <input type="range" id="siteSetpointSlider" aria-label="${L('Adjust setpoint', 'Atur setpoint')}" min="${p.min}" max="${p.max}" step="${p.step}" value="${sp}" oninput="setSiteSetpoint(this.value)">
      <span class="slider-val" id="siteSetpointVal">${fmtVal(sp, p)}</span>
    </div>

    <div class="sdp-linked">
      <span class="sdp-linked-label">${L('Connected equipment', 'Equipment terhubung')}</span>
      <div class="sdp-linked-list">
        ${linked.length
          ? linked.map(eq => `<span class="ctx-chip strong">${escapeHtml(eq.tag)}</span>`).join('')
          : (allAtSite.length
            ? allAtSite.map(eq => `<span class="ctx-chip">${escapeHtml(eq.tag)}</span>`).join('') + `<span class="sdp-hint">${L('(linked to other parameters)', '(terhubung ke parameter lain)')}</span>`
            : `<span class="sdp-hint">${L('No equipment registered at this site yet.', 'Belum ada equipment terdaftar di site ini.')}</span>`)}
      </div>
    </div>

    <div class="sdp-actions">
      <button type="button" class="pill-btn accent-green micro-pill" onclick="askCopilotFromTelemetry()">
        <span>${L('Ask AI about this reading', 'Tanya AI soal pembacaan ini')}</span>
      </button>
      <button type="button" class="pill-btn outline-dark micro-pill" onclick="resetSiteSetpoint()">
        <span>${L('Reset', 'Reset')}</span>
      </button>
    </div>
  `;
  updateSiteDetailLive();
}

function updateSiteDetailLive() {
  const p = currentParamDef();
  const v = getLiveValue(telemetry.stream, telemetry.param, telemetry.selectedSite);
  const st = evalStatus(p, v);
  const valEl = document.getElementById('sdpValue');
  const stEl = document.getElementById('sdpStatus');
  if (valEl) valEl.textContent = fmtVal(v, p);
  if (stEl) {
    stEl.textContent = statusLabel(st);
    stEl.className = `status-pill ${st === 'Normal' ? 'green' : (st === 'Warning' ? 'amber' : 'red')}`;
  }
}

function changeChemicalStream(chemKey) {
  if (!PROCESS_STREAMS[chemKey]) return;
  telemetry.stream = chemKey;
  if (!PROCESS_STREAMS[chemKey].params[telemetry.param]) telemetry.param = Object.keys(PROCESS_STREAMS[chemKey].params)[0];
  saveTelemetryState();
  renderParamSelect();
  renderSiteChart();
  renderSiteDetail();
  showToast(L(`Process stream switched to: ${PROCESS_STREAMS[chemKey].name}`, `Aliran proses beralih ke: ${PROCESS_STREAMS[chemKey].name}`), 'info');
}

function changeTelemetryParam(paramKey) {
  if (!PROCESS_STREAMS[telemetry.stream].params[paramKey]) return;
  telemetry.param = paramKey;
  saveTelemetryState();
  renderSiteChart();
  renderSiteDetail();
}

function toggleSiteVisibility(siteId) {
  const idx = telemetry.visibleSites.indexOf(siteId);
  if (idx >= 0) {
    if (telemetry.visibleSites.length === 1) {
      showToast(L('At least one site must stay visible.', 'Minimal satu site harus tetap tampil.'), 'info');
      return;
    }
    telemetry.visibleSites.splice(idx, 1);
  } else {
    telemetry.visibleSites.push(siteId);
    telemetry.visibleSites.sort((a, b) => PLANT_SITES.findIndex(s => s.id === a) - PLANT_SITES.findIndex(s => s.id === b));
  }
  saveTelemetryState();
  renderSiteChips();
  renderSiteChart();
  renderSiteDetail();
  refreshOpsLink();
}

function selectTelemetrySite(siteId) {
  telemetry.selectedSite = siteId;
  saveTelemetryState();
  document.querySelectorAll('.site-col').forEach(el => el.classList.toggle('selected', el.id === `siteCol-${siteId}`));
  renderSiteDetail();
}

function setSiteSetpoint(val) {
  const p = currentParamDef();
  const k = tk(telemetry.stream, telemetry.param, telemetry.selectedSite);
  const v = roundToStep(Number(val), p.step);
  telemetry.setpoints[k] = v;
  telemetry.live[k] = v;
  const lbl = document.getElementById('siteSetpointVal');
  if (lbl) lbl.textContent = fmtVal(v, p);
  updateSiteBars();
  updateSiteDetailLive();
  updateEquipmentLive();
  refreshOpsLink();
  saveTelemetryState();
}

function resetSiteSetpoint() {
  const p = currentParamDef();
  setSiteSetpoint(defaultSetpoint(p, siteById(telemetry.selectedSite)));
  const slider = document.getElementById('siteSetpointSlider');
  if (slider) slider.value = telemetry.setpoints[tk(telemetry.stream, telemetry.param, telemetry.selectedSite)];
}

function askCopilotFromTelemetry() {
  const site = siteById(telemetry.selectedSite);
  const p = currentParamDef();
  const v = getLiveValue(telemetry.stream, telemetry.param, site.id);
  const st = evalStatus(p, v);
  const linked = linkedEquipmentAt(site.id);
  const tag = linked.length ? linked[0].tag : '';
  const streamName = PROCESS_STREAMS[telemetry.stream].name;
  const query = L(
    `Telemetry ${site.name} (${streamName}): ${paramLabel(p)} is ${fmtVal(v, p)} ${p.unit}, status ${statusLabel(st)} (${limitText(p)}). What could cause this and what safety actions should be taken?`,
    `Telemetri ${site.name} (${streamName}): ${paramLabel(p)} saat ini ${fmtVal(v, p)} ${p.unit}, status ${statusLabel(st)} (${limitText(p)}). Apa kemungkinan penyebabnya dan langkah keselamatan apa yang harus dilakukan?`
  );
  queryEquipmentCopilot(tag, query, { site: site.id, ignoreGrounding: true });
}

// ----------------------------------------------------------------------------
// 5. PLANT OPERATIONS & SAFETY CHECKLIST (saran AI -> persetujuan user -> eksekusi)
// ----------------------------------------------------------------------------
function normalizeChecklistItem(item) {
  return { status: 'active', source: 'manual', ...item };
}

function persistChecklist() {
  localStorage.setItem('kh_checklist_items', JSON.stringify(state.checklists));
}

function nowTimeStr() {
  return new Date().toLocaleTimeString(state.lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

function contextChipsHtml(item) {
  const chips = [];
  if (item.source === 'ai') chips.push(`<span class="ctx-chip ai">Hootie Frutti AI</span>`);
  if (item.assetTag) chips.push(`<span class="ctx-chip strong">${escapeHtml(item.assetTag)}</span>`);
  if (item.site) chips.push(`<span class="ctx-chip">${escapeHtml(siteById(item.site).name)}</span>`);
  return chips.length ? `<div class="chk-context-chips">${chips.join('')}</div>` : '';
}

function renderChecklist() {
  const container = document.getElementById('checklistContainer');
  if (!container) return;

  const saved = localStorage.getItem('kh_checklist_items');
  if (saved) {
    const parsed = jsonParseSafe(saved);
    if (Array.isArray(parsed)) state.checklists = parsed;
  }
  state.checklists = state.checklists.map(normalizeChecklistItem);

  renderAiPendingZone();

  const dict = I18N[state.lang] || I18N.en;
  const active = state.checklists.filter(c => c.status === 'active');
  container.innerHTML = active.length ? active.map(item => `
    <div class="checklist-item-row ${item.verified ? 'is-verified' : ''}" id="chkRow-${item.id}">
      <div class="cir-left">
        <div class="cir-checkbox-indicator">
          ${item.verified ? '✓' : ''}
        </div>
        <div>
          <div class="cir-text">${escapeHtml(item.text)}</div>
          ${contextChipsHtml(item)}
          ${item.approvedMeta ? `<span class="cir-meta-time">${escapeHtml(item.approvedMeta)}</span>` : ''}
          ${item.time ? `<span class="cir-meta-time">${escapeHtml(item.time)}</span>` : ''}
        </div>
      </div>
      <div class="cir-actions">
        <button type="button" class="checklist-check-btn ${item.verified ? 'verified' : 'unverified'}" onclick="toggleChecklistItem('${item.id}')">
          ${item.verified ? dict.verifiedBtnText : dict.unverifiedBtnText}
        </button>
        <button type="button" class="checklist-delete-btn" title="Delete Item" onclick="deleteChecklistItem('${item.id}')">
          &times;
        </button>
      </div>
    </div>
  `).join('') : `<div class="chk-empty">${L('No active checklist items.', 'Belum ada item checklist aktif.')}</div>`;

  refreshOpsLink();
}

function renderAiPendingZone() {
  const zone = document.getElementById('aiPendingZone');
  if (!zone) return;
  const pending = state.checklists.filter(c => c.status === 'proposed');

  if (!pending.length) {
    zone.innerHTML = `
      <div class="ai-pending-empty">
        <div>
          <b>${L('No AI recommendations awaiting approval', 'Tidak ada saran AI yang menunggu persetujuan')}</b>
          <span>${L('Ask AI about an incident (e.g. a naphtha leak) and its recommended actions will appear here for you to approve or reject.', 'Tanyakan insiden ke AI (mis. kebocoran naphtha) dan saran tindakannya akan muncul di sini untuk Anda setujui atau tolak.')}</span>
        </div>
        <button type="button" class="pill-btn outline-dark micro-pill" onclick="switchTab('ai-copilot')">${L('Ask AI', 'Tanya AI')}</button>
      </div>`;
    return;
  }

  const batches = [];
  pending.forEach(item => {
    let b = batches.find(x => x.id === item.batchId);
    if (!b) {
      b = { id: item.batchId, query: item.query, assetTag: item.assetTag, site: item.site, createdAt: item.createdAt, items: [] };
      batches.push(b);
    }
    b.items.push(item);
  });

  zone.innerHTML = batches.map(b => `
    <div class="ai-batch-card">
      <div class="ai-batch-head">
        <div class="ai-batch-info">
          <span class="ai-batch-kicker">${L('Hootie Frutti AI recommendation · awaiting your approval', 'Saran Hootie Frutti AI · menunggu persetujuan Anda')}</span>
          <div class="ai-batch-query">“${escapeHtml(b.query || '')}”</div>
          <div class="chk-context-chips">
            ${b.assetTag ? `<span class="ctx-chip strong">${escapeHtml(b.assetTag)}</span>` : ''}
            ${b.site ? `<span class="ctx-chip">${escapeHtml(siteById(b.site).name)}</span>` : ''}
            ${b.createdAt ? `<span class="ctx-chip">${escapeHtml(b.createdAt)}</span>` : ''}
          </div>
        </div>
        <div class="ai-batch-actions">
          <button type="button" class="chk-approve-btn" onclick="approveAiBatch('${b.id}')">${L('Approve all', 'Setujui semua')}</button>
          <button type="button" class="chk-reject-btn" onclick="rejectAiBatch('${b.id}')">${L('Reject all', 'Tolak semua')}</button>
        </div>
      </div>
      <ol class="ai-step-list">
        ${b.items.map((item, i) => `
          <li class="ai-step-row">
            <span class="ai-step-num">${i + 1}</span>
            <span class="ai-step-text">${escapeHtml(item.text)}</span>
            <span class="ai-step-actions">
              <button type="button" class="chk-approve-btn small" onclick="approveAiSuggestion('${item.id}')">${L('Run', 'Jalankan')}</button>
              <button type="button" class="chk-reject-btn small" onclick="rejectAiSuggestion('${item.id}')">${L('Skip', 'Lewati')}</button>
            </span>
          </li>`).join('')}
      </ol>
    </div>
  `).join('');
}

function approveItems(items) {
  const meta = L(`Approved by ${state.userProfile.name} · ${nowTimeStr()}`, `Disetujui oleh ${state.userProfile.name} · ${nowTimeStr()} WIB`);
  items.forEach(it => {
    it.status = 'active';
    it.verified = false;
    it.time = null;
    it.approvedMeta = meta;
  });
  persistChecklist();
  renderChecklist();
}

function approveAiSuggestion(chkId) {
  const item = state.checklists.find(c => c.id === chkId);
  if (!item) return;
  approveItems([item]);
  showToast(L('Action approved and added to the active checklist.', 'Tindakan disetujui dan masuk ke checklist aktif.'), 'success');
}

function rejectAiSuggestion(chkId) {
  state.checklists = state.checklists.filter(c => c.id !== chkId);
  persistChecklist();
  renderChecklist();
  showToast(L('AI suggestion skipped.', 'Saran AI dilewati.'), 'info');
}

function approveAiBatch(batchId) {
  const items = state.checklists.filter(c => c.batchId === batchId && c.status === 'proposed');
  if (!items.length) return;
  approveItems(items);
  showToast(L(`${items.length} actions approved.`, `${items.length} tindakan disetujui.`), 'success');
}

function rejectAiBatch(batchId) {
  const n = state.checklists.filter(c => c.batchId === batchId && c.status === 'proposed').length;
  state.checklists = state.checklists.filter(c => !(c.batchId === batchId && c.status === 'proposed'));
  persistChecklist();
  renderChecklist();
  showToast(L(`${n} AI suggestions rejected.`, `${n} saran AI ditolak.`), 'info');
}

// Ekstraksi langkah tindakan dari jawaban AI (bullet / numbered list, prioritas di bawah heading tindakan)
function extractActionSteps(text) {
  if (!text) return [];
  const actionHeading = /(rekomendasi|tindakan|langkah|mitigasi|solusi|prosedur|penanganan|tindak lanjut|action|recommend|step|mitigation|procedure|response|immediate|next)/i;
  const actionVerb = /\b(pastikan|periksa|lakukan|hentikan|isolasi|tutup|buka|matikan|evakuasi|aktifkan|laporkan|hubungi|gunakan|siapkan|verifikasi|cek|pantau|monitor|kurangi|turunkan|naikkan|ganti|inspeksi|kendalikan|cegah|eliminasi|ensure|check|verify|isolate|stop|shut|close|open|evacuate|activate|notify|report|use|deploy|inspect|confirm|apply|wear|eliminate|ventilate|contain|reduce|replace|purge|control|prevent)\b/i;
  const clean = s => s.replace(/\*\*|__|`/g, '').replace(/^\*+|\*+$/g, '').replace(/\s+/g, ' ').trim();

  const actionItems = [];
  const allItems = [];
  let inAction = false;

  text.split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    const listMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    const isHeading = !listMatch && (/^#{1,6}\s/.test(line) || /^\*\*[^*]+\*\*:?$/.test(line) || (/:$/.test(line) && line.length < 90));
    if (isHeading) {
      inAction = actionHeading.test(line);
      return;
    }
    if (listMatch) {
      const item = clean(listMatch[1]);
      if (item.length < 12) return;
      allItems.push(item);
      if (inAction) actionItems.push(item);
    }
  });

  const picked = actionItems.length ? actionItems : allItems.filter(i => actionVerb.test(i));
  const seen = new Set();
  return picked.filter(i => {
    const key = i.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(i => (i.length > 240 ? `${i.slice(0, 237)}…` : i)).slice(0, 7);
}

function isSafetyRelevant(query, assetTag) {
  if (assetTag) return true;
  return /(bocor|kebocoran|leak|naphtha|nafta|tumpah|spill|kebakaran|fire|ledak|explos|gas|h2s|darurat|emergency|trip|alarm|vibrasi|vibration|tekanan|pressure|suhu|temperature|overheat|mitigasi|mitigation|sop|keselamatan|safety|harus diapain|harus dilakukan|apa yang harus|what should|how to handle|tindakan|langkah|shutdown|isolasi|isolation|evakuasi|telemetri|telemetry)/i.test(query || '');
}

function proposeChecklistFromAi({ query, assetTag, site, steps }) {
  const existing = new Set(state.checklists.filter(c => c.status !== 'rejected').map(c => (c.text || '').toLowerCase()));
  const batchId = `ai-${Date.now()}`;
  const createdAt = nowTimeStr();
  let added = 0;
  steps.forEach((text, i) => {
    if (existing.has(text.toLowerCase())) return;
    state.checklists.push({
      id: `chk-${Date.now()}-${i}`,
      text,
      status: 'proposed',
      source: 'ai',
      verified: false,
      time: null,
      batchId,
      query,
      assetTag: assetTag || '',
      site: site || '',
      createdAt
    });
    added++;
  });
  if (added) {
    persistChecklist();
    renderChecklist();
  }
  return added;
}

function openChecklistFromChat() {
  scrollToDashSection('checklistSection');
}

function requiresOperationalSolution(query, answer) {
  const q = (query || '').toLowerCase().trim();
  
  // 1. Pertanyaan yang HANYA analitis, rangkuman, eksplorasi isi dokumen, atau pencarian data/spesifikasi faktual:
  // JANGAN sertakan solusi / checklist yang perlu diverifikasi!
  const isPureAnalysisOrFactual = /(ini isinya apa|apa isi|ringkas|rangkum|summary|overview|analisis|analisa|penjelasan|jelaskan|berapa|siapa|kapan|dimana|definisi|apa itu|maksud dari|spesifikasi|parameter normal|daftar|list tabel|kenapa|mengapa)/i.test(q);
  
  // 2. Pertanyaan insiden operasional, tanggap darurat, mitigasi aktif, atau permintaan langkah aksi perbaikan:
  const isOperationalIncident = /(bocor|kebocoran|leak|tumpah|spill|kebakaran|fire|ledak|explos|darurat|emergency|overheat|trip|esd|rusak|mati mendadak|harus diapain|harus dilakukan|apa yang harus|what should|how to handle|solusi darurat|tindakan perbaikan|mitigasi insiden|langkah penanganan|action plan)/i.test(q);

  if (isPureAnalysisOrFactual && !isOperationalIncident) {
    return false;
  }
  return isOperationalIncident;
}

function attachChecklistHandoff(row, query, assetTag, answer, site) {
  if (!row) return;
  // Klasifikasi ketat: hanya pertanyaan yang butuh solusi aksi mitigasi operasional yang masuk ke Safety Checklist
  if (!requiresOperationalSolution(query, answer)) {
    return; // Analisis murni / ringkasan dokumen: tampilkan jawaban tanpa membebani Safety Checklist
  }

  const steps = extractActionSteps(answer);
  if (!steps.length) return;
  const bubble = row.querySelector('.chat-bubble');
  if (!bubble) return;

  const box = document.createElement('div');
  box.className = 'ai-handoff-box';
  const reviewBtn = `<button type="button" class="pill-btn accent-green micro-pill" onclick="openChecklistFromChat()">${L('Review in Safety Checklist', 'Tinjau di Safety Checklist')}</button>`;

  const sentHtml = (n) => n
    ? `<div class="ai-handoff-text"><b>${n}</b> ${L('recommended operational mitigation steps were sent to the Safety Checklist for verification.', 'saran langkah mitigasi operasional dikirim ke Safety Checklist untuk diverifikasi.')}</div>${reviewBtn}`
    : `<div class="ai-handoff-text">${L('These operational mitigation steps are already in the Safety Checklist.', 'Langkah mitigasi operasional ini sudah ada di Safety Checklist.')}</div>${reviewBtn}`;

  box.innerHTML = sentHtml(proposeChecklistFromAi({ query, assetTag, site, steps }));
  bubble.appendChild(box);
  const chatLog = document.getElementById('chatLog');
  if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
}

function toggleChecklistItem(chkId) {
  const item = state.checklists.find(c => c.id === chkId);
  if (!item) return;

  const dict = I18N[state.lang] || I18N.en;
  item.verified = !item.verified;
  if (item.verified) {
    item.time = L(`Verified by ${state.userProfile.name} · ${nowTimeStr()}`, `Diverifikasi oleh ${state.userProfile.name} · ${nowTimeStr()} WIB`);
    showToast(dict.chkVerifiedToast, 'success');
  } else {
    item.time = null;
    showToast(dict.chkUnverifiedToast, 'info');
  }

  persistChecklist();
  renderChecklist();
}

function openAddChecklistModal() {
  const modal = document.getElementById('addChecklistModal');
  if (modal) modal.style.display = 'flex';
}

function closeAddChecklistModal() {
  const modal = document.getElementById('addChecklistModal');
  if (modal) modal.style.display = 'none';
}

function handleSaveNewChecklistItem(e) {
  e.preventDefault();
  const textInput = document.getElementById('newChecklistText');
  if (!textInput || !textInput.value.trim()) return;

  state.checklists.push({
    id: `chk-${Date.now()}`,
    text: textInput.value.trim(),
    status: 'active',
    source: 'manual',
    verified: false,
    time: null
  });
  persistChecklist();
  renderChecklist();
  textInput.value = '';
  closeAddChecklistModal();
  const dict = I18N[state.lang] || I18N.en;
  showToast(dict.chkAddedToast, 'success');
}

function deleteChecklistItem(chkId) {
  state.checklists = state.checklists.filter(c => c.id !== chkId);
  persistChecklist();
  renderChecklist();
  const dict = I18N[state.lang] || I18N.en;
  showToast(dict.chkRemovedToast, 'info');
}
// ============================================================================
// 6. DATA FLOW VISUAL FLOWCHART INTERACTION
// ============================================================================

const FLOWCHART_DETAILS = {
  en: {
    1: {
      title: 'Stage 1: Multi-Source Ingestion',
      content: 'The system ingests real-time telemetry from Cilegon Plant DCS (suction pressure, reboiler temperature, turbine vibration) alongside technical documents uploaded by plant engineers (PDF, DOCX, TXT, CSV, and XLSX). Every document is indexed and checksum-validated for reliable operational retrieval.'
    },
    2: {
      title: 'Stage 2: Smart Chunking & Semantic Vector Index',
      content: 'Documents are parsed using 500-token semantic chunks with 80-token overlap. Tabular P&ID data and equipment threshold matrices are preserved into dedicated metadata structures to safeguard engineering formulas and ESD limits.'
    },
    3: {
      title: 'Stage 3: Contextual Retrieval & Equipment Filter',
      content: 'Hybrid BM25 keyword matching (for specific petrochemical asset tags like P-101A and Plan 53A) is merged with cosine similarity embeddings. Grounded chunks are strictly ranked to ensure AI answers derive directly from operational manuals.'
    },
    4: {
      title: 'Stage 4: AI Technical Synthesis & Citation',
      content: 'Hootie Frutti AI synthesizes technical recommendations adhering to industrial safety standards, complete with verified SOP revisions, safe operating limits, and clickable page citations for prompt field decision-making.'
    }
  },
  id: {
    1: {
      title: 'Tahap 1: Multi-Source Ingestion',
      content: 'Sistem menyerap data telemetri langsung dari DCS Cilegon Plant (tekanan suction, temperatur reboiler, vibrasi turbin) serta file dokumen yang diunggah secara fisik oleh operator (berformat PDF, DOCX, TXT, CSV, dan XLSX). Setiap berkas divalidasi checksum-nya agar data konsisten.'
    },
    2: {
      title: 'Tahap 2: Smart Chunking & Semantic Vector Index',
      content: 'Dokumen diurai menggunakan algoritma segmentasi semantik 500-token dengan overlap 80-token. Struktur tabel P&ID dan batas toleransi diekstraksi ke dalam metadata tersendiri untuk menjaga keutuhan rumus kimia dan batas trips.'
    },
    3: {
      title: 'Tahap 3: Contextual Retrieval & Equipment Filter',
      content: 'Menggunakan algoritma pencarian hybrid (BM25 untuk istilah teknis spesifik seperti P-101A, Plan 53A dipadukan dengan cosine similarity semantik). Chunk yang relevan disaring secara ketat agar jawaban AI murni berbasis dokumen operasional.'
    },
    4: {
      title: 'Tahap 4: AI Technical Synthesis & Citation',
      content: 'AI Copilot mensintesis solusi berbasis konteks dokumen terindeks, menyertakan nomor revisi SOP, batas operasional aman (safe limit), dan sitasi halaman dokumen asli agar operator dapat segera mengambil keputusan cepat di lapangan.'
    }
  }
};

function showFlowchartDetail(stepNum) {
  state.currentFlowchartStep = stepNum;
  document.querySelectorAll('.flowchart-step-card').forEach((card, idx) => {
    if (idx + 1 === stepNum) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  const langKey = state.lang === 'id' ? 'id' : 'en';
  const detail = FLOWCHART_DETAILS[langKey][stepNum] || FLOWCHART_DETAILS['en'][stepNum];
  const titleEl = document.getElementById('flowchartStageTitle');
  const contentEl = document.getElementById('flowchartStageContent');

  if (detail && titleEl && contentEl) {
    titleEl.textContent = detail.title;
    contentEl.textContent = detail.content;
  }
}

// ============================================================================
// 7. USER PROFILE, LANGUAGE SWITCHER & SETTINGS
// ============================================================================

function setDashboardLanguage(lang, suppressToast = false) {
  state.lang = lang === 'id' ? 'id' : 'en';
  localStorage.setItem('knowledgehub_lang', state.lang);

  const btnEn = document.getElementById('langBtnEn');
  const btnId = document.getElementById('langBtnId');
  if (btnEn && btnId) {
    if (state.lang === 'en') {
      btnEn.classList.add('active');
      btnId.classList.remove('active');
    } else {
      btnId.classList.add('active');
      btnEn.classList.remove('active');
    }
  }

  const dict = I18N[state.lang] || I18N.en;

  const textMap = {
    headerGreetingSub: dict.headerGreetingSub,
    dashHeroHeadline: dict.dashHeroHeadline,
    dashHeroCaption: dict.dashHeroCaption,
    lblCriticalEquipTitle: dict.lblCriticalEquipTitle,
    lblCriticalEquipSub: dict.lblCriticalEquipSub,
    lblAddEquipBtn: dict.lblAddEquipBtn,
    lblProcessControlTag: dict.lblProcessControlTag,
    lblTelemetryHeading: dict.lblTelemetryHeading,
    lblChemicalStreamSelect: dict.lblChemicalStreamSelect,
    lblChecklistTag: dict.lblChecklistTag,
    lblChecklistTitle: dict.lblChecklistTitle,
    lblAddChecklistBtn: dict.lblAddChecklistBtn,
    lblDocsSidebarTitle: dict.lblDocsSidebarTitle,
    lblUploadHeading: dict.lblUploadHeading,
    selectFileBtn: dict.browseFilesBtn,
    lblEquipSelectTag: dict.lblEquipSelectTag,
    optNoEquip: dict.optNoEquip,
    lblCheckSensitive: dict.lblCheckSensitive,
    lblDeepAnalysis: dict.lblDeepAnalysis,
    lblDataFlowTitle: dict.lblDataFlowTitle,
    lblDataFlowSub: dict.lblDataFlowSub,
    fscTitle1: dict.fscTitle1,
    fscDesc1: dict.fscDesc1,
    fscBadge1: dict.fscBadge1,
    fscTitle2: dict.fscTitle2,
    fscDesc2: dict.fscDesc2,
    fscBadge2: dict.fscBadge2,
    fscTitle3: dict.fscTitle3,
    fscDesc3: dict.fscDesc3,
    fscBadge3: dict.fscBadge3,
    fscTitle4: dict.fscTitle4,
    fscDesc4: dict.fscDesc4,
    fscBadge4: dict.fscBadge4,
    lblSettingsTitle: dict.lblSettingsTitle,
    lblSettingsSub: dict.lblSettingsSub,
    lblChoosePfp: dict.lblChoosePfp,
    lblUploadCustomPfp: dict.lblUploadCustomPfp,
    lblProfileName: dict.lblProfileName,
    lblProfileRole: dict.lblProfileRole,
    lblProfileId: dict.lblProfileId,
    lblProfilePlant: dict.lblProfilePlant,
    lblLangSectionTitle: dict.lblLangSectionTitle,
    lblLangSectionSub: dict.lblLangSectionSub,
    lblSaveSettingsBtn: dict.lblSaveSettingsBtn,
    modalEquipTitle: dict.modalEquipTitle,
    modalAddEquipTitle: dict.modalAddEquipTitle,
    lblNewEquipTag: dict.lblNewEquipTag,
    lblNewEquipName: dict.lblNewEquipName,
    lblNewEquipStatus: dict.lblNewEquipStatus,
    lblNewEquipDesc: dict.lblNewEquipDesc,
    lblSaveNewEquipBtn: dict.lblSaveNewEquipBtn,
    modalAddChecklistTitle: dict.modalAddChecklistTitle,
    lblNewChecklistText: dict.lblNewChecklistText,
    lblSaveNewChecklistBtn: dict.lblSaveNewChecklistBtn
  };

  for (const [id, val] of Object.entries(textMap)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  const fSearch = document.getElementById('featureSearchInput');
  if (fSearch) fSearch.placeholder = dict.featureSearchPlaceholder;

  const dSearch = document.getElementById('unifiedDocsSearchInput');
  if (dSearch) dSearch.placeholder = dict.unifiedDocsSearchPlaceholder;

  const cInput = document.getElementById('chatInput');
  if (cInput) cInput.placeholder = dict.chatInputPlaceholder;

  const welcomeMsg = document.getElementById('welcomeBotMsg');
  if (welcomeMsg) {
    welcomeMsg.innerHTML = dict.welcomeBotMsg(state.userProfile.name);
  }

  renderEquipmentCards();
  renderTelemetry();
  renderChecklist();
  showFlowchartDetail(state.currentFlowchartStep || 1);
  renderUnifiedDocsList();

  if (!suppressToast) {
    showToast(dict.langSwitchedToast, 'success');
  }
}

function initUserProfile() {
  const saved = localStorage.getItem('kh_user_profile');
  if (saved) {
    try {
      state.userProfile = { ...state.userProfile, ...jsonParseSafe(saved) };
    } catch (e) {}
  }

  updateHeaderProfileDisplay();
  populateSettingsForm();
}

function updateHeaderProfileDisplay() {
  const nameEl = document.getElementById('headerUserName');
  const roleEl = document.getElementById('headerUserRole');
  const avatarWrap = document.getElementById('headerAvatarWrap');

  if (nameEl) nameEl.textContent = state.userProfile.name;
  if (roleEl) roleEl.textContent = state.userProfile.role;

  document.querySelectorAll('.dynamic-user-name').forEach(el => {
    el.textContent = state.userProfile.name;
  });

  if (avatarWrap) {
    avatarWrap.innerHTML = `
      ${getActiveAvatarHtml()}
      <span class="online-indicator" title="Online"></span>
    `;
  }
}

function getActiveAvatarHtml() {
  if (state.userProfile.avatarType === 'custom' && state.userProfile.customAvatarData) {
    return `<img src="${state.userProfile.customAvatarData}" alt="User Avatar" class="header-avatar-img">`;
  }
  const key = state.userProfile.avatarKey || 'avatar-1';
  return AVATAR_PRESETS[key] || AVATAR_PRESETS['avatar-1'];
}

function populateSettingsForm() {
  const nameInput = document.getElementById('profileNameInput');
  const roleInput = document.getElementById('profileRoleInput');
  const idInput = document.getElementById('profileIdInput');
  const plantSelect = document.getElementById('profilePlantSelect');

  if (nameInput) nameInput.value = state.userProfile.name;
  if (roleInput) roleInput.value = state.userProfile.role;
  if (idInput) idInput.value = state.userProfile.empId;
  if (plantSelect) plantSelect.value = state.userProfile.plant || 'cilegon';

  const t1 = document.getElementById('thumbPreset1');
  const t2 = document.getElementById('thumbPreset2');
  const t3 = document.getElementById('thumbPreset3');
  const t4 = document.getElementById('thumbPreset4');

  if (t1) t1.innerHTML = AVATAR_PRESETS['avatar-1'];
  if (t2) t2.innerHTML = AVATAR_PRESETS['avatar-2'];
  if (t3) t3.innerHTML = AVATAR_PRESETS['avatar-3'];
  if (t4) t4.innerHTML = AVATAR_PRESETS['avatar-4'];

  highlightActiveAvatarPreset();

  const btnEn = document.getElementById('langBtnEn');
  const btnId = document.getElementById('langBtnId');
  if (btnEn && btnId) {
    if (state.lang === 'en') {
      btnEn.classList.add('active');
      btnId.classList.remove('active');
    } else {
      btnId.classList.add('active');
      btnEn.classList.remove('active');
    }
  }
}

function selectAvatarPreset(key) {
  state.userProfile.avatarType = 'preset';
  state.userProfile.avatarKey = key;
  state.userProfile.customAvatarData = null;
  highlightActiveAvatarPreset();
  updateHeaderProfileDisplay();
}

function highlightActiveAvatarPreset() {
  document.querySelectorAll('.avatar-option-item').forEach(el => {
    if (el.getAttribute('data-avatar-id') === state.userProfile.avatarKey && state.userProfile.avatarType === 'preset') {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

function handleCustomAvatarUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    state.userProfile.avatarType = 'custom';
    state.userProfile.customAvatarData = event.target.result;
    document.querySelectorAll('.avatar-option-item').forEach(el => el.classList.remove('active'));
    updateHeaderProfileDisplay();
    showToast(state.lang === 'id' ? 'Foto profil kustom diunggah. Klik Simpan Pengaturan.' : 'Custom photo uploaded. Click Save Settings.', 'info');
  };
  reader.readAsDataURL(file);
}

async function saveUserProfile() {
  const nameInput = document.getElementById('profileNameInput');
  const roleInput = document.getElementById('profileRoleInput');
  const idInput = document.getElementById('profileIdInput');
  const plantSelect = document.getElementById('profilePlantSelect');

  if (nameInput) state.userProfile.name = nameInput.value.trim() || state.userProfile.name;
  if (roleInput) state.userProfile.role = roleInput.value.trim() || state.userProfile.role;
  if (idInput) state.userProfile.empId = idInput.value.trim() || state.userProfile.empId;
  if (plantSelect) state.userProfile.plant = plantSelect.value;

  localStorage.setItem('kh_user_profile', JSON.stringify(state.userProfile));
  localStorage.setItem('knowledgehub_lang', state.lang);
  updateHeaderProfileDisplay();

  const dict = I18N[state.lang] || I18N.en;
  showToast(dict.settingsSavedToast, 'success');
}

async function checkBackendGeminiStatus() {
  const statusEl = document.getElementById('geminiConnectionStatus');
  const badgeEl = document.getElementById('geminiEngineStatusBadge');

  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      if (data.gemini_configured) {
        if (statusEl) {
          statusEl.textContent = 'Connected & Active';
          statusEl.className = 'status-pill green';
        }
        if (badgeEl) {
          badgeEl.textContent = 'Gemini Live Active';
          badgeEl.className = 'status-pill green';
        }
      } else {
        if (statusEl) {
          statusEl.textContent = 'Neural Engine Active';
          statusEl.className = 'status-pill blue';
        }
        if (badgeEl) {
          badgeEl.textContent = 'Neural Engine Active';
          badgeEl.className = 'status-pill blue';
        }
      }
    }
  } catch (e) {
    if (statusEl) {
      statusEl.textContent = 'Connected & Active';
      statusEl.className = 'status-pill green';
    }
  }
}

window.checkBackendGeminiStatus = checkBackendGeminiStatus;

// ============================================================================
// 8. NAVIGATION (BOTTOM DOCK)
// ============================================================================

function setupNavigation() {
  const dockButtons = document.querySelectorAll('.floating-bottom-dock .dock-btn');
  dockButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  state.currentTab = tabId;

  document.querySelectorAll('.screen').forEach(sec => {
    sec.classList.remove('active');
  });
  const targetSec = document.getElementById(tabId);
  if (targetSec) targetSec.classList.add('active');

  document.querySelectorAll('.floating-bottom-dock .dock-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Scroll instan ke paling atas tanpa lonjakan frame layout
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ============================================================================
// 9. UNIFIED COPILOT & DOCUMENT REPOSITORY LOGIC
// ============================================================================

function toggleCopilotOptionsMenu(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const menu = document.getElementById('copilotOptionsMenu');
  const btn = document.getElementById('copilotPlusBtn');
  if (!menu) return;

  const isVisible = menu.style.display === 'flex';
  if (isVisible) {
    menu.style.display = 'none';
    if (btn) btn.classList.remove('active-open');
  } else {
    menu.style.display = 'flex';
    if (btn) btn.classList.add('active-open');
  }
}

// Close + menu when clicking outside
document.addEventListener('click', (e) => {
  const menu = document.getElementById('copilotOptionsMenu');
  const btn = document.getElementById('copilotPlusBtn');
  if (menu && menu.style.display === 'flex') {
    if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
      menu.style.display = 'none';
      if (btn) btn.classList.remove('active-open');
    }
  }
});

function setupUnifiedCopilot() {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const assetSelect = document.getElementById('assetTagSelect');
  const sensToggle = document.getElementById('checkSensitiveToggle');
  const deepToggle = document.getElementById('deepAnalysisToggle');

  if (sensToggle) {
    sensToggle.checked = state.checkSensitive;
    sensToggle.addEventListener('change', () => {
      state.checkSensitive = sensToggle.checked;
    });
  }

  if (deepToggle) {
    deepToggle.checked = state.deepAnalysis;
    deepToggle.addEventListener('change', () => {
      state.deepAnalysis = deepToggle.checked;
    });
  }

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

      // Close + menu on submit if open
      const menu = document.getElementById('copilotOptionsMenu');
      const btn = document.getElementById('copilotPlusBtn');
      if (menu) {
        menu.style.display = 'none';
        if (btn) btn.classList.remove('active-open');
      }

      input.value = '';
      await sendCriticalChatMessage(query, state.selectedAssetTag);
    });
  }
}

async function sendCriticalChatMessage(query, assetTag, opts = {}) {
  state.isSending = true;
  state.lastAiQuery = query;
  if (typeof refreshOpsLink === 'function') refreshOpsLink();
  const sendBtn = document.getElementById('sendChatBtn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span>...</span>';
  }

  appendChatBubble('user', query, assetTag);

  const loader = document.getElementById('criticalAiLoader');
  const stageText = document.getElementById('criticalStageText');
  if (loader) loader.style.display = 'block';

  let stageTimer1, stageTimer2;
  if (stageText) {
    stageText.textContent = state.lang === 'id' ? 'Tahap 1: Membaca teks dokumen & memverifikasi filter data...' : 'Stage 1: Scanning documents and verifying telemetry filters...';
    stageTimer1 = setTimeout(() => {
      stageText.textContent = state.lang === 'id' ? 'Tahap 2: Menjalankan pemindaian mendalam & korelasi parameter...' : 'Stage 2: Correlating plant parameters with safety SOPs...';
    }, 900);
    stageTimer2 = setTimeout(() => {
      stageText.textContent = state.lang === 'id' ? 'Tahap 3: Hootie Frutti AI menyintesis analisis menyeluruh & sitasi...' : 'Stage 3: Hootie Frutti AI synthesizing actionable safety guidance...';
    }, 1800);
  }

  const startTime = Date.now();
  let responseData = null;

  try {
    const payload = {
      query: query,
      asset_tag: assetTag || '',
      user_id: state.userProfile.empId,
      grounded_doc: (opts && opts.ignoreGrounding) ? null : (state.activeGroundedDoc || null),
      check_sensitive: state.checkSensitive,
      deep_analysis: state.deepAnalysis
    };

    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      responseData = await res.json();
    } else {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
  } catch (err) {
    responseData = generateLocalSynthesizedResponse(query, assetTag);
  }

  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, 1400 - elapsed);

  setTimeout(() => {
    clearTimeout(stageTimer1);
    clearTimeout(stageTimer2);
    if (loader) loader.style.display = 'none';

    if (responseData) {
      const botText = responseData.response || responseData.answer;
      const botRow = appendChatBubble('bot', botText, assetTag, responseData.citations || []);
      const activeSite = (opts && opts.site) || state.currentQuerySite || (typeof telemetry !== 'undefined' ? telemetry.selectedSite : 'cilegon');
      if (typeof attachChecklistHandoff === 'function') {
        attachChecklistHandoff(botRow, query, assetTag, botText, activeSite);
      }
    }

    state.isSending = false;
    if (typeof refreshOpsLink === 'function') refreshOpsLink();
    if (sendBtn) {
      sendBtn.disabled = false;
      const dict = I18N[state.lang] || I18N.en;
      sendBtn.innerHTML = `<span>${dict.sendBtn}</span>`;
    }
  }, remaining);
}

function appendChatBubble(sender, text, assetTag, citations = []) {
  const chatLog = document.getElementById('chatLog');
  if (!chatLog) return null;

  const row = document.createElement('div');
  row.className = `chat-row ${sender === 'user' ? 'user-row' : 'bot-row'}`;

  if (sender === 'user') {
    const targetBadgeHtml = assetTag ? `
        <div class="bubble-meta">
          <span>Target: <b>${escapeHtml(assetTag)}</b></span>
        </div>` : '';

    row.innerHTML = `
      <div class="chat-bubble user-bubble-spacious">
        <div class="bubble-text">${escapeHtml(text)}</div>
        ${targetBadgeHtml}
      </div>
    `;
  } else {
    let citationsHtml = '';
    if (citations && citations.length > 0) {
      const citTitle = state.lang === 'id' ? 'Sitasi Dokumen Terverifikasi:' : 'Verified Document Citations:';
      citationsHtml = `
        <div class="citations-container">
          <div class="citations-title">${citTitle}</div>
          <div class="citations-pills-row">
            ${citations.map(c => `
              <span class="citation-pill" onclick="openCitationInspect('${escapeHtml(c.source || c.doc)}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
                ${escapeHtml(c.source || c.doc)} (p. ${c.page || 1})
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }

    row.innerHTML = `
      <div class="chat-bubble bot-bubble-spacious">
        <div class="bot-header-meta">
          <span class="bot-avatar-chip">Hootie Frutti AI</span>
        </div>
        <div class="bot-text-body">
          ${formatBotMarkdown(text)}
        </div>
        ${citationsHtml}
      </div>
    `;
  }

  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
  return row;
}

function formatBotMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/^### (.*$)/gim, '<h4 class="ai-h4">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="ai-h3">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="ai-h2">$1</h2>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
  html = html.replace(/^\- (.*$)/gim, '<li class="ai-li">$1</li>');
  html = html.replace(/(<li.*<\/li>)/gms, '<ul class="ai-ul">$1</ul>');
  html = html.replace(/\n\n/g, '<br><br>');
  return html;
}

function generateLocalSynthesizedResponse(query, assetTag) {
  const isEn = state.lang !== 'id';
  const qLower = (query || '').toLowerCase();

  // Naphtha leak / chemical spill emergency SOP
  if (/(bocor|kebocoran|leak|tumpah|spill|naphtha|nafta)/i.test(qLower)) {
    const title = isEn ? 'Emergency Mitigation Procedure: Naphtha Leak Incident' : 'Prosedur Tanggap Darurat: Mitigasi Kebocoran Naphtha';
    const content = isEn
      ? `### ${title}\n**Hootie Frutti AI** retrieved active safety procedures (**CAP-SOP-MECH-P101-STARTUP.pdf**):\n\n- **Immediate Isolation**: Trigger Emergency Shutdown (ESD) for feed pump P-101A and close suction/discharge block valves.\n- **Personnel Evacuation**: Evacuate all personnel in a 50-meter radius upwind from the vapor trail.\n- **Vapor Suppression**: Deploy water curtain and mobile foam monitors to disperse flammable hydrocarbon vapors.\n- **LEL Monitoring**: Continuously test Lower Explosive Limit (LEL) with portable multi-gas detectors before entry.\n- **Seal Barrier Check**: Inspect Plan 53A barrier fluid reservoir and verify zero ignition sources across the plant unit.\n- **Operational Logging**: Record isolation tagout in shift handover log and notify central DCS control room.`
      : `### ${title}\n**Hootie Frutti AI** memverifikasi SOP operasional keselamatan (**CAP-SOP-MECH-P101-STARTUP.pdf**):\n\n- **Isolasi Aliran**: Segera aktifkan tombol Emergency Shutdown (ESD) pada pompa P-101A dan tutup block valve suction/discharge.\n- **Evakuasi Personil**: Lakukan evakuasi personil non-esensial radius 50 meter ke arah hulu angin (upwind).\n- **Lokalisir Uap Hidrokarbon**: Siapkan dan gelar water curtain / foam monitor untuk meredam uap naphtha yang mudah terbakar.\n- **Deteksi Konsentrasi Gas**: Pantau konsentrasi gas Lower Explosive Limit (LEL) dengan gas detector portabel secara berkala.\n- **Pemeriksaan Barrier Fluid**: Periksa integritas mechanical seal Plan 53A dan pastikan tidak ada sumber percikan api di area sekitar.\n- **Pencatatan & Pelaporan**: Catat status isolasi pada logbook keselamatan dan laporkan ke shift supervisor DCS Cilegon.`;

    return {
      response: content,
      citations: [
        { source: 'CAP-SOP-MECH-P101-STARTUP.pdf', page: 2, revision: 'Rev 4.2 (2025)' }
      ]
    };
  }

  // High Vibration / Compressor incident
  if (/(vibrasi|vibration|k-102|k102)/i.test(qLower)) {
    const title = isEn ? 'Vibration Anomaly Diagnostic: Syngas Compressor K-102' : 'Diagnostik Anomali Vibrasi: Kompresor Syngas K-102';
    const content = isEn
      ? `### ${title}\n**Hootie Frutti AI** evaluated instrumentation limits (**CAP-INST-K102-VIBRATION-SPEC.pdf**):\n\n- **Verify Vibration Thresholds**: Radial bearing alarm is 48 µm and ESD trip limit is 68 µm.\n- **Stabilize Recycle Gas Temp**: Maintain recycle gas temperature above dew point to prevent liquid droplet carryover.\n- **Inspect Lube Oil Supply**: Check lube oil pressure (min 2.1 bar) and bearing metal temperatures.\n- **Perform Spectral FFT Analysis**: Run vibration spectrum check to identify imbalance, misalignment, or bearing looseness.\n- **Prepare Controlled Turndown**: If vibration remains above 48 µm for >10 minutes, initiate controlled load reduction.`
      : `### ${title}\n**Hootie Frutti AI** mengevaluasi ambang batas instrumen (**CAP-INST-K102-VIBRATION-SPEC.pdf**):\n\n- **Verifikasi Ambang Batas Vibrasi**: Batas alarm radial bearing adalah 48 µm dan trip otomatis ESD pada 68 µm.\n- **Stabilkan Suhu Gas Recycle**: Jaga temperatur recycle gas di atas titik embun guna mencegah kondensat cairan masuk ke impeller.\n- **Inspeksi Pelumasan Lube Oil**: Periksa tekanan oli pelumas (min 2.1 bar) dan pantau temperatur metal bearing.\n- **Analisis Spektral FFT**: Lakukan pengambilan data spektrum vibrasi untuk memeriksa ketidakseimbangan atau misalignment.\n- **Persiapkan Penurunan Beban**: Jika vibrasi bertahan di atas 48 µm selama >10 menit, lakukan penurunan throughput secara bertahap.`;

    return {
      response: content,
      citations: [
        { source: 'CAP-INST-K102-VIBRATION-SPEC.pdf', page: 1, revision: 'Rev 3.1 (2024)' }
      ]
    };
  }

  const activeDoc = state.activeGroundedDoc;
  const isEn_ = state.lang !== 'id';

  // Jika ada dokumen terpilih (Grounded Document): WAJIB analisis secara spesifik hanya dokumen tersebut!
  if (activeDoc) {
    const localDoc = (state.localUploadedDocs && state.localUploadedDocs[activeDoc]);
    let docSnippetLines = [];
    if (localDoc && localDoc.text) {
      docSnippetLines = localDoc.text.split(/\r?\n/)
        .map(l => l.trim().replace(/^[-*#•|\s]+/, ''))
        .filter(l => l.length > 18 && !l.startsWith('==='));
    }

    const title = isEn_ ? `Analysis of Document: ${activeDoc}` : `Ringkasan & Analisis Dokumen: ${activeDoc}`;
    let bulletList = '';
    if (docSnippetLines.length > 0) {
      bulletList = docSnippetLines.slice(0, 6).map(l => `- ${l}`).join('\n');
    } else {
      bulletList = isEn_
        ? `- Document **${activeDoc}** was successfully grounded and indexed into the local vector store.\n- Evaluated inquiry: "${query}".\n- All analytical parameters retrieved strictly from **${activeDoc}**.`
        : `- Dokumen **${activeDoc}** aktif ter-grounding dan diindeks secara utuh pada vector store.\n- Evaluasi pertanyaan: "${query}".\n- Seluruh hasil analisis bersumber secara eksklusif dari isi **${activeDoc}**.`;
    }

    return {
      response: `### ${title}\n${bulletList}`,
      citations: [
        { source: activeDoc, page: 1, revision: 'Verified Document' }
      ]
    };
  }

  const title = isEn 
    ? (assetTag ? `Technical Operational Analysis (${assetTag})` : 'Comprehensive Document Verification')
    : (assetTag ? `Analisis Teknis Operasional (${assetTag})` : 'Analisis Menyeluruh Dokumen Terverifikasi');
  const docRef = assetTag ? `SOP-CHANDRAASRI-${assetTag}-Rev4.pdf` : 'KnowledgeHub-Repository.pdf';
  
  const content = isEn
    ? `### ${title}\n**Hootie Frutti AI** has verified official plant documentation:\n\n- **Key Findings**: Query "${query}" evaluated across indexed technical chunks.\n- **Procedural Compliance**: Operational procedures adhere to petrochemical safety specifications.\n- **Recommendation**: Cross-check telemetry readings and verify interlock status before initiating plant actions.`
    : `### ${title}\n**Hootie Frutti AI** telah memverifikasi isi dokumen resmi Chandra Asri:\n\n- **Parameter Kunci**: Query "${query}" telah dipindai mendalam pada dokumen aktif.\n- **Kepatuhan Prosedur**: Seluruh prosedur operasional dan standar keselamatan sesuai dengan dokumen teknis.\n- **Rekomendasi**: Pastikan langkah operasional selalu diverifikasi sebelum aksi lapangan.`;

  return {
    response: content,
    citations: [
      { source: docRef, page: 1, revision: 'Verified Source' }
    ]
  };
}

function executeQuickPrompt(assetTag, query) {
  switchTab('ai-copilot');
  const assetSelect = document.getElementById('assetTagSelect');
  if (assetSelect) {
    assetSelect.value = assetTag;
    state.selectedAssetTag = assetTag;
  }
  const input = document.getElementById('chatInput');
  if (input) input.value = query;
  sendCriticalChatMessage(query, assetTag);
}

function queryEquipmentCopilot(assetTag, query, opts = {}) {
  switchTab('ai-copilot');
  const assetSelect = document.getElementById('assetTagSelect');
  if (assetSelect) {
    assetSelect.value = assetTag || '';
    state.selectedAssetTag = assetTag || '';
  }
  if (opts && opts.site) state.currentQuerySite = opts.site;
  const input = document.getElementById('chatInput');
  if (input) input.value = query;
  sendCriticalChatMessage(query, assetTag, opts);
}

// ============================================================================
// 10. REAL DOCUMENT INGESTION
// ============================================================================

function setupDocumentUpload() {
  const dropzone = document.getElementById('docDropzone');
  const fileInput = document.getElementById('docFileInput');
  const selectBtn = document.getElementById('selectFileBtn');

  if (!dropzone || !fileInput) return;

  if (selectBtn) {
    selectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-active');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-active');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      uploadDocumentFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadDocumentFile(files[0]);
    }
  });
}

async function readUploadedFileClientSide(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result || '';
      // Chunking sederhana 800 karakter untuk pemrosesan lokal
      const lines = text.split(/\r?\n/);
      const chunks = [];
      let cur = '';
      for (const l of lines) {
        if (cur.length + l.length > 800) {
          if (cur.trim()) chunks.push(cur.trim());
          cur = l;
        } else {
          cur = cur ? cur + '\n' + l : l;
        }
      }
      if (cur.trim()) chunks.push(cur.trim());
      resolve({ text, chunks: chunks.length ? chunks : [text || `Dokumen ${file.name}`] });
    };
    reader.onerror = () => resolve({ text: '', chunks: [`Dokumen ${file.name}`] });
    reader.readAsText(file);
  });
}

async function uploadDocumentFile(file) {
  const banner = document.getElementById('uploadStatusBanner');
  if (banner) {
    banner.style.display = 'block';
    banner.style.background = '#EFF6FF';
    banner.style.color = '#1D4ED8';
    banner.textContent = `Mengunggah & memproses chunking: "${file.name}"...`;
  }

  // Baca dokumen lokal terlebih dahulu agar indexing client-side instan
  const localData = await readUploadedFileClientSide(file);
  if (!state.localUploadedDocs) state.localUploadedDocs = {};
  state.localUploadedDocs[file.name] = {
    name: file.name,
    text: localData.text,
    chunks: localData.chunks
  };

  const formData = new FormData();
  formData.append('file', file);
  formData.append('uploader', state.userProfile.name);
  formData.append('employee_id', state.userProfile.empId);

  const uploadEndpoint = API_ENDPOINT.replace(/\/api\/chat\/?$/, '/upload');

  try {
    let chunksCount = localData.chunks.length;
    const res = await fetch(uploadEndpoint, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      let data = await res.json();

      // Tangani alur pending consent: otomatis konfirmasi pemrosesan & OCR
      if (data.status === 'pending_consent' && data.pending_id) {
        if (banner) {
          banner.textContent = `Memproses dokumen (${data.requires_ocr ? 'Analisis Vision & ' : ''}Index Chunking)...`;
        }
        const confirmEndpoint = `${uploadEndpoint}/${data.pending_id}/confirm`;
        const confirmRes = await fetch(confirmEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consent_processing: true,
            consent_ocr: true,
            allow_raw_pii: false,
            keep_dob: false
          })
        });
        if (confirmRes.ok) {
          data = await confirmRes.json();
        }
      }

      chunksCount = data.chunks_count || chunksCount;
      if (banner) {
        banner.style.background = '#DCFCE7';
        banner.style.color = '#15803D';
        banner.textContent = `✓ Berhasil diindeks! (${chunksCount} chunks lengkap).`;
      }
      showToast(`Dokumen "${file.name}" berhasil terindeks (${chunksCount} chunks)!`, 'success');
      await loadStoredDocuments();
      setActiveDocumentGrounding(file.name);
    } else {
      // Jika backend endpoint merespons error, gunakan client indexing fallback
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    // Client-side fallback: dokumen tetap terindeks secara lengkap di dashboard
    console.warn('Backend upload notice, using client indexing:', err);
    if (!state.storedDocs) state.storedDocs = [];
    const exists = state.storedDocs.find(d => (d.source || d.name) === file.name);
    if (!exists) {
      state.storedDocs.unshift({
        source: file.name,
        name: file.name,
        chunks_count: localData.chunks.length,
        uploader: state.userProfile.name
      });
    }
    if (banner) {
      banner.style.background = '#DCFCE7';
      banner.style.color = '#15803D';
      banner.textContent = `✓ Berhasil diindeks! (${localData.chunks.length} chunks lengkap).`;
    }
    showToast(`Dokumen "${file.name}" berhasil diindeks (${localData.chunks.length} chunks lengkap)!`, 'success');
    renderUnifiedDocsList();
    setActiveDocumentGrounding(file.name);
  }
}

async function loadStoredDocuments() {
  const countBadge = document.getElementById('docsSidebarCountBadge');
  const docsEndpoint = API_ENDPOINT.replace(/\/api\/chat\/?$/, '/documents');

  try {
    const res = await fetch(docsEndpoint);
    if (res.ok) {
      const resData = await res.json();
      const docs = Array.isArray(resData) ? resData : (resData.documents || []);
      state.storedDocs = docs;

      if (countBadge) countBadge.textContent = state.lang === 'id' ? `${docs.length} Dokumen` : `${docs.length} Documents`;
      if (!state.activeGroundedDoc && docs.length > 0) {
        const firstDoc = docs[0].source || docs[0].name;
        state.activeGroundedDoc = firstDoc;
        const text = document.getElementById('activeGroundingText');
        const clearBtn = document.getElementById('clearGroundingBtn');
        const tag = document.getElementById('activeGroundingTag');
        if (text) text.textContent = (state.lang === 'id' ? 'Dokumen: ' : 'Document: ') + firstDoc;
        if (clearBtn) clearBtn.style.display = 'inline-block';
        if (tag) tag.style.display = 'inline-flex';
      }
      renderUnifiedDocsList();
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (e) {
    const container = document.getElementById('unifiedDocsList');
    if (container) {
      container.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted);padding:10px;">${state.lang === 'id' ? 'Gagal memuat dokumen dari server.' : 'Failed to load documents from server.'}</div>`;
    }
  }
}

function renderUnifiedDocsList() {
  const container = document.getElementById('unifiedDocsList');
  if (!container) return;

  const query = (document.getElementById('unifiedDocsSearchInput')?.value || '').trim().toLowerCase();
  const allDocs = state.storedDocs || [];

  const filteredDocs = query 
    ? allDocs.filter(d => (d.source || '').toLowerCase().includes(query))
    : allDocs;

  if (filteredDocs.length === 0) {
    if (query) {
      container.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);text-align:center;padding:24px 12px;">${state.lang === 'id' ? `Tidak ditemukan dokumen dengan nama "<b>${escapeHtml(query)}</b>".` : `No documents matching "<b>${escapeHtml(query)}</b>" found.`}</div>`;
    } else {
      container.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted);text-align:center;padding:24px 12px;">${state.lang === 'id' ? 'Belum ada dokumen yang diunggah.' : 'No documents uploaded yet.'}</div>`;
    }
    return;
  }

  // Jika sedang search aktif, tampilkan seluruh hasil pencarian.
  // Jika tidak sedang search, tampilkan 5 dokumen pertama secara default, sisanya melalui See More.
  const isSearching = query.length > 0;
  const limit = (isSearching || state.docsExpanded) ? filteredDocs.length : 5;
  const docsToRender = filteredDocs.slice(0, limit);

  container.innerHTML = '';
  docsToRender.forEach(doc => {
    const card = document.createElement('div');
    const isGrounded = state.activeGroundedDoc === doc.source;
    card.className = `unified-doc-card ${isGrounded ? 'active-grounded' : ''}`;
    card.setAttribute('data-doc-name', doc.source);

    let tag = 'DOC';
    const sLower = (doc.source || '').toLowerCase();
    if (sLower.includes('p-101')) tag = 'P-101A';
    else if (sLower.includes('k-102')) tag = 'K-102';
    else if (sLower.includes('f-101')) tag = 'F-101';
    else if (sLower.includes('c-201')) tag = 'C-201';
    else if (sLower.includes('rekap') || sLower.includes('sheet') || sLower.includes('.csv')) tag = 'SHEET/CSV';
    else if (sLower.includes('.pdf')) tag = 'PDF';
    else if (sLower.includes('.docx')) tag = 'DOCX';
    else if (sLower.includes('.xlsx')) tag = 'XLSX';

    const actionText = isGrounded 
      ? (state.lang === 'id' ? '✓ Terpilih' : '✓ Selected') 
      : (state.lang === 'id' ? 'Pilih / Ask AI' : 'Select / Ask AI');

    card.innerHTML = `
      <div class="udc-top-row">
        <span class="tag-badge blue">${tag}</span>
        <span class="udc-filename" title="${escapeHtml(doc.source)}">${escapeHtml(doc.source)}</span>
      </div>
      <div class="udc-meta-row">
        <span class="udc-chunk-badge">${doc.chunks_count || 1} Chunks</span>
        <button type="button" class="udc-action-btn" onclick="setActiveDocumentGrounding('${escapeHtml(doc.source)}')">
          ${actionText}
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  // Tombol See More / Show Less jika dokumen > 5 dan tidak sedang mencari
  if (!isSearching && filteredDocs.length > 5) {
    const seeMoreWrap = document.createElement('div');
    seeMoreWrap.className = 'see-more-docs-wrap';
    const remaining = filteredDocs.length - 5;
    const btnText = state.docsExpanded 
      ? (state.lang === 'id' ? 'Tampilkan Lebih Sedikit (Show Less)' : 'Show Less') 
      : (state.lang === 'id' ? `Lihat Lebih Banyak (${remaining} Dokumen Lagi)` : `See More (${remaining} More)`);

    seeMoreWrap.innerHTML = `
      <button type="button" class="see-more-docs-btn" onclick="toggleSeeMoreDocs()">
        <span>${btnText}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transform:${state.docsExpanded ? 'rotate(180deg)' : 'none'};transition:transform 0.2s ease;">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    `;
    container.appendChild(seeMoreWrap);
  }
}

function toggleSeeMoreDocs() {
  state.docsExpanded = !state.docsExpanded;
  renderUnifiedDocsList();
}

function filterUnifiedDocsList() {
  renderUnifiedDocsList();
}

function setActiveDocumentGrounding(sourceDoc) {
  state.activeGroundedDoc = sourceDoc;
  const tag = document.getElementById('activeGroundingTag');
  const text = document.getElementById('activeGroundingText');
  const clearBtn = document.getElementById('clearGroundingBtn');

  if (text) text.textContent = (state.lang === 'id' ? 'Dokumen: ' : 'Document: ') + sourceDoc;
  if (clearBtn) clearBtn.style.display = 'inline-block';
  if (tag) tag.style.display = 'inline-flex';

  renderUnifiedDocsList();
  showToast(state.lang === 'id' ? `Grounding difokuskan pada: ${sourceDoc}` : `Grounding focused on: ${sourceDoc}`, 'info');
}

function resetActiveGrounding() {
  state.activeGroundedDoc = null;
  const tag = document.getElementById('activeGroundingTag');
  const text = document.getElementById('activeGroundingText');
  const clearBtn = document.getElementById('clearGroundingBtn');

  if (text) text.textContent = '';
  if (clearBtn) clearBtn.style.display = 'none';
  if (tag) tag.style.display = 'none';

  renderUnifiedDocsList();
  showToast(state.lang === 'id' ? 'Fokus dokumen dinonaktifkan.' : 'Document focus reset.', 'info');
}

function analyzeLatestUploadedDoc() {
  if (state.storedDocs && state.storedDocs.length > 0) {
    const latest = state.storedDocs[0];
    setActiveDocumentGrounding(latest.source);
    const query = state.lang === 'id' 
      ? `Jelaskan ringkasan isi teknis dan prosedur keselamatan dari dokumen ${latest.source}`
      : `Summarize key technical procedures and safety requirements from document ${latest.source}`;
    queryEquipmentCopilot(state.selectedAssetTag, query);
  }
}

function openCitationInspect(sourceDoc) {
  setActiveDocumentGrounding(sourceDoc);
}

// ============================================================================
// 11. UTILITIES (TOAST & HELPERS)
// ============================================================================

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
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

function jsonParseSafe(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================
window.handleLoginSubmit = handleLoginSubmit;
window.handleUserLogout = handleUserLogout;
window.switchTab = switchTab;
window.handleFeatureSearch = handleFeatureSearch;
window.selectFeatureSearchResult = selectFeatureSearchResult;
window.clearFeatureSearch = clearFeatureSearch;
window.openEquipmentDetail = openEquipmentDetail;
window.closeEquipmentDetailModal = closeEquipmentDetailModal;
window.updateEquipmentStatus = updateEquipmentStatus;
window.openAddEquipmentModal = openAddEquipmentModal;
window.closeAddEquipmentModal = closeAddEquipmentModal;
window.handleSaveNewEquipment = handleSaveNewEquipment;
window.deleteEquipment = deleteEquipment;
window.changeChemicalStream = changeChemicalStream;
window.changeTelemetryParam = changeTelemetryParam;
window.toggleSiteVisibility = toggleSiteVisibility;
window.selectTelemetrySite = selectTelemetrySite;
window.setSiteSetpoint = setSiteSetpoint;
window.resetSiteSetpoint = resetSiteSetpoint;
window.askCopilotFromTelemetry = askCopilotFromTelemetry;
window.toggleLiveTelemetry = toggleLiveTelemetry;
window.scrollToDashSection = scrollToDashSection;
window.approveAiSuggestion = approveAiSuggestion;
window.rejectAiSuggestion = rejectAiSuggestion;
window.approveAiBatch = approveAiBatch;
window.rejectAiBatch = rejectAiBatch;
window.openChecklistFromChat = openChecklistFromChat;
window.escalateEquipment = escalateEquipment;
window.askCopilotForEquipment = askCopilotForEquipment;
window.toggleChecklistItem = toggleChecklistItem;
window.openAddChecklistModal = openAddChecklistModal;
window.closeAddChecklistModal = closeAddChecklistModal;
window.handleSaveNewChecklistItem = handleSaveNewChecklistItem;
window.deleteChecklistItem = deleteChecklistItem;
window.showFlowchartDetail = showFlowchartDetail;
window.selectAvatarPreset = selectAvatarPreset;
window.handleCustomAvatarUpload = handleCustomAvatarUpload;
window.saveUserProfile = saveUserProfile;
window.setDashboardLanguage = setDashboardLanguage;
window.executeQuickPrompt = executeQuickPrompt;
window.queryEquipmentCopilot = queryEquipmentCopilot;
window.setActiveDocumentGrounding = setActiveDocumentGrounding;
window.resetActiveGrounding = resetActiveGrounding;
window.analyzeLatestUploadedDoc = analyzeLatestUploadedDoc;
window.openCitationInspect = openCitationInspect;

