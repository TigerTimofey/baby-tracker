import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Размер подписей внутри масштабируемого SVG в экранных пикселях.
 *
 * Текст в SVG растягивается вместе с viewBox, поэтому «9px» в CSS на узком
 * телефоне превращается в 6,7 экранных пикселя. Хук возвращает множитель, на
 * который надо разделить желаемый размер, чтобы он остался собой.
 */
export function useSvgTextScale(
  viewBoxWidth: number,
): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () =>
      setScale((node.clientWidth || viewBoxWidth) / viewBoxWidth);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [viewBoxWidth]);

  return [ref, scale];
}
