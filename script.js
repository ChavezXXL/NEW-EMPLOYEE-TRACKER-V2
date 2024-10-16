// Register the service worker for PWA functionality
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

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, push, remove, update } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

// Your web app's Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

console.log("Firebase initialized");

// Debugging function
function debug(message) {
  console.log(`[DEBUG] ${message}`);
}

// Global variables
let activeEmployeeId = null;
let currentInterval = null;
let performanceChart = null;

// Main function to initialize everything
async function initializeTimesheetApp() {
  debug("Initializing app...");
  try {
    await ensureSettingsLoaded();
    await loadEmployees();
    await loadSettings();
    setInterval(updateDateTime, 1000);
    await updateUI();
    setupEventListeners();
    setupModalCloseListeners();
    startRealTimeClock();
    displayTodayWorkSummary();
    debug("App initialization complete.");
  } catch (error) {
    console.error("Error during app initialization:", error);
    showError("An error occurred while initializing the app. Please check the console and try again.");
  }
}

// Function to show the add employee modal
function showAddEmployeeModal() {
  const addEmployeeModal = document.getElementById('addEmployeeModal');
  if (addEmployeeModal) {
    addEmployeeModal.style.display = 'flex';
  } else {
    console.error("Add employee modal not found");
  }
}

// Setup event listeners
function setupEventListeners() {
  const elements = {
    addEmployeeButton: { id: 'addEmployeeButton', event: 'click', handler: showAddEmployeeModal },
    addEmployeeSubmit: { id: 'addEmployeeSubmit', event: 'click', handler: addEmployee },
    dateFilter: { id: 'dateFilter', event: 'change', handler: displayTimesheet },
    employeeFilter: { id: 'employeeFilter', event: 'change', handler: displayTimesheet },
    timeFilter: { id: 'timeFilter', event: 'change', handler: displayTimesheet },
    exportCSVButton: { id: 'exportCSVButton', event: 'click', handler: exportToCSV },
    sendEmailButton: { id: 'sendEmailButton', event: 'click', handler: sendWeeklyEmail },
    generatePayDaySheetButton: { id: 'generatePayDaySheetButton', event: 'click', handler: generatePayDaySheet },
    prevWeekButton: { id: 'prevWeekButton', event: 'click', handler: () => changeWeek(-1) },
nextWeekButton: { id: 'nextWeekButton', event: 'click', handler: () => changeWeek(1) }
  };

  for (const [key, { id, event, handler }] of Object.entries(elements)) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
    } else {
      console.warn(`Element not found: ${id}. This may not be an error if the element is not needed in the current view.`);
    }
  }
}

// Firebase data operations
async function addEmployee() {
  try {
    const name = document.getElementById('addEmployeeName').value;
    const id = document.getElementById('addEmployeeId').value;
    const payRate = document.getElementById('addEmployeePayRate').value;
    const role = document.getElementById('addEmployeeRole').value;

    if (name && id && payRate && role) {
      const employeeRef = ref(db, 'employees/' + id);
      await set(employeeRef, { name, id, payRate: parseFloat(payRate), role });
      await set(ref(db, 'timesheets/' + id), {});
      await set(ref(db, 'timers/' + id), { mainTime: 0, breakTime: 0, startTime: null, breakStartTime: null, isRunning: false, isOnBreak: false });
      await loadEmployees();
      document.getElementById('addEmployeeModal').style.display = 'none';
    } else {
      showError('Please fill out all fields.');
    }
  } catch (error) {
    console.error("Error adding employee:", error);
    showError('Failed to add employee. Please try again.');
  }
}

async function loadEmployees() {
  try {
    debug("Loading employees...");
    const employeesRef = ref(db, 'employees');
    const snapshot = await get(employeesRef);
    if (snapshot.exists()) {
      const employees = snapshot.val();
      debug("Employees loaded:", employees);
      updateEmployeeList(employees);
      updateEmployeeManagementList(employees);
      updateEmployeeFilter(employees);
    } else {
      debug("No employees found");
    }
  } catch (error) {
    console.error("Error loading employees:", error);
    showError(`Failed to load employees. Error: ${error.message}`);
  }
}

async function updateEmployee(id, name, role, payRate) {
  try {
    const employeeRef = ref(db, 'employees/' + id);
    await update(employeeRef, { name, role, payRate: parseFloat(payRate) });
    await loadEmployees();
  } catch (error) {
    console.error("Error updating employee:", error);
    showError('Failed to update employee. Please try again.');
  }
}

async function deleteEmployee(id) {
  try {
    if (confirm('Are you sure you want to delete this employee?')) {
      await remove(ref(db, 'employees/' + id));
      await remove(ref(db, 'timesheets/' + id));
      await remove(ref(db, 'timers/' + id));
      await loadEmployees();
    }
  } catch (error) {
    console.error("Error deleting employee:", error);
    showError('Failed to delete employee. Please try again.');
  }
}

async function loadSettings() {
  try {
    const settingsRef = ref(db, 'settings');
    const snapshot = await get(settingsRef);
    if (snapshot.exists()) {
      const settings = snapshot.val();
      applySettingsToUI(settings);
    } else {
      const defaultSettings = getDefaultSettings();
      await set(settingsRef, defaultSettings);
      applySettingsToUI(defaultSettings);
    }
  } catch (error) {
    console.error("Error loading settings:", error);
    showError('Failed to load settings. Please try again.');
  }
}

function applySettingsToUI(settings) {
  const elements = ['companyName', 'companyAddress', 'adminPIN', 'businessStartTime', 'businessEndTime', 'overtimeThreshold', 'overtimeMultiplier', 'minimumBreakDuration', 'maximumBreakDuration'];
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.value = settings[id];
    } else {
      console.error(`Settings element not found: ${id}`);
    }
  });
}

function getDefaultSettings() {
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
}

