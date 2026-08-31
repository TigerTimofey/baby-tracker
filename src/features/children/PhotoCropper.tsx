import { t } from "../../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { PHOTO_SIDE, renderSquare } from "./photo";
import styles from "./PhotoCropper.module.css";

/** Сторона рамки на экране. Реальный кадр считается от неё в долях. */
const VIEW = 260;
const MAX_ZOOM = 4;

interface PhotoCropperProps {
  file: File;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}

export function PhotoCropper({ file, onCancel, onDone }: PhotoCropperProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    // Читаем файл целиком, а не через createObjectURL: временную ссылку
    // пришлось бы отзывать в очистке эффекта, а она в разработке срабатывает
    // до того, как картинка успевает загрузиться.
    const reader = new FileReader();
    reader.onload = () => {
      if (!alive) return;
      const img = new Image();
      img.onload = () => {
        if (alive) setImage(img);
      };
      img.onerror = () => {
        if (alive) setError(t("Не удалось открыть изображение"));
      };
      img.src = String(reader.result);
    };
    reader.onerror = () => {
      if (alive) setError(t("Не удалось прочитать файл"));
    };
    reader.readAsDataURL(file);
    return () => {
      alive = false;
    };
  }, [file]);

  if (error) {
    return (
      <Sheet open onClose={onCancel} title={t("Фото")}>
        <p className={styles.error}>{error}</p>
        <Button variant="secondary" onClick={onCancel}>
          {t("Закрыть")}
        </Button>
      </Sheet>
    );
  }

  // Масштаб, при котором картинка ровно закрывает рамку, — от него и пляшем.
  const cover = image
    ? VIEW / Math.min(image.naturalWidth, image.naturalHeight)
    : 1;
  const scale = cover * zoom;
  const shownW = image ? image.naturalWidth * scale : 0;
  const shownH = image ? image.naturalHeight * scale : 0;

  /** Не даём утащить картинку так, чтобы в рамке образовалась пустота. */
  const clamp = (next: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(VIEW - shownW, next.x)),
    y: Math.min(0, Math.max(VIEW - shownH, next.y)),
  });

  const changeZoom = (next: number) => {
    if (!image) return;
    const middle = {
      x: (VIEW / 2 - offset.x) / scale,
      y: (VIEW / 2 - offset.y) / scale,
    };
    const nextScale = cover * next;
    setZoom(next);
    setOffset(
      clampWith(
        {
          x: VIEW / 2 - middle.x * nextScale,
          y: VIEW / 2 - middle.y * nextScale,
        },
        image.naturalWidth * nextScale,
        image.naturalHeight * nextScale,
      ),
    );
  };

  function clampWith(
    next: { x: number; y: number },
    width: number,
    height: number,
  ) {
    return {
      x: Math.min(0, Math.max(VIEW - width, next.x)),
      y: Math.min(0, Math.max(VIEW - height, next.y)),
    };
  }

  async function confirm() {
    if (!image) return;
    setBusy(true);
    try {
      onDone(
        renderSquare(image, {
          x: -offset.x / scale,
          y: -offset.y / scale,
          size: VIEW / scale,
        }),
      );
    } catch {
      setError(t("Не удалось обработать фото"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onCancel} title={t("Кадрируйте фото")}>
      <p className={styles.hint}>
        {t("Потяните снимок, чтобы выбрать, что попадёт в кружок. Ползунком —\n        приблизить.")}
      </p>

      <div
        className={styles.frame}
        style={{ width: VIEW, height: VIEW }}
        onPointerDown={(event) => {
          drag.current = {
            x: event.clientX - offset.x,
            y: event.clientY - offset.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setOffset(
            clamp({
              x: event.clientX - drag.current.x,
              y: event.clientY - drag.current.y,
            }),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {image && (
          <img
            className={styles.image}
            src={image.src}
            alt=""
            draggable={false}
            style={{
              width: shownW,
              height: shownH,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        )}
      </div>

      <label className={styles.zoom}>
        <span className={styles.zoomLabel}>{t("Масштаб")}</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          aria-label={t("Масштаб")}
          onChange={(event) => changeZoom(Number(event.target.value))}
        />
      </label>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>
          {t("Отмена")}
        </Button>
        <Button variant="primary" disabled={!image || busy} onClick={confirm}>
          {t("Готово")}
        </Button>
      </div>

      <p className={styles.note}>
        {t("Сохранится квадрат {0}×{1} — этого хватает и кружку в шапке, и карточке.", [
          PHOTO_SIDE,
          PHOTO_SIDE,
        ])}
      </p>
    </Sheet>
  );
}
