import "server-only";

/**
 * Sends a message to a Telegram chat via the Bot API. Never throws — a
 * missing/misconfigured Telegram setup or a transient API failure should
 * never fail the weekly publish run that calls this; failures are only
 * logged so Vercel's function logs surface the problem.
 */
export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("[telegramNotify] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured — skipping notification.");
    return;
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
      console.error(`[telegramNotify] Telegram API returned ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error("[telegramNotify] Failed to send Telegram notification:", err);
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
