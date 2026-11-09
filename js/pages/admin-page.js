// ไฟล์: js/pages/admin-page.js
import { db } from "../config/firebase-config.js";
import { createUserByRole, getUserDocRef, checkRoleGuard, logoutUser } from "../services/auth.js";
import { 
  showToast, 
  formatThaiDate,
  handlePhoneInput,
  handleTextInput,
  handleAlphaNumericInput 
} from "../services/utils.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// บังคับกรอกตัวอักษรเฉพาะ
const nameField = document.getElementById("staffFullName");
const phoneField = document.getElementById("staffPhone");
const emailField = document.getElementById("staffEmail");
const usernameField = document.getElementById("staffUsername");
const passwordField = document.getElementById("staffPassword");
const telegramField = document.getElementById("staffTelegramId");

handleAlphaNumericInput(emailField);
handlePhoneInput(phoneField);
handleTextInput(nameField);
handleAlphaNumericInput(usernameField);
handleAlphaNumericInput(passwordField);
handlePhoneInput(telegramField);

// 1. ตรวจสอบสิทธิ์ ต้องเป็น admin เท่านั้น
const currentUser = checkRoleGuard("admin");
if (!currentUser) throw new Error("Unauthorized");

// แสดงชื่อแอดมินที่ Navbar และผูกปุ่มออกจากระบบ
const adminNameEl = document.getElementById("adminNameDisplay");
if (adminNameEl) {
  adminNameEl.innerText = currentUser.fullName || currentUser.username || "ผู้ดูแลระบบ";
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", logoutUser);
}

// 2. ระบบสลับแท็บเมนู
const tabButtons = document.querySelectorAll(".tab-btn");
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetTab = btn.getAttribute("data-tab");
    
    // สลับคลาสปุ่ม
    tabButtons.forEach(b => {
      b.className = "tab-btn flex-1 min-w-[140px] py-3 px-4 rounded-xl text-sm font-semibold transition-all text-slate-600 hover:bg-slate-100";
    });
    btn.className = "tab-btn flex-1 min-w-[140px] py-3 px-4 rounded-xl text-sm font-semibold transition-all bg-pink-600 text-white shadow";

    // สลับแสดงเนื้อหา
    ["dashboard", "staff", "positions", "users", "settings"].forEach(tab => {
      const section = document.getElementById(`tabContent-${tab}`);
      if (section) {
        if (tab === targetTab) {
          section.classList.remove("hidden");
        } else {
          section.classList.add("hidden");
        }
      }
    });
  });
});

