// Firebase 配置
// 請將此處的 PLACEHOLDER 替換為您的 Firebase 配置

export const firebaseConfig = {
    apiKey: "PLACEHOLDER",
    authDomain: "PLACEHOLDER",
    projectId: "PLACEHOLDER",
    storageBucket: "PLACEHOLDER",
    messagingSenderId: "PLACEHOLDER",
    appId: "PLACEHOLDER"
};

// 預設 Tasks 顏色
export const DEFAULT_COLORS = [
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
export const APP_CONFIG = {
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
