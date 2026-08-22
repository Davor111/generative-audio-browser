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
}

export function makeDraggable(el: HTMLElement, { onDragStart, onDragEnd }: DraggableOptions = {}): void {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  el.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    el.classList.add('is-dragging');
    el.setPointerCapture(e.pointerId);

    const canvasRect = DOM.canvas.getBoundingClientRect();
    const currentX = parseFloat(el.style.left) || (e.clientX - canvasRect.left);
    const currentY = parseFloat(el.style.top) || (e.clientY - canvasRect.top);

    offsetX = (e.clientX - canvasRect.left) - currentX;
    offsetY = (e.clientY - canvasRect.top) - currentY;

    if (onDragStart) onDragStart();
  });

  el.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return;
    const canvasRect = DOM.canvas.getBoundingClientRect();
    let newX = (e.clientX - canvasRect.left) - offsetX;
    let newY = (e.clientY - canvasRect.top) - offsetY;

    newX = Math.max(30, Math.min(canvasRect.width - 30, newX));
    newY = Math.max(30, Math.min(canvasRect.height - 30, newY));
    el.style.left = `${newX}px`;
    el.style.top = `${newY}px`;
  });

  const stop = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    if (e && e.pointerId && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    if (onDragEnd) onDragEnd();
  };

  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
}
