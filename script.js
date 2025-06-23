// =============================================================================
// TIMESHEET APPLICATION - COMPLETE FIXED VERSION
// =============================================================================

// =============================================================================
// CONFIGURATION & INITIALIZATION
// =============================================================================

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, push, remove, update } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7wq0ripHZjjq3UGmEyXDcqchOne80zbQ",
  authDomain: "employee-tracking-46e85.firebaseapp.com",
  databaseURL: "https://employee-tracking-46e85-default-rtdb.firebaseio.com",
  projectId: "employee-tracking-46e85",
  storageBucket: "employee-tracking-46e85.appspot.com",
  messagingSenderId: "122564068962",
  appId: "1:122564068962:web:20806ae0c9e16b533db33b",
  measurementId: "G-W26SV1SZEJ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// =============================================================================
// GLOBAL STATE MANAGEMENT
// =============================================================================

class AppState {
  constructor() {
    this.activeEmployeeId = null;
    this.currentInterval = null;
    this.performanceChart = null;
    this.currentWeekStart = null;
    this.employees = {};
    this.settings = {};
  }

  setCurrentWeekStart(date) {
    this.currentWeekStart = this.getWeekStart(date);
  }

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.getFullYear(), d.getMonth(), diff);
  }

  getCurrentWeekEnd() {
    if (!this.currentWeekStart) return null;
    const end = new Date(this.currentWeekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }
}

const appState = new AppState();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const Utils = {
  debug(message) {
    console.log(`[DEBUG] ${message}`);
  },

  formatTime(timestamp) {
    return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  },

  formatTotalTime(totalTime) {
    const hours = String(Math.floor(totalTime / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalTime % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalTime % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  },

  convertTo24HourFormat(timeString) {
    if (!timeString) return '';
    const date = new Date(`1970-01-01T${timeString}`);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  convertTimeToTimestamp(time) {
    if (!time) return null;
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours));
    date.setMinutes(parseInt(minutes));
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date.getTime();
  },

  getWeekDates(startDate) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  },

  formatDateForInput(date) {
    return date.toISOString().split('T')[0];
  }
};

// =============================================================================
// UI MANAGEMENT
// =============================================================================

const UI = {
  showError(message) {
    const errorMessageElement = document.getElementById('errorMessage');
    if (errorMessageElement) {
      errorMessageElement.textContent = message;
      document.getElementById('errorModal').style.display = 'flex';
    } else {
      console.error("Error message element not found:", message);
    }
  },

  showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
      successMessage.textContent = message;
      successMessage.style.display = 'block';
      setTimeout(() => {
        successMessage.style.display = 'none';
      }, 3000);
    } else {
      alert(message);
    }
  },

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
    } else {
      console.error(`Modal not found: ${modalId}`);
    }
  },

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  },

  updateDateTime() {
    const now = new Date();
    const currentDateElement = document.getElementById('currentDate');
    const currentTimeElement = document.getElementById('currentTime');
    
    if (currentDateElement) {
      currentDateElement.textContent = now.toDateString();
    }
    if (currentTimeElement) {
      currentTimeElement.textContent = now.toLocaleTimeString();
    }
  },

  showContent(contentId) {
    const contents = [
      'dashboardContent',
      'employeeManagementContent', 
      'overviewContent',
      'settingsContent'
    ];
    
    contents.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = id === contentId ? 'block' : 'none';
      }
    });

    // Show/hide additional elements based on content
    const dateTime = document.getElementById('dateTime');
    const addEmployeeButton = document.getElementById('addEmployeeButton');
    
    if (dateTime) {
      dateTime.style.display = contentId === 'dashboardContent' ? 'block' : 'none';
    }
    if (addEmployeeButton) {
      addEmployeeButton.style.display = contentId === 'employeeManagementContent' ? 'block' : 'none';
    }
  }
};

// =============================================================================
// CALENDAR MANAGEMENT - FIXED
// =============================================================================

const Calendar = {
  updateCalendar() {
    Utils.debug("Updating calendar");
    const customCalendar = document.getElementById('customCalendar');
    const dateRangeElement = document.getElementById('dateRange');
    
    if (!customCalendar) {
      console.error("Custom calendar element not found");
      return;
    }

    customCalendar.innerHTML = '';
    
    const weekStart = appState.currentWeekStart;
    const weekEnd = appState.getCurrentWeekEnd();
    
    if (!weekStart || !weekEnd) {
      console.error("Week dates not properly set");
      return;
    }

    // Update date range display
    if (dateRangeElement) {
      dateRangeElement.textContent = `${weekStart.toDateString()} - ${weekEnd.toDateString()}`;
    }

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const selectedDate = new Date(document.getElementById('dateFilter').value + 'T12:00:00');

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      
      const day = dayDate.getDate();
      const month = dayDate.getMonth() + 1;
      const dayOfWeek = daysOfWeek[i];

      const dayElement = document.createElement('div');
      dayElement.className = 'day';
      dayElement.innerHTML = `
        ${dayOfWeek} <div class="date">${month}/${day}</div>
        <div class="dot"></div>
      `;

      // Highlight today
      if (dayDate.toDateString() === today.toDateString()) {
        dayElement.classList.add('active');
      }

      // Highlight selected date
      if (dayDate.toDateString() === selectedDate.toDateString()) {
        dayElement.classList.add('selected');
      }

      dayElement.addEventListener('click', () => {
        this.selectDate(dayDate);
      });

      customCalendar.appendChild(dayElement);
    }
  },

  selectDate(date) {
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
      dateFilter.value = Utils.formatDateForInput(date);
      appState.setCurrentWeekStart(date);
      this.updateCalendar();
      Timesheet.displayTimesheet();
    }
  },

  changeWeek(direction) {
    Utils.debug(`Changing week by ${direction}`);
    
    const dateFilter = document.getElementById('dateFilter');
    if (!dateFilter) {
      console.error("Date filter element not found");
      return;
    }

    const currentDate = new Date(dateFilter.value + 'T12:00:00');
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    
    // Update the date filter
    dateFilter.value = Utils.formatDateForInput(newDate);
    
    // Update the current week start
    appState.setCurrentWeekStart(newDate);
    
    // Refresh UI
    this.updateCalendar();
    Timesheet.displayTimesheet();
  },

  setDateToToday() {
    const today = new Date();
    const dateFilter = document.getElementById('dateFilter');
    
    if (dateFilter) {
      dateFilter.value = Utils.formatDateForInput(today);
      appState.setCurrentWeekStart(today);
      
      dateFilter.addEventListener('change', () => {
        const selectedDate = new Date(dateFilter.value + 'T12:00:00');
        appState.setCurrentWeekStart(selectedDate);
        Timesheet.displayTimesheet();
        this.updateCalendar();
      });
    }
  },

  populateYearDropdown() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;
    
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    const endYear = currentYear + 2;
    
    yearSelect.innerHTML = '';
    for (let year = startYear; year <= endYear; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === currentYear) option.selected = true;
      yearSelect.appendChild(option);
    }
  },

  populateMonthDropdown() {
    const monthSelect = document.getElementById('monthSelect');
    if (!monthSelect) return;
    
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    monthSelect.innerHTML = '';
    months.forEach((month, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = month;
      if (index === new Date().getMonth()) option.selected = true;
      monthSelect.appendChild(option);
    });
  },

  onYearMonthChange() {
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    
    if (!yearSelect || !monthSelect) return;
    
    const selectedYear = parseInt(yearSelect.value);
    const selectedMonth = parseInt(monthSelect.value);
    
    const selectedDate = new Date(selectedYear, selectedMonth, 1);
    
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
      dateFilter.value = Utils.formatDateForInput(selectedDate);
      appState.setCurrentWeekStart(selectedDate);
      this.updateCalendar();
      Timesheet.displayTimesheet();
    }
  },

  jumpToToday() {
    const today = new Date();
    const dateFilter = document.getElementById('dateFilter');
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    
    if (dateFilter) {
      dateFilter.value = Utils.formatDateForInput(today);
      appState.setCurrentWeekStart(today);
    }
    
    if (yearSelect) {
      yearSelect.value = today.getFullYear();
    }
    
    if (monthSelect) {
      monthSelect.value = today.getMonth();
    }
    
    this.updateCalendar();
    Timesheet.displayTimesheet();
  }
};

