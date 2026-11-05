// ไฟล์: js/services/telegram.js
import { db } from "../config/firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * ส่งข้อความแจ้งเตือนเข้า Telegram Bot ไปยัง Chat ID ที่กำหนด
 */
export async function sendTelegramNotify(chatId, message) {
  if (!chatId || chatId.trim() === "") return;

  try {
    // ดึง Bot Token จาก Firestore Collection 'settings' -> Document 'config'
    const configSnap = await getDoc(doc(db, "settings", "config"));
    if (!configSnap.exists()) return;

    const botToken = configSnap.data().telegramBotToken;
    if (!botToken) return;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: message,
        parse_mode: "HTML"
      })
    });
  } catch (error) {
    console.warn("ไม่สามารถส่ง Telegram แจ้งเตือนได้:", error);
  }
}