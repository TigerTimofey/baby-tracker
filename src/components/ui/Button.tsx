import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "soft" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  iconOnly = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[size],
    styles[variant],
    block ? styles.block : "",
    iconOnly ? styles.iconOnly : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={classes} {...rest} />;
}
