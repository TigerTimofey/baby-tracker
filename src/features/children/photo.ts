const SIDE = 256;
const QUALITY = 0.82;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/**
 * Фото хранится прямо в записи ребёнка как data URL.
 *
 * Поэтому его надо сжать до предсказуемого размера: строка уезжает в Supabase
 * вместе со строкой таблицы, и полноразмерный снимок с телефона (несколько
 * мегабайт) забил бы и базу, и каждую синхронизацию. 256×256 хватает и для
 * кружка в шапке, и для карточки на любом экране.
 */
export async function squarePhotoFromFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Это не изображение");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Файл слишком большой");
  }

  const bitmap = await loadBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const left = (bitmap.width - side) / 2;
  const top = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Не удалось обработать изображение");

  context.drawImage(bitmap, left, top, side, side, 0, 0, SIDE, SIDE);
  if ("close" in bitmap) bitmap.close();

  return canvas.toDataURL("image/jpeg", QUALITY);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari спотыкается на некоторых HEIC и повёрнутых JPEG — падаем ниже.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Не удалось открыть изображение"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
