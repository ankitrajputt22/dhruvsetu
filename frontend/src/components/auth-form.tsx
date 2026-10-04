"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { type ApiResult, postApi } from "@/lib/api";
import { type AuthUser, rememberSignup } from "@/lib/auth";
import {
  type AccountType,
  emptyRegistration,
  type FieldErrors,
  LOGIN_FIELDS,
  type LoginValues,
  MIN_PASSWORD_LENGTH,
  OTHER_RESEARCH_AREA,
  REGISTRATION_FIELDS,
  type RegistrationValues,
  registrationPayload,
  RESEARCH_AREAS,
  validateLogin,
  validateRegistration,
} from "@/lib/auth-validation";

const UNREACHABLE = "We could not reach DhruvSetu right now. Check your connection and try again.";

const accountTypes: { value: AccountType; title: string; description: string }[] = [
  {
    value: "user",
    title: "General User",
    description: "Explore research, datasets, maps and public DhruvSetu resources.",
  },
  {
    value: "researcher",
    title: "Researcher",
    description:
      "Request researcher access to contribute and work with polar research resources.",
  },
];

function inputClass(error: string | undefined): string {
  return `w-full rounded-lg border bg-white px-3.5 py-2.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-200 ${
    error ? "border-red-600" : "border-slate-300"
  }`;
}

// Links a field to its hint or its error, so both are read out with it.
function describedBy(id: string, hint: string | undefined, error: string | undefined) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}

