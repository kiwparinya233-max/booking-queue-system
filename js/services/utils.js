// ไฟล์: js/services/utils.js

/**
 * แสดงกล่องแจ้งเตือนมุมขวาบน (Toast Notification)
 */
export function showToast(message, type = "success") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "fixed top-5 right-5 z-50 flex flex-col gap-2";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const bgColor = type === "success" ? "bg-emerald-600" : type === "warning" ? "bg-amber-500" : "bg-red-600";
  const icon = type === "success" ? "fa-circle-check" : "fa-circle-exclamation";

  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-medium transition-all duration-300`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-x-4");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * แปลงวันที่ YYYY-MM-DD เป็นรูปแบบวันที่ภาษาไทย (เช่น 26 ต.ค. 2569)
 */
export function formatThaiDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

/**
 * เช็คว่าช่วงเวลา 2 ช่วงทับซ้อนกันหรือไม่ (ใช้เช็คคิวชน)
 */
export function isTimeOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA < endB && endA > startB;
}

// ฟังก์ชันจำกัดให้พิมพ์เฉพาะตัวเลข (สำหรับเบอร์โทรศัพท์)
export function handlePhoneInput(inputElement) {
  if (!inputElement) return;
  inputElement.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });
}

// ฟังก์ชันจำกัดให้พิมพ์เฉพาะตัวอักษรและเว้นวรรค (สำหรับชื่อ-นามสกุล)
export function handleTextInput(inputElement) {
  if (!inputElement) return;
  inputElement.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^ก-ฮะ-์a-zA-Z\s]/g, '');
  });
}

// ฟังก์ชันจำกัดให้พิมพ์เฉพาะภาษาอังกฤษและตัวเลข (สำหรับ Username / Password)
export function handleAlphaNumericInput(inputElement) {
  if (!inputElement) return;
  inputElement.addEventListener("input", (e) => {
    // กรองเอาเฉพาะ a-z, A-Z และ 0-9 เท่านั้น นอกนั้นลบออกทันที
    e.target.value = e.target.value.replace(/[^a-zA-Z0-9@.-_+]/g, '');
  });
}