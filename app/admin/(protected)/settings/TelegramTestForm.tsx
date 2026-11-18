"use client";

import { useActionState } from "react";
import { sendTestTelegramAction } from "@/app/actions/admin";

export function TelegramTestForm() {
  const [state, action, pending] = useActionState(sendTestTelegramAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-2">
      <button
        disabled={pending}
        className="stencil self-start rounded bg-accent px-4 py-2 text-xs font-semibold tracking-widest text-background transition-colors hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send Test Message"}
      </button>
      {state?.ok && (
        <p className="text-sm text-accent-strong">
          Sent — check the Telegram chat for the test message.
        </p>
      )}
      {state?.error && (
        <p className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
