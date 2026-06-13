/**
 * i18n.js — Translation system (Arabic / English)
 */

const translations = {
  ar: {
    // index.html
    loginTitle: 'تسجيل الدخول — Smart Lab',
    sysName: 'Smart Lab',
    sysDesc: 'نظام إدارة وصيانة مختبرات الحاسب',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'admin@lab.com',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: '••••••••',
    loginBtn: 'دخول',
    loggingIn: 'جاري الدخول...',
    forgotPassword: 'هل نسيت كلمة المرور؟',
    langBtn: 'English',

    // Common / Sidebar
    appName: 'Smart Lab',
    dashboard: 'لوحة التحكم',
    devices: 'الأجهزة',
    issues: 'الأعطال',
    maintenance: 'الصيانة',
    map: 'الخريطة',
    alerts: 'التنبيهات',
    aiAssistant: 'مساعد AI',
    reports: 'التقارير',
    users: 'المستخدمون',
    logout: 'خروج',
    user: 'مستخدم',
    footerText: 'Smart Lab © 2026',
    copyright: 'Smart Lab © 2026',

    // Common status/labels
    totalDevices: 'إجمالي الأجهزة',
    workingDevices: 'أجهزة تعمل',
    brokenDevices: 'أجهزة متوقفة',
    underMaintenance: 'قيد الصيانة',
    working: 'يعمل',
    broken: 'متوقف',
    works: 'يعمل',
    stopped: 'متوقف',
    maintenance_short: 'صيانة',
    low: 'منخفضة',
    medium: 'متوسطة',
    high: 'عالية',
    open: 'مفتوح',
    in_progress: 'قيد العمل',
    resolved: 'محلول',
    loading: 'جاري التحميل...',
    noDevicesFound: 'لا توجد أجهزة',
    noIssuesFound: 'لا توجد أعطال',
    noRecordsFound: 'لا توجد سجلات',
    noDataAvailable: 'لا توجد بيانات',
    noAlertsFound: 'لا توجد تنبيهات',
    noUsersFound: 'لا يوجد مستخدمون',
    clickToViewDetails: 'اضغط لعرض التفاصيل',

    // dashboard.html
    deviceStatusDistribution: 'توزيع حالات الأجهزة',
    latestIssues: 'آخر الأعطال',
    showAll: 'عرض الكل',
    device: 'الجهاز',
    problem: 'المشكلة',
    priority: 'الأولوية',
    status: 'الحالة',
    date: 'التاريخ',
    noIssues: 'لا توجد أعطال',
    unreadAlerts: 'التنبيهات غير المقروءة',
    noUnreadAlerts: 'لا توجد تنبيهات غير مقروءة',

    // devices.html
    deviceManagement: 'إدارة الأجهزة',
    addDevice: 'إضافة جهاز',
    searchPlaceholder: 'بحث باسم الجهاز...',
    allStatuses: 'كل الحالات',
    refresh: 'تحديث',
    deviceName: 'اسم الجهاز',
    type: 'النوع',
    processor: 'المعالج',
    ram: 'الرام',
    lastMaintenance: 'آخر صيانة',
    actions: 'الإجراءات',
    addNewDevice: 'إضافة جهاز جديد',
    deviceNameRequired: 'اسم الجهاز *',
    typeRequired: 'النوع *',
    operatingSystem: 'نظام التشغيل',
    locationX: 'الموقع X',
    locationY: 'الموقع Y',
    ageYears: 'العمر (سنوات)',
    purchaseDate: 'تاريخ الشراء',
    notes: 'ملاحظات',
    cancel: 'إلغاء',
    save: 'حفظ',
    close: 'إغلاق',
    qr: 'QR',
    edit: 'تعديل',
    delete: 'حذف',
    deviceUpdated: 'تم تحديث الجهاز',
    deviceAdded: 'تمت إضافة الجهاز',
    confirmDeleteDevice: 'هل أنت متأكد من حذف هذا الجهاز؟',
    editDevice: 'تعديل الجهاز',

    // device.html
    deviceDetails: 'تفاصيل الجهاز',
    backToDevices: 'رجوع للأجهزة',
    os: 'نظام التشغيل',
    age: 'العمر',
    years: 'سنوات',
    reportIssue: 'إبلاغ عن عطل',
    statusWorking: '✅ يعمل',
    statusBroken: '❌ متوقف',
    statusMaintenance: '🛠 صيانة',
    issueType: 'نوع المشكلة',
    errorLoadingData: 'حدث خطأ في تحميل البيانات',
    noDeviceSelected: 'لم يتم تحديد جهاز',
    statusUpdated: 'تم تحديث الحالة',

    // issues.html
    myIssues: 'بلاغاتي',
    issuesAndReports: 'الأعطال والبلاغات',
    submitNewIssue: 'تقديم بلاغ جديد',
    selectDevice: '— اختر الجهاز —',
    selectType: '— اختر النوع —',
    screenIssue: 'عطل في الشاشة',
    keyboardIssue: 'مشكلة في الكيبورد',
    deviceNotWorking: 'الجهاز لا يعمل',
    verySlow: 'بطء شديد',
    networkIssue: 'مشكلة في الشبكة',
    mouseIssue: 'عطل في الماوس',
    audioIssue: 'مشكلة في الصوت',
    other: 'أخرى',
    issueDescription: 'وصف المشكلة *',
    describeIssue: 'اشرح المشكلة بالتفصيل...',
    imageOptional: 'صورة (اختياري)',
    geminiSuggestions: 'اقتراحات Gemini AI',
    analyzing: 'جاري التحليل...',
    submitIssue: 'إرسال البلاغ',
    all: 'الكل',
    issue: 'المشكلة',
    action: 'إجراء',
    issueDetails: 'تفاصيل البلاغ',
    updateIssueStatus: 'تحديث حالة البلاغ',
    newStatus: 'الحالة الجديدة',
    resolutionNotes: 'ملاحظات الإصلاح',
    description: 'الوصف',
    aiSuggestions: 'اقتراحات AI',
    attachedImage: 'الصورة المرفقة',
    dateLabel: '📅 التاريخ:',
    resolvedDateLabel: '✅ تاريخ الحل:',
    reporterLabel: '👤 مقدم البلاغ:',
    technicianLabel: '🔧 الفني:',
    update: 'تحديث',
    clickToViewDetails: 'اضغط لعرض التفاصيل',
    analyzingWithGemini: 'جاري التحليل بواسطة Gemini AI...',
    couldNotGetSuggestions: 'تعذر الحصول على اقتراحات الآن',
    issueSubmittedSuccessfully: 'تم إرسال البلاغ بنجاح',

    // maintenance.html
    maintenanceLog: 'سجل الصيانة',
    maintenanceLogs: 'سجل عمليات الصيانة',
    from: 'من',
    to: 'إلى',
    technicianNamePlaceholder: 'اسم الفني...',
    filter: 'تصفية',
    reset: 'إعادة ضبط',
    number: '#',
    technician: 'الفني',
    notes: 'ملاحظات',

    // map.html
    labMap: 'خريطة المختبر',
    interactiveLabMap: 'خريطة المختبر التفاعلية',
    refreshMap: 'تحديث الخريطة',
    clickDevice: 'انقر على أي جهاز لعرض تفاصيله',

    // alerts.html
    predictiveAlerts: 'التنبيهات التنبؤية',
    markAllAsRead: 'تعليم الكل كمقروء',
    aiModelPredictions: 'تنبؤات نموذج الذكاء الاصطناعي',
    runModel: 'تشغيل النموذج',
    predictionsTab: 'التنبؤات',
    running: 'جاري التشغيل...',
    newAlertCreated: 'تنبيه جديد',
    predictionBadge: 'تنبؤ',
    readBtn: 'قراءة',
    markedAsRead: 'تم التعليم كمقروء',
    allMarkedAsRead: 'تم تعليم الكل كمقروء',

    // ai.html
    linkToDevice: 'اربط بجهاز (اختياري):',
    noDeviceSelected: '— بدون جهاز محدد —',
    newChat: 'محادثة جديدة',
    deviceWontTurnOn: '🔴 الجهاز لا يشتغل',
    screenIssueQuick: '📺 مشكلة في الشاشة',
    deviceIsSlow: '🐢 الجهاز بطيء',
    keyboardIssueQuick: '⌨️ عطل في الكيبورد',
    networkIssueQuick: '🌐 مشكلة شبكة',
    beepingSound: '🔔 صوت بيب',
    welcomeMessage: 'مرحباً! أنا مساعدك الذكي لتشخيص أعطال أجهزة الكمبيوتر. 🖥️\n\nيمكنني مساعدتك في:\n• تشخيص الأعطال\n• اقتراح حلول\n• نصائح صيانة\n\nكيف يمكنني مساعدتك اليوم؟',
    describeIssuePlaceholder: 'اشرح المشكلة...',
    send: 'إرسال',
    pleaseEnterDescription: 'يرجى إدخال وصف أوضح (5 أحرف على الأقل)',
    unableToConnectAI: 'تعذر الاتصال بالمساعد الذكي',

    // reports.html
    labReports: 'تقارير المختبر',
    print: 'طباعة',
    dateFilter: 'فلتر تاريخ',
    apply: 'تطبيق',
    totalIssues: 'إجمالي البلاغات',
    averageRepairTime: 'متوسط وقت الإصلاح (ساعة)',
    resolved: 'تم حلها',
    monthlyIssues: 'البلاغات الشهرية',
    mostBrokenDevices: 'أكثر الأجهزة أعطالاً',
    issuesSuffix: 'أعطال',
    issuesCount: 'عدد البلاغات',
    january: 'يناير',
    february: 'فبراير',
    march: 'مارس',
    april: 'أبريل',
    may: 'مايو',
    june: 'يونيو',
    july: 'يوليو',
    august: 'أغسطس',
    september: 'سبتمبر',
    october: 'أكتوبر',
    november: 'نوفمبر',
    december: 'ديسمبر',

    // admin.html
    userManagement: 'إدارة المستخدمين',
    addUser: 'إضافة مستخدم',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    role: 'الدور',
    createdDate: 'تاريخ الإنشاء',
    admin: 'مدير',
    technician: 'فني',
    password: 'كلمة المرور',
    atLeast8Chars: '8 أحرف على الأقل',
    addNewUser: 'إضافة مستخدم جديد',
    editUser: 'تعديل مستخدم',
    leaveEmptyToKeep: 'اتركه فارغاً للاحتفاظ بكلمة المرور الحالية',
    updated: 'تم التحديث',
    added: 'تمت الإضافة',
    deleted: 'تم الحذف',
    permanentlyDeleted: 'سيتم الحذف نهائيًا. هل أنت متأكد؟',

    // forgot-password.html & reset-password.html
    forgotTitle: 'استعادة كلمة المرور — Smart Lab',
    forgotHeading: 'استعادة كلمة المرور',
    forgotDesc: 'أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين',
    sendBtn: 'إرسال الرابط',
    sending: 'جاري الإرسال...',
    tokenLabel: 'رمز إعادة التعيين (للعرض التجريبي)',
    copyToken: 'نسخ الرمز',
    checkConsole: 'تم إرسال الرمز — تحقق من سجلات الخادم (console)',
    backToLogin: 'العودة لتسجيل الدخول',
    resetTitle: 'إعادة تعيين كلمة المرور — Smart Lab',
    resetHeading: 'كلمة مرور جديدة',
    resetDesc: 'أدخل كلمة المرور الجديدة',
    newPasswordLabel: 'كلمة المرور الجديدة',
    confirmPasswordLabel: 'تأكيد كلمة المرور',
    resetBtn: 'حفظ كلمة المرور',
    resetting: 'جاري الحفظ...',
    passwordMismatch: 'كلمتا المرور غير متطابقتين',
    missingToken: 'الرمز مفقود من الرابط',

    // profile.html
    profileTitle: 'الملف الشخصي',
    myProfile: 'ملفي الشخصي',
    changePassword: 'تغيير كلمة المرور',
    currentPassword: 'كلمة المرور الحالية',
    newPassword: 'كلمة المرور الجديدة',
    saveChanges: 'حفظ التغييرات',
    passwordChanged: 'تم تغيير كلمة المرور',
    profileUpdated: 'تم تحديث الملف الشخصي',
    incorrectPassword: 'كلمة المرور الحالية غير صحيحة',

    today: 'اليوم',
    thisWeek: 'هذا الأسبوع',
    action: 'الإجراء',
    entityType: 'النوع',
    entityId: 'المعرف',
    details: 'التفاصيل',
    ipAddress: 'عنوان IP',

    // inventory.html
    inventory: 'المخزون',
    inventoryManagement: 'إدارة المخزون',
    addPart: 'إضافة قطعة',
    partName: 'اسم القطعة',
    category: 'الفئة',
    quantity: 'الكمية',
    minStock: 'الحد الأدنى',
    unitCost: 'تكلفة الوحدة',
    supplier: 'المورد',
    location: 'الموقع',
    lowStock: 'مخزون منخفض',
    allCategories: 'كل الفئات',
    exportCSV: 'تصدير CSV',
    noPartsFound: 'لا توجد قطع',
    stockStatus: 'حالة المخزون',
    inStock: 'متوفر',
    outOfStock: 'غير متوفر',
    lowStockWarning: 'مخزون منخفض',
    partAdded: 'تمت إضافة القطعة',
    partUpdated: 'تم تحديث القطعة',
    partDeleted: 'تم حذف القطعة',
    confirmDeletePart: 'هل أنت متأكد من حذف هذه القطعة؟',

    // devices.html additions
    exportDevices: 'تصدير الأجهزة',
    assetTag: 'رمز الأصل',
    serialNumber: 'الرقم التسلسلي',
    warrantyExpiry: 'انتهاء الضمان',
    vendorSupport: 'دعم البائع',

    // alerts.html additions
    dismissAlert: 'تجاهل',
    alertDismissed: 'تم تجاهل التنبيه',
    alertSettings: 'إعدادات التنبيهات',
    mlThreshold: 'عتبة ML (%)',
    settingsSaved: 'تم حفظ الإعدادات',

    // calendar.html
    maintenanceCalendar: 'تقويم الصيانة',
    scheduleMaintenance: 'جدولة صيانة',
    eventTitle: 'العنوان',
    scheduledDate: 'التاريخ المحدد',
    assignedTechnician: 'الفني المكلف',
    assigned: 'مُعيّن',
    unassigned: 'غير معيّن',
    assignToTechnician: 'تعيين لفني',
    autoAssign: 'تعيين تلقائي',
    selectTechnician: 'اختيار فني',
    allIssues: 'كل الأعطال',
    myAssignedIssues: 'أعطالي المُعيّنة',
    unassignedIssues: 'أعطال غير معيّنة',
    newAssignmentAlert: 'تعيين جديد',
    eventStatus: 'الحالة',
    updateStatus: 'تحديث الحالة',
    resolveIssue: 'حل المشكلة',
    maintenanceNotes: 'ملاحظات الصيانة',
    maintenanceNotesPlaceholder: 'اشرح ما تم عمله...',
    startWork: 'بدء العمل',
    myTasks: 'مهامي',
    noEventsFound: 'لا توجد أحداث',
    eventAdded: 'تمت إضافة الحدث',
    eventUpdated: 'تم تحديث الحدث',
    eventDeleted: 'تم حذف الحدث',

    // search
    search: 'بحث',
    searchResults: 'نتائج البحث',
    searchPlaceholder: 'بحث في الأجهزة والأعطال والمخزون...',
    noResults: 'لا توجد نتائج',
  },
  en: {
    // index.html
    loginTitle: 'Login — Smart Lab',
    sysName: 'Smart Lab',
    sysDesc: 'Computer Lab Management & Maintenance System',
    emailLabel: 'Email',
    emailPlaceholder: 'admin@lab.com',
    passwordLabel: 'Password',
    passwordPlaceholder: '••••••••',
    loginBtn: 'Login',
    loggingIn: 'Logging in...',
    forgotPassword: 'Forgot password?',
    langBtn: 'العربية',

    // Common / Sidebar
    appName: 'Smart Lab',
    dashboard: 'Dashboard',
    devices: 'Devices',
    issues: 'Issues',
    maintenance: 'Maintenance',
    map: 'Map',
    alerts: 'Alerts',
    aiAssistant: 'AI Assistant',
    reports: 'Reports',
    users: 'Users',
    logout: 'Logout',
    user: 'User',
    footerText: 'Smart Lab © 2026',
    copyright: 'Smart Lab © 2026',

    // Common status/labels
    totalDevices: 'Total Devices',
    workingDevices: 'Working',
    brokenDevices: 'Broken',
    underMaintenance: 'Under Maintenance',
    working: 'Working',
    broken: 'Broken',
    works: 'Working',
    stopped: 'Stopped',
    maintenance_short: 'Maintenance',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    loading: 'Loading...',
    noDevicesFound: 'No devices found',
    noIssuesFound: 'No issues found',
    noRecordsFound: 'No records found',
    noDataAvailable: 'No data available',
    noAlertsFound: 'No alerts found',
    noUsersFound: 'No users found',
    clickToViewDetails: 'Click to view details',

    // dashboard.html
    deviceStatusDistribution: 'Device Status Distribution',
    latestIssues: 'Latest Issues',
    showAll: 'Show All',
    device: 'Device',
    problem: 'Problem',
    priority: 'Priority',
    status: 'Status',
    date: 'Date',
    noIssues: 'No issues found',
    unreadAlerts: 'Unread Alerts',
    noUnreadAlerts: 'No unread alerts',

    // devices.html
    deviceManagement: 'Device Management',
    addDevice: 'Add Device',
    searchPlaceholder: 'Search by device name...',
    allStatuses: 'All Statuses',
    refresh: 'Refresh',
    deviceName: 'Device Name',
    type: 'Type',
    processor: 'Processor',
    ram: 'RAM',
    lastMaintenance: 'Last Maintenance',
    actions: 'Actions',
    addNewDevice: 'Add New Device',
    deviceNameRequired: 'Device Name *',
    typeRequired: 'Type *',
    operatingSystem: 'Operating System',
    locationX: 'Location X',
    locationY: 'Location Y',
    ageYears: 'Age (Years)',
    purchaseDate: 'Purchase Date',
    notes: 'Notes',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    qr: 'QR',
    edit: 'Edit',
    delete: 'Delete',
    deviceUpdated: 'Device updated',
    deviceAdded: 'Device added',
    confirmDeleteDevice: 'Are you sure you want to delete this device?',
    editDevice: 'Edit Device',

    // device.html
    deviceDetails: 'Device Details',
    backToDevices: 'Back to Devices',
    os: 'OS',
    age: 'Age',
    years: 'years',
    reportIssue: 'Report Issue',
    statusWorking: '✅ Working',
    statusBroken: '❌ Broken',
    statusMaintenance: '🛠 Maintenance',
    issueType: 'Issue Type',
    errorLoadingData: 'Error loading data',
    noDeviceSelected: 'No device selected',
    statusUpdated: 'Status updated',

    // issues.html
    myIssues: 'My Issues',
    issuesAndReports: 'Issues and Reports',
    submitNewIssue: 'Submit New Issue',
    selectDevice: '— Select Device —',
    selectType: '— Select Type —',
    screenIssue: 'Screen Issue',
    keyboardIssue: 'Keyboard Issue',
    deviceNotWorking: 'Device Not Working',
    verySlow: 'Very Slow',
    networkIssue: 'Network Issue',
    mouseIssue: 'Mouse Issue',
    audioIssue: 'Audio Issue',
    other: 'Other',
    issueDescription: 'Issue Description *',
    describeIssue: 'Describe the issue in detail...',
    imageOptional: 'Image (Optional)',
    geminiSuggestions: 'Gemini AI Suggestions',
    analyzing: 'Analyzing...',
    submitIssue: 'Submit Issue',
    all: 'All',
    issue: 'Issue',
    action: 'Action',
    issueDetails: 'Issue Details',
    updateIssueStatus: 'Update Issue Status',
    newStatus: 'New Status',
    resolutionNotes: 'Resolution Notes',
    description: 'Description',
    aiSuggestions: 'AI Suggestions',
    attachedImage: 'Attached Image',
    dateLabel: '📅 Date:',
    resolvedDateLabel: '✅ Resolved Date:',
    reporterLabel: '👤 Reporter:',
    technicianLabel: '🔧 Technician:',
    update: 'Update',
    analyzingWithGemini: 'Analyzing with Gemini AI...',
    couldNotGetSuggestions: 'Could not get suggestions now',
    issueSubmittedSuccessfully: 'Issue submitted successfully',

    // maintenance.html
    maintenanceLog: 'Maintenance Log',
    maintenanceLogs: 'Maintenance Logs',
    from: 'From',
    to: 'To',
    technicianNamePlaceholder: 'Technician name...',
    filter: 'Filter',
    reset: 'Reset',
    number: '#',
    technician: 'Technician',
    notes: 'Notes',

    // map.html
    labMap: 'Lab Map',
    interactiveLabMap: 'Interactive Lab Map',
    refreshMap: 'Refresh Map',
    clickDevice: 'Click any device to view details',

    // alerts.html
    predictiveAlerts: 'Predictive Alerts',
    markAllAsRead: 'Mark all as read',
    aiModelPredictions: 'AI Model Predictions',
    runModel: 'Run Model',
    predictionsTab: 'Predictions',
    running: 'Running...',
    newAlertCreated: 'new alert(s) created',
    predictionBadge: 'Prediction',
    readBtn: 'Read',
    markedAsRead: 'Marked as read',
    allMarkedAsRead: 'All marked as read',

    // ai.html
    linkToDevice: 'Link to device (optional):',
    noDeviceSelected: '— No device selected —',
    newChat: 'New Chat',
    deviceWontTurnOn: '🔴 Device won\'t turn on',
    screenIssueQuick: '📺 Screen issue',
    deviceIsSlow: '🐢 Device is slow',
    keyboardIssueQuick: '⌨️ Keyboard issue',
    networkIssueQuick: '🌐 Network issue',
    beepingSound: '🔔 Beeping sound',
    welcomeMessage: 'Hello! I\'m your smart assistant for diagnosing computer issues. 🖥️\n\nI can help you with:\n• Fault diagnosis\n• Solution suggestions\n• Maintenance tips\n\nHow can I help you today?',
    describeIssuePlaceholder: 'Describe the issue...',
    send: 'Send',
    pleaseEnterDescription: 'Please enter a clearer description (at least 5 characters)',
    unableToConnectAI: 'Unable to connect to the AI assistant',

    // reports.html
    labReports: 'Lab Reports',
    print: 'Print',
    dateFilter: 'Date filter',
    apply: 'Apply',
    totalIssues: 'Total Issues',
    averageRepairTime: 'Average Repair Time (hours)',
    resolved: 'Resolved',
    monthlyIssues: 'Monthly Issues',
    mostBrokenDevices: 'Most Broken Devices',
    issuesSuffix: 'issues',
    issuesCount: 'Issues Count',
    january: 'January',
    february: 'February',
    march: 'March',
    april: 'April',
    may: 'May',
    june: 'June',
    july: 'July',
    august: 'August',
    september: 'September',
    october: 'October',
    november: 'November',
    december: 'December',

    // admin.html
    userManagement: 'User Management',
    addUser: 'Add User',
    name: 'Name',
    email: 'Email',
    role: 'Role',
    createdDate: 'Created Date',
    admin: 'Admin',
    technician: 'Technician',
    password: 'Password',
    atLeast8Chars: 'At least 8 characters',
    addNewUser: 'Add New User',
    editUser: 'Edit User',
    leaveEmptyToKeep: 'Leave empty to keep current password',
    updated: 'Updated',
    added: 'Added',
    deleted: 'Deleted',
    permanentlyDeleted: 'will be permanently deleted. Are you sure?',

    // forgot-password.html & reset-password.html
    forgotTitle: 'Reset Password — Smart Lab',
    forgotHeading: 'Reset Password',
    forgotDesc: 'Enter your email to receive a reset link',
    sendBtn: 'Send Reset Link',
    sending: 'Sending...',
    tokenLabel: 'Reset Token (for demo)',
    copyToken: 'Copy Token',
    checkConsole: 'Token sent — check server logs (console)',
    backToLogin: 'Back to Login',
    resetTitle: 'Reset Password — Smart Lab',
    resetHeading: 'New Password',
    resetDesc: 'Enter your new password',
    newPasswordLabel: 'New Password',
    confirmPasswordLabel: 'Confirm Password',
    resetBtn: 'Save Password',
    resetting: 'Saving...',
    passwordMismatch: 'Passwords do not match',
    missingToken: 'Token is missing from the URL',

    // profile.html
    profileTitle: 'Profile',
    myProfile: 'My Profile',
    changePassword: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    saveChanges: 'Save Changes',
    passwordChanged: 'Password changed successfully',
    profileUpdated: 'Profile updated',
    incorrectPassword: 'Current password is incorrect',

    today: 'Today',
    thisWeek: 'This Week',
    action: 'Action',
    entityType: 'Entity Type',
    entityId: 'Entity ID',
    details: 'Details',
    ipAddress: 'IP Address',

    // inventory.html
    inventory: 'Inventory',
    inventoryManagement: 'Inventory Management',
    addPart: 'Add Part',
    partName: 'Part Name',
    category: 'Category',
    quantity: 'Quantity',
    minStock: 'Min Stock',
    unitCost: 'Unit Cost',
    supplier: 'Supplier',
    location: 'Location',
    lowStock: 'Low Stock',
    allCategories: 'All Categories',
    exportCSV: 'Export CSV',
    noPartsFound: 'No parts found',
    stockStatus: 'Stock Status',
    inStock: 'In Stock',
    outOfStock: 'Out of Stock',
    lowStockWarning: 'Low Stock',
    partAdded: 'Part added',
    partUpdated: 'Part updated',
    partDeleted: 'Part deleted',
    confirmDeletePart: 'Are you sure you want to delete this part?',

    // devices.html additions
    exportDevices: 'Export Devices',
    assetTag: 'Asset Tag',
    serialNumber: 'Serial Number',
    warrantyExpiry: 'Warranty Expiry',
    vendorSupport: 'Vendor Support',

    // alerts.html additions
    dismissAlert: 'Dismiss',
    alertDismissed: 'Alert dismissed',
    alertSettings: 'Alert Settings',
    mlThreshold: 'ML Threshold (%)',
    settingsSaved: 'Settings saved',

    // calendar.html
    maintenanceCalendar: 'Maintenance Calendar',
    scheduleMaintenance: 'Schedule Maintenance',
    eventTitle: 'Title',
    scheduledDate: 'Scheduled Date',
    assignedTechnician: 'Assigned Technician',
    assigned: 'Assigned',
    unassigned: 'Unassigned',
    assignToTechnician: 'Assign to Technician',
    autoAssign: 'Auto Assign',
    selectTechnician: 'Select Technician',
    allIssues: 'All Issues',
    myAssignedIssues: 'My Assigned Issues',
    unassignedIssues: 'Unassigned Issues',
    newAssignmentAlert: 'New Assignment',
    eventStatus: 'Status',
    updateStatus: 'Update Status',
    resolveIssue: 'Resolve Issue',
    maintenanceNotes: 'Maintenance Notes',
    maintenanceNotesPlaceholder: 'Describe what was done...',
    startWork: 'Start Work',
    myTasks: 'My Tasks',
    noEventsFound: 'No events found',
    eventAdded: 'Event added',
    eventUpdated: 'Event updated',
    eventDeleted: 'Event deleted',

    // search
    search: 'Search',
    searchResults: 'Search Results',
    searchPlaceholder: 'Search devices, issues, inventory...',
    noResults: 'No results found',
  }
};

