const PENDING_KEY = "malysh.pendingInvite";
const CODE_PATTERN = /^[A-Za-z0-9]{4,12}$/;

export function inviteLink(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/join/${code}`;
}

export function getPendingInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function setPendingInvite(code: string): void {
  try {
    localStorage.setItem(PENDING_KEY, code.toUpperCase());
  } catch {
    void 0;
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    void 0;
  }
}

/**
 * Забирает код из адреса и чистит его, пока роутер не начал читать хеш.
 */
export function captureInviteFromUrl(): void {
  const fromHash = /^#\/join\/([A-Za-z0-9]+)/.exec(window.location.hash);
  const fromQuery = new URLSearchParams(window.location.search).get("invite");
  const code = fromHash?.[1] ?? fromQuery ?? null;

  if (!code || !CODE_PATTERN.test(code)) return;

  setPendingInvite(code);

  const params = new URLSearchParams(window.location.search);
  params.delete("invite");
  const query = params.toString();
  window.history.replaceState(
    {},
    "",
    window.location.pathname + (query ? `?${query}` : "") + "#/sleep",
  );
}
