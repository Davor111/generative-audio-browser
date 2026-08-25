import type { LineState } from '../types';
import { DOM } from './state';

export interface Point {
  x: number;
  y: number;
}

export function getCenter(el: HTMLElement): Point {
  return {
    x: parseFloat(el.style.left),
    y: parseFloat(el.style.top),
  };
}

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

interface DraggableOptions {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onErase?: () => void;
  /** Fires on a press-and-release that didn't move and didn't erase. */
  onTap?: () => void;
}

/** Slop below which a pointer press still counts as a tap, not a drag. */
const TAP_SLOP_PX = 4;

function isOverEraseZone(clientX: number, clientY: number): boolean {
  const rect = DOM.eraseZone.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return distance({ x: clientX, y: clientY }, { x: cx, y: cy }) <= rect.width / 2;
}

export function makeDraggable(el: HTMLElement, { onDragStart, onDragEnd, onErase, onTap }: DraggableOptions = {}): void {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let overEraseZone = false;
  let pressX = 0;
  let pressY = 0;
  let moved = false;

  el.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    pressX = e.clientX;
    pressY = e.clientY;
    el.classList.add('is-dragging');
    el.setPointerCapture(e.pointerId);

    const canvasRect = DOM.canvas.getBoundingClientRect();
    const currentX = parseFloat(el.style.left) || (e.clientX - canvasRect.left);
    const currentY = parseFloat(el.style.top) || (e.clientY - canvasRect.top);

    offsetX = (e.clientX - canvasRect.left) - currentX;
    offsetY = (e.clientY - canvasRect.top) - currentY;

    DOM.eraseZone.classList.add('visible');

    if (onDragStart) onDragStart();
  });

  el.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return;
    if (!moved && distance({ x: e.clientX, y: e.clientY }, { x: pressX, y: pressY }) > TAP_SLOP_PX) {
      moved = true;
    }
    const canvasRect = DOM.canvas.getBoundingClientRect();
    let newX = (e.clientX - canvasRect.left) - offsetX;
    let newY = (e.clientY - canvasRect.top) - offsetY;

    newX = Math.max(30, Math.min(canvasRect.width - 30, newX));
    newY = Math.max(30, Math.min(canvasRect.height - 30, newY));
    el.style.left = `${newX}px`;
    el.style.top = `${newY}px`;

    overEraseZone = isOverEraseZone(e.clientX, e.clientY);
    DOM.eraseZone.classList.toggle('armed', overEraseZone);
  });

  const stop = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    if (e && e.pointerId && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }

    DOM.eraseZone.classList.remove('visible', 'armed');

    const shouldErase = overEraseZone;
    overEraseZone = false;

    if (shouldErase && onErase) {
      onErase();
      return;
    }

    // A press that never moved is a tap, not a drag — that's what plays a note
    // on a generator with autoplay switched off.
    if (!moved && onTap) onTap();

    if (onDragEnd) onDragEnd();
  };

  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
}

/**
 * Mirrors a Line's angle and length onto the CSS custom properties that draw
 * its rail — the same keep-JS-and-CSS-in-sync rule the radius constants follow.
 * Lives here rather than in elements.ts so line-editor.ts can call it without
 * creating an import cycle.
 */
export function applyLineVisuals(line: LineState): void {
  line.el.style.setProperty('--line-angle', `${line.angle}deg`);
  line.el.style.setProperty('--line-length', `${line.length}px`);
}
