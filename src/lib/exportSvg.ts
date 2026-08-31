interface PngOptions {
  width: number;
  height: number;
  background: string;
  filename: string;
}

/**
 * Готовый SVG со страницы — в файл PNG.
 *
 * Сериализованная картинка теряет внешние стили, поэтому все цвета в таком
 * SVG должны быть заданы прямо в атрибутах, иначе на выходе получится чёрное
 * на чёрном.
 */
export async function svgToPng(
  svg: SVGSVGElement,
  { width, height, background, filename }: PngOptions,
): Promise<void> {
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(t("не удалось нарисовать")));
    image.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(t("нет холста"));
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(url);

  const png = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!png) throw new Error(t("не удалось сохранить"));

  const file = new File([png], filename, { type: "image/png" });

  // На телефоне уместнее системное меню отправки; в настольном браузере
  // navigator.share не доводит дело до конца, поэтому там просто скачиваем.
  const onPhone = navigator.maxTouchPoints > 0;
  if (onPhone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Sebason" });
      return;
    } catch (cause) {
      if ((cause as Error)?.name === "AbortError") return;
    }
  }

  const link = document.createElement("a");
  link.href = URL.createObjectURL(png);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}import { t } from "../lib/i18n";