// ==================== 3. โหลดและแสดงข้อมูลแดชบอร์ด (All Bookings) ====================
function loadDashboardAndBookings() {
  const tableBody = document.getElementById("allBookingsTableBody");
  if (!tableBody) return;
  
  onSnapshot(collection(db, "bookings"), (snapshot) => {
    let total = 0, pending = 0, approved = 0, completed = 0;
    let html = "";

    if (snapshot.empty) {
      tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">ยังไม่มีรายการจองคิวในระบบ</td></tr>`;
      updateStats(0, 0, 0, 0);
      return;
    }

    const bookings = [];
    snapshot.forEach(docSnap => bookings.push(Object.assign({ id: docSnap.id }, docSnap.data())));
    bookings.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    bookings.forEach(b => {
      total++;
      if (b.status === "pending") pending++;
      else if (b.status === "approved") approved++;
      else if (b.status === "completed") completed++;

      let statusBadge = "";
      if (b.status === "pending") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">รอรับงาน</span>`;
      else if (b.status === "approved") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">อนุมัติแล้ว</span>`;
      else if (b.status === "rejected") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold" title="${b.rejectReason || ''}">ปฏิเสธงาน</span>`;
      else if (b.status === "completed") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">เสร็จสิ้น</span>`;
      else if (b.status === "cancelled") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">ยกเลิกแล้ว</span>`;

      const timeText = b.requireTime ? `<br/><span class="text-xs text-slate-500">${b.startTime} - ${b.endTime} น.</span>` : `<br/><span class="text-xs text-slate-400">งานรายวัน</span>`;

      html += `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-4">
            <span class="font-bold text-slate-800">${formatThaiDate(b.date)}</span>
            ${timeText}
          </td>
          <td class="p-4">
            <p class="font-medium text-slate-800">${b.requesterName}</p>
            <p class="text-xs text-slate-500">${b.department || '-'}</p>
          </td>
          <td class="p-4 font-semibold text-pink-600">${b.positionName}</td>
          <td class="p-4 text-slate-700">${b.staffName || '<span class="text-slate-400">ยังไม่ระบุ</span>'}</td>
          <td class="p-4">
            <p class="font-medium text-slate-800">${b.eventName}</p>
            <p class="text-xs text-slate-500 truncate max-w-xs">${b.jobDetail || '-'}</p>
          </td>
          <td class="p-4">${statusBadge}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
    updateStats(total, pending, approved, completed);
  });
}

function updateStats(total, pending, approved, completed) {
  const st = document.getElementById("statTotal");
  const sp = document.getElementById("statPending");
  const sa = document.getElementById("statApproved");
  const sc = document.getElementById("statCompleted");
  if (st) st.innerText = total;
  if (sp) sp.innerText = pending;
  if (sa) sa.innerText = approved;
  if (sc) sc.innerText = completed;
}

const refreshBtn = document.getElementById("refreshDashboardBtn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    showToast("รีเฟรชข้อมูลแดชบอร์ดแล้ว", "success");
  });
}

// ==================== 4. จัดการตำแหน่งงาน (Positions CRUD) ====================
async function loadPositions() {
  const tbody = document.getElementById("positionsTableBody");
  const selectElement = document.getElementById("staffPositionSelect");

  try {
    const querySnapshot = await getDocs(collection(db, "positions"));
    
    if (selectElement) {
      let optionsHTML = `<option value="">-- เลือกตำแหน่งงาน --</option>`;
      querySnapshot.forEach((docSnap) => {
        const posId = docSnap.id;
        const posData = docSnap.data();
        optionsHTML += `<option value="${posId}" data-name="${posData.name}">${posData.name}</option>`;
      });
      selectElement.innerHTML = optionsHTML;
    }

    if (tbody) {
      if (querySnapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-400">ยังไม่มีข้อมูลตำแหน่งงาน</td></tr>`;
        return;
      }

      let tableHTML = "";
      for (const docSnap of querySnapshot.docs) {
        const posId = docSnap.id;
        const posData = docSnap.data();

        const usersRef = collection(db, "staff");
        const q = query(usersRef, where("positionId", "==", posId));
        const countSnapshot = await getCountFromServer(q);
        const staffCount = countSnapshot.data().count;

        tableHTML += `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-4 flex items-center justify-between">
              <span class="font-medium text-slate-800">${posData.name}</span>
              <span class="bg-pink-50 text-pink-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-pink-100 flex items-center gap-1 shadow-sm">
                <i class="fa-solid fa-users text-[10px]"></i> ${staffCount} คน
              </span>
            </td>
            <td class="p-4 text-slate-600">
              ${posData.requireTime 
                ? '<span class="text-amber-600 font-medium">บังคับระบุเวลา (เช็คคิวชน)</span>' 
                : '<span class="text-slate-400">งานรายวัน (ไม่ต้องระบุเวลาขั้นต่ำ)</span>'}
            </td>
            <td class="p-4 text-center">
              <button onclick="window.deletePosition('${posId}', '${posData.name}')" class="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }
      tbody.innerHTML = tableHTML;
    }

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการโหลดข้อมูล:", error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-rose-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
  }
}

const posForm = document.getElementById("createPositionForm");
if (posForm) {
  posForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1. เพิ่มบรรทัดนี้: ล็อกปุ่มกดทันที
    const submitBtn = posForm.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>กำลังเพิ่ม...</span>`;
    }

    const name = document.getElementById("posName").value.trim();
    const requireTime = document.getElementById("posRequireTime").checked;

    try {
      await addDoc(collection(db, "positions"), { name, requireTime, createdAt: new Date().toISOString() });
      showToast(`เพิ่มตำแหน่ง "${name}" สำเร็จ`, "success");
      posForm.reset();
      const reqTimeCheck = document.getElementById("posRequireTime");
      if (reqTimeCheck) reqTimeCheck.checked = true;
      loadPositions();
    } catch (error) {
      showToast("เกิดข้อผิดพลาด: " + error.message, "error");
    } finally {
      // 2. เพิ่มบรรทัดนี้: ปลดล็อกปุ่มกด
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
      }
    }
  });
}

