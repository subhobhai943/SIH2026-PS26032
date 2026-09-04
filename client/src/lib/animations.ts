'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Checks if user prefers reduced motion for accessibility.
 * Defensively guarded against missing matchMedia (older browsers, webviews, headless).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      return Boolean(mq && mq.matches);
    }
  } catch {
    // Return false if matchMedia fails or throws
  }
  return false;
}

/**
 * Reusable React Hook for GSAP animations with automatic context cleanup
 * Safely wraps execution and revert in try/catch to prevent React unmount crashes.
 */
export function useGsapContext(
  animationCallback: (ctx: gsap.Context) => void,
  deps: React.DependencyList = []
) {
  const scopeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || prefersReducedMotion()) return;

    let ctx: gsap.Context | null = null;
    try {
      ctx = gsap.context(() => {
        try {
          animationCallback(ctx!);
        } catch (err) {
          console.warn('GSAP animationCallback error:', err);
        }
      }, scopeRef.current || undefined);
    } catch (err) {
      console.warn('GSAP context creation error:', err);
    }

    return () => {
      try {
        ctx?.revert();
      } catch (err) {
        console.warn('GSAP context revert error:', err);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scopeRef;
}

/**
 * Staggered fade-up animation for text, cards, and grid items
 */
export function animateFadeInUp(
  targets: gsap.DOMTarget,
  vars: gsap.TweenVars = {}
) {
  if (typeof window === 'undefined' || prefersReducedMotion() || !targets) return;

  try {
    return gsap.from(targets, {
      y: 28,
      opacity: 0,
      duration: 0.65,
      ease: 'power3.out',
      stagger: 0.08,
      clearProps: 'transform,opacity',
      ...vars,
    });
  } catch (err) {
    console.warn('GSAP animateFadeInUp skipped:', err);
  }
}

/**
 * Smooth pop-scale entrance for badges, buttons, and tokens
 */
export function animatePop(
  targets: gsap.DOMTarget,
  vars: gsap.TweenVars = {}
) {
  if (typeof window === 'undefined' || prefersReducedMotion() || !targets) return;

  try {
    return gsap.from(targets, {
      scale: 0.88,
      opacity: 0,
      duration: 0.5,
      ease: 'back.out(1.5)',
      clearProps: 'transform,opacity',
      ...vars,
    });
  } catch (err) {
    console.warn('GSAP animatePop skipped:', err);
  }
}

/**
 * Smooth entrance animation for modals/dialogs and bottom sheets
 */
export function animateModalEnter(
  backdropEl: HTMLElement | null,
  contentEl: HTMLElement | null,
  isMobileBottomSheet: boolean = false,
  onComplete?: () => void
) {
  if (typeof window === 'undefined' || prefersReducedMotion() || (!backdropEl && !contentEl)) {
    onComplete?.();
    return;
  }

  try {
    const tl = gsap.timeline({ onComplete });

    if (backdropEl) {
      tl.fromTo(
        backdropEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.25, ease: 'power2.out' },
        0
      );
    }

    if (contentEl) {
      if (isMobileBottomSheet) {
        tl.fromTo(
          contentEl,
          { y: '100%', opacity: 0.8 },
          { y: '0%', opacity: 1, duration: 0.35, ease: 'power3.out' },
          0.05
        );
      } else {
        tl.fromTo(
          contentEl,
          { scale: 0.94, opacity: 0, y: 16 },
          { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.4)' },
          0.05
        );
      }
    }

    return tl;
  } catch (err) {
    console.warn('GSAP animateModalEnter fallback:', err);
    onComplete?.();
  }
}

/**
 * Smooth exit animation for modals/dialogs
 */
export function animateModalExit(
  backdropEl: HTMLElement | null,
  contentEl: HTMLElement | null,
  isMobileBottomSheet: boolean = false,
  onComplete?: () => void
) {
  if (typeof window === 'undefined' || prefersReducedMotion() || (!backdropEl && !contentEl)) {
    onComplete?.();
    return;
  }

  try {
    const tl = gsap.timeline({ onComplete });

    if (contentEl) {
      if (isMobileBottomSheet) {
        tl.to(contentEl, { y: '100%', opacity: 0.5, duration: 0.25, ease: 'power2.in' }, 0);
      } else {
        tl.to(contentEl, { scale: 0.95, opacity: 0, y: 12, duration: 0.2, ease: 'power2.in' }, 0);
      }
    }

    if (backdropEl) {
      tl.to(backdropEl, { opacity: 0, duration: 0.2, ease: 'power2.in' }, 0.05);
    }

    return tl;
  } catch (err) {
    console.warn('GSAP animateModalExit fallback:', err);
    onComplete?.();
  }
}

/**
 * Subtle breathing pulse animation for live counters and active status badges
 */
export function animatePulse(target: gsap.DOMTarget) {
  if (typeof window === 'undefined' || prefersReducedMotion() || !target) return;

  try {
    return gsap.to(target, {
      scale: 1.05,
      repeat: -1,
      yoyo: true,
      duration: 1.2,
      ease: 'sine.inOut',
    });
  } catch (err) {
    console.warn('GSAP animatePulse skipped:', err);
  }
}
