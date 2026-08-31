import { getSettings } from "../data/settings";
import type { Lang } from "../data/types";
import { EN } from "./i18n.en";
import { ET } from "./i18n.et";
import { EN_FORMS, ET_FORMS, RU_FORMS } from "./i18n.plural";

/**
 * Перевод без библиотеки.
 *
 * Ключ — это русская строка. Так переезд обошёлся без выдумывания восьмисот
 * идентификаторов, а главное: если английского перевода для ключа нет,
 * показывается сам ключ, то есть русский текст. Экран не ломается и не пустеет
 * никогда — худшее, что бывает, это непереведённая надпись.
 */
export type Params = Record<string, string | number> | Array<string | number>;

export function lang(): Lang {
  return getSettings().language;
}

const LOCALES: Record<Lang, string> = {
  // Британская, а не американская: часы в приложении 24-часовые.
  en: "en-GB",
  et: "et-EE",
  ru: "ru-RU",
};

export function locale(): string {
  return LOCALES[lang()];
}

function fill(text: string, params: Params): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = Array.isArray(params)
      ? params[Number(name)]
      : params[name as keyof typeof params];
    return value === undefined ? whole : String(value);
  });
}

/** Русского словаря нет: ключ и есть русская строка. */
const DICTS: Partial<Record<Lang, Record<string, string>>> = { en: EN, et: ET };

export function t(key: string, params?: Params): string {
  const raw = DICTS[lang()]?.[key] ?? key;
  return params === undefined ? raw : fill(raw, params);
}

/**
 * Форма слова при числе. В русском их три, в английском две, поэтому формы
 * лежат в словарях, а на месте вызова остаётся только само слово.
 */
export function pluralOf(n: number, key: string): string {
  const current = lang();

  if (current === "ru") {
    const forms = RU_FORMS[key];
    if (!forms) return key;
    const abs = Math.abs(n) % 100;
    const tail = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (tail > 1 && tail < 5) return forms[1];
    if (tail === 1) return forms[0];
    return forms[2];
  }

  // В английском вторая форма — множественное число, в эстонском — частитив
  // единственного: «3 päeva», а не «3 päevad». Устроены одинаково, две формы.
  const forms = (current === "et" ? ET_FORMS : EN_FORMS)[key];
  if (!forms) return RU_FORMS[key]?.[0] ?? key;
  return Math.abs(n) === 1 ? forms[0] : forms[1];
}

/**
 * Число для поля ввода: где-то десятичная запятая, где-то точка. Разбор
 * принимает и то и другое, но подставлять надо привычное.
 */
export function decimalInput(value: number): string {
  const text = String(value);
  // Точка только в английском: в русском и эстонском разделитель — запятая.
  return lang() === "en" ? text : text.replace(".", ",");
}

/** «3 дня» / «3 days». */
export function withCount(n: number, key: string): string {
  return `${n} ${pluralOf(n, key)}`;
}