// =============================================================================
// SETTINGS MANAGEMENT
// =============================================================================

const Settings = {
  getDefaultSettings() {
    return {
      companyName: 'SC DEBURRING',
      companyAddress: '12734 Branford St STE 17, Pacoima, CA',
      adminPIN: '2061',
      businessStartTime: '09:00',
      businessEndTime: '17:00',
      overtimeThreshold: 8,
      overtimeMultiplier: 1.5,
      minimumBreakDuration: 30,
      maximumBreakDuration: 60,
    };
  },

  async loadSettings() {
    try {
      const settingsRef = ref(db, 'settings');
      const snapshot = await get(settingsRef);
      
      if (snapshot.exists()) {
        appState.settings = snapshot.val();
        this.applySettingsToUI(appState.settings);
      } else {
        const defaultSettings = this.getDefaultSettings();
        await set(settingsRef, defaultSettings);
        appState.settings = defaultSettings;
        this.applySettingsToUI(defaultSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      UI.showError('Failed to load settings. Please try again.');
    }
  },

  applySettingsToUI(settings) {
    const elements = [
      'companyName', 'companyAddress', 'adminPIN', 'businessStartTime', 
      'businessEndTime', 'overtimeThreshold', 'overtimeMultiplier', 
      'minimumBreakDuration', 'maximumBreakDuration'
    ];
    
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.value = settings[id];
      } else {
        console.warn(`Settings element not found: ${id}`);
      }
    });
  },

  async saveSettings() {
    Utils.debug("Saving settings...");
    try {
      const newSettings = {
        companyName: document.getElementById('companyName').value,
        companyAddress: document.getElementById('companyAddress').value,
        adminPIN: document.getElementById('adminPIN').value,
        businessStartTime: document.getElementById('businessStartTime').value,
        businessEndTime: document.getElementById('businessEndTime').value,
        overtimeThreshold: parseFloat(document.getElementById('overtimeThreshold').value),
        overtimeMultiplier: parseFloat(document.getElementById('overtimeMultiplier').value),
        minimumBreakDuration: parseInt(document.getElementById('minimumBreakDuration').value),
        maximumBreakDuration: parseInt(document.getElementById('maximumBreakDuration').value),
      };

      const settingsRef = ref(db, 'settings');
      await set(settingsRef, newSettings);
      appState.settings = newSettings;
      UI.showSuccess('Settings saved successfully.');
      Utils.debug("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      UI.showError('Failed to save settings. Error: ' + error.message);
    }
  },

  async resetSettings() {
    try {
      const defaultSettings = this.getDefaultSettings();
      const settingsRef = ref(db, 'settings');
      await set(settingsRef, defaultSettings);
      appState.settings = defaultSettings;
      this.applySettingsToUI(defaultSettings);
      UI.showSuccess('Settings reset to default values.');
    } catch (error) {
      console.error("Error resetting settings:", error);
      UI.showError('Failed to reset settings. Error: ' + error.message);
    }
  }
};

// =============================================================================
// EMPLOYEE MANAGEMENT
// =============================================================================

const Employees = {
  async loadEmployees() {
    try {
      Utils.debug("Loading employees...");
      const employeesRef = ref(db, 'employees');
      const snapshot = await get(employeesRef);
      
      if (snapshot.exists()) {
        appState.employees = snapshot.val();
        Utils.debug("Employees loaded:", appState.employees);
        this.updateEmployeeList(appState.employees);
        this.updateEmployeeManagementList(appState.employees);
        this.updateEmployeeFilter(appState.employees);
      } else {
        Utils.debug("No employees found");
        appState.employees = {};
      }
    } catch (error) {
      console.error("Error loading employees:", error);
      UI.showError(`Failed to load employees. Error: ${error.message}`);
    }
  },

  async addEmployee() {
    try {
      const name = document.getElementById('addEmployeeName').value;
      const id = document.getElementById('addEmployeeId').value;
      const payRate = document.getElementById('addEmployeePayRate').value;
      const role = document.getElementById('addEmployeeRole').value;

      if (name && id && payRate && role) {
        const employeeRef = ref(db, 'employees/' + id);
        await set(employeeRef, { name, id, payRate: parseFloat(payRate), role });
        await set(ref(db, 'timesheets/' + id), {});
        await set(ref(db, 'timers/' + id), { 
          mainTime: 0, 
          breakTime: 0, 
          startTime: null, 
          breakStartTime: null, 
          isRunning: false, 
          isOnBreak: false 
        });
        
        await this.loadEmployees();
        UI.hideModal('addEmployeeModal');
        
        // Clear form
        ['addEmployeeName', 'addEmployeeId', 'addEmployeePayRate', 'addEmployeeRole'].forEach(id => {
          const element = document.getElementById(id);
          if (element) element.value = '';
        });
      } else {
        UI.showError('Please fill out all fields.');
      }
    } catch (error) {
      console.error("Error adding employee:", error);
      UI.showError('Failed to add employee. Please try again.');
    }
  },

  async updateEmployee(id, name, role, payRate) {
    try {
      const employeeRef = ref(db, 'employees/' + id);
      await update(employeeRef, { name, role, payRate: parseFloat(payRate) });
      await this.loadEmployees();
    } catch (error) {
      console.error("Error updating employee:", error);
      UI.showError('Failed to update employee. Please try again.');
    }
  },

  async deleteEmployee(id) {
    try {
      if (confirm('Are you sure you want to delete this employee?')) {
        await remove(ref(db, 'employees/' + id));
        await remove(ref(db, 'timesheets/' + id));
        await remove(ref(db, 'timers/' + id));
        await this.loadEmployees();
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      UI.showError('Failed to delete employee. Please try again.');
    }
  },

  updateEmployeeList(employees) {
    const employeeList = document.getElementById('employees');
    if (!employeeList) {
      console.error("Employee list element not found");
      return;
    }
    
    employeeList.innerHTML = '';
    Object.values(employees).forEach(employee => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${employee.name}</span>`;
      li.addEventListener('click', () => Timer.showClockInModal(employee));
      employeeList.appendChild(li);
    });
  },

  updateEmployeeManagementList(employees) {
    const employeeManagementList = document.getElementById('employeeManagementList');
    if (!employeeManagementList) {
      console.error("Employee management list element not found");
      return;
    }
    
    employeeManagementList.innerHTML = '';
    Object.values(employees).forEach(employee => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${employee.name} (${employee.id})</span>
        <div class="employee-actions">
          <button class="edit-button" data-id="${employee.id}">Edit</button>
          <button class="delete-button" data-id="${employee.id}">Delete</button>
        </div>
      `;
      employeeManagementList.appendChild(li);
    });

    this.addEmployeeManagementListeners();
  },

  addEmployeeManagementListeners() {
    document.querySelectorAll('.edit-button').forEach(button => {
      button.addEventListener('click', () => this.editEmployee(button.getAttribute('data-id')));
    });
    document.querySelectorAll('.delete-button').forEach(button => {
      button.addEventListener('click', () => this.deleteEmployee(button.getAttribute('data-id')));
    });
  },

  updateEmployeeFilter(employees) {
    const employeeFilter = document.getElementById('employeeFilter');
    if (!employeeFilter) {
      console.error("Employee filter element not found");
      return;
    }
    
    employeeFilter.innerHTML = '<option value="">All Employees</option>';
    Object.values(employees).forEach(employee => {
      const option = document.createElement('option');
      option.value = employee.id;
      option.textContent = employee.name;
      employeeFilter.appendChild(option);
    });
  },

  async editEmployee(id) {
    const employee = appState.employees[id];
    if (employee) {
      document.getElementById('editEmployeeId').value = employee.id;
      document.getElementById('editEmployeeName').value = employee.name;
      document.getElementById('editEmployeeRole').value = employee.role;
      document.getElementById('editEmployeePayRate').value = employee.payRate;
      UI.showModal('editEmployeeModal');
    } else {
      UI.showError('Employee not found');
    }
  },

  async saveEmployeeChanges() {
    const id = document.getElementById('editEmployeeId').value;
    const name = document.getElementById('editEmployeeName').value;
    const role = document.getElementById('editEmployeeRole').value;
    const payRate = parseFloat(document.getElementById('editEmployeePayRate').value);

    if (name && role && !isNaN(payRate)) {
      try {
        await this.updateEmployee(id, name, role, payRate);
        UI.hideModal('editEmployeeModal');
        UI.showSuccess('Employee updated successfully');
      } catch (error) {
        UI.showError('Failed to update employee: ' + error.message);
      }
    } else {
      UI.showError('Please fill all fields correctly');
    }
  }
};

