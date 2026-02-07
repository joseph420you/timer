// Firebase 配置
// Firebase 配置

window.firebaseConfig = {
    apiKey: "AIzaSyDDXMeDjzXckCbQva5GSNShttOv5tkQkAU",
    authDomain: "gen-lang-client-0975025233.firebaseapp.com",
    projectId: "gen-lang-client-0975025233",
    storageBucket: "gen-lang-client-0975025233.firebasestorage.app",
    messagingSenderId: "505353666884",
    appId: "1:505353666884:web:25044ccf7c34bef865d711"
};

// 預設 Tasks 顏色
window.DEFAULT_COLORS = [
    '#A855F7', // 紫色
    '#EC4899', // 粉色
    '#F43F5E', // 玫紅
    '#EF4444', // 紅色
    '#F97316', // 深橘
    '#F59E0B', // 橘色
    '#EAB308', // 黃色
    '#FACC15', // 金黃
    '#84CC16', // 萊姆綠
    '#22C55E', // 綠色
    '#10B981', // 碧綠
    '#14B8A6', // 青綠
    '#06B6D4', // 青色
    '#0EA5E9', // 天藍
    '#3B82F6', // 藍色
    '#6366F1', // 靛藍
    '#8B5CF6', // 紫羅蘭
    '#A855F7', // 紫色
    '#D946EF', // 品紅
    '#EC4899'  // 粉紅
];

// 應用程式配置
window.APP_CONFIG = {
    // 最小記錄時間（秒）
    MIN_RECORD_DURATION: 15,

    // 光暈芒刺數量
    GLOW_RAYS_COUNT: 24,

    // 時間軸小時範圍
    TIMELINE_HOURS: 24,

    // LocalStorage 鍵名
    STORAGE_KEYS: {
        TASKS: 'timer_tasks',
        RECORDS: 'timer_records',
        CURRENT_TASK: 'timer_current_task',
        TIMER_STATE: 'timer_state',
        LAST_ACTIVE_DATE: 'timer_last_active_date'
    }
};
