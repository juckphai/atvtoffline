// === Global Variables สำหรับ Offline Mode ===
let currentUser = null;
let autoSelectDone = false; // ✅ STEP 3: เพิ่มตัวแปรควบคุมการเรียก autoSelect

// === State Management ===
window.appState = {
    activities: [],
    currentUser: null,
    backupPassword: null
};

// === ✨ ฟังก์ชันใหม่: โหลดข้อมูลจาก IndexedDB แทน Firestore ===
async function setupOfflineData() {
    try {
        // ✅ PART 5: เรียกใช้งาน IndexedDB แทน Firebase Init
        await openDB();
        
        // โหลดกิจกรรมทั้งหมดจาก IndexedDB
        const activities = await dbActivities.getAll();
        window.activities = activities;
        window.appState.activities = activities;
        
        // บันทึกลง LocalStorage สำหรับการใช้งานครั้งแรก
        saveToLocalStorage('activities', activities);
        loadUserActivities();
        
        // โหลดการตั้งค่าจาก IndexedDB
        const config = await dbSettings.getConfig();
        applyConfigToUI(config);
        
        console.log(`✅ โหลดข้อมูลจาก IndexedDB เรียบร้อย: ${activities.length} รายการ`);
        
        // ✅ PART 4: เรียกฟังก์ชันอัพเดต UI
        if (config.persons) {
            saveToLocalStorage('persons', config.persons);
            populatePersonDropdown('personSelect');
            populatePersonFilter();
            
            setTimeout(() => {
                autoSelectIfSingleOnce(); // ✅ STEP 3: เรียกครั้งเดียว
                updateCurrentPersonDisplay(); 
                updatePersonFilterVisibility();
            }, 100);
        }
        
        if (config.activityTypes) {
            saveToLocalStorage('activityTypes', config.activityTypes);
            populateActivityTypeDropdowns('activityTypeSelect');
            
            setTimeout(() => {
                autoSelectIfSingleOnce(); // ✅ STEP 3: เรียกครั้งเดียว
            }, 100);
        }
        
        if (config.backupPassword) {
            window.appState.backupPassword = config.backupPassword;
            saveToLocalStorage('backupPassword', config.backupPassword);
        } else {
            window.appState.backupPassword = null;
            saveToLocalStorage('backupPassword', null);
        }
        renderBackupPasswordStatus();
        
    } catch (error) {
        console.error("Error loading offline data:", error);
        // ใช้ข้อมูลจาก localStorage ถ้า IndexedDB ล้มเหลว
        const cachedActivities = getFromLocalStorage('activities');
        if (cachedActivities && cachedActivities.length > 0) {
            window.activities = cachedActivities;
            window.appState.activities = cachedActivities;
            loadUserActivities();
            console.log('⚡ Render activities from localStorage cache');
        }
    }
}

// === ฟังก์ชันตรวจจับการแสดงผลหน้าจอสำหรับมือถือ (ปรับปรุงสำหรับ Offline) ===
function setupVisibilityReload() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('📱 หน้าจอกลับมา active → รีเฟรชข้อมูล');
            refreshActivitiesFromIndexedDB();
        }
    });
    
    console.log('✅ ตั้งค่าระบบตรวจจับการแสดงผลหน้าจอสำเร็จ');
}

// === ฟังก์ชันรีเฟรชข้อมูลจาก IndexedDB ===
async function refreshActivitiesFromIndexedDB() {
    try {
        const activities = await dbActivities.getAll();
        window.activities = activities;
        window.appState.activities = activities;
        saveToLocalStorage('activities', activities);
        loadUserActivities();
        console.log(`✅ รีเฟรชข้อมูลจาก IndexedDB: ${activities.length} รายการ`);
    } catch (error) {
        console.error("Error refreshing activities:", error);
    }
}

// === ฟังก์ชันเริ่มต้นเมื่อ Login สำเร็จ (Offline Mode) ===
function initOfflineData(user) {
    currentUser = user;
    window.appState.currentUser = user;
    
    // ✅ แสดงข้อมูลจาก cache ก่อน
    const cachedActivities = getFromLocalStorage('activities');
    if (cachedActivities && cachedActivities.length > 0) {
        window.activities = cachedActivities;
        window.appState.activities = cachedActivities;
        loadUserActivities(); // ⚡ UI มาแล้ว
        console.log('⚡ Render activities from cache');
    }
    
    console.log("💾 เริ่มโหลดข้อมูลจาก IndexedDB สำหรับ:", user?.email || 'local user');
    
    // ✅ เรียกใช้งาน IndexedDB
    setupOfflineData();
    
    // ✅ ใช้ document.visibilitychange สำหรับรีเฟรชข้อมูล
    setupVisibilityReload();
}

// === ฟังก์ชันเคลียร์หน้าจอเมื่อ Logout ===
function clearDataOnLogout() {
    currentUser = null;
    window.appState.currentUser = null;
    window.appState.activities = [];
    window.activities = [];
    
    // ✅ ลบเฉพาะ session user ไม่ล้าง cache ทั้งหมด
    localStorage.removeItem('currentUser');
    
    // รีเซ็ตตัวแปร autoSelect
    autoSelectDone = false;
    
    // โหลดหน้าจอใหม่
    loadUserActivities();
}

// === ฟังก์ชัน Helper: สร้างข้อมูลเริ่มต้นลง IndexedDB (ถ้ายังไม่มี) ===
async function initializeDefaultDataToIndexedDB() {
    try {
        const config = await dbSettings.getConfig();
        
        if (!config.persons || !config.activityTypes) {
            const defaultPersons = [{ name: 'อาจารย์' }, { name: 'ลูกศิษย์' }, { name: 'เด็กวัด' }];
            const defaultActivityTypes = [{ name: 'นั่งสมาธิ' }, { name: 'เดินจงกรม' }, { name: 'สวดมนต์' }];
            
            await dbSettings.saveConfig({
                persons: defaultPersons,
                activityTypes: defaultActivityTypes
            });
            
            console.log('✅ สร้างข้อมูลเริ่มต้นใน IndexedDB');
        }
    } catch (error) {
        console.error("Error initializing default data:", error);
    }
}

// === ฟังก์ชันหลักสำหรับระบบบันทึกกิจกรรม ===
let editingIndex = null;
let editingActivityId = null;
let summaryContext = {};

// === ฟังก์ชันจัดการ Local Storage ===
function getFromLocalStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
        return false;
    }
}

// === ฟังก์ชันแสดงสถานะรหัสผ่านสำรองข้อมูล ===
function renderBackupPasswordStatus() {
    const passwordStatus = document.getElementById('password-status');
    if (!passwordStatus) return;
    
    if (window.appState.backupPassword) {
        passwordStatus.textContent = 'สถานะ: ตั้งรหัสผ่านแล้ว (ไฟล์สำรองจะถูกเข้ารหัส)';
        passwordStatus.style.color = '#28a745';
    } else {
        passwordStatus.textContent = 'สถานะ: ยังไม่มีการตั้งรหัสผ่าน (ไฟล์สำรองจะไม่ถูกเข้ารหัส)';
        passwordStatus.style.color = '#f5a623';
    }
    
    console.log(`🔐 อัพเดตสถานะรหัสผ่าน: ${window.appState.backupPassword ? 'ตั้งแล้ว' : 'ยังไม่ตั้ง'}`);
}

// === ฟังก์ชันแสดงแจ้งเตือน ===
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.error('❌ ไม่พบ element toast');
        return;
    }
    
    toast.style.display = 'none';
    toast.style.opacity = '0';
    toast.classList.remove('show');
    
    toast.textContent = message;
    toast.className = `toast-notification ${type}`;
    
    setTimeout(() => {
        toast.style.display = 'block';
        setTimeout(() => {
            toast.classList.add('show');
            toast.style.opacity = '1';
        }, 10);
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 3000);
    
    console.log(`🔔 แจ้งเตือน: ${message}`);
}

// === ฟังก์ชันแจ้งเตือนการบันทึกกิจกรรม ===
function notifyActivitySaved(isUpdate = false) {
    const message = isUpdate ? 'อัปเดตกิจกรรมเรียบร้อยแล้ว' : 'บันทึกกิจกรรมใหม่เรียบร้อยแล้ว';
    showToast(message, 'success');
}

// === ฟังก์ชันแจ้งเตือนการลบกิจกรรม ===
function notifyActivityDeleted() {
    showToast('ลบกิจกรรมเรียบร้อยแล้ว', 'success');
}

// === ฟังก์ชันแจ้งเตือนการแก้ไขข้อมูลพื้นฐาน ===
function notifyDataUpdated(dataType, action) {
    const messages = {
        'person': {
            'add': 'เพิ่มผู้ทำกิจกรรมเรียบร้อยแล้ว',
            'edit': 'แก้ไขผู้ทำกิจกรรมเรียบร้อยแล้ว',
            'delete': 'ลบผู้ทำกิจกรรมเรียบร้อยแล้ว',
            'reset': 'คืนค่าผู้ทำกิจกรรมเรียบร้อยแล้ว'
        },
        'activityType': {
            'add': 'เพิ่มประเภทกิจกรรมเรียบร้อยแล้ว',
            'edit': 'แก้ไขประเภทกิจกรรมเรียบร้อยแล้ว',
            'delete': 'ลบประเภทกิจกรรมเรียบร้อยแล้ว',
            'reset': 'คืนค่าประเภทกิจกรรมเรียบร้อยแล้ว'
        }
    };
    
    if (messages[dataType] && messages[dataType][action]) {
        showToast(messages[dataType][action], 'success');
    }
}

// === ฟังก์ชันแจ้งเตือนการจัดการข้อมูล ===
function notifyDataManagement(action) {
    const messages = {
        'backup': 'สำรองข้อมูลเรียบร้อยแล้ว',
        'restore': 'กู้คืนข้อมูลเรียบร้อยแล้ว',
        'clean': 'ทำความสะอาดข้อมูลเรียบร้อยแล้ว',
        'save': 'บันทึกข้อมูลชั่วคราวเรียบร้อยแล้ว',
        'export': 'ส่งออกข้อมูลเรียบร้อยแล้ว',
        'deleteByDate': 'ลบกิจกรรมตามวันที่เรียบร้อยแล้ว'
    };
    
    if (messages[action]) {
        showToast(messages[action], 'success');
    }
}

// === ฟังก์ชันคำนวณเวลาเริ่มต้นจากเวลาสิ้นสุดและระยะเวลา ===
function calculateStartTime() {
    const endTime = document.getElementById('end-time').value;
    const durationHours = parseInt(document.getElementById('duration-hours').value) || 0;
    const durationMinutes = parseInt(document.getElementById('duration-minutes').value) || 0;
    
    if (!endTime) {
        return;
    }
    
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(endHours, endMinutes, 0, 0);
    
    const startDate = new Date(endDate.getTime() - (durationHours * 60 * 60 * 1000) - (durationMinutes * 60 * 1000));
    
    const startHours = startDate.getHours().toString().padStart(2, '0');
    const startMinutes = startDate.getMinutes().toString().padStart(2, '0');
    
    const startTime = `${startHours}:${startMinutes}`;
    
    document.getElementById('start-time').value = startTime;
    
    console.log(`⏰ คำนวณเวลา: สิ้นสุด ${endTime} - ${durationHours}ชม.${durationMinutes}น. = เริ่มต้น ${startTime}`);
}

// === ฟังก์ชันคำนวณระยะเวลา ===
function calculateDuration(start, end) {
    const startDate = new Date(`2000-01-01T${start}`);
    const endDate = new Date(`2000-01-01T${end}`);

    if (isNaN(startDate) || isNaN(endDate)) {
        return 0;
    }

    if (endDate < startDate) {
        endDate.setDate(endDate.getDate() + 1);
    }

    const diffMilliseconds = endDate - startDate;
    return diffMilliseconds / (1000 * 60);
}

function formatDuration(minutes) {
    if (isNaN(minutes) || minutes < 0) return "เวลาไม่ถูกต้อง";
    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let parts = [];
    if (hours > 0) parts.push(`${hours} ชั่วโมง`);
    if (remainingMinutes > 0) parts.push(`${remainingMinutes} นาที`);
    if (seconds > 0 && hours === 0 && remainingMinutes === 0) parts.push(`${seconds} วินาที`);
    
    if (parts.length === 0) return "0 นาที";
    return parts.join(' ');
}

// === ฟังก์ชันจัดการเวลาไทย ===
function getThaiDateString() {
    return new Date().toLocaleDateString('en-CA', {
        timeZone: 'Asia/Bangkok'
    });
}

function formatThaiTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// === ฟังก์ชันตั้งค่าเวลาเริ่มต้นและระยะเวลาเริ่มต้น (ปรับปรุง) ===
function setDefaultDateTime() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    document.getElementById('activity-date').value = today;
    
    const endHours = now.getHours().toString().padStart(2, '0');
    const endMinutes = now.getMinutes().toString().padStart(2, '0');
    const endTime = `${endHours}:${endMinutes}`;
    
    document.getElementById('end-time').value = endTime;
    
    document.getElementById('duration-hours').value = 1;
    document.getElementById('duration-minutes').value = 0;
    
    calculateStartTime();
    
    console.log(`⏰ ตั้งค่าเวลาสิ้นสุด: ${endTime}, ระยะเวลา: 1 ชั่วโมง, วันที่: ${today}`);
    
    document.getElementById('save-activity-button').classList.remove('hidden');
    document.getElementById('update-activity-button').classList.add('hidden');
    document.getElementById('cancel-edit-activity-button').classList.add('hidden');
}

// === ฟังก์ชันจัดการฟอร์มกิจกรรม (ฉบับสมบูรณ์: แก้ไขตัวแปรหาย) ===
async function handleActivityFormSubmit(event) {
    if (event) event.preventDefault();

    // --- 1. ดึงค่าจากฟอร์ม (ส่วนที่เคยหายไป) ---
    const activityDropdown = document.getElementById('activityTypeSelect');
    const personSelect = document.getElementById('personSelect');
    
    const activityName = activityDropdown ? activityDropdown.value : '';
    const person = personSelect ? personSelect.value : '';
    
    const date = document.getElementById('activity-date').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const details = document.getElementById('activity-details').value;

    // --- 2. ตรวจสอบความถูกต้อง (Validation) ---
    if (!person) {
        showToast('กรุณาเลือกผู้ทำกิจกรรม', 'warning');
        if(personSelect) personSelect.focus();
        return;
    }
    if (!activityName) {
        showToast('กรุณาเลือกประเภทกิจกรรม', 'warning');
        if(activityDropdown) activityDropdown.focus();
        return;
    }
    
    if (!date || !startTime || !endTime) {
        document.getElementById('activity-message').textContent = 'กรุณากรอกข้อมูลวันและเวลาให้ครบถ้วน';
        return;
    }

    const duration = calculateDuration(startTime, endTime);
    if (duration <= 0) {
        document.getElementById('activity-message').textContent = 'เวลาไม่ถูกต้อง (เวลาเริ่มต้องมาก่อนเวลาจบ)';
        return;
    }

    // --- 3. เตรียมข้อมูลพื้นฐาน ---
    const baseActivityData = {
        activityName: activityName,
        person: person,
        date: date,
        startTime: startTime,
        endTime: endTime,
        details: details
    };

    const saveBtn = document.getElementById('save-activity-button');
    const updateBtn = document.getElementById('update-activity-button');
    if(saveBtn) saveBtn.disabled = true;
    if(updateBtn) updateBtn.disabled = true;

    try {
        if (editingActivityId) {
            // === กรณีแก้ไข (Update) ===
            const updateData = {
                ...baseActivityData,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser?.email || 'local-user'
            };

            // ✅ PART 3: เปลี่ยนจาก Firestore เป็น IndexedDB
            await dbActivities.update(editingActivityId, updateData);
            
            notifyActivitySaved(true);
            resetActivityForm();
            
        } else {
            // === กรณีสร้างใหม่ (Create) ===
            const createData = {
                ...baseActivityData,
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.email || 'local-user',
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser?.email || 'local-user'
            };
            
            // ✅ PART 3: เปลี่ยนจาก Firestore เป็น IndexedDB
            await dbActivities.add(createData);
            
            notifyActivitySaved(false);
            resetActivityForm();
            setTimeout(() => { autoSelectIfSingleOnce(); }, 100); // ✅ STEP 3: เรียกครั้งเดียว
        }
        
        // ✅ PART 3: รีเฟรชข้อมูลหลังเพิ่ม/อัปเดต
        await refreshActivitiesFromIndexedDB();
        
    } catch (error) {
        console.error("Error saving activity:", error);
        showToast('เกิดข้อผิดพลาดในการบันทึก: ' + error.message, 'error');
    } finally {
        if(saveBtn) saveBtn.disabled = false;
        if(updateBtn) updateBtn.disabled = false;
    }
}

