"use client";
import { createContext, use, useEffect, useRef, useState } from "react";
import type { ZodType } from "zod";
import type { ActionState } from "@/lib/types";
import { validationFailure } from "@/lib/form-errors";
const ErrorsContext = createContext<Record<string, string>>({});
export function FieldError({ name }: { name: string }) {
  const error = use(ErrorsContext)[name];
  return error ? (
    <small id={`error-${name}`} className="field-error">
      {error}
    </small>
  ) : null;
}
export function useFieldError(name?: string) {
  return use(ErrorsContext)[name ?? ""];
}
export function FeedbackForm({
  state: serverState,
  schema,
  input = (f) => Object.fromEntries(f),
  children,
  onErrors,
  ...props
}: {
  state: ActionState;
  schema: ZodType;
  input?: (form: FormData) => unknown;
  onErrors?: (errors: Record<string, string>) => void;
} & Omit<React.ComponentProps<"form">, "onSubmit" | "onInvalid">) {
  const ref = useRef<HTMLFormElement>(null);
  const [local, setLocal] = useState<ActionState | null>(null);
  const state = local ?? serverState;
  useEffect(() => {
    const name = Object.keys(state.fieldErrors ?? {})[0];
    if (name) onErrors?.(state.fieldErrors ?? {});
    // Onboarding can first reveal the step containing this field.
    const frame = requestAnimationFrame(() => {
      const fields = ref.current?.querySelectorAll<HTMLElement>(
        "input:not([type=hidden]),textarea,select",
      );
      for (const el of fields ?? []) {
        const field = el.getAttribute("name") || el.dataset.field || "";
        if (state.fieldErrors?.[field]) el.setAttribute("aria-invalid", "true");
        else el.removeAttribute("aria-invalid");
      }
      const target =
        Array.from(fields ?? []).find(
          (el) =>
            !!state.fieldErrors?.[
              el.getAttribute("name") || el.dataset.field || ""
            ],
        ) ?? ref.current?.querySelector<HTMLElement>(".form-message");
      if (state.ok || !state.message) return;
      target?.focus();
      target?.scrollIntoView({ block: "center", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [state, onErrors]);
  return (
    <ErrorsContext value={state.fieldErrors ?? {}}>
      <form
        {...props}
        ref={ref}
        noValidate
        onSubmit={(event) => {
          const parsed = schema.safeParse(
            input(new FormData(event.currentTarget)),
          );
          if (!parsed.success) {
            event.preventDefault();
            setLocal(validationFailure(parsed.error));
          } else setLocal(null);
        }}
      >
        {children}
        {state.message && (
          <p
            role={state.ok ? "status" : "alert"}
            tabIndex={-1}
            className={`form-message form-summary ${state.ok ? "success" : "danger"}`}
          >
            {state.message}
          </p>
        )}
      </form>
    </ErrorsContext>
  );
}
