"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { generateExpertAnswer } from "@/lib/generateExpertAnswer";

const MIN_LENGTH = 8;
const MAX_LENGTH = 500;

// How many instant (paid-API) answers this will spend on per calendar
// month before every question falls back to the free-only queue — a hard
// ceiling so this never runs away with the ANTHROPIC_API_KEY budget.
// Override via the env var; ~200/month is roughly $6-10 at this feature's
// per-question cost.
const INSTANT_MONTHLY_CAP = Number(process.env.ASK_EXPERT_INSTANT_MONTHLY_CAP ?? 200);

export type AskExpertState = { error?: string; ok?: boolean; id?: string } | undefined;

async function requireViewer() {
  const session = await getSession();
  if (!session) throw new Error("Not authorized.");
}

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Public, viewer-facing action for the front-page "Ask the Expert" box.
 *
 * Always queues the question first (the free Claude Code Remote Routine
 * remains the guaranteed fallback, picked up within about an hour, exactly
 * as before) — then, budget permitting, attempts an immediate paid-API
 * answer right here, so most viewers get a real answer within seconds
 * instead of waiting.
 *
 * INSTANT_MONTHLY_CAP keeps this bounded: once this many instant answers
 * have been given out this calendar month, every further question falls
 * back to the free queue only, the same as if ANTHROPIC_API_KEY had no
 * credit. A failed instant attempt (no credit, rate limit, any API error)
 * is swallowed here for the same reason — the question just stays PENDING
 * for the free Routine to answer later, so a credit outage or a cap being
 * hit never surfaces as a broken submission to the asker.
 */
export async function submitExpertQuestionAction(
  _state: AskExpertState,
  formData: FormData
): Promise<AskExpertState> {
  await requireViewer();
  const question = String(formData.get("question") ?? "").trim();

  if (question.length < MIN_LENGTH) {
    return { error: "Ask a bit more — a few words won't give the analyst enough to research." };
  }
  if (question.length > MAX_LENGTH) {
    return { error: `Keep it under ${MAX_LENGTH} characters.` };
  }

  const created = await db.expertQuestion.create({ data: { question } });

  try {
    const instantCountThisMonth = await db.expertQuestion.count({
      where: { answeredBy: "instant", fulfilledAt: { gte: startOfMonthUtc() } },
    });

    if (instantCountThisMonth < INSTANT_MONTHLY_CAP) {
      const result = await generateExpertAnswer(question);
      await db.expertQuestion.update({
        where: { id: created.id },
        data: {
          status: "FULFILLED",
          answer: result.answer,
          answerFormat: result.answerFormat,
          sources: JSON.stringify(result.sources),
          answeredBy: "instant",
          fulfilledAt: new Date(),
        },
      });
    }
  } catch (e) {
    console.error("[askExpert] Instant answer attempt failed — leaving PENDING for the free Routine:", e);
  }

  return { ok: true, id: created.id };
}
