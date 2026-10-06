/**
 * Флаг «открыта экранная клавиатура» на body: data-keyboard.
 *
 * В iOS всё, что прибито к низу через position: fixed, при клавиатуре
 * всплывает над ней — удержать панель навигации на месте нельзя никак. Зато
 * можно прятать её ровно на время клавиатуры и возвращать, как только та
 * закрылась: тогда панель либо на месте, либо её нет, а «подлетать» нечему.
 *
 * Два сигнала. Фокус в текстовом поле — ранний: клавиатура ещё только
 * выезжает, а панель уже спрятана, иначе она успевала бы дёрнуться. Высота
 * визуального вьюпорта — надёжный: когда она вернулась к высоте окна,
 * клавиатуры точно нет. В Android окно само сжимается вместе с клавиатурой,
 * разницы высот нет, и флаг там не ставится: панель над клавиатурой там
 * обычное дело.
 */
const KEYBOARD_MIN_PX = 150;
const TEXT_TYPES = new Set([
  "text",
  "search",
  "email",
  "tel",
  "url",
  "number",
  "password",
]);

function isTextField(node: Element | null): boolean {
  if (!node) return false;
  if (node instanceof HTMLTextAreaElement) return true;
  if (node instanceof HTMLInputElement) {
    return TEXT_TYPES.has(node.type) || node.inputMode !== "";
  }
  return (node as HTMLElement).isContentEditable === true;
}

export function watchKeyboard(): () => void {
  const body = document.body;
  const viewport = window.visualViewport;

  const set = (on: boolean) => {
    if (on) body.dataset.keyboard = "";
    else delete body.dataset.keyboard;
  };

  const viewportShrunk = () =>
    viewport !== null &&
    window.innerHeight - viewport.height > KEYBOARD_MIN_PX;

  const onFocusIn = (event: FocusEvent) => {
    if (isTextField(event.target as Element | null)) set(true);
  };
  const onFocusOut = () => {
    window.setTimeout(() => {
      if (!isTextField(document.activeElement) && !viewportShrunk()) set(false);
    }, 100);
  };
  const onResize = () => {
    if (viewportShrunk()) set(true);
    else if (!isTextField(document.activeElement)) set(false);
  };

  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  viewport?.addEventListener("resize", onResize);

  return () => {
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    viewport?.removeEventListener("resize", onResize);
    set(false);
  };
}
