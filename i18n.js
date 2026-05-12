// === Ultrasound Tongue DB v3 — i18n (Chinese / Japanese / English) ===

const I18N = {
  ja: {
    pageTitle: '超音波舌位動画データベース — Ultrasound Tongue DB',
    appTitle: '超音波舌位DB',
    exportBtn: '导出',
    importBtn: '导入',
    adminBtn: '管理',
    tableView: '表格',
    cardView: '卡片',
    searchPlaceholder: '🔍 検索... 音素 / 発話者 / タイトル / IPA / 備考',
    noData: 'データがありません。「管理」から動画を追加してください。',
    colTitle: 'タイトル',
    colPhoneme: '音素',
    colLang: '言語',
    colSpeaker: '発話者',
    colDate: '収録日',
    colDuration: '時間',
    colPlay: '再生',
    colSize: 'サイズ',
    colActions: '操作',
    adminPanel: '管理パネル',
    closePanel: '閉じる',
    addVideo: '動画を追加',
    editVideo: '動画を編集',
    fieldTitle: 'タイトル',
    titlePlaceholder: '例：/a/ 日本語母音 話者A',
    fieldPhoneme: '音素（カンマ区切り）',
    fieldLang: '言語',
    fieldSpeaker: '発話者',
    fieldDate: '収録日',
    fieldVideo: '動画ファイル',
    fileDropHint: 'クリックして動画を選択（またはドラッグ＆ドロップ）',
    orUrl: 'またはURL / パス',
    fieldNotes: '備考',
    notesPlaceholder: '超音波プローブ位置、フレームレート、実験条件など',
    saveBtn: '保存',
    cancelBtn: 'キャンセル',
    authTitle: '管理者認証',
    authDesc: 'データベースを編集するにはパスワードを入力してください。',
    authPlaceholder: 'パスワード',
    authBtn: '認証',
    wrongPassword: 'パスワードが違います。',
    deleteConfirm: 'この動画を削除してもよろしいですか？この操作は取り消せません。',
    saved: '✅ 保存しました！',
    imported: '件のデータをインポートしました。',
    importFail: '❌ JSONの解析に失敗しました: ',
    importConfirmExisting: 'インポートすると既存のデータに追加されます。続行しますか？',
    titleRequired: 'タイトルと音素は必須です。',
    lang_ja: '日本語',
    lang_zh: '中国語',
    lang_en: '英語',
    lang_ko: '韓国語',
    lang_other: 'その他',
    storageLabel: 'ディスク空き容量: ',
    storageUnlimited: '無制限（ローカルファイルサーバー）',
    untitled: '無題',
    adminActive: '管理中',
    fileSelected: '📹 ',
  },
  zh: {
    pageTitle: '超声舌位视频数据库 — Ultrasound Tongue DB',
    appTitle: '超声舌位DB',
    exportBtn: '导出',
    importBtn: '导入',
    adminBtn: '管理',
    tableView: '表格',
    cardView: '卡片',
    searchPlaceholder: '🔍 搜索... 音素 / 发音人 / 标题 / IPA / 备注',
    noData: '暂无数据。请通过「管理」面板添加视频。',
    colTitle: '标题',
    colPhoneme: '音素',
    colLang: '语言',
    colSpeaker: '发音人',
    colDate: '录制日期',
    colDuration: '时长',
    colPlay: '播放',
    colSize: '大小',
    colActions: '操作',
    adminPanel: '管理面板',
    closePanel: '关闭',
    addVideo: '添加视频',
    editVideo: '编辑视频',
    fieldTitle: '标题',
    titlePlaceholder: '例：/a/ 日语元音 发音人A',
    fieldPhoneme: '音素（逗号分隔）',
    fieldLang: '语言',
    fieldSpeaker: '发音人',
    fieldDate: '录制日期',
    fieldVideo: '视频文件',
    fileDropHint: '点击选择视频（或拖放）',
    orUrl: '或 URL / 路径',
    fieldNotes: '备注',
    notesPlaceholder: '超声波探头位置、帧率、实验条件等',
    saveBtn: '保存',
    cancelBtn: '取消',
    authTitle: '管理员认证',
    authDesc: '请输入密码以编辑数据库。',
    authPlaceholder: '密码',
    authBtn: '认证',
    wrongPassword: '密码错误。',
    deleteConfirm: '确定要删除此视频吗？此操作不可撤销。',
    saved: '✅ 已保存！',
    imported: '条数据已导入。',
    importFail: '❌ JSON解析失败: ',
    importConfirmExisting: '导入将追加到现有数据中。是否继续？',
    titleRequired: '标题和音素为必填项。',
    lang_ja: '日语',
    lang_zh: '中文',
    lang_en: '英语',
    lang_ko: '韩语',
    lang_other: '其他',
    storageLabel: '磁盘剩余空间: ',
    storageUnlimited: '无限制（本地文件服务器）',
    untitled: '无标题',
    adminActive: '管理中',
    fileSelected: '📹 ',
  },
  en: {
    pageTitle: 'Ultrasound Tongue Video Database — Ultrasound Tongue DB',
    appTitle: 'Ultrasound Tongue DB',
    exportBtn: 'Export',
    importBtn: 'Import',
    adminBtn: 'Admin',
    tableView: 'Table',
    cardView: 'Cards',
    searchPlaceholder: '🔍 Search... phoneme / speaker / title / IPA / notes',
    noData: 'No data. Use the Admin panel to add videos.',
    colTitle: 'Title',
    colPhoneme: 'Phoneme',
    colLang: 'Language',
    colSpeaker: 'Speaker',
    colDate: 'Date',
    colDuration: 'Duration',
    colPlay: 'Play',
    colSize: 'Size',
    colActions: 'Actions',
    adminPanel: 'Admin Panel',
    closePanel: 'Close',
    addVideo: 'Add Video',
    editVideo: 'Edit Video',
    fieldTitle: 'Title',
    titlePlaceholder: 'e.g. /a/ Japanese vowel Speaker A',
    fieldPhoneme: 'Phoneme (comma-separated)',
    fieldLang: 'Language',
    fieldSpeaker: 'Speaker',
    fieldDate: 'Recording Date',
    fieldVideo: 'Video File',
    fileDropHint: 'Click to select video (or drag & drop)',
    orUrl: 'or URL / path',
    fieldNotes: 'Notes',
    notesPlaceholder: 'Ultrasound probe position, frame rate, experimental conditions...',
    saveBtn: 'Save',
    cancelBtn: 'Cancel',
    authTitle: 'Admin Authentication',
    authDesc: 'Enter password to edit the database.',
    authPlaceholder: 'Password',
    authBtn: 'Authenticate',
    wrongPassword: 'Incorrect password.',
    deleteConfirm: 'Are you sure you want to delete this video? This cannot be undone.',
    saved: '✅ Saved!',
    imported: ' records imported.',
    importFail: '❌ JSON parse failed: ',
    importConfirmExisting: 'Import will add to existing data. Continue?',
    titleRequired: 'Title and phoneme are required.',
    lang_ja: 'Japanese',
    lang_zh: 'Chinese',
    lang_en: 'English',
    lang_ko: 'Korean',
    lang_other: 'Other',
    storageLabel: 'Disk space available: ',
    storageUnlimited: 'Unlimited (local file server)',
    untitled: 'Untitled',
    adminActive: 'Admin Mode',
    fileSelected: '📹 ',
  }
};