window.deletePosition = async function(positionId, positionName) {
  if (confirm(`คุณต้องการลบตำแหน่ง "${positionName}" ใช่หรือไม่?`)) {
    try {
      const usersRef = collection(db, "staff");
      const q = query(usersRef, where("positionId", "==", positionId));
      const querySnapshot = await getDocs(q);

      const updatePromises = querySnapshot.docs.map(async (userDoc) => {
        const userDocRef = doc(db, "staff", userDoc.id);
        return updateDoc(userDocRef, {
          positionId: "",
          positionName: "ไม่มีตำแหน่ง"
        });
      });

      await Promise.all(updatePromises);
      await deleteDoc(doc(db, "positions", positionId));

      showToast("ลบตำแหน่งสำเร็จ และอัปเดตข้อมูลเรียบร้อยแล้ว", "success");
      loadPositions();
      loadUsersList();
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการลบตำแหน่ง:", error);
      showToast("เกิดข้อผิดพลาด ไม่สามารถลบตำแหน่งได้: " + error.message, "error");
    }
  }
};

// ฟังก์ชันอัปเดตตำแหน่งงานของบุคลากรรายคน
window.updateStaffPosition = async function(staffId, selectElement) {
  const newPositionId = selectElement.value;
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const newPositionName = selectedOption.getAttribute("data-name") || "ไม่มีตำแหน่ง";

  try {
    const staffDocRef = doc(db, "staff", staffId);
    await updateDoc(staffDocRef, {
      positionId: newPositionId,
      positionName: newPositionName
    });
    showToast(`เปลี่ยนตำแหน่งเป็น "${newPositionName}" เรียบร้อย`, "success");
  } catch (error) {
    showToast("เกิดข้อผิดพลาด: " + error.message, "error");
  }
};

// ==================== 5. จัดการบุคลากร (Staff Management) ====================
const staffTableBody = document.getElementById("staffTableBody");
let allStaffData = [];

function loadStaffList() {
  if (!staffTableBody) return;
  
  onSnapshot(collection(db, "staff"), (snapshot) => {
    allStaffData = [];
    snapshot.forEach(docSnap => {
      allStaffData.push(Object.assign({ id: docSnap.id }, docSnap.data()));
    });
    renderStaffTable(allStaffData);
  });
}

