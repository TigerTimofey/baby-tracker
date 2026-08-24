import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";
import styles from "./Form.module.css";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (id: string) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  suffix?: string;
}

export function TextInput({ suffix, className, ...rest }: TextInputProps) {
  const input = (
    <input
      className={[styles.control, className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    />
  );

  if (!suffix) return input;

  return (
    <span className={styles.suffixWrap}>
      {input}
      <span className={styles.suffix}>{suffix}</span>
    </span>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={[styles.control, className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}

export function FormRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}