// === ฟังก์ชัน Helper: ตัดชื่ออีเมลให้สั้นลงเพื่อแสดงผล ===
function formatUserEmail(email) {
    if (!email) return '-';
    return email.split('@')[0];
}

// === ฟังก์ชันรีเซ็ตฟอร์มกิจกรรม ===
function resetActivityForm() {
    document.getElementById('activity-details').value = '';
    
    document.getElementById('save-activity-button').classList.remove('hidden');
    document.getElementById('update-activity-button').classList.add('hidden');
    document.getElementById('cancel-edit-activity-button').classList.add('hidden');
    
    setDefaultDateTime();
    
    document.getElementById('activity-message').textContent = '';
    
    editingActivityId = null;
}

// === ฟังก์ชันยกเลิกการแก้ไข ===
function cancelEditActivity() {
    resetActivityForm();
}

// === ฟังก์ชันเลือกอัตโนมัติเมื่อมีตัวเลือกเดียว (เดิม) ===
function autoSelectIfSingle() {
    console.log('🔍 กำลังตรวจสอบการเลือกอัตโนมัติ...');
    
    // ตรวจสอบผู้ทำกิจกรรม
    const allPersons = getFromLocalStorage('persons') || [];
    const personDropdown = document.getElementById('personSelect');
    
    // STEP 7: ป้องกัน error DOM ยังไม่พร้อม
    if (!personDropdown) return;
    
    const realPersonOptions = Array.from(personDropdown.options).filter(opt => 
        opt.value !== ''
    );
    
    if (realPersonOptions.length === 1) {
        const selectedValue = realPersonOptions[0].value;
        personDropdown.value = selectedValue;
        console.log(`✅ เลือกผู้ทำกิจกรรมอัตโนมัติ: ${selectedValue}`);
        updateCurrentPersonDisplay();
    }
    
    // ตรวจสอบประเภทกิจกรรม
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    const activityTypeDropdown = document.getElementById('activityTypeSelect');
    
    if (!activityTypeDropdown) return;
    
    const realActivityTypeOptions = Array.from(activityTypeDropdown.options).filter(opt => 
        opt.value !== ''
    );
    
    if (realActivityTypeOptions.length === 1) {
        const selectedValue = realActivityTypeOptions[0].value;
        activityTypeDropdown.value = selectedValue;
        console.log(`✅ เลือกประเภทกิจกรรมอัตโนมัติ: ${selectedValue}`);
    }
}

// ✅ STEP 3: ฟังก์ชันเลือกอัตโนมัติเมื่อมีตัวเลือกเดียว (เรียกครั้งเดียว)
function autoSelectIfSingleOnce() {
    if (autoSelectDone) return;
    autoSelectDone = true;
    autoSelectIfSingle();
}

// === ฟังก์ชันจัดการ Dropdown ===
function showSelectedValueDisplay(type, value) {
    const dropdown = document.getElementById(`${type}Select`);
    const wrapper = dropdown.closest('.select-wrapper');
    
    if (!wrapper) {
        console.error(`❌ ไม่พบ wrapper สำหรับ ${type}`);
        return;
    }
    
    const existingDisplay = wrapper.querySelector('.selected-value-display');
    if (existingDisplay) {
        existingDisplay.remove();
    }
    
    const displayElement = document.createElement('div');
    displayElement.className = 'selected-value-display';
    
    const typeLabel = type === 'person' ? '' : '';
    
    displayElement.innerHTML = `
        <div class="selected-value-container">
            <span class="selected-value-label">${typeLabel}</span>
            <span class="selected-value">${value}</span>
            <span class="selected-value-note"></span>
        </div>
    `;
    
    wrapper.insertBefore(displayElement, dropdown);
    wrapper.classList.add('hide-dropdown');
    
    console.log(`✅ แสดงค่าที่เลือกสำหรับ ${type}: ${value}`);
    
    if (type === 'person') {
        updateCurrentPersonDisplay();
    }
}

function showDropdown(type) {
    const dropdown = document.getElementById(`${type}Select`);
    const wrapper = dropdown.closest('.select-wrapper');
    
    if (!wrapper) return;
    
    const displayElement = wrapper.querySelector('.selected-value-display');
    if (displayElement) {
        displayElement.remove();
    }
    
    wrapper.classList.remove('hide-dropdown');
    
    console.log(`✅ แสดง dropdown ปกติสำหรับ ${type}`);
    
    if (type === 'person') {
        updateCurrentPersonDisplay();
    }
}

function resetAutoSelectionDisplay(type) {
    console.log(`🔄 รีเซ็ตการแสดงผลสำหรับ ${type}`);
    showDropdown(type);
    
    setTimeout(() => {
        autoSelectIfSingleOnce(); // ✅ STEP 3: เรียกครั้งเดียว
    }, 100);
}

// === ฟังก์ชันจัดการ Dropdown ผู้ทำกิจกรรม ===
function populatePersonDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const allPersons = getFromLocalStorage('persons') || [];
    
    allPersons.sort((a, b) => a.name.localeCompare(b.name, 'th'));

    const selectedValue = dropdown.value;
    
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    allPersons.forEach(person => {
        const option = document.createElement('option');
        option.value = person.name;
        option.textContent = person.name;
        dropdown.appendChild(option);
    });
    
    setTimeout(() => {
        autoSelectIfSingleOnce(); // ✅ STEP 3: เรียกครั้งเดียว
    }, 0);
    
    updateCurrentPersonDisplay();
    
    if (selectedValue && Array.from(dropdown.options).some(opt => opt.value === selectedValue)) {
        dropdown.value = selectedValue;
        updateCurrentPersonDisplay();
    }
}

// === ฟังก์ชันจัดการ Dropdown ประเภทกิจกรรม ===
function populateActivityTypeDropdowns(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    allActivityTypes.sort((a, b) => a.name.localeCompare(b.name, 'th'));

    const selectedValue = dropdown.value;
    
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
    
    allActivityTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.name;
        option.textContent = type.name;
        dropdown.appendChild(option);
    });
    
    setTimeout(() => {
        autoSelectIfSingleOnce(); // ✅ STEP 3: เรียกครั้งเดียว
    }, 0);
    
    if (selectedValue && Array.from(dropdown.options).some(opt => opt.value === selectedValue)) {
        dropdown.value = selectedValue;
    }
}

// === ฟังก์ชันจัดการผู้ทำกิจกรรม ===
function addPerson() {
    document.getElementById('personModalTitle').textContent = 'เพิ่มผู้ทำกิจกรรม';
    document.getElementById('modalPersonName').value = '';
    document.getElementById('personEditValue').value = '';
    document.getElementById('personModal').style.display = 'flex';
}

function editPerson() {
    const dropdown = document.getElementById('personSelect');
    const selectedValue = dropdown.value;
    
    if (!selectedValue) {
        alert('กรุณาเลือกผู้ทำกิจกรรมที่ต้องการแก้ไข');
        return;
    }
    
    document.getElementById('personModalTitle').textContent = 'แก้ไขผู้ทำกิจกรรม';
    document.getElementById('modalPersonName').value = selectedValue;
    document.getElementById('personEditValue').value = selectedValue;
    document.getElementById('personModal').style.display = 'flex';
}

// === ฟังก์ชันลบผู้ทำกิจกรรม ===
function deletePerson(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
    
    console.log('🔄 เริ่มฟังก์ชันลบผู้ทำกิจกรรม');
    
    if (window.isDeletingPerson) {
        console.log('⏳ กำลังลบอยู่แล้ว กรุณารอสักครู่...');
        return;
    }
    
    window.isDeletingPerson = true;
    
    try {
        setTimeout(() => {
            performPersonDeletionProcess();
        }, 100);
    } catch (error) {
        console.error('❌ ข้อผิดพลาดในฟังก์ชันลบ:', error);
        window.isDeletingPerson = false;
    }
}

function performPersonDeletionProcess() {
    const dropdown = document.getElementById('personSelect');
    if (!dropdown) return;
    
    const selectedValue = dropdown.value;
    
    if (!selectedValue || selectedValue === '') {
        showToast('กรุณาเลือกผู้ทำกิจกรรมที่ต้องการลบ', 'warning');
        window.isDeletingPerson = false;
        return;
    }
    
    const activityCount = getActivityCountByPerson(selectedValue);
    showDeletionConfirmation(selectedValue, activityCount);
}

// === ฟังก์ชันลบผู้ทำกิจกรรมจาก IndexedDB ===
async function executePersonDeletion(personName, activityCount) {
    try {
        // ดึง config ปัจจุบัน
        const config = await dbSettings.getConfig();
        let allPersons = config.persons || [];
        
        // กรองผู้ทำกิจกรรมออก
        const newPersons = allPersons.filter(p => p.name !== personName);
        
        // บันทึก config ใหม่
        await dbSettings.saveConfig({
            ...config,
            persons: newPersons
        });
        
        // ลบกิจกรรมที่เกี่ยวข้อง
        if (activityCount > 0) {
            await deleteRelatedActivitiesByField('person', personName);
        }
        
        showToast(`ลบ "${personName}" เรียบร้อย`, 'success');
        window.isDeletingPerson = false;
        
        // อัพเดท UI
        document.getElementById('personSelect').value = '';
        updateCurrentPersonDisplay();
        
        // โหลดข้อมูลใหม่
        await setupOfflineData();
        
    } catch (error) {
        console.error("Delete failed: ", error);
        showToast('ลบไม่สำเร็จ: ' + error, 'error');
        window.isDeletingPerson = false;
    }
}

// === ฟังก์ชันแสดงการยืนยันการลบ ===
function showDeletionConfirmation(personName, activityCount) {
    let message = `คุณแน่ใจว่าต้องการลบ "${personName}" ใช่หรือไม่?`;
    
    if (activityCount > 0) {
        message += `\n\n⚠️  คำเตือน: มีกิจกรรมที่ใช้ผู้ทำกิจกรรมนี้อยู่ ${activityCount} รายการ\n`;
        message += `กิจกรรมเหล่านี้จะถูกลบออกทั้งหมด!`;
    }
    
    console.log(`💬 ข้อความยืนยัน: ${message}`);
    
    const userConfirmed = confirm(message);
    
    if (userConfirmed) {
        console.log(`✅ ผู้ใช้ยืนยันการลบ "${personName}"`);
        executePersonDeletion(personName, activityCount);
    } else {
        console.log('❌ ผู้ใช้ยกเลิกการลบ');
        window.isDeletingPerson = false;
    }
}

// === ฟังก์ชันอัพเดท UI หลังลบสำเร็จ ===
function updateUIAfterSuccessfulDeletion(personName, activityCount) {
    console.log('🎨 กำลังอัพเดท UI...');
    
    populatePersonDropdown('personSelect');
    console.log('✅ อัพเดท dropdown ผู้ทำกิจกรรมเรียบร้อย');
    
    updatePersonFilterAfterChange();
    console.log('✅ อัพเดทตัวกรองผู้ทำกิจกรรมเรียบร้อย');
    
    loadUserActivities();
    console.log('✅ โหลดกิจกรรมใหม่เรียบร้อย');
    
    resetAutoSelectionDisplay('person');
    console.log('✅ รีเซ็ตการเลือกอัตโนมัติเรียบร้อย');
    
    let successMessage = `ลบผู้ทำกิจกรรม "${personName}" เรียบร้อยแล้ว`;
    if (activityCount > 0) {
        successMessage += ` และลบกิจกรรมที่เกี่ยวข้อง ${activityCount} รายการ`;
    }
    
    showToast(successMessage, 'success');
    console.log(`✅ แสดงข้อความสำเร็จ: ${successMessage}`);
}

// === ฟังก์ชันสำหรับอัปเดตข้อมูลย้อนหลังใน IndexedDB ===
async function updateHistoricalDataInIndexedDB(field, oldValue, newValue) {
    if (!oldValue || !newValue || oldValue === newValue) return;

    showToast(`⏳ กำลังอัปเดตข้อมูลย้อนหลัง จาก "${oldValue}" เป็น "${newValue}"...`, 'info');
    console.log(`🔄 Start updating history: ${field} | ${oldValue} -> ${newValue}`);

    try {
        const allActivities = await dbActivities.getAll();
        
        if (allActivities.length === 0) {
            console.log("✅ ไม่พบข้อมูลเก่าที่ต้องแก้ไข");
            return;
        }

        const activitiesToUpdate = allActivities.filter(activity => activity[field] === oldValue);
        const totalDocs = activitiesToUpdate.length;
        
        if (totalDocs === 0) {
            console.log("✅ ไม่พบข้อมูลเก่าที่ต้องแก้ไข");
            return;
        }

        console.log(`📊 พบข้อมูลต้องแก้ไข: ${totalDocs} รายการ`);

        // อัปเดตทีละรายการ
        for (const activity of activitiesToUpdate) {
            const updateData = {
                ...activity,
                [field]: newValue,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser?.email || 'local-user'
            };
            await dbActivities.update(activity.id, updateData);
        }

        showToast(`✅ อัปเดตข้อมูลย้อนหลัง ${totalDocs} รายการ เรียบร้อยแล้ว`, 'success');

        // รีเฟรชข้อมูล
        await refreshActivitiesFromIndexedDB();

    } catch (error) {
        console.error("❌ Error updating historical data:", error);
        showToast('เกิดข้อผิดพลาดในการอัปเดตข้อมูลย้อนหลัง: ' + error.message, 'error');
    }
}

// === ฟังก์ชันบันทึกผู้ทำกิจกรรม (ปรับปรุงสำหรับ IndexedDB) ===
async function savePerson(e) {
    if (e) e.preventDefault();

    const personName = document.getElementById('modalPersonName').value.trim();
    const editValue = document.getElementById('personEditValue').value;
    
    if (!personName) {
        showToast('กรุณากรอกชื่อผู้ทำกิจกรรม', 'error');
        return;
    }

    try {
        const config = await dbSettings.getConfig();
        let allPersons = config.persons || [];
        let isUpdated = false;

        if (editValue) {
            // แก้ไข
            const index = allPersons.findIndex(p => p.name === editValue);
            if (index !== -1) {
                allPersons[index].name = personName;
                isUpdated = true;
            }
        } else {
            // เพิ่มใหม่
            if (allPersons.some(p => p.name === personName)) {
                showToast('มีรายชื่อนี้อยู่แล้ว', 'warning');
                return;
            }
            allPersons.push({ name: personName });
            isUpdated = true;
        }

        if (isUpdated) {
            await dbSettings.saveConfig({
                ...config,
                persons: allPersons
            });
            
            closePersonModal();
            
            if (editValue && editValue !== personName) {
                showToast('บันทึกชื่อเรียบร้อย กำลังซิงค์ข้อมูลย้อนหลัง...', 'success');
                await updateHistoricalDataInIndexedDB('person', editValue, personName);
            } else {
                showToast(editValue ? 'แก้ไขชื่อเรียบร้อย' : 'เพิ่มผู้ทำกิจกรรมเรียบร้อย', 'success');
            }

            document.getElementById('modalPersonName').value = '';
            document.getElementById('personEditValue').value = '';
            
            // โหลดข้อมูลใหม่
            await setupOfflineData();
        }

    } catch (error) {
        console.error("Save person failed: ", error);
        showToast('บันทึกไม่สำเร็จ: ' + error.message, 'error');
    }
}

// === ฟังก์ชันลบกิจกรรมที่เกี่ยวข้อง (ใช้ร่วมกันทั้ง Person และ ActivityType) ===
async function deleteRelatedActivitiesByField(fieldName, value) {
    console.log(`🗑️ กำลังลบกิจกรรมที่ ${fieldName} = "${value}"...`);
    
    try {
        const allActivities = await dbActivities.getAll();
        const activitiesToDelete = allActivities.filter(activity => activity[fieldName] === value);
        
        if (activitiesToDelete.length === 0) return;
        
        // ลบทีละรายการ
        for (const activity of activitiesToDelete) {
            await dbActivities.delete(activity.id);
        }
        
        console.log(`✅ ลบกิจกรรมที่เกี่ยวข้องสำเร็จ: ${activitiesToDelete.length} รายการ`);
        
        // รีเฟรชข้อมูล
        await refreshActivitiesFromIndexedDB();
        
    } catch (error) {
        console.error("Error deleting related activities:", error);
        throw error;
    }
}

