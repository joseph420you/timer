// UI 控制與頁面管理
import { APP_CONFIG, DEFAULT_COLORS } from './config.js';
import {
    getTasks,
    getCurrentTask,
    setCurrentTask,
    addTask,
    updateTask,
    deleteTask,
    getRecords,
    getRecordsByDate,
    getTodayDate,
    formatDisplayDate,
    formatTime,
    formatDuration,
    formatDurationShort,
    calculateDailyTotal,
    calculateTaskDailyTotal,
    deleteRecords,
    checkTimeOverlap,
    formatDate,
    getTask
} from './storage.js';
import { timer } from './timer.js';

class UI {
    constructor() {
        this.currentPage = 'home';
        this.currentDate = new Date();
        this.selectedRecordIds = [];
        this.editingRecordId = null;
        this.currentMonth = new Date();
    }

    // 初始化
    init() {
        this.setupEventListeners();
        this.renderGlowRays();
        this.updateHomePage();
        this.showPage('home');

        // 如果計時器正在運行，自動切換到計時頁面
        if (timer.isRunning) {
            this.showTimerRunningPage();
        }
    }

    // 設置事件監聽器
    setupEventListeners() {
        // 底部導航
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = btn.dataset.page;
                this.showPage(page);
            });
        });

        // 首頁
        document.getElementById('task-info')?.addEventListener('click', () => {
            this.showTaskSelectorModal();
        });

        document.getElementById('start-btn')?.addEventListener('click', () => {
            this.startTimer();
        });

        document.getElementById('list-btn')?.addEventListener('click', () => {
            this.showTaskSelectorModal();
        });

        document.getElementById('add-btn')?.addEventListener('click', () => {
            this.showPage('add-task');
        });

        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.showPage('settings');
        });

        // 計時進行中頁面
        document.getElementById('stop-timer-btn')?.addEventListener('click', () => {
            this.stopTimer();
        });

        // 記錄頁面
        document.getElementById('prev-date')?.addEventListener('click', () => {
            this.changeDate(-1);
        });

        document.getElementById('next-date')?.addEventListener('click', () => {
            this.changeDate(1);
        });

        document.getElementById('add-record-btn')?.addEventListener('click', () => {
            this.showAddRecordModal();
        });

        document.getElementById('edit-record-btn')?.addEventListener('click', () => {
            // TODO: 實作編輯模式
        });

        document.getElementById('delete-record-btn')?.addEventListener('click', () => {
            this.showPage('all-records');
        });

        // 新增 Task 頁面
        document.getElementById('back-from-add-task')?.addEventListener('click', () => {
            this.showPage('home');
        });

        document.getElementById('cancel-add-task')?.addEventListener('click', () => {
            this.showPage('home');
        });

        document.getElementById('save-task')?.addEventListener('click', () => {
            this.saveNewTask();
        });

        // 設定頁面
        document.getElementById('back-from-settings')?.addEventListener('click', () => {
            this.showPage('home');
        });

        document.getElementById('add-task-from-settings')?.addEventListener('click', () => {
            this.showPage('add-task');
        });

        // 全部記錄頁面
        document.getElementById('back-from-all-records')?.addEventListener('click', () => {
            this.showPage('records');
        });

        document.getElementById('prev-month')?.addEventListener('click', () => {
            this.changeMonth(-1);
        });

        document.getElementById('next-month')?.addEventListener('click', () => {
            this.changeMonth(1);
        });

        document.getElementById('delete-selected-records')?.addEventListener('click', () => {
            this.deleteSelectedRecords();
        });

        // Task 選擇對話框
        document.getElementById('close-task-selector')?.addEventListener('click', () => {
            this.closeModal('task-selector-modal');
        });

        document.getElementById('modal-add-task')?.addEventListener('click', () => {
            this.closeModal('task-selector-modal');
            this.showPage('add-task');
        });

        // 記錄編輯對話框
        document.getElementById('cancel-record-edit')?.addEventListener('click', () => {
            this.closeModal('record-edit-modal');
        });

        document.getElementById('save-record-edit')?.addEventListener('click', () => {
            this.saveRecordEdit();
        });

        // 點擊對話框外部關閉
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    // 顯示頁面
    showPage(pageName) {
        // 計時中無法切換頁面
        if (timer.isRunning && pageName !== 'timer-running') {
            return;
        }

        // 隱藏所有頁面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 顯示目標頁面
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageName;

            // 更新底部導航
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.page === pageName);
            });

            // 更新頁面內容
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
    }

    // 更新首頁
    updateHomePage() {
        // 更新日期
        document.getElementById('home-date').textContent = formatDisplayDate(new Date());

        // 更新今日總累計時間
        const today = getTodayDate();
        const totalSeconds = calculateDailyTotal(today);
        document.getElementById('total-time').textContent = formatTime(totalSeconds);

        // 更新當前 Task 資訊
        const currentTask = getCurrentTask();
        if (currentTask) {
            document.getElementById('task-color').style.backgroundColor = currentTask.color;
            document.getElementById('task-name').textContent = currentTask.name;

            const taskSeconds = calculateTaskDailyTotal(currentTask.id, today);
            document.getElementById('task-time').textContent = formatTime(taskSeconds);

            // 更新光暈顏色
            this.updateGlowColor(currentTask.color);

            // 啟用 START 按鈕
            document.getElementById('start-btn').disabled = false;
        } else {
            document.getElementById('task-name').textContent = '請選擇任務';
            document.getElementById('task-time').textContent = '';
            document.getElementById('task-color').style.backgroundColor = 'transparent';
            document.getElementById('start-btn').disabled = true;
        }
    }

    // 渲染光暈芒刺
    renderGlowRays() {
        const raysContainer = document.getElementById('glow-rays');
        if (!raysContainer) return;

        raysContainer.innerHTML = '';
        const count = APP_CONFIG.GLOW_RAYS_COUNT;

        for (let i = 0; i < count; i++) {
            const ray = document.createElement('div');
            ray.className = 'glow-ray';

            const angle = (360 / count) * i;
            const length = 20 + Math.random() * 30; // 20-50px
            const delay = Math.random() * 3; // 0-3s

            ray.style.height = `${length}px`;
            ray.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-150px)`;
            ray.style.animationDelay = `${delay}s`;

            raysContainer.appendChild(ray);
        }
    }

    // 更新光暈顏色
    updateGlowColor(color) {
        const rays = document.querySelectorAll('.glow-ray');
        rays.forEach(ray => {
            ray.style.background = `linear-gradient(to top, ${color}, transparent)`;
        });
    }

    // 顯示 Task 選擇對話框
    showTaskSelectorModal() {
        const modal = document.getElementById('task-selector-modal');
        const listContainer = document.getElementById('modal-tasks-list');

        listContainer.innerHTML = '';
        const tasks = getTasks();
        const today = getTodayDate();

        tasks.forEach(task => {
            const taskSeconds = calculateTaskDailyTotal(task.id, today);
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
                setCurrentTask(task.id);
                this.closeModal('task-selector-modal');
                this.updateHomePage();
            });

            listContainer.appendChild(item);
        });

        modal.classList.add('active');
    }

    // 關閉對話框
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('closing');
            setTimeout(() => {
                modal.classList.remove('active', 'closing');
            }, 300);
        }
    }

    // 開始計時
    startTimer() {
        const currentTask = getCurrentTask();
        if (!currentTask) return;

        timer.start(currentTask.id);
        this.showTimerRunningPage();
    }

    // 顯示計時進行中頁面
    showTimerRunningPage() {
        const currentTask = getCurrentTask();
        if (!currentTask) return;

        // 更新 Task 資訊
        document.getElementById('running-task-color').style.backgroundColor = currentTask.color;
        document.getElementById('running-task-name').textContent = currentTask.name;

        // 設定計時器回調
        timer.onTick = (seconds) => {
            document.getElementById('running-timer').textContent = formatTime(seconds);
        };

        timer.onStop = () => {
            this.showPage('home');
            this.updateHomePage();
        };

        this.showPage('timer-running');
    }

    // 停止計時
    stopTimer() {
        timer.stop();
        // onStop callback 會處理頁面切換
    }

    // 更新記錄頁面
    updateRecordsPage() {
        // 更新日期
        document.getElementById('records-date').textContent = formatDisplayDate(this.currentDate);

        const dateStr = formatDate(this.currentDate);

        // 更新今日總累計
        const totalSeconds = calculateDailyTotal(dateStr);
        document.getElementById('daily-total').textContent = formatDuration(totalSeconds);
        document.getElementById('record-total').textContent = formatDuration(totalSeconds);

        // 更新 Tasks 列表
        this.updateTasksList(dateStr);

        // 更新時間軸
        this.updateTimeline(dateStr);
    }

    // 更新 Tasks 列表
    updateTasksList(date) {
        const listContainer = document.getElementById('tasks-list');
        listContainer.innerHTML = '';

        const tasks = getTasks();

        tasks.forEach(task => {
            const taskSeconds = calculateTaskDailyTotal(task.id, date);
            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <span class="task-color-bar" style="background-color: ${task.color}"></span>
                <span class="task-item-name">${task.name}</span>
                <span class="task-item-time">${formatDuration(taskSeconds)}</span>
            `;
            listContainer.appendChild(item);
        });
    }

    // 更新時間軸
    updateTimeline(date) {
        const container = document.getElementById('timeline-container');
        container.innerHTML = '';

        // 創建小時刻度
        const hoursDiv = document.createElement('div');
        hoursDiv.className = 'timeline-hours';
        for (let h = 0; h < 24; h++) {
            const hourDiv = document.createElement('div');
            hourDiv.className = 'timeline-hour';
            hourDiv.textContent = String(h).padStart(2, '0');
            hoursDiv.appendChild(hourDiv);
        }
        container.appendChild(hoursDiv);

        // 創建記錄條
        const barsDiv = document.createElement('div');
        barsDiv.className = 'timeline-bars';
        barsDiv.style.height = `${24 * 40}px`; // 每小時40px

        const records = getRecordsByDate(date);

        records.forEach(record => {
            const task = getTask(record.taskId);
            if (!task) return;

            const startDate = new Date(record.startTime);
            const endDate = new Date(record.endTime);

            const startHour = startDate.getHours();
            const startMinute = startDate.getMinutes();
            const endHour = endDate.getHours();
            const endMinute = endDate.getMinutes();

            const startMinutes = startHour * 60 + startMinute;
            const endMinutes = endHour * 60 + endMinute;

            const top = (startMinutes / (24 * 60)) * 100;
            const height = ((endMinutes - startMinutes) / (24 * 60)) * 100;

            const bar = document.createElement('div');
            bar.className = 'timeline-bar';
            bar.style.backgroundColor = task.color;
            bar.style.top = `${top}%`;
            bar.style.height = `${height}%`;
            bar.style.left = '0';
            bar.style.right = '0';
            bar.dataset.taskName = task.name;
            bar.dataset.duration = formatDurationShort(record.duration);

            // Tooltip
            bar.title = `${task.name} - ${formatDurationShort(record.duration)}`;

            barsDiv.appendChild(bar);
        });

        container.appendChild(barsDiv);
    }

    // 切換日期
    changeDate(direction) {
        this.currentDate.setDate(this.currentDate.getDate() + direction);
        this.updateRecordsPage();
    }

    // 渲染顏色選擇器
    renderColorGrid() {
        const grid = document.getElementById('color-grid');
        if (!grid) return;

        grid.innerHTML = '';

        DEFAULT_COLORS.forEach(color => {
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

        // 預設選中第一個
        grid.firstChild?.classList.add('selected');
    }

    // 儲存新 Task
    saveNewTask() {
        const nameInput = document.getElementById('task-name-input');
        const name = nameInput.value.trim();

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
        addTask(name, color);

        // 清空輸入
        nameInput.value = '';

        // 回到首頁
        this.showPage('home');
    }

    // 更新設定頁面
    updateSettingsPage() {
        const listContainer = document.getElementById('settings-tasks-list');
        listContainer.innerHTML = '';

        const tasks = getTasks();

        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'settings-task-item';
            item.innerHTML = `
                <span class="task-color-bar" style="background-color: ${task.color}"></span>
                <div class="settings-task-info">
                    <div class="settings-task-name">${task.name}</div>
                </div>
                <div class="settings-task-actions">
                    <button class="icon-btn edit-task-btn" data-task-id="${task.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="icon-btn delete-task-btn" data-task-id="${task.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;

            // 刪除按鈕
            item.querySelector('.delete-task-btn').addEventListener('click', () => {
                if (confirm(`確定要刪除「${task.name}」嗎？\n這將同時刪除所有相關記錄。`)) {
                    deleteTask(task.id);
                    this.updateSettingsPage();
                }
            });

            listContainer.appendChild(item);
        });
    }

    // 顯示添加記錄對話框
    showAddRecordModal() {
        const modal = document.getElementById('record-edit-modal');
        const title = document.getElementById('record-modal-title');
        const saveBtn = document.getElementById('save-record-edit');

        title.textContent = '選擇待辦事項';
        saveBtn.textContent = '添加記錄';

        // 清空輸入
        document.getElementById('start-hour').value = '';
        document.getElementById('start-minute').value = '';
        document.getElementById('end-hour').value = '';
        document.getElementById('end-minute').value = '';

        // 隱藏錯誤訊息
        document.getElementById('record-error').style.display = 'none';

        this.editingRecordId = null;

        modal.classList.add('active');
    }

    // 儲存記錄編輯
    saveRecordEdit() {
        const startHour = parseInt(document.getElementById('start-hour').value);
        const startMinute = parseInt(document.getElementById('start-minute').value);
        const endHour = parseInt(document.getElementById('end-hour').value);
        const endMinute = parseInt(document.getElementById('end-minute').value);

        const errorDiv = document.getElementById('record-error');

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

        // 驗證結束時間晚於開始時間
        if (endMinutes <= startMinutes) {
            this.showRecordError('結束時間必須晚於開始時間');
            return;
        }

        // 檢查時間重疊
        const dateStr = formatDate(this.currentDate);
        if (checkTimeOverlap(startMinutes, endMinutes, dateStr, this.editingRecordId)) {
            this.showRecordError('此時間段與現有記錄重疊，請調整時間');
            return;
        }

        // TODO: 實際儲存記錄
        // 這裡需要實作新增/編輯記錄的邏輯

        this.closeModal('record-edit-modal');
        this.updateRecordsPage();
    }

    // 顯示記錄錯誤
    showRecordError(message) {
        const errorDiv = document.getElementById('record-error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.classList.add('shake');
        setTimeout(() => errorDiv.classList.remove('shake'), 500);
    }

    // 更新全部記錄頁面
    updateAllRecordsPage() {
        const monthDisplay = document.getElementById('current-month');
        monthDisplay.textContent = `${this.currentMonth.getFullYear()}年${this.currentMonth.getMonth() + 1}月`;

        // TODO: 渲染按月份分組的記錄列表
    }

    // 切換月份
    changeMonth(direction) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
        this.updateAllRecordsPage();
    }

    // 刪除選中的記錄
    deleteSelectedRecords() {
        if (this.selectedRecordIds.length === 0) {
            alert('請選擇要刪除的記錄');
            return;
        }

        if (confirm(`確定要刪除這 ${this.selectedRecordIds.length} 條記錄嗎？`)) {
            deleteRecords(this.selectedRecordIds);
            this.selectedRecordIds = [];
            this.updateAllRecordsPage();
        }
    }
}

// 導出單例
export const ui = new UI();
