import { db } from "../config/firebase-config.js";
import { getUserDocRef, checkRoleGuard, logoutUser, updateSessionUser } from "../services/auth.js";
import { showToast, formatThaiDate } from "../services/utils.js";
import { sendTelegramNotify } from "../services/telegram.js";
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. ตรวจสอบสิทธิ์ ต้องเป็น staff เท่านั้น
const currentUser = checkRoleGuard("staff");
if (!currentUser) throw new Error("Unauthorized");

// แสดงข้อมูลโปรไฟล์ที่ Navbar และ Header
const setText = (id, text) => {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
};

setText("staffNameDisplay", currentUser.fullName);
setText("userNameDisplay", currentUser.fullName);
setText("userDeptDisplay", currentUser.positionName || "บุคลากร");
setText("staffPositionDisplay", currentUser.positionName || "บุคลากร");
setText("welcomeStaffName", currentUser.fullName);
setText("staffPhoneDisplay", currentUser.phone || "-");
setText("staffEmailDisplay", currentUser.email || "-");

const telegramInput = document.getElementById("staffTelegramInput");
if (telegramInput) {
  telegramInput.value = currentUser.telegramChatId || "";
}

const availabilityToggle = document.getElementById("availabilityToggle");
const availabilityText = document.getElementById("availabilityText");

// ตั้งค่าสถานะเปิด/ปิดรับงานเริ่มต้น
const isAvail = currentUser.isAvailable !== false;
if (availabilityToggle) availabilityToggle.checked = isAvail;
updateAvailabilityUI(isAvail);

// ผูกปุ่มออกจากระบบ
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", logoutUser);
}

// บันทึก Telegram Chat ID
const saveTelegramBtn = document.getElementById("saveStaffTelegramBtn");
if (saveTelegramBtn) {
  saveTelegramBtn.addEventListener("click", async () => {
    if (!telegramInput) return;
    const chatId = telegramInput.value.trim();
    try {
      await updateDoc(getUserDocRef("staff", currentUser.id), { telegramChatId: chatId });
      updateSessionUser({ telegramChatId: chatId });
      showToast("บันทึก Telegram Chat ID เรียบร้อย", "success");
    } catch (error) {
      showToast("บันทึกไม่สำเร็จ: " + error.message, "error");
    }
  });
}

// เปลี่ยนสถานะ เปิด/ปิดรับงาน (Available)
if (availabilityToggle) {
  availabilityToggle.addEventListener("change", async () => {
    const newStatus = availabilityToggle.checked;
    updateAvailabilityUI(newStatus);

    try {
      await updateDoc(doc(db, "staff", currentUser.id), { isAvailable: newStatus });
      updateSessionUser({ isAvailable: newStatus });
      showToast(newStatus ? "เปิดรับคิวงานปกติแล้ว" : "ตั้งสถานะงดรับคิวชั่วคราวแล้ว", "success");
    } catch (error) {
      showToast("อัปเดตสถานะไม่สำเร็จ: " + error.message, "error");
    }
  });
}

function updateAvailabilityUI(isAvailable) {
  if (!availabilityText) return;
  if (isAvailable) {
    availabilityText.innerText = "เปิดรับคิวงานปกติ (Available)";
    availabilityText.className = "text-xs text-emerald-600 font-semibold mt-0.5";
  } else {
    availabilityText.className = "text-xs text-red-600 font-semibold mt-0.5";
    availabilityText.innerText = "งดรับคิวชั่วคราว (Unavailable / ลา)";
  }
}

// 2. โหลดรายการคิวงานที่ถูกจองมาถึงบุคลากรคนนี้แบบเรียลไทม์
const staffTasksTableBody = document.getElementById("staffTasksTableBody");