function resetPerson() {
    if (!confirm('คุณแน่ใจว่าต้องการคืนค่าผู้ทำกิจกรรมเป็นค่าเริ่มต้น? การกระทำนี้จะลบผู้ทำกิจกรรมทั้งหมดที่คุณเพิ่มไว้')) {
        return;
    }
    
    const defaultPersons = [
        { name: 'ท่านอาจารย์' },
        { name: 'ลูกศิษย์' },
        { name: 'อาคันตุกะ' },
    ];
    
    saveToLocalStorage('persons', defaultPersons);
    populatePersonDropdown('personSelect');
    
    updatePersonFilterAfterChange();
    
    notifyDataUpdated('person', 'reset');
    
    setTimeout(() => {
        autoSelectIfSingleOnce(); // ✅ STEP 3: เรียกครั้งเดียว
    }, 100);
}

function closePersonModal() {
    document.getElementById('personModal').style.display = 'none';
}

// === ฟังก์ชันจัดการประเภทกิจกรรม ===
function addActivityType() {
    document.getElementById('activityTypeModalTitle').textContent = 'เพิ่มประเภทกิจกรรม';
    document.getElementById('modalActivityTypeName').value = '';
    document.getElementById('activityTypeEditValue').value = '';
    document.getElementById('activityTypeModal').style.display = 'flex';
}

function editActivityType() {
    const dropdown = document.getElementById('activityTypeSelect');
    const selectedValue = dropdown.value;
    
    if (!selectedValue) {
        alert('กรุณาเลือกประเภทกิจกรรมที่ต้องการแก้ไข');
        return;
    }
    
    document.getElementById('activityTypeModalTitle').textContent = 'แก้ไขประเภทกิจกรรม';
    document.getElementById('modalActivityTypeName').value = selectedValue;
    document.getElementById('activityTypeEditValue').value = selectedValue;
    document.getElementById('activityTypeModal').style.display = 'flex';
}

// === ฟังก์ชันลบประเภทกิจกรรม ===
async function deleteActivityType() {
    const dropdown = document.getElementById('activityTypeSelect');
    const selectedValue = dropdown.value;
    
    if (!selectedValue) { 
        showToast('กรุณาเลือกประเภทที่ต้องการลบ', 'warning'); 
        return; 
    }
    
    // เช็คจำนวนกิจกรรมที่ใช้อยู่
    const activityCount = getActivityCountByType(selectedValue);
    let message = `ยืนยันการลบประเภท "${selectedValue}"?`;
    
    if (activityCount > 0) {
        message += `\n\⚠️ มีกิจกรรมที่ใช้ประเภทนี้อยู่ ${activityCount} รายการ\nกิจกรรมเหล่านี้จะถูกลบออกทั้งหมด!`;
    }

    if (!confirm(message)) return;

    try {
        const config = await dbSettings.getConfig();
        let allTypes = config.activityTypes || [];
        const newTypes = allTypes.filter(t => t.name !== selectedValue);
        
        await dbSettings.saveConfig({
            ...config,
            activityTypes: newTypes
        });
        
        // ลบกิจกรรมที่เกี่ยวข้อง
        if (activityCount > 0) {
            await deleteRelatedActivitiesByField('activityName', selectedValue);
        }
        
        showToast(`ลบประเภท "${selectedValue}" เรียบร้อย`, 'success');
        dropdown.value = ''; // เคลียร์ค่าที่เลือก
        
        // โหลดข้อมูลใหม่
        await setupOfflineData();
        
    } catch (error) {
        showToast('ลบไม่สำเร็จ: ' + error.message, 'error');
    }
}

