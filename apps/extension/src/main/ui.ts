import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import type {
  WorkSurfaceActionRequest,
  WorkSurfaceSnapshot
} from '../operator-workflows/index.js';
import { state, togglePanelCollapsed, savePanelPosition } from './state.js';
import { FloatingPanelSurface } from '../ui-surfaces/work-surface-app.js';

let root: HTMLDivElement | null = null;
let mountTarget: HTMLElement | ShadowRoot | null = null;
let dragState: { pointerId: number; offsetX: number; offsetY: number } | null = null;
let reactRoot: Root | null = null;
let lastSnapshot: WorkSurfaceSnapshot | null = null;
let uiActionRunner: ((action: WorkSurfaceActionRequest) => Promise<void> | void) | null = null;

export function setUiActionRunner(
  runner: (action: WorkSurfaceActionRequest) => Promise<void> | void
): void {
  uiActionRunner = runner;
}

export function configureUiMountTarget(target: HTMLElement | ShadowRoot | null | undefined): void {
  mountTarget = target ?? null;
  if (root && mountTarget && root.parentNode !== mountTarget) {
    mountTarget.appendChild(root);
  }
}

export function renderFloatingPanel(snapshot: WorkSurfaceSnapshot): void {
  lastSnapshot = snapshot;
  ensureRoot();
  applyPanelPosition();
  applyPanelSize();

  reactRoot!.render(createElement(FloatingPanelSurface, {
    collapsed: state.panelCollapsed,
    host: 'floating_panel',
    onAction: (action: WorkSurfaceActionRequest) => uiActionRunner?.(action),
    onOpenOptions: () => chrome.runtime.openOptionsPage(),
    onToggleCollapsed: () => {
      togglePanelCollapsed();
      if (lastSnapshot) {
        renderFloatingPanel(lastSnapshot);
      }
    },
    snapshot
  }));
}

export function clearFloatingPanel(): void {
  if (!root) {
    return;
  }

  reactRoot?.unmount();
  reactRoot = null;
  root.removeEventListener('pointerdown', handleRootPointerDown);
  root.remove();
  root = null;
  dragState = null;
  lastSnapshot = null;
}

function ensureRoot(): void {
  if (root) {
    return;
  }

  root = document.createElement('div');
  root.id = 'cwmb-panel';
  root.style.cssText = [
    'position: fixed',
    'right: 12px',
    'top: 12px',
    'z-index: 2147483647',
    'overflow: visible',
    'background: transparent'
  ].join(';');
  root.addEventListener('pointerdown', handleRootPointerDown);
  (mountTarget ?? document.body).appendChild(root);
  reactRoot = createRoot(root);
}

function applyPanelSize(): void {
  if (!root) {
    return;
  }

  root.style.width = state.panelCollapsed ? 'min(360px, calc(100vw - 24px))' : 'min(460px, calc(100vw - 24px))';
  root.style.maxHeight = state.panelCollapsed ? 'none' : 'min(84vh, 860px)';
  root.style.overflow = state.panelCollapsed ? 'visible' : 'auto';
  root.style.overscrollBehavior = 'contain';
}

function handleRootPointerDown(event: PointerEvent): void {
  if (!root || event.button !== 0) {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const dragHandle = target.closest('[data-cwmb-drag-handle="true"]');
  if (!dragHandle) {
    return;
  }

  const interactive = target.closest('button, input, textarea, select, summary, a');
  if (interactive && interactive !== dragHandle) {
    return;
  }

  const rect = root.getBoundingClientRect();
  dragState = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  event.preventDefault();
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', stopDrag);
  document.addEventListener('pointercancel', stopDrag);
}

function onDragMove(event: PointerEvent): void {
  if (!root || !dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  const clamped = clampPanelPosition(
    event.clientX - dragState.offsetX,
    event.clientY - dragState.offsetY
  );
  root.style.left = `${clamped.left}px`;
  root.style.top = `${clamped.top}px`;
  root.style.right = 'auto';
  savePanelPosition(clamped);
}

function stopDrag(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  dragState = null;
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', stopDrag);
  document.removeEventListener('pointercancel', stopDrag);
}

function applyPanelPosition(): void {
  if (!root) {
    return;
  }

  const defaultOffset = 12;
  if (!state.panelPosition) {
    root.style.right = `${defaultOffset}px`;
    root.style.top = `${defaultOffset}px`;
    root.style.left = 'auto';
    return;
  }

  const clamped = clampPanelPosition(state.panelPosition.left, state.panelPosition.top);
  root.style.left = `${clamped.left}px`;
  root.style.top = `${clamped.top}px`;
  root.style.right = 'auto';
  if (clamped.left !== state.panelPosition.left || clamped.top !== state.panelPosition.top) {
    savePanelPosition(clamped);
  }
}

function clampPanelPosition(left: number, top: number): { left: number; top: number } {
  const margin = 8;
  const width = root?.offsetWidth ?? 460;
  const height = root?.offsetHeight ?? 320;
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop)
  };
}
