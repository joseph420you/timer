// ========== 配置 ==========
const APP_CONFIG = {
    MIN_RECORD_DURATION: 15,
    GLOW_RAYS_COUNT: 24,
    TIMELINE_HOURS: 24,
    STORAGE_KEYS: {
        TASKS: 'timer_tasks',
        RECORDS: 'timer_records',
        CURRENT_TASK: 'timer_current_task',
        TIMER_STATE: 'timer_state',
        LAST_ACTIVE_DATE: 'timer_last_active_date'
    }
};

const DEFAULT_COLORS = [
    '#A855F7', '#EC4899', '#F43F5E', '#EF4444', '#F97316',
    '#F59E0B', '#EAB308', '#FACC15', '#84CC16', '#22C55E',
    '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
    '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899'
];

// ========== 工具函數 ==========
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getTodayDate() {
    return formatDate(new Date());
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatDurationShort(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatDisplayDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[date.getDay()];
    return `${year}. ${month}. ${day}. ${dayName}`;
}

// ========== 資料儲存（新結構）==========
const Storage = {
    // 緩存資料
    _tasksConfig: null,     // Tasks 配置緩存
    _dailyRecordsCache: {}, // 每日記錄緩存 { 'YYYY-MM-DD': dailyRecord }
    _isOnline: false,

    // 初始化
    async init() {
        console.log('🔧 Storage 初始化中...');

        // 載入本地配置
        const tasksConfig = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TASKS);
        if (tasksConfig) {
            this._tasksConfig = JSON.parse(tasksConfig);
            console.log('📖 載入本地任務配置:', this._tasksConfig.items.length, '個任務');
        } else {
            // 初始化預設配置
            this._tasksConfig = { items: [] };
            this.saveTasksConfig(this._tasksConfig);
            console.log('🆕 初始化新任務配置');
        }

        // 監聽認證狀態變化
        if (typeof FirebaseAuth !== 'undefined') {
            console.log('🕵️ 註冊認證狀態監聽...');
            FirebaseAuth.onAuthStateChanged(async (user) => {
                const wasOnline = this._isOnline;
                this._isOnline = !!user;
                console.log(`📡 連線狀態變更: ${wasOnline} -> ${this._isOnline}`, user ? `(用戶: ${user.uid})` : '(未登入)');

                if (user) {
                    console.log('🔄 開始同步雲端資料...');
                    await this.syncFromCloud();
                } else {
                    console.log('💾 已登出，清除緩存');
                    // 保持 _tasksConfig 不變，允許離線查看，或者根據需求清除
                    this._dailyRecordsCache = {};
                }
            });
        }
    },

    isOnline() {
        return (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.isLoggedIn()) || false;
    },

    // 從雲端同步基本資料
    async syncFromCloud() {
        if (!this.isOnline()) return;

        try {
            console.log('🔄 正在從雲端同步資料...');

            // 同步 Tasks 配置
            let tasksConfig = await FirestoreDB.getTasksConfig();

            // 檢查是否為初次同步（雲端為空，本地有資料）
            if ((!tasksConfig || !tasksConfig.items || tasksConfig.items.length === 0) &&
                this._tasksConfig && this._tasksConfig.items && this._tasksConfig.items.length > 0) {
                console.log('📤 偵測到本地有資料而雲端為空，執行初次上傳...');
                await this.saveTasksConfig(this._tasksConfig);
                tasksConfig = this._tasksConfig;
            } else {
                this._tasksConfig = tasksConfig;
                localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TASKS, JSON.stringify(tasksConfig));
            }

            // 同步當前任務
            const currentTaskId = await FirestoreDB.getCurrentTaskId();
            if (currentTaskId) {
                localStorage.setItem(APP_CONFIG.STORAGE_KEYS.CURRENT_TASK, currentTaskId);
            }

            // 同步計時器狀態
            const timerState = await FirestoreDB.getTimerState();
            if (timerState) {
                localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TIMER_STATE, JSON.stringify(timerState));
            }

            // 同步今天的記錄
            const today = formatDate(new Date());
            await this.loadDailyRecord(today);

            console.log('✅ 雲端同步完成');

            if (typeof UI !== 'undefined' && UI.updateHomePage) {
                UI.updateHomePage();
            }
        } catch (error) {
            console.error('❌ 雲端同步失敗:', error);
        }
    },

    // ===== Tasks 操作 =====

    // 取得 Tasks 配置
    getTasksConfig() {
        if (this._tasksConfig) return this._tasksConfig;
        const configJson = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TASKS);
        return configJson ? JSON.parse(configJson) : { items: [] };
    },

    saveTasksConfig(config) {
        this._tasksConfig = config;
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TASKS, JSON.stringify(config));
    },

    // 取得活躍的 Tasks（排除已刪除）
    getTasks() {
        const config = this.getTasksConfig();
        return config.items.filter(task => !task.isDeleted);
    },

    // 取得所有 Tasks（包含已刪除，用於顯示歷史記錄）
    getAllTasks() {
        const config = this.getTasksConfig();
        return config.items;
    },

    getTask(taskId) {
        const allTasks = this.getAllTasks();
        return allTasks.find(t => t.id === taskId);
    },

    async addTask(name, color) {
        // 先建立本地任務物件
        const config = this.getTasksConfig();
        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name,
            color,
            createdAt: Date.now(),
            isDeleted: false
        };

        // 先儲存到本地
        config.items.push(newTask);
        this.saveTasksConfig(config);
        console.log('✅ 任務已儲存到本地:', newTask.name);

        // 嘗試同步到雲端（非阻塞 Fire-and-forget）
        const isOnline = this.isOnline();
        console.log('🌐 線上狀態:', isOnline, '| 已登入:', FirebaseAuth?.isLoggedIn());

        if (isOnline) {
            console.log('🔄 開始同步任務到雲端...');
            FirestoreDB.saveTasksConfig(config)
                .then(() => console.log('✅ 任務已同步到雲端:', newTask.name))
                .catch(error => {
                    console.error('❌ 雲端同步失敗:', error);
                    console.warn('⚠️ 任務僅儲存在本地');
                });
        } else {
            console.warn('⚠️ 離線模式，任務僅儲存在本地');
        }

        return newTask;
    },

    async updateTask(taskId, updates) {
        const config = this.getTasksConfig();
        const index = config.items.findIndex(t => t.id === taskId);
        if (index === -1) return null;

        config.items[index] = { ...config.items[index], ...updates };
        this.saveTasksConfig(config);

        if (this.isOnline()) {
            FirestoreDB.updateTask(taskId, updates)
                .catch(error => console.warn('⚠️ 雲端更新任務失敗:', error));
        }
        return config.items[index];
    },

    // 軟刪除 Task
    async deleteTask(taskId) {
        // 如果刪除的是當前選中的任務，清除選擇
        const currentTaskId = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.CURRENT_TASK);
        if (currentTaskId === taskId) {
            localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.CURRENT_TASK);
            console.log('🗑️ 已清除當前任務選擇');
        }
        return await this.updateTask(taskId, { isDeleted: true });
    },

    getCurrentTask() {
        const taskId = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.CURRENT_TASK);
        return taskId ? this.getTask(taskId) : null;
    },

    async setCurrentTask(taskId) {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.CURRENT_TASK, taskId);
        if (this.isOnline()) {
            await FirestoreDB.setCurrentTask(taskId);
        }
    },

    // ===== Records 操作（每日一文檔）=====

    // 載入指定日期的記錄
    async loadDailyRecord(dateStr) {
        if (this._dailyRecordsCache[dateStr]) {
            return this._dailyRecordsCache[dateStr];
        }

        if (this.isOnline()) {
            const dailyRecord = await FirestoreDB.getDailyRecord(dateStr);
            if (dailyRecord) {
                this._dailyRecordsCache[dateStr] = dailyRecord;
                return dailyRecord;
            }
        }

        // 返回空記錄
        return { date: dateStr, totalDuration: 0, records: [] };
    },

    // 取得指定日期的記錄（同步版本，從緩存讀取）
    getRecordsByDate(dateStr) {
        const dailyRecord = this._dailyRecordsCache[dateStr];
        return dailyRecord ? dailyRecord.records : [];
    },

    // 非同步取得指定日期的記錄
    async getRecordsByDateAsync(dateStr) {
        const dailyRecord = await this.loadDailyRecord(dateStr);
        return dailyRecord.records;
    },

    // 新增記錄
    async addRecord(taskId, startTime, endTime) {
        const task = this.getTask(taskId);
        if (!task) {
            console.error('找不到任務:', taskId);
            return null;
        }

        const date = new Date(startTime);
        const dateStr = formatDate(date);
        const duration = Math.floor((endTime - startTime) / 1000);

        // 建立記錄（包含任務快照）
        const newRecord = {
            id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            taskId,
            taskName: task.name,
            taskColor: task.color,
            startTime,
            endTime,
            duration
        };

        // 更新緩存
        if (!this._dailyRecordsCache[dateStr]) {
            this._dailyRecordsCache[dateStr] = { date: dateStr, totalDuration: 0, records: [] };
        }
        this._dailyRecordsCache[dateStr].records.push(newRecord);
        this._dailyRecordsCache[dateStr].totalDuration += duration;

        // 同步到雲端（非阻塞）
        if (this.isOnline()) {
            FirestoreDB.addRecord(taskId, task.name, task.color, startTime, endTime)
                .catch(error => console.warn('⚠️ 雲端新增記錄失敗:', error));
        }

        return newRecord;
    },

    // 刪除記錄
    async deleteRecords(dateStr, recordIds) {
        const dailyRecord = this._dailyRecordsCache[dateStr];
        if (!dailyRecord) return false;

        // 更新緩存
        const deletedDuration = dailyRecord.records
            .filter(r => recordIds.includes(r.id))
            .reduce((sum, r) => sum + r.duration, 0);

        dailyRecord.records = dailyRecord.records.filter(r => !recordIds.includes(r.id));
        dailyRecord.totalDuration -= deletedDuration;

        // 同步到雲端（非阻塞）
        if (this.isOnline()) {
            FirestoreDB.deleteRecords(dateStr, recordIds)
                .catch(error => console.warn('⚠️ 雲端刪除記錄失敗:', error));
        }

        return true;
    },

    calculateDailyTotal(dateStr) {
        const dailyRecord = this._dailyRecordsCache[dateStr];
        return dailyRecord ? dailyRecord.totalDuration : 0;
    },

    calculateTaskDailyTotal(taskId, dateStr) {
        const records = this.getRecordsByDate(dateStr);
        return records
            .filter(r => r.taskId === taskId)
            .reduce((sum, r) => sum + r.duration, 0);
    },

    checkTimeOverlap(startMinutes, endMinutes, dateStr, excludeRecordId = null) {
        const records = this.getRecordsByDate(dateStr);
        return records.some(record => {
            if (record.id === excludeRecordId) return false;
            const recordStartDate = new Date(record.startTime);
            const recordEndDate = new Date(record.endTime);
            const recordStartMinutes = recordStartDate.getHours() * 60 + recordStartDate.getMinutes();
            const recordEndMinutes = recordEndDate.getHours() * 60 + recordEndDate.getMinutes();
            return (startMinutes < recordEndMinutes && endMinutes > recordStartMinutes);
        });
    },

    // ===== 計時器狀態 =====
    getTimerState() {
        const stateJson = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TIMER_STATE);
        return stateJson ? JSON.parse(stateJson) : null;
    },

    async saveTimerState(state) {
        if (state) {
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TIMER_STATE, JSON.stringify(state));

            if (this.isOnline()) {
                FirestoreDB.saveTimerState(state)
                    .catch(error => console.warn('⚠️ 雲端儲存計時器狀態失敗:', error));
            }
        } else {
            localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TIMER_STATE);
        }
    },

    async clearTimerState() {
        localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TIMER_STATE);

        if (this.isOnline()) {
            FirestoreDB.clearTimerState()
                .catch(error => console.warn('⚠️ 雲端清除計時器狀態失敗:', error));
        }
    },

    initializeSampleData() {
        // 不再建立預設任務
    }
};

