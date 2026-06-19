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
  skipIfNotFound?: boolean;  // skip this step if the target is not currently in the DOM
  isFancyArrow?: boolean;    // use sketchy decorative arrow
}

const DASHBOARD_STEPS: TourStep[] = [
  {
    target: '.tour-create-set-card',
    title: 'Crea Scacchiera',
    content: 'Clicca qui per iniziare il tuo progetto da zero. Oppure lancia una partita veloce o importa un set qui a fianco!',
    placement: 'bottom',
    spotlightClicks: true,
    waitForNext: true,
    blockOutsideClicks: false, // crucial so they can click the other cards!
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
    blockOutsideClicks: false, // permette di cliccare il pubblicazione/pulsante Crea Set
  },
];

const COLLECTIONS_STEPS: TourStep[] = [
  {
    target: '.tour-create-collection-card',
    title: 'Crea Collezione',
    content: 'Clicca qui per iniziare a raggruppare e organizzare più scacchiere insieme.',
    placement: 'bottom',
    spotlightClicks: true,
    waitForNext: true,
    blockOutsideClicks: false,
  },
  {
    target: '.tour-coll-name-input',
    title: 'Dai un nome alla collezione',
    content: 'Scrivi il nome per la tua collezione. Clicca Avanti quando hai finito, oppure clicca direttamente nel campo descrizione.',
    placement: 'bottom',
    spotlightClicks: true,
    waitForNext: false,
    blockOutsideClicks: false,
  },
  {
    target: '.tour-coll-desc-input',
    title: 'Completa la collezione',
    content: 'Puoi aggiungere una descrizione opzionale e selezionare quali scacchiere associare. Infine premi "Crea Collezione".',
    placement: 'top',
    spotlightClicks: true,
    waitForNext: true,
    blockOutsideClicks: false,
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

  // States for secondary targets to show fancy secondary pointers
  const [existingSetRect, setExistingSetRect] = useState<DOMRect | null>(null);
  const [play1v1Rect, setPlay1v1Rect] = useState<DOMRect | null>(null);
  const [importSetRect, setImportSetRect] = useState<DOMRect | null>(null);
  const [setsTabRect, setSetsTabRect] = useState<DOMRect | null>(null);
  const [collectionsTabRect, setCollectionsTabRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    setVisible(false);
    setExistingSetRect(null);
    setPlay1v1Rect(null);
    setImportSetRect(null);
    setSetsTabRect(null);
    setCollectionsTabRect(null);

    let activeRetry = true;
    let retryTimeout: any = null;
    let retryCount = 0;

    const tryResolve = () => {
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          if (!activeRetry) return;
          const fresh = el.getBoundingClientRect();
          setRect(fresh);

          if (step.target === '.tour-create-set-card' || step.target === '.tour-create-collection-card') {
            const existEl = document.querySelector('.tour-existing-set-card') as HTMLElement | null;
            if (existEl) setExistingSetRect(existEl.getBoundingClientRect());

            const playEl = document.querySelector('.tour-play-1v1-card') as HTMLElement | null;
            if (playEl) setPlay1v1Rect(playEl.getBoundingClientRect());

            const importEl = document.querySelector('.tour-import-set-card') as HTMLElement | null;
            if (importEl) setImportSetRect(importEl.getBoundingClientRect());

            const setsTabEl = document.querySelector('.tour-tab-sets') as HTMLElement | null;
            if (setsTabEl) setSetsTabRect(setsTabEl.getBoundingClientRect());

            const collTabEl = document.querySelector('.tour-tab-collections') as HTMLElement | null;
            if (collTabEl) setCollectionsTabRect(collTabEl.getBoundingClientRect());
          }

          setVisible(true);
        }, 350);
      } else {
        if (retryCount < 15) {
          retryCount++;
          retryTimeout = setTimeout(tryResolve, 50);
        }
      }
    };

    tryResolve();

    return () => {
      activeRetry = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [step.target]);

  // Recompute position on window resize
  useEffect(() => {
    if (!visible) return;
    const handleResize = () => {
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());

      if (step.target === '.tour-create-set-card' || step.target === '.tour-create-collection-card') {
        const existEl = document.querySelector('.tour-existing-set-card') as HTMLElement | null;
        if (existEl) setExistingSetRect(existEl.getBoundingClientRect());

        const playEl = document.querySelector('.tour-play-1v1-card') as HTMLElement | null;
        if (playEl) setPlay1v1Rect(playEl.getBoundingClientRect());

        const importEl = document.querySelector('.tour-import-set-card') as HTMLElement | null;
        if (importEl) setImportSetRect(importEl.getBoundingClientRect());

        const setsTabEl = document.querySelector('.tour-tab-sets') as HTMLElement | null;
        if (setsTabEl) setSetsTabRect(setsTabEl.getBoundingClientRect());

        const collTabEl = document.querySelector('.tour-tab-collections') as HTMLElement | null;
        if (collTabEl) setCollectionsTabRect(collTabEl.getBoundingClientRect());
      }
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
          border: step.isFancyArrow
            ? '2.5px dashed rgba(139,92,246,0.75)'
            : '2px solid rgba(139,92,246,0.85)',
          boxShadow: step.isFancyArrow
            ? '0 0 8px rgba(139,92,246,0.25)'
            : '0 0 12px rgba(139,92,246,0.4)',
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
        {!step.isFancyArrow && placement === 'bottom' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-violet-600" />
        )}
        {!step.isFancyArrow && placement === 'top' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-white" />
        )}
      </div>

      {/* Secondary Custom Fancy Spotlights for other actions, when on the first Dashboard steps */}
      {(step.target === '.tour-create-set-card' || step.target === '.tour-create-collection-card') && (
        <>
          {/* existing set card ring & fancy arrow */}
          {existingSetRect && (
            <>
              <div
                className="fixed z-[9996] pointer-events-none"
                style={{
                  left: existingSetRect.left - spotPad,
                  top: existingSetRect.top - spotPad,
                  width: existingSetRect.right - existingSetRect.left + spotPad * 2,
                  height: existingSetRect.bottom - existingSetRect.top + spotPad * 2,
                  borderRadius: 10,
                  border: '2px dashed rgba(139,92,246,0.3)',
                  boxShadow: '0 0 6px rgba(139,92,246,0.1)',
                }}
              />
              <div
                className="fixed z-[9996] pointer-events-none flex flex-col items-center"
                style={{
                  left: existingSetRect.left + existingSetRect.width / 2 - 100,
                  top: existingSetRect.bottom + spotPad + 4,
                  width: 200,
                }}
              >
                <div className="animate-bounce flex flex-col items-center w-full">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-violet-500/80 drop-shadow-sm">
                    <path d="M16 20 C 12 16, 11 11, 11 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 11 L11 5 L16 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="mt-1.5 bg-white/95 border border-violet-100 rounded-xl px-3 py-1.5 shadow-md backdrop-blur-sm text-center w-full">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">
                    Visualizza e personalizza i pezzi 3D di questa scacchiera
                  </p>
                </div>
              </div>
            </>
          )}

          {/* play 1v1 card ring & fancy arrow */}
          {play1v1Rect && (
            <>
              <div
                className="fixed z-[9996] pointer-events-none"
                style={{
                  left: play1v1Rect.left - spotPad,
                  top: play1v1Rect.top - spotPad,
                  width: play1v1Rect.right - play1v1Rect.left + spotPad * 2,
                  height: play1v1Rect.bottom - play1v1Rect.top + spotPad * 2,
                  borderRadius: 10,
                  border: '2px dashed rgba(20,184,166,0.3)',
                  boxShadow: '0 0 6px rgba(20,184,166,0.1)',
                }}
              />
              <div
                className="fixed z-[9996] pointer-events-none flex flex-col items-center"
                style={{
                  left: play1v1Rect.left + play1v1Rect.width / 2 - 100,
                  top: play1v1Rect.bottom + spotPad + 4,
                  width: 200,
                }}
              >
                <div className="animate-bounce flex flex-col items-center w-full">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-teal-500/80 drop-shadow-sm">
                    <path d="M16 20 C 12 16, 11 11, 11 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 11 L11 5 L16 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="mt-1.5 bg-white/95 border border-teal-100 rounded-xl px-3 py-1.5 shadow-md backdrop-blur-sm text-center w-full">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">
                    Sfida un amico in locale usando le tue scacchiere
                  </p>
                </div>
              </div>
            </>
          )}

          {/* import set card ring & fancy arrow */}
          {importSetRect && (
            <>
              <div
                className="fixed z-[9996] pointer-events-none"
                style={{
                  left: importSetRect.left - spotPad,
                  top: importSetRect.top - spotPad,
                  width: importSetRect.right - importSetRect.left + spotPad * 2,
                  height: importSetRect.bottom - importSetRect.top + spotPad * 2,
                  borderRadius: 10,
                  border: '2px dashed rgba(99,102,241,0.3)',
                  boxShadow: '0 0 6px rgba(99,102,241,0.1)',
                }}
              />
              <div
                className="fixed z-[9996] pointer-events-none flex flex-col items-center"
                style={{
                  left: importSetRect.left + importSetRect.width / 2 - 100,
                  top: importSetRect.bottom + spotPad + 4,
                  width: 200,
                }}
              >
                <div className="animate-bounce flex flex-col items-center w-full">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-indigo-500/80 drop-shadow-sm">
                    <path d="M16 20 C 12 16, 11 11, 11 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 11 L11 5 L16 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="mt-1.5 bg-white/95 border border-indigo-100 rounded-xl px-3 py-1.5 shadow-md backdrop-blur-sm text-center w-full">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">
                    Carica e ripristina un set da un archivio ZIP salvato
                  </p>
                </div>
              </div>
            </>
          )}

          {/* setsTabRect ring & fancy arrow */}
          {setsTabRect && (
            <>
              <div
                className="fixed z-[9996] pointer-events-none"
                style={{
                  left: setsTabRect.left - spotPad,
                  top: setsTabRect.top - spotPad,
                  width: setsTabRect.right - setsTabRect.left + spotPad * 2,
                  height: setsTabRect.bottom - setsTabRect.top + spotPad * 2,
                  borderRadius: 10,
                  border: '2px dashed rgba(139,92,246,0.3)',
                  boxShadow: '0 0 6px rgba(139,92,246,0.1)',
                }}
              />
              <div
                className="fixed z-[9996] pointer-events-none flex flex-col items-center justify-end"
                style={{
                  left: setsTabRect.left + setsTabRect.width / 2 - 12,
                  top: setsTabRect.top - spotPad - 94,
                  width: 24,
                  height: 90,
                }}
              >
                <div className="absolute bottom-[28px] right-2 w-[160px] bg-white/95 border border-violet-100 rounded-xl px-3 py-1.5 shadow-md backdrop-blur-sm text-center">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">
                    Filtra per vedere l'elenco delle tue Scacchiere
                  </p>
                </div>
                <div className="animate-bounce flex flex-col items-center mt-auto w-full">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-violet-500/80 drop-shadow-sm">
                    <path d="M11.5 4 C 11.5 8, 12 13, 14 17 M8 13 L14 17 L18 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </>
          )}

          {/* collectionsTabRect ring & fancy arrow */}
          {collectionsTabRect && (
            <>
              <div
                className="fixed z-[9996] pointer-events-none"
                style={{
                  left: collectionsTabRect.left - spotPad,
                  top: collectionsTabRect.top - spotPad,
                  width: collectionsTabRect.right - collectionsTabRect.left + spotPad * 2,
                  height: collectionsTabRect.bottom - collectionsTabRect.top + spotPad * 2,
                  borderRadius: 10,
                  border: '2px dashed rgba(139,92,246,0.3)',
                  boxShadow: '0 0 6px rgba(139,92,246,0.1)',
                }}
              />
              <div
                className="fixed z-[9996] pointer-events-none flex flex-col items-center justify-end"
                style={{
                  left: collectionsTabRect.left + collectionsTabRect.width / 2 - 12,
                  top: collectionsTabRect.top - spotPad - 94,
                  width: 24,
                  height: 90,
                }}
              >
                <div className="absolute bottom-[28px] left-2 w-[160px] bg-white/95 border border-violet-100 rounded-xl px-3 py-1.5 shadow-md backdrop-blur-sm text-center">
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">
                    Raggruppa e organizza più scacchiere in Collezioni
                  </p>
                </div>
                <div className="animate-bounce flex flex-col items-center mt-auto w-full">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-violet-500/80 drop-shadow-sm">
                    <path d="M11.5 4 C 11.5 8, 12 13, 14 17 M8 13 L14 17 L18 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </>
          )}
        </>
      )}
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

  const getNextValidStepIndex = (steps: TourStep[], startIndex: number): number => {
    let idx = startIndex;
    while (idx < steps.length) {
      const step = steps[idx];
      if (step.skipIfNotFound && !document.querySelector(step.target)) {
        idx++;
      } else {
        break;
      }
    }
    return idx;
  };

  const startForCurrentPage = (steps: TourStep[], startIdx = 0) => {
    setCurrentSteps(steps);
    setStepIndex(startIdx);
    setActive(true);
  };

  // Auto-skip steps whose target is not found, but only if the page base elements (like .tour-create-set-card) are loaded
  useEffect(() => {
    if (!active || !currentSteps.length) return;
    const step = currentSteps[stepIndex];
    if (step?.skipIfNotFound) {
      const baseLoaded = document.querySelector('.tour-create-set-card');
      if (baseLoaded) {
        const el = document.querySelector(step.target);
        if (!el) {
          // Skip to next step using our skip helper
          const nextIdx = getNextValidStepIndex(currentSteps, stepIndex + 1);
          if (nextIdx >= currentSteps.length) {
            finish();
          } else {
            setStepIndex(nextIdx);
            localStorage.setItem('chess3d_current_step', nextIdx.toString());
          }
        }
      }
    }
  }, [active, stepIndex, currentSteps, location.pathname]);

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
      let steps = getStepsForPath(location.pathname);
      if (location.pathname === '/' && document.querySelector('.tour-create-collection-card')) {
        steps = COLLECTIONS_STEPS;
      }
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

      // Tab switcher interactions
      if (el.closest('.tour-tab-collections')) {
        setCurrentSteps(COLLECTIONS_STEPS);
        setStepIndex(0);
        localStorage.setItem('chess3d_current_step', '0');
        return;
      }

      if (el.closest('.tour-tab-sets')) {
        setCurrentSteps(DASHBOARD_STEPS);
        setStepIndex(0);
        localStorage.setItem('chess3d_current_step', '0');
        return;
      }

      // First step options handling (if on dashboard, at create set card step)
      if (step.target === '.tour-create-set-card') {
        const ClickedCard = el.closest('.tour-create-set-card');
        const ClickedExisting = el.closest('.tour-existing-set-card');
        const ClickedPlay = el.closest('.tour-play-1v1-card');
        const ClickedImport = el.closest('.tour-import-set-card');

        if (ClickedCard) {
          setTimeout(() => {
            const nextIdx = stepIndex + 1;
            setStepIndex(nextIdx);
            localStorage.setItem('chess3d_current_step', nextIdx.toString());
          }, 300);
          return;
        }

        if (ClickedExisting) {
          // Navigates to existing set page. Prepare the tutorial to start at set detail stage.
          localStorage.setItem('chess3d_current_step', DASHBOARD_STEPS.length.toString());
          setActive(false);
          return;
        }

        if (ClickedPlay) {
          // Play local game -> Complete tutorial since it's an end state for onboarding
          finish();
          return;
        }

        if (ClickedImport) {
          // Import ZIP -> Complete tutorial
          finish();
          return;
        }
      }

      // First step option handling for collections
      if (step.target === '.tour-create-collection-card') {
        const ClickedCard = el.closest('.tour-create-collection-card');
        if (ClickedCard) {
          setTimeout(() => {
            const nextIdx = stepIndex + 1;
            setStepIndex(nextIdx);
            localStorage.setItem('chess3d_current_step', nextIdx.toString());
          }, 300);
          return;
        }
      }

      // Name step: clicking directly in description field advances to description step
      if (step.target === '.tour-set-name-input' && el.closest('.tour-set-desc-input')) {
        const nextIdx = stepIndex + 1;
        setStepIndex(nextIdx);
        localStorage.setItem('chess3d_current_step', nextIdx.toString());
      }

      // Name step for collections: clicking directly in description field advances to description step
      if (step.target === '.tour-coll-name-input' && el.closest('.tour-coll-desc-input')) {
        const nextIdx = stepIndex + 1;
        setStepIndex(nextIdx);
        localStorage.setItem('chess3d_current_step', nextIdx.toString());
      }

      // Description step: clicking "Crea Set" -> submit + navigate to set detail
      if (step.target === '.tour-set-desc-input' && el.closest('.tour-create-set-submit')) {
        localStorage.setItem('chess3d_current_step', DASHBOARD_STEPS.length.toString());
        setActive(false);
      }

      // Description step for collections: clicking "Crea Collezione" submit button -> finishes tutorial
      if (step.target === '.tour-coll-desc-input' && el.closest('.tour-create-coll-submit')) {
        finish();
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
        const nextIdx = getNextValidStepIndex(currentSteps, stepIndex + 1);
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
