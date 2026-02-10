// ========== Firebase 配置 ==========
const firebaseConfig = window.firebaseConfig;

// 檢查配置是否有效
if (!firebaseConfig || firebaseConfig.apiKey === 'PLACEHOLDER') {

    alert('請先在 js/config.js 中設定您的 Firebase Config！');
} else {
    // 初始化 Firebase
    firebase.initializeApp(firebaseConfig);
}

// 取得服務實例
const auth = firebase.auth();
const db = firebase.firestore();



// ========== Firebase 認證模組 ==========
const FirebaseAuth = {
    currentUser: null,
    onAuthStateChangedCallbacks: [],

    // 初始化認證狀態監聽
    init() {
        // 處理 Redirect 登入結果
        auth.getRedirectResult().then((result) => {
            if (result.user) {

            }
        }).catch((error) => {

        });

        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.onAuthStateChangedCallbacks.forEach(callback => callback(user));

            if (user) {

            }
        });
    },

    // 註冊認證狀態變化回調
    onAuthStateChanged(callback) {
        this.onAuthStateChangedCallbacks.push(callback);
        // 如果已經有用戶狀態，立即調用
        if (this.currentUser !== null) {
            callback(this.currentUser);
        }
    },

    // Google 登入
    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            // 使用 Popup 方式登入（對本地開發更友善）
            const result = await auth.signInWithPopup(provider);

            return result.user;
        } catch (error) {

            // 處理常見錯誤
            if (error.code === 'auth/popup-closed-by-user') {

            } else if (error.code === 'auth/popup-blocked') {
                alert('彈出視窗被瀏覽器阻擋，請允許彈出視窗後重試');
            }
            throw error;
        }
    },

    // 登出
    async signOut() {
        try {
            await auth.signOut();
        } catch (error) {

            throw error;
        }
    },

    // 取得當前用戶 ID
    getUserId() {
        return this.currentUser ? this.currentUser.uid : null;
    },

    // 檢查是否已登入
    isLoggedIn() {
        return this.currentUser !== null;
    }
};