// === ฟังก์ชันรีเซ็ตประเภทกิจกรรม ===
async function resetActivityType() {
    if (!confirm('ยืนยันคืนค่าประเภทกิจกรรมเป็นค่าเริ่มต้น? (ข้อมูลปัจจุบันจะหายไป)')) {
        return;
    }
    
    try {
        const defaultActivityTypes = [
            { name: 'นั่งสมาธิ' },
            { name: 'เดินจงกรม' },
            { name: 'สวดมนต์' }
        ];
        
        const config = await dbSettings.getConfig();
        await dbSettings.saveConfig({
            ...config,
            activityTypes: defaultActivityTypes
        });
        
        showToast('คืนค่าประเภทกิจกรรมเรียบร้อยแล้ว', 'success');
        document.getElementById('activityTypeSelect').value = '';
        
        // โหลดข้อมูลใหม่
        await setupOfflineData();
        
    } catch (error) {
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
}

// === ฟังก์ชันบันทึกประเภทกิจกรรม (ปรับปรุงสำหรับ IndexedDB) ===
async function saveActivityType(e) {
    if (e) e.preventDefault();

    const activityTypeName = document.getElementById('modalActivityTypeName').value.trim();
    const editValue = document.getElementById('activityTypeEditValue').value;
    
    if (!activityTypeName) { showToast('กรุณากรอกชื่อประเภท', 'error'); return; }

    try {
        const config = await dbSettings.getConfig();
        let allTypes = config.activityTypes || [];
        let isUpdated = false;

        if (editValue) {
            // แก้ไข
            const index = allTypes.findIndex(t => t.name === editValue);
            if (index !== -1) {
                allTypes[index].name = activityTypeName;
                isUpdated = true;
            }
        } else {
            // เพิ่มใหม่
            if (allTypes.some(t => t.name === activityTypeName)) {
                showToast('มีประเภทนี้อยู่แล้ว', 'warning');
                return;
            }
            allTypes.push({ name: activityTypeName });
            isUpdated = true;
        }

        if (isUpdated) {
            await dbSettings.saveConfig({
                ...config,
                activityTypes: allTypes
            });
            
            closeActivityTypeModal();

            if (editValue && editValue !== activityTypeName) {
                showToast('บันทึกประเภทกิจกรรมเรียบร้อย กำลังซิงค์ข้อมูลย้อนหลัง...', 'success');
                await updateHistoricalDataInIndexedDB('activityName', editValue, activityTypeName);
            } else {
                showToast('บันทึกประเภทกิจกรรมเรียบร้อย', 'success');
            }
            
            document.getElementById('modalActivityTypeName').value = '';
            document.getElementById('activityTypeEditValue').value = '';
            
            // โหลดข้อมูลใหม่
            await setupOfflineData();
        }

    } catch (error) {
        if (error.message && error.message.includes("มีประเภทนี้อยู่แล้ว")) {
            showToast('มีประเภทนี้อยู่แล้ว', 'warning');
        } else {
            showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
        }
    }
}

function closeActivityTypeModal() {
    document.getElementById('activityTypeModal').style.display = 'none';
}

// === ฟังก์ชันจัดการการแสดงผลปุ่มการจัดการ ===
function toggleManagementActions(actionsId, otherActionsId) {
    const actions = document.getElementById(actionsId);
    const otherActions = document.getElementById(otherActionsId);
    
    if (!actions) {
        console.error(`❌ ไม่พบ element: ${actionsId}`);
        return;
    }
    
    if (otherActions) {
        otherActions.style.display = 'none';
        otherActions.classList.remove('active');
    }
    
    if (actions.style.display === 'flex' || actions.classList.contains('active')) {
        actions.style.display = 'none';
        actions.classList.remove('active');
    } else {
        actions.style.display = 'flex';
        actions.classList.add('active');
        
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                actions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    }
    
    console.log(`🔄 สลับการแสดงผล ${actionsId}: ${actions.style.display}`);
}

// === ฟังก์ชันจัดการกิจกรรม (เวอร์ชัน Offline) ===
function loadUserActivities() {
    // ใช้ window.activities จาก IndexedDB
    const activitiesData = window.activities || window.appState.activities || [];
    
    const tbody = document.getElementById('activityBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (activitiesData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="7" style="text-align: center; padding: 20px;">ไม่มีกิจกรรมที่บันทึกไว้</td>`;
        tbody.appendChild(row);
        return;
    }
    
    const sortedActivities = [...activitiesData].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.startTime.localeCompare(a.startTime);
    });
    
    sortedActivities.forEach((activity) => {
        const row = document.createElement('tr');
        
        const duration = calculateDuration(activity.startTime, activity.endTime);
        const formattedDuration = formatDuration(duration);
        const displayDate = formatDateForDisplay(activity.date);

        let userLogHTML = '';
        if (activity.createdBy) {
            userLogHTML += `<div style="font-size: 0.7rem; color: #888; margin-top: 6px; border-top: 1px dotted #ddd; padding-top: 2px;">`;
            
            userLogHTML += `📥 สร้าง: <b>${formatUserEmail(activity.createdBy)}</b>`;
            
            if (activity.updatedBy && activity.updatedBy !== activity.createdBy) {
                userLogHTML += `<br>✏️ แก้ไข: <b>${formatUserEmail(activity.updatedBy)}</b>`;
            } else if (activity.updatedBy) {
                 userLogHTML += ` (อัปเดตล่าสุด)`;
            }
            userLogHTML += `</div>`;
        }

        row.innerHTML = `
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayDate}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${activity.startTime} - ${activity.endTime}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${activity.person}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${activity.activityName}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${formattedDuration}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: left;">
                ${activity.details || '-'}
                ${userLogHTML} </td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                <button onclick="editActivity('${activity.id}')" style="background-color: #ffc107; color: black; margin: 2px; border-radius: 4px; padding: 4px 8px; cursor: pointer; border: 1px solid #d39e00;">แก้ไข</button>
                <button onclick="deleteActivity('${activity.id}')" style="background-color: #dc3545; color: white; margin: 2px; border-radius: 4px; padding: 4px 8px; cursor: pointer; border: 1px solid #bd2130;">ลบ</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    console.log(`✅ อัปเดตตารางกิจกรรมเรียบร้อย (${sortedActivities.length} รายการ)`);
}

function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = (date.getFullYear() + 543).toString();
    
    return `${day}/${month}/${year}`;
}

// === ฟังก์ชันแก้ไขกิจกรรม ===
function editActivity(activityId) {
    const allActivities = window.activities || window.appState.activities || [];
    const activity = allActivities.find(a => a.id === activityId);
    
    if (!activity) return;
    
    document.getElementById('personSelect').value = activity.person;
    document.getElementById('activityTypeSelect').value = activity.activityName;
    document.getElementById('activity-date').value = activity.date;
    document.getElementById('start-time').value = activity.startTime;
    document.getElementById('end-time').value = activity.endTime;
    document.getElementById('activity-details').value = activity.details || '';
    
    const duration = calculateDuration(activity.startTime, activity.endTime);
    const durationHours = Math.floor(duration / 60);
    const durationMinutes = duration % 60;
    
    document.getElementById('duration-hours').value = durationHours;
    document.getElementById('duration-minutes').value = durationMinutes;
    
    document.getElementById('save-activity-button').classList.add('hidden');
    document.getElementById('update-activity-button').classList.remove('hidden');
    document.getElementById('cancel-edit-activity-button').classList.remove('hidden');
    
    editingActivityId = activityId;
    
    document.getElementById('add-activity-section').scrollIntoView({ behavior: 'smooth' });
}

// === ฟังก์ชันลบกิจกรรม (Offline Mode) ===
async function deleteActivity(activityId) {
    if (!confirm('คุณแน่ใจว่าต้องการลบกิจกรรมนี้?')) {
        return;
    }

    try {
        // ✅ PART 3: เปลี่ยนจาก Firestore เป็น IndexedDB
        await dbActivities.delete(activityId);
        notifyActivityDeleted();
        
        // รีเฟรชข้อมูล
        await refreshActivitiesFromIndexedDB();
        
    } catch (error) {
        console.error("Error removing activity: ", error);
        showToast('ลบกิจกรรมไม่สำเร็จ: ' + error.message, 'error');
    }
}

// === ฟังก์ชันตรวจสอบว่ามีกิจกรรมที่ใช้ผู้ทำกิจกรรมนี้อยู่หรือไม่ ===
function checkPersonUsage(personName) {
    const allActivities = window.activities || window.appState.activities || [];
    return allActivities.some(activity => activity.person === personName);
}

// === ฟังก์ชันตรวจสอบว่ามีกิจกรรมที่ใช้ประเภทกิจกรรมนี้อยู่หรือไม่ ===
function checkActivityTypeUsage(activityTypeName) {
    const allActivities = window.activities || window.appState.activities || [];
    return allActivities.some(activity => activity.activityName === activityTypeName);
}

// === ฟังก์ชันนับจำนวนกิจกรรมตามผู้ทำกิจกรรม ===
function getActivityCountByPerson(personName) {
    const allActivities = window.activities || window.appState.activities || [];
    const count = allActivities.filter(activity => activity.person === personName).length;
    console.log(`🔢 นับกิจกรรมสำหรับ "${personName}": ${count} รายการ`);
    return count;
}

// === ฟังก์ชันนับจำนวนกิจกรรมตามประเภทกิจกรรม ===
function getActivityCountByType(activityTypeName) {
    const allActivities = window.activities || window.appState.activities || [];
    return allActivities.filter(activity => activity.activityName === activityTypeName).length;
}

// === ฟังก์ชันการเข้ารหัสและถอดรหัส ===
function arrayBufferToBase64(buffer) { 
    let binary = ''; 
    const bytes = new Uint8Array(buffer); 
    const len = bytes.byteLength; 
    for (let i = 0; i < len; i++) { 
        binary += String.fromCharCode(bytes[i]); 
    } 
    return window.btoa(binary); 
}

function base64ToArrayBuffer(base64) { 
    const binary_string = window.atob(base64); 
    const len = binary_string.length; 
    const bytes = new Uint8Array(len); 
    for (let i = 0; i < len; i++) { 
        bytes[i] = binary_string.charCodeAt(i); 
    } 
    return bytes.buffer; 
}

async function deriveKey(password, salt) { 
    const enc = new TextEncoder(); 
    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']); 
    return window.crypto.subtle.deriveKey({ 
        "name": 'PBKDF2', 
        salt: salt, 
        "iterations": 100000, 
        "hash": 'SHA-256' 
    }, keyMaterial, { 
        "name": 'AES-GCM', 
        "length": 256 
    }, true, [ "encrypt", "decrypt" ] ); 
}

async function encryptData(dataString, password) { 
    const salt = window.crypto.getRandomValues(new Uint8Array(16)); 
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); 
    const key = await deriveKey(password, salt); 
    const enc = new TextEncoder(); 
    const encodedData = enc.encode(dataString); 
    const encryptedContent = await window.crypto.subtle.encrypt({ 
        name: 'AES-GCM', 
        iv: iv 
    }, key, encodedData); 
    return { 
        isEncrypted: true, 
        salt: arrayBufferToBase64(salt), 
        iv: arrayBufferToBase64(iv), 
        encryptedData: arrayBufferToBase64(encryptedContent) 
    }; 
}

async function decryptData(encryptedPayload, password) { 
    try { 
        const salt = base64ToArrayBuffer(encryptedPayload.salt); 
        const iv = base64ToArrayBuffer(encryptedPayload.iv); 
        const data = base64ToArrayBuffer(encryptedPayload.encryptedData); 
        const key = await deriveKey(password, salt); 
        const decryptedContent = await window.crypto.subtle.decrypt({ 
            name: 'AES-GCM', 
            iv: iv 
        }, key, data); 
        const dec = new TextDecoder(); 
        return dec.decode(decryptedContent); 
    } catch (e) { 
        console.error("Decryption failed:", e); 
        return null; 
    } 
}

// === ฟังก์ชันจัดการรหัสผ่านสำรองข้อมูล (Offline Mode) ===
async function saveBackupPassword(e) {
    if (e) e.preventDefault();
    
    const newPassword = document.getElementById('backup-password').value;
    const confirmPassword = document.getElementById('backup-password-confirm').value;
    
    if (!newPassword) {
        clearBackupPassword();
        return;
    }
    
    if (newPassword !== confirmPassword) {
        alert('รหัสผ่านไม่ตรงกัน กรุณากรอกใหม่อีกครั้ง');
        return;
    }
    
    if (newPassword.length < 4) {
        alert('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
        return;
    }
    
    window.appState.backupPassword = newPassword;
    saveToLocalStorage('backupPassword', newPassword);
    
    try {
        const config = await dbSettings.getConfig();
        await dbSettings.saveConfig({
            ...config,
            backupPassword: newPassword
        });
        
        console.log("✅ บันทึกรหัสผ่านลง IndexedDB เรียบร้อย");
    } catch (error) {
        console.error("❌ Error updating password: ", error);
        showToast('เกิดข้อผิดพลาดในการบันทึกรหัสผ่าน', 'error');
    }

    showToast('บันทึกรหัสผ่านสำรองข้อมูลเรียบร้อยแล้ว', 'success');
    
    document.getElementById('backup-password').value = '';
    document.getElementById('backup-password-confirm').value = '';
    
    renderBackupPasswordStatus();
}

async function clearBackupPassword() {
    if (window.event && window.event.type === 'click') {
        if (!confirm('คุณแน่ใจว่าต้องการลบรหัสผ่านสำรองข้อมูล?')) {
            return;
        }
    }
    
    window.appState.backupPassword = null;
    saveToLocalStorage('backupPassword', null);
    
    try {
        const config = await dbSettings.getConfig();
        delete config.backupPassword;
        await dbSettings.saveConfig(config);
        
        console.log("✅ ลบรหัสผ่านออกจาก IndexedDB เรียบร้อย");
    } catch (error) {
        console.error("❌ Error removing password: ", error);
    }

    showToast('ลบรหัสผ่านสำรองข้อมูลเรียบร้อยแล้ว', 'success');
    renderBackupPasswordStatus();
    
    const backupPwdInput = document.getElementById('backup-password');
    const backupPwdConfirm = document.getElementById('backup-password-confirm');
    if (backupPwdInput) backupPwdInput.value = '';
    if (backupPwdConfirm) backupPwdConfirm.value = '';
}

// === ฟังก์ชันสำหรับสลับการแสดง/ซ่อนรหัสผ่าน ===
function togglePasswordVisibility(inputId, toggleId) {
  const passwordInput = document.getElementById(inputId);
  const toggleIcon = document.getElementById(toggleId);
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.textContent = '🙈';
  } else {
    passwordInput.type = 'password';
    toggleIcon.textContent = '👁️';
  }
}

// === ฟังก์ชันบันทึกข้อมูลทั้งหมด ===
async function saveToFile() { 
    closeExportOptionsModal(); 
    
    try {
        const allActivities = await dbActivities.getAll();
        const config = await dbSettings.getConfig();
        
        if (allActivities.length === 0 && (!config.persons || config.persons.length === 0) && (!config.activityTypes || config.activityTypes.length === 0)) { 
            alert("ไม่มีข้อมูลให้บันทึก"); 
            return; 
        } 
        
        const fileName = prompt("กรุณากรอกชื่อไฟล์สำหรับสำรองข้อมูล (ไม่ต้องใส่นามสกุล):", "บันทึกกิจกรรม");
        if (!fileName) return;
        
        await handleSaveAs('json', fileName, allActivities, config);
    } catch (error) {
        console.error("Error saving to file:", error);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
}

// === ฟังก์ชันบันทึกข้อมูลทั้งหมด ===
async function handleSaveAs(format, fileName, activities, config) {
    const now = new Date();
    const dateTimeString = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    
    if (format === 'json') {
        const fullFileName = `${fileName}_${dateTimeString}.json`;
        
        const data = { 
            activities: activities, 
            persons: config.persons || [], 
            activityTypes: config.activityTypes || [], 
            backupPassword: config.backupPassword || null,
            backupDate: new Date().toISOString(),
            version: '2.0',
            appName: 'บันทึกกิจกรรมประจำวัน'
        };
        
    let dataString = JSON.stringify(data, null, 2);
    
    if (window.appState.backupPassword) {
        alert('กำลังเข้ารหัสข้อมูล...');
        try {
            const encryptedObject = await encryptData(dataString, window.appState.backupPassword);
            
            const encryptedData = {
                isEncrypted: true,
                encryptedVersion: '1.0',
                salt: encryptedObject.salt,
                iv: encryptedObject.iv,
                encryptedData: encryptedObject.encryptedData,
                backupDate: new Date().toISOString(),
                appName: 'บันทึกกิจกรรมประจำวัน'
            };
            
            dataString = JSON.stringify(encryptedData, null, 2);
        } catch (e) {
            alert('การเข้ารหัสล้มเหลว!'); 
            return;
        }
    }
    
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = fullFileName; 
    a.click();
    URL.revokeObjectURL(url);
    
    notifyDataManagement('export');
    
    if (window.appState.backupPassword) {
        showToast('ส่งออกข้อมูลแบบเข้ารหัสเรียบร้อยแล้ว', 'success');
    } else {
        showToast('ส่งออกข้อมูลเรียบร้อยแล้ว', 'success');
    }
}
}

// === ฟังก์ชันกู้คืนข้อมูลแบบอัพเดท (Offline Mode) ===
function restoreData(file) {
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            let content = e.target.result;
            let backupData;
            
            console.log('ไฟล์ที่อ่านได้:', content.substring(0, 200));
            
            try {
                backupData = JSON.parse(content);
                console.log('อ่านไฟล์สำเร็จแบบไม่เข้ารหัส');
            } catch (jsonError) {
                console.log('ไม่ใช่ JSON ธรรมดา:', jsonError);
                throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
            }
            
            let finalDataToMerge = null;
            
            if (backupData && backupData.isEncrypted === true) {
                console.log('ตรวจพบไฟล์ที่ถูกเข้ารหัส');
                const password = prompt("ไฟล์นี้ถูกเข้ารหัส กรุณากรอกรหัสผ่านเพื่อถอดรหัส:");
                if (!password) { 
                    alert("ยกเลิกการนำเข้าไฟล์"); 
                    document.getElementById('restoreFile').value = ''; 
                    return; 
                }
                
                alert('กำลังถอดรหัส...');
                try {
                    const decryptedString = await decryptData(backupData, password);
                    if (decryptedString) {
                        finalDataToMerge = JSON.parse(decryptedString);
                        console.log('ถอดรหัสสำเร็จ!');
                    } else {
                        alert("ถอดรหัสล้มเหลว! รหัสผ่านอาจไม่ถูกต้อง"); 
                        document.getElementById('restoreFile').value = ''; 
                        return;
                    }
                } catch (decryptError) {
                    console.error('ข้อผิดพลาดในการถอดรหัส:', decryptError);
                    alert("ถอดรหัสล้มเหลว! รหัสผ่านอาจไม่ถูกต้อง"); 
                    document.getElementById('restoreFile').value = ''; 
                    return;
                }
            } else {
                finalDataToMerge = backupData;
            }
            
            if (!finalDataToMerge || typeof finalDataToMerge !== 'object') {
                throw new Error('ไม่พบข้อมูลในไฟล์ หรือรูปแบบไม่ถูกต้อง');
            }
            
            const isValidBackup = isValidBackupFile(finalDataToMerge);
            
            if (!isValidBackup) {
                throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของแอปบันทึกกิจกรรม');
            }
            
            if (!confirm('การกู้คืนข้อมูลจะเพิ่มข้อมูลใหม่เข้าไปในข้อมูลปัจจุบัน คุณแน่ใจหรือไม่?')) {
                document.getElementById('restoreFile').value = '';
                return;
            }
            
            await updateDataWithBackup(finalDataToMerge);
            
        } catch (error) {
            console.error('Error restoring data:', error);
            alert('ไม่สามารถกู้คืนข้อมูลได้: ' + error.message);
            document.getElementById('restoreFile').value = '';
        }
    };
    
    reader.onerror = function() {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
        document.getElementById('restoreFile').value = '';
    };
    
    reader.readAsText(file);
}

function isValidBackupFile(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    
    const possibleStructures = [
        () => data.activities !== undefined && Array.isArray(data.activities),
        () => data.persons !== undefined && data.activityTypes !== undefined,
        () => data.appName === 'บันทึกกิจกรรมประจำวัน',
        () => data.backupDate !== undefined,
        () => Array.isArray(data) && data.length > 0 && data[0].activityName !== undefined,
        () => data.isEncrypted === true && data.encryptedData !== undefined
    ];
    
    return possibleStructures.some(check => {
        try {
            return check();
        } catch (e) {
            return false;
        }
    });
}

// === ฟังก์ชันกู้คืนข้อมูลลง IndexedDB ===
async function updateDataWithBackup(backupData) {
    showToast('⏳ กำลังเตรียมข้อมูลเพื่อบันทึก...', 'info');

    let mergedPersons = [];
    let mergedActivityTypes = [];
    
    try {
        const currentConfig = await dbSettings.getConfig();
        mergedPersons = currentConfig.persons || [];
        mergedActivityTypes = currentConfig.activityTypes || [];
        
        if (backupData.persons && Array.isArray(backupData.persons)) {
            mergedPersons = mergePersons(mergedPersons, backupData.persons);
        }

        if (backupData.activityTypes && Array.isArray(backupData.activityTypes)) {
            mergedActivityTypes = mergeActivityTypes(mergedActivityTypes, backupData.activityTypes);
        }

        // บันทึกการตั้งค่า
        await dbSettings.saveConfig({
            persons: mergedPersons,
            activityTypes: mergedActivityTypes,
            backupPassword: backupData.backupPassword || currentConfig.backupPassword
        });
        console.log("✅ บันทึกการตั้งค่าเรียบร้อย");
    } catch (e) {
        console.error("Settings save error:", e);
    }

    let sourceActivities = [];
    if (backupData.activities && Array.isArray(backupData.activities)) {
        sourceActivities = backupData.activities;
    } else if (Array.isArray(backupData)) {
        sourceActivities = backupData;
    }

    try {
        const currentActivities = await dbActivities.getAll();
        const mergedActivities = mergeActivities(currentActivities, sourceActivities);
        
        // ลบกิจกรรมเก่าทั้งหมดและเพิ่มใหม่
        for (const activity of currentActivities) {
            await dbActivities.delete(activity.id);
        }
        
        for (const activity of mergedActivities) {
            await dbActivities.add(activity);
        }

        const total = mergedActivities.length - currentActivities.length;
        
        if (total === 0) {
            showToast('ไม่พบรายการกิจกรรมใหม่ในไฟล์', 'info');
            await refreshActivitiesFromIndexedDB();
            return;
        }

        showToast(`✅ กู้คืนข้อมูล ${total} รายการสำเร็จ!`, 'success');
        
        await refreshActivitiesFromIndexedDB();
        populateActivityTypeDropdowns('activityTypeSelect');
        populatePersonDropdown('personSelect');
        populatePersonFilter();

        document.getElementById('restoreFile').value = '';

    } catch (error) {
        console.error("Data restoration error:", error);
        showToast('❌ เกิดข้อผิดพลาดในการบันทึก: ' + error.message, 'error');
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
    }
}

function mergeActivities(currentActivities, newActivities) {
    const merged = [...currentActivities];
    const existingIds = new Set(currentActivities.map(a => a.id));
    
    newActivities.forEach(newActivity => {
        if (!existingIds.has(newActivity.id)) {
            merged.push(newActivity);
            existingIds.add(newActivity.id);
        }
        else if (newActivity.person && !currentActivities.some(a => a.id === newActivity.id && a.person === newActivity.person)) {
            const newActivityWithNewId = {
                ...newActivity,
                id: crypto.randomUUID()
            };
            merged.push(newActivityWithNewId);
        }
    });
    
    return merged;
}

function mergePersons(currentPersons, newPersons) {
    const merged = [...currentPersons];
    const existingNames = new Set(currentPersons.map(p => p.name));
    
    newPersons.forEach(newPerson => {
        if (!existingNames.has(newPerson.name)) {
            merged.push(newPerson);
            existingNames.add(newPerson.name);
        }
    });
    
    return merged;
}

function mergeActivityTypes(currentTypes, newTypes) {
    const merged = [...currentTypes];
    const existingNames = new Set(currentTypes.map(t => t.name));
    
    newTypes.forEach(newType => {
        if (!existingNames.has(newType.name)) {
            merged.push(newType);
            existingNames.add(newType.name);
        }
    });
    
    return merged;
}

function deleteActivitiesByDate() {
    const dateToDelete = document.getElementById('deleteByDateInput').value;
    
    if (!dateToDelete) {
        alert('กรุณาเลือกวันที่ต้องการลบ');
        return;
    }
    
    if (!confirm(`คุณแน่ใจว่าต้องการลบกิจกรรมทั้งหมดในวันที่ ${formatDateForDisplay(dateToDelete)}?`)) {
        return;
    }
    
    // ลบจาก IndexedDB
    deleteActivitiesByDateFromIndexedDB(dateToDelete);
}

async function deleteActivitiesByDateFromIndexedDB(dateToDelete) {
    try {
        const allActivities = await dbActivities.getAll();
        const activitiesToDelete = allActivities.filter(activity => activity.date === dateToDelete);
        
        if (activitiesToDelete.length === 0) {
            alert('ไม่พบกิจกรรมในวันที่เลือก');
            return;
        }
        
        for (const activity of activitiesToDelete) {
            await dbActivities.delete(activity.id);
        }
        
        showToast(`ลบกิจกรรม ${activitiesToDelete.length} รายการเรียบร้อย`, 'success');
        document.getElementById('deleteByDateInput').value = '';
        notifyDataManagement('deleteByDate');
        
        await refreshActivitiesFromIndexedDB();
        
    } catch (error) {
        console.error("Error deleting activities by date:", error);
        showToast('เกิดข้อผิดพลาดในการลบกิจกรรม', 'error');
    }
}

// === ฟังก์ชันจัดการสรุปกิจกรรม ===
function loadSummaryData() {
    const summaryType = document.getElementById('summary-type-select').value;
    const datePicker = document.getElementById('summary-date-picker');
    const dateRangePicker = document.getElementById('summary-date-range');
    
    updateSummaryPersonDisplay();
    
    datePicker.classList.add('hidden');
    dateRangePicker.classList.add('hidden');
    
    switch(summaryType) {
        case 'single-day':
            datePicker.classList.remove('hidden');
            break;
        case 'date-range':
            dateRangePicker.classList.remove('hidden');
            break;
        case 'brief-summary':
        case 'all-time':
            break;
    }
    
    console.log(`📊 โหลดการตั้งค่าสรุป: ${summaryType}`);
}

function viewSummary() {
    const summaryType = document.getElementById('summary-type-select').value;
    const datePicker = document.getElementById('summary-date');
    const startDatePicker = document.getElementById('summary-start-date');
    const endDatePicker = document.getElementById('summary-end-date');

    let startDate, endDate;
    
    const allPersons = getFromLocalStorage('persons') || [];
    let actualPersonFilter = 'all';
    
    if (allPersons.length === 1) {
        actualPersonFilter = allPersons[0].name;
        console.log(`✅ มีผู้ทำกิจกรรมแค่คนเดียว: ${actualPersonFilter}, เลือกอัตโนมัติ`);
    } else {
        const personFilter = document.getElementById('personFilter');
        actualPersonFilter = personFilter ? personFilter.value : 'all';
    }
    
    switch(summaryType) {
        case 'single-day':
            if (!datePicker.value) {
                alert('กรุณาเลือกวันที่');
                return;
            }
            startDate = endDate = datePicker.value;
            break;
        case 'date-range':
            if (!startDatePicker.value || !endDatePicker.value) {
                alert('กรุณาเลือกช่วงวันที่ให้ครบถ้วน');
                return;
            }
            startDate = startDatePicker.value;
            endDate = endDatePicker.value;
            
            if (startDate > endDate) {
                alert('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
                return;
            }
            break;
        case 'all-time':
        case 'brief-summary':
            startDate = null;
            endDate = null;
            break;
    }

    generateSummary(startDate, endDate, summaryType, actualPersonFilter);
}

function generateSummary(startDate, endDate, summaryType, personFilter = 'all') {
    const allActivities = window.activities || window.appState.activities || [];
    const allPersons = getFromLocalStorage('persons') || [];
    
    let actualPersonFilter = personFilter;
    if (allPersons.length === 1 && personFilter === 'all') {
        actualPersonFilter = allPersons[0].name;
        console.log(`✅ มีผู้ทำกิจกรรมแค่คนเดียว: ${actualPersonFilter}, เลือกอัตโนมัติ`);
    }
    
    let filteredActivities = allActivities;
    
    if (startDate && endDate) {
        filteredActivities = allActivities.filter(activity => {
            return activity.date >= startDate && activity.date <= endDate;
        });
    } else if (startDate) {
        filteredActivities = allActivities.filter(activity => activity.date === startDate);
    }
    
    if (actualPersonFilter !== 'all') {
        filteredActivities = filteredActivities.filter(activity => activity.person === actualPersonFilter);
    }
    
    if (filteredActivities.length === 0) {
        let message = 'ไม่มีกิจกรรมในช่วงที่เลือก';
        if (actualPersonFilter !== 'all') {
            message += ` สำหรับผู้ทำกิจกรรม: ${actualPersonFilter}`;
        }
        alert(message);
        return;
    }
    
    summaryContext = {
        type: summaryType,
        startDate: startDate,
        endDate: endDate,
        personFilter: actualPersonFilter,
        activities: filteredActivities
    };
    
    document.getElementById('summaryOutputModal').style.display = 'flex';
    
    console.log(`📊 สรุปข้อมูล: ${summaryType}, กิจกรรม: ${filteredActivities.length} รายการ, ผู้ทำกิจกรรม: ${actualPersonFilter}`);
}

function handleSummaryOutput(outputType) {
    closeSummaryOutputModal();
    
    switch (outputType) {
        case 'display':
            displaySummary();
            break;
        case 'xlsx':
            if (typeof XLSX === 'undefined') {
                alert('ไม่สามารถส่งออกไฟล์ XLSX ได้ เนื่องจากไลบรารีไม่พร้อมใช้งาน');
                return;
            }
            exportSummaryToXLSX();
            break;
        case 'pdf':
            exportSummaryToPDF();
            break;
    }
}

// === ฟังก์ชันแสดงสรุป ===
function displaySummary() {
    const { type, activities, startDate, endDate, personFilter } = summaryContext;
    
    if (!activities || activities.length === 0) {
        alert('ไม่มีข้อมูลกิจกรรมที่จะแสดง');
        return;
    }

    const totalDurationAll = activities.reduce((total, activity) => {
        return total + calculateDuration(activity.startTime, activity.endTime);
    }, 0);

    const typeTotals = {};
    activities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        if (!typeTotals[activity.activityName]) {
            typeTotals[activity.activityName] = 0;
        }
        typeTotals[activity.activityName] += duration;
    });

    const activityDates = [...new Set(activities.map(activity => activity.date))];
    const daysWithActivities = activityDates.length;

    let totalDays = 0;
    let daysWithoutActivities = 0;

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        daysWithoutActivities = totalDays - daysWithActivities;
    } else if (startDate) {
        totalDays = 1;
        daysWithoutActivities = daysWithActivities > 0 ? 0 : 1;
    } else {
        if (activityDates.length > 0) {
            const sortedDates = activityDates.sort();
            const firstDate = new Date(sortedDates[0]);
            const lastDate = new Date(sortedDates[sortedDates.length - 1]);
            totalDays = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
            daysWithoutActivities = totalDays - daysWithActivities;
        } else {
            totalDays = 0;
            daysWithoutActivities = 0;
        }
    }

    const avgDurationPerDay = daysWithActivities > 0 ? totalDurationAll / daysWithActivities : 0;

    let dateRangeText = '';
    if (startDate && endDate) {
        if (startDate === endDate) {
            dateRangeText = `สรุปของวันที่ ${formatDateForDisplay(startDate)}`;
        } else {
            dateRangeText = `ช่วงวันที่ ${formatDateForDisplay(startDate)} ถึง ${formatDateForDisplay(endDate)}`;
        }
    } else if (startDate) {
        dateRangeText = `สรุปของวันที่ ${formatDateForDisplay(startDate)}`;
    } else {
        const allDates = activityDates.sort();
        if (allDates.length > 0) {
            if (allDates[0] === allDates[allDates.length - 1]) {
                dateRangeText = `สรุปของวันที่ ${formatDateForDisplay(allDates[0])}`;
            } else {
                dateRangeText = `จากวันที่ ${formatDateForDisplay(allDates[0])} ถึง ${formatDateForDisplay(allDates[allDates.length - 1])}`;
            }
        } else {
            dateRangeText = 'ไม่มีกิจกรรมในช่วงที่เลือก';
        }
    }

    const allPersonsInSystem = getFromLocalStorage('persons') || [];
    
    let personSummaryText = '';
    if (allPersonsInSystem.length === 1) {
        personSummaryText = `สรุปกิจกรรมของ : ${allPersonsInSystem[0].name}`;
    } else if (activities.length > 0) {
        const allPersonsInActivities = [...new Set(activities.map(activity => activity.person))];
        personSummaryText = `สรุปกิจกรรมของ : ${personFilter === 'all' ? 'ทุกคน' : allPersonsInActivities.join(', ')}`;
    } else {
        personSummaryText = 'ไม่มีข้อมูลผู้ทำกิจกรรม';
    }

let summaryHTML = `
    <div class="summaryResult" style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 10px 0.5px 5px 0.5px; border: 1.5px solid #F660EB; border-radius: 5px; background-color: #FAFAD2; text-align: center; line-height: 1.0; width: 100%; box-sizing: border-box;">
            <div style="text-align: center; margin: 2px 0;">
                <h3 style="color: blue; font-size: clamp(0.75rem, 1vw, 0.9rem); line-height: 1.2; margin: 2px 0;">
                    ${personSummaryText}
                </h3>
            </div>
            <div style="text-align: center; margin: 2px 0;">
                <h3 style="color: blue; font-size: clamp(0.75rem, 1vw, 0.9rem); line-height: 1.2; margin: 2px 0;">
                    สรุปวันที่ ${getCurrentDateTimeThai().replace(/(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})/, '$1 เวลา $2 น.')}
                </h3>
            </div>
            <div style="text-align: center; margin: 2px 0;">
                <h3 style="color: blue; font-size: clamp(0.75rem, 1vw, 0.9rem); line-height: 1.2; margin: 2px 0;">
                    ${dateRangeText}
                </h3>
            </div>

            <div style="background-color: #FAFAD2; padding: 5px; margin: 5px 0; text-align: center; color: blue;">
                <h4 style="margin: 5px 0; font-size: clamp(0.75rem, 1vw, 0.9rem); line-height: 1.2;">สรุปจำนวนวัน</h4>
                <p style="margin: 3px 0; font-size: clamp(0.75rem, 1vw, 0.9rem); line-height: 1.0;">• จำนวนวันทั้งหมด : ${totalDays} วัน</p>
                <p style="margin: 3px 0; font-size: clamp(0.75rem, 1vw, 0.9rem); line-height: 1.0;">• จำนวนวันที่มีกิจกรรม : ${daysWithActivities} วัน</p>
                <p style="margin: 3px 0; font-size: clamp(0.75rem, 1vw, 0.9rem); line-height: 1.0;">• วันที่ไม่มีกิจกรรม : ${daysWithoutActivities} วัน</p>
                <p style="margin: 3px 0; font-size: clamp(0.75rem, 1vw, 0.9rem); line-height: 1.0;">• เวลาเฉลี่ยต่อวัน : ${formatDuration(avgDurationPerDay)}</p>
                <p style="margin: 3px 0; font-size: clamp(0.75rem, 1vw, 0.9rem); line-height: 1.0;">• รวมเวลาทั้งหมด : ${formatDuration(totalDurationAll)}</p>
            </div>

            <h4 style="color: #0056b3; margin: 5px 0; font-size: clamp(0.75rem, 1vw, 0.9rem);">
                สรุปตามประเภทกิจกรรม
            </h4>
            <table class="type-summary-table" style="width: 100%; border-collapse: collapse; margin: 5px 0; font-size: clamp(0.75rem, 1vw, 0.9rem);">
                <thead>
                    <tr style="background: linear-gradient(135deg, #ff9f43 0%, #ff8b33 100%); color: white;">
                        <th style="padding: 3px; border: 1px solid #ddd;">ประเภทกิจกรรม</th>
                        <th style="padding: 3px; border: 1px solid #ddd;">ระยะเวลารวม</th> 
                    </tr>
                </thead>
                <tbody>
`;

Object.entries(typeTotals).forEach(([type, duration]) => {
    summaryHTML += `
        <tr>
            <td style="padding: 3px; border: 1px solid #ddd;">${type}</td>
            <td style="padding: px; border: 1px solid #ddd;">${formatDuration(duration)}</td>
        </tr>
    `;
});

summaryHTML += `
                </tbody>
            </table>
`;

if (type === 'brief-summary') {
    summaryHTML += `
        <h4 style="color: #0056b3; margin: 5px 0; font-size: clamp(0.75rem, 1vw, 0.9rem);">
            กิจกรรมล่าสุด (15 รายการ)
        </h4>
        <table style="width: 100%; border-collapse: collapse; margin: 5px 0; font-size: clamp(0.7rem, 1vw, 0.8rem);">
            <thead>
                <tr style="background: linear-gradient(135deg, #ff9f43 0%, #ff8b33 100%); color: white;">
                    <th style="padding: 3px; border: 1px solid #ddd;">กิจกรรม</th>
                    <th style="padding: 3px; border: 1px solid #ddd;">วันที่</th>
                    <th style="padding: 3px; border: 1px solid #ddd;">เวลาเริ่ม&สิ้นสุด</th>
                    <th style="padding: 3px; border: 1px solid #ddd;">รวมเวลา</th>
                    <th style="padding: 3px; border: 1px solid #ddd;">รายละเอียด</th>
                </tr>
            </thead>
            <tbody>
    `;

    const latestActivities = [...activities]
        .sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return b.startTime.localeCompare(a.startTime);
        })
        .slice(0, 15);

    latestActivities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        summaryHTML += `
            <tr>
                <td style="padding: 3px; border: 1px solid #ddd;">${activity.activityName}</td>
                <td style="padding: 3px; border: 1px solid #ddd;">${formatDateForDisplay(activity.date)}</td>
                <td style="padding: 3px; border: 1px solid #ddd;">${activity.startTime} - ${activity.endTime}</td>
                <td style="padding: 3px; border: 1px solid #ddd;">${formatDuration(duration)}</td>
                <td style="padding: 3px; border: 1px solid #ddd;">${activity.details || '-'}</td>
            </tr>
        `;
    });

    summaryHTML += `
            </tbody>
        </table>
    `;
} else {
    summaryHTML += `
        <h4 style="color: #0056b3; margin: 5px 0; font-size: clamp(0.75rem, 1vw, 0.9rem);">
            รายการกิจกรรมทั้งหมด (${activities.length} รายการ)
        </h4>
        <table style="width: 100%; border-collapse: collapse; margin: 4px 0; font-size: clamp(0.7rem, 1vw, 0.8rem);">
            <thead>
                <tr style="background: linear-gradient(135deg, #ff9f43 0%, #ff8b33 100%); color: white;">
                    <th style="padding: 3px; border: 1px solid #ddd;">กิจกรรม</th>
                    <th style="padding: 3px; border: 1px solid #ddd;">วันที่</th>
                    <th style="padding: 3px; border: 1px solid #ddd;">เวลาเริ่ม&สิ้นสุด</th>
                    <th style="padding: 3px; border: 1px solid #ddd;">รวมเวลา</th>
                    <th style="padding: 3px; border: 1px solid #ddd;">รายละเอียด</th>
                </tr>
            </thead>
            <tbody>
    `;

    const sortedActivities = [...activities].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.startTime.localeCompare(a.startTime);
    });

    sortedActivities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        summaryHTML += `
            <tr>
                <td style="padding: 3px; border: 1px solid #ddd;">${activity.activityName}</td>
                <td style="padding: 3px; border: 1px solid #ddd;">${formatDateForDisplay(activity.date)}</td>
                <td style="padding: 3px; border: 1px solid #ddd;">${activity.startTime} - ${activity.endTime}</td>
                <td style="padding: 3px; border: 1px solid #ddd;">${formatDuration(duration)}</td>
                <td style="padding: 3px; border: 1px solid #ddd;">${activity.details || '-'}</td>
            </tr>
        `;
    });

    summaryHTML += `
            </tbody>
        </table>
    `;
}

summaryHTML += `</div>`;

document.getElementById('modalBodyContent').innerHTML = summaryHTML;
document.getElementById('summaryModal').style.display = 'flex';
}

// === ฟังก์ชันส่งออกสรุปเป็น XLSX ===
function exportSummaryToXLSX() {
    if (typeof XLSX === 'undefined') {
        alert('ไม่สามารถส่งออกไฟล์ XLSX ได้ เนื่องจากไลบรารีไม่พร้อมใช้งาน');
        return;
    }
    
    const { type, activities, startDate, endDate, personFilter } = summaryContext;
    
    const allPersonsInSystem = getFromLocalStorage('persons') || [];
    let actualPersonFilter = personFilter;
    if (allPersonsInSystem.length === 1 && personFilter === 'all') {
        actualPersonFilter = allPersonsInSystem[0].name;
    }
    
    const personSummaryText = actualPersonFilter !== 'all' 
        ? `สรุปกิจกรรมของ: ${actualPersonFilter}` 
        : 'สรุปกิจกรรมของ: ทุกคน';

    const totalDurationAll = activities.reduce((total, activity) => {
        return total + calculateDuration(activity.startTime, activity.endTime);
    }, 0);
    
    const typeTotals = {};
    activities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        if (!typeTotals[activity.activityName]) {
            typeTotals[activity.activityName] = 0;
        }
        typeTotals[activity.activityName] += duration;
    });
    
    const activityDates = [...new Set(activities.map(activity => activity.date))];
    const daysWithActivities = activityDates.length;
    
    let totalDays = 0;
    let daysWithoutActivities = 0;

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        daysWithoutActivities = totalDays - daysWithActivities;
    } else {
         totalDays = daysWithActivities;
         daysWithoutActivities = 0;
    }
    
    const avgDurationPerDay = daysWithActivities > 0 ? totalDurationAll / daysWithActivities : 0;
    const sortedActivities = [...activities].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.startTime.localeCompare(a.startTime);
    });

    const isBrief = type === 'brief-summary';
    const activitiesToDisplay = isBrief ? sortedActivities.slice(0, 15) : sortedActivities;

    const headerData = [
        [personSummaryText],
        [`สรุป ณ วันที่ ${getCurrentDateTimeThai().replace(/(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})/, '$1 เวลา $2 น.')}`],
        [''],
        ['สรุปจำนวนวัน'],
        ['จำนวนวันทั้งหมด (ในช่วงที่เลือก)', totalDays, 'วัน'],
        ['จำนวนวันที่มีกิจกรรม', daysWithActivities, 'วัน'],
        ['วันที่ไม่มีกิจกรรม', daysWithoutActivities, 'วัน'],
        ['เวลาเฉลี่ยต่อวัน', formatDuration(avgDurationPerDay)],
        ['รวมเวลาทั้งหมด', formatDuration(totalDurationAll)],
        [''],
    ];
    
    const typeSummaryData = [
        ['สรุปตามประเภทกิจกรรม'],
        ['ประเภทกิจกรรม', 'ระยะเวลารวม'],
    ];
    
    Object.entries(typeTotals).forEach(([type, duration]) => {
        typeSummaryData.push([
            type,
            formatDuration(duration)
        ]);
    });
    
    typeSummaryData.push(['']);

    let activityListData = [];
    if (activitiesToDisplay.length > 0) {
        activityListData = [
            [isBrief ? `กิจกรรมล่าสุด (15 รายการ)` : `รายการกิจกรรมทั้งหมด (${activities.length} รายการ)`],
            ['วันที่', 'เวลาเริ่มต้น', 'เวลาสิ้นสุด', 'ผู้ทำกิจกรรม', 'ประเภทกิจกรรม', 'รวมเวลา', 'รายละเอียด']
        ];
        
        activitiesToDisplay.forEach(activity => {
            const duration = calculateDuration(activity.startTime, activity.endTime);
            const formattedDuration = formatDuration(duration);
            
            activityListData.push([
                formatDateForDisplay(activity.date),
                activity.startTime,
                activity.endTime,
                activity.person,
                activity.activityName,
                formattedDuration,
                activity.details || ''
            ]);
        });
    }

    const finalData = [
        ...headerData,
        ...typeSummaryData,
        ...activityListData
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(finalData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'สรุปกิจกรรม');
    
    const wscols = [
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 40 }
    ];
    worksheet['!cols'] = wscols;
    
    let fileName = 'กิจกรรมสรุป';
    if (startDate && endDate) {
        if (startDate === endDate) {
            fileName = `กิจกรรม_${formatDateForDisplay(startDate)}`;
        } else {
            fileName = `กิจกรรม_${formatDateForDisplay(startDate)}_ถึง_${formatDateForDisplay(endDate)}`;
        }
    } else {
        fileName = 'กิจกรรมทั้งหมด';
    }
    
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    notifyDataManagement('export');
}

// === ฟังก์ชันสำหรับจัดการเวลาไทย ===
function getCurrentDateTimeThai() {
    const now = new Date();
    const thaiDate = now.toLocaleDateString('th-TH', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
    }) + ' น.';
    return thaiDate;
}

// === ฟังก์ชันส่งออกสรุปเป็น PDF ===
function exportSummaryToPDF() {
    const { type, activities, startDate, endDate, personFilter } = summaryContext;
    
    if (!activities || activities.length === 0) {
        alert('ไม่มีข้อมูลกิจกรรมสำหรับสร้าง PDF');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
        alert('ไม่สามารถเปิดหน้าต่างใหม่ได้ กรุณาปิด Popup Blocker แล้วลองอีกครั้ง');
        notifyDataManagement('export');
        return;
    }
    
    const allPersonsInSystem = getFromLocalStorage('persons') || [];
    let actualPersonFilter = personFilter;
    if (allPersonsInSystem.length === 1 && personFilter === 'all') {
        actualPersonFilter = allPersonsInSystem[0].name;
    }
    
    const personSummaryText = actualPersonFilter !== 'all' 
        ? `สรุปกิจกรรมของ: ${actualPersonFilter}` 
        : 'สรุปกิจกรรมของ: ทุกคน';

    const totalDurationAll = activities.reduce((total, activity) => {
        return total + calculateDuration(activity.startTime, activity.endTime);
    }, 0);
    
    const typeTotals = {};
    activities.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        if (!typeTotals[activity.activityName]) {
            typeTotals[activity.activityName] = 0;
        }
        typeTotals[activity.activityName] += duration;
    });
    
    const activityDates = [...new Set(activities.map(activity => activity.date))];
    const daysWithActivities = activityDates.length;

    let totalDays = 0;
    let daysWithoutActivities = 0;

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        daysWithoutActivities = totalDays - daysWithActivities;
    } else {
        if (activityDates.length > 0) {
            const sortedDates = activityDates.sort();
            const firstDate = new Date(sortedDates[0]);
            const lastDate = new Date(sortedDates[sortedDates.length - 1]);
            totalDays = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
            daysWithoutActivities = totalDays - daysWithActivities;
        }
    }
    
    const avgDurationPerDay = daysWithActivities > 0 ? totalDurationAll / daysWithActivities : 0;
    
    let dateRangeText = '';
    if (startDate && endDate) {
        if (startDate === endDate) {
            dateRangeText = `สรุปของวันที่ ${formatDateForDisplay(startDate)}`;
        } else {
            dateRangeText = `ช่วงวันที่ ${formatDateForDisplay(startDate)} ถึง ${formatDateForDisplay(endDate)}`;
        }
    } else {
        const allDates = activityDates.sort();
        if (allDates.length > 0) {
            if (allDates[0] === allDates[allDates.length - 1]) {
                dateRangeText = `สรุปของวันที่ ${formatDateForDisplay(allDates[0])}`;
            } else {
                dateRangeText = `จากวันที่ ${formatDateForDisplay(allDates[0])} ถึง ${formatDateForDisplay(allDates[allDates.length - 1])}`;
            }
        } else {
            dateRangeText = 'ไม่มีกิจกรรมในช่วงที่เลือก';
        }
    }
    
    const sortedActivities = [...activities].sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        return d !== 0 ? d : b.startTime.localeCompare(a.startTime);
    });

    const isBrief = type === 'brief-summary';
    const activitiesToDisplay = isBrief ? sortedActivities.slice(0, 15) : sortedActivities;

   let printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${personSummaryText}</title>
            <meta charset="UTF-8">
            <style>
                @page {
                    margin: 15mm 5mm 3mm 8mm;
                    size: A4;
                    @top-right {
                        content: "หน้า " counter(page) " จาก " counter(pages);
                        font-size: 8px;
                        font-family: Tahoma, Arial, sans-serif;
                        color: #000;
                    }
                }
                body { 
                    font-family: Tahoma, Arial, sans-serif; 
                    font-size: 8px; 
                    color: #000;
                    padding: 0; 
                    margin: 0; 
                    text-align: center;
                }
                .summary-container { 
                    max-width: 100%; 
                    margin: 0 auto; 
                    text-align: center;
                }
                .header-section {
                    text-align: center;
                    margin-bottom: 10px;
                }
                h3 { 
                    color: #000;
                    font-size: 1.2rem;
                    line-height: 1.5;
                    margin: 5px 0; 
                    text-align: center; 
                }
                h4 { 
                    color: #000;
                    margin: 10px 0 5px 0;
                    font-size: 1rem; 
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 2px; 
                    text-align: center;
                }
                p.data-row-title, p.data-row {
                    color: #000;
                }

                table { 
                    width:100%; 
                    border-collapse:collapse; 
                    table-layout:fixed; 
                    margin: 5px 0; 
                }
                th,td { 
                    border:0.5px solid #000; 
                    padding:2px; 
                    font-size:0.7rem; 
                    word-wrap: break-word; 
                    text-align: center;
                }
                th { 
                    background-color: #007bff; 
                    color: white; 
                }
                .data-row { 
                    line-height: 1.5;
                    margin: 3px 0; 
                    font-size: 0.9rem; 
                    text-align: center;
                }
                .data-row-title {
                    line-height: 1.5;
                    margin: 3px 0;
                    font-size: 0.9rem;
                    text-align: center;
                }
                .no-break-row{page-break-inside:avoid;}
            </style>
        </head>
        <body>
            <div class="summary-container">
                <div class="header-section">
                    <h3>${personSummaryText}</h3>
                    <p class="data-row-title">สรุป ณ วันที่ ${getCurrentDateTimeThai().replace(/(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})/, '$1 เวลา $2 น.')}</p>
                    <p class="data-row-title">${dateRangeText}</p>
                </div>
                
                <h4>สรุปจำนวนวัน</h4>
                <div style="font-size: 0.8rem; line-height: 1.3; text-align: center;">
                    <p class="data-row">• จำนวนวันทั้งหมด: ${totalDays} วัน</p>
                    <p class="data-row">• จำนวนวันที่มีกิจกรรม: ${daysWithActivities} วัน</p>
                    <p class="data-row">• วันที่ไม่มีกิจกรรม: ${daysWithoutActivities} วัน</p>
                    <p class="data-row">• เวลาเฉลี่ยต่อวัน: ${formatDuration(avgDurationPerDay)}</p>
                    <p class="data-row">• รวมเวลาทั้งหมด: ${formatDuration(totalDurationAll)}</p>
                </div>

                <h4>สรุปตามประเภทกิจกรรม</h4>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">ประเภทกิจกรรม</th>
                            <th style="width: 50%;">ระยะเวลารวม</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    Object.entries(typeTotals).forEach(([type, duration]) => {
        printHTML += `
            <tr class="no-break-row">
                <td>${type}</td>
                <td>${formatDuration(duration)}</td>
            </tr>
        `;
    });

    printHTML += `
                    </tbody>
                </table>
                <br>
    `;

    printHTML += `
        <h4>${isBrief ? "กิจกรรมล่าสุด (15 รายการ)" : `รายการกิจกรรมทั้งหมด (${activities.length} รายการ)`}</h4>
        <table>
            <thead>
                <tr>
                    <th style="width: 17%;">กิจกรรม</th>
                    <th style="width: 10%;">วันที่</th>
                    <th style="width: 15%;">เวลาเริ่ม-สิ้นสุด</th>
                    <th style="width: 12%;">รวมเวลา</th>
                    <th style="width: 46%;">รายละเอียด</th>
                </tr>
            </thead>
            <tbody>
    `;

    activitiesToDisplay.forEach(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        printHTML += `
            <tr class="no-break-row">
                <td>${activity.activityName}</td>
                <td>${formatDateForDisplay(activity.date)}</td>
                <td>${activity.startTime} - ${activity.endTime}</td>
                <td>${formatDuration(duration)}</td>
                <td>${activity.details || '-'}</td>
            </tr>
        `;
    });

    printHTML += `
            </tbody>
        </table>
        </div>
        </body>
        </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 300);
    };
    
    notifyDataManagement('export');
    showToast('กำลังเตรียมพิมพ์ PDF...', 'success');
}

