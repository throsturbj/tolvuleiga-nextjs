"use client";

import { useEffect } from "react";

// Stores the scroll position while locked to restore on unlock
let lockedScrollTop = 0;

function lockBodyScroll(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const body = document.body;
  if (body.dataset.scrollLocked === "true") return;

  lockedScrollTop = window.scrollY || window.pageYOffset;
  // Prevent root scrolling as well
  const html = document.documentElement;
  html.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${lockedScrollTop}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflowY = "scroll"; // maintain scrollbar to avoid layout shift
  body.dataset.scrollLocked = "true";
}

function unlockBodyScroll(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const body = document.body;
  if (body.dataset.scrollLocked !== "true") return;

  const html = document.documentElement;
  html.style.overflow = "";
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  body.style.overflowY = "";
  body.dataset.scrollLocked = "false";
  window.scrollTo(0, lockedScrollTop);
}

function hasAnyOpenModal(): boolean {
  if (typeof document === "undefined") return false;

  // Common selectors across libraries and native dialogs
  const openModalSelectors = [
    'dialog[open]',
    '[aria-modal="true"]',
    '[role="dialog"]:not([aria-hidden="true"])',
    '.MuiModal-root.MuiModal-open',
    '.ReactModal__Overlay--after-open',
    '.DialogOverlay[data-state="open"]',
    '.radix-DialogContent[data-state="open"]',
    '.modal.is-active',
    '.modal[open]'
  ].join(",");

  // Some libraries toggle a class on body itself when open
  const bodyHasOpenClass = document.body.classList.contains("ReactModal__Body--open")
    || document.body.classList.contains("modal-open");

  if (bodyHasOpenClass) return true;

  const candidates = document.querySelectorAll<HTMLElement>(openModalSelectors);
  for (const el of Array.from(candidates)) {
    const style = window.getComputedStyle(el);
    if (style.visibility !== "hidden" && style.display !== "none") {
      return true;
    }
  }

  // Heuristic: detect full-screen fixed overlays (e.g., Tailwind `fixed inset-0`)
  const allElements = document.body.getElementsByTagName("*");
  for (const el of Array.from(allElements) as HTMLElement[]) {
    const style = window.getComputedStyle(el);
    if (style.position !== "fixed") continue;
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity || "1") === 0) continue;

    const rect = el.getBoundingClientRect();
    const coversWidth = rect.width >= window.innerWidth * 0.98;
    const coversHeight = rect.height >= window.innerHeight * 0.98;
    const likelyOnTop = (() => {
      const z = parseInt(style.zIndex || "0", 10);
      // Tailwind z-10+ is commonly used for overlays; accept >= 10
      return Number.isFinite(z) ? z >= 10 : true;
    })();

    if (coversWidth && coversHeight && likelyOnTop) {
      return true;
    }
  }
  return false;
}

export default function BodyScrollLock(): null {
  useEffect(() => {
    // Initial check in case a modal is already open
    if (hasAnyOpenModal()) {
      lockBodyScroll();
    }

    const observer = new MutationObserver(() => {
      if (hasAnyOpenModal()) {
        lockBodyScroll();
      } else {
        unlockBodyScroll();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "aria-hidden", "aria-modal", "class", "style", "data-state"],
    });

    // Also listen for class changes on body specifically (some libs only touch body)
    const bodyClassObserver = new MutationObserver(() => {
      if (hasAnyOpenModal()) {
        lockBodyScroll();
      } else {
        unlockBodyScroll();
      }
    });
    bodyClassObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      bodyClassObserver.disconnect();
      unlockBodyScroll();
    };
  }, []);

  return null;
}