function getLang() {
  return localStorage.getItem('lang') || 'en';
}

function setLanguage(lang) {
  if (!translations[lang]) lang = 'ar';
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  applyTranslations();
  // Dispatch event so pages can re-render dynamic content
  window.dispatchEvent(new Event('languagechange'));
}

function t(key) {
  const lang = getLang();
  return translations[lang]?.[key] ?? translations['ar']?.[key] ?? key;
}

function applyTranslations() {
  // text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[getLang()]?.[key]) {
      el.textContent = translations[getLang()][key];
    }
  });
  // placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (translations[getLang()]?.[key]) {
      el.placeholder = translations[getLang()][key];
    }
  });
  // title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (translations[getLang()]?.[key]) {
      el.title = translations[getLang()][key];
    }
  });
  // document title
  const titleEl = document.querySelector('title[data-i18n]');
  if (titleEl) {
    const key = titleEl.dataset.i18n;
    if (translations[getLang()]?.[key]) {
      document.title = translations[getLang()][key];
    }
  }
  // update lang switcher button text if it exists
  const switcher = document.getElementById('lang-switcher');
  if (switcher) {
    switcher.textContent = t('langBtn');
  }
}

// Init on load
(function init() {
  const saved = getLang();
  document.documentElement.lang = saved;
  document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTranslations);
  } else {
    applyTranslations();
  }
})();

export { getLang, setLanguage, t, applyTranslations };