function FieldMessage({ id, hint, error }: { id: string; hint?: string; error?: string }) {
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

function FieldLabel({ id, label, optional }: { id: string; label: string; optional?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-800" htmlFor={id}>
      {label}
      {optional && <span className="font-normal text-slate-500"> (optional)</span>}
    </label>
  );
}

type TextFieldProps = {
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

function TextField({
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

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  toggleName,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  // Completes the button's name, as in "Show password".
  toggleName: string;
  hint?: string;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <FieldLabel id={id} label={label} />
      <div className="relative mt-1.5">
        <input
          autoComplete={autoComplete}
          className={`${inputClass(error)} pr-[4.5rem]`}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          required
          type={visible ? "text" : "password"}
          value={value}
          {...describedBy(id, hint, error)}
        />
        <button
          aria-controls={id}
          aria-label={`${visible ? "Hide" : "Show"} ${toggleName}`}
          className="absolute inset-y-1 right-1 rounded-md px-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      <FieldMessage error={error} hint={hint} id={id} />
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
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

function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
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

function nextQuery(next: string): string {
  return next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
}

// Only messages DhruvSetu wrote itself are shown. Anything unexpected gets a
// general message instead of the server's own text.
function loginFailure(result: ApiResult<AuthUser>): string {
  if (result.status === null) {
    return UNREACHABLE;
  }
  if (result.status === 401 || result.status === 422) {
    return "Email or password is incorrect.";
  }
  if (result.status === 429 || result.status === 403) {
    return result.detail ?? "We could not sign you in right now. Please try again.";
  }
  return "We could not sign you in right now. Please try again.";
}

function registrationFailure(result: ApiResult<AuthUser>): string {
  if (result.status === null) {
    return UNREACHABLE;
  }
  if (result.status === 409) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (result.status === 422) {
    return "Some details were not accepted. Please check the form and try again.";
  }
  if (result.status === 403) {
    return result.detail ?? "We could not create your account right now. Please try again.";
  }
  return "We could not create your account right now. Please try again.";
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<LoginValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Checked again on every change once the form has been sent once.
  const [attempted, setAttempted] = useState(false);
  // Stops a second request while the first is still on its way.
  const sending = useRef(false);

  function update(field: keyof LoginValues, value: string) {
    const changed = { ...values, [field]: value };
    setValues(changed);
    if (attempted) {
      setErrors(validateLogin(changed));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) {
      return;
    }
    const found = validateLogin(values);
    setAttempted(true);
    setErrors(found);
    setFormError(null);
    const firstProblem = LOGIN_FIELDS.find((field) => found[field]);
    if (firstProblem) {
      document.getElementById(`login-${firstProblem}`)?.focus();
      return;
    }

    sending.current = true;
    setBusy(true);
    const result = await postApi<AuthUser>("/api/auth/login", {
      email: values.email.trim(),
      password: values.password,
    });
    if (result.data === null) {
      sending.current = false;
      setBusy(false);
      setFormError(loginFailure(result));
      return;
    }
    // The page is asked for again, so the header and the page see the login.
    router.push(next);
    router.refresh();
  }

  return (
    <form className="space-y-5" noValidate onSubmit={(event) => void submit(event)}>
      <TextField
        autoComplete="email"
        error={errors.email}
        id="login-email"
        label="Email Address"
        maxLength={255}
        onChange={(value) => update("email", value)}
        type="email"
        value={values.email}
      />
      <PasswordField
        autoComplete="current-password"
        error={errors.password}
        id="login-password"
        label="Password"
        onChange={(value) => update("password", value)}
        toggleName="password"
        value={values.password}
      />

      <FormError message={formError} />
      <SubmitButton busy={busy} busyLabel="Signing in…" label="Sign In" />

      <p className="text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link
          className="font-semibold text-sky-800 hover:underline"
          href={`/register${nextQuery(next)}`}
        >
          Create Account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [values, setValues] = useState<RegistrationValues>(emptyRegistration);
  const [errors, setErrors] = useState<FieldErrors<RegistrationValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const sending = useRef(false);
  const researcher = values.accountType === "researcher";

  function update<Field extends keyof RegistrationValues>(
    field: Field,
    value: RegistrationValues[Field],
  ) {
    const changed = { ...values, [field]: value };
    setValues(changed);
    if (attempted) {
      setErrors(validateRegistration(changed));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) {
      return;
    }
    const found = validateRegistration(values);
    setAttempted(true);
    setErrors(found);
    setFormError(null);
    const firstProblem = REGISTRATION_FIELDS.find((field) => found[field]);
    if (firstProblem) {
      document.getElementById(`register-${firstProblem}`)?.focus();
      return;
    }

    sending.current = true;
    setBusy(true);
    const result = await postApi<AuthUser>("/api/auth/register", registrationPayload(values));
    if (result.data === null) {
      sending.current = false;
      setBusy(false);
      setFormError(registrationFailure(result));
      return;
    }
    rememberSignup(result.data.id, values.accountType);
    router.push(`/welcome${nextQuery(next)}`);
    router.refresh();
  }

  return (
    <form className="space-y-5" noValidate onSubmit={(event) => void submit(event)}>
      <TextField
        autoComplete="name"
        error={errors.fullName}
        id="register-fullName"
        label="Full Name"
        maxLength={120}
        onChange={(value) => update("fullName", value)}
        value={values.fullName}
      />
      <TextField
        autoComplete="email"
        error={errors.email}
        id="register-email"
        label="Email Address"
        maxLength={255}
        onChange={(value) => update("email", value)}
        type="email"
        value={values.email}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <PasswordField
          autoComplete="new-password"
          error={errors.password}
          hint={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}
          id="register-password"
          label="Password"
          onChange={(value) => update("password", value)}
          toggleName="password"
          value={values.password}
        />
        <PasswordField
          autoComplete="new-password"
          error={errors.confirmPassword}
          id="register-confirmPassword"
          label="Confirm Password"
          onChange={(value) => update("confirmPassword", value)}
          toggleName="confirm password"
          value={values.confirmPassword}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-800">I want to join as</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {accountTypes.map((option) => {
            const selected = values.accountType === option.value;
            return (
              <label
                className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                  selected
                    ? "border-sky-700 bg-sky-50 ring-1 ring-sky-700"
                    : "border-slate-300 bg-white hover:border-sky-500"
                }`}
                key={option.value}
              >
                <input
                  aria-describedby={`account-type-${option.value}-about`}
                  aria-labelledby={`account-type-${option.value}`}
                  checked={selected}
                  className="mt-1 h-4 w-4 shrink-0 accent-sky-800"
                  name="account_type"
                  onChange={() => update("accountType", option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>
                  <span
                    className="block text-sm font-semibold text-slate-950"
                    id={`account-type-${option.value}`}
                  >
                    {option.title}
                  </span>
                  <span
                    className="mt-1 block text-sm leading-5 text-slate-600"
                    id={`account-type-${option.value}-about`}
                  >
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {researcher && (
        <section
          aria-labelledby="researcher-details-heading"
          className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
        >
          <div>
            <h2
              className="text-base font-semibold text-slate-950"
              id="researcher-details-heading"
            >
              Researcher details
            </h2>
            <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm leading-6 text-sky-950">
              Researcher access requires administrator approval. Your account will
              initially have normal user access.
            </p>
          </div>

          <TextField
            autoComplete="organization"
            error={errors.institution}
            id="register-institution"
            label="Institution / Organisation"
            maxLength={200}
            onChange={(value) => update("institution", value)}
            value={values.institution}
          />

          <div>
            <FieldLabel id="register-researchArea" label="Research Area" />
            <select
              className={`mt-1.5 ${inputClass(errors.researchArea)}`}
              id="register-researchArea"
              onChange={(event) => update("researchArea", event.target.value)}
              required
              value={values.researchArea}
              {...describedBy("register-researchArea", undefined, errors.researchArea)}
            >
              <option value="">Select a research area</option>
              {RESEARCH_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <FieldMessage error={errors.researchArea} id="register-researchArea" />
          </div>

          {values.researchArea === OTHER_RESEARCH_AREA && (
            <TextField
              error={errors.otherResearchArea}
              id="register-otherResearchArea"
              label="Please specify"
              maxLength={120}
              onChange={(value) => update("otherResearchArea", value)}
              value={values.otherResearchArea}
            />
          )}

          <TextField
            autoComplete="organization-title"
            hint="For example researcher, student researcher, scientist or faculty."
            id="register-designation"
            label="Designation"
            maxLength={120}
            onChange={(value) => update("designation", value)}
            optional
            value={values.designation}
          />

          <div>
            <FieldLabel id="register-reason" label="Reason for Researcher Access" />
            <textarea
              className={`mt-1.5 min-h-24 ${inputClass(errors.reason)}`}
              id="register-reason"
              maxLength={1000}
              onChange={(event) => update("reason", event.target.value)}
              required
              value={values.reason}
              {...describedBy(
                "register-reason",
                "Briefly describe why you need researcher access to DhruvSetu.",
                errors.reason,
              )}
            />
            <FieldMessage
              error={errors.reason}
              hint="Briefly describe why you need researcher access to DhruvSetu."
              id="register-reason"
            />
          </div>

          <TextField
            autoComplete="url"
            error={errors.profileUrl}
            hint="A page about you at your institution, or a professional profile."
            id="register-profileUrl"
            label="Institutional / Professional Profile URL"
            maxLength={500}
            onChange={(value) => update("profileUrl", value)}
            optional
            placeholder="https://"
            type="url"
            value={values.profileUrl}
          />

          <div>
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700">
              <input
                checked={values.acknowledged}
                className="mt-1 h-4 w-4 shrink-0 accent-sky-800"
                id="register-acknowledged"
                onChange={(event) => update("acknowledged", event.target.checked)}
                required
                type="checkbox"
                {...describedBy("register-acknowledged", undefined, errors.acknowledged)}
              />
              <span>
                I understand that researcher access requires administrator approval and
                that submitted research may require verification.
              </span>
            </label>
            <FieldMessage error={errors.acknowledged} id="register-acknowledged" />
          </div>
        </section>
      )}

      <FormError message={formError} />
      <SubmitButton busy={busy} busyLabel="Creating your account…" label="Create Account" />

      <p className="text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          className="font-semibold text-sky-800 hover:underline"
          href={`/login${nextQuery(next)}`}
        >
          Sign In
        </Link>
      </p>
    </form>
  );
}