function loadMyAssignedTasks() {
  if (!staffTasksTableBody) return;

  const q = query(collection(db, "bookings"), where("staffId", "==", currentUser.id));

  onSnapshot(q, (snapshot) => {
    let html = "";
    let pendingCnt = 0;

    if (snapshot.empty) {
      staffTasksTableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">ยังไม่มีรายการจองคิวที่ส่งมาถึงคุณ</td></tr>`;
      const pendingEl = document.getElementById("pendingCount");
      if (pendingEl) pendingEl.innerText = 0;
      return;
    }

    const tasks = [];
    snapshot.forEach(d => tasks.push(Object.assign({ id: d.id }, d.data())));
    tasks.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime || '00:00'}`);
      const dateB = new Date(`${b.date}T${b.startTime || '00:00'}`);
      return dateA - dateB;
    });

    tasks.forEach(t => {
      if (t.status === "pending") pendingCnt++;

      let statusBadge = "";
      if (t.status === "pending") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">รอดำเนินการ (รอคุณกดรับ)</span>`;
      else if (t.status === "approved") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">อนุมัติแล้ว (รับงานแล้ว)</span>`;
      else if (t.status === "rejected") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold">คุณปฏิเสธงาน</span>`;
      else if (t.status === "completed") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">งานเสร็จสิ้นแล้ว</span>`;
      else if (t.status === "cancelled") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">ผู้ใช้งานยกเลิกคิว</span>`;

      const timeText = t.requireTime ? `<br/><span class="text-xs text-slate-500">${t.startTime} - ${t.endTime} น.</span>` : `<br/><span class="text-xs text-slate-400">งานรายวัน</span>`;
      
      const attachmentLink = t.attachmentUrl ? `<a href="${t.attachmentUrl}" target="_blank" class="text-blue-600 hover:underline text-xs block"><i class="fa-solid fa-link mr-1"></i> ดูเอกสารแนบ</a>` : `<span class="text-slate-400 text-xs">-</span>`;
      const noteText = t.note ? `<p class="text-xs text-amber-700 mt-0.5">หมายเหตุ: ${t.note}</p>` : "";

      let actionButtons = `<span class="text-slate-400 text-xs">-</span>`;
      if (t.status === "pending") {
        actionButtons = `
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="window.approveTask('${t.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition-all">รับงาน</button>
            <button onclick="window.openRejectModal('${t.id}')" class="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all">ปฏิเสธ</button>
          </div>
        `;
      } else if (t.status === "approved") {
        actionButtons = `
          <button onclick="window.completeTask('${t.id}')" class="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow transition-all">กดงานเสร็จสิ้น</button>
        `;
      }

      html += `
        <tr class="hover:bg-slate-50">
          <td class="p-4">
            <span class="font-bold text-slate-800">${formatThaiDate(t.date)}</span>
            ${timeText}
          </td>
          <td class="p-4">
            <p class="font-medium text-slate-800">${t.requesterName}</p>
            <p class="text-xs text-slate-500">${t.department || '-'}</p>
            <p class="text-xs text-slate-400">โทร: ${t.requesterPhone || '-'}</p>
          </td>
          <td class="p-4">
            <p class="font-medium text-slate-800">${t.eventName}</p>
            <p class="text-xs text-slate-600 mt-0.5">${t.jobDetail || '-'}</p>
          </td>
          <td class="p-4">
            ${attachmentLink}
            ${noteText}
          </td>
          <td class="p-4">${statusBadge}</td>
          <td class="p-4 text-center">${actionButtons}</td>
        </tr>
      `;
    });

    staffTasksTableBody.innerHTML = html;
    const pendingEl = document.getElementById("pendingCount");
    if (pendingEl) pendingEl.innerText = pendingCnt;
  });
}

// 3. ฟังก์ชันกดอนุมัติรับงาน พร้อมส่ง Telegram แจ้งเตือนผู้จอง
window.approveTask = async function(bookingId) {
  if (confirm("คุณต้องการกดรับงานนี้ใช่หรือไม่?")) {
    try {
      await updateDoc(doc(db, "bookings", bookingId), { status: "approved" });

      const bookingDocSnap = await getDoc(doc(db, "bookings", bookingId));
      if (bookingDocSnap.exists()) {
        const bData = bookingDocSnap.data();
        if (bData.userTelegramChatId) {
          const msg = `<b>แจ้งเตือนสถานะการจองคิว</b>\n\nบุคลากร <b>${bData.staffName}</b> ได้กดรับงานของคุณเรียบร้อยแล้ว\n\nงาน: <b>${bData.eventName}</b>\nวันที่: ${formatThaiDate(bData.date)} ${bData.requireTime ? `เวลา ${bData.startTime}-${bData.endTime} น.` : ''}\n\nกรุณารอรับบริการตามวันและเวลาดังกล่าวครับ`;
          await sendTelegramNotify(bData.userTelegramChatId, msg);
        }
      }

      showToast("รับงานสำเร็จและส่งแจ้งเตือนเรียบร้อย", "success");
    } catch (error) {
      showToast("อัปเดตสถานะไม่สำเร็จ: " + error.message, "error");
    }
  }
};

