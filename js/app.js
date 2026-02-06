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

// ========== 資料儲存 ==========
const Storage = {
    getTasks() {
        const tasksJson = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TASKS);
        return tasksJson ? JSON.parse(tasksJson) : [];
    },

    saveTasks(tasks) {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    },

    getTask(taskId) {
        const tasks = this.getTasks();
        return tasks.find(t => t.id === taskId);
    },

    addTask(name, color) {
        const tasks = this.getTasks();
        const newTask = {
            id: generateId(),
            name,
            color,
            createdAt: Date.now()
        };
        tasks.push(newTask);
        this.saveTasks(tasks);
        return newTask;
    },

    updateTask(taskId, updates) {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            this.saveTasks(tasks);
            return tasks[index];
        }
        return null;
    },

    deleteTask(taskId) {
        const tasks = this.getTasks();
        const filtered = tasks.filter(t => t.id !== taskId);
        this.saveTasks(filtered);

        const records = this.getRecords();
        const filteredRecords = records.filter(r => r.taskId !== taskId);
        this.saveRecords(filteredRecords);
    },

    getCurrentTask() {
        const taskId = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.CURRENT_TASK);
        return taskId ? this.getTask(taskId) : null;
    },

    setCurrentTask(taskId) {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.CURRENT_TASK, taskId);
    },

    getRecords() {
        const recordsJson = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.RECORDS);
        return recordsJson ? JSON.parse(recordsJson) : [];
    },

    saveRecords(records) {
        localStorage.setItem(APP_CONFIG.STORAGE_KEYS.RECORDS, JSON.stringify(records));
    },

    addRecord(taskId, startTime, endTime) {
        const records = this.getRecords();
        const duration = Math.floor((endTime - startTime) / 1000);
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
        this.saveRecords(records);
        return newRecord;
    },

    deleteRecords(recordIds) {
        const records = this.getRecords();
        const filtered = records.filter(r => !recordIds.includes(r.id));
        this.saveRecords(filtered);
    },

    getRecordsByDate(date) {
        const records = this.getRecords();
        return records.filter(r => r.date === date);
    },

    calculateDailyTotal(date) {
        const records = this.getRecordsByDate(date);
        return records.reduce((total, record) => total + record.duration, 0);
    },

    calculateTaskDailyTotal(taskId, date) {
        const records = this.getRecordsByDate(date).filter(r => r.taskId === taskId);
        return records.reduce((total, record) => total + record.duration, 0);
    },

    checkTimeOverlap(startMinutes, endMinutes, date, excludeRecordId = null) {
        const records = this.getRecordsByDate(date);

        return records.some(record => {
            if (record.id === excludeRecordId) return false;

            const recordStartDate = new Date(record.startTime);
            const recordEndDate = new Date(record.endTime);
            const recordStartMinutes = recordStartDate.getHours() * 60 + recordStartDate.getMinutes();
            const recordEndMinutes = recordEndDate.getHours() * 60 + recordEndDate.getMinutes();

            return (startMinutes < recordEndMinutes && endMinutes > recordStartMinutes);
        });
    },

    getTimerState() {
        const stateJson = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TIMER_STATE);
        return stateJson ? JSON.parse(stateJson) : null;
    },

    saveTimerState(state) {
        if (state) {
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TIMER_STATE, JSON.stringify(state));
        } else {
            localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TIMER_STATE);
        }
    },

    clearTimerState() {
        localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TIMER_STATE);
    },

    initializeSampleData() {
        // 不再建立預設任務，讓用戶自行新增
    }
};

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

        Storage.initializeSampleData();
        this.setupEventListeners();
        this.renderGlowRays();
        this.updateHomePage();
        this.showPage('home');

        if (Timer.isRunning) {
            this.showTimerRunningPage();
        }

        console.log('✅ Timer App 啟動完成！');
    },

    setupEventListeners() {
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
                this.showPage('settings');
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

        const deleteRecordBtn = document.getElementById('delete-record-btn');
        if (deleteRecordBtn) {
            deleteRecordBtn.addEventListener('click', () => {
                this.showPage('all-records');
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
            const length = 20 + Math.random() * 30;
            const delay = Math.random() * 3;

            ray.style.height = `${length}px`;
            ray.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-150px)`;
            ray.style.animationDelay = `${delay}s`;

            raysContainer.appendChild(ray);
        }
    },

    updateGlowColor(color) {
        const rays = document.querySelectorAll('.glow-ray');
        rays.forEach(ray => {
            ray.style.background = `linear-gradient(to top, ${color}, transparent)`;
        });
    },

    showTaskSelectorModal() {
        const modal = document.getElementById('task-selector-modal');
        const listContainer = document.getElementById('modal-tasks-list');

        if (!modal || !listContainer) return;

        listContainer.innerHTML = '';
        const tasks = Storage.getTasks();
        const today = getTodayDate();

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

    updateRecordsPage() {
        const recordsDate = document.getElementById('records-date');
        if (recordsDate) {
            recordsDate.textContent = formatDisplayDate(this.currentDate);
        }

        const dateStr = formatDate(this.currentDate);

        const totalSeconds = Storage.calculateDailyTotal(dateStr);
        const dailyTotal = document.getElementById('daily-total');
        const recordTotal = document.getElementById('record-total');

        if (dailyTotal) dailyTotal.textContent = formatDuration(totalSeconds);
        if (recordTotal) recordTotal.textContent = formatDuration(totalSeconds);

        this.updateTasksList(dateStr);
        this.updateTimeline(dateStr);
    },

    updateTasksList(date) {
        const listContainer = document.getElementById('tasks-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const tasks = Storage.getTasks();

        tasks.forEach(task => {
            const taskSeconds = Storage.calculateTaskDailyTotal(task.id, date);
            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <span class="task-color-bar" style="background-color: ${task.color}"></span>
                <span class="task-item-name">${task.name}</span>
                <span class="task-item-time">${formatDuration(taskSeconds)}</span>
            `;
            listContainer.appendChild(item);
        });
    },

    updateTimeline(date) {
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

        const records = Storage.getRecordsByDate(date);

        records.forEach(record => {
            const task = Storage.getTask(record.taskId);
            if (!task) return;

            const startDate = new Date(record.startTime);
            const endDate = new Date(record.endTime);

            const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
            const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

            const top = (startMinutes / (24 * 60)) * 100;
            const height = ((endMinutes - startMinutes) / (24 * 60)) * 100;

            const bar = document.createElement('div');
            bar.className = 'timeline-bar';
            bar.style.backgroundColor = task.color;
            bar.style.top = `${top}%`;
            bar.style.height = `${height}%`;
            bar.style.left = '0';
            bar.style.right = '0';
            bar.title = `${task.name} - ${formatDurationShort(record.duration)}`;

            barsDiv.appendChild(bar);
        });

        container.appendChild(barsDiv);
    },

    changeDate(direction) {
        this.currentDate.setDate(this.currentDate.getDate() + direction);
        this.updateRecordsPage();
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

    saveNewTask() {
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
        Storage.addTask(name, color);

        if (nameInput) nameInput.value = '';

        this.showPage('home');
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
    },

    updateAllRecordsPage() {
        const monthDisplay = document.getElementById('current-month');
        if (monthDisplay) {
            monthDisplay.textContent = `${this.currentMonth.getFullYear()}年${this.currentMonth.getMonth() + 1}月`;
        }
    }
};

// ========== 啟動應用程式 ==========
document.addEventListener('DOMContentLoaded', function () {
    UI.init();
    Timer.restoreState();
});
