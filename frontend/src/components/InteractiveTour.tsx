import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X, ChevronRight } from 'lucide-react';
import questionmarkIcon from '../assets/questionmark.svg';

interface TourStep {
  target: string;        // CSS selector
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  spotlightClicks?: boolean; // allow clicking through
  waitForNext?: boolean;     // don't show "avanti", wait for user action
  blockOutsideClicks?: boolean; // default true: 4-panel overlay blocks clicks outside spotlight
}

const DASHBOARD_STEPS: TourStep[] = [
  {
    target: '.tour-create-set-card',
    title: 'Crea la tua prima Scacchiera',
    content: 'Clicca qui per aprire il pannello di creazione.',
    placement: 'bottom',
    spotlightClicks: true,
    waitForNext: true,
    blockOutsideClicks: true,
  },
  {
    target: '.tour-set-name-input',
    title: 'Dai un nome alla scacchiera',
    content: 'Scrivi il nome del tuo set. Clicca Avanti quando hai finito, oppure clicca direttamente nel campo descrizione.',
    placement: 'bottom',
    spotlightClicks: true,
    waitForNext: false,        // mostra pulsante Avanti
    blockOutsideClicks: false, // permette di cliccare nel campo descrizione
  },
  {
    target: '.tour-set-desc-input',
    title: 'Descrizione (opzionale)',
    content: 'Puoi aggiungere una descrizione. Quando sei pronto clicca "Crea Set" per generare i pezzi.',
    placement: 'top',
    spotlightClicks: true,
    waitForNext: true,         // avanza solo al click su Crea Set
    blockOutsideClicks: false, // permette di cliccare il pulsante Crea Set
  },
];

const SET_DETAIL_STEPS: TourStep[] = [
  {
    target: '.tour-piece-King',
    title: 'Inizia dal Re',
    content: 'Ottimo! Ecco i tuoi pezzi. Clicca sul Re per iniziare a personalizzarlo.',
    placement: 'bottom',
    spotlightClicks: true,
    waitForNext: true,
  },
];