// =============================================================================
// TIMER & CLOCK MANAGEMENT - FIXED WITH AUTO-CLOSE MODAL
// =============================================================================

const Timer = {
  async showClockInModal(employee) {
    const { id } = employee;
    appState.activeEmployeeId = id;

    document.getElementById('employeeNameModal').textContent = `${employee.name} (${employee.id})`;
    UI.showModal('clockInModal');

    const timerRef = ref(db, 'timers/' + id);
    const snapshot = await get(timerRef);
    const timer = snapshot.val() || { 
      mainTime: 0, 
      breakTime: 0, 
      isRunning: false, 
      isOnBreak: false 
    };

    // Update UI based on timer state
    this.updateTimerDisplay(timer, id);
  },

  updateTimerDisplay(timer, id) {
    const clockCircle = document.querySelector('.clock-circle');
    const clockInText = document.getElementById('clockInText');
    const breakButton = document.getElementById('breakButton');
    const timerElement = document.getElementById('timer');

    // Reset timer display
    if (timerElement) {
      timerElement.textContent = Utils.formatTotalTime(0);
    }

    // Reset clock circle and break button
    clockCircle?.classList.remove('red', 'working', 'break');
    
    if (breakButton) {
      breakButton.classList.remove('show');
      breakButton.classList.add('d-none');
      breakButton.style.display = 'none';
    }

    if (timer.isRunning && !timer.isOnBreak) {
      // Employee is clocked in and working
      this.startMainInterval(id);
      clockCircle?.classList.add('red', 'working');
      if (clockInText) clockInText.textContent = 'Clock Out';
      
      // SHOW break button only when clocked in and working
      if (breakButton) {
        breakButton.classList.remove('d-none');
        breakButton.classList.add('show');
        breakButton.style.display = 'block';
        breakButton.textContent = 'Start Break';
      }
    } else if (timer.isOnBreak) {
      // Employee is on break
      this.startBreakInterval(id);
      clockCircle?.classList.add('break');
      if (clockInText) clockInText.textContent = 'On Break';
      
      // Show break button to end break
      if (breakButton) {
        breakButton.classList.remove('d-none');
        breakButton.classList.add('show');
        breakButton.style.display = 'block';
        breakButton.textContent = 'End Break';
      }
    } else {
      // Employee is clocked out
      clearInterval(appState.currentInterval);
      if (clockInText) clockInText.textContent = 'Clock In';
      
      // HIDE break button when clocked out
      if (breakButton) {
        breakButton.classList.add('d-none');
        breakButton.classList.remove('show');
        breakButton.style.display = 'none';
      }
    }

    // Set up event listeners
    if (clockCircle) {
      clockCircle.onclick = () => this.handleClockClick(id);
    }
    if (breakButton) {
      breakButton.onclick = () => this.handleBreakClick(id);
    }
  },

  async handleClockClick(id) {
    const timerRef = ref(db, 'timers/' + id);
    const snapshot = await get(timerRef);
    const timer = snapshot.val();

    if (!timer.isRunning && !timer.isOnBreak) {
      // Clock In
      await update(timerRef, { startTime: Date.now(), isRunning: true });
      await this.logTimesheet(id, 'clockin');
      
      UI.showSuccess('Clocked in successfully!');
      
      // Close modal immediately after clock in
      UI.hideModal('clockInModal');
      
      // Update data in background
      await Employees.loadEmployees();
      await Timesheet.displayTimesheet();
      
    } else if (timer.isRunning && !timer.isOnBreak) {
      // Clock Out
      await this.stopActiveEmployeeTimer(id);
      await this.logTimesheet(id, 'clockout');
      await this.resetTimer(id);
      
      UI.showSuccess('Clocked out successfully!');
      
      // Close modal immediately after clock out
      UI.hideModal('clockInModal');
      
      // Update data in background
      await Employees.loadEmployees();
      await Timesheet.displayTimesheet();
      
    } else if (timer.isOnBreak) {
      // Prevent clock out when on break
      UI.showError('Cannot clock out while on break. Please end the break first.');
      return;
    }
  },

  async handleBreakClick(id) {
    const timerRef = ref(db, 'timers/' + id);
    const snapshot = await get(timerRef);
    const timer = snapshot.val();

    if (!timer.isOnBreak) {
      // Start Break
      const mainTime = timer.mainTime + Math.floor((Date.now() - timer.startTime) / 1000);
      await update(timerRef, { 
        mainTime, 
        breakStartTime: Date.now(), 
        isRunning: false, 
        isOnBreak: true 
      });
      await this.logTimesheet(id, 'startbreak');
      
      UI.showSuccess('Break started!');
      
      // Close modal immediately after starting break
      UI.hideModal('clockInModal');
      
      // Update data in background
      await Employees.loadEmployees();
      await Timesheet.displayTimesheet();
      
    } else {
      // End Break
      const breakDuration = Math.floor((Date.now() - timer.breakStartTime) / 60000);
      
      if (breakDuration < appState.settings.minimumBreakDuration) {
        UI.showError(`Break must be at least ${appState.settings.minimumBreakDuration} minutes.`);
        return;
      }
      if (breakDuration > appState.settings.maximumBreakDuration) {
        UI.showError(`Break cannot exceed ${appState.settings.maximumBreakDuration} minutes.`);
        return;
      }
      
      const breakTime = timer.breakTime + Math.floor((Date.now() - timer.breakStartTime) / 1000);
      await update(timerRef, { 
        breakTime, 
        startTime: Date.now(), 
        isRunning: true, 
        isOnBreak: false 
      });
      await this.logTimesheet(id, 'endbreak');
      
      UI.showSuccess('Break ended, back to work!');
      
      // Close modal immediately after ending break
      UI.hideModal('clockInModal');
      
      // Update data in background
      await Employees.loadEmployees();
      await Timesheet.displayTimesheet();
    }
  },

  startMainInterval(id) {
    clearInterval(appState.currentInterval);
    appState.currentInterval = setInterval(async () => {
      const timerRef = ref(db, 'timers/' + id);
      const snapshot = await get(timerRef);
      const timer = snapshot.val();
      if (timer && timer.startTime) {
        const duration = Math.floor((Date.now() - timer.startTime) / 1000);
        this.updateTimer(document.getElementById('timer'), timer.mainTime + duration);
      }
    }, 1000);
  },

  startBreakInterval(id) {
    clearInterval(appState.currentInterval);
    appState.currentInterval = setInterval(async () => {
      const timerRef = ref(db, 'timers/' + id);
      const snapshot = await get(timerRef);
      const timer = snapshot.val();
      if (timer && timer.breakStartTime) {
        const duration = Math.floor((Date.now() - timer.breakStartTime) / 1000);
        this.updateTimer(document.getElementById('timer'), timer.breakTime + duration);
      }
    }, 1000);
  },

  async stopActiveEmployeeTimer(id) {
    const timerRef = ref(db, 'timers/' + id);
    const snapshot = await get(timerRef);
    const timer = snapshot.val();
    
    if (timer.isRunning && timer.startTime) {
      const mainTime = timer.mainTime + Math.floor((Date.now() - timer.startTime) / 1000);
      await update(timerRef, { mainTime, isRunning: false });
    } else if (timer.isOnBreak && timer.breakStartTime) {
      const breakTime = timer.breakTime + Math.floor((Date.now() - timer.breakStartTime) / 1000);
      await update(timerRef, { breakTime, isOnBreak: false });
    }
    
    clearInterval(appState.currentInterval);
  },

  async resetTimer(id) {
    const timerRef = ref(db, 'timers/' + id);
    await set(timerRef, { 
      mainTime: 0, 
      breakTime: 0, 
      startTime: null, 
      breakStartTime: null, 
      isRunning: false, 
      isOnBreak: false 
    });
  },

  updateTimer(element, time) {
    if (element) {
      element.textContent = Utils.formatTotalTime(time);
    }
  },

  async logTimesheet(id, type) {
    try {
      const timestamp = Date.now();
      const timesheetRef = ref(db, 'timesheets/' + id);
      await push(timesheetRef, { type, timestamp });
    } catch (error) {
      console.error("Error logging timesheet:", error);
      UI.showError('Failed to log timesheet entry. Please try again.');
    }
  }
};

