// Notifikasi Telegram (Fase 2) — config-gated & server-only.
//
// INAKTIF sampai TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID diisi di .env.server.local.
// Bot dari @BotFather; chat_id numerik (channel/grup negatif, mulai -100). Bot
// tak bisa memulai kontak — target harus /start bot dulu (atau bot ditambah
// sebagai admin channel), lalu id dibaca dari getUpdates. Tak pernah melempar.

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/**
 * Kirim pesan teks polos ke chat/channel Telegram. No-op (return false) bila
 * belum dikonfigurasi atau gagal. Sengaja tanpa parse_mode — alert mesin tak
 * perlu format, jadi nol risiko escaping.
 */
export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096), // batas keras Telegram
        disable_web_page_preview: true,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error("telegram sendMessage gagal", res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (error) {
    console.error("telegram sendMessage error", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