function formatDurationForPrint(minutes) {
    if (isNaN(minutes) || minutes < 0) return "0 นาที";

    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let parts = [];

    if (hours > 0) parts.push(`${hours} ชั่วโมง`);
    if (remainingMinutes > 0) parts.push(`${remainingMinutes} นาที`);
    if (seconds > 0) parts.push(`${seconds} วินาที`);

    if (parts.length === 0) return "0 นาที";

    return parts.join(' ');
}

// === ฟังก์ชันสำหรับจัดรูปแบบวันที่ ===
function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = (date.getFullYear() + 543).toString();
    
    return `${day}/${month}/${year}`;
}

function closeSummaryModal() {
    document.getElementById('summaryModal').style.display = 'none';
}

function closeSummaryOutputModal() {
    document.getElementById('summaryOutputModal').style.display = 'none';
}

// === ฟังก์ชันบันทึกเป็นรูปภาพ ===
function saveSummaryAsImage() {
    const pinkFrame = document.querySelector('.summaryResult[style*="border: 1.5px solid #F660EB"]');
    
    if (!pinkFrame) {
        alert('ไม่พบกรอบสีชมพูสำหรับบันทึก');
        return;
    }
    
    const originalMargin = pinkFrame.style.margin;
    const originalBoxSizing = pinkFrame.style.boxSizing;
    
    pinkFrame.style.margin = '2px';
    pinkFrame.style.boxSizing = 'content-box';
    
    html2canvas(pinkFrame, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        onclone: function(clonedDoc, element) {
            const clonedFrame = element;
            clonedFrame.style.backgroundColor = '#FAFAD2';
        }
    }).then(canvas => {
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        const borderSize = 2;
        
        finalCanvas.width = canvas.width + (borderSize * 2);
        finalCanvas.height = canvas.height + (borderSize * 2);
        
        finalCtx.fillStyle = '#FFFFFF';
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        
        finalCtx.drawImage(canvas, borderSize, borderSize);
        
        pinkFrame.style.margin = originalMargin;
        pinkFrame.style.boxSizing = originalBoxSizing;
        
        const link = document.createElement('a');
        let fileName = 'สรุปกิจกรรม';
        
        if (summaryContext.type === 'today') {
            const today = new Date();
            const thaiYear = today.getFullYear() + 543;
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            fileName = `สรุปกิจกรรม_วันนี้_${day}${month}${thaiYear}`;
        } else if (summaryContext.type === 'customDate') {
            fileName = `สรุปกิจกรรม_${formatDateForDisplay(summaryContext.date)}`;
        } else if (summaryContext.type === 'dateRange') {
            fileName = `สรุปกิจกรรม_${formatDateForDisplay(summaryContext.startDate)}_ถึง_${formatDateForDisplay(summaryContext.endDate)}`;
        } else {
            const today = new Date();
            const thaiYear = today.getFullYear() + 543;
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            fileName = `สรุปกิจกรรม_ทั้งหมด_${day}${month}${thaiYear}`;
        }
        
        link.download = `${fileName}.png`;
        link.href = finalCanvas.toDataURL('image/png');
        link.click();
        
        showToast('บันทึกรูปภาพเรียบร้อยแล้ว', 'success');
        
    }).catch(error => {
        pinkFrame.style.margin = originalMargin;
        pinkFrame.style.boxSizing = originalBoxSizing;
        
        console.error('Error saving image:', error);
        alert('เกิดข้อผิดพลาดในการบันทึกรูปภาพ: ' + error.message);
    });
}

