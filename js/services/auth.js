import { db } from "../config/firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const SESSION_KEY = "teed_current_user";

// ==================== 🔑 1. HELPER FUNCTIONS ====================

export function getCollectionNameByRole(role) {
  if (role === "admin") return "admin";
  if (role === "staff") return "staff";
  return "users";
}

export function getUserCollectionRef(role) {
  return collection(db, getCollectionNameByRole(role));
}

export function getUserDocRef(role, id) {
  return doc(db, getCollectionNameByRole(role), id);
}

// ==================== 🛠️ 2. SYSTEM INITIALIZATION & MIGRATION ====================

export async function ensureInitialAdmin() {
  try {
    const adminsRef = collection(db, "admin");
    const q = query(adminsRef, where("role", "==", "admin"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      await addDoc(adminsRef, {
        username: "admin",
        password: "1234",
        role: "admin",
        fullName: "เจ้าหน้าที่ผู้ดูแลระบบ",
        phone: "-",
        department: "คณะครุศาสตร์อุตสาหกรรม",
        telegramChatId: "",
        createdAt: new Date().toISOString()
      });
      console.log("สร้างบัญชี Admin เริ่มต้นใน collection 'admins' เรียบร้อยแล้ว");
    }
  } catch (error) {
    console.warn("ตรวจสอบการตั้งค่า Firebase:", error);
  }
}

export async function autoMigrateOldUsers() {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    for (const uDoc of usersSnap.docs) {
      const uData = uDoc.data();
      if (uData.role === "staff" || uData.role === "admin") {
        const targetCol = getCollectionNameByRole(uData.role);
        await setDoc(doc(db, targetCol, uDoc.id), uData);
        await deleteDoc(doc(db, "users", uDoc.id));
        console.log(`ย้ายผู้ใช้ ${uData.username} ไปยัง ${targetCol} สำเร็จ`);
      }
    }
  } catch (e) {
    console.warn("Migration status:", e.message);
  }
}

// ==================== 🚪 3. USER AUTHENTICATION & REGISTRATION ====================

export async function loginUser(username, password) {
  const collectionsToSearch = ["users", "staff", "admin"];

  for (const colName of collectionsToSearch) {
    const colRef = collection(db, colName);
    const q = query(
      colRef,
      where("username", "==", username.trim()),
      where("password", "==", password.trim())
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      // ✅ แก้ไข: ดึงเฉพาะ Document ตัวแรกจาก Array (docs[0])
      const userDoc = querySnapshot.docs[0];
      const userData = Object.assign({ id: userDoc.id, collectionName: colName }, userDoc.data());
      
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      return userData;
    }
  }

  throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
}

export async function registerUser({ fullName, phone, department, username, password }) {
  return await createUserByRole({
    fullName: fullName.trim(),
    phone: phone.trim(),
    department,
    username: username.trim(),
    password: password.trim(),
    telegramChatId: ""
  }, "user");
}

export async function createUserByRole(userData, role = "user") {
  const targetColName = getCollectionNameByRole(role);

  for (const colName of ["users", "staff", "admin"]) {
    const checkQuery = query(collection(db, colName), where("username", "==", userData.username.trim()));
    const existing = await getDocs(checkQuery);
    if (!existing.empty) {
      throw new Error(`Username "${userData.username}" มีผู้ใช้งานในระบบแล้ว`);
    }
  }

  const newAccount = Object.assign({}, userData, {
    role: role,
    createdAt: new Date().toISOString()
  });

  const docRef = await addDoc(collection(db, targetColName), newAccount);
  const savedData = Object.assign({ id: docRef.id, collectionName: targetColName }, newAccount);

  if (role === "user") {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(savedData));
  }

  return savedData;
}

// ==================== 🔒 4. SESSION & GUARD FUNCTIONS ====================

export function getCurrentUser() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function updateSessionUser(updatedData) {
  const current = getCurrentUser();
  if (!current) return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(Object.assign({}, current, updatedData)));
}

export function logoutUser() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = "./index.html";
}

export function redirectByRole(role) {
  if (role === "admin") window.location.href = "./admin.html";
  else if (role === "staff") window.location.href = "./staff.html";
  else window.location.href = "./user.html";
}

export function checkRoleGuard(allowedRole) {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = "./index.html";
    return null;
  }
  if (user.role !== allowedRole) {
    redirectByRole(user.role);
    return null;
  }
  return user;
}

// ฟังก์ชันสลับการแสดง/ซ่อนรหัสผ่าน
window.togglePassword = function(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);

  if (!input || !icon) return;

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  }
};

// ฟังก์ชันเปิด-ปิด Modal คู่มือ Telegram
window.openTelegramGuideModal = function() {
  const modal = document.getElementById("telegramGuideModal");
  if (modal) modal.classList.remove("hidden");
}

window.closeTelegramGuideModal = function() {
  const modal = document.getElementById("telegramGuideModal");
  if (modal) modal.classList.add("hidden");
}

// ฟังก์ชันเปิด-ปิด Modal คู่มือ Telegram (Token)
window.openTelegramGuideModalToken = function() {
  const modal = document.getElementById("telegramGuideModalToken");
  if (modal) modal.classList.remove("hidden");
}

window.closeTelegramGuideModalToken = function() {
  const modal = document.getElementById("telegramGuideModalToken");
  if (modal) modal.classList.add("hidden");
}