// 應用程式入口
import { initializeSampleData, checkDailyReset } from './storage.js';
import { ui } from './ui.js';

// 應用程式初始化
function initApp() {
    console.log('🚀 Timer App 正在啟動...');

    // 檢查每日重置
    const isNewDay = checkDailyReset();
    if (isNewDay) {
        console.log('📅 新的一天開始！');
    }

    // 初始化範例資料（如果是第一次使用）
    initializeSampleData();

    // 初始化 UI
    ui.init();

    console.log('✅ Timer App 啟動完成！');
}

// DOM 載入完成後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// 防止頁面重新整理時遺失計時狀態的警告
window.addEventListener('beforeunload', (e) => {
    // 這裡可以加入警告邏輯，但通常瀏覽器會限制自訂訊息
});