let currentLang = localStorage.getItem('ultrasound-db-lang') || 'ja';

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || I18N['ja'][key] || key;
}

function switchLang(lang) {
  currentLang = lang;
  localStorage.setItem('ultrasound-db-lang', lang);

  // Update lang buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (I18N[lang] && I18N[lang][key]) {
      el.textContent = I18N[lang][key];
    }
  });

  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (I18N[lang] && I18N[lang][key]) {
      el.placeholder = I18N[lang][key];
    }
  });

  // Update HTML lang attribute
  document.documentElement.lang = lang;

  // Update document title
  document.title = t('pageTitle');

  // Re-render table/cards with new language
  if (typeof applyFilters === 'function') {
    applyFilters();
  }

  // Update admin button text
  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) {
    if (isAdmin) {
      adminBtn.innerHTML = '🔓 ' + t('adminActive');
    } else {
      adminBtn.innerHTML = '🔒 ' + t('adminBtn');
    }
  }

  // Update view toggle
  const viewToggle = document.getElementById('view-toggle');
  if (viewToggle) {
    viewToggle.innerHTML = (currentView === 'table' ? '📋 ' + t('tableView') : '🃏 ' + t('cardView'));
  }
}

// Apply i18n on load
document.addEventListener('DOMContentLoaded', () => {
  switchLang(currentLang);
});