function renderStaffTable(dataArray) {
  const searchInput = document.getElementById("searchStaffInput");
  const searchKeyword = searchInput ? searchInput.value.toLowerCase().trim() : "";
  
  let html = "";
  let count = 0;

  dataArray.forEach(u => {
    const fullName = (u.fullName || "").toLowerCase();
    const positionName = (u.positionName || "").toLowerCase();
    const matchesSearch = fullName.includes(searchKeyword) || positionName.includes(searchKeyword);


    // 1. ดึงตัวเลือกตำแหน่งที่มีทั้งหมดในระบบ
    let posOptions = `<option value="" data-name="ไม่มีตำแหน่ง">-- ไม่มีตำแหน่ง --</option>`;
    const selectEl = document.getElementById("staffPositionSelect");
    if (selectEl) {
      Array.from(selectEl.options).forEach(opt => {
        if (opt.value) {
          const isSelected = u.positionId === opt.value ? "selected" : "";
          posOptions += `<option value="${opt.value}" data-name="${opt.getAttribute("data-name")}" ${isSelected}>${opt.text}</option>`;
        }
      });
    }
    if (matchesSearch) {
      count++;
      html += `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="p-4">
            <div class="font-medium text-slate-800">${u.fullName || '-'}</div>
            <div class="text-xs text-slate-500 mt-1 flex flex-col gap-0.5">
              <span><i class="fa-solid fa-phone text-slate-400 mr-1"></i> ${u.phone || 'ยังไม่ระบุเบอร์โทร'}</span>
              <span><i class="fa-solid fa-envelope text-slate-400 mr-1"></i> ${u.email || 'ยังไม่ระบุอีเมล'}</span>
            </div>
          </td>
          <td class="p-4">
            <select onchange="window.updateStaffPosition('${u.id}', this)" class="px-2 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 bg-white font-medium text-pink-700">
              ${posOptions}
            </select>
          </td>          <td class="p-4">
            <p class="text-xs">User: <code class="bg-slate-100 px-1 rounded">${u.username || '-'}</code></p>
            <p class="text-xs">Pass: <code class="bg-slate-100 px-1 rounded">${u.password || '-'}</code></p>
          </td>
          <td class="p-4">
            <div class="flex items-center gap-2">
              <input type="text" id="telegramInput_${u.id}" value="${u.telegramChatId || ''}" oninput="this.value = this.value.replace(/[^0-9]/g, '')" placeholder="ระบุ Telegram ID" class="w-36 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500" />
              <button onclick="window.updateStaffTelegram('${u.id}', 'staff')" class="bg-pink-600 hover:bg-pink-700 text-white px-2.5 py-1.5 text-xs rounded-lg transition-colors shadow-sm" title="บันทึก Telegram ID">
                <i class="fa-solid fa-floppy-disk"></i>
              </button>
            </div>
          </td>
          <td class="p-4 text-center space-x-1">
            <button onclick="window.openEditUserModal('${u.id}', 'staff')" class="text-slate-400 hover:text-blue-600 p-2 rounded-lg transition-colors" title="แก้ไขรหัสผ่าน">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="window.deleteStaff('${u.id}')" class="text-slate-400 hover:text-red-600 p-2 rounded-lg transition-colors" title="ลบบัญชีบุคลากร">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
    }
  });

  if (count === 0) {
    staffTableBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">ไม่พบข้อมูลบุคลากรที่ค้นหา</td></tr>`;
  } else {
    staffTableBody.innerHTML = html;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchStaffInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderStaffTable(allStaffData);
    });
  }
});

const staffForm = document.getElementById("createStaffForm");