// 初始化 Storage
Storage.init();

// ========== 計時器 ==========
const Timer = {
    startTime: null,
    taskId: null,
    intervalId: null,
    isRunning: false,
    onTick: null,
    onStop: null,

    restoreState() {
        const state = Storage.getTimerState();
        if (state) {
            this.startTime = state.startTime;
            this.taskId = state.taskId;
            this.start();
        }
    },

    start(taskId = null) {
        if (this.isRunning) return;

        if (taskId) {
            this.startTime = Date.now();
            this.taskId = taskId;
            Storage.saveTimerState({
                startTime: this.startTime,
                taskId: this.taskId
            });
        }

        this.isRunning = true;

        this.intervalId = setInterval(() => {
            if (this.onTick) {
                const elapsed = this.getElapsedSeconds();
                this.onTick(elapsed);
            }
        }, 1000);

        if (this.onTick) {
            this.onTick(this.getElapsedSeconds());
        }
    },

    stop(shouldSave = true) {
        if (!this.isRunning) return null;

        clearInterval(this.intervalId);
        this.isRunning = false;

        const endTime = Date.now();
        const duration = Math.floor((endTime - this.startTime) / 1000);

        let record = null;

        if (shouldSave && duration >= APP_CONFIG.MIN_RECORD_DURATION) {
            record = Storage.addRecord(this.taskId, this.startTime, endTime);
        }

        this.reset();

        if (this.onStop) {
            this.onStop(record, duration);
        }

        return { record, duration };
    },

    reset() {
        this.startTime = null;
        this.taskId = null;
        this.intervalId = null;
        this.isRunning = false;
        Storage.clearTimerState();
    },

    getElapsedSeconds() {
        if (!this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }
};

// ========== UI 控制 ==========
const UI = {
    currentPage: 'home',
    currentDate: new Date(),
    selectedRecordIds: [],
    currentMonth: new Date(),

    init() {
        console.log('🚀 Timer App 正在啟動...');

        // 設定登入頁面事件
        this.setupLoginPageEvents();

        // 監聽認證狀態變化
        if (typeof FirebaseAuth !== 'undefined') {
            FirebaseAuth.onAuthStateChanged((user) => {
                this.handleAuthStateChange(user);
            });
        } else {
            // Firebase 未載入，顯示錯誤
            console.error('Firebase 未正確載入');
        }

        console.log('✅ Timer App 啟動完成！');
    },

    setupLoginPageEvents() {
        const loginBtn = document.getElementById('login-google-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                try {
                    loginBtn.disabled = true;
                    loginBtn.textContent = '登入中...';
                    await FirebaseAuth.signInWithGoogle();
                } catch (error) {
                    alert('登入失敗: ' + error.message);
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        使用 Google 登入
                    `;
                }
            });
        }
    },

    handleAuthStateChange(user) {
        const loginPage = document.getElementById('login-page');
        const appContainer = document.getElementById('app');

        if (user) {
            // 已登入 - 隱藏登入頁面，顯示主介面
            console.log('👤 用戶已登入:', user.displayName);

            if (loginPage) loginPage.classList.add('hidden');
            if (appContainer) appContainer.style.display = 'block';

            // 初始化主介面
            this.initMainApp();
        } else {
            // 未登入 - 顯示登入頁面，隱藏主介面
            console.log('🔒 用戶未登入');

            if (loginPage) loginPage.classList.remove('hidden');
            if (appContainer) appContainer.style.display = 'none';

            // 重置登入按鈕狀態
            this.resetLoginButton();
        }
    },

    resetLoginButton() {
        const loginBtn = document.getElementById('login-google-btn');
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                使用 Google 登入
            `;
        }
    },

    _initialized: false,

    initMainApp() {
        // 只在第一次初始化時綁定事件
        if (!this._initialized) {
            Storage.initializeSampleData();
            this.setupEventListeners();
            this.renderGlowRays();
            this._initialized = true;
        }

        // 每次登入都更新這些
        this.updateHomePage();
        this.updateNavUserAvatar();
        this.showPage('home');

        if (Timer.isRunning) {
            this.showTimerRunningPage();
        }
    },

    updateNavUserAvatar() {
        const user = FirebaseAuth.currentUser;
        if (!user) return;

        const navAvatar = document.getElementById('nav-user-avatar');
        const dropdownName = document.getElementById('dropdown-user-name');
        const dropdownEmail = document.getElementById('dropdown-user-email');

        if (navAvatar) navAvatar.src = user.photoURL || '';
        if (dropdownName) dropdownName.textContent = user.displayName || '用戶';
        if (dropdownEmail) dropdownEmail.textContent = user.email || '';
    },

    toggleUserDropdown() {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    },

    closeUserDropdown() {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    },

    setupEventListeners() {
        // 用戶頭像（導航欄）
        const navAvatar = document.getElementById('nav-user-avatar');
        if (navAvatar) {
            navAvatar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleUserDropdown();
            });
        }

        // 導航欄登出按鈕
        const navLogoutBtn = document.getElementById('nav-logout-btn');
        if (navLogoutBtn) {
            navLogoutBtn.addEventListener('click', async () => {
                this.closeUserDropdown();
                if (confirm('確定要登出嗎？')) {
                    await FirebaseAuth.signOut();
                }
            });
        }

        // 點擊其他地方關閉下拉選單
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('user-avatar-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                this.closeUserDropdown();
            }
        });

        // 底部導航
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                this.showPage(page);
            });
        });

        // Task 選擇區域
        const taskInfo = document.getElementById('task-info');
        if (taskInfo) {
            taskInfo.addEventListener('click', () => {
                this.showTaskSelectorModal();
            });
        }

        // START 按鈕
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startTimer();
            });
        }

        // 頂部按鈕
        const listBtn = document.getElementById('list-btn');
        if (listBtn) {
            listBtn.addEventListener('click', () => {
                this.showTaskSelectorModal();
            });
        }

        const addBtn = document.getElementById('add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showPage('add-task');
            });
        }

        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSettingsAdaptive();
            });
        }

        // 計時頁面
        const stopTimerBtn = document.getElementById('stop-timer-btn');
        if (stopTimerBtn) {
            stopTimerBtn.addEventListener('click', () => {
                this.stopTimer();
            });
        }

        // 記錄頁面導航
        const prevDate = document.getElementById('prev-date');
        if (prevDate) {
            prevDate.addEventListener('click', () => {
                this.changeDate(-1);
            });
        }

        const nextDate = document.getElementById('next-date');
        if (nextDate) {
            nextDate.addEventListener('click', () => {
                this.changeDate(1);
            });
        }



        // 新增 Task 頁面
        const backFromAddTask = document.getElementById('back-from-add-task');
        if (backFromAddTask) {
            backFromAddTask.addEventListener('click', () => {
                this.showPage('home');
            });
        }

        const cancelAddTask = document.getElementById('cancel-add-task');
        if (cancelAddTask) {
            cancelAddTask.addEventListener('click', () => {
                this.showPage('home');
            });
        }

        const saveTask = document.getElementById('save-task');
        if (saveTask) {
            saveTask.addEventListener('click', () => {
                this.saveNewTask();
            });
        }

        // 設定頁面
        const backFromSettings = document.getElementById('back-from-settings');
        if (backFromSettings) {
            backFromSettings.addEventListener('click', () => {
                this.showPage('home');
            });
        }

        const addTaskFromSettings = document.getElementById('add-task-from-settings');
        if (addTaskFromSettings) {
            addTaskFromSettings.addEventListener('click', () => {
                this.showPage('add-task');
            });
        }

        // 帳戶認證
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', async () => {
                try {
                    await FirebaseAuth.signInWithGoogle();
                    this.updateAccountUI();
                } catch (error) {
                    alert('登入失敗: ' + error.message);
                }
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (confirm('確定要登出嗎？\n登出後將切換到離線模式。')) {
                    await FirebaseAuth.signOut();
                    this.updateAccountUI();
                }
            });
        }

        // 監聽認證狀態變化
        if (typeof FirebaseAuth !== 'undefined') {
            FirebaseAuth.onAuthStateChanged((user) => {
                this.updateAccountUI();
            });
        }

        // 全部記錄頁面
        const backFromAllRecords = document.getElementById('back-from-all-records');
        if (backFromAllRecords) {
            backFromAllRecords.addEventListener('click', () => {
                this.showPage('records');
            });
        }

        // Task 選擇對話框
        const closeTaskSelector = document.getElementById('close-task-selector');
        if (closeTaskSelector) {
            closeTaskSelector.addEventListener('click', () => {
                this.closeModal('task-selector-modal');
            });
        }

        const modalAddTask = document.getElementById('modal-add-task');
        if (modalAddTask) {
            modalAddTask.addEventListener('click', () => {
                this.closeModal('task-selector-modal');
                this.showPage('add-task');
            });
        }

        // 記錄編輯對話框
        const cancelRecordEdit = document.getElementById('cancel-record-edit');
        if (cancelRecordEdit) {
            cancelRecordEdit.addEventListener('click', () => {
                this.closeModal('record-edit-modal');
            });
        }

        const saveRecordEdit = document.getElementById('save-record-edit');
        if (saveRecordEdit) {
            saveRecordEdit.addEventListener('click', () => {
                this.saveRecord();
            });
        }

        const changeTaskBtn = document.getElementById('change-task-btn');
        if (changeTaskBtn) {
            changeTaskBtn.addEventListener('click', () => {
                document.getElementById('record-task-selector').style.display = 'block';
                document.getElementById('record-task-display').style.display = 'none';
                this.renderRecordTasksList();
            });
        }

        // 記錄操作按鈕
        const addRecordBtn = document.getElementById('add-record-btn');
        if (addRecordBtn) {
            addRecordBtn.addEventListener('click', () => {
                this.showRecordModal('add');
            });
        }

        const editRecordBtn = document.getElementById('edit-record-btn');
        if (editRecordBtn) {
            editRecordBtn.addEventListener('click', () => {
                alert('請直接點擊時間軸上的記錄條來編輯');
            });
        }

        const deleteRecordBtn = document.getElementById('delete-record-btn');
        if (deleteRecordBtn) {
            deleteRecordBtn.addEventListener('click', () => {
                this.enableDeleteMode();
            });
        }

        // 對話框背景點擊關閉
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    },

    showPage(pageName) {
        if (Timer.isRunning && pageName !== 'timer-running') {
            return;
        }

        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageName;

            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.page === pageName);
            });

            if (pageName === 'home') {
                this.updateHomePage();
            } else if (pageName === 'records') {
                this.updateRecordsPage();
            } else if (pageName === 'add-task') {
                this.renderColorGrid();
            } else if (pageName === 'settings') {
                this.updateSettingsPage();
            } else if (pageName === 'all-records') {
                this.updateAllRecordsPage();
            }
        }
    },

    updateHomePage() {
        const homeDateEl = document.getElementById('home-date');
        if (homeDateEl) {
            homeDateEl.textContent = formatDisplayDate(new Date());
        }

        const today = getTodayDate();
        const totalSeconds = Storage.calculateDailyTotal(today);

        const totalTimeEl = document.getElementById('total-time');
        if (totalTimeEl) {
            totalTimeEl.textContent = formatTime(totalSeconds);
        }

        const currentTask = Storage.getCurrentTask();
        const taskColorEl = document.getElementById('task-color');
        const taskNameEl = document.getElementById('task-name');
        const taskTimeEl = document.getElementById('task-time');
        const startBtn = document.getElementById('start-btn');

        if (currentTask) {
            if (taskColorEl) taskColorEl.style.backgroundColor = currentTask.color;
            if (taskNameEl) taskNameEl.textContent = currentTask.name;

            const taskSeconds = Storage.calculateTaskDailyTotal(currentTask.id, today);
            if (taskTimeEl) taskTimeEl.textContent = formatTime(taskSeconds);

            this.updateGlowColor(currentTask.color);

            if (startBtn) startBtn.disabled = false;
        } else {
            if (taskNameEl) taskNameEl.textContent = '請選擇任務';
            if (taskTimeEl) taskTimeEl.textContent = '';
            if (taskColorEl) taskColorEl.style.backgroundColor = 'transparent';
            if (startBtn) startBtn.disabled = true;

            // 預設使用綠色光暈
            this.updateGlowColor('#22C55E');
        }
    },

    renderGlowRays() {
        const raysContainer = document.getElementById('glow-rays');
        if (!raysContainer) return;

        raysContainer.innerHTML = '';
        const count = APP_CONFIG.GLOW_RAYS_COUNT;

        for (let i = 0; i < count; i++) {
            const ray = document.createElement('div');
            ray.className = 'glow-ray';

            const angle = (360 / count) * i;
            const length = 25 + Math.random() * 25; // 芒刺長度
            const delay = (i / count) * 4; // 均勻分佈延遲

            ray.style.height = `${length}px`;
            ray.style.width = '3px';
            ray.style.transformOrigin = 'center bottom';
            ray.style.transform = `rotate(${angle}deg) translateY(-130px)`;
            ray.style.animationDelay = `${delay}s`;

            raysContainer.appendChild(ray);
        }
    },

    updateGlowColor(color) {
        // 更新光暈芒刺顏色
        const rays = document.querySelectorAll('.glow-ray');
        rays.forEach(ray => {
            ray.style.background = `linear-gradient(to top, ${color}, transparent)`;
        });

        // 更新圓圈的光暈效果
        const glowCircle = document.querySelector('.glow-circle');
        if (glowCircle) {
            glowCircle.style.boxShadow = `
                0 0 30px ${color}4D,
                0 0 60px ${color}33,
                0 0 100px ${color}1A,
                inset 0 0 30px ${color}0D
            `;
        }
    },

    showTaskSelectorModal() {
        const modal = document.getElementById('task-selector-modal');
        const listContainer = document.getElementById('modal-tasks-list');

        if (!modal || !listContainer) return;

        listContainer.innerHTML = '';
        const tasks = Storage.getTasks();
        const today = getTodayDate();

        // 沒有任務時顯示提示訊息
        if (tasks.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--text-tertiary);';
            emptyMessage.innerHTML = `
                <p style="font-size: 16px; margin-bottom: 16px;">尚未新增任務</p>
                <button class="action-btn primary" id="modal-create-task-btn" style="margin: 0 auto;">+ 新增任務</button>
            `;
            listContainer.appendChild(emptyMessage);

            // 綁定新增任務按鈕事件
            const createBtn = document.getElementById('modal-create-task-btn');
            if (createBtn) {
                createBtn.addEventListener('click', () => {
                    this.closeModal('task-selector-modal');
                    this.showPage('add-task');
                });
            }

            modal.classList.add('active');
            return;
        }

        tasks.forEach(task => {
            const taskSeconds = Storage.calculateTaskDailyTotal(task.id, today);
            const item = document.createElement('div');
            item.className = 'modal-task-item';
            item.innerHTML = `
                <span class="task-color-bar" style="background-color: ${task.color}"></span>
                <div class="modal-task-info">
                    <div class="modal-task-name">${task.name}</div>
                    <div class="modal-task-time">${formatDuration(taskSeconds)}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                Storage.setCurrentTask(task.id);
                this.closeModal('task-selector-modal');
                this.updateHomePage();
            });

            listContainer.appendChild(item);
        });

        modal.classList.add('active');
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('closing');
            setTimeout(() => {
                modal.classList.remove('active', 'closing');
            }, 300);
        }
    },

    startTimer() {
        const currentTask = Storage.getCurrentTask();
        if (!currentTask) return;

        Timer.start(currentTask.id);
        this.showTimerRunningPage();
    },

    showTimerRunningPage() {
        const currentTask = Storage.getCurrentTask();
        if (!currentTask) return;

        const runningTaskColor = document.getElementById('running-task-color');
        const runningTaskName = document.getElementById('running-task-name');

        if (runningTaskColor) runningTaskColor.style.backgroundColor = currentTask.color;
        if (runningTaskName) runningTaskName.textContent = currentTask.name;

        Timer.onTick = (seconds) => {
            const runningTimer = document.getElementById('running-timer');
            if (runningTimer) runningTimer.textContent = formatTime(seconds);
        };

        Timer.onStop = () => {
            this.showPage('home');
            this.updateHomePage();
        };

        this.showPage('timer-running');
    },

    stopTimer() {
        Timer.stop();
    },

    async updateRecordsPage() {
        const recordsDate = document.getElementById('records-date');
        if (recordsDate) {
            recordsDate.textContent = formatDisplayDate(this.currentDate);
        }

        const dateStr = formatDate(this.currentDate);

        // 先載入當天記錄
        await Storage.loadDailyRecord(dateStr);

        const totalSeconds = Storage.calculateDailyTotal(dateStr);
        const dailyTotal = document.getElementById('daily-total');
        const recordTotal = document.getElementById('record-total');

        if (dailyTotal) dailyTotal.textContent = formatDuration(totalSeconds);
        if (recordTotal) recordTotal.textContent = formatDuration(totalSeconds);

        await this.updateTasksList(dateStr);
        await this.updateTimeline(dateStr);
    },

    async updateTasksList(date) {
        const listContainer = document.getElementById('tasks-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        // 從當天記錄中彙總各任務的時間（使用快照資訊）
        const records = await Storage.getRecordsByDateAsync(date);

        // 按 taskId 分組統計，並保留快照資訊
        const taskStats = {};
        records.forEach(record => {
            const key = record.taskId;
            if (!taskStats[key]) {
                taskStats[key] = {
                    name: record.taskName || '未知任務',
                    color: record.taskColor || '#888',
                    totalSeconds: 0
                };
            }
            taskStats[key].totalSeconds += record.duration;
        });

        // 渲染任務列表
        Object.values(taskStats).forEach(stat => {
            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <span class="task-color-bar" style="background-color: ${stat.color}"></span>
                <span class="task-item-name">${stat.name}</span>
                <span class="task-item-time">${formatDuration(stat.totalSeconds)}</span>
            `;
            listContainer.appendChild(item);
        });
    },

    async updateTimeline(date) {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        container.innerHTML = '';

        const hoursDiv = document.createElement('div');
        hoursDiv.className = 'timeline-hours';
        for (let h = 0; h < 24; h++) {
            const hourDiv = document.createElement('div');
            hourDiv.className = 'timeline-hour';
            hourDiv.textContent = String(h).padStart(2, '0');
            hoursDiv.appendChild(hourDiv);
        }
        container.appendChild(hoursDiv);

        const barsDiv = document.createElement('div');
        barsDiv.className = 'timeline-bars';
        barsDiv.style.height = `${24 * 40}px`;

        // 使用非同步方式載入記錄
        const records = await Storage.getRecordsByDateAsync(date);

        records.forEach(record => {
            // 優先使用記錄中的快照資訊，保證歷史記錄正確顯示
            const taskColor = record.taskColor || '#888';
            const taskName = record.taskName || '未知任務';

            const startDate = new Date(record.startTime);
            const endDate = new Date(record.endTime);

            const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
            const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

            const top = (startMinutes / (24 * 60)) * 100;
            const height = ((endMinutes - startMinutes) / (24 * 60)) * 100;

            const bar = document.createElement('div');
            bar.className = 'timeline-bar';
            bar.style.backgroundColor = taskColor;
            bar.style.top = `${top}%`;
            bar.style.height = `${height}%`;
            bar.style.left = '0';
            bar.style.right = '0';
            bar.style.cursor = 'pointer';
            bar.title = `${taskName} - ${formatDurationShort(record.duration)}\n點擊編輯`;
            bar.dataset.recordId = record.id;

            // 點擊事件
            bar.addEventListener('click', () => {
                if (this._deleteMode) {
                    // 刪除模式：切換選擇
                    this.toggleRecordSelection(record.id, bar);
                } else {
                    // 編輯模式
                    this.showRecordModal('edit', record);
                }
            });

            barsDiv.appendChild(bar);
        });

        container.appendChild(barsDiv);
    },

    async changeDate(direction) {
        this.currentDate.setDate(this.currentDate.getDate() + direction);
        await this.updateRecordsPage();
    },

    renderColorGrid() {
        const grid = document.getElementById('color-grid');
        if (!grid) return;

        grid.innerHTML = '';
        const nameInput = document.getElementById('task-name-input');
        if (nameInput) nameInput.value = '';

        DEFAULT_COLORS.forEach((color, index) => {
            const option = document.createElement('div');
            option.className = 'color-option';
            option.style.backgroundColor = color;
            option.dataset.color = color;

            option.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                option.classList.add('selected');
            });

            grid.appendChild(option);
        });

        if (grid.firstChild) {
            grid.firstChild.classList.add('selected');
        }
    },

    async saveNewTask() {
        const nameInput = document.getElementById('task-name-input');
        const name = nameInput ? nameInput.value.trim() : '';

        if (!name) {
            alert('請輸入 Task 名稱');
            return;
        }

        const selectedColor = document.querySelector('.color-option.selected');
        if (!selectedColor) {
            alert('請選擇顏色');
            return;
        }

        const color = selectedColor.dataset.color;

        // 使用 await 等待非同步操作完成
        const newTask = await Storage.addTask(name, color);

        if (newTask) {
            console.log('✅ 新增任務成功:', newTask.name);
        }

        if (nameInput) nameInput.value = '';

        this.showPage('home');
        this.updateHomePage();
    },

    updateSettingsPage() {
        const listContainer = document.getElementById('settings-tasks-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const tasks = Storage.getTasks();

        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'settings-task-item';
            item.innerHTML = `
                <span class="task-color-bar" style="background-color: ${task.color}"></span>
                <div class="settings-task-info">
                    <div class="settings-task-name">${task.name}</div>
                </div>
                <div class="settings-task-actions">
                    <button class="icon-btn delete-task-btn" data-task-id="${task.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;

            item.querySelector('.delete-task-btn').addEventListener('click', () => {
                if (confirm(`確定要刪除「${task.name}」嗎？\n這將同時刪除所有相關記錄。`)) {
                    Storage.deleteTask(task.id);
                    this.updateSettingsPage();
                }
            });

            listContainer.appendChild(item);
        });

        // 更新帳戶 UI
        this.updateAccountUI();
    },

    updateAccountUI() {
        const loggedOutDiv = document.getElementById('account-logged-out');
        const loggedInDiv = document.getElementById('account-logged-in');
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');

        if (!loggedOutDiv || !loggedInDiv) return;

        if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.isLoggedIn()) {
            const user = FirebaseAuth.currentUser;

            loggedOutDiv.style.display = 'none';
            loggedInDiv.style.display = 'block';

            if (userAvatar) userAvatar.src = user.photoURL || '';
            if (userName) userName.textContent = user.displayName || '用戶';
            if (userEmail) userEmail.textContent = user.email || '';
        } else {
            loggedOutDiv.style.display = 'block';
            loggedInDiv.style.display = 'none';
        }
    },

    updateAllRecordsPage() {
        const monthDisplay = document.getElementById('current-month');
        if (monthDisplay) {
            monthDisplay.textContent = `${this.currentMonth.getFullYear()}年${this.currentMonth.getMonth() + 1}月`;
        }
    },

    // ========== 側邊面板功能（桌面版） ==========

    isDesktop() {
        return window.innerWidth >= 768;
    },

    openSidePanel(type) {
        const overlay = document.getElementById('side-panel-overlay');
        const panel = document.getElementById('side-panel');
        const title = document.getElementById('side-panel-title');
        const content = document.getElementById('side-panel-content');

        if (!overlay || !panel || !content) return;

        // 設定標題和內容
        if (type === 'settings') {
            title.textContent = '設定';
            content.innerHTML = this.renderSettingsPanelContent();
            this.bindSettingsPanelEvents(content);
        } else if (type === 'add-task') {
            title.textContent = '新增任務';
            content.innerHTML = this.renderAddTaskPanelContent();
            this.bindAddTaskPanelEvents(content);
        }

        // 顯示面板
        overlay.classList.add('active');
        panel.classList.add('active');

        // 綁定關閉事件
        overlay.onclick = () => this.closeSidePanel();
        document.getElementById('close-side-panel').onclick = () => this.closeSidePanel();
    },

    closeSidePanel() {
        const overlay = document.getElementById('side-panel-overlay');
        const panel = document.getElementById('side-panel');

        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');

        // 更新首頁
        this.updateHomePage();
    },

    renderSettingsPanelContent() {
        const tasks = Storage.getTasks();
        let tasksHtml = '';

        tasks.forEach(task => {
            tasksHtml += `
                <div class="side-panel-task-item" data-task-id="${task.id}">
                    <span class="task-color-bar" style="background-color: ${task.color}"></span>
                    <div class="side-panel-task-info">
                        <div class="side-panel-task-name">${task.name}</div>
                    </div>
                    <div class="side-panel-task-actions">
                        <button class="icon-btn delete-task-btn" data-task-id="${task.id}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });

        return `
            <div class="side-panel-section">
                <h3>任務管理</h3>
                <div class="side-panel-tasks-list">
                    ${tasksHtml || '<p style="color: var(--text-tertiary); text-align: center;">尚無任務</p>'}
                </div>
                <button class="action-btn primary full-width" id="panel-add-task">+ 新增任務</button>
            </div>
        `;
    },

    bindSettingsPanelEvents(container) {
        // 刪除按鈕
        container.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const taskId = btn.dataset.taskId;
                const task = Storage.getTask(taskId);
                if (task && confirm(`確定要刪除「${task.name}」嗎？\n這將同時刪除所有相關記錄。`)) {
                    Storage.deleteTask(taskId);
                    this.openSidePanel('settings'); // 重新渲染
                }
            });
        });

        // 新增任務按鈕
        const addBtn = container.querySelector('#panel-add-task');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.openSidePanel('add-task');
            });
        }
    },

    renderAddTaskPanelContent() {
        let colorsHtml = '';
        DEFAULT_COLORS.forEach((color, index) => {
            colorsHtml += `
                <div class="color-option ${index === 0 ? 'selected' : ''}" 
                     style="background-color: ${color}" 
                     data-color="${color}"></div>
            `;
        });

        return `
            <div class="side-panel-form">
                <div>
                    <input type="text" class="task-input" id="panel-task-name" placeholder="請輸入任務名稱">
                </div>
                <div>
                    <h3 style="font-size: var(--font-md); margin-bottom: var(--spacing-md);">選擇顏色</h3>
                    <div class="color-grid">${colorsHtml}</div>
                </div>
                <div class="form-actions">
                    <button class="action-btn secondary" id="panel-cancel-task">取消</button>
                    <button class="action-btn primary" id="panel-save-task">儲存</button>
                </div>
            </div>
        `;
    },

    bindAddTaskPanelEvents(container) {
        // 顏色選擇
        container.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                container.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });

        // 取消按鈕
        const cancelBtn = container.querySelector('#panel-cancel-task');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.openSidePanel('settings');
            });
        }

        // 儲存按鈕
        const saveBtn = container.querySelector('#panel-save-task');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const nameInput = container.querySelector('#panel-task-name');
                const name = nameInput ? nameInput.value.trim() : '';

                if (!name) {
                    alert('請輸入任務名稱');
                    return;
                }

                const selectedColor = container.querySelector('.color-option.selected');
                if (!selectedColor) {
                    alert('請選擇顏色');
                    return;
                }

                const color = selectedColor.dataset.color;
                const newTask = await Storage.addTask(name, color);

                if (newTask) {
                    console.log('✅ 新增任務成功:', newTask.name);
                }

                // 更新首頁並回到設定面板
                this.updateHomePage();
                this.closeSidePanel();
            });
        }
    },

    // 根據螢幕尺寸決定顯示方式
    showSettingsAdaptive() {
        if (this.isDesktop()) {
            this.openSidePanel('settings');
        } else {
            this.showPage('settings');
        }
    },

    showAddTaskAdaptive() {
        if (this.isDesktop()) {
            this.openSidePanel('add-task');
        } else {
            this.showPage('add-task');
        }
    },

    // ========== 記錄管理功能 ==========
    _editingRecordId: null,
    _selectedTaskId: null,
    _deleteMode: false,
    _selectedRecordIds: [],

    // 顯示記錄 Modal（添加或編輯模式）
    showRecordModal(mode = 'add', record = null) {
        const modal = document.getElementById('record-edit-modal');
        const title = document.getElementById('record-modal-title');
        const taskSelector = document.getElementById('record-task-selector');
        const taskDisplay = document.getElementById('record-task-display');
        const saveBtn = document.getElementById('save-record-edit');
        const errorDiv = document.getElementById('record-error');

        // 重置狀態
        this._editingRecordId = record?.id || null;
        this._selectedTaskId = record?.taskId || null;
        if (errorDiv) errorDiv.style.display = 'none';

        if (mode === 'add') {
            title.textContent = '添加紀錄';
            saveBtn.textContent = '添加';
            taskSelector.style.display = 'block';
            taskDisplay.style.display = 'none';
            this.renderRecordTasksList();
            // 清空時間輸入
            document.getElementById('start-hour').value = '';
            document.getElementById('start-minute').value = '';
            document.getElementById('end-hour').value = '';
            document.getElementById('end-minute').value = '';
        } else {
            title.textContent = '編輯紀錄';
            saveBtn.textContent = '儲存';
            taskSelector.style.display = 'none';
            taskDisplay.style.display = 'flex';

            // 填入現有記錄資訊
            document.getElementById('record-task-color').style.backgroundColor = record.taskColor;
            document.getElementById('record-task-name').textContent = record.taskName;

            const startDate = new Date(record.startTime);
            const endDate = new Date(record.endTime);
            document.getElementById('start-hour').value = startDate.getHours();
            document.getElementById('start-minute').value = startDate.getMinutes();
            document.getElementById('end-hour').value = endDate.getHours();
            document.getElementById('end-minute').value = endDate.getMinutes();
        }

        modal.classList.add('active');
    },

    // 渲染記錄 Modal 中的任務列表
    renderRecordTasksList() {
        const list = document.getElementById('record-tasks-list');
        if (!list) return;

        list.innerHTML = '';
        const tasks = Storage.getTasks();

        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'record-task-item';
            item.dataset.taskId = task.id;
            item.innerHTML = `
                <span class="task-color-dot" style="background-color: ${task.color}"></span>
                <span>${task.name}</span>
            `;

            item.addEventListener('click', () => {
                // 移除其他選中狀態
                list.querySelectorAll('.record-task-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this._selectedTaskId = task.id;
            });

            list.appendChild(item);
        });
    },

    // 驗證並保存記錄
    async saveRecord() {
        const startHour = parseInt(document.getElementById('start-hour').value);
        const startMinute = parseInt(document.getElementById('start-minute').value);
        const endHour = parseInt(document.getElementById('end-hour').value);
        const endMinute = parseInt(document.getElementById('end-minute').value);

        // 驗證格式
        if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
            this.showRecordError('請填寫完整的時間');
            return;
        }

        if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
            this.showRecordError('小時必須在 0-23 之間');
            return;
        }

        if (startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59) {
            this.showRecordError('分鐘必須在 0-59 之間');
            return;
        }

        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        if (endMinutes <= startMinutes) {
            this.showRecordError('結束時間必須晚於開始時間');
            return;
        }

        const dateStr = formatDate(this.currentDate);

        // 檢查時間重疊
        if (Storage.checkTimeOverlap(startMinutes, endMinutes, dateStr, this._editingRecordId)) {
            this.showRecordError('此時間段與現有記錄重疊');
            return;
        }

        // 建立時間戳
        const baseDate = new Date(this.currentDate);
        const startTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), startHour, startMinute).getTime();
        const endTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), endHour, endMinute).getTime();

        if (this._editingRecordId) {
            // 編輯模式
            await Storage.updateRecord(dateStr, this._editingRecordId, { startTime, endTime });
            console.log('✅ 記錄已更新');
        } else {
            // 添加模式
            if (!this._selectedTaskId) {
                this.showRecordError('請選擇任務');
                return;
            }
            await Storage.addRecord(this._selectedTaskId, startTime, endTime);
            console.log('✅ 記錄已添加');
        }

        this.closeModal('record-edit-modal');
        await this.updateRecordsPage();
    },

    // 顯示記錄錯誤訊息
    showRecordError(message) {
        const errorDiv = document.getElementById('record-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    },

    // 進入刪除模式
    enableDeleteMode() {
        this._deleteMode = true;
        this._selectedRecordIds = [];

        // 添加刪除模式 Banner
        const recordSection = document.querySelector('.record-section');
        if (recordSection && !document.getElementById('delete-mode-banner')) {
            const banner = document.createElement('div');
            banner.id = 'delete-mode-banner';
            banner.className = 'delete-mode-banner';
            banner.innerHTML = `
                <span>選擇要刪除的記錄</span>
                <div>
                    <button class="cancel-delete-btn" id="cancel-delete-mode">取消</button>
                    <button class="confirm-delete-btn" id="confirm-delete-records">刪除 (0)</button>
                </div>
            `;
            recordSection.insertBefore(banner, recordSection.firstChild.nextSibling);

            document.getElementById('cancel-delete-mode').addEventListener('click', () => this.exitDeleteMode());
            document.getElementById('confirm-delete-records').addEventListener('click', () => this.confirmDeleteRecords());
        }

        // 使時間軸記錄可選擇
        document.querySelectorAll('.timeline-bar').forEach(bar => {
            bar.classList.add('deletable');
        });
    },

    // 退出刪除模式
    exitDeleteMode() {
        this._deleteMode = false;
        this._selectedRecordIds = [];

        const banner = document.getElementById('delete-mode-banner');
        if (banner) banner.remove();

        document.querySelectorAll('.timeline-bar').forEach(bar => {
            bar.classList.remove('deletable', 'selected-for-delete');
        });
    },

    // 切換記錄選擇狀態
    toggleRecordSelection(recordId, barElement) {
        const index = this._selectedRecordIds.indexOf(recordId);
        if (index > -1) {
            this._selectedRecordIds.splice(index, 1);
            barElement.classList.remove('selected-for-delete');
        } else {
            this._selectedRecordIds.push(recordId);
            barElement.classList.add('selected-for-delete');
        }

        // 更新按鈕文字
        const confirmBtn = document.getElementById('confirm-delete-records');
        if (confirmBtn) {
            confirmBtn.textContent = `刪除 (${this._selectedRecordIds.length})`;
        }
    },

    // 確認刪除記錄
    async confirmDeleteRecords() {
        if (this._selectedRecordIds.length === 0) {
            alert('請選擇要刪除的記錄');
            return;
        }

        if (confirm(`確定要刪除這 ${this._selectedRecordIds.length} 條記錄嗎？`)) {
            const dateStr = formatDate(this.currentDate);
            await Storage.deleteRecords(dateStr, this._selectedRecordIds);
            console.log('✅ 記錄已刪除');
            this.exitDeleteMode();
            await this.updateRecordsPage();
        }
    }
};

// ========== Storage 補充方法 ==========
Storage.updateRecord = async function (dateStr, recordId, updates) {
    const dailyRecord = this._dailyRecordsCache[dateStr];
    if (!dailyRecord) return null;

    const index = dailyRecord.records.findIndex(r => r.id === recordId);
    if (index === -1) return null;

    // 更新本地緩存
    const oldDuration = dailyRecord.records[index].duration;
    dailyRecord.records[index] = { ...dailyRecord.records[index], ...updates };

    // 重新計算 duration
    if (updates.startTime && updates.endTime) {
        dailyRecord.records[index].duration = Math.floor((updates.endTime - updates.startTime) / 1000);
        dailyRecord.totalDuration = dailyRecord.totalDuration - oldDuration + dailyRecord.records[index].duration;
    }

    // 同步到雲端
    if (App.isOnline()) {
        try {
            await FirestoreDB.updateRecord(dateStr, recordId, updates);
        } catch (error) {
            console.warn('⚠️ 雲端更新記錄失敗:', error);
        }
    }

    return dailyRecord.records[index];
};

// ========== 啟動應用程式 ==========
document.addEventListener('DOMContentLoaded', function () {
    UI.init();
    Timer.restoreState();
});
