// ไฟล์: js/pages/user-page.js
import { db } from "../config/firebase-config.js";
import { checkRoleGuard, logoutUser, updateSessionUser } from "../services/auth.js";
import { showToast, formatThaiDate, isTimeOverlap } from "../services/utils.js";
import { sendTelegramNotify } from "../services/telegram.js";
import {
  collection,
  getDocs,
  getDoc, 
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. ตรวจสอบสิทธิ์ ต้องเป็น user เท่านั้น
const currentUser = checkRoleGuard("user");
if (!currentUser) throw new Error("Unauthorized");

// แสดงข้อมูลผู้ใช้ที่ Navbar และ Banner
document.getElementById("userNameDisplay").innerText = currentUser.fullName;
document.getElementById("userDeptDisplay").innerText = currentUser.department;
document.getElementById("welcomeText").innerText = `สวัสดี, ${currentUser.fullName}`;
document.getElementById("userPhoneDisplay").innerText = currentUser.phone;
document.getElementById("userDeptFullDisplay").innerText = currentUser.department;

const telegramInput = document.getElementById("userTelegramInput");
telegramInput.value = currentUser.telegramChatId || "";

document.getElementById("logoutBtn").addEventListener("click", logoutUser);

// บันทึก/อัปเดต Telegram Chat ID
document.getElementById("saveTelegramBtn").addEventListener("click", async () => {
  const newChatId = telegramInput.value.trim();
  try {
    await updateDoc(doc(db, "users", currentUser.id), { telegramChatId: newChatId });
    updateSessionUser({ telegramChatId: newChatId });
    showToast("บันทึก Telegram Chat ID เรียบร้อย", "success");
  } catch (error) {
    showToast("บันทึกไม่สำเร็จ: " + error.message, "error");
  }
});

// 2. ระบบสลับแท็บ
const tabButtons = document.querySelectorAll(".tab-btn");
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-tab");
    tabButtons.forEach(b => {
      b.className = "tab-btn flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all text-slate-600 hover:bg-slate-100";
    });
    btn.className = "tab-btn flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all bg-pink-700 text-white shadow";

    if (target === "booking") {
      document.getElementById("tabContent-booking").classList.remove("hidden");
      document.getElementById("tabContent-history").classList.add("hidden");
    } else {
      document.getElementById("tabContent-booking").classList.add("hidden");
      document.getElementById("tabContent-history").classList.remove("hidden");
    }
  });
});

// 3. โหลดตำแหน่งงานมาใส่ใน Dropdown ฟอร์มจอง
const positionSelect = document.getElementById("bookingPosition");
const startTimeBox = document.getElementById("startTimeBox");
const endTimeBox = document.getElementById("endTimeBox");
const timeNotice = document.getElementById("timeNotice");
const staffSelect = document.getElementById("bookingStaff");
const bookingDateInput = document.getElementById("bookingDate");

const todayStr = new Date().toISOString().split("T")[0];
bookingDateInput.min = todayStr;
bookingDateInput.value = todayStr;

let positionsData = {};

async function loadPositionsForBooking() {
  const snap = await getDocs(collection(db, "positions"));
  let html = `<option value="">-- เลือกประเภทตำแหน่งงาน --</option>`;
  snap.forEach(d => {
    const p = Object.assign({ id: d.id }, d.data());
    positionsData[p.id] = p;
    html += `<option value="${p.id}" data-reqtime="${p.requireTime}">${p.name}</option>`;
  });
  positionSelect.innerHTML = html;
}

positionSelect.addEventListener("change", () => {
  const selectedOpt = positionSelect.options[positionSelect.selectedIndex];
  const reqTime = selectedOpt.getAttribute("data-reqtime") === "true";

  if (reqTime) {
    startTimeBox.style.display = "block";
    endTimeBox.style.display = "block";
    timeNotice.classList.add("hidden");
    document.getElementById("bookingStartTime").required = true;
    document.getElementById("bookingEndTime").required = true;
  } else {
    startTimeBox.style.display = "none";
    endTimeBox.style.display = "none";
    timeNotice.classList.remove("hidden");
    document.getElementById("bookingStartTime").required = false;
    document.getElementById("bookingEndTime").required = false;
  }

  updateAvailableStaffList();
});