async function saveSettings() {
  debug("Saving settings...");
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
      timeZone: document.getElementById('timeZone').value,
      payrollFrequency: document.getElementById('payrollFrequency').value,
      enableNotifications: document.getElementById('enableNotifications').checked,
      notificationEmail: document.getElementById('notificationEmail').value,
      exportFormat: document.getElementById('exportFormat').value,
      language: document.getElementById('language').value
    };

    const settingsRef = ref(db, 'settings');
    await set(settingsRef, newSettings);
    showSuccess('Settings saved successfully.');
    debug("Settings saved successfully");
  } catch (error) {
    console.error("Error saving settings:", error);
    showError('Failed to save settings. Error: ' + error.message);
  }
}

async function logTimesheet(id, type) {
  try {
    const timestamp = Date.now();
    const timesheetRef = ref(db, 'timesheets/' + id);
    await push(timesheetRef, { type, timestamp });
  } catch (error) {
    console.error("Error logging timesheet:", error);
    showError('Failed to log timesheet entry. Please try again.');
  }
}

async function updateTimesheetEntry(id, type, dateString, time) {
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
    showError('Failed to update timesheet entry. Please try again.');
  }
}

// UI update functions
function updateEmployeeList(employees) {
  const employeeList = document.getElementById('employees');
  if (!employeeList) {
    console.error("Employee list element not found");
    return;
  }
  employeeList.innerHTML = '';
  Object.values(employees).forEach(employee => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${employee.name}</span>`;
    li.addEventListener('click', () => showClockInModal(employee));
    employeeList.appendChild(li);
  });
}

function updateEmployeeManagementList(employees) {
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

  addEmployeeManagementListeners();
}

function addEmployeeManagementListeners() {
  document.querySelectorAll('.edit-button').forEach(button => {
    button.addEventListener('click', () => editEmployee(button.getAttribute('data-id')));
  });
  document.querySelectorAll('.delete-button').forEach(button => {
    button.addEventListener('click', () => deleteEmployee(button.getAttribute('data-id')));
  });
}

function updateEmployeeFilter(employees) {
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
}

async function updateUI() {
  try {
    await displayTimesheet();
    updateCalendar();
    addTouchEvents();
  } catch (error) {
    console.error("Error updating UI:", error);
    showError('Failed to update UI. Please refresh the page.');
  }
}

function updateDateTime() {
  const now = new Date();
  const currentDateElement = document.getElementById('currentDate');
  const currentTimeElement = document.getElementById('currentTime');
  if (currentDateElement) {
    currentDateElement.textContent = now.toDateString();
  }
  if (currentTimeElement) {
    currentTimeElement.textContent = now.toLocaleTimeString();
  }
}

function setDateToToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateFilter = document.getElementById('dateFilter');
  if (dateFilter) {
    dateFilter.value = `${year}-${month}-${day}`;
    dateFilter.addEventListener('change', () => {
      displayTimesheet();
      updateCalendar();
    });
  }
}

// Modal Close Listeners
function setupModalCloseListeners() {
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
}
  
  // Ensure settings are loaded
  async function ensureSettingsLoaded() {
    const settingsRef = ref(db, 'settings');
    const snapshot = await get(settingsRef);
    if (!snapshot.exists()) {
      const defaultSettings = getDefaultSettings();
      await set(settingsRef, defaultSettings);
    }
  }
  
  // Clock in/out and break functions
  async function showClockInModal(employee) {
    const { id } = employee;
    activeEmployeeId = id;
  
    document.getElementById('employeeNameModal').textContent = `${employee.name} (${employee.id})`;
    document.getElementById('clockInModal').style.display = 'flex';
  
    const timerRef = ref(db, 'timers/' + id);
    const snapshot = await get(timerRef);
    const timer = snapshot.val() || { mainTime: 0, breakTime: 0, isRunning: false, isOnBreak: false };
  
    // Reset the timer display
    updateTimer(document.getElementById('timer'), 0);
    
    if (timer.isRunning) {
      startMainInterval(id);
      document.querySelector('.clock-circle').classList.add('red');
      document.getElementById('clockInText').textContent = 'Clock Out';
      document.getElementById('breakButton').style.display = 'block';
      document.getElementById('breakButton').textContent = 'Start Break';
    } else if (timer.isOnBreak) {
      startBreakInterval(id);
      document.getElementById('breakButton').textContent = 'End Break';
      document.getElementById('breakButton').style.display = 'block';
    } else {
      clearInterval(currentInterval);
      document.getElementById('breakButton').style.display = 'none';
      document.querySelector('.clock-circle').classList.remove('red');
      document.getElementById('clockInText').textContent = 'Clock In';
    }
  
    document.querySelector('.clock-circle').onclick = () => handleClockClick(id);
    document.getElementById('breakButton').onclick = () => handleBreakClick(id);
  }
  
  async function handleClockClick(id) {
    const timerRef = ref(db, 'timers/' + id);
    const snapshot = await get(timerRef);
    const timer = snapshot.val();
  
    if (!timer.isRunning && !timer.isOnBreak) {
      // Clock In
      await update(timerRef, { startTime: Date.now(), isRunning: true });
      logTimesheet(id, 'clockin');
      startMainInterval(id);
      document.getElementById('breakButton').style.display = 'block';
      document.querySelector('.clock-circle').classList.add('red');
      document.getElementById('clockInText').textContent = 'Clock Out';
    } else if (timer.isRunning && !timer.isOnBreak) {
      // Clock Out
      await stopActiveEmployeeTimer(id);
      logTimesheet(id, 'clockout');
      resetTimer(id);
      document.getElementById('breakButton').style.display = 'none';
      document.querySelector('.clock-circle').classList.remove('red');
      document.getElementById('clockInText').textContent = 'Clock In';
      loadEmployees();
      displayTimesheet();
    } else if (timer.isOnBreak) {
      // Prevent clock out when on break
      showError('Cannot clock out while on break. Please end the break first.');
      return;
    }
    document.getElementById('clockInModal').style.display = 'none';
  }
  
  async function handleBreakClick(id) {
    const timerRef = ref(db, 'timers/' + id);
    const snapshot = await get(timerRef);
    const timer = snapshot.val();
  
    if (!timer.isOnBreak) {
      // Start Break
      const mainTime = timer.mainTime + Math.floor((Date.now() - timer.startTime) / 1000);
      await update(timerRef, { mainTime, breakStartTime: Date.now(), isRunning: false, isOnBreak: true });
      logTimesheet(id, 'startbreak');
      document.getElementById('breakButton').textContent = 'End Break';
      startBreakInterval(id);
    } else {
      // End Break
      const breakDuration = Math.floor((Date.now() - timer.breakStartTime) / 60000); // in minutes
      const settings = (await get(ref(db, 'settings'))).val();
      if (breakDuration < settings.minimumBreakDuration) {
        showError(`Break must be at least ${settings.minimumBreakDuration} minutes.`);
        return;
      }
      if (breakDuration > settings.maximumBreakDuration) {
        showError(`Break cannot exceed ${settings.maximumBreakDuration} minutes.`);
        return;
      }
      const breakTime = timer.breakTime + Math.floor((Date.now() - timer.breakStartTime) / 1000);
      await update(timerRef, { breakTime, startTime: Date.now(), isRunning: true, isOnBreak: false });
      logTimesheet(id, 'endbreak');
      document.getElementById('breakButton').textContent = 'Start Break';
      startMainInterval(id);
    }
    document.getElementById('clockInModal').style.display = 'none';
  }
  
  function startMainInterval(id) {
    clearInterval(currentInterval);
    currentInterval = setInterval(async () => {
      const timerRef = ref(db, 'timers/' + id);
      const snapshot = await get(timerRef);
      const timer = snapshot.val();
      const duration = Math.floor((Date.now() - timer.startTime) / 1000);
      updateTimer(document.getElementById('timer'), timer.mainTime + duration);
    }, 1000);
  }
  
  function startBreakInterval(id) {
    clearInterval(currentInterval);
    currentInterval = setInterval(async () => {
      const timerRef = ref(db, 'timers/' + id);
      const snapshot = await get(timerRef);
      const timer = snapshot.val();
      const duration = Math.floor((Date.now() - timer.breakStartTime) / 1000);
      updateTimer(document.getElementById('timer'), timer.breakTime + duration);
    }, 1000);
  }
  
  async function stopActiveEmployeeTimer(id) {
    const timerRef = ref(db, 'timers/' + id);
    const snapshot = await get(timerRef);
    const timer = snapshot.val();
    if (timer.isRunning) {
      const mainTime = timer.mainTime + Math.floor((Date.now() - timer.startTime) / 1000);
      await update(timerRef, { mainTime, isRunning: false });
    } else if (timer.isOnBreak) {
      const breakTime = timer.breakTime + Math.floor((Date.now() - timer.breakStartTime) / 1000);
      await update(timerRef, { breakTime, isOnBreak: false });
    }
    clearInterval(currentInterval);
  }
  
  async function resetTimer(id) {
    const timerRef = ref(db, 'timers/' + id);
    await set(timerRef, { mainTime: 0, breakTime: 0, startTime: null, breakStartTime: null, isRunning: false, isOnBreak: false });
  }
  
  function updateTimer(element, time) {
    if (element) {
      element.textContent = formatTotalTime(time);
    } else {
      console.error("Timer element not found");
    }
  }
  
  function formatTotalTime(totalTime) {
    const hours = String(Math.floor(totalTime / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalTime % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalTime % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  
  function showError(message) {
    const errorMessageElement = document.getElementById('errorMessage');
    if (errorMessageElement) {
      errorMessageElement.textContent = message;
      document.getElementById('errorModal').style.display = 'flex';
    } else {
      console.error("Error message element not found:", message);
    }
  }
  
  function showSuccess(message) {
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
  }
  
  // Add a function to display today's work summary
  async function displayTodayWorkSummary() {
    const summaryElement = document.getElementById('todayWorkSummary');
    if (summaryElement) {
      const today = new Date();
      const employeesSnapshot = await get(ref(db, 'employees'));
      const employees = employeesSnapshot.val();
      let totalHours = 0;
      let totalEmployees = 0;
  
      for (const [id, employee] of Object.entries(employees)) {
        const timesheetSnapshot = await get(ref(db, `timesheets/${id}`));
        const timesheet = timesheetSnapshot.val() || {};
        const todayEntries = Object.values(timesheet).filter(entry => 
          new Date(entry.timestamp).toDateString() === today.toDateString()
        );
        if (todayEntries.length > 0) {
          totalEmployees++;
          const { totalWorkHours } = calculateDailyHours(todayEntries, employee.payRate, await getSettings());
          totalHours += totalWorkHours;
        }
      }
  
      summaryElement.textContent = `Today: ${totalEmployees} employees worked, Total: ${totalHours.toFixed(2)} hours`;
    }
  }
  
  // Add a real-time clock function
  function startRealTimeClock() {
    const clockElement = document.getElementById('realTimeClock');
    if (clockElement) {
      setInterval(() => {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString();
      }, 1000);
    }
  }
  
  // Timesheet display and related functions
  async function displayTimesheet() {
    debug("displayTimesheet function called");
    try {
      const selectedDate = new Date(document.getElementById('dateFilter').value + ' 00:00:00');
      const selectedEmployee = document.getElementById('employeeFilter').value;
      const timesheetTableBody = document.querySelector('#timesheetTable tbody');
      
      if (!timesheetTableBody) {
        throw new Error("Timesheet table body not found");
      }
  
      timesheetTableBody.innerHTML = '<tr><td colspan="13">Loading...</td></tr>';
  
      const employeesSnapshot = await get(ref(db, 'employees'));
      const employees = employeesSnapshot.val();
      const filteredEmployees = selectedEmployee ? { [selectedEmployee]: employees[selectedEmployee] } : employees;
  
      const settingsSnapshot = await get(ref(db, 'settings'));
      const settings = settingsSnapshot.val();
  
      const timeFrame = document.getElementById('timeFilter').value;
      const dates = timeFrame === 'day' ? [selectedDate] : getWeekDates(selectedDate);
  
      const fragment = document.createDocumentFragment();
  
      for (const date of dates) {
        for (const [id, employee] of Object.entries(filteredEmployees)) {
          const timesheetSnapshot = await get(ref(db, `timesheets/${id}`));
          const timesheet = timesheetSnapshot.val() || {};
          const dailyEntries = Object.values(timesheet).filter(entry => 
            new Date(entry.timestamp).toDateString() === date.toDateString()
          );
          const row = await renderTimesheetRow(employee, dailyEntries, date, settings);
          fragment.appendChild(row);
        }
      }
  
      timesheetTableBody.innerHTML = '';
      timesheetTableBody.appendChild(fragment);
  
      addAttendanceButtonListeners();
      addEditableCellListeners();
      checkForIncompleteTimesheets();
  
      debug("Timesheet displayed successfully");
    } catch (error) {
      console.error("Error displaying timesheet:", error);
      showError('Failed to display timesheet. Error: ' + error.message);
    }
  }
  
  async function renderTimesheetRow(employee, timesheet, date, settings) {
    const { totalWorkHours, totalBreakHours, regularHours, overtimeHours, dailyPay } = calculateDailyHours(timesheet, employee.payRate, settings);
  
    // Attendance status
    const attendanceSnapshot = await get(ref(db, `attendance/${employee.id}/${date.toDateString()}`));
    const attendanceStatus = attendanceSnapshot.val() || '';
  
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${date.toDateString()}</td>
      <td>${employee.name}</td>
      <td>${employee.role}</td>
      <td class="editable" data-type="clockin" data-id="${employee.id}" data-date="${date.toDateString()}">${formatTime(timesheet.find(entry => entry.type === 'clockin')?.timestamp)}</td>
      <td class="editable" data-type="startbreak" data-id="${employee.id}" data-date="${date.toDateString()}">${formatTime(timesheet.find(entry => entry.type === 'startbreak')?.timestamp)}</td>
      <td class="editable" data-type="endbreak" data-id="${employee.id}" data-date="${date.toDateString()}">${formatTime(timesheet.find(entry => entry.type === 'endbreak')?.timestamp)}</td>
      <td class="editable" data-type="clockout" data-id="${employee.id}" data-date="${date.toDateString()}">${formatTime(timesheet.find(entry => entry.type === 'clockout')?.timestamp)}</td>
      <td>${regularHours.toFixed(2)}</td>
      <td>${overtimeHours.toFixed(2)}</td>
      <td>${totalBreakHours.toFixed(2)}</td>
      <td>$${dailyPay.toFixed(2)}</td>
      <td>${attendanceStatus}</td>
      <td>
        <button class="attendance-button" data-id="${employee.id}" data-date="${date.toDateString()}" data-status="Called Out">Called Out</button>
        <button class="attendance-button" data-id="${employee.id}" data-date="${date.toDateString()}" data-status="No Show">No Show</button>
      </td>
    `;
    return row;
  }
  
  function formatTime(timestamp) {
    return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  }
  
  function addAttendanceButtonListeners() {
    document.querySelectorAll('.attendance-button').forEach(button => {
      button.addEventListener('click', async function() {
        const id = button.getAttribute('data-id');
        const date = button.getAttribute('data-date');
        const status = button.getAttribute('data-status');
        await set(ref(db, `attendance/${id}/${date}`), status);
        displayTimesheet();
      });
    });
  }
  
  function addEditableCellListeners() {
    document.querySelectorAll('.editable').forEach(cell => {
      cell.addEventListener('click', function () {
        const currentValue = cell.textContent;
        const input = document.createElement('input');
        input.type = 'time';
        input.value = convertTo24HourFormat(currentValue);
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
            saveInlineEdit(cell.getAttribute('data-id'), cell.getAttribute('data-type'), cell.getAttribute('data-date'), newValue);
          }
          cell.textContent = formatTime(convertTimeToTimestamp(newValue));
        });
      });
    });
  }
  
  function convertTo24HourFormat(timeString) {
    if (!timeString) return '';
    const date = new Date(`1970-01-01T${timeString}`);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  function convertTimeToTimestamp(time) {
    if (!time) return null;
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours));
    date.setMinutes(parseInt(minutes));
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date.getTime();
  }
  
  async function saveInlineEdit(id, type, dateString, time) {
    await updateTimesheetEntry(id, type, dateString, time);
    displayTimesheet();
  }
  
  async function checkForIncompleteTimesheets() {
    let incompleteEntries = new Set();
    const selectedDate = new Date(document.getElementById('dateFilter').value + ' 00:00:00');
    const employeesSnapshot = await get(ref(db, 'employees'));
    const employees = employeesSnapshot.val();
  
    for (const [id, employee] of Object.entries(employees)) {
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
      const warningElement = document.createElement('div');
      warningElement.className = 'warning-message';
      warningElement.textContent = `Warning: Incomplete timesheets for: ${Array.from(incompleteEntries).join(', ')}`;
      overviewContent.prepend(warningElement);
    }
  }

  function getMonday(d) {
    const day = d.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
    const diff = day === 0 ? -6 : 1 - day; // Adjust when day is Sunday
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff, 12, 0, 0);
  }
  
  // Updated changeWeek function
  function changeWeek(direction) {
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
      const currentDate = new Date(dateFilter.value + 'T12:00:00');
      
      // Move exactly 7 days in the specified direction
      const targetDate = new Date(currentDate);
      targetDate.setDate(currentDate.getDate() + (direction * 7));
      
      // Set the date filter to the target date
      dateFilter.value = targetDate.toISOString().split('T')[0];
      
      updateCalendar();
      displayTimesheet();
    } else {
      console.error("Date filter element not found");
    }
  }

  // Export and email functions
  async function exportToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Date", "Employee Name", "Role", "Clock In", "Start Break", "End Break", "Clock Out", "Regular Hours", "Overtime Hours", "Break Hours", "Total Pay", "Attendance"];
    csvContent += headers.join(",") + "\r\n";
  
    const rows = document.querySelectorAll('#timesheetTable tbody tr');
    rows.forEach(row => {
      const cols = row.querySelectorAll('td');
      const rowData = [];
      cols.forEach(col => {
        rowData.push('"' + col.textContent.trim().replace(/"/g, '""') + '"');
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
  }
  
  async function sendWeeklyEmail() {
    const emailAddressInput = document.getElementById('emailAddress');
    const email = emailAddressInput ? emailAddressInput.value : '';
    const defaultEmail = 'scprecisiondeburring@gmail.com';
    
    if (!email && !defaultEmail) {
      showError('Please enter a valid email address.');
      return;
    }
  
    // Prepare the email content
    const templateParams = {
      to_email: email || defaultEmail,
      message_html: await generateEmailContent()
    };
  
    // Send email using EmailJS
    emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', templateParams)
      .then(function(response) {
        alert('Weekly timesheet sent successfully.');
        const emailModal = document.getElementById('emailModal');
        if (emailModal) {
          emailModal.style.display = 'none';
        }
      }, function(error) {
        showError('Failed to send email. Please check your EmailJS configuration and try again.');
        console.error('EmailJS Error:', error);
      });
  }
  
  async function generateEmailContent() {
    const selectedDate = new Date(document.getElementById('dateFilter').value);
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = selectedDate.getDay();
    const dayDiff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    startOfWeek.setDate(selectedDate.getDate() + dayDiff);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
  
    const weekRange = `${startOfWeek.toDateString()} - ${endOfWeek.toDateString()}`;
  
    let content = `<h1>Weekly Timesheet</h1>
    <p>Week: ${weekRange}</p>
    <table border="1">
      <thead>
        <tr>
          <th>Date</th>
          <th>Employee Name</th>
          <th>Regular Hours</th>
          <th>Overtime Hours</th>
          <th>Total Pay</th>
        </tr>
      </thead>
      <tbody>`;
  
    const employeesSnapshot = await get(ref(db, 'employees'));
    const employees = employeesSnapshot.val();
    const settingsSnapshot = await get(ref(db, 'settings'));
    const settings = settingsSnapshot.val();
  
    for (const [id, employee] of Object.entries(employees)) {
      let weeklyRegularHours = 0;
      let weeklyOvertimeHours = 0;
      let weeklyPay = 0;
  
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(startOfWeek.getDate() + i);
  
        const timesheetSnapshot = await get(ref(db, `timesheets/${id}`));
        const timesheet = timesheetSnapshot.val() || {};
        const dailyEntries = Object.values(timesheet).filter(entry => 
          new Date(entry.timestamp).toDateString() === currentDate.toDateString()
        );
  
        const { regularHours, overtimeHours, dailyPay } = calculateDailyHours(dailyEntries, employee.payRate, settings);
  
        weeklyRegularHours += regularHours;
        weeklyOvertimeHours += overtimeHours;
        weeklyPay += dailyPay;
  
        content += `
          <tr>
            <td>${currentDate.toDateString()}</td>
            <td>${employee.name}</td>
            <td>${regularHours.toFixed(2)}</td>
            <td>${overtimeHours.toFixed(2)}</td>
            <td>$${dailyPay.toFixed(2)}</td>
          </tr>
        `;
      }
  
      content += `
        <tr>
          <td colspan="2"><strong>${employee.name}'s Weekly Total</strong></td>
          <td><strong>${weeklyRegularHours.toFixed(2)} hours</strong></td>
          <td><strong>${weeklyOvertimeHours.toFixed(2)} hours</strong></td>
          <td><strong>$${weeklyPay.toFixed(2)}</strong></td>
        </tr>
      `;
    }
  
    content += '</tbody></table>';
    return content;
  }
  
  function calculateDailyHours(dailyEntries, payRate, settings) {
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
  
    const totalWorkHours = totalWorkMilliseconds / 3600000; // Convert ms to hours
    const totalBreakHours = totalBreakMilliseconds / 3600000; // Convert ms to hours
    let payableWorkHours = Math.max(0, totalWorkHours - totalBreakHours); // Subtract break hours from work hours
  
    // Overtime calculation
    let regularHours = payableWorkHours;
    let overtimeHours = 0;
    if (payableWorkHours > settings.overtimeThreshold) {
      overtimeHours = payableWorkHours - settings.overtimeThreshold;
      regularHours = settings.overtimeThreshold;
    }
    const regularPay = regularHours * payRate;
    const overtimePay = overtimeHours * payRate * settings.overtimeMultiplier;
    const dailyPay = regularPay + overtimePay;
  
    return { totalWorkHours, totalBreakHours, regularHours, overtimeHours, dailyPay };
  }
  
  async function generatePayDaySheet() {
    const selectedEmployee = document.getElementById('employeeFilter').value;
    const selectedDate = new Date(document.getElementById('dateFilter').value);
    const timeFrame = document.getElementById('timeFilter').value;
  
    try {
      const content = await generatePayDaySheetContent(selectedEmployee, selectedDate, timeFrame);
  
      const printWindow = window.open('', '_blank');
      printWindow.document.write('<html><head><title>Employee Pay Stub</title>');
      printWindow.document.write('<style>body { font-family: Arial, sans-serif; } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } .close-button { position: fixed; top: 10px; right: 10px; padding: 10px; background-color: #f44336; color: white; border: none; cursor: pointer; }</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write('<button class="close-button" onclick="window.close()">Close</button>');
      printWindow.document.write(content);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error("Error generating pay day sheet:", error);
      showError('Failed to generate pay day sheet. Error: ' + error.message);
    }
  }
  
  async function generatePayDaySheetContent(employeeId, date, timeFrame) {
    const employeesSnapshot = await get(ref(db, 'employees'));
    const employees = employeesSnapshot.val();
    const settingsSnapshot = await get(ref(db, 'settings'));
    const settings = settingsSnapshot.val();
  
    let content = '<h2>Pay Day Sheet</h2>';
  
    // Use the provided date or the current date if not provided
    const selectedDate = date ? new Date(date) : new Date();
    const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    let endDate;
  
    if (timeFrame === 'day') {
      endDate = new Date(startDate);
    } else if (timeFrame === 'week') {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else {
      throw new Error('Invalid time frame');
    }
  
    if (employeeId) {
      // Generate report for a specific employee
      const employee = employees[employeeId];
      if (!employee) {
        throw new Error('Employee not found');
      }
      content += await generateEmployeePayDayContent(employee, startDate, endDate, settings);
    } else {
      // Generate report for all employees
      for (const [id, employee] of Object.entries(employees)) {
        content += await generateEmployeePayDayContent(employee, startDate, endDate, settings);
      }
    }
  
    return content;
  }
  
  async function generateEmployeePayDayContent(employee, startDate, endDate, settings) {
    const timesheetSnapshot = await get(ref(db, `timesheets/${employee.id}`));
    const timesheet = timesheetSnapshot.val() || {};
  
    let content = `
      <h3>${employee.name} (${employee.id})</h3>
      <p>Period: ${startDate.toDateString()} - ${endDate.toDateString()}</p>
      <table>
        <tr>
          <th>Date</th>
          <th>Clock In</th>
          <th>Start Break</th>
          <th>End Break</th>
          <th>Clock Out</th>
          <th>Regular Hours</th>
          <th>Overtime Hours</th>
          <th>Break Hours</th>
          <th>Daily Pay</th>
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
  
      let { totalWorkHours, totalBreakHours: dailyBreakHours, regularHours, overtimeHours, dailyPay } = calculateDailyHours(dailyEntries, employee.payRate, settings);
  
      totalRegularHours += regularHours;
      totalOvertimeHours += overtimeHours;
      totalBreakHours += dailyBreakHours;
      totalPay += dailyPay;
  
      content += `
        <tr>
          <td>${currentDate.toDateString()}</td>
          <td>${formatTime(dailyEntries.find(entry => entry.type === 'clockin')?.timestamp)}</td>
          <td>${formatTime(dailyEntries.find(entry => entry.type === 'startbreak')?.timestamp)}</td>
          <td>${formatTime(dailyEntries.find(entry => entry.type === 'endbreak')?.timestamp)}</td>
          <td>${formatTime(dailyEntries.find(entry => entry.type === 'clockout')?.timestamp)}</td>
          <td>${regularHours.toFixed(2)}</td>
          <td>${overtimeHours.toFixed(2)}</td>
          <td>${dailyBreakHours.toFixed(2)}</td>
          <td>$${dailyPay.toFixed(2)}</td>
        </tr>
      `;
    }
  
    content += `
        <tr>
          <th colspan="5">Totals</th>
          <th>${totalRegularHours.toFixed(2)}</th>
          <th>${totalOvertimeHours.toFixed(2)}</th>
          <th>${totalBreakHours.toFixed(2)}</th>
          <th>$${totalPay.toFixed(2)}</th>
        </tr>
      </table>
    `;
  
    return content;
  }
  
  async function editEmployee(id) {
    const employeeRef = ref(db, 'employees/' + id);
    const snapshot = await get(employeeRef);
    const employee = snapshot.val();
  
    if (employee) {
      document.getElementById('editEmployeeId').value = employee.id;
      document.getElementById('editEmployeeName').value = employee.name;
      document.getElementById('editEmployeeRole').value = employee.role;
      document.getElementById('editEmployeePayRate').value = employee.payRate;
  
      document.getElementById('editEmployeeModal').style.display = 'flex';
    } else {
      showError('Employee not found');
    }
  }
  
  async function saveEmployeeChanges() {
    const id = document.getElementById('editEmployeeId').value;
    const name = document.getElementById('editEmployeeName').value;
    const role = document.getElementById('editEmployeeRole').value;
    const payRate = parseFloat(document.getElementById('editEmployeePayRate').value);
  
    if (name && role && !isNaN(payRate)) {
      try {
        await updateEmployee(id, name, role, payRate);
        document.getElementById('editEmployeeModal').style.display = 'none';
        showSuccess('Employee updated successfully');
      } catch (error) {
        showError('Failed to update employee: ' + error.message);
      }
    } else {
      showError('Please fill all fields correctly');
    }
  }
  
  // Add touch events
  function addTouchEvents() {
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
  
  // Update calendar
  function updateCalendar() {
    const customCalendar = document.getElementById('customCalendar');
    if (!customCalendar) {
      console.error("Custom calendar element not found");
      return;
    }
    customCalendar.innerHTML = '';
    const selectedDate = new Date(document.getElementById('dateFilter').value + 'T12:00:00');
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
    // Calculate the Monday of the current week
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - (selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1));
  
    // Update the date range display
    const dateRangeElement = document.getElementById('dateRange');
    if (dateRangeElement) {
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      dateRangeElement.textContent = `${startOfWeek.toDateString()} - ${endOfWeek.toDateString()}`;
    }
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const day = dayDate.getDate();
      const month = dayDate.getMonth() + 1;
      const dayOfWeek = daysOfWeek[i];
  
      const dayElement = document.createElement('div');
      dayElement.className = 'day';
      dayElement.innerHTML = `
        ${dayOfWeek} <div class="date">${month}/${day}</div>
        <div class="dot"></div>
      `;
  
      // Highlight the current day
      if (dayDate.toDateString() === today.toDateString()) {
        dayElement.classList.add('active');
      }
  
      // Highlight the selected date
      if (dayDate.toDateString() === selectedDate.toDateString()) {
        dayElement.classList.add('selected');
      }
  
      dayElement.addEventListener('click', () => {
        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
          dateFilter.value = dayDate.toISOString().split('T')[0];
          updateCalendar();
          displayTimesheet();
        } else {
          console.error("Date filter element not found");
        }
      });
  
      customCalendar.appendChild(dayElement);
    }
  }
  
  // Helper function to get week dates
  function getWeekDates(date) {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1));
    const result = [new Date(start)];
    for (let i = 1; i < 7; i++) {
      const next = new Date(start);
      next.setDate(start.getDate() + i);
      result.push(next);
    }
    return result;
  }
  
  // Global function definitions
  window.openNav = function() { 
    const nav = document.getElementById("myNav");
    if (nav) {
      nav.style.width = "100%";
    } else {
      console.error("Navigation element not found");
    }
  };
  
  window.closeNav = function() { 
    const nav = document.getElementById("myNav");
    if (nav) {
      nav.style.width = "0%";
    } else {
      console.error("Navigation element not found");
    }
  };

  window.checkPassword = function() {
    debug("checkPassword function called");
    const passwordInput = document.getElementById('passwordInput');
    if (!passwordInput) {
      console.error("Password input element not found");
      return;
    }
    const pin = passwordInput.value;
    debug("Entered PIN:", pin);
    const settingsRef = ref(db, 'settings');
    get(settingsRef).then((snapshot) => {
      debug("Settings snapshot received");
      if (snapshot.exists()) {
        const settings = snapshot.val();
        debug("Settings:", settings);
        if (pin === settings.adminPIN) {
          debug("PIN correct, hiding password modal");
          const passwordModal = document.getElementById('passwordModal');
          if (passwordModal) {
            passwordModal.style.display = 'none';
          } else {
            console.error("Password modal element not found");
          }
          debug("Calling showOverview");
          window.showOverview();
        } else {
          debug("Incorrect PIN");
          showError('Incorrect PIN. Please try again.');
        }
      } else {
        debug("Settings not found");
        showError('Settings not found. Please try again.');
      }
    }).catch((error) => {
      console.error("Error checking password:", error);
      showError('An error occurred. Please try again.');
    });
  };
  
  window.showOverview = async function() {
    debug("showOverview function called");
    try {
      debug("Setting date to today");
      setDateToToday();
      debug("Hiding other content, showing overview content");
      const elements = {
        dashboardContent: 'none',
        employeeManagementContent: 'none',
        overviewContent: 'block',
        settingsContent: 'none',
        dateTime: 'none',
        addEmployeeButton: 'none'
      };
      for (const [id, display] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
          element.style.display = display;
        } else {
          console.error(`Element not found: ${id}`);
        }
      }
      debug("Closing nav");
      window.closeNav();
      debug("Displaying timesheet");
      await displayTimesheet();
      debug("Updating calendar");
      updateCalendar();
      debug('Overview displayed successfully');
    } catch (error) {
      console.error('Error displaying overview:', error);
      showError('Failed to display overview. Please try again.');
    }
  };
  
  window.showDashboard = function() {
    const elements = {
      dashboardContent: 'block',
      employeeManagementContent: 'none',
      overviewContent: 'none',
      settingsContent: 'none',
      dateTime: 'block',
      addEmployeeButton: 'none'
    };
    for (const [id, display] of Object.entries(elements)) {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = display;
      } else {
        console.error(`Element not found: ${id}`);
      }
    }
    window.closeNav();
  };
  
  window.showEmployeeManagement = function() {
    const elements = {
      dashboardContent: 'none',
      employeeManagementContent: 'block',
      overviewContent: 'none',
      settingsContent: 'none',
      dateTime: 'none',
      addEmployeeButton: 'block'
    };
    for (const [id, display] of Object.entries(elements)) {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = display;
      } else {
        console.error(`Element not found: ${id}`);
      }
    }
    window.closeNav();
  };
  
  window.showPasswordModal = function() {
    const passwordModal = document.getElementById('passwordModal');
    if (passwordModal) {
      passwordModal.style.display = 'flex';
    } else {
      console.error("Password modal element not found");
    }
    window.closeNav();
  };
  
  window.showSettings = function() {
    const elements = {
      dashboardContent: 'none',
      employeeManagementContent: 'none',
      overviewContent: 'none',
      settingsContent: 'block',
      dateTime: 'none',
      addEmployeeButton: 'none'
    };
    for (const [id, display] of Object.entries(elements)) {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = display;
      } else {
        console.error(`Element not found: ${id}`);
      }
    }
    window.closeNav();
    loadSettings();
  };
  
  window.closeDetailedViewModal = function() {
    const detailedViewModal = document.getElementById('detailedViewModal');
    if (detailedViewModal) {
      detailedViewModal.style.display = 'none';
    } else {
      console.error("Detailed view modal element not found");
    }
  };
  
  window.closeErrorModal = function() {
    const errorModal = document.getElementById('errorModal');
    if (errorModal) {
      errorModal.style.display = 'none';
    } else {
      console.error("Error modal element not found");
    }
  };
  
  window.exportToCSV = exportToCSV;
  window.sendWeeklyEmail = sendWeeklyEmail;
  window.generatePayDaySheet = generatePayDaySheet;
  window.showEmployeePerformance = showEmployeePerformance;
  window.resetSettings = resetSettings;
  window.saveSettings = saveSettings;
  window.showAddEmployeeModal = showAddEmployeeModal;
  window.addEmployee = addEmployee;
  window.editEmployee = editEmployee;
  window.saveEmployeeChanges = saveEmployeeChanges;
  
  function closeReportModal() {
    const reportModal = document.getElementById('reportModal');
    if (reportModal) {
      reportModal.style.display = 'none';
    }
  }
  
  // Add this function for employee performance
  async function showEmployeePerformance() {
    debug("Showing employee performance dashboard");
    try {
      const performanceDashboardContent = document.getElementById('performanceDashboardContent');
      if (performanceDashboardContent) {
        performanceDashboardContent.style.display = 'block';
      }
  
      // Hide other content
      ['dashboardContent', 'employeeManagementContent', 'overviewContent', 'settingsContent'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
      });
  
      const employeesSnapshot = await get(ref(db, 'employees'));
      const employees = employeesSnapshot.val();
      const performanceData = await calculateEmployeePerformance(employees);
      displayPerformanceChart(performanceData);
    } catch (error) {
      console.error("Error showing employee performance:", error);
      showError('Failed to show employee performance. Error: ' + error.message);
    }
  }
  
  async function calculateEmployeePerformance(employees) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const performanceData = [];
    for (const [id, employee] of Object.entries(employees)) {
      const timesheetSnapshot = await get(ref(db, `timesheets/${id}`));
      const timesheet = timesheetSnapshot.val() || {};
      const recentEntries = Object.values(timesheet).filter(entry => 
        new Date(entry.timestamp) >= oneMonthAgo
      );
      
      const totalHours = recentEntries.reduce((total, entry) => {
        if (entry.type === 'clockout') {
          const clockIn = recentEntries.find(e => e.type === 'clockin' && e.timestamp < entry.timestamp);
          if (clockIn) {
            return total + (entry.timestamp - clockIn.timestamp) / 3600000; // Convert ms to hours
          }
        }
        return total;
      }, 0);
      
      performanceData.push({
        name: employee.name,
        hoursWorked: totalHours
      });
    }
    
    return performanceData;
  }
  
  function displayPerformanceChart(performanceData) {
    // Get the canvas element where the chart will be drawn
    const ctx = document.getElementById('performanceChart').getContext('2d');
    
    // If there's an existing chart, destroy it to prevent conflicts
    if (performanceChart) {
      performanceChart.destroy();
    }
  
    // Create a new bar chart
    performanceChart = new Chart(ctx, {
      type: 'bar',  // Specify that it's a bar chart
      data: {
        // Use employee names as labels on the x-axis
        labels: performanceData.map(d => d.name),
        datasets: [{
          label: 'Hours Worked (Last 30 Days)',
          // Use the hours worked as the data for the bars
          data: performanceData.map(d => d.hoursWorked),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',  // Color of the bars
          borderColor: 'rgba(75, 192, 192, 1)',        // Border color of the bars
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,  // Start the y-axis at 0
            title: {
              display: true,
              text: 'Hours'     // Label for the y-axis
            }
          }
        }
      }
    });
  }
  
  // Add this function to reset settings
  async function resetSettings() {
    try {
      const defaultSettings = getDefaultSettings();
      const settingsRef = ref(db, 'settings');
      await set(settingsRef, defaultSettings);
      applySettingsToUI(defaultSettings);
      showSuccess('Settings reset to default values.');
    } catch (error) {
      console.error("Error resetting settings:", error);
      showError('Failed to reset settings. Error: ' + error.message);
    }
  }
  
  // Initialize the application
  document.addEventListener('DOMContentLoaded', initializeTimesheetApp);
  
  // Export functions to make them accessible globally
  window.openNav = openNav;
  window.closeNav = closeNav;
  window.checkPassword = checkPassword;
  window.showOverview = showOverview;
  window.showDashboard = showDashboard;
  window.showEmployeeManagement = showEmployeeManagement;
  window.showPasswordModal = showPasswordModal;
  window.showSettings = showSettings;
  window.closeDetailedViewModal = closeDetailedViewModal;
  window.closeErrorModal = closeErrorModal;
  window.exportToCSV = exportToCSV;
  window.sendWeeklyEmail = sendWeeklyEmail;
  window.generatePayDaySheet = generatePayDaySheet;
  window.showEmployeePerformance = showEmployeePerformance;
  window.resetSettings = resetSettings;
  window.saveSettings = saveSettings;
  window.showAddEmployeeModal = showAddEmployeeModal;
  window.addEmployee = addEmployee;
  window.editEmployee = editEmployee;
  window.saveEmployeeChanges = saveEmployeeChanges;
  window.closeAddEmployeeModal = function() {
    document.getElementById('addEmployeeModal').style.display = 'none';
  };
  window.closePasswordModal = function() {
    document.getElementById('passwordModal').style.display = 'none';
  };
  window.closeEditEmployeeModal = function() {
    document.getElementById('editEmployeeModal').style.display = 'none';
  };
  window.closeEditTimesheetModal = function() {
    document.getElementById('editTimesheetModal').style.display = 'none';
  };
  window.closeEmailModal = function() {
    document.getElementById('emailModal').style.display = 'none';
  };
  window.closeReportModal = closeReportModal;
  
  // Add event listeners for the Enter key on input fields
  document.getElementById('addEmployeeName').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmployee();
    }
  });
  
  document.getElementById('passwordInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.checkPassword();
    }
  });
  
 // Updated event listeners for the week navigation buttons
document.addEventListener('DOMContentLoaded', function() {
  const prevWeekButton = document.getElementById('prevWeekButton');
  const nextWeekButton = document.getElementById('nextWeekButton');

  if (prevWeekButton) {
    prevWeekButton.addEventListener('click', () => changeWeek(-1));
  } else {
    console.error("Previous week button not found");
  }

  if (nextWeekButton) {
    nextWeekButton.addEventListener('click', () => changeWeek(1));
  } else {
    console.error("Next week button not found");
  }
});
