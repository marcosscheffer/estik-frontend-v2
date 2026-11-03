import { forwardRef, useId } from "react";
import clsx from "clsx";

const control =
  "block w-full rounded-lg border-0 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-sm shadow-black/20 ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-800/50 disabled:text-slate-500";
const invalid = "ring-red-500 focus:ring-red-500";

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: (id: string) => React.ReactNode;
}

export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={clsx("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(id) => <input id={id} ref={ref} className={clsx(control, error && invalid)} {...rest} />}
    </Field>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, rows = 4, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} className={className}>
      {(id) => (
        <textarea id={id} ref={ref} rows={rows} className={clsx(control, error && invalid)} {...rest} />
      )}
    </Field>
  );
});

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  hint?: string;
  options: Option[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, className, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(id) => (
        <select id={id} ref={ref} className={clsx(control, "pr-8", error && invalid)} {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
});
