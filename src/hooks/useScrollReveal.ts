import { useEffect } from 'react';

const SELECTOR = [
  '.scroll-reveal:not(.is-revealed)',
  '.scroll-reveal-left:not(.is-revealed)',
  '.scroll-reveal-right:not(.is-revealed)',
  '.scroll-reveal-up:not(.is-revealed)',
  '.scroll-reveal-scale:not(.is-revealed)',
].join(', ');

/**
 * useScrollReveal hook
 * Cards glide in from left/right/below and settle into place as they enter the
 * viewport. Runs again whenever a screen is mounted (login, tab switch), so the
 * sequence replays on every visit. Elements already on screen reveal at once.
 * Once revealed, an element is unobserved so scrolling back up never replays it.
 */
export function useScrollReveal(_deps: any[] = []) {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
    if (elements.length === 0) return;

    const reveal = (el: HTMLElement) => el.classList.add('is-revealed');

    if (typeof IntersectionObserver === 'undefined') {
      elements.forEach(reveal);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.06,
        rootMargin: '0px 0px 70px 0px',
      }
    );

    elements.forEach((el) => observer.observe(el));

    // Safety net: if anything already sitting on screen was missed (very tall
    // cards, browser quirks), show it rather than leaving a blank gap.
    const guard = window.setTimeout(() => {
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) reveal(el);
      });
    }, 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(guard);
    };
  }, []);
}