if (staffForm) {
  staffForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1. เพิ่มบรรทัดนี้: ล็อกปุ่มกดทันทีเพื่อกันกดซ้ำ
    const submitBtn = staffForm.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>กำลังบันทึก...</span>`;
    }

    const fullName = document.getElementById("staffFullName").value.trim();
    const posSelect = document.getElementById("staffPositionSelect");
    const positionId = posSelect.value;
    const positionName = posSelect.options[posSelect.selectedIndex].getAttribute("data-name");
    const phone = document.getElementById("staffPhone").value.trim();
    const email = document.getElementById("staffEmail").value.trim();
    const username = document.getElementById("staffUsername").value.trim();
    const password = document.getElementById("staffPassword").value.trim();
    const telegramChatId = document.getElementById("staffTelegramId").value.trim();

    try {
      // 2. เช็ก Username ซ้ำจากคอลเลกชัน "staff"
      const staffRef = collection(db, "staff");
      const q = query(staffRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        showToast(`Username "${username}" นี้ถูกใช้งานไปแล้ว กรุณาใช้ชื่ออื่น`, "warning");
        return;
      }

      await createUserByRole({
        username,
        password,
        fullName,
        positionId,
        positionName,
        phone,
        email,
        telegramChatId,
        isAvailable: true
      }, "staff");

      showToast(`สร้างบัญชีบุคลากร "${fullName}" สำเร็จ`, "success");
      staffForm.reset();

    } catch (error) {
      showToast("เกิดข้อผิดพลาด: " + error.message, "error");
    } finally {
      // 3. เพิ่มบรรทัดนี้: ปลดล็อกปุ่มกดเมื่อทำงานเสร็จ
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
      }
    }
  });
}

window.deleteStaff = async function(id) {
  if (confirm("ต้องการลบบัญชีบุคลากรนี้ใช่หรือไม่?")) {
    try {
      await deleteDoc(doc(db, "staff", id));
      showToast("ลบบัญชีบุคลากรเรียบร้อย", "success");
    } catch (error) {
      showToast("ลบไม่สำเร็จ: " + error.message, "error");
    }
  }
};

// ==================== 6. จัดการผู้ใช้งานทั่วไป (Users Management) ====================
const usersTableBody = document.getElementById("usersTableBody");

function loadUsersList() {
  if (!usersTableBody) return;
  
  onSnapshot(collection(db, "users"), (snapshot) => {
    let html = "";
    let count = 0;

    snapshot.forEach(docSnap => {
      const u = Object.assign({ id: docSnap.id }, docSnap.data());
      if (u.role === "user") {
        count++;
        html += `
          <tr class="hover:bg-slate-50">
            <td class="p-4">
              <p class="font-medium text-slate-800">${u.fullName}</p>
              <p class="text-xs text-slate-500">${u.department || '-'}</p>
            </td>
            <td class="p-4 text-slate-600">${u.phone || '-'}</td>
            <td class="p-4">
              <p class="text-xs">User: <code class="bg-slate-100 px-1 rounded">${u.username}</code></p>
              <p class="text-xs">Pass: <code class="bg-slate-100 px-1 rounded">${u.password}</code></p>
            </td>
            <td class="p-4">
              <div class="flex items-center gap-2">
                <input type="text" id="telegramInput_${u.id}" value="${u.telegramChatId || ''}" oninput="this.value = this.value.replace(/[^0-9]/g, '')" placeholder="ระบุ Telegram ID" class="w-36 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500" />
                <button onclick="window.updateStaffTelegram('${u.id}', 'users')" class="bg-pink-600 hover:bg-pink-700 text-white px-2.5 py-1.5 text-xs rounded-lg transition-colors shadow-sm" title="บันทึก Telegram ID">
                  <i class="fa-solid fa-floppy-disk"></i>
                </button>
              </div>
            </td>
            <td class="p-4 text-center space-x-1">
              <button onclick="window.openEditUserModal('${u.id}', 'users')" class="text-slate-400 hover:text-blue-600 p-2 rounded-lg transition-colors" title="แก้ไขรหัสผ่าน">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button onclick="window.deleteUserAcc('${u.id}')" class="text-slate-400 hover:text-red-600 p-2 rounded-lg transition-colors" title="ลบบัญชีผู้ใช้งาน">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
        `;
      }
    });

    if (count === 0) {
      usersTableBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">ยังไม่มีผู้ใช้งานสมัครสมาชิกในระบบ</td></tr>`;
    } else {
      usersTableBody.innerHTML = html;
    }
  });
}

window.deleteUserAcc = async function(id) {
  if (confirm("ต้องการลบบัญชีผู้ใช้งานนี้ใช่หรือไม่?")) {
    try {
      await deleteDoc(doc(db, "users", id));
      showToast("ลบบัญชีผู้ใช้งานเรียบร้อย", "success");
    } catch (error) {
      showToast("ลบไม่สำเร็จ: " + error.message, "error");
    }
  }
};

