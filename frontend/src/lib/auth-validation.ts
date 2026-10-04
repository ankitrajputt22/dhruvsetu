// Checks for the Sign In and Create Account forms. They repeat the rules the
// API applies, so a person sees a problem before sending the form. The API
// still makes every decision itself.

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

export const OTHER_RESEARCH_AREA = "Other";

export const RESEARCH_AREAS = [
  "Climate Science",
  "Glaciology",
  "Oceanography",
  "Atmospheric Science",
  "Polar Biology",
  "Sea Ice",
  "Geology",
  "Remote Sensing",
  "Environmental Science",
  OTHER_RESEARCH_AREA,
] as const;

// What a person asks for when signing up. This is not a role: every new
// account is a normal user until an admin changes it.
export type AccountType = "user" | "researcher";

export type LoginValues = {
  email: string;
  password: string;
};

export type RegistrationValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: AccountType;
  institution: string;
  researchArea: string;
  otherResearchArea: string;
  designation: string;
  reason: string;
  profileUrl: string;
  acknowledged: boolean;
};

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export const emptyRegistration: RegistrationValues = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  accountType: "user",
  institution: "",
  researchArea: "",
  otherResearchArea: "",
  designation: "",
  reason: "",
  profileUrl: "",
  acknowledged: false,
};

// Fields in the order they appear, so the first one with a problem gets focus.
export const LOGIN_FIELDS = ["email", "password"] as const;

export const REGISTRATION_FIELDS = [
  "fullName",
  "email",
  "password",
  "confirmPassword",
  "institution",
  "researchArea",
  "otherResearchArea",
  "reason",
  "profileUrl",
  "acknowledged",
] as const;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isHttpUrl(value: string): boolean {
  if (/\s/.test(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function emailError(email: string): string | undefined {
  const value = email.trim();
  if (!value) {
    return "Enter your email address.";
  }
  return EMAIL_PATTERN.test(value) ? undefined : "Enter a valid email address.";
}

function withoutEmpty<T>(errors: FieldErrors<T>): FieldErrors<T> {
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as FieldErrors<T>;
}

export function validateLogin(values: LoginValues): FieldErrors<LoginValues> {
  return withoutEmpty<LoginValues>({
    email: emailError(values.email),
    password: values.password ? undefined : "Enter your password.",
  });
}

function passwordError(password: string): string | undefined {
  if (!password) {
    return "Enter a password.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return password.length > MAX_PASSWORD_LENGTH
    ? `Use at most ${MAX_PASSWORD_LENGTH} characters.`
    : undefined;
}

function confirmError(values: RegistrationValues): string | undefined {
  if (!values.confirmPassword) {
    return "Confirm your password.";
  }
  return values.confirmPassword === values.password ? undefined : "Passwords do not match.";
}

export function validateRegistration(
  values: RegistrationValues,
): FieldErrors<RegistrationValues> {
  const errors: FieldErrors<RegistrationValues> = {
    fullName: values.fullName.trim() ? undefined : "Enter your full name.",
    email: emailError(values.email),
    password: passwordError(values.password),
    confirmPassword: confirmError(values),
  };

  // The researcher questions are only checked when they are shown.
  if (values.accountType === "researcher") {
    const profileUrl = values.profileUrl.trim();
    Object.assign(errors, {
      institution:
        values.institution.trim().length >= 2
          ? undefined
          : "Enter your institution or organisation.",
      researchArea: values.researchArea ? undefined : "Select your research area.",
      otherResearchArea:
        values.researchArea === OTHER_RESEARCH_AREA &&
        values.otherResearchArea.trim().length < 2
          ? "Please specify your research area."
          : undefined,
      reason: values.reason.trim() ? undefined : "Tell us why you need researcher access.",
      profileUrl:
        profileUrl && !isHttpUrl(profileUrl)
          ? "Enter a full web address that starts with http:// or https://."
          : undefined,
      acknowledged: values.acknowledged
        ? undefined
        : "Please confirm that you understand this.",
    });
  }
  return withoutEmpty<RegistrationValues>(errors);
}

// What is sent to the API. The password confirmation is never sent, and there
// is no role: the API makes every new account a normal user.
export function registrationPayload(values: RegistrationValues) {
  const account = {
    email: values.email.trim(),
    password: values.password,
    display_name: values.fullName.trim(),
    account_type: values.accountType,
  };
  if (values.accountType !== "researcher") {
    return account;
  }
  return {
    ...account,
    researcher: {
      institution: values.institution.trim(),
      research_area:
        values.researchArea === OTHER_RESEARCH_AREA
          ? values.otherResearchArea.trim()
          : values.researchArea,
      designation: values.designation.trim() || null,
      reason: values.reason.trim(),
      profile_url: values.profileUrl.trim() || null,
      acknowledged: true,
    },
  };
}
