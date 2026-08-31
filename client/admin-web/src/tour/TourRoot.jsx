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
  // The popover is PINNED to a fixed spot at the bottom-centre of the viewport,
  // NOT floated against the anchor. This is the one change that kills every tour
  // positioning bug at once: reactour otherwise positions the popover next to the
  // highlighted element and scrolls to it, so on a long page it lands below the
  // fold, on a small/empty anchor it pins to the 0,0 corner, and the step badge
  // that hangs off its corner clips off-screen. Fixed to the viewport, the
  // popover is always in the same visible place; the mask still spotlights the
  // element wherever it is on the page. (`!important` because reactour writes the
  // computed top/left inline.)
  popover: (base) => ({
    ...base,
    zIndex: 10001,
    background: 'var(--d-card)',
    color: 'var(--d-ink)',
    borderRadius: 18,
    padding: '24px 24px 18px',
    boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
    fontFamily: "'Figtree', system-ui, sans-serif",
    fontSize: 15,
    lineHeight: 1.55,
    fontWeight: 500,
    width: 'max-content',
    maxWidth: 'min(420px, calc(100vw - 32px))',
    // No overflow clipping — the step badge hangs off the top-left corner and any
    // overflow would cut it. The popover is kept on-screen by the `position` prop.
    overflow: 'visible',
    boxSizing: 'border-box',
  }),
  maskArea: (base) => ({ ...base, rx: 16 }),
  // reactour's full-window "clickArea" rect has pointerEvents:auto so a click
  // outside the highlight can advance/close the tour. But it sits UNDER the
  // popover too, and swallows clicks on the popover's own Next/Back/Close
  // buttons — so the tour gets stuck (you literally can't advance). Turn its
  // pointer capture off; the popover buttons drive the tour, we don't need
  // click-outside-to-advance.
  clickArea: (base) => ({ ...base, pointerEvents: 'none' }),
  // The dim overlay must sit ABOVE the app content or there's no spotlight — the
  // page just stays bright (the SVG defaulted to z-index:auto and lost to the
  // top bar / panels' own stacking contexts). Just below the popover.
  maskWrapper: (base) => ({ ...base, color: 'rgba(15,23,30,0.55)', zIndex: 10000 }),
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
      // Pin the popover to a fixed spot near the bottom-centre of the viewport,
      // regardless of where the highlighted element is. reactour calls this to
      // place the popover; returning constant viewport coordinates (not anchor-
      // relative) means it can never land off-screen, in a corner, or below the
      // fold on a long page — the recurring tour bugs. The mask still spotlights
      // the element wherever it sits. `sizes` is the measured popover box, so we
      // centre it horizontally and keep a 32px gap from the bottom.
      position={({ windowWidth, windowHeight }, sizes = {}) => {
        const w = sizes.width || 380;
        const h = sizes.height || 180;
        return [Math.max(16, (windowWidth - w) / 2), Math.max(16, windowHeight - h - 32)];
      }}
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
