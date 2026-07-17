// Хук: измеряет ширину контейнера через ResizeObserver,
// чтобы SVG-графики были отзывчивыми (viewBox = реальная ширина в px).

import { useEffect, useRef, useState, type RefObject } from 'react';

export function useMeasuredWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
