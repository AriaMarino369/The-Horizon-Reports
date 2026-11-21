"use client";

import { useActionState } from "react";
import type { ImageActionState } from "@/app/actions/admin";
import { proxiedImageUrl } from "@/lib/imageProxy";

export function ImageRowForm({
  title,
  subtitle,
  currentImageUrl,
  idFieldName,
  idValue,
  action,
}: {
  title: string;
  subtitle: string;
  currentImageUrl: string | null;
  idFieldName: string;
  idValue: string;
  action: (state: ImageActionState, formData: FormData) => Promise<ImageActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  const fieldClass =
    "w-full rounded border border-border bg-panel-2 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-panel p-3 sm:flex-row sm:items-start">
      <div className="h-20 w-32 shrink-0 overflow-hidden rounded border border-border bg-panel-2">
        {currentImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external/uploaded image, arbitrary source
          <img src={proxiedImageUrl(currentImageUrl)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[9px] text-muted">
            No image
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="font-mono text-[10px] text-muted">{subtitle}</p>

        <form action={formAction} className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <input type="hidden" name={idFieldName} value={idValue} />
          <input type="file" name="image" accept="image/*" className={`${fieldClass} sm:w-40`} />
          <span className="font-mono text-[10px] text-muted">or</span>
          <input type="url" name="imageUrl" placeholder="paste image URL…" className={`${fieldClass} sm:flex-1`} />
          <button
            type="submit"
            disabled={pending}
            className="stencil shrink-0 rounded border border-accent px-3 py-1.5 text-[10px] font-semibold tracking-widest text-accent-strong hover:bg-accent hover:text-background transition-colors disabled:opacity-60"
          >
            {pending ? "Uploading…" : "Replace"}
          </button>
        </form>
        {state?.error && <p className="mt-1 font-mono text-[10px] text-danger">{state.error}</p>}
        {state?.ok && <p className="mt-1 font-mono text-[10px] text-accent-strong">Image updated.</p>}
      </div>
    </div>
  );
}