// === ฟังก์ชันทำความสะอาดข้อมูลขั้นสูง (Offline Mode) ===
async function advancedDataCleanup() {
    if (!confirm('⚠️ ยืนยันการทำความสะอาดขั้นสูง?\n\nการกระทำนี้จะ:\n1. ลบกิจกรรมขยะ/ข้อมูลไม่ครบ\n2. ลบรายชื่อคนและประเภทกิจกรรมที่ "ไม่ได้ถูกใช้งาน"\n\nไม่สามารถกู้คืนได้!')) {
        return;
    }

    showToast('⏳ กำลังวิเคราะห์และทำความสะอาดข้อมูล...', 'info');

    try {
        const allActivities = await dbActivities.getAll();
        const config = await dbSettings.getConfig();
        
        const validActivities = [];
        const seenSignatures = new Set();
        const idsToDelete = [];

        allActivities.forEach(activity => {
            const isValidData = activity.date && activity.startTime && activity.endTime && activity.person && activity.activityName;
            const duration = calculateDuration(activity.startTime, activity.endTime);
            
            const signature = `${activity.date}|${activity.startTime}|${activity.endTime}|${activity.person}|${activity.activityName}`;
            const isDuplicate = seenSignatures.has(signature);

            if (isValidData && duration > 0 && !isDuplicate) {
                seenSignatures.add(signature);
                validActivities.push(activity);
            } else {
                if (activity.id) idsToDelete.push(activity.id);
            }
        });

        // ลบกิจกรรมที่ไม่ต้องการ
        for (const id of idsToDelete) {
            await dbActivities.delete(id);
        }

        // อัปเดตการตั้งค่า
        const usedPersonNames = new Set(validActivities.map(a => a.person));
        const usedTypeNames = new Set(validActivities.map(a => a.activityName));

        const newPersons = (config.persons || []).filter(p => usedPersonNames.has(p.name));
        const newTypes = (config.activityTypes || []).filter(t => usedTypeNames.has(t.name));

        await dbSettings.saveConfig({
            ...config,
            persons: newPersons,
            activityTypes: newTypes
        });

        alert(`✅ ทำความสะอาดเสร็จสิ้น!\n🗑️ ลบข้อมูลขยะ/ซ้ำ: ${idsToDelete.length} รายการ\n👥 ปรับปรุงรายชื่อและประเภทกิจกรรมเรียบร้อย`);
        showToast('ทำความสะอาดข้อมูลระบบสมบูรณ์', 'success');

        // รีเฟรชข้อมูล
        await refreshActivitiesFromIndexedDB();

    } catch (error) {
        console.error("Advanced cleanup error:", error);
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
}

// === ระบบตรวจสอบสุขภาพข้อมูลและทำความสะอาด ===
function showDataHealthReport() {
    const allActivities = window.activities || window.appState.activities || [];
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    let report = "📊 รายงานสุขภาพข้อมูล\n\n";
    
    report += `📝 กิจกรรมทั้งหมด: ${allActivities.length} รายการ\n`;
    
    const incompleteActivities = allActivities.filter(activity => 
        !activity.date || !activity.startTime || !activity.endTime || 
        !activity.person || !activity.activityName
    );
    
    report += `⚠️  กิจกรรมที่ขาดข้อมูล: ${incompleteActivities.length} รายการ\n`;
    
    const invalidTimeActivities = allActivities.filter(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        return duration <= 0 || isNaN(duration);
    });
    
    report += `⏰ กิจกรรมที่มีเวลาไม่ถูกต้อง: ${invalidTimeActivities.length} รายการ\n`;
    
    const duplicateActivities = findDuplicateActivities(allActivities);
    report += `🔄 กิจกรรมซ้ำ: ${duplicateActivities.length} รายการ\n\n`;
    
    report += `👥 ผู้ทำกิจกรรม: ${allPersons.length} คน\n`;
    
    const unusedPersons = allPersons.filter(person => 
        !allActivities.some(activity => activity.person === person.name)
    );
    
    report += `🚫 ผู้ทำกิจกรรมที่ไม่ได้ใช้: ${unusedPersons.length} คน\n\n`;
    
    report += `📋 ประเภทกิจกรรม: ${allActivityTypes.length} ประเภท\n`;
    
    const unusedActivityTypes = allActivityTypes.filter(type => 
        !allActivities.some(activity => activity.activityName === type.name)
    );
    
    report += `🚫 ประเภทกิจกรรมที่ไม่ได้ใช้: ${unusedActivityTypes.length} ประเภท\n\n`;
    
    const corruptedActivities = allActivities.filter(activity => 
        !activity.id || typeof activity.id !== 'string'
    );
    
    report += `❌ กิจกรรมที่ข้อมูลเสียหาย: ${corruptedActivities.length} รายการ\n`;
    
    alert(report);
    
    if (incompleteActivities.length === 0 && 
        invalidTimeActivities.length === 0 && 
        duplicateActivities.length === 0 &&
        unusedPersons.length === 0 &&
        unusedActivityTypes.length === 0 &&
        corruptedActivities.length === 0) {
        showToast('✅ ข้อมูลอยู่ในสภาพดี', 'success');
    } else {
        showToast('⚠️ พบปัญหาบางอย่างในข้อมูล', 'warning');
    }
}