// ========== Firestore 資料模組（新結構）==========
const FirestoreDB = {
    // 取得用戶資料路徑
    getUserPath() {
        const userId = FirebaseAuth.getUserId();
        if (!userId) return null;
        return `users/${userId}`;
    },

    // ===== Tasks 配置（單一文檔）=====

    // 取得所有 Tasks（包含已刪除的）
    async getTasksConfig() {
        const userPath = this.getUserPath();
        if (!userPath) return { items: [] };

        try {
            const doc = await db.doc(`${userPath}/config/tasks`).get();
            if (doc.exists) {
                return doc.data();
            }
            return { items: [] };
        } catch (error) {

            return { items: [] };
        }
    },

    // 取得活躍的 Tasks（排除已刪除的）
    async getActiveTasks() {
        const config = await this.getTasksConfig();
        return config.items.filter(task => !task.isDeleted);
    },

    // 取得單一 Task（包含已刪除的，用於顯示歷史記錄）
    async getTaskById(taskId) {
        const config = await this.getTasksConfig();
        return config.items.find(task => task.id === taskId) || null;
    },

    // 儲存整個 Tasks 配置
    async saveTasksConfig(config) {
        const userPath = this.getUserPath();
        if (!userPath) return false;

        try {
            await db.doc(`${userPath}/config/tasks`).set(config);
            return true;
        } catch (error) {

            return false;
        }
    },

    // 新增 Task
    async addTask(name, color) {
        const config = await this.getTasksConfig();
        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name,
            color,
            createdAt: Date.now(),
            isDeleted: false
        };
        config.items.push(newTask);

        const success = await this.saveTasksConfig(config);
        return success ? newTask : null;
    },

    // 更新 Task
    async updateTask(taskId, updates) {
        const config = await this.getTasksConfig();
        const index = config.items.findIndex(t => t.id === taskId);
        if (index === -1) return null;

        config.items[index] = { ...config.items[index], ...updates };
        const success = await this.saveTasksConfig(config);
        return success ? config.items[index] : null;
    },

    // 軟刪除 Task（標記為已刪除，不真的刪除）
    async deleteTask(taskId) {
        return await this.updateTask(taskId, { isDeleted: true });
    },

    // ===== 每日記錄（每天一筆文檔）=====

    // 取得指定日期的記錄
    async getDailyRecord(dateStr) {
        const userPath = this.getUserPath();
        if (!userPath) return null;

        try {
            const doc = await db.doc(`${userPath}/dailyRecords/${dateStr}`).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {

            return null;
        }
    },

    // 儲存每日記錄
    async saveDailyRecord(dateStr, dailyRecord) {
        const userPath = this.getUserPath();
        if (!userPath) return false;

        try {
            // 計算總時長
            dailyRecord.totalDuration = dailyRecord.records.reduce((sum, r) => sum + r.duration, 0);
            dailyRecord.date = dateStr;
            dailyRecord.updatedAt = Date.now();

            await db.doc(`${userPath}/dailyRecords/${dateStr}`).set(dailyRecord);
            return true;
        } catch (error) {

            return false;
        }
    },

    // 新增記錄到指定日期
    async addRecord(taskId, taskName, taskColor, startTime, endTime) {
        const duration = Math.floor((endTime - startTime) / 1000);
        const date = new Date(startTime);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        // 取得當日記錄（如果不存在則建立）
        let dailyRecord = await this.getDailyRecord(dateStr);
        if (!dailyRecord) {
            dailyRecord = {
                date: dateStr,
                totalDuration: 0,
                records: []
            };
        }

        // 新增記錄（包含任務快照）
        const newRecord = {
            id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            taskId,
            taskName,    // 快照：記錄時的任務名稱
            taskColor,   // 快照：記錄時的顏色
            startTime,
            endTime,
            duration
        };

        dailyRecord.records.push(newRecord);

        const success = await this.saveDailyRecord(dateStr, dailyRecord);
        return success ? newRecord : null;
    },

    // 刪除指定日期的指定記錄
    async deleteRecords(dateStr, recordIds) {
        let dailyRecord = await this.getDailyRecord(dateStr);
        if (!dailyRecord) return false;

        dailyRecord.records = dailyRecord.records.filter(r => !recordIds.includes(r.id));
        return await this.saveDailyRecord(dateStr, dailyRecord);
    },

    // 取得日期範圍內有記錄的日期列表（用於日曆顯示）
    async getRecordedDates(startDate, endDate) {
        const userPath = this.getUserPath();
        if (!userPath) return [];

        try {
            const snapshot = await db.collection(`${userPath}/dailyRecords`)
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .get();

            return snapshot.docs.map(doc => doc.id);
        } catch (error) {

            return [];
        }
    },

    // ===== 計時器狀態 =====
    async saveTimerState(state) {
        const userPath = this.getUserPath();
        if (!userPath) return false;

        try {
            await db.doc(`${userPath}/config/timerState`).set(state);
            return true;
        } catch (error) {

            return false;
        }
    },

    async getTimerState() {
        const userPath = this.getUserPath();
        if (!userPath) return null;

        try {
            const doc = await db.doc(`${userPath}/config/timerState`).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {

            return null;
        }
    },

    async clearTimerState() {
        const userPath = this.getUserPath();
        if (!userPath) return false;

        try {
            await db.doc(`${userPath}/config/timerState`).delete();
            return true;
        } catch (error) {

            return false;
        }
    },

    // ===== 當前任務 =====
    async setCurrentTask(taskId) {
        const userPath = this.getUserPath();
        if (!userPath) return false;

        try {
            await db.doc(`${userPath}/config/currentTask`).set({ taskId });
            return true;
        } catch (error) {

            return false;
        }
    },

    async getCurrentTaskId() {
        const userPath = this.getUserPath();
        if (!userPath) return null;

        try {
            const doc = await db.doc(`${userPath}/config/currentTask`).get();
            return doc.exists ? doc.data().taskId : null;
        } catch (error) {

            return null;
        }
    }
};

// 初始化 Firebase 認證
FirebaseAuth.init();


