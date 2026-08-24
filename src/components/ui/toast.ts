export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface ToastState {
  id: number;
  text: string;
  action?: ToastAction;
  durationMs: number;
}

let current: ToastState | null = null;
let counter = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getToast(): ToastState | null {
  return current;
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  current = null;
  emit();
}

export function showToast(
  text: string,
  action?: ToastAction,
  durationMs = 2000,
): void {
  if (timer) clearTimeout(timer);
  counter += 1;
  current = { id: counter, text, action, durationMs };
  emit();
  timer = setTimeout(dismissToast, durationMs);
}
