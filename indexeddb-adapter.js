let db;

/**
 * ฟังก์ชันสร้าง UUID สำหรับสร้าง ID ให้ข้อมูล
 * - ถ้าอยู่บน HTTPS/Localhost จะใช้ crypto.randomUUID() (มาตรฐานใหม่)
 * - ถ้าอยู่บน HTTP (เช่น IP LAN) จะใช้ Math.random() แทน เพื่อป้องกัน Error
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback สำหรับ Browser เก่า หรือ HTTP context
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// เปิดการเชื่อมต่อฐานข้อมูล
async function openDB() {
  return new Promise((resolve, reject) => {
    // ชื่อ DB: activityDB, Version: 1
    const req = indexedDB.open('activityDB', 1);

    req.onupgradeneeded = e => {
      db = e.target.result;
      // สร้าง Store สำหรับเก็บกิจกรรม
      if (!db.objectStoreNames.contains('activities')) {
        db.createObjectStore('activities', { keyPath: 'id' });
      }
      // สร้าง Store สำหรับเก็บการตั้งค่า
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    req.onsuccess = e => {
      db = e.target.result;
      console.log("✅ IndexedDB Connected");
      resolve();
    };

    req.onerror = () => {
      console.error("IndexedDB Error", req.error);
      reject(req.error);
    };
  });
}

// Adapter สำหรับจัดการ Activities
const dbActivities = {
  async getAll() {
    return new Promise((resolve, reject) => {
      if (!db) return reject("DB not open");
      const tx = db.transaction('activities', 'readonly');
      const req = tx.objectStore('activities').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async add(data) {
    return new Promise((resolve, reject) => {
      // ✅ ใช้ generateUUID() เพื่อความชัวร์ในทุกสภาพแวดล้อม
      if (!data.id) data.id = generateUUID(); 
      
      const tx = db.transaction('activities', 'readwrite');
      const req = tx.objectStore('activities').add(data);
      
      tx.oncomplete = () => resolve(data.id);
      tx.onerror = () => reject(tx.error);
    });
  },

  async update(id, data) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('activities', 'readwrite');
      const store = tx.objectStore('activities');
      
      // ดึงข้อมูลเก่ามาก่อนเพื่อตรวจสอบ
      const reqGet = store.get(id);
      
      reqGet.onsuccess = () => {
        const existing = reqGet.result;
        if (!existing) {
             // ถ้าไม่เจอ ให้ add ใหม่ (กรณีข้อมูลหลุดหาย)
             data.id = id;
             store.add(data);
        } else {
             // update ทับโดยคง ID เดิมไว้
             store.put({ ...existing, ...data, id });
        }
      };
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('activities', 'readwrite');
      const req = tx.objectStore('activities').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

// Adapter สำหรับจัดการ Settings
const dbSettings = {
  async getConfig() {
    return new Promise((resolve) => {
      if (!db) return resolve({});
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get('config');
      // คืนค่า value หรือ object ว่างถ้าไม่มีข้อมูล
      req.onsuccess = () => resolve(req.result ? req.result.value : {});
      req.onerror = () => resolve({});
    });
  },

  async saveConfig(config) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      // เก็บในรูปแบบ { key: 'config', value: { ... } }
      tx.objectStore('settings').put({ key: 'config', value: config });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};