function TourTooltip({
  step,
  onNext,
  onSkip,
  isLast,
  stepNumber,
  totalSteps,
}: {
  step: TourStep;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
  stepNumber: number;
  totalSteps: number;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setVisible(false);
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const fresh = el.getBoundingClientRect();
      setRect(fresh);
      setVisible(true);
    }, 350);
  }, [step.target]);

  // Recompute position on window resize
  useEffect(() => {
    if (!visible) return;
    const handleResize = () => {
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [visible, step.target]);

  if (!rect || !visible) return null;

  const placement = step.placement || 'bottom';
  const pad = 12;
  const tooltipW = 300;
  const tooltipH = 150; // approx

  // All positioning uses viewport coords (position:fixed — no scrollY needed)
  let top = 0;
  let left = 0;

  if (placement === 'bottom') {
    top = rect.bottom + pad;
    left = rect.left + rect.width / 2 - tooltipW / 2;
  } else if (placement === 'top') {
    top = rect.top - tooltipH - pad;
    left = rect.left + rect.width / 2 - tooltipW / 2;
  } else if (placement === 'right') {
    top = rect.top + rect.height / 2 - tooltipH / 2;
    left = rect.right + pad;
  } else {
    top = rect.top + rect.height / 2 - tooltipH / 2;
    left = rect.left - tooltipW - pad;
  }

  // Clamp to viewport
  left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - tooltipH - 8));

  const spotPad = 6;

  const overlayColor = 'rgba(15,23,42,0.60)';
  const sL = rect.left - spotPad;
  const sT = rect.top - spotPad;
  const sR = rect.right + spotPad;
  const sB = rect.bottom + spotPad;
  const block = step.blockOutsideClicks !== false;

  return createPortal(
    <>
      {/* 4 blocking panels: only when blockOutsideClicks is not false */}
      {block && (
        <>
          {/* Top */}
          <div className="fixed z-[9995]" style={{ top: 0, left: 0, right: 0, height: Math.max(0, sT), background: overlayColor, cursor: 'not-allowed' }} onClick={e => e.stopPropagation()} />
          {/* Bottom */}
          <div className="fixed z-[9995]" style={{ top: sB, left: 0, right: 0, bottom: 0, background: overlayColor, cursor: 'not-allowed' }} onClick={e => e.stopPropagation()} />
          {/* Left */}
          <div className="fixed z-[9995]" style={{ top: sT, left: 0, width: Math.max(0, sL), height: sB - sT, background: overlayColor, cursor: 'not-allowed' }} onClick={e => e.stopPropagation()} />
          {/* Right */}
          <div className="fixed z-[9995]" style={{ top: sT, left: sR, right: 0, height: sB - sT, background: overlayColor, cursor: 'not-allowed' }} onClick={e => e.stopPropagation()} />
        </>
      )}

      {/* Spotlight ring — visible border around target, click-through when spotlightClicks */}
      <div
        className="fixed z-[9996]"
        style={{
          left: sL,
          top: sT,
          width: sR - sL,
          height: sB - sT,
          borderRadius: 10,
          border: '2px solid rgba(139,92,246,0.85)',
          boxShadow: '0 0 12px rgba(139,92,246,0.4)',
          pointerEvents: step.spotlightClicks ? 'none' : 'auto',
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={{ top, left, width: tooltipW }}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="bg-violet-600 px-4 py-3 flex items-center justify-between">
            <span className="text-white font-semibold text-sm">{step.title}</span>
            <div className="flex items-center gap-2">
              <span className="text-violet-300 text-xs">{stepNumber}/{totalSteps}</span>
              <button onClick={onSkip} className="text-violet-300 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-slate-700 text-sm leading-relaxed">{step.content}</p>
          </div>
          {!step.waitForNext && (
            <div className="px-4 pb-3 flex justify-end">
              <button
                onClick={onNext}
                className="flex items-center gap-1 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                {isLast ? 'Fine' : 'Avanti'} <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
          {step.waitForNext && (
            <div className="px-4 pb-3 flex justify-between items-center">
              <span className="text-xs text-slate-400 italic">Esegui l'azione per continuare</span>
              <button onClick={onSkip} className="text-xs text-slate-400 hover:text-slate-600 underline">
                Salta
              </button>
            </div>
          )}
        </div>
        {/* Arrow */}
        {placement === 'bottom' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-violet-600" />
        )}
        {placement === 'top' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-white" />
        )}
      </div>
    </>,
    document.body
  );
}

function getStepsForPath(pathname: string): TourStep[] {
  if (pathname === '/') return DASHBOARD_STEPS;
  if (pathname.startsWith('/sets/')) return SET_DETAIL_STEPS;
  return [];
}

export function InteractiveTour() {
  const location = useLocation();

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [currentSteps, setCurrentSteps] = useState<TourStep[]>([]);

  const finish = () => {
    setActive(false);
    localStorage.setItem('chess3d_interactive_tutorial', 'done');
    localStorage.removeItem('chess3d_current_step');
  };

  const startForCurrentPage = (steps: TourStep[], startIdx = 0) => {
    setCurrentSteps(steps);
    setStepIndex(startIdx);
    setActive(true);
  };

  // Auto-start on first visit (following the creation flow)
  useEffect(() => {
    const done = localStorage.getItem('chess3d_interactive_tutorial');
    if (done) return;

    if (location.pathname === '/') {
      const savedStep = parseInt(localStorage.getItem('chess3d_current_step') || '0', 10);
      if (savedStep <= DASHBOARD_STEPS.length - 1) {
        startForCurrentPage(DASHBOARD_STEPS, savedStep);
      }
    } else if (location.pathname.startsWith('/sets/')) {
      const savedStep = parseInt(localStorage.getItem('chess3d_current_step') || '0', 10);
      if (savedStep >= DASHBOARD_STEPS.length) {
        const timer = setTimeout(() => {
          startForCurrentPage(SET_DETAIL_STEPS, 0);
          localStorage.setItem('chess3d_current_step', DASHBOARD_STEPS.length.toString());
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [location.pathname]);

  // Listen for manual trigger from floating button
  useEffect(() => {
    const handleOpen = () => {
      const steps = getStepsForPath(location.pathname);
      if (!steps.length) return;
      localStorage.removeItem('chess3d_interactive_tutorial');
      localStorage.removeItem('chess3d_current_step');

      // Context-aware start: if a later step's target is already visible in the DOM
      // (e.g. a modal is open), start from the first such step instead of step 0.
      let startIdx = 0;
      for (let i = 1; i < steps.length; i++) {
        if (document.querySelector(steps[i].target)) {
          startIdx = i;
          break;
        }
      }

      setCurrentSteps(steps);
      setStepIndex(startIdx);
      setActive(true);
    };
    window.addEventListener('chess3d-open-tour', handleOpen);
    return () => window.removeEventListener('chess3d-open-tour', handleOpen);
  }, [location.pathname]);

  // Click listener to advance on spotlightClicks steps
  useEffect(() => {
    if (!active || !currentSteps.length) return;
    const step = currentSteps[stepIndex];
    if (!step?.spotlightClicks) return;

    const handleClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;

      // Cancel/close buttons always stop the tour
      if (el.closest('.tour-modal-cancel')) {
        finish();
        return;
      }

      // Step 0: click "Crea Scacchiera" card -> advance to name step
      if (step.target === '.tour-create-set-card' && el.closest('.tour-create-set-card')) {
        setTimeout(() => {
          const nextIdx = stepIndex + 1;
          setStepIndex(nextIdx);
          localStorage.setItem('chess3d_current_step', nextIdx.toString());
        }, 300);
      }

      // Name step: clicking directly in description field advances to description step
      if (step.target === '.tour-set-name-input' && el.closest('.tour-set-desc-input')) {
        const nextIdx = stepIndex + 1;
        setStepIndex(nextIdx);
        localStorage.setItem('chess3d_current_step', nextIdx.toString());
      }

      // Description step: clicking "Crea Set" -> submit + navigate to set detail
      if (step.target === '.tour-set-desc-input' && el.closest('.tour-create-set-submit')) {
        localStorage.setItem('chess3d_current_step', DASHBOARD_STEPS.length.toString());
        setActive(false);
      }

      // Set detail: click King -> finish tutorial
      if (step.target === '.tour-piece-King' && el.closest('.tour-piece-King')) {
        finish();
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [active, stepIndex, currentSteps]);

  if (!active || !currentSteps.length || stepIndex >= currentSteps.length) return null;

  return (
    <TourTooltip
      step={currentSteps[stepIndex]}
      stepNumber={
        location.pathname === '/'
          ? stepIndex + 1
          : DASHBOARD_STEPS.length + stepIndex + 1
      }
      totalSteps={DASHBOARD_STEPS.length + SET_DETAIL_STEPS.length}
      isLast={
        location.pathname.startsWith('/sets/') && stepIndex === SET_DETAIL_STEPS.length - 1
      }
      onNext={() => {
        const nextIdx = stepIndex + 1;
        if (nextIdx >= currentSteps.length) {
          finish();
        } else {
          setStepIndex(nextIdx);
          localStorage.setItem('chess3d_current_step', nextIdx.toString());
          // Focus the target element of the next step (e.g. description textarea)
          setTimeout(() => {
            const nextTarget = currentSteps[nextIdx]?.target;
            if (nextTarget) {
              const el = document.querySelector(nextTarget) as HTMLElement | null;
              el?.focus();
            }
          }, 400); // after scrollIntoView animation
        }
      }}
      onSkip={finish}
    />
  );
}

export function TourFloatingButton() {
  const [hovered, setHovered] = useState(false);

  const handleOpen = () => {
    window.dispatchEvent(new CustomEvent('chess3d-open-tour'));
  };

  return createPortal(
    <button
      onClick={handleOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="fixed bottom-6 right-6 z-[9000] flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
      style={{
        padding: hovered ? '10px 16px 10px 14px' : '10px',
        minWidth: hovered ? 'auto' : 40,
      }}
      title="Riavvia il tutorial"
    >
      <span
        className="text-sm font-semibold overflow-hidden whitespace-nowrap transition-all duration-200"
        style={{ maxWidth: hovered ? 120 : 0, opacity: hovered ? 1 : 0 }}
      >
        Serve aiuto
      </span>
      <img src={questionmarkIcon} alt="?" className="w-5 h-5 flex-shrink-0" />
    </button>,
    document.body
  );
}
