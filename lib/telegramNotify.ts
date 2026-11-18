import "server-only";

export type TelegramSendResult = { ok: boolean; error?: string };

/**
 * Sends a message to a Telegram chat via the Bot API. Never throws — a
 * missing/misconfigured Telegram setup or a transient API failure should
 * never fail the weekly publish run that calls this; failures are reported
 * back via the return value (for callers that want to surface them, like the
 * admin "send test" action) AND logged, so Vercel's function logs also
 * surface the problem even for fire-and-forget callers that ignore it.
 */
export async function notifyTelegram(text: string): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    const error = "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured.";
    console.warn(`[telegramNotify] ${error} Skipping notification.`);
    return { ok: false, error };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const error = `Telegram API returned ${res.status}: ${body}`;
      console.error(`[telegramNotify] ${error}`);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[telegramNotify] Failed to send Telegram notification:", err);
    return { ok: false, error };
  }
}

function siteOrigin(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Builds and sends the "this week's new articles" digest notification. */
export async function notifyWeeklyPublished(
  articles: { title: string; slug: string; regionLabel: string; country?: string | null }[]
): Promise<void> {
  if (articles.length === 0) return;

  const origin = siteOrigin();
  const lines = articles.map((a) => {
    const where = a.country ? `${a.regionLabel} — ${a.country}` : a.regionLabel;
    const url = `${origin}/article/${a.slug}`;
    return `• <b>${escapeHtml(where)}</b>\n<a href="${url}">${escapeHtml(a.title)}</a>`;
  });

  const text = `📰 <b>${articles.length} new briefing${articles.length === 1 ? "" : "s"} published this week</b>\n\n${lines.join("\n\n")}`;
  await notifyTelegram(text);
}

/** Sends a short, obviously-a-test message so an admin can confirm the Telegram setup actually works end to end. */
export async function sendTestTelegramMessage(): Promise<TelegramSendResult> {
  const origin = siteOrigin();
  return notifyTelegram(
    `✅ <b>Test notification</b> from The Horizon Reports admin panel.\n\nIf you can see this, the weekly "new articles published" notification is wired up correctly.\n\n${origin}`
  );
}
