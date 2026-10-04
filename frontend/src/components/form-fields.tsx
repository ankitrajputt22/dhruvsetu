// Form building blocks shared by the account, researcher and admin forms.
// Every field has a label, and its hint or its problem is linked to it.

export function inputClass(error: string | undefined): string {
  return `w-full rounded-lg border bg-white px-3.5 py-2.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-200 ${
    error ? "border-red-600" : "border-slate-300"
  }`;
}

// Links a field to its hint or its error, so both are read out with it.
export function describedBy(id: string, hint: string | undefined, error: string | undefined) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}

export function FieldMessage({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error) {
    return (
      <p className="mt-1.5 text-sm text-red-700" id={`${id}-error`}>
        {error}
      </p>
    );
  }
  return hint ? (
    <p className="mt-1.5 text-xs leading-5 text-slate-500" id={`${id}-hint`}>
      {hint}
    </p>
  ) : null;
}

export function FieldLabel({ id, label, optional }: { id: string; label: string; optional?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-800" htmlFor={id}>
      {label}
      {optional && <span className="font-normal text-slate-500"> (optional)</span>}
    </label>
  );
}

export type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "url";
  autoComplete?: string;
  maxLength?: number;
  optional?: boolean;
  hint?: string;
  error?: string;
  placeholder?: string;
};

export function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  maxLength,
  optional,
  hint,
  error,
  placeholder,
}: TextFieldProps) {
  return (
    <div>
      <FieldLabel id={id} label={label} optional={optional} />
      <input
        autoComplete={autoComplete}
        className={`mt-1.5 ${inputClass(error)}`}
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={!optional}
        type={type}
        value={value}
        {...describedBy(id, hint, error)}
      />
      <FieldMessage error={error} hint={hint} id={id} />
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (message === null) {
    return null;
  }
  return (
    <p
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900"
      role="alert"
    >
      {message}
    </p>
  );
}

export function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <>
      <button
        aria-busy={busy}
        className="w-full rounded-lg bg-sky-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        {busy ? busyLabel : label}
      </button>
      <p className="sr-only" role="status">
        {busy ? busyLabel : ""}
      </p>
    </>
  );
}