// === ฟังก์ชันทำความสะอาดข้อมูลซ้ำ (Offline Mode) ===
async function cleanDuplicateData() {
    if (!confirm('ยืนยันการทำความสะอาดข้อมูลซ้ำ?\nข้อมูลที่ซ้ำจะถูกลบออก')) {
        return;
    }

    showToast('⏳ กำลังตรวจสอบและลบข้อมูลซ้ำ...', 'info');

    try {
        const allActivities = await dbActivities.getAll();
        const originalCount = allActivities.length;

        if (originalCount === 0) {
            alert('ไม่มีข้อมูลกิจกรรมให้ตรวจสอบ');
            return;
        }

        const uniqueIds = new Set();
        const idsToDelete = [];
        const seenSignatures = new Set();

        allActivities.forEach(activity => {
            const signature = `${activity.date}|${activity.startTime}|${activity.endTime}|${activity.person}|${activity.activityName}`;
            
            if (seenSignatures.has(signature)) {
                if (activity.id) idsToDelete.push(activity.id);
            } else {
                seenSignatures.add(signature);
                uniqueIds.add(activity.id);
            }
        });

        if (idsToDelete.length === 0) {
            showToast('✅ ไม่พบข้อมูลซ้ำ ข้อมูลสะอาดอยู่แล้ว', 'success');
            return;
        }

        // ลบข้อมูลซ้ำ
        for (const id of idsToDelete) {
            await dbActivities.delete(id);
        }

        const message = `🧹 ทำความสะอาดเรียบร้อย!\n- เดิมมี: ${originalCount}\n- ลบออก: ${idsToDelete.length}\n- เหลือ: ${originalCount - idsToDelete.length}`;
        alert(message);
        showToast(`ลบข้อมูลซ้ำ ${idsToDelete.length} รายการสำเร็จ`, 'success');

        // รีเฟรชข้อมูล
        await refreshActivitiesFromIndexedDB();

    } catch (error) {
        console.error("Cleanup error:", error);
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
}

// ฟังก์ชันช่วยเหลือสำหรับการทำความสะอาด
function findDuplicateActivities(activities) {
    const duplicates = [];
    const seen = new Set();
    
    activities.forEach(activity => {
        const key = `${activity.date}-${activity.startTime}-${activity.endTime}-${activity.person}-${activity.activityName}`;
        
        if (seen.has(key)) {
            duplicates.push(activity);
        } else {
            seen.add(key);
        }
    });
    
    return duplicates;
}

function removeDuplicateActivities(activities) {
    const uniqueActivities = [];
    const seen = new Set();
    
    activities.forEach(activity => {
        const key = `${activity.date}-${activity.startTime}-${activity.endTime}-${activity.person}-${activity.activityName}`;
        
        if (!seen.has(key)) {
            uniqueActivities.push(activity);
            seen.add(key);
        }
    });
    
    return uniqueActivities;
}

function findOrphanedData() {
    const allActivities = window.activities || window.appState.activities || [];
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    const orphanedPersons = allPersons.filter(person => 
        !allActivities.some(activity => activity.person === person.name)
    );
    
    const orphanedActivityTypes = allActivityTypes.filter(type => 
        !allActivities.some(activity => activity.activityName === type.name)
    );
    
    return {
        orphanedPersons,
        orphanedActivityTypes
    };
}

// === ฟังก์ชันจัดการการแสดงผลผู้ทำกิจกรรม ===
function updateCurrentPersonDisplay() {
    const personSelect = document.getElementById('personSelect');
    const currentPersonValue = document.getElementById('currentPersonValue');
    
    if (!currentPersonValue) {
        console.error('❌ ไม่พบ element currentPersonValue');
        return;
    }
    
    const selectedValue = personSelect.value;
    const selectedText = personSelect.options[personSelect.selectedIndex]?.text || '';
    
    const wrapper = personSelect.closest('.select-wrapper');
    const isAutoSelected = wrapper?.classList.contains('hide-dropdown');
    
    if (selectedValue && selectedValue !== '' && selectedValue !== 'custom') {
        if (isAutoSelected) {
            currentPersonValue.textContent = `${selectedText}`;
            currentPersonValue.style.color = '#28a745';
            currentPersonValue.className = 'current-person-value selected';
        } else {
            currentPersonValue.textContent = selectedText;
            currentPersonValue.style.color = '#007bff';
            currentPersonValue.className = 'current-person-value selected';
        }
    } else {
        currentPersonValue.textContent = 'ยังไม่ได้เลือก';
        currentPersonValue.style.color = '#dc3545';
        currentPersonValue.className = 'current-person-value not-selected';
    }
    
    const container = document.querySelector('.current-person-container');
    if (container) {
        container.style.flexDirection = 'row';
        container.style.flexWrap = 'nowrap';
        container.style.whiteSpace = 'nowrap';
    }
    
    console.log(`👤 อัปเดตแสดงผลผู้ทำกิจกรรม: ${currentPersonValue.textContent}`);
}

// === ฟังก์ชันจัดการการแสดงผลผู้ทำกิจกรรมบนมือถือ ===
function setupMobilePersonDisplay() {
    const isMobile = window.innerWidth <= 768;
    const container = document.querySelector('.current-person-container');
    
    if (isMobile && container) {
        container.style.flexDirection = 'row';
        container.style.flexWrap = 'nowrap';
        container.style.whiteSpace = 'nowrap';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        
        const label = container.querySelector('.current-person-label');
        const value = container.querySelector('.current-person-value');
        
        if (label) label.style.fontSize = 'clamp(0.8rem, 2.5vw, 0.9rem)';
        if (value) value.style.fontSize = 'clamp(0.8rem, 2.5vw, 0.9rem)';
    }
}

// === ฟังก์ชันโหลดข้อมูลผู้ทำกิจกรรมลงใน dropdown กรอง ===
function populatePersonFilter() {
    const personFilter = document.getElementById('personFilter');
    if (!personFilter) {
        console.error('❌ ไม่พบ element personFilter');
        return;
    }
    
    const allPersons = getFromLocalStorage('persons') || [];
    
    const selectedValue = personFilter.value;
    
    while (personFilter.options.length > 1) {
        personFilter.remove(1);
    }
    
    allPersons.forEach(person => {
        const option = document.createElement('option');
        option.value = person.name;
        option.textContent = person.name;
        personFilter.appendChild(option);
    });
    
    if (selectedValue && Array.from(personFilter.options).some(opt => opt.value === selectedValue)) {
        personFilter.value = selectedValue;
    }
    
    console.log(`✅ โหลด ${allPersons.length} ผู้ทำกิจกรรมลงในตัวกรอง`);
}

function updatePersonFilterVisibility() {
    const personFilterContainer = document.querySelector('.person-filter-container');
    const allPersons = getFromLocalStorage('persons') || [];
    
    if (personFilterContainer) {
        if (allPersons.length === 1) {
            personFilterContainer.style.display = 'none';
            console.log('✅ ซ่อน dropdown กรองผู้ทำกิจกรรม (มีแค่คนเดียว)');
        } else {
            personFilterContainer.style.display = 'block';
        }
    }
}

// เรียกใช้ฟังก์ชันนี้เมื่อโหลดหน้าและเมื่อมีการเปลี่ยนแปลงข้อมูลผู้ทำกิจกรรม
document.addEventListener('DOMContentLoaded', function() {
    updatePersonFilterVisibility();
});

// เรียกใช้เมื่อมีการเพิ่ม/ลบ/แก้ไขผู้ทำกิจกรรม
function updatePersonFilterAfterChange() {
    populatePersonFilter();
    updateSummaryPersonDisplay();
}

// === ฟังก์ชันอัพเดทการแสดงผลผู้ทำกิจกรรมในหน้าสรุป ===
function updateSummaryPersonDisplay() {
    const allPersons = getFromLocalStorage('persons') || [];
    const personFilterContainer = document.getElementById('personFilterContainer');
    const autoSelectedPerson = document.getElementById('autoSelectedPerson');
    const selectedPersonName = document.getElementById('selectedPersonName');
    const personFilter = document.getElementById('personFilter');
    
    if (allPersons.length === 1) {
        if (personFilterContainer) personFilterContainer.style.display = 'none';
        if (autoSelectedPerson) {
            autoSelectedPerson.style.display = 'block';
            selectedPersonName.textContent = allPersons[0].name;
        }
        console.log(`✅ สรุปกิจกรรม: แสดงผู้ทำกิจกรรมอัตโนมัติ - ${allPersons[0].name}`);
    } else {
        if (personFilterContainer) personFilterContainer.style.display = 'block';
        if (autoSelectedPerson) autoSelectedPerson.style.display = 'none';
        populatePersonFilter();
    }
}

// === ฟังก์ชันกรองกิจกรรมตามผู้ทำกิจกรรม ===
function filterActivitiesByPerson(activities, selectedPerson) {
    if (selectedPerson === 'all') {
        return activities;
    }
    return activities.filter(activity => activity.person === selectedPerson);
}

// === ฟังก์ชันปรับขนาดตัวอักษรและความสูงบรรทัด ===
function adjustSummaryFontSize() {
    const slider = document.getElementById('summaryFontSizeSlider');
    const valueDisplay = document.getElementById('summaryFontSizeValue');
    const scale = parseFloat(slider.value);
    
    valueDisplay.textContent = `ขนาด: ${Math.round(scale * 100)}%`;
    
    const summaryResult = document.querySelector('.summaryResult');
    if (summaryResult) {
        summaryResult.style.fontSize = `${scale}rem`;
    }
}

function adjustSummaryLineHeight() {
    const slider = document.getElementById('summaryLineHeightSlider');
    const valueDisplay = document.getElementById('summaryLineHeightValue');
    const scale = parseFloat(slider.value);
    
    valueDisplay.textContent = `ความสูงของบรรทัด: ${scale.toFixed(1)}`;
    
    const summaryResult = document.querySelector('.summaryResult');
    if (summaryResult) {
        summaryResult.style.lineHeight = scale;
    }
}

// === ฟังก์ชันจัดการ Modal ===
function openExportOptionsModal() { 
    document.getElementById('exportOptionsModal').style.display = 'flex'; 
}

function closeExportOptionsModal() { 
    document.getElementById('exportOptionsModal').style.display = 'none'; 
}

function closeSingleDateExportModal() {
    document.getElementById('singleDateExportModal').style.display = 'none';
    document.getElementById('exportStartDate').value = '';
    document.getElementById('exportEndDate').value = '';
}

function closeSummaryModal() {
    document.getElementById('summaryModal').style.display = 'none';
}

function closeSummaryOutputModal() {
    document.getElementById('summaryOutputModal').style.display = 'none';
}

// === ฟังก์ชันสำหรับจัดการ Responsive Design ===
function initResponsiveDesign() {
    checkScreenSize();
    
    window.addEventListener('resize', checkScreenSize);
    
    adjustTableForMobile();
}

function checkScreenSize() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        document.body.classList.add('mobile');
    } else {
        document.body.classList.remove('mobile');
    }
    
    adjustMenuForMobile(isMobile);
    adjustTableForMobile(isMobile);
}

function adjustTableForMobile(isMobile) {
    const table = document.getElementById('activityTable');
    table.className = 'recent-activities';
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        row.style.display = '';
    });
    
    const cards = document.querySelectorAll('.activity-card');
    cards.forEach(card => card.remove());
    
    console.log('📱 ปรับตารางสำหรับมือถือ: แสดงตารางปกติพร้อมการเลื่อนแนวนอน');
}

function adjustMenuForMobile(isMobile) {
}

function adjustTimeInputsForMobile() {
    const timeInputsContainer = document.querySelector('.time-inputs-container');
    if (!timeInputsContainer) return;
    
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        timeInputsContainer.style.flexWrap = 'nowrap';
        timeInputsContainer.style.overflowX = 'auto';
        timeInputsContainer.style.justifyContent = 'space-between';
        
        const timeInputGroups = timeInputsContainer.querySelectorAll('.time-input-group');
        timeInputGroups.forEach(group => {
            group.style.minWidth = '100px';
            group.style.flex = '1';
        });
    } else {
        timeInputsContainer.style.flexWrap = '';
        timeInputsContainer.style.overflowX = '';
        timeInputsContainer.style.justifyContent = '';
        
        const timeInputGroups = timeInputsContainer.querySelectorAll('.time-input-group');
        timeInputGroups.forEach(group => {
            group.style.minWidth = '';
            group.style.flex = '';
        });
    }
}

// === ฟังก์ชันสำหรับสลับการแสดงผลตารางกิจกรรม ===
function toggleActivitiesVisibility() {
    const activitiesSection = document.getElementById('activitiesSection');
    if (activitiesSection.style.display === 'none') {
        activitiesSection.style.display = 'block';
        loadUserActivities();
    } else {
        activitiesSection.style.display = 'none';
    }
}

// === ฟังก์ชันจัดการเมนูหลัก ===
function closeAllMainSections() {
    const allMainSections = document.querySelectorAll('.main-section-content');
    const allMainHeaders = document.querySelectorAll('.main-section-header');
    
    allMainSections.forEach(section => {
        section.classList.remove('active');
    });
    
    allMainHeaders.forEach(header => {
        header.classList.remove('active');
    });
    
    console.log('📂 ปิดเมนูทั้งหมดแล้ว');
}

function toggleMainSection(sectionId) {
    const section = document.getElementById(sectionId);
    const header = document.querySelector(`[onclick="toggleMainSection('${sectionId}')"]`);
    
    if (!section || !header) {
        console.error(`❌ ไม่พบเมนู: ${sectionId}`);
        return;
    }
    
    const isActive = section.classList.contains('active');
    
    closeAllMainSections();
    
    if (!isActive) {
        section.classList.add('active');
        if (header) header.classList.add('active');
        console.log(`📂 เปิดเมนู: ${sectionId}`);
        
        loadSectionData(sectionId);
    }
}

function openSingleSection(sectionId) {
    closeAllMainSections();
    
    const section = document.getElementById(sectionId);
    const header = document.querySelector(`[onclick="toggleMainSection('${sectionId}')"]`);
    
    if (section && header) {
        section.classList.add('active');
        header.classList.add('active');
        console.log(`📂 เปิดเมนูเดียว: ${sectionId}`);
        
        loadSectionData(sectionId);
    }
}

function loadSectionData(sectionId) {
    switch(sectionId) {
        case 'add-activity-section':
            populateActivityTypeDropdowns('activityTypeSelect');
            populatePersonDropdown('personSelect');
            setDefaultDateTime();
            break;
            
        case 'view-activities-section':
            loadUserActivities();
            break;
            
        case 'summary-section':
            loadSummaryData();
            populatePersonFilter();
            break;
            
        case 'backup-section':
            console.log('📊 โหลดส่วนสำรองข้อมูล');
            break;
    }
}

function getActiveMenu() {
    const activeSection = document.querySelector('.main-section-content.active');
    return activeSection ? activeSection.id : null;
}

function switchToMenu(sectionId) {
    const currentActive = getActiveMenu();
    if (currentActive === sectionId) {
        console.log(`📂 เมนู ${sectionId} เปิดอยู่แล้ว`);
        return;
    }
    
    openSingleSection(sectionId);
    console.log(`📂 สลับจาก ${currentActive} ไปยัง ${sectionId}`);
}

function refreshCurrentMenu() {
    const currentMenu = getActiveMenu();
    if (currentMenu) {
        console.log(`🔄 รีเฟรชเมนู: ${currentMenu}`);
        
        switch(currentMenu) {
            case 'add-activity-section':
                populateActivityTypeDropdowns('activityTypeSelect');
                populatePersonDropdown('personSelect');
                break;
            case 'view-activities-section':
                loadUserActivities();
                break;
            case 'summary-section':
                loadSummaryData();
                break;
        }
    }
}

// === ฟังก์ชัน PWA และการติดตั้ง ===
function hideInstallPromptPermanently() {
    document.getElementById('install-guide').style.display = 'none';
    localStorage.setItem('hideInstallPrompt', 'true');
}

