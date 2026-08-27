import { useState } from "react";
import type { Child } from "../../data/types";
import styles from "./ChildAvatar.module.css";

interface ChildAvatarProps {
  child: Child | null;
  size?: number;
  className?: string;
}

export function ChildAvatar({ child, size = 38, className }: ChildAvatarProps) {
  const [broken, setBroken] = useState(false);
  const letter = child ? child.name.trim().slice(0, 1).toUpperCase() : "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };

  return (
    <span className={[styles.avatar, className ?? ""].filter(Boolean).join(" ")} style={style}>
      {child?.photo && !broken ? (
        <img
          className={styles.image}
          src={child.photo}
          alt=""
          onError={() => setBroken(true)}
        />
      ) : (
        letter
      )}
    </span>
  );
}