// 4. ฟังก์ชันกดงานเสร็จสิ้น
window.completeTask = async function(bookingId) {
  if (confirm("ยืนยันว่าปฏิบัติงานนี้เสร็จสิ้นเรียบร้อยแล้ว?")) {
    try {
      await updateDoc(doc(db, "bookings", bookingId), { status: "completed" });
      showToast("บันทึกงานเสร็จสิ้นเรียบร้อย", "success");
    } catch (error) {
      showToast("ทำรายการไม่สำเร็จ: " + error.message, "error");
    }
  }
};

// 5. Modal ปฏิเสธงาน
const rejectModal = document.getElementById("rejectModal");
const rejectBookingIdInput = document.getElementById("rejectBookingId");
const rejectReasonInput = document.getElementById("rejectReasonInput");

window.openRejectModal = function(bookingId) {
  if (rejectBookingIdInput) rejectBookingIdInput.value = bookingId;
  if (rejectReasonInput) rejectReasonInput.value = "";
  if (rejectModal) rejectModal.classList.remove("hidden");
};

const closeRejectBtn = document.getElementById("closeRejectModalBtn");
if (closeRejectBtn) {
  closeRejectBtn.addEventListener("click", () => {
    if (rejectModal) rejectModal.classList.add("hidden");
  });
}

const confirmRejectBtn = document.getElementById("confirmRejectBtn");
if (confirmRejectBtn) {
  confirmRejectBtn.addEventListener("click", async () => {
    if (!rejectBookingIdInput || !rejectReasonInput) return;
    const bookingId = rejectBookingIdInput.value;
    const reason = rejectReasonInput.value.trim();

    if (!reason) {
      showToast("กรุณาระบุเหตุผลในการปฏิเสธงาน", "warning");
      return;
    }

    try {
      // 1. อัปเดตสถานะเป็น rejected
      await updateDoc(doc(db, "bookings", bookingId), {
        status: "rejected",
        rejectReason: reason
      });

      // 2. ดึงข้อมูลการจองเพื่อส่ง Telegram แจ้งเตือนผู้จอง
      const bookingDocSnap = await getDoc(doc(db, "bookings", bookingId));
      if (bookingDocSnap.exists()) {
        const bData = bookingDocSnap.data();
        if (bData.userTelegramChatId) {
          const msg = `<b>แจ้งเตือนสถานะการจองคิว</b>\n\n` +
                      `บุคลากร <b>${bData.staffName || 'เจ้าหน้าที่'}</b> ได้<b>ปฏิเสธงาน</b>ของคุณ\n\n` +
                      `งาน: <b>${bData.eventName}</b>\n` +
                      `วันที่: ${formatThaiDate(bData.date)} ${bData.requireTime ? `เวลา ${bData.startTime}-${bData.endTime} น.` : ''}\n` +
                      `<b>เหตุผลที่ปฏิเสธ:</b> ${reason}\n\n` +
                      `ขออภัยในความไม่สะดวกครับ`;
          
          await sendTelegramNotify(bData.userTelegramChatId, msg);
        }
      }

      showToast("ปฏิเสธงานและส่งแจ้งเตือนเรียบร้อย", "success");
      if (rejectModal) rejectModal.classList.add("hidden");
    } catch (error) {
      showToast("ทำรายการไม่สำเร็จ: " + error.message, "error");
    }
  });
}


// เริ่มโหลดข้อมูลงานเมื่อเปิดหน้า
loadMyAssignedTasks();