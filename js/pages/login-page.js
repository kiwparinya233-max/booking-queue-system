import {
  ensureInitialAdmin,
  loginUser,
  registerUser,
  getCurrentUser,
  redirectByRole
} from "../services/auth.js";
import {  
  showToast,
  handlePhoneInput,
  handleTextInput,
  handleAlphaNumericInput 
} from "../services/utils.js";

// บังคับกรอกตัวอักษรเฉพาะ
const nameField = document.getElementById("regFullName");
const phoneField = document.getElementById("regPhone");
const reusernameInput = document.getElementById("regUsername");
const repasswordInput = document.getElementById("regPassword");
const reconfirmPasswordInput = document.getElementById("regConfirmPassword");
const logUsername = document.getElementById("loginUsername");
const logPassword = document.getElementById("loginPassword");


// เรียกใช้ฟังก์ชันควบคุมประเภทตัวอักษร
handlePhoneInput(phoneField);
handleTextInput(nameField);
handleAlphaNumericInput(reusernameInput);
handleAlphaNumericInput(repasswordInput);
handleAlphaNumericInput(reconfirmPasswordInput);
handleAlphaNumericInput(logUsername);
handleAlphaNumericInput(logPassword);

// หากล็อกอินค้างไว้แล้ว ให้ส่งไปหน้าโรลของตัวเองทันที
const currentUser = getCurrentUser();
if (currentUser) {
  redirectByRole(currentUser.role);
}

// สร้างเฉพาะบัญชี Admin เริ่มต้นหากยังไม่มีแอดมินในระบบ
ensureInitialAdmin();

const tabLoginBtn = document.getElementById("tabLoginBtn");
const tabRegisterBtn = document.getElementById("tabRegisterBtn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const registerSubmitBtn = document.getElementById("registerSubmitBtn");

// สลับแท็บไปหน้าเข้าสู่ระบบ
tabLoginBtn.addEventListener("click", () => {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  tabLoginBtn.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all bg-white text-pink-600 shadow-sm";
  tabRegisterBtn.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all text-slate-600 hover:text-slate-900";
});

// สลับแท็บไปหน้าสมัครสมาชิก (เฉพาะผู้ใช้งาน)
tabRegisterBtn.addEventListener("click", () => {
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
  tabRegisterBtn.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all bg-white text-emerald-600 shadow-sm";
  tabLoginBtn.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all text-slate-600 hover:text-slate-900";
});

// กดปุ่มเข้าสู่ระบบ
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;

  loginSubmitBtn.disabled = true;
  loginSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>กำลังตรวจสอบ...</span>`;

  try {
    const user = await loginUser(username, password);
    showToast(`เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ ${user.fullName}`, "success");
    setTimeout(() => redirectByRole(user.role), 600);
  } catch (error) {
    showToast(error.message, "error");
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.innerHTML = `<span>เข้าสู่ระบบ</span> <i class="fa-solid fa-arrow-right"></i>`;
  }
});

// กดปุ่มสมัครสมาชิกผู้ใช้งาน
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("regFullName").value;
  const phone = document.getElementById("regPhone").value;
  const department = document.getElementById("regDepartment").value;
  const username = document.getElementById("regUsername").value;
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("regConfirmPassword").value;

  if (password.trim().length < 4) {
    showToast("กรุณาตั้งรหัสผ่านอย่างน้อย 4 ตัวอักษร", "warning");
    return;
  }

  // ตรวจสอบรหัสผ่านว่าตรงกันหรือไม่
  if (password !== confirmPassword) {
    showToast("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง", "warning");
    return;
  }

  registerSubmitBtn.disabled = true;
  registerSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>กำลังสร้างบัญชี...</span>`;

  try {
    const newUser = await registerUser({ fullName, phone, department, username, password });
    showToast("สมัครสมาชิกสำเร็จ! กำลังเข้าสู่หน้าผู้ใช้งาน...", "success");
    setTimeout(() => redirectByRole(newUser.role), 700);
  } catch (error) {
    showToast(error.message, "error");
    registerSubmitBtn.disabled = false;
    registerSubmitBtn.innerHTML = `<i class="fa-solid fa-check-circle"></i> <span>สมัครสมาชิกผู้ใช้งาน</span>`;
  }
});