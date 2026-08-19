import { useCallback, useEffect, useRef } from 'react';
import { TourProvider, useTour } from '@reactour/tour';
import { useLocation } from 'react-router-dom';
import { stepsForRoute, hasTour } from './steps.jsx';

// Per-page guided tours. Each page has its own short, self-contained tour of that
// page's real controls. Crucially the tour NEVER navigates between pages — so the
// page never remounts mid-tour and the popover never loses its anchor (the bug
// the old one-big-cross-page tour had). A page's tour is launched from that page.
//
// Auto-once: the Live board runs its own tour automatically the first time an
// admin lands, then never again.

const SEEN_KEY = 'bpc.admin.tourSeen';

// Popover styling mapped to the app's design tokens (theme-aware for free).
const tourStyles = {
  popover: (base) => ({
    ...base,
    background: 'var(--d-card)',
    color: 'var(--d-ink)',
    borderRadius: 18,
    padding: '22px 24px 18px',
    boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
    fontFamily: "'Figtree', system-ui, sans-serif",
    fontSize: 15,
    lineHeight: 1.55,
    fontWeight: 500,
    // Never exceed the viewport: the library positions the popover against its
    // anchor but does not clamp it, so a 360px box next to a right-edge or
    // bottom-edge anchor used to spill off-screen. Cap width to the viewport
    // (with a gutter) and cap height with internal scroll so long descriptions
    // stay on-screen too.
    width: 'max-content',
    maxWidth: 'min(340px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
    boxSizing: 'border-box',
  }),
  maskArea: (base) => ({ ...base, rx: 16 }),
  maskWrapper: (base) => ({ ...base, color: 'rgba(15,23,30,0.55)' }),
  badge: (base) => ({ ...base, background: 'var(--d-primary)', color: 'var(--d-primary-ink)', fontFamily: "'Figtree', system-ui, sans-serif", fontWeight: 700 }),
  dot: (base, { current } = {}) => ({ ...base, background: current ? 'var(--d-primary)' : 'var(--d-border)', borderColor: 'transparent' }),
  controls: (base) => ({ ...base, marginTop: 18 }),
  button: (base) => ({ ...base, color: 'var(--d-ink2)' }),
  close: (base) => ({ ...base, color: 'var(--d-muted)', top: 14, right: 14 }),
  arrow: (base) => ({ ...base, color: 'var(--d-ink2)' }),
};

// Auto-runs the Live board's own tour once for a first-time admin, but only while
// they're actually on the Live board (so it never fights a page they navigated to).
function AutoStart() {
  const { setSteps, setCurrentStep, setIsOpen } = useTour();
  const { pathname } = useLocation();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || pathname !== '/') return;
    let seen = '1';
    try { seen = localStorage.getItem(SEEN_KEY); } catch { /* treat as seen */ }
    if (seen) return;
    fired.current = true;
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    const steps = stepsForRoute('/');
    if (!steps.length) return;
    setSteps?.(steps);
    setCurrentStep(0);
    setIsOpen(true);
  }, [pathname, setSteps, setCurrentStep, setIsOpen]);
  return null;
}

export default function TourRoot({ children }) {
  return (
    <TourProvider
      steps={[]}
      styles={tourStyles}
      showBadge
      showDots
      showCloseButton
      disableInteraction
      // Keep the popover on-screen: a larger in-view threshold makes the library
      // treat an anchor near an edge as needing the popover flipped/centred to
      // stay visible, instead of drawing it off the side of the screen.
      inViewThreshold={{ x: 180, y: 120 }}
      padding={{ mask: 6, popover: [12, 12] }}
      scrollSmooth
      prevButton={({ currentStep, setCurrentStep }) =>
        currentStep === 0 ? null : (
          <button type="button" onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--d-ink2)', fontWeight: 700, fontFamily: 'inherit', fontSize: 14 }}>
            Back
          </button>
        )
      }
      nextButton={({ currentStep, stepsLength, setCurrentStep, setIsOpen }) => {
        const last = currentStep === stepsLength - 1;
        return (
          <button type="button" onClick={() => (last ? setIsOpen(false) : setCurrentStep((s) => s + 1))}
            style={{ background: 'var(--d-primary)', color: 'var(--d-primary-ink)', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 14 }}>
            {last ? 'Done' : 'Next'}
          </button>
        );
      }}
    >
      <AutoStart />
      {children}
    </TourProvider>
  );
}

// Launch the tour for the CURRENT page. Loads only this page's steps, then opens.
// No navigation — the caller is already on the page. Returns whether a tour was
// available (so a button can hide itself on pages with no tour).
export function usePageTour() {
  const { setSteps, setCurrentStep, setIsOpen } = useTour();
  const { pathname } = useLocation();
  const available = hasTour(pathname);
  const start = useCallback(() => {
    const steps = stepsForRoute(pathname);
    if (!steps.length) return;
    setSteps?.(steps);
    setCurrentStep(0);
    setIsOpen(true);
  }, [pathname, setSteps, setCurrentStep, setIsOpen]);
  return { start, available };
}
