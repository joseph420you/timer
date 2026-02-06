// 資料儲存管理模組
import { APP_CONFIG } from './config.js';

const KEYS = APP_CONFIG.STORAGE_KEYS;

// ========== 工具函數 ==========

// 生成 UUID
export function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 取得今日日期字串 (YYYY-MM-DD)
export function getTodayDate() {
    const now = new Date();
    return formatDate(now);
}

// 格式化日期
export function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 格式化時間 (HH:MM:SS)
export function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 格式化時間 (Xh XXm)
export function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
}

// 格式化秒數 (XXm XXs)
export function formatDurationShort(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
}

// 格式化顯示日期 (YYYY. MM. DD. Day)
export function formatDisplayDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[date.getDay()];
    return `${year}. ${month}. ${day}. ${dayName}`;
}

// ========== Tasks 管理 ==========

// 取得所有 Tasks
export function getTasks() {
    const tasksJson = localStorage.getItem(KEYS.TASKS);
    return tasksJson ? JSON.parse(tasksJson) : [];
}

// 儲存 Tasks
export function saveTasks(tasks) {
    localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
}

// 取得單一 Task
export function getTask(taskId) {
    const tasks = getTasks();
    return tasks.find(t => t.id === taskId);
}

// 新增 Task
export function addTask(name, color) {
    const tasks = getTasks();
    const newTask = {
        id: generateId(),
        name,
        color,
        createdAt: Date.now()
    };
    tasks.push(newTask);
    saveTasks(tasks);
    return newTask;
}

// 更新 Task
export function updateTask(taskId, updates) {
    const tasks = getTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
        tasks[index] = { ...tasks[index], ...updates };
        saveTasks(tasks);
        return tasks[index];
    }
    return null;
}

// 刪除 Task
export function deleteTask(taskId) {
    const tasks = getTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    saveTasks(filtered);

    // 同時刪除該 Task 的所有記錄
    const records = getRecords();
    const filteredRecords = records.filter(r => r.taskId !== taskId);
    saveRecords(filteredRecords);
}

// 取得當前選中的 Task
export function getCurrentTask() {
    const taskId = localStorage.getItem(KEYS.CURRENT_TASK);
    return taskId ? getTask(taskId) : null;
}

// 設定當前選中的 Task
export function setCurrentTask(taskId) {
    localStorage.setItem(KEYS.CURRENT_TASK, taskId);
}

// ========== Records 管理 ==========

// 取得所有記錄
export function getRecords() {
    const recordsJson = localStorage.getItem(KEYS.RECORDS);
    return recordsJson ? JSON.parse(recordsJson) : [];
}

// 儲存記錄
export function saveRecords(records) {
    localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
}

// 新增記錄
export function addRecord(taskId, startTime, endTime) {
    const records = getRecords();
    const duration = Math.floor((endTime - startTime) / 1000); // 秒
    const date = formatDate(new Date(startTime));

    const newRecord = {
        id: generateId(),
        taskId,
        startTime,
        endTime,
        duration,
        date
    };

    records.push(newRecord);
    saveRecords(records);
    return newRecord;
}

// 更新記錄
export function updateRecord(recordId, updates) {
    const records = getRecords();
    const index = records.findIndex(r => r.id === recordId);
    if (index !== -1) {
        records[index] = { ...records[index], ...updates };
        // 重新計算時長
        if (records[index].startTime && records[index].endTime) {
            records[index].duration = Math.floor((records[index].endTime - records[index].startTime) / 1000);
        }
        saveRecords(records);
        return records[index];
    }
    return null;
}

// 刪除記錄
export function deleteRecord(recordId) {
    const records = getRecords();
    const filtered = records.filter(r => r.id !== recordId);
    saveRecords(filtered);
}

// 批次刪除記錄
export function deleteRecords(recordIds) {
    const records = getRecords();
    const filtered = records.filter(r => !recordIds.includes(r.id));
    saveRecords(filtered);
}

// 取得指定日期的記錄
export function getRecordsByDate(date) {
    const records = getRecords();
    return records.filter(r => r.date === date);
}

// 取得指定 Task 和日期的記錄
export function getRecordsByTaskAndDate(taskId, date) {
    const records = getRecords();
    return records.filter(r => r.taskId === taskId && r.date === date);
}

// 計算指定日期的總時長
export function calculateDailyTotal(date) {
    const records = getRecordsByDate(date);
    return records.reduce((total, record) => total + record.duration, 0);
}

// 計算指定 Task 和日期的總時長
export function calculateTaskDailyTotal(taskId, date) {
    const records = getRecordsByTaskAndDate(taskId, date);
    return records.reduce((total, record) => total + record.duration, 0);
}

// 檢查時間重疊
export function checkTimeOverlap(startMinutes, endMinutes, date, excludeRecordId = null) {
    const records = getRecordsByDate(date);

    return records.some(record => {
        if (record.id === excludeRecordId) return false;

        const recordStartDate = new Date(record.startTime);
        const recordEndDate = new Date(record.endTime);
        const recordStartMinutes = recordStartDate.getHours() * 60 + recordStartDate.getMinutes();
        const recordEndMinutes = recordEndDate.getHours() * 60 + recordEndDate.getMinutes();

        // 檢查是否重疊
        return (startMinutes < recordEndMinutes && endMinutes > recordStartMinutes);
    });
}

// ========== 計時器狀態管理 ==========

// 取得計時器狀態
export function getTimerState() {
    const stateJson = localStorage.getItem(KEYS.TIMER_STATE);
    return stateJson ? JSON.parse(stateJson) : null;
}

// 儲存計時器狀態
export function saveTimerState(state) {
    if (state) {
        localStorage.setItem(KEYS.TIMER_STATE, JSON.stringify(state));
    } else {
        localStorage.removeItem(KEYS.TIMER_STATE);
    }
}

// 清除計時器狀態
export function clearTimerState() {
    localStorage.removeItem(KEYS.TIMER_STATE);
}

// ========== 每日重置 ==========

// 檢查是否需要重置
export function checkDailyReset() {
    const lastDate = localStorage.getItem(KEYS.LAST_ACTIVE_DATE);
    const today = getTodayDate();

    if (lastDate !== today) {
        localStorage.setItem(KEYS.LAST_ACTIVE_DATE, today);
        return true; // 新的一天
    }
    return false;
}

// ========== 初始化範例資料 ==========

export function initializeSampleData() {
    const tasks = getTasks();

    if (tasks.length === 0) {
        // 建立範例 Tasks
        const sampleTasks = [
            { name: 'Studying', color: '#3B82F6' },
            { name: 'Podcast', color: '#F59E0B' },
            { name: 'Meditation', color: '#FACC15' },
            { name: 'Learning on YouTube', color: '#EF4444' },
            { name: 'Reading', color: '#22C55E' }
        ];

        sampleTasks.forEach(task => {
            addTask(task.name, task.color);
        });
    }
}
