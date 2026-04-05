import { useEffect, useRef, useState } from "react";

/** Fades/slides in when element enters viewport */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number;
}) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  const threshold = options?.threshold ?? 0.12;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, visible };
}
