"use client";

import {
  describedBy,
  FieldLabel,
  FieldMessage,
  inputClass,
  TextField,
} from "@/components/form-fields";
import {
  type FieldErrors,
  OTHER_RESEARCH_AREA,
  RESEARCH_AREAS,
  type ResearcherValues,
} from "@/lib/auth-validation";

// The questions asked for researcher access. The same fields are used when
// signing up and when asking later from the account.
export function ResearcherFields({
  idPrefix,
  values,
  errors,
  onChange,
}: {
  idPrefix: string;
  values: ResearcherValues;
  errors: FieldErrors<ResearcherValues>;
  onChange: <Field extends keyof ResearcherValues>(
    field: Field,
    value: ResearcherValues[Field],
  ) => void;
}) {
  return (
    <>
      <TextField
        autoComplete="organization"
        error={errors.institution}
        id={`${idPrefix}-institution`}
        label="Institution / Organisation"
        maxLength={200}
        onChange={(value) => onChange("institution", value)}
        value={values.institution}
      />

      <div>
        <FieldLabel id={`${idPrefix}-researchArea`} label="Research Area" />
        <select
          className={`mt-1.5 ${inputClass(errors.researchArea)}`}
          id={`${idPrefix}-researchArea`}
          onChange={(event) => onChange("researchArea", event.target.value)}
          required
          value={values.researchArea}
          {...describedBy(`${idPrefix}-researchArea`, undefined, errors.researchArea)}
        >
          <option value="">Select a research area</option>
          {RESEARCH_AREAS.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
        <FieldMessage error={errors.researchArea} id={`${idPrefix}-researchArea`} />
      </div>

      {values.researchArea === OTHER_RESEARCH_AREA && (
        <TextField
          error={errors.otherResearchArea}
          id={`${idPrefix}-otherResearchArea`}
          label="Please specify"
          maxLength={120}
          onChange={(value) => onChange("otherResearchArea", value)}
          value={values.otherResearchArea}
        />
      )}

      <TextField
        autoComplete="organization-title"
        hint="For example researcher, student researcher, scientist or faculty."
        id={`${idPrefix}-designation`}
        label="Designation"
        maxLength={120}
        onChange={(value) => onChange("designation", value)}
        optional
        value={values.designation}
      />

      <div>
        <FieldLabel id={`${idPrefix}-reason`} label="Reason for Researcher Access" />
        <textarea
          className={`mt-1.5 min-h-24 ${inputClass(errors.reason)}`}
          id={`${idPrefix}-reason`}
          maxLength={1000}
          onChange={(event) => onChange("reason", event.target.value)}
          required
          value={values.reason}
          {...describedBy(
            `${idPrefix}-reason`,
            "Briefly describe why you need researcher access to DhruvSetu.",
            errors.reason,
          )}
        />
        <FieldMessage
          error={errors.reason}
          hint="Briefly describe why you need researcher access to DhruvSetu."
          id={`${idPrefix}-reason`}
        />
      </div>

      <TextField
        autoComplete="url"
        error={errors.profileUrl}
        hint="A page about you at your institution, or a professional profile."
        id={`${idPrefix}-profileUrl`}
        label="Institutional / Professional Profile URL"
        maxLength={500}
        onChange={(value) => onChange("profileUrl", value)}
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
            id={`${idPrefix}-acknowledged`}
            onChange={(event) => onChange("acknowledged", event.target.checked)}
            required
            type="checkbox"
            {...describedBy(`${idPrefix}-acknowledged`, undefined, errors.acknowledged)}
          />
          <span>
            I understand that researcher access requires administrator approval and
            that submitted research may require verification.
          </span>
        </label>
        <FieldMessage error={errors.acknowledged} id={`${idPrefix}-acknowledged`} />
      </div>
    </>
  );
}