bookingDateInput.addEventListener("change", updateAvailableStaffList);
document.getElementById("bookingStartTime").addEventListener("change", updateAvailableStaffList);
document.getElementById("bookingEndTime").addEventListener("change", updateAvailableStaffList);

async function updateAvailableStaffList() {
  const posId = positionSelect.value;
  const date = bookingDateInput.value;
  const startTime = document.getElementById("bookingStartTime").value;
  const endTime = document.getElementById("bookingEndTime").value;

  if (!posId || !date) {
    staffSelect.innerHTML = `<option value="">-- กรุณาเลือกตำแหน่งและวันที่ก่อน --</option>`;
    return;
  }

  const selectedPos = positionsData[posId];
  if (selectedPos.requireTime && (!startTime || !endTime)) {
    staffSelect.innerHTML = `<option value="">-- กรุณาระบุเวลาเริ่มต้นและสิ้นสุดก่อน --</option>`;
    return;
  }

  const staffSnap = await getDocs(query(collection(db, "staff"), where("positionId", "==", posId)));
  const allStaff = [];
  staffSnap.forEach(d => allStaff.push(Object.assign({ id: d.id }, d.data())));

  if (allStaff.length === 0) {
    staffSelect.innerHTML = `<option value="">-- ไม่พบข้อมูลบุคลากรในตำแหน่งนี้ --</option>`;
    return;
  }

  const bookingSnap = await getDocs(query(collection(db, "bookings"), where("date", "==", date)));
  const busyStaffIds = new Set();

  bookingSnap.forEach(d => {
    const b = d.data();
    const isActive = b.status === "pending" || b.status === "approved";
    
    if (isActive && b.staffId && selectedPos.requireTime && b.requireTime) {
      if (isTimeOverlap(startTime, endTime, b.startTime, b.endTime)) {
        busyStaffIds.add(b.staffId);
      }
    }
  });

  let optionsHtml = `<option value="">-- เลือกบุคลากรผู้รับผิดชอบ --</option>`;
  
  allStaff.forEach(st => {
    const isBusy = busyStaffIds.has(st.id);
    const isAvailableStatus = st.isAvailable !== false;

    if (isBusy || !isAvailableStatus) {
      optionsHtml += `<option value="${st.id}" disabled>${st.fullName} (ไม่ว่างในช่วงเวลานี้)</option>`;
    } else {
      optionsHtml += `<option value="${st.id}">${st.fullName} (ว่าง)</option>`;
    }
  });

  staffSelect.innerHTML = optionsHtml;
}

// 4. ส่งคำขอจองคิว
const bookingForm = document.getElementById("bookingForm");
const submitBookingBtn = document.getElementById("submitBookingBtn");

bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const posId = positionSelect.value;
  const selectedOpt = positionSelect.options[positionSelect.selectedIndex];
  const positionName = selectedOpt.text;
  const requireTime = selectedOpt.getAttribute("data-reqtime") === "true";

  const date = bookingDateInput.value;
  const startTime = requireTime ? document.getElementById("bookingStartTime").value : "";
  const endTime = requireTime ? document.getElementById("bookingEndTime").value : "";
  
  const staffId = staffSelect.value;
  if (!staffId) {
    showToast("กรุณาเลือกบุคลากรผู้รับผิดชอบ", "warning");
    return;
  }

  const opt = staffSelect.options[staffSelect.selectedIndex];
  const staffName = opt.text.split(" (")[0].trim();

  const eventName = document.getElementById("bookingEventName").value.trim();
  const jobDetail = document.getElementById("bookingDetail").value.trim();
  const attachmentUrl = document.getElementById("bookingAttachment").value.trim();
  const note = document.getElementById("bookingNote").value.trim();

  submitBookingBtn.disabled = true;
  submitBookingBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>กำลังส่งคำขอจอง...</span>`;

  try {
    // 1. ดึงข้อมูลเบอร์โทร อีเมล และ Telegram ของ staff จาก collection "staff"
    const staffDocRef = doc(db, "staff", staffId);
    const staffDocSnap = await getDoc(staffDocRef);
    let staffPhone = "";
    let staffEmail = "";
    let staffTelegramChatId = "";

    if (staffDocSnap.exists()) {
      const staffData = staffDocSnap.data();
      staffPhone = staffData.phone || "";
      staffEmail = staffData.email || "";
      staffTelegramChatId = staffData.telegramChatId || "";
    }

    // 2. บันทึกลงคอลเลกชัน bookings
    const newBooking = {
      userId: currentUser.id,
      requesterName: currentUser.fullName,
      requesterPhone: currentUser.phone,
      department: currentUser.department,
      userTelegramChatId: currentUser.telegramChatId || "",
      
      positionId: posId,
      positionName,
      requireTime,
      staffId,
      staffName,
      phone: staffPhone,
      email: staffEmail,
      
      date,
      startTime,
      endTime,
      eventName,
      jobDetail,
      attachmentUrl,
      note,
      
      status: "pending",
      rejectReason: "",
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, "bookings"), newBooking);

    // 3. ส่ง Telegram แจ้งเตือน Staff เข้า collection "staff"
    if (staffTelegramChatId) {
      const msg = `<b>มีคำขอจองคิวงานใหม่!</b>\n\nงาน: <b>${eventName}</b>\nผู้ขอ: ${currentUser.fullName} (${currentUser.department})\nวันที่: ${formatThaiDate(date)} ${requireTime ? `เวลา ${startTime}-${endTime} น.` : ''}\nรายละเอียด: ${jobDetail}\n\nกรุณาล็อกอินเข้าสู่ระบบเพื่อกดรับหรือปฏิเสธงานครับ`;
      await sendTelegramNotify(staffTelegramChatId, msg);
    }

    showToast("ส่งคำขอจองคิวสำเร็จ!", "success");
    bookingForm.reset();
    bookingDateInput.value = todayStr;
    staffSelect.innerHTML = `<option value="">-- กรุณาเลือกตำแหน่งและวันที่ก่อน --</option>`;
    
    document.querySelector('[data-tab="history"]').click();

  } catch (error) {
    showToast("เกิดข้อผิดพลาด: " + error.message, "error");
  } finally {
    submitBookingBtn.disabled = false;
    submitBookingBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> <span>ยืนยันส่งคำขอจองคิว</span>`;
  }
});

// 5. โหลดประวัติและสถานะคิวงานของผู้ใช้งาน
const myBookingsTableBody = document.getElementById("myBookingsTableBody");