window.updateStaffTelegram = async function(id, colName = "users") {
  const inputElement = document.getElementById(`telegramInput_${id}`);
  if (!inputElement) return;
  
  const newTelegramId = inputElement.value.trim();

  try {
    const docRef = doc(db, colName, id);
    await updateDoc(docRef, {
      telegramChatId: newTelegramId
    });
    showToast("บันทึก Telegram Chat ID เรียบร้อย", "success");
  } catch (error) {
    showToast("เกิดข้อผิดพลาด: " + error.message, "error");
  }
};

window.openEditUserModal = async function(id, colName = "users") {
  try {
    const docRef = doc(db, colName, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return showToast("ไม่พบข้อมูลผู้ใช้งาน", "error");
    
    const u = docSnap.data();
    
    const newPassword = prompt(`แก้ไขรหัสผ่านใหม่สำหรับ (${u.fullName}):`, u.password || "");
    if (newPassword === null) return;

    await updateDoc(docRef, {
      password: newPassword.trim()
    });

    showToast("อัปเดตรหัสผ่านสำเร็จ", "success");
  } catch (error) {
    showToast("เกิดข้อผิดพลาด: " + error.message, "error");
  }
};

// ==================== 7. ตั้งค่า Telegram Bot Token & เปลี่ยนรหัส Admin ====================
const botTokenInput = document.getElementById("botTokenInput");
const adminUsernameInput = document.getElementById("adminUsernameInput");

async function loadSettings() {
  try {
    const docSnap = await getDoc(doc(db, "settings", "config"));
    if (docSnap.exists() && botTokenInput) {
      botTokenInput.value = docSnap.data().telegramBotToken || "";
    }
  } catch (e) {
    console.warn("ยังไม่ได้ตั้งค่า Telegram Bot Token");
  }

  if (adminUsernameInput && currentUser) {
    adminUsernameInput.value = currentUser.username || "";
  }
}

const botTokenForm = document.getElementById("botTokenForm");
if (botTokenForm) {
  botTokenForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = botTokenInput.value.trim();

    try {
      await setDoc(doc(db, "settings", "config"), { telegramBotToken: token }, { merge: true });
      showToast("บันทึก Telegram Bot Token เรียบร้อย", "success");
    } catch (error) {
      showToast("บันทึกไม่สำเร็จ: " + error.message, "error");
    }
  });
}

const adminPasswordForm = document.getElementById("adminPasswordForm");
if (adminPasswordForm) {
  adminPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const oldPasswordInput = document.getElementById("adminOldPassword");
    const newPasswordInput = document.getElementById("adminNewPassword");
    const confirmPasswordInput = document.getElementById("adminConfirmPassword");

    const oldPassword = oldPasswordInput ? oldPasswordInput.value.trim() : "";
    const newPassword = newPasswordInput ? newPasswordInput.value.trim() : "";
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : "";

    if (newPassword.length < 4) {
      showToast("กรุณาตั้งรหัสผ่านใหม่อย่างน้อย 4 ตัวอักษร", "warning");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน", "warning");
      return;
    }

    try {
      const adminRef = getUserDocRef("admin", currentUser.id);
      const adminSnap = await getDoc(adminRef);

      if (!adminSnap.exists()) {
        showToast("ไม่พบข้อมูลผู้ดูแลระบบในระบบ", "error");
        return;
      }

      const adminData = adminSnap.data();

      if (adminData.password !== oldPassword) {
        showToast("รหัสผ่านเก่าไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง", "error");
        return;
      }

      await updateDoc(adminRef, { password: newPassword });
      showToast("เปลี่ยนรหัสผ่านผู้ดูแลระบบสำเร็จ!", "success");

      if (adminPasswordForm) adminPasswordForm.reset();

    } catch (error) {
      console.error("Error updating password:", error);
      showToast("เปลี่ยนรหัสผ่านไม่สำเร็จ: " + error.message, "error");
    }
  });
}


// เรียกใช้งานฟังก์ชันเริ่มต้นทั้งหมดเมื่อเปิดหน้า Admin
loadDashboardAndBookings();
loadPositions();
loadStaffList();
loadUsersList();
loadSettings();