// =============================================================================
// TIMESHEET MANAGEMENT - FIXED DAY/WEEK VIEW
// =============================================================================

const Timesheet = {
  async displayTimesheet() {
    Utils.debug("displayTimesheet function called");
    try {
      const selectedDate = new Date(document.getElementById('dateFilter').value + 'T12:00:00');
      const selectedEmployee = document.getElementById('employeeFilter').value;
      const timeFrame = document.getElementById('timeFilter').value; // FIXED: Respect timeFilter
      const timesheetTableBody = document.querySelector('#timesheetTable tbody');
      
      if (!timesheetTableBody) {
        throw new Error("Timesheet table body not found");
      }

      timesheetTableBody.innerHTML = '<tr><td colspan="13">Loading...</td></tr>';

      const filteredEmployees = selectedEmployee ? 
        { [selectedEmployee]: appState.employees[selectedEmployee] } : 
        appState.employees;

      // FIXED: Respect the timeFilter selection - don't override it
      let dates;
      if (timeFrame === 'day') {
        // Show ONLY the selected day
        dates = [selectedDate];
        Utils.debug("Displaying DAY view for:", selectedDate.toDateString());
      } else {
        // Show the week
        dates = Utils.getWeekDates(appState.currentWeekStart);
        Utils.debug("Displaying WEEK view for week starting:", appState.currentWeekStart.toDateString());
      }

      const fragment = document.createDocumentFragment();

      for (const date of dates) {
        for (const [id, employee] of Object.entries(filteredEmployees)) {
          if (employee) {
            const timesheetSnapshot = await get(ref(db, `timesheets/${id}`));
            const timesheet = timesheetSnapshot.val() || {};
            const dailyEntries = Object.values(timesheet).filter(entry => 
              new Date(entry.timestamp).toDateString() === date.toDateString()
            );
            const row = await this.renderTimesheetRow(employee, dailyEntries, date);
            fragment.appendChild(row);
          }
        }
      }

      timesheetTableBody.innerHTML = '';
      timesheetTableBody.appendChild(fragment);

      this.addAttendanceButtonListeners();
      this.addEditableCellListeners();
      await this.checkForIncompleteTimesheets();

      Utils.debug(`Timesheet displayed successfully in ${timeFrame.toUpperCase()} view`);
    } catch (error) {
      console.error("Error displaying timesheet:", error);
      UI.showError('Failed to display timesheet. Error: ' + error.message);
    }
  },

  async renderTimesheetRow(employee, timesheet, date) {
    const { totalWorkHours, totalBreakHours, regularHours, overtimeHours, dailyPay } = 
      this.calculateDailyHours(timesheet, employee.payRate);

    // Attendance status
    const attendanceSnapshot = await get(ref(db, `attendance/${employee.id}/${date.toDateString()}`));
    const attendanceStatus = attendanceSnapshot.val() || '';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${date.toDateString()}</td>
      <td>${employee.name}</td>
      <td>${employee.role}</td>
      <td class="editable" data-type="clockin" data-id="${employee.id}" data-date="${date.toDateString()}">${Utils.formatTime(timesheet.find(entry => entry.type === 'clockin')?.timestamp)}</td>
      <td class="editable" data-type="startbreak" data-id="${employee.id}" data-date="${date.toDateString()}">${Utils.formatTime(timesheet.find(entry => entry.type === 'startbreak')?.timestamp)}</td>
      <td class="editable" data-type="endbreak" data-id="${employee.id}" data-date="${date.toDateString()}">${Utils.formatTime(timesheet.find(entry => entry.type === 'endbreak')?.timestamp)}</td>
      <td class="editable" data-type="clockout" data-id="${employee.id}" data-date="${date.toDateString()}">${Utils.formatTime(timesheet.find(entry => entry.type === 'clockout')?.timestamp)}</td>
      <td>${regularHours.toFixed(2)}</td>
      <td>${overtimeHours.toFixed(2)}</td>
      <td>${totalBreakHours.toFixed(2)}</td>
      <td>${dailyPay.toFixed(2)}</td>
      <td>${attendanceStatus}</td>
      <td>
        <button class="attendance-button" data-id="${employee.id}" data-date="${date.toDateString()}" data-status="Called Out">Called Out</button>
        <button class="attendance-button" data-id="${employee.id}" data-date="${date.toDateString()}" data-status="No Show">No Show</button>
      </td>
    `;
    return row;
  },

  calculateDailyHours(dailyEntries, payRate) {
    let totalWorkMilliseconds = 0;
    let totalBreakMilliseconds = 0;
    let lastClockInTime = null;

    dailyEntries.forEach((entry, index) => {
      if (entry.type === 'clockin') {
        lastClockInTime = entry.timestamp;
      }
      if (entry.type === 'clockout' && lastClockInTime) {
        totalWorkMilliseconds += (entry.timestamp - lastClockInTime);
        lastClockInTime = null;
      }
      if (entry.type === 'startbreak' && dailyEntries[index + 1] && dailyEntries[index + 1].type === 'endbreak') {
        totalBreakMilliseconds += (dailyEntries[index + 1].timestamp - entry.timestamp);
      }
    });

    const totalWorkHours = totalWorkMilliseconds / 3600000;
    const totalBreakHours = totalBreakMilliseconds / 3600000;
    let payableWorkHours = Math.max(0, totalWorkHours - totalBreakHours);

    // Overtime calculation
    let regularHours = payableWorkHours;
    let overtimeHours = 0;
    if (payableWorkHours > appState.settings.overtimeThreshold) {
      overtimeHours = payableWorkHours - appState.settings.overtimeThreshold;
      regularHours = appState.settings.overtimeThreshold;
    }
    
    const regularPay = regularHours * payRate;
    const overtimePay = overtimeHours * payRate * appState.settings.overtimeMultiplier;
    const dailyPay = regularPay + overtimePay;

    return { totalWorkHours, totalBreakHours, regularHours, overtimeHours, dailyPay };
  },

  addAttendanceButtonListeners() {
    document.querySelectorAll('.attendance-button').forEach(button => {
      button.addEventListener('click', async function() {
        const id = button.getAttribute('data-id');
        const date = button.getAttribute('data-date');
        const status = button.getAttribute('data-status');
        await set(ref(db, `attendance/${id}/${date}`), status);
        Timesheet.displayTimesheet();
      });
    });
  },

  addEditableCellListeners() {
    document.querySelectorAll('.editable').forEach(cell => {
      cell.addEventListener('click', function () {
        const currentValue = cell.textContent;
        const input = document.createElement('input');
        input.type = 'time';
        input.value = Utils.convertTo24HourFormat(currentValue);
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();

        input.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') {
            input.blur();
          }
        });

        input.addEventListener('blur', function () {
          const newValue = input.value;
          if (newValue) {
            Timesheet.saveInlineEdit(
              cell.getAttribute('data-id'), 
              cell.getAttribute('data-type'), 
              cell.getAttribute('data-date'), 
              newValue
            );
          }
          cell.textContent = Utils.formatTime(Utils.convertTimeToTimestamp(newValue));
        });
      });
    });
  },

  async saveInlineEdit(id, type, dateString, time) {
    await this.updateTimesheetEntry(id, type, dateString, time);
    await this.displayTimesheet();
  },

  async updateTimesheetEntry(id, type, dateString, time) {
    try {
      const timestamp = new Date(`${dateString} ${time}`).getTime();
      const timesheetRef = ref(db, 'timesheets/' + id);
      const snapshot = await get(timesheetRef);
      
      if (snapshot.exists()) {
        const timesheet = snapshot.val();
        const entryKey = Object.keys(timesheet).find(key => 
          timesheet[key].type === type && 
          new Date(timesheet[key].timestamp).toDateString() === dateString
        );
        
        if (entryKey) {
          await update(ref(db, `timesheets/${id}/${entryKey}`), { timestamp });
        } else {
          await push(timesheetRef, { type, timestamp });
        }
      }
    } catch (error) {
      console.error("Error updating timesheet entry:", error);
      UI.showError('Failed to update timesheet entry. Please try again.');
    }
  },

  async checkForIncompleteTimesheets() {
    let incompleteEntries = new Set();
    const selectedDate = new Date(document.getElementById('dateFilter').value + 'T12:00:00');

    for (const [id, employee] of Object.entries(appState.employees)) {
      const timesheetSnapshot = await get(ref(db, `timesheets/${id}`));
      const timesheet = timesheetSnapshot.val() || {};
      const dailyEntries = Object.values(timesheet).filter(entry => 
        new Date(entry.timestamp).toDateString() === selectedDate.toDateString()
      );

      const hasClockIn = dailyEntries.some(entry => entry.type === 'clockin');
      const hasClockOut = dailyEntries.some(entry => entry.type === 'clockout');

      if ((hasClockIn && !hasClockOut) || (!hasClockIn && hasClockOut)) {
        incompleteEntries.add(employee.name);
      }
    }

    const overviewContent = document.getElementById('overviewContent');
    if (overviewContent && incompleteEntries.size > 0) {
      // Remove existing warning
      const existingWarning = overviewContent.querySelector('.warning-message');
      if (existingWarning) {
        existingWarning.remove();
      }
      
      const warningElement = document.createElement('div');
      warningElement.className = 'warning-message';
      warningElement.textContent = `Warning: Incomplete timesheets for: ${Array.from(incompleteEntries).join(', ')}`;
      overviewContent.prepend(warningElement);
    }
  }
};

// =============================================================================
// DATA MANAGEMENT
// =============================================================================

const DataManager = {
  async getDataSummary() {
    try {
      Utils.debug("Getting data summary...");
      
      const summary = {
        employees: 0,
        timesheetEntries: 0,
        oldestEntry: null,
        newestEntry: null,
        totalDataSize: 0,
        yearlyBreakdown: {}
      };

      // Get employees count
      const employeesSnapshot = await get(ref(db, 'employees'));
      if (employeesSnapshot.exists()) {
        summary.employees = Object.keys(employeesSnapshot.val()).length;
      }

      // Analyze timesheet data
      const timesheetsSnapshot = await get(ref(db, 'timesheets'));
      if (timesheetsSnapshot.exists()) {
        const timesheets = timesheetsSnapshot.val();
        
        for (const [employeeId, employeeTimesheets] of Object.entries(timesheets)) {
          if (employeeTimesheets && typeof employeeTimesheets === 'object') {
            const entries = Object.values(employeeTimesheets);
            summary.timesheetEntries += entries.length;
            
            entries.forEach(entry => {
              if (entry.timestamp) {
                const entryDate = new Date(entry.timestamp);
                const year = entryDate.getFullYear();
                
                if (!summary.yearlyBreakdown[year]) {
                  summary.yearlyBreakdown[year] = 0;
                }
                summary.yearlyBreakdown[year]++;
                
                if (!summary.oldestEntry || entryDate < new Date(summary.oldestEntry)) {
                  summary.oldestEntry = entry.timestamp;
                }
                if (!summary.newestEntry || entryDate > new Date(summary.newestEntry)) {
                  summary.newestEntry = entry.timestamp;
                }
              }
            });
          }
        }
      }

      // Estimate data size (rough calculation)
      summary.totalDataSize = summary.timesheetEntries * 100; // Approx 100 bytes per entry

      return summary;
    } catch (error) {
      console.error("Error getting data summary:", error);
      throw error;
    }
  },

  async showDataManagement() {
    try {
      const summary = await this.getDataSummary();
      this.displayDataSummary(summary);
      UI.showModal('dataManagementModal');
    } catch (error) {
      UI.showError('Failed to load data summary: ' + error.message);
    }
  },

  displayDataSummary(summary) {
    const summaryElement = document.getElementById('dataSummaryContent');
    if (!summaryElement) return;

    const oldestDate = summary.oldestEntry ? new Date(summary.oldestEntry).toDateString() : 'No data';
    const newestDate = summary.newestEntry ? new Date(summary.newestEntry).toDateString() : 'No data';
    const dataSizeKB = (summary.totalDataSize / 1024).toFixed(2);

    let yearlyBreakdownHTML = '';
    const sortedYears = Object.keys(summary.yearlyBreakdown).sort((a, b) => b - a);
    sortedYears.forEach(year => {
      yearlyBreakdownHTML += `
        <div class="year-data-row">
          <span>${year}: ${summary.yearlyBreakdown[year]} entries</span>
          <button class="delete-year-btn" onclick="DataManager.deleteYearData('${year}')" data-year="${year}">
            Delete ${year} Data
          </button>
        </div>
      `;
    });

    summaryElement.innerHTML = `
      <div class="data-summary">
        <h3>Data Overview</h3>
        <div class="summary-stats">
          <div class="stat-item">
            <strong>Total Employees:</strong> ${summary.employees}
          </div>
          <div class="stat-item">
            <strong>Total Timesheet Entries:</strong> ${summary.timesheetEntries}
          </div>
          <div class="stat-item">
            <strong>Date Range:</strong> ${oldestDate} - ${newestDate}
          </div>
          <div class="stat-item">
            <strong>Estimated Data Size:</strong> ${dataSizeKB} KB
          </div>
        </div>
        
        <h4>Data by Year</h4>
        <div class="yearly-breakdown">
          ${yearlyBreakdownHTML || '<p>No timesheet data found</p>'}
        </div>
        
        <div class="data-actions">
          <button class="export-all-btn" onclick="DataManager.exportAllData()">
            Export All Data
          </button>
          <button class="archive-old-btn" onclick="DataManager.showArchiveOptions()">
            Archive Old Data
          </button>
          <button class="cleanup-btn" onclick="DataManager.cleanupOrphanedData()">
            Cleanup Orphaned Data
          </button>
        </div>
      </div>
    `;
  },

  async deleteYearData(year) {
    const confirmDelete = confirm(
      `Are you sure you want to delete ALL timesheet data from ${year}?\n\n` +
      `This action cannot be undone. Consider exporting the data first.`
    );
    
    if (!confirmDelete) return;

    try {
      Utils.debug(`Deleting data for year ${year}...`);
      UI.showSuccess('Deleting data... Please wait.');

      const timesheetsSnapshot = await get(ref(db, 'timesheets'));
      if (!timesheetsSnapshot.exists()) {
        UI.showSuccess('No data found to delete.');
        return;
      }

      const timesheets = timesheetsSnapshot.val();
      let deletedCount = 0;

      for (const [employeeId, employeeTimesheets] of Object.entries(timesheets)) {
        if (employeeTimesheets && typeof employeeTimesheets === 'object') {
          const entries = Object.entries(employeeTimesheets);
          
          for (const [entryId, entry] of entries) {
            if (entry.timestamp) {
              const entryYear = new Date(entry.timestamp).getFullYear();
              if (entryYear.toString() === year) {
                await remove(ref(db, `timesheets/${employeeId}/${entryId}`));
                deletedCount++;
              }
            }
          }
        }
      }

      // Also delete attendance data for that year
      const attendanceSnapshot = await get(ref(db, 'attendance'));
      if (attendanceSnapshot.exists()) {
        const attendance = attendanceSnapshot.val();
        for (const [employeeId, employeeAttendance] of Object.entries(attendance)) {
          if (employeeAttendance && typeof employeeAttendance === 'object') {
            for (const [dateString, status] of Object.entries(employeeAttendance)) {
              if (new Date(dateString).getFullYear().toString() === year) {
                await remove(ref(db, `attendance/${employeeId}/${dateString}`));
              }
            }
          }
        }
      }

      UI.showSuccess(`Successfully deleted ${deletedCount} entries from ${year}.`);
      
      // Refresh the data summary
      setTimeout(() => {
        this.showDataManagement();
      }, 1500);

    } catch (error) {
      console.error("Error deleting year data:", error);
      UI.showError('Failed to delete data: ' + error.message);
    }
  },

  async exportAllData() {
    try {
      Utils.debug("Exporting all data...");
      UI.showSuccess('Preparing data export... Please wait.');

      const data = {
        exportDate: new Date().toISOString(),
        employees: {},
        timesheets: {},
        attendance: {},
        settings: {}
      };

      // Get all data
      const [employeesSnap, timesheetsSnap, attendanceSnap, settingsSnap] = await Promise.all([
        get(ref(db, 'employees')),
        get(ref(db, 'timesheets')),
        get(ref(db, 'attendance')),
        get(ref(db, 'settings'))
      ]);

      if (employeesSnap.exists()) data.employees = employeesSnap.val();
      if (timesheetsSnap.exists()) data.timesheets = timesheetsSnap.val();
      if (attendanceSnap.exists()) data.attendance = attendanceSnap.val();
      if (settingsSnap.exists()) data.settings = settingsSnap.val();

      // Create downloadable file
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `timesheet_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      UI.showSuccess('Data exported successfully!');
    } catch (error) {
      console.error("Error exporting data:", error);
      UI.showError('Failed to export data: ' + error.message);
    }
  },

  showArchiveOptions() {
    const archiveModal = `
      <div class="archive-options">
        <h4>Archive Old Data</h4>
        <p>Select how old the data should be to archive:</p>
        <div class="archive-options-buttons">
          <button onclick="DataManager.archiveDataOlderThan(365)">Archive data older than 1 year</button>
          <button onclick="DataManager.archiveDataOlderThan(730)">Archive data older than 2 years</button>
          <button onclick="DataManager.archiveDataOlderThan(1095)">Archive data older than 3 years</button>
        </div>
      </div>
    `;
    
    const summaryElement = document.getElementById('dataSummaryContent');
    if (summaryElement) {
      summaryElement.innerHTML = archiveModal;
    }
  },

  async archiveDataOlderThan(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const confirmArchive = confirm(
      `Archive all data older than ${cutoffDate.toDateString()}?\n\n` +
      `This will export the old data and then delete it from the active database.`
    );
    
    if (!confirmArchive) return;

    try {
      Utils.debug(`Archiving data older than ${days} days...`);
      
      // First export the old data
      await this.exportOldData(cutoffDate);
      
      // Then delete it
      await this.deleteDataOlderThan(cutoffDate);
      
      UI.showSuccess('Data archived successfully!');
      setTimeout(() => {
        this.showDataManagement();
      }, 2000);
      
    } catch (error) {
      console.error("Error archiving data:", error);
      UI.showError('Failed to archive data: ' + error.message);
    }
  },

  async exportOldData(cutoffDate) {
    const oldData = {
      exportDate: new Date().toISOString(),
      cutoffDate: cutoffDate.toISOString(),
      timesheets: {},
      attendance: {}
    };

    // Get old timesheet data
    const timesheetsSnapshot = await get(ref(db, 'timesheets'));
    if (timesheetsSnapshot.exists()) {
      const timesheets = timesheetsSnapshot.val();
      
      for (const [employeeId, employeeTimesheets] of Object.entries(timesheets)) {
        if (employeeTimesheets && typeof employeeTimesheets === 'object') {
          const oldEntries = {};
          
          for (const [entryId, entry] of Object.entries(employeeTimesheets)) {
            if (entry.timestamp && new Date(entry.timestamp) < cutoffDate) {
              oldEntries[entryId] = entry;
            }
          }
          
          if (Object.keys(oldEntries).length > 0) {
            oldData.timesheets[employeeId] = oldEntries;
          }
        }
      }
    }

    // Get old attendance data
    const attendanceSnapshot = await get(ref(db, 'attendance'));
    if (attendanceSnapshot.exists()) {
      const attendance = attendanceSnapshot.val();
      
      for (const [employeeId, employeeAttendance] of Object.entries(attendance)) {
        if (employeeAttendance && typeof employeeAttendance === 'object') {
          const oldAttendance = {};
          
          for (const [dateString, status] of Object.entries(employeeAttendance)) {
            if (new Date(dateString) < cutoffDate) {
              oldAttendance[dateString] = status;
            }
          }
          
          if (Object.keys(oldAttendance).length > 0) {
            oldData.attendance[employeeId] = oldAttendance;
          }
        }
      }
    }

    // Download the archive
    const dataStr = JSON.stringify(oldData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `timesheet_archive_${cutoffDate.toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async deleteDataOlderThan(cutoffDate) {
    const timesheetsSnapshot = await get(ref(db, 'timesheets'));
    if (timesheetsSnapshot.exists()) {
      const timesheets = timesheetsSnapshot.val();
      
      for (const [employeeId, employeeTimesheets] of Object.entries(timesheets)) {
        if (employeeTimesheets && typeof employeeTimesheets === 'object') {
          for (const [entryId, entry] of Object.entries(employeeTimesheets)) {
            if (entry.timestamp && new Date(entry.timestamp) < cutoffDate) {
              await remove(ref(db, `timesheets/${employeeId}/${entryId}`));
            }
          }
        }
      }
    }

    // Delete old attendance data
    const attendanceSnapshot = await get(ref(db, 'attendance'));
    if (attendanceSnapshot.exists()) {
      const attendance = attendanceSnapshot.val();
      
      for (const [employeeId, employeeAttendance] of Object.entries(attendance)) {
        if (employeeAttendance && typeof employeeAttendance === 'object') {
          for (const [dateString, status] of Object.entries(employeeAttendance)) {
            if (new Date(dateString) < cutoffDate) {
              await remove(ref(db, `attendance/${employeeId}/${dateString}`));
            }
          }
        }
      }
    }
  },

  async cleanupOrphanedData() {
    try {
      Utils.debug("Cleaning up orphaned data...");
      UI.showSuccess('Cleaning up orphaned data... Please wait.');

      const employeesSnapshot = await get(ref(db, 'employees'));
      const activeEmployeeIds = employeesSnapshot.exists() ? 
        Object.keys(employeesSnapshot.val()) : [];

      let cleanedCount = 0;

      // Cleanup orphaned timesheet data
      const timesheetsSnapshot = await get(ref(db, 'timesheets'));
      if (timesheetsSnapshot.exists()) {
        const timesheets = timesheetsSnapshot.val();
        
        for (const employeeId of Object.keys(timesheets)) {
          if (!activeEmployeeIds.includes(employeeId)) {
            await remove(ref(db, `timesheets/${employeeId}`));
            cleanedCount++;
          }
        }
      }

      UI.showSuccess(`Cleanup completed! Removed ${cleanedCount} orphaned records.`);
      
      setTimeout(() => {
        this.showDataManagement();
      }, 2000);

    } catch (error) {
      console.error("Error cleaning up data:", error);
      UI.showError('Failed to cleanup data: ' + error.message);
    }
  }
};

// =============================================================================
// EXPORT & REPORTING
// =============================================================================

const Reports = {
  async exportToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = [
      "Date", "Employee Name", "Role", "Clock In", "Start Break", 
      "End Break", "Clock Out", "Regular Hours", "Overtime Hours", 
      "Break Hours", "Total Pay", "Attendance"
    ];
    csvContent += headers.join(",") + "\r\n";

    const rows = document.querySelectorAll('#timesheetTable tbody tr');
    rows.forEach(row => {
      const cols = row.querySelectorAll('td');
      const rowData = [];
      cols.forEach((col, index) => {
        // Skip the last column (action buttons)
        if (index < cols.length - 1) {
          rowData.push('"' + col.textContent.trim().replace(/"/g, '""') + '"');
        }
      });
      csvContent += rowData.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "timesheet.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async generatePayDaySheet() {
    const selectedEmployee = document.getElementById('employeeFilter').value;
    const selectedDate = new Date(document.getElementById('dateFilter').value + 'T12:00:00');
    const timeFrame = document.getElementById('timeFilter').value;

    try {
      const content = await this.generatePayDaySheetContent(selectedEmployee, selectedDate, timeFrame);

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Employee Pay Stub</title>
            <style>
              body { font-family: Arial, sans-serif; }
              table { border-collapse: collapse; width: 100%; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .close-button { 
                position: fixed; top: 10px; right: 10px; padding: 10px; 
                background-color: #f44336; color: white; border: none; cursor: pointer; 
              }
              .employee-section { margin-bottom: 30px; }
              h2, h3 { color: #333; }
            </style>
          </head>
          <body>
            <button class="close-button" onclick="window.close()">Close</button>
            ${content}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error("Error generating pay day sheet:", error);
      UI.showError('Failed to generate pay day sheet. Error: ' + error.message);
    }
  },

  async generatePayDaySheetContent(employeeId, date, timeFrame) {
    let content = '<h2>Pay Day Sheet</h2>';
    
    const selectedDate = date || new Date();
    const startDate = timeFrame === 'day' ? 
      selectedDate : 
      appState.currentWeekStart;
    
    const endDate = timeFrame === 'day' ? 
      selectedDate : 
      appState.getCurrentWeekEnd();

    content += `<p>Period: ${startDate.toDateString()} - ${endDate.toDateString()}</p>`;

    if (employeeId && appState.employees[employeeId]) {
      content += await this.generateEmployeePayDayContent(appState.employees[employeeId], startDate, endDate);
    } else {
      for (const [id, employee] of Object.entries(appState.employees)) {
        content += await this.generateEmployeePayDayContent(employee, startDate, endDate);
      }
    }

    return content;
  },

  async generateEmployeePayDayContent(employee, startDate, endDate) {
    const timesheetSnapshot = await get(ref(db, `timesheets/${employee.id}`));
    const timesheet = timesheetSnapshot.val() || {};

    let content = `
      <div class="employee-section">
        <h3>${employee.name} (${employee.id})</h3>
        <table>
          <tr>
            <th>Date</th><th>Clock In</th><th>Start Break</th><th>End Break</th>
            <th>Clock Out</th><th>Regular Hours</th><th>Overtime Hours</th>
            <th>Break Hours</th><th>Daily Pay</th>
          </tr>
    `;

    let totalRegularHours = 0;
    let totalOvertimeHours = 0;
    let totalBreakHours = 0;
    let totalPay = 0;

    for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
      const dailyEntries = Object.values(timesheet).filter(entry => 
        new Date(entry.timestamp).toDateString() === currentDate.toDateString()
      );

      const { totalBreakHours: dailyBreakHours, regularHours, overtimeHours, dailyPay } = 
        Timesheet.calculateDailyHours(dailyEntries, employee.payRate);

      totalRegularHours += regularHours;
      totalOvertimeHours += overtimeHours;
      totalBreakHours += dailyBreakHours;
      totalPay += dailyPay;

      content += `
        <tr>
          <td>${currentDate.toDateString()}</td>
          <td>${Utils.formatTime(dailyEntries.find(entry => entry.type === 'clockin')?.timestamp)}</td>
          <td>${Utils.formatTime(dailyEntries.find(entry => entry.type === 'startbreak')?.timestamp)}</td>
          <td>${Utils.formatTime(dailyEntries.find(entry => entry.type === 'endbreak')?.timestamp)}</td>
          <td>${Utils.formatTime(dailyEntries.find(entry => entry.type === 'clockout')?.timestamp)}</td>
          <td>${regularHours.toFixed(2)}</td>
          <td>${overtimeHours.toFixed(2)}</td>
          <td>${dailyBreakHours.toFixed(2)}</td>
          <td>${dailyPay.toFixed(2)}</td>
        </tr>
      `;
    }

    content += `
          <tr style="background-color: #f9f9f9; font-weight: bold;">
            <th colspan="5">Totals</th>
            <th>${totalRegularHours.toFixed(2)}</th>
            <th>${totalOvertimeHours.toFixed(2)}</th>
            <th>${totalBreakHours.toFixed(2)}</th>
            <th>${totalPay.toFixed(2)}</th>
          </tr>
        </table>
      </div>
    `;

    return content;
  },

  async displayTodayWorkSummary() {
    const summaryElement = document.getElementById('todayWorkSummary');
    if (!summaryElement) return;

    const today = new Date();
    let totalHours = 0;
    let totalEmployees = 0;

    for (const [id, employee] of Object.entries(appState.employees)) {
      const timesheetSnapshot = await get(ref(db, `timesheets/${id}`));
      const timesheet = timesheetSnapshot.val() || {};
      const todayEntries = Object.values(timesheet).filter(entry => 
        new Date(entry.timestamp).toDateString() === today.toDateString()
      );
      
      if (todayEntries.length > 0) {
        totalEmployees++;
        const { totalWorkHours } = Timesheet.calculateDailyHours(todayEntries, employee.payRate);
        totalHours += totalWorkHours;
      }
    }

    summaryElement.textContent = `Today: ${totalEmployees} employees worked, Total: ${totalHours.toFixed(2)} hours`;
  }
};

// =============================================================================
// EVENT LISTENERS & SETUP - FIXED
// =============================================================================

const EventHandlers = {
  setupEventListeners() {
    const elements = {
      addEmployeeButton: { id: 'addEmployeeButton', event: 'click', handler: () => UI.showModal('addEmployeeModal') },
      addEmployeeSubmit: { id: 'addEmployeeSubmit', event: 'click', handler: () => Employees.addEmployee() },
      dateFilter: { id: 'dateFilter', event: 'change', handler: this.handleDateFilterChange },
      employeeFilter: { id: 'employeeFilter', event: 'change', handler: () => Timesheet.displayTimesheet() },
      timeFilter: { id: 'timeFilter', event: 'change', handler: this.handleTimeFilterChange }, // FIXED
      exportCSVButton: { id: 'exportCSVButton', event: 'click', handler: () => Reports.exportToCSV() },
      generatePayDaySheetButton: { id: 'generatePayDaySheetButton', event: 'click', handler: () => Reports.generatePayDaySheet() },
      prevWeekButton: { id: 'prevWeekButton', event: 'click', handler: () => Calendar.changeWeek(-1) },
      nextWeekButton: { id: 'nextWeekButton', event: 'click', handler: () => Calendar.changeWeek(1) },
      
      // New date navigation elements
      yearSelect: { id: 'yearSelect', event: 'change', handler: () => Calendar.onYearMonthChange() },
      monthSelect: { id: 'monthSelect', event: 'change', handler: () => Calendar.onYearMonthChange() },
      jumpToTodayBtn: { id: 'jumpToTodayBtn', event: 'click', handler: () => Calendar.jumpToToday() },
      
      // Data management elements
      dataManagementBtn: { id: 'dataManagementBtn', event: 'click', handler: () => DataManager.showDataManagement() }
    };

    for (const [key, { id, event, handler }] of Object.entries(elements)) {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener(event, handler);
      } else {
        console.warn(`Element not found: ${id}. This may not be an error if the element is not needed in the current view.`);
      }
    }

    // Setup modal close listeners
    this.setupModalCloseListeners();

    // Setup keyboard event listeners
    this.setupKeyboardListeners();
  },

  handleDateFilterChange() {
    const selectedDate = new Date(document.getElementById('dateFilter').value + 'T12:00:00');
    appState.setCurrentWeekStart(selectedDate);
    
    // Update year/month selectors to match
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    
    if (yearSelect) yearSelect.value = selectedDate.getFullYear();
    if (monthSelect) monthSelect.value = selectedDate.getMonth();
    
    Timesheet.displayTimesheet();
    Calendar.updateCalendar();
  },

  // FIXED: New handler for timeFilter changes
  handleTimeFilterChange() {
    const timeFilter = document.getElementById('timeFilter');
    if (timeFilter) {
      const selectedView = timeFilter.value;
      Utils.debug(`Time filter changed to: ${selectedView}`);
      
      // Immediately update the timesheet with the new view
      Timesheet.displayTimesheet();
      
      // Don't update calendar for day view to avoid confusion
      if (selectedView === 'week') {
        Calendar.updateCalendar();
      }
    }
  },

  setupModalCloseListeners() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          modal.style.display = 'none';
        }
      });

      const closeButton = modal.querySelector('.close');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          modal.style.display = 'none';
        });
      }
    });
  },

  setupKeyboardListeners() {
    // Enter key listeners for form inputs
    const enterKeyElements = [
      { id: 'addEmployeeName', handler: () => Employees.addEmployee() },
      { id: 'passwordInput', handler: () => App.checkPassword() }
    ];

    enterKeyElements.forEach(({ id, handler }) => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            handler();
          }
        });
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + T = Jump to today
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        Calendar.jumpToToday();
      }
      
      // Arrow keys for week navigation (when not in input field)
      if (!e.target.matches('input, textarea, select')) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          Calendar.changeWeek(-1);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          Calendar.changeWeek(1);
        }
      }
      
      // FIXED: D key to toggle Day view, W key to toggle Week view
      if (!e.target.matches('input, textarea, select')) {
        if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          const timeFilter = document.getElementById('timeFilter');
          if (timeFilter) {
            timeFilter.value = 'day';
            this.handleTimeFilterChange();
          }
        }
        if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          const timeFilter = document.getElementById('timeFilter');
          if (timeFilter) {
            timeFilter.value = 'week';
            this.handleTimeFilterChange();
          }
        }
      }
    });
  },

  addTouchEvents() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      button.addEventListener('touchstart', function(e) {
        e.preventDefault();
        this.click();
      });
    });

    const editableCells = document.querySelectorAll('.editable');
    editableCells.forEach(cell => {
      cell.addEventListener('touchstart', function(e) {
        e.preventDefault();
        this.click();
      });
    });
  }
};

// =============================================================================
// MAIN APPLICATION CONTROLLER
// =============================================================================

const App = {
  async initialize() {
    Utils.debug("Initializing app...");
    try {
      await Settings.loadSettings();
      await Employees.loadEmployees();
      
      // Set initial date and week
      Calendar.setDateToToday();
      
      // Initialize date navigation dropdowns
      Calendar.populateYearDropdown();
      Calendar.populateMonthDropdown();
      
      // Start periodic updates
      setInterval(UI.updateDateTime, 1000);
      
      // Update UI
      await this.updateUI();
      
      // Setup event listeners
      EventHandlers.setupEventListeners();
      
      // Start real-time clock
      this.startRealTimeClock();
      
      // Display today's work summary
      await Reports.displayTodayWorkSummary();
      
      Utils.debug("App initialization complete.");
    } catch (error) {
      console.error("Error during app initialization:", error);
      UI.showError("An error occurred while initializing the app. Please check the console and try again.");
    }
  },

  async updateUI() {
    try {
      await Timesheet.displayTimesheet();
      Calendar.updateCalendar();
      EventHandlers.addTouchEvents();
    } catch (error) {
      console.error("Error updating UI:", error);
      UI.showError('Failed to update UI. Please refresh the page.');
    }
  },

  startRealTimeClock() {
    const clockElement = document.getElementById('realTimeClock');
    if (clockElement) {
      setInterval(() => {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString();
      }, 1000);
    }
  },

  async checkPassword() {
    Utils.debug("checkPassword function called");
    const passwordInput = document.getElementById('passwordInput');
    if (!passwordInput) {
      console.error("Password input element not found");
      return;
    }
    
    const pin = passwordInput.value;
    Utils.debug("Entered PIN:", pin);
    
    if (pin === appState.settings.adminPIN) {
      Utils.debug("PIN correct, hiding password modal");
      UI.hideModal('passwordModal');
      this.showOverview();
    } else {
      Utils.debug("Incorrect PIN");
      UI.showError('Incorrect PIN. Please try again.');
    }
  },

  async showOverview() {
    Utils.debug("showOverview function called");
    try {
      Calendar.setDateToToday();
      UI.showContent('overviewContent');
      this.closeNav();
      await Timesheet.displayTimesheet();
      Calendar.updateCalendar();
      Utils.debug('Overview displayed successfully');
    } catch (error) {
      console.error('Error displaying overview:', error);
      UI.showError('Failed to display overview. Please try again.');
    }
  },

  showDashboard() {
    UI.showContent('dashboardContent');
    this.closeNav();
  },

  showEmployeeManagement() {
    UI.showContent('employeeManagementContent');
    this.closeNav();
  },

  showPasswordModal() {
    UI.showModal('passwordModal');
    this.closeNav();
  },

  showSettings() {
    UI.showContent('settingsContent');
    this.closeNav();
  },

  showDataManagement() {
    DataManager.showDataManagement();
    this.closeNav();
  },

  openNav() {
    const nav = document.getElementById("myNav");
    if (nav) {
      nav.style.width = "100%";
    } else {
      console.error("Navigation element not found");
    }
  },

  closeNav() {
    const nav = document.getElementById("myNav");
    if (nav) {
      nav.style.width = "0%";
    } else {
      console.error("Navigation element not found");
    }
  }
};

// =============================================================================
// GLOBAL WINDOW FUNCTIONS (for HTML onclick handlers)
// =============================================================================

// Navigation functions
window.openNav = () => App.openNav();
window.closeNav = () => App.closeNav();

// Main view functions
window.checkPassword = () => App.checkPassword();
window.showOverview = () => App.showOverview();
window.showDashboard = () => App.showDashboard();
window.showEmployeeManagement = () => App.showEmployeeManagement();
window.showPasswordModal = () => App.showPasswordModal();
window.showSettings = () => App.showSettings();
window.showDataManagement = () => App.showDataManagement();

// Modal close functions
window.closeAddEmployeeModal = () => UI.hideModal('addEmployeeModal');
window.closePasswordModal = () => UI.hideModal('passwordModal');
window.closeEditEmployeeModal = () => UI.hideModal('editEmployeeModal');
window.closeEditTimesheetModal = () => UI.hideModal('editTimesheetModal');
window.closeEmailModal = () => UI.hideModal('emailModal');
window.closeErrorModal = () => UI.hideModal('errorModal');
window.closeDetailedViewModal = () => UI.hideModal('detailedViewModal');
window.closeDataManagementModal = () => UI.hideModal('dataManagementModal');
window.closeClockInModal = () => UI.hideModal('clockInModal');

// Employee management functions
window.showAddEmployeeModal = () => UI.showModal('addEmployeeModal');
window.addEmployee = () => Employees.addEmployee();
window.editEmployee = (id) => Employees.editEmployee(id);
window.saveEmployeeChanges = () => Employees.saveEmployeeChanges();

// Settings functions
window.saveSettings = () => Settings.saveSettings();
window.resetSettings = () => Settings.resetSettings();

// Export functions
window.exportToCSV = () => Reports.exportToCSV();
window.generatePayDaySheet = () => Reports.generatePayDaySheet();

// Data management functions
window.DataManager = DataManager; // Expose the entire DataManager object for onclick handlers

// Calendar functions
window.jumpToToday = () => Calendar.jumpToToday();

// =============================================================================
// APPLICATION STARTUP
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  App.initialize();
});

console.log("Timesheet application loaded successfully");
