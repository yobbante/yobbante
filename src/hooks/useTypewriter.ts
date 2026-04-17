import { useEffect, useState } from 'react';

/**
 * Progressive typing animation. Returns the typed substring.
 * @param text Full text to type out
 * @param speed ms per character (default 18)
 * @param startDelay ms before typing begins
 */
export function useTypewriter(text: string, speed = 18, startDelay = 0) {
  const [out, setOut] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setOut('');
    setDone(false);
    let i = 0;
    let raf: number | undefined;
    let timer: number | undefined;

    const tick = () => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) {
        setDone(true);
        return;
      }
      timer = window.setTimeout(tick, speed);
    };

    const startTimer = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, startDelay);

    return () => {
      window.clearTimeout(startTimer);
      if (timer) window.clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [text, speed, startDelay]);

  return { text: out, done };
}
