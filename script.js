// Register the service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
document.addEventListener('DOMContentLoaded', function () {
  let employees = JSON.parse(localStorage.getItem('employees')) || [];
  let timesheets = JSON.parse(localStorage.getItem('timesheets')) || {};
  let timers = JSON.parse(localStorage.getItem('timers')) || {};
  let activeEmployeeId = null;
  let currentInterval = null;

  const addEmployeeButton = document.getElementById('addEmployeeButton');
  const addEmployeeSubmitButton = document.getElementById('addEmployeeSubmit');
  const employeeList = document.getElementById('employees');
  const employeeManagementList = document.getElementById('employeeManagementList');
  const dashboardContent = document.getElementById('dashboardContent');
  const overviewContent = document.getElementById('overviewContent');
  const employeeManagementContent = document.getElementById('employeeManagementContent');
  const timesheetTableBody = document.querySelector('#timesheetTable tbody');
  const dateFilter = document.getElementById('dateFilter');
  const employeeFilter = document.getElementById('employeeFilter');
  const timeFilter = document.getElementById('timeFilter');
  const customCalendar = document.getElementById('customCalendar');
  const menuIcon = document.getElementById('menuIcon');
  const currentDateElement = document.getElementById('currentDate');
  const currentTimeElement = document.getElementById('currentTime');

  const clockInModal = document.getElementById('clockInModal');
  const employeeNameElement = document.getElementById('employeeName');
  const clockCircle = document.querySelector('.clock-circle');
  const breakButton = document.getElementById('breakButton');
  const timerElement = document.getElementById('timer');
  const closeModalButtons = document.getElementsByClassName('close');

  const passwordModal = document.getElementById('passwordModal');
  const passwordInput = document.getElementById('passwordInput');
  const submitPasswordButton = document.getElementById('submitPassword');

  const editEmployeeModal = document.getElementById('editEmployeeModal');
  const editEmployeeId = document.getElementById('editEmployeeId');
  const editEmployeeName = document.getElementById('editEmployeeName');
  const editEmployeeRole = document.getElementById('editEmployeeRole');
  const editEmployeePayRate = document.getElementById('editEmployeePayRate');
  const saveEmployeeChanges = document.getElementById('saveEmployeeChanges');

  const addEmployeeModal = document.getElementById('addEmployeeModal');
  const addEmployeeName = document.getElementById('addEmployeeName');
  const addEmployeeId = document.getElementById('addEmployeeId');
  const addEmployeeRole = document.getElementById('addEmployeeRole');
  const addEmployeePayRate = document.getElementById('addEmployeePayRate');

  const editTimesheetModal = document.getElementById('editTimesheetModal');
  const editStartTime = document.getElementById('editStartTime');
  const editEndTime = document.getElementById('editEndTime');
  const editBreakStartTime = document.getElementById('editBreakStartTime');
  const editBreakEndTime = document.getElementById('editBreakEndTime');
  const saveTimesheetChanges = document.getElementById('saveTimesheetChanges');

  const detailedViewModal = document.getElementById('detailedViewModal');

  const printButton = document.getElementById('printButton');

  // Correctly handling the overlay menu functionality
  window.openNav = function () {
      document.getElementById("myNav").style.width = "100%";
  };

  window.closeNav = function () {
      document.getElementById("myNav").style.width = "0%";
  };

  // Function to show different sections and close the overlay
  window.showDashboard = function () {
      dashboardContent.style.display = 'block';
      employeeManagementContent.style.display = 'none';
      overviewContent.style.display = 'none';
      document.getElementById('dateTime').style.display = 'block';
      addEmployeeButton.style.display = 'none';
      closeNav();
  };

  window.showEmployeeManagement = function () {
      dashboardContent.style.display = 'none';
      employeeManagementContent.style.display = 'block';
      overviewContent.style.display = 'none';
      document.getElementById('dateTime').style.display = 'none';
      addEmployeeButton.style.display = 'block';
      closeNav();
  };

  window.showOverview = function () {
      dashboardContent.style.display = 'none';
      employeeManagementContent.style.display = 'none';
      overviewContent.style.display = 'block';
      document.getElementById('dateTime').style.display = 'none';
      addEmployeeButton.style.display = 'none';
      closeNav();
  };

  window.showPasswordModal = function () {
      passwordModal.style.display = 'flex';
      closeNav();
  };

  window.checkPassword = function () {
      const pin = passwordInput.value;
      if (pin === "1999") {
          passwordModal.style.display = 'none';
          showOverview();
      } else {
          alert("Incorrect PIN. Please try again.");
      }
  };

  if (menuIcon) {
      menuIcon.addEventListener('click', openNav);
  }

  if (addEmployeeButton) {
      addEmployeeButton.addEventListener('click', () => {
          addEmployeeModal.style.display = 'flex';
      });
  }

  if (addEmployeeSubmitButton) {
      addEmployeeSubmitButton.addEventListener('click', addEmployee);
  }

  if (submitPasswordButton) {
      submitPasswordButton.addEventListener('click', checkPassword);
  }

  if (saveEmployeeChanges) {
      saveEmployeeChanges.addEventListener('click', saveEmployee);
  }

  if (saveTimesheetChanges) {
      saveTimesheetChanges.addEventListener('click', saveTimesheet);
  }

  Array.from(closeModalButtons).forEach(button => button.addEventListener('click', () => {
      button.closest('.modal').style.display = 'none';
      clearInterval(currentInterval);
  }));

  window.addEventListener('click', (event) => {
      if (event.target == passwordModal) {
          passwordModal.style.display = 'none';
      }
      if (event.target == clockInModal) {
          clockInModal.style.display = 'none';
          clearInterval(currentInterval);
      }
      if (event.target == editEmployeeModal) {
          editEmployeeModal.style.display = 'none';
      }
      if (event.target == addEmployeeModal) {
          addEmployeeModal.style.display = 'none';
      }
      if (event.target == editTimesheetModal) {
          editTimesheetModal.style.display = 'none';
      }
      if (event.target == detailedViewModal) {
          detailedViewModal.style.display = 'none';
      }
  });

  dateFilter.addEventListener('change', displayTimesheet);
  employeeFilter.addEventListener('change', displayTimesheet);
  timeFilter.addEventListener('change', displayTimesheet);

  if (printButton) {
      printButton.addEventListener('click', generatePayDaySheet);
  }

  function addEmployee() {
      const name = addEmployeeName.value;
      const id = addEmployeeId.value;
      const payRate = addEmployeePayRate.value;
      const role = addEmployeeRole.value;
      if (name && id && payRate && role) {
          employees.push({ name, id, payRate: parseFloat(payRate), role });
          timesheets[id] = [];
          timers[id] = { mainTime: 0, breakTime: 0, startTime: null, breakStartTime: null, isRunning: false, isOnBreak: false, interval: null, breakInterval: null };
          updateLocalStorage();
          updateEmployeeList();
          updateEmployeeManagementList();
          updateEmployeeFilter();
          addEmployeeModal.style.display = 'none';
          addEmployeeName.value = '';
          addEmployeeId.value = '';
          addEmployeeRole.value = '';
          addEmployeePayRate.value = '';
      }
  }

  function deleteEmployee(id) {
      if (confirm('Are you sure you want to delete this employee?')) {
          employees = employees.filter(employee => employee.id !== id);
          delete timesheets[id];
          delete timers[id];
          updateLocalStorage();
          updateEmployeeList();
          updateEmployeeManagementList();
          updateEmployeeFilter();
      }
  }

  function editEmployee(id) {
      const employee = employees.find(emp => emp.id === id);
      if (employee) {
          editEmployeeId.value = employee.id;
          editEmployeeName.value = employee.name;
          editEmployeeRole.value = employee.role;
          editEmployeePayRate.value = employee.payRate;
          editEmployeeModal.style.display = 'flex';
      }
  }

  function saveEmployee() {
      const id = editEmployeeId.value;
      const employee = employees.find(emp => emp.id === id);
      if (employee) {
          employee.name = editEmployeeName.value;
          employee.role = editEmployeeRole.value;
          employee.payRate = parseFloat(editEmployeePayRate.value);
          updateLocalStorage();
          updateEmployeeList();
          updateEmployeeManagementList();
          updateEmployeeFilter();
          editEmployeeModal.style.display = 'none';
      }
  }

  function saveTimesheet() {
      const id = editTimesheetModal.getAttribute('data-employee-id');
      const employeeTimesheet = timesheets[id];
      const startTime = editStartTime.value;
      const endTime = editEndTime.value;
      const breakStartTime = editBreakStartTime.value;
      const breakEndTime = editBreakEndTime.value;

      if (employeeTimesheet) {
          if (startTime) {
              updateTimesheetEntry(id, 'clockin', startTime);
          }
          if (endTime) {
              updateTimesheetEntry(id, 'clockout', endTime);
          }
          if (breakStartTime) {
              updateTimesheetEntry(id, 'startbreak', breakStartTime);
          }
          if (breakEndTime) {
              updateTimesheetEntry(id, 'endbreak', breakEndTime);
          }

          updateLocalStorage();
          displayTimesheet();
          editTimesheetModal.style.display = 'none';
      }
  }

  function updateTimesheetEntry(id, type, time) {
      const timestamp = new Date(`${dateFilter.value}T${time}:00`).getTime(); // Update with date context
      const employeeTimesheet = timesheets[id] || [];
      let entry = employeeTimesheet.find(entry => entry.type === type && new Date(entry.timestamp).toDateString() === new Date(dateFilter.value).toDateString());
      if (entry) {
          entry.timestamp = timestamp;
      } else {
          employeeTimesheet.push({ type, timestamp });
      }
      timesheets[id] = employeeTimesheet;
  }

  function updateLocalStorage() {
      localStorage.setItem('employees', JSON.stringify(employees));
      localStorage.setItem('timesheets', JSON.stringify(timesheets));
      localStorage.setItem('timers', JSON.stringify(timers));
  }

  function updateEmployeeList() {
      employeeList.innerHTML = '';
      employees.forEach(employee => {
          const li = document.createElement('li');
          li.textContent = `${employee.name} (${employee.id})`;
          li.addEventListener('click', () => showClockInModal(employee));
          employeeList.appendChild(li);
      });
  }

  function updateEmployeeManagementList() {
      employeeManagementList.innerHTML = '';
      employees.forEach(employee => {
          const li = document.createElement('li');
          li.className = 'employee-management-item';
          li.innerHTML = `
            ${employee.name} (${employee.id})
            <div class="employee-actions">
                <button class="view-button" data-id="${employee.id}">View</button>
                <button class="edit-button" data-id="${employee.id}">Edit</button>
                <button class="delete-button" data-id="${employee.id}">Delete</button>
            </div>
        `;
          employeeManagementList.appendChild(li);
      });

      const viewButtons = document.querySelectorAll('.view-button');
      const editButtons = document.querySelectorAll('.edit-button');
      const deleteButtons = document.querySelectorAll('.delete-button');

      viewButtons.forEach(button => {
          button.addEventListener('click', () => {
              const id = button.getAttribute('data-id');
              showDetailedView(id);
          });
      });

      editButtons.forEach(button => {
          button.addEventListener('click', () => {
              const id = button.getAttribute('data-id');
              editEmployee(id);
          });
      });

      deleteButtons.forEach(button => {
          button.addEventListener('click', () => {
              const id = button.getAttribute('data-id');
              deleteEmployee(id);
          });
      });
  }

  function updateEmployeeFilter() {
      employeeFilter.innerHTML = '<option value="">All Employees</option>';
      employees.forEach(employee => {
          const option = document.createElement('option');
          option.value = employee.id;
          option.textContent = employee.name;
          employeeFilter.appendChild(option);
      });
  }

  function showClockInModal(employee) {
      const { id } = employee;
      activeEmployeeId = id;

      employeeNameElement.textContent = `${employee.name} (${employee.id})`;
      clockInModal.style.display = 'flex';

      clockCircle.classList.remove('clock-out');
      breakButton.style.display = 'none'; // Initially hide the break button

      clearInterval(currentInterval);

      if (timers[id].isRunning || timers[id].isOnBreak) {
          if (timers[id].isRunning) {
              clockCircle.classList.add('clock-out');
              startMainInterval(id, timerElement);
          } else if (timers[id].isOnBreak) {
              clockCircle.classList.add('clock-out');
              breakButton.textContent = 'End Break';
              startBreakInterval(id, timerElement);
          }
          // Make sure breakButton appears under the clock-out button
          breakButton.style.display = 'block';
          breakButton.style.marginTop = '20px'; // Adjust as needed for spacing
      } else {
          updateTimer(timerElement, timers[id].mainTime);
      }

      clockCircle.onclick = () => {
          if (!timers[id].isRunning && !timers[id].isOnBreak) {
              timers[id].startTime = Date.now();
              timers[id].isRunning = true;
              logTimesheet(id, 'clockin');
              startMainInterval(id, timerElement);
              clockCircle.classList.add('clock-out');
              breakButton.style.display = 'block'; // Show break button when clocking in
              breakButton.style.marginTop = '20px'; // Adjust as needed for spacing

              clockInModal.style.display = 'none';
              resetModalState();
          } else if (timers[id].isRunning) {
              stopActiveEmployeeTimer(id);
              logTimesheet(id, 'clockout');
              resetTimer(id);
              clockCircle.classList.remove('clock-out');
              clockInModal.style.display = 'none';
              updateEmployeeList();
              displayTimesheet();
          }
          updateLocalStorage();
      };

      breakButton.onclick = () => {
          if (breakButton.textContent === 'Start Break') {
              timers[id].mainTime += Math.floor((Date.now() - timers[id].startTime) / 1000);
              timers[id].breakStartTime = Date.now();
              timers[id].isRunning = false;
              timers[id].isOnBreak = true;
              logTimesheet(id, 'startbreak');
              breakButton.textContent = 'End Break';
              startBreakInterval(id, timerElement);
          } else {
              timers[id].breakTime += Math.floor((Date.now() - timers[id].breakStartTime) / 1000);
              timers[id].startTime = Date.now();
              timers[id].isRunning = true;
              timers[id].isOnBreak = false;
              logTimesheet(id, 'endbreak');
              breakButton.textContent = 'Start Break';
              startMainInterval(id, timerElement);
          }

          clockInModal.style.display = 'none';
          resetModalState();
          updateLocalStorage();
      };
  }

  function resetModalState() {
      clearInterval(currentInterval);
      updateTimer(timerElement, 0);
      clockCircle.classList.remove('clock-out');
      breakButton.style.display = 'none';
      breakButton.textContent = 'Start Break';
  }

  function startMainInterval(id, timerElement) {
      clearInterval(currentInterval);
      currentInterval = setInterval(() => {
          const duration = Math.floor((Date.now() - timers[id].startTime) / 1000);
          updateTimer(timerElement, timers[id].mainTime + duration);
      }, 1000);
  }

  function startBreakInterval(id, timerElement) {
      clearInterval(currentInterval);
      currentInterval = setInterval(() => {
          const duration = Math.floor((Date.now() - timers[id].breakStartTime) / 1000);
          updateTimer(timerElement, timers[id].breakTime + duration);
      }, 1000);
  }

  function stopActiveEmployeeTimer(id) {
      const timer = timers[id];
      if (timer.isRunning) {
          timer.mainTime += Math.floor((Date.now() - timer.startTime) / 1000);
      } else if (timer.isOnBreak) {
          timer.breakTime += Math.floor((Date.now() - timer.breakStartTime) / 1000);
      }
      clearInterval(currentInterval);
      timer.isRunning = false;
      timer.isOnBreak = false;
      updateLocalStorage();
  }

  function resetTimer(id) {
      timers[id] = { mainTime: 0, breakTime: 0, startTime: null, breakStartTime: null, isRunning: false, isOnBreak: false, interval: null, breakInterval: null };
      updateLocalStorage();
  }

  function updateTimer(element, time) {
      element.textContent = formatTotalTime(time);
  }

  function logTimesheet(id, type) {
      const timestamp = Date.now();
      const timesheet = timesheets[id] || [];
      const entry = {
          type: type,
          timestamp: timestamp
      };
      timesheet.push(entry);
      timesheets[id] = timesheet;
      updateLocalStorage();
  }

  function displayTimesheet() {
      const selectedDate = new Date(dateFilter.value);
      const selectedEmployee = employeeFilter.value;
      timesheetTableBody.innerHTML = '';

      const filteredEmployees = selectedEmployee ? employees.filter(employee => employee.id === selectedEmployee) : employees;

      filteredEmployees.forEach(employee => {
          const timesheet = (timesheets[employee.id] || []).filter(entry => {
              const entryDate = new Date(entry.timestamp);
              return entryDate.toDateString() === selectedDate.toDateString() ||
                  (entry.type === 'clockout' && new Date(timesheets[employee.id][0]?.timestamp).toDateString() === selectedDate.toDateString());
          });

          let totalWorkMilliseconds = 0;
          let totalBreakMilliseconds = 0;
          let lastClockInTime = null;

          timesheet.forEach((entry, index) => {
              if (entry.type === 'clockin') {
                  lastClockInTime = entry.timestamp;
              }
              if (entry.type === 'clockout' && lastClockInTime) {
                  totalWorkMilliseconds += (entry.timestamp - lastClockInTime);
                  lastClockInTime = null;  // Reset after calculating
              }
              if (entry.type === 'startbreak' && timesheet[index + 1] && timesheet[index + 1].type === 'endbreak') {
                  totalBreakMilliseconds += (timesheet[index + 1].timestamp - entry.timestamp);
              }
          });

          // Calculate the total payable work hours by subtracting the break hours from the total work hours
          const totalWorkHours = totalWorkMilliseconds / 3600000; // Convert ms to hours
          const totalBreakHours = totalBreakMilliseconds / 3600000; // Convert ms to hours
          const payableWorkHours = Math.max(0, totalWorkHours - totalBreakHours); // Subtract break hours from work hours
          const dailyPay = (payableWorkHours * employee.payRate).toFixed(2); // Calculate daily pay based on payable work hours only

          const row = document.createElement('tr');
          row.innerHTML = `
              <td>${employee.role}</td>
              <td>${employee.name}</td>
              <td>${selectedDate.toDateString()}</td>
              <td class="editable" data-type="clockin" data-id="${employee.id}">${formatTime(timesheet.find(entry => entry.type === 'clockin')?.timestamp)}</td>
              <td class="editable" data-type="startbreak" data-id="${employee.id}">${formatTime(timesheet.find(entry => entry.type === 'startbreak')?.timestamp)}</td>
              <td class="editable" data-type="endbreak" data-id="${employee.id}">${formatTime(timesheet.find(entry => entry.type === 'endbreak')?.timestamp)}</td>
              <td class="editable" data-type="clockout" data-id="${employee.id}">${formatTime(timesheet.find(entry => entry.type === 'clockout')?.timestamp)}</td>
              <td>${payableWorkHours.toFixed(2)}</td> <!-- Display total payable work hours -->
              <td>${totalBreakHours.toFixed(2)}</td> <!-- Display total break hours -->
              <td>${dailyPay}</td> <!-- Display daily pay -->
              <td><button class="delete-timesheet-button" data-id="${employee.id}" data-date="${selectedDate.toISOString()}">Delete</button></td>
          `;
          timesheetTableBody.appendChild(row);
      });

      // Enable inline editing
      const editableCells = document.querySelectorAll('.editable');

      editableCells.forEach(cell => {
          cell.addEventListener('dblclick', () => {
              const currentText = cell.textContent;
              const input = document.createElement('input');
              input.type = cell.dataset.type === 'notes' ? 'text' : 'time';
              input.value = cell.dataset.type === 'notes' ? currentText : currentText.slice(0, 5);
              cell.textContent = '';
              cell.appendChild(input);
              input.focus();

              const saveInput = () => {
                  const newValue = input.value;
                  cell.textContent = newValue;
                  saveInlineEdit(cell.dataset.id, cell.dataset.type, newValue);
              };

              input.addEventListener('blur', saveInput);
              input.addEventListener('keydown', (event) => {
                  if (event.key === 'Enter') {
                      input.blur();
                  }
              });
          });
      });

      // Handle delete button functionality
      const deleteTimesheetButtons = document.querySelectorAll('.delete-timesheet-button');

      deleteTimesheetButtons.forEach(button => {
          button.addEventListener('click', () => {
              const id = button.getAttribute('data-id');
              const selectedDate = new Date(button.getAttribute('data-date'));
              deleteTimesheet(id, selectedDate);
          });
      });
  }

  function formatTime(timestamp) {
      return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  }

  function formatTotalTime(totalTime) {
      const hours = String(Math.floor(totalTime / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((totalTime % 3600) / 60)).padStart(2, '0');
      const seconds = String(totalTime % 60).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
  }

  function saveInlineEdit(id, type, value) {
      const selectedDate = new Date(dateFilter.value); // Get the selected date
      const [hours, minutes] = value.split(':'); // Split the time value
      selectedDate.setHours(hours);
      selectedDate.setMinutes(minutes);
      selectedDate.setSeconds(0);
      selectedDate.setMilliseconds(0);

      const timestamp = selectedDate.getTime(); // Create a timestamp with the correct date and time

      const employeeTimesheet = timesheets[id] || [];
      let entry = employeeTimesheet.find(entry => entry.type === type && new Date(entry.timestamp).toDateString() === selectedDate.toDateString());

      if (entry) {
          entry.timestamp = timestamp;
      } else {
          employeeTimesheet.push({ type, timestamp });
      }

      timesheets[id] = employeeTimesheet;
      updateLocalStorage();
      displayTimesheet();  // Update the timesheet view
  }

  function deleteTimesheet(id, selectedDate) {
      if (confirm('Are you sure you want to delete this entry for the selected day?')) {
          // Filter out entries that match the selected date
          timesheets[id] = (timesheets[id] || []).filter(entry => {
              const entryDate = new Date(entry.timestamp);
              return entryDate.toDateString() !== selectedDate.toDateString();
          });

          updateLocalStorage();
          displayTimesheet();
      }
  }

  function changeDate(offset) {
      const currentDate = new Date(dateFilter.value);
      currentDate.setDate(currentDate.getDate() + offset);
      dateFilter.value = currentDate.toISOString().split('T')[0];
      displayTimesheet();
      updateCalendar();
  }

  function updateCalendar() {
      customCalendar.innerHTML = '';
      const today = new Date(dateFilter.value);
      const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // Updated to start from Monday

      // Calculate the start of the week (Monday)
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      const dayDiff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Adjusting for Monday start
      startOfWeek.setDate(today.getDate() + dayDiff);

      for (let i = 0; i < 7; i++) { // Loop for 7 days
          const dayDate = new Date(startOfWeek);
          dayDate.setDate(startOfWeek.getDate() + i);
          const day = dayDate.getDate();
          const dayOfWeek = daysOfWeek[i];

          const dayElement = document.createElement('div');
          dayElement.className = 'day';
          dayElement.innerHTML = `
          ${dayOfWeek} <div class="date">${day}</div>
          <div class="dot"></div>
      `;

          if (dayDate.toDateString() === today.toDateString()) {
              dayElement.classList.add('active');
          }

          dayElement.addEventListener('click', () => {
              dateFilter.value = dayDate.toISOString().split('T')[0];
              updateCalendar();
              displayTimesheet();
          });

          customCalendar.appendChild(dayElement);
      }
  }

  function updateDateTime() {
      const now = new Date();
      currentDateElement.textContent = now.toDateString();
      currentTimeElement.textContent = now.toLocaleTimeString();
  }

  function showDetailedView(employeeId) {
      const employee = employees.find(emp => emp.id === employeeId);
      const employeeTimesheet = timesheets[employeeId] || [];
      let totalHours = 0;
      const daysWorked = {};

      employeeTimesheet.forEach(entry => {
          const date = new Date(entry.timestamp).toDateString();
          if (!daysWorked[date]) {
              daysWorked[date] = {
                  clockin: null,
                  clockout: null,
                  startbreak: null,
                  endbreak: null
              };
          }
          daysWorked[date][entry.type] = entry.timestamp;
      });

      for (const date in daysWorked) {
          const day = daysWorked[date];
          if (day.clockin && day.clockout) {
              totalHours += (day.clockout - day.clockin) / 3600000;
          }
      }

      const detailedViewEmployeeName = document.getElementById('detailedViewEmployeeName');
      const detailedViewEmployeeRole = document.getElementById('detailedViewEmployeeRole');
      const detailedViewTotalHours = document.getElementById('detailedViewTotalHours');
      const detailedViewDaysWorked = document.getElementById('detailedViewDaysWorked');

      detailedViewEmployeeName.textContent = `${employee.name} (${employee.id})`;
      detailedViewEmployeeRole.textContent = employee.role;
      detailedViewTotalHours.textContent = `${totalHours.toFixed(2)} hours`;
      detailedViewDaysWorked.innerHTML = '';

      for (const date in daysWorked) {
          const day = daysWorked[date];
          const listItem = document.createElement('li');
          listItem.innerHTML = `<strong>${date}:</strong><br> 
      Clock In: ${formatTime(day.clockin)}<br> 
      Start Break: ${formatTime(day.startbreak)}<br> 
      End Break: ${formatTime(day.endbreak)}<br> 
      Clock Out: ${formatTime(day.clockout)}`;
          detailedViewDaysWorked.appendChild(listItem);
      }

      document.getElementById('detailedViewModal').style.display = 'flex';
  }

  function closeDetailedViewModal() {
      document.getElementById('detailedViewModal').style.display = 'none';
  }

  function generatePayDaySheet() {
      const employeeId = employeeFilter.value;
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;

      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
      const startOfWeek = new Date(now.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))); // Last Monday
      startOfWeek.setHours(0, 0, 0, 0); // Set to start of the day

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Next Sunday
      endOfWeek.setHours(23, 59, 59, 999); // Set to end of the day

      const timesheet = (timesheets[employee.id] || []).filter(entry => {
          const entryDate = new Date(entry.timestamp);
          return entryDate >= startOfWeek && entryDate <= endOfWeek;
      });

      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dailyHours = {};
      let totalWorkHours = 0;
      let totalBreakHours = 0;
      let totalPay = 0;

      daysOfWeek.forEach(day => {
          dailyHours[day] = { workHours: 0, breakHours: 0 };
      });

      let lastClockIn = null;

      timesheet.forEach((entry, index) => {
          const entryDate = new Date(entry.timestamp);
          const dayName = daysOfWeek[entryDate.getDay()];

          if (entry.type === 'clockin') {
              lastClockIn = entry.timestamp;
          }

          if (entry.type === 'clockout' && lastClockIn) {
              const workTime = (entry.timestamp - lastClockIn) / 3600000; // Convert ms to hours
              dailyHours[dayName].workHours += workTime;
              totalWorkHours += workTime;
              lastClockIn = null;
          }

          if (entry.type === 'startbreak' && timesheet[index + 1]?.type === 'endbreak') {
              const breakTime = (timesheet[index + 1].timestamp - entry.timestamp) / 3600000; // Convert ms to hours
              dailyHours[dayName].breakHours += breakTime;
              totalBreakHours += breakTime;
          }
      });

      // Calculate the total payable work hours by subtracting the break hours from the total work hours
      daysOfWeek.forEach(day => {
          const payableWorkHours = Math.max(0, dailyHours[day].workHours - dailyHours[day].breakHours);
          const dailyPay = (payableWorkHours * employee.payRate).toFixed(2);
          totalPay += parseFloat(dailyPay);

          dailyHours[day].payableWorkHours = payableWorkHours;
          dailyHours[day].dailyPay = dailyPay;
      });

      const printWindow = window.open('', '_blank');
      printWindow.document.write('<html><head><title>Payday Sheet</title><style>');
      printWindow.document.write(`
        body { font-family: Arial, sans-serif; margin: 20px; }
        h2, h3 { margin-bottom: 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .totals-row td { font-weight: bold; }
    `);
      printWindow.document.write('</style></head><body>');
      printWindow.document.write(`<h2>Payday Sheet for ${employee.name} (${employee.id})</h2>`);
      printWindow.document.write(`<p><strong>Week:</strong> ${startOfWeek.toDateString()} - ${endOfWeek.toDateString()}</p>`);
      printWindow.document.write('<table border="1">');
      printWindow.document.write('<thead><tr><th>Day</th><th>Work Hours</th><th>Break Hours</th><th>Payable Hours</th><th>Daily Pay</th></tr></thead><tbody>');

      daysOfWeek.forEach(day => {
          const workHours = dailyHours[day].workHours.toFixed(2);
          const breakHours = dailyHours[day].breakHours.toFixed(2);
          const payableWorkHours = dailyHours[day].payableWorkHours.toFixed(2);
          const dailyPay = dailyHours[day].dailyPay;
          printWindow.document.write(`<tr><td>${day}</td><td>${workHours}</td><td>${breakHours}</td><td>${payableWorkHours}</td><td>$${dailyPay}</td></tr>`);
      });

      printWindow.document.write('</tbody></table>');
      printWindow.document.write('<table border="1">');
      printWindow.document.write('<tbody>');
      printWindow.document.write(`<tr class="totals-row"><td>Total Work Hours:</td><td colspan="4">${totalWorkHours.toFixed(2)} hours</td></tr>`);
      printWindow.document.write(`<tr class="totals-row"><td>Total Break Hours:</td><td colspan="4">${totalBreakHours.toFixed(2)} hours</td></tr>`);
      printWindow.document.write(`<tr class="totals-row"><td>Total Pay:</td><td colspan="4">$${totalPay.toFixed(2)}</td></tr>`);
      printWindow.document.write('</tbody></table>');
      printWindow.document.write('</body></html>');

      printWindow.document.close();
      printWindow.print();
  }

  // Week Navigation
  const prevWeekButton = document.getElementById('prevWeekButton');
  const nextWeekButton = document.getElementById('nextWeekButton');

  prevWeekButton.addEventListener('click', function () {
      changeDate(-7);
  });

  nextWeekButton.addEventListener('click', function () {
      changeDate(7);
  });

  updateEmployeeList();
  updateEmployeeManagementList();
  updateEmployeeFilter();

  Object.keys(timers).forEach(id => {
      const timer = timers[id];
      if (timer.isRunning) {
          const duration = Math.floor((Date.now() - timer.startTime) / 1000);
          timer.mainTime += duration;
          timer.startTime = Date.now();
      } else if (timer.isOnBreak) {
          const duration = Math.floor((Date.now() - timer.breakStartTime) / 1000);
          timer.breakTime += duration;
          timer.breakStartTime = Date.now();
      }
  });

  setInterval(updateLocalStorage, 1000);
  setInterval(updateDateTime, 1000);
  dateFilter.value = new Date().toISOString().split('T')[0];
  displayTimesheet();
  updateCalendar();
  updateDateTime();
});