function loadMyBookings() {
  const q = query(collection(db, "bookings"), where("userId", "==", currentUser.id));

  onSnapshot(q, (snapshot) => {
    let html = "";
    let count = 0;

    if (snapshot.empty) {
      myBookingsTableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">คุณยังไม่มีประวัติการจองคิวในระบบ</td></tr>`;
      const countEl = document.getElementById("myBookingCount");
      if (countEl) countEl.innerText = 0;
      return;
    }

    const bookings = [];
    snapshot.forEach(d => bookings.push(Object.assign({ id: d.id }, d.data())));
    bookings.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    bookings.forEach(b => {
      count++;
      let statusBadge = "";
      if (b.status === "pending") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">รอรับงาน</span>`;
      else if (b.status === "approved") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">อนุมัติแล้ว (รอดำเนินการ)</span>`;
      else if (b.status === "rejected") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold" title="${b.rejectReason}">ปฏิเสธงาน: ${b.rejectReason}</span>`;
      else if (b.status === "completed") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">เสร็จสิ้นสมบูรณ์</span>`;
      else if (b.status === "cancelled") statusBadge = `<span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">ยกเลิกแล้ว</span>`;

      const timeText = b.requireTime ? `<br/><span class="text-xs text-slate-500">${b.startTime} - ${b.endTime} น.</span>` : `<br/><span class="text-xs text-slate-400">งานรายวัน</span>`;

      let actionBtn = `-`;
      if (b.status === "pending" || b.status === "approved") {
        actionBtn = `<button onclick="window.cancelMyBooking('${b.id}')" class="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all">ยกเลิกคิว</button>`;
      }

      let staffDisplay = `<span class="text-slate-400 italic">ยังไม่มีผู้รับงาน</span>`;
      if (b.staffName) {
        staffDisplay = `
          <div class="font-medium text-slate-800">${b.staffName}</div>
          <div class="text-xs text-slate-500 mt-1 flex flex-col gap-0.5">
            <span><i class="fa-solid fa-phone text-slate-400 mr-1"></i> ${b.phone || 'ยังไม่ระบุเบอร์โทร'}</span>
            <span><i class="fa-solid fa-envelope text-slate-400 mr-1"></i> ${b.email || 'ยังไม่ระบุอีเมล'}</span>
          </div>
        `;
      }

      html += `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="p-4">
            <span class="font-bold text-slate-800">${formatThaiDate(b.date)}</span>
            ${timeText}
          </td>
          <td class="p-4 font-semibold text-orange-600">${b.positionName || '-'}</td>
          <td class="p-4">${staffDisplay}</td>
          <td class="p-4">
            <p class="font-medium text-slate-800">${b.eventName || '-'}</p>
            <p class="text-xs text-slate-500 truncate max-w-xs">${b.jobDetail || '-'}</p>
          </td>
          <td class="p-4">${statusBadge}</td>
          <td class="p-4 text-center">${actionBtn}</td>
        </tr>
      `;
    });

    myBookingsTableBody.innerHTML = html;
    const countEl = document.getElementById("myBookingCount");
    if (countEl) countEl.innerText = count;
  });
}

window.cancelMyBooking = async function(bookingId) {
  if (confirm("คุณต้องการยกเลิกคำขอจองคิวนี้ใช่หรือไม่?")) {
    try {
      const bookingDocSnap = await getDoc(doc(db, "bookings", bookingId));
      await updateDoc(doc(db, "bookings", bookingId), { status: "cancelled" });

      if (bookingDocSnap.exists()) {
        const bData = bookingDocSnap.data();
        if (bData.staffId) {
          const staffDocSnap = await getDoc(doc(db, "staff", bData.staffId));
          if (staffDocSnap.exists()) {
            const stData = staffDocSnap.data();
            if (stData.telegramChatId) {
              const msg = `<b>แจ้งเตือนการยกเลิกคิว!</b>\n\n` +
                          `ผู้ขอจอง <b>${bData.requesterName}</b> (${bData.department}) ได้ทำการ<b>ยกเลิกคิว</b>ของงานนี้แล้ว\n\n` +
                          `งาน: <b>${bData.eventName}</b>\n` +
                          `วันที่: ${formatThaiDate(bData.date)} ${bData.requireTime ? `เวลา ${bData.startTime}-${bData.endTime} น.` : ''}\n\n` +
                          `ระบบจึงแจ้งมาเพื่อให้รับทราบครับ`;
              
              await sendTelegramNotify(stData.telegramChatId, msg);
            }
          }
        }
      }

      showToast("ยกเลิกคิวงานและส่งแจ้งเตือนเรียบร้อย", "success");
    } catch (error) {
      showToast("ยกเลิกไม่สำเร็จ: " + error.message, "error");
    }
  }
};

window.openTelegramGuideModal = function() {
  const modal = document.getElementById("telegramGuideModal");
  if (modal) modal.classList.remove("hidden");
}

window.closeTelegramGuideModal = function() {
  const modal = document.getElementById("telegramGuideModal");
  if (modal) modal.classList.add("hidden");
}

loadPositionsForBooking();
loadMyBookings();