// === ฟังก์ชันตรวจสอบและแสดงคำแนะนำการติดตั้ง ===
function checkAndShowInstallPrompt() {
    if (localStorage.getItem('hideInstallPrompt') === 'true') {
        const installGuide = document.getElementById('install-guide');
        if (installGuide) {
            installGuide.style.display = 'none';
        }
    }
}

// === ฟังก์ชันเตรียมข้อมูลเริ่มต้น ===
async function initializeDefaultData() {
    console.log('📂 กำลังเตรียมข้อมูลเริ่มต้น...');
    
    window.appState.backupPassword = getFromLocalStorage('backupPassword') || null;
    
    renderBackupPasswordStatus();
    
    try {
        // เปิด IndexedDB
        await openDB();
        
        // ตรวจสอบว่ามีข้อมูลเริ่มต้นหรือไม่
        const config = await dbSettings.getConfig();
        
        if (!config || !config.persons || config.persons.length === 0) {
            const defaultPersons = [
                { name: 'พระอาจารย์' },
                { name: 'ลูกศิษย์' },
                { name: 'เด็กวัด' },
            ];
            
            const defaultActivityTypes = [
                { name: 'นั่งสมาธิ' },
                { name: 'เดินจงกรม' },
                { name: 'สวดมนต์' }
            ];
            
            await dbSettings.saveConfig({
                persons: defaultPersons,
                activityTypes: defaultActivityTypes
            });
            
            saveToLocalStorage('persons', defaultPersons);
            saveToLocalStorage('activityTypes', defaultActivityTypes);
            
            console.log('✅ สร้างข้อมูลเริ่มต้นใน IndexedDB');
        } else {
            // โหลดข้อมูลจาก IndexedDB
            saveToLocalStorage('persons', config.persons || []);
            saveToLocalStorage('activityTypes', config.activityTypes || []);
        }
        
        // โหลดกิจกรรม
        const activities = await dbActivities.getAll();
        window.activities = activities;
        window.appState.activities = activities;
        saveToLocalStorage('activities', activities);
        
    } catch (error) {
        console.error('Error initializing default data:', error);
        
        // ใช้ค่าเริ่มต้นจาก localStorage ถ้า IndexedDB ล้มเหลว
        if (!getFromLocalStorage('activityTypes') || getFromLocalStorage('activityTypes').length === 0) {
            const defaultActivityTypes = [
                { name: 'นั่งสมาธิ' },
                { name: 'เดินจงกรม' },
                { name: 'สวดมนต์' }
            ];
            saveToLocalStorage('activityTypes', defaultActivityTypes);
        }
        
        if (!getFromLocalStorage('persons') || getFromLocalStorage('persons').length === 0) {
            const defaultPersons = [
                { name: 'พระอาจารย์' },
                { name: 'ลูกศิษย์' },
                { name: 'เด็กวัด' },
            ];
            saveToLocalStorage('persons', defaultPersons);
        }
    }
    
    populateActivityTypeDropdowns('activityTypeSelect');
    populatePersonDropdown('personSelect');
    populatePersonFilter();
    
    setDefaultDateTime();
    loadUserActivities();
}

async function cleanAllData() {
    if (!confirm('⚠️ ยืนยันการทำความสะอาดระบบทั้งหมด?\n\nระบบจะทำการ:\n1. ลบกิจกรรมที่ซ้ำกัน\n2. ลบกิจกรรมขยะ/ไม่สมบูรณ์\n3. ลบรายชื่อคนและประเภทกิจกรรมที่ไม่ได้ใช้\n\n*ข้อมูลจะถูกลบทั้งหมด*')) {
        return;
    }
    
    await advancedDataCleanup();
}

// === ฟังก์ชันสร้างรายงานสุขภาพข้อมูล ===
function generateHealthReport() {
    const allActivities = window.activities || window.appState.activities || [];
    const allPersons = getFromLocalStorage('persons') || [];
    const allActivityTypes = getFromLocalStorage('activityTypes') || [];
    
    let report = "📊 รายงานสุขภาพข้อมูล\n\n";
    
    report += `📝 กิจกรรมทั้งหมด: ${allActivities.length} รายการ\n`;
    
    const incompleteActivities = allActivities.filter(activity => 
        !activity.date || !activity.startTime || !activity.endTime || 
        !activity.person || !activity.activityName
    );
    
    report += `⚠️  กิจกรรมที่ขาดข้อมูล: ${incompleteActivities.length} รายการ\n`;
    
    const invalidTimeActivities = allActivities.filter(activity => {
        const duration = calculateDuration(activity.startTime, activity.endTime);
        return duration <= 0 || isNaN(duration);
    });
    
    report += `⏰ กิจกรรมที่มีเวลาไม่ถูกต้อง: ${invalidTimeActivities.length} รายการ\n`;
    
    const duplicateActivities = findDuplicateActivities(allActivities);
    report += `🔄 กิจกรรมซ้ำ: ${duplicateActivities.length} รายการ\n\n`;
    
    report += `👥 ผู้ทำกิจกรรม: ${allPersons.length} คน\n`;
    
    const unusedPersons = allPersons.filter(person => 
        !allActivities.some(activity => activity.person === person.name)
    );
    
    report += `🚫 ผู้ทำกิจกรรมที่ไม่ได้ใช้: ${unusedPersons.length} คน\n\n`;
    
    report += `📋 ประเภทกิจกรรม: ${allActivityTypes.length} ประเภท\n`;
    
    const unusedActivityTypes = allActivityTypes.filter(type => 
        !allActivities.some(activity => activity.activityName === type.name)
    );
    
    report += `🚫 ประเภทกิจกรรมที่ไม่ได้ใช้: ${unusedActivityTypes.length} ประเภท\n\n`;
    
    const corruptedActivities = allActivities.filter(activity => 
        !activity.id || typeof activity.id !== 'string'
    );
    
    report += `❌ กิจกรรมที่ข้อมูลเสียหาย: ${corruptedActivities.length} รายการ\n`;
    
    return report;
}

// === ฟังก์ชันเรียกใช้เมื่อมีการเปลี่ยนแปลงผู้ทำกิจกรรม ===
function refreshPersonFilter() {
    console.log('🔄 รีเฟรชตัวกรองผู้ทำกิจกรรม');
    populatePersonFilter();
    updateSummaryPersonDisplay();
}

// === ฟังก์ชัน Apply Config To UI ===
function applyConfigToUI(config) {
    if (!config) return;
    
    // === ผู้ทำกิจกรรม ===
    if (config.persons) {
        saveToLocalStorage('persons', config.persons);
        populatePersonDropdown('personSelect');
        populatePersonFilter();
        
        setTimeout(() => {
            autoSelectIfSingleOnce();
            updateCurrentPersonDisplay(); 
            updatePersonFilterVisibility();
        }, 100);
    }
    
    // === ประเภทกิจกรรม ===
    if (config.activityTypes) {
        saveToLocalStorage('activityTypes', config.activityTypes);
        populateActivityTypeDropdowns('activityTypeSelect');
        
        setTimeout(() => {
            autoSelectIfSingleOnce();
        }, 100);
    }

    // === รหัสผ่าน ===
    if (config.backupPassword) {
        window.appState.backupPassword = config.backupPassword;
        saveToLocalStorage('backupPassword', config.backupPassword);
    } else {
        window.appState.backupPassword = null;
        saveToLocalStorage('backupPassword', null);
    }
    renderBackupPasswordStatus();
    console.log("📥 Sync การตั้งค่าเรียบร้อย");
}

// === การโหลดครั้งแรก ===
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 เริ่มโหลดแอปพลิเคชัน (Offline Mode)...');
    
    checkAndShowInstallPrompt();
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('activity-date').value = today;
    
    // เริ่มต้นด้วยข้อมูลจาก localStorage ก่อน
    const cachedActivities = getFromLocalStorage('activities');
    if (cachedActivities && cachedActivities.length > 0) {
        window.activities = cachedActivities;
        window.appState.activities = cachedActivities;
        loadUserActivities();
        console.log('⚡ Render activities from localStorage cache');
    }
    
    await initializeDefaultData();
    
    populatePersonFilter();
    
    const thaiToday = getThaiDateString();
    document.getElementById('summary-date').value = thaiToday;
    document.getElementById('summary-start-date').value = thaiToday;
    document.getElementById('summary-end-date').value = thaiToday;
    
    // =============================================
    // EVENT LISTENERS หลัก
    // =============================================
    
    document.getElementById('activity-form').addEventListener('submit', handleActivityFormSubmit);
    document.getElementById('update-activity-button').addEventListener('click', handleActivityFormSubmit);
    document.getElementById('cancel-edit-activity-button').addEventListener('click', cancelEditActivity);
    
    // =============================================
    // EVENT LISTENERS สำหรับจัดการผู้ทำกิจกรรม
    // =============================================
    
    const addPersonBtn = document.getElementById('addPersonBtn');
    const editPersonBtn = document.getElementById('editPersonBtn');
    const deletePersonBtn = document.getElementById('deletePersonBtn');
    const resetPersonBtn = document.getElementById('resetPersonBtn');
    const savePersonBtn = document.getElementById('savePersonBtn');
    const cancelPersonBtn = document.getElementById('cancelPersonBtn');
    
    if (addPersonBtn) {
        addPersonBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            addPerson();
        });
    }
    
    if (editPersonBtn) {
        editPersonBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            editPerson();
        });
    }
    
    if (deletePersonBtn) {
        console.log('🔧 ตั้งค่า Event Listener สำหรับปุ่มลบผู้ทำกิจกรรม');
        
        deletePersonBtn.replaceWith(deletePersonBtn.cloneNode(true));
        const newDeleteBtn = document.getElementById('deletePersonBtn');
        
        newDeleteBtn.addEventListener('click', function(event) {
            console.log('🖱️ เกิด event click บนปุ่มลบ');
            event.preventDefault();
            event.stopPropagation();
            deletePerson(event);
        });
        
        newDeleteBtn.addEventListener('touchend', function(event) {
            console.log('📱 เกิด event touchend บนปุ่มลบ');
            event.preventDefault();
            event.stopPropagation();
            deletePerson(event);
        });
        
        let lastClickTime = 0;
        newDeleteBtn.addEventListener('click', function(event) {
            const now = Date.now();
            if (now - lastClickTime < 1000) {
                event.preventDefault();
                event.stopPropagation();
                console.log('⏳ ป้องกันการคลิกซ้ำ');
                return;
            }
            lastClickTime = now;
        });
    }
    
    if (resetPersonBtn) {
        resetPersonBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            resetPerson();
        });
    }
    
    if (savePersonBtn) {
        savePersonBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            savePerson(event);
        });
    }
    
    if (cancelPersonBtn) {
        cancelPersonBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            closePersonModal();
        });
    }
    
    // =============================================
    // EVENT LISTENERS สำหรับจัดการประเภทกิจกรรม
    // =============================================
    
    const addActivityTypeBtn = document.getElementById('addActivityTypeBtn');
    const editActivityTypeBtn = document.getElementById('editActivityTypeBtn');
    const deleteActivityTypeBtn = document.getElementById('deleteActivityTypeBtn');
    const resetActivityTypeBtn = document.getElementById('resetActivityTypeBtn');
    const saveActivityTypeBtn = document.getElementById('saveActivityTypeBtn');
    const cancelActivityTypeBtn = document.getElementById('cancelActivityTypeBtn');
    
    if (addActivityTypeBtn) {
        addActivityTypeBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            addActivityType();
        });
    }
    
    if (editActivityTypeBtn) {
        editActivityTypeBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            editActivityType();
        });
    }
    
    if (deleteActivityTypeBtn) {
        deleteActivityTypeBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            deleteActivityType();
        });
        
        deleteActivityTypeBtn.addEventListener('touchend', function(event) {
            event.preventDefault();
            event.stopPropagation();
            deleteActivityType();
        });
    }
    
    if (resetActivityTypeBtn) {
        resetActivityTypeBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            resetActivityType();
        });
    }
    
    if (saveActivityTypeBtn) {
        saveActivityTypeBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            saveActivityType(event);
        });
    }
    
    if (cancelActivityTypeBtn) {
        cancelActivityTypeBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            closeActivityTypeModal();
        });
    }
    
    // =============================================
    // EVENT LISTENERS สำหรับบันทึกเป็นรูปภาพ
    // =============================================
    
    const saveImageBtn = document.getElementById('saveSummaryAsImageBtn');
    if (saveImageBtn) {
        saveImageBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            saveSummaryAsImage();
        });
        
        saveImageBtn.addEventListener('touchend', function(event) {
            event.preventDefault();
            event.stopPropagation();
            saveSummaryAsImage();
        });
    }
    
    // =============================================
    // EVENT LISTENERS สำหรับการเปลี่ยนแปลงผู้ทำกิจกรรม
    // =============================================
    
    const personSelect = document.getElementById('personSelect');
    if (personSelect) {
        personSelect.addEventListener('change', function(event) {
            updateCurrentPersonDisplay();
        });
    }
    
    // =============================================
    // EVENT LISTENERS สำหรับแสดง/ซ่อนรหัสผ่าน
    // =============================================
    
    const togglePassword = document.getElementById('toggle-password');
    const togglePasswordConfirm = document.getElementById('toggle-password-confirm');
    
    if (togglePassword) {
        togglePassword.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            togglePasswordVisibility('backup-password', 'toggle-password');
        });
        
        togglePassword.addEventListener('touchend', function(event) {
            event.preventDefault();
            event.stopPropagation();
            togglePasswordVisibility('backup-password', 'toggle-password');
        });
    }
    
    if (togglePasswordConfirm) {
        togglePasswordConfirm.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            togglePasswordVisibility('backup-password-confirm', 'toggle-password-confirm');
        });
        
        togglePasswordConfirm.addEventListener('touchend', function(event) {
            event.preventDefault();
            event.stopPropagation();
            togglePasswordVisibility('backup-password-confirm', 'toggle-password-confirm');
        });
    }
    
    // =============================================
    // EVENT LISTENERS สำหรับการคำนวณเวลาเริ่มต้นอัตโนมัติ
    // =============================================
    
    const endTimeInput = document.getElementById('end-time');
    const durationHoursInput = document.getElementById('duration-hours');
    const durationMinutesInput = document.getElementById('duration-minutes');
    
    if (endTimeInput) {
        endTimeInput.addEventListener('change', function(event) {
            calculateStartTime();
        });
        
        endTimeInput.addEventListener('input', function(event) {
            calculateStartTime();
        });
    }
    
    if (durationHoursInput) {
        durationHoursInput.addEventListener('input', function(event) {
            if (this.value < 0) this.value = 0;
            calculateStartTime();
        });
        
        durationHoursInput.addEventListener('change', function(event) {
            calculateStartTime();
        });
    }
    
    if (durationMinutesInput) {
        durationMinutesInput.addEventListener('input', function(event) {
            if (this.value > 59) this.value = 59;
            if (this.value < 0) this.value = 0;
            calculateStartTime();
        });
        
        durationMinutesInput.addEventListener('change', function(event) {
            calculateStartTime();
        });
    }
    
    // =============================================
    // EVENT LISTENERS สำหรับการจัดการเมนู
    // =============================================
    
    document.addEventListener('click', function(event) {
        const allActions = document.querySelectorAll('.management-actions');
        const isClickInsidePersonActions = document.getElementById('personActions')?.contains(event.target);
        const isClickInsideActivityTypeActions = document.getElementById('activityTypeActions')?.contains(event.target);
        const isClickOnPersonToggle = event.target.closest('#togglePersonControls');
        const isClickOnActivityTypeToggle = event.target.closest('#toggleActivityTypeControls');
        
        if (!isClickInsidePersonActions && !isClickOnPersonToggle) {
            const personActions = document.getElementById('personActions');
            if (personActions) personActions.style.display = 'none';
        }
        
        if (!isClickInsideActivityTypeActions && !isClickOnActivityTypeToggle) {
            const activityTypeActions = document.getElementById('activityTypeActions');
            if (activityTypeActions) activityTypeActions.style.display = 'none';
        }
    });

}); // ปิด DOMContentLoaded

// ==============================================
// ฟังก์ชันสำหรับ Offline Mode (ไม่ต้องการ Firebase Auth)
// ==============================================

function openChangePasswordModal() {
    showToast("❌ ฟังก์ชันนี้ไม่พร้อมใช้งานในโหมด Offline", 'error');
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'none';
}

function toggleInputPassword(inputId) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
    } else {
        input.type = "password";
    }
}

async function handleChangePassword() {
    showToast("❌ ฟังก์ชันนี้ไม่พร้อมใช้งานในโหมด Offline", 'error');
}