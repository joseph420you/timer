// 計時器核心邏輯
import { APP_CONFIG } from './config.js';
import {
    addRecord,
    getTimerState,
    saveTimerState,
    clearTimerState,
    getCurrentTask
} from './storage.js';

class Timer {
    constructor() {
        this.startTime = null;
        this.taskId = null;
        this.intervalId = null;
        this.isRunning = false;
        this.onTick = null; // 每秒回調
        this.onStop = null; // 停止回調

        // 檢查是否有未完成的計時
        this.restoreState();
    }

    // 恢復計時器狀態
    restoreState() {
        const state = getTimerState();
        if (state) {
            this.startTime = state.startTime;
            this.taskId = state.taskId;
            this.start();
        }
    }

    // 開始計時
    start(taskId = null) {
        if (this.isRunning) return;

        if (taskId) {
            // 新的計時
            this.startTime = Date.now();
            this.taskId = taskId;

            // 儲存狀態以支援背景計時
            saveTimerState({
                startTime: this.startTime,
                taskId: this.taskId
            });
        }

        this.isRunning = true;

        // 每秒更新
        this.intervalId = setInterval(() => {
            if (this.onTick) {
                const elapsed = this.getElapsedSeconds();
                this.onTick(elapsed);
            }
        }, 1000);

        // 立即觸發一次
        if (this.onTick) {
            this.onTick(this.getElapsedSeconds());
        }
    }

    // 停止計時
    stop(shouldSave = true) {
        if (!this.isRunning) return null;

        clearInterval(this.intervalId);
        this.isRunning = false;

        const endTime = Date.now();
        const duration = Math.floor((endTime - this.startTime) / 1000);

        let record = null;

        // 只有超過最小記錄時間才儲存
        if (shouldSave && duration >= APP_CONFIG.MIN_RECORD_DURATION) {
            record = addRecord(this.taskId, this.startTime, endTime);
        }

        // 清除狀態
        this.reset();

        if (this.onStop) {
            this.onStop(record, duration);
        }

        return { record, duration };
    }

    // 重置計時器
    reset() {
        this.startTime = null;
        this.taskId = null;
        this.intervalId = null;
        this.isRunning = false;
        clearTimerState();
    }

    // 取得已經過的秒數
    getElapsedSeconds() {
        if (!this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    // 取得計時器狀態
    getState() {
        return {
            isRunning: this.isRunning,
            taskId: this.taskId,
            startTime: this.startTime,
            elapsedSeconds: this.getElapsedSeconds()
        };
    }
}

// 導出單例
export const timer = new Timer();
