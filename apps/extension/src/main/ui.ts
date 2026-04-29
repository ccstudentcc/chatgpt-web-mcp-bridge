import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import type {
  WorkSurfaceActionRequest,
  WorkSurfaceSnapshot
} from '../operator-workflows/index.js';
import { state, togglePanelCollapsed, savePanelPosition, savePanelSize, type PanelSize } from './state.js';
import { EXTENSION_MESSAGE_TYPES } from '../extension-shell/messages.js';
import { FloatingPanelSurface } from '../ui-surfaces/work-surface-app.js';

let root: HTMLDivElement | null = null;
let mountTarget: HTMLElement | ShadowRoot | null = null;
let dragState: { pointerId: number; offsetX: number; offsetY: number } | null = null;
let resizeState: { pointerId: number; originX: number; originY: number; startWidth: number; startHeight: number } | null = null;
let reactRoot: Root | null = null;
let lastSnapshot: WorkSurfaceSnapshot | null = null;
let uiActionRunner: ((action: WorkSurfaceActionRequest) => Promise<void> | void) | null = null;
const MIN_PANEL_WIDTH = 360;
const MAX_PANEL_WIDTH = 720;
const MIN_PANEL_HEIGHT = 260;
const MAX_PANEL_HEIGHT = 860;

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
    onOpenOptions: () => {
      void chrome.runtime.sendMessage({ type: EXTENSION_MESSAGE_TYPES.openOptionsPage });
    },
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
    'top: 18vh',
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

  const size = getEffectivePanelSize();
  root.style.width = `${size.width}px`;
  root.style.height = state.panelCollapsed ? 'auto' : `${size.height}px`;
  root.style.maxWidth = `${Math.max(MIN_PANEL_WIDTH, window.innerWidth - 24)}px`;
  root.style.maxHeight = state.panelCollapsed ? 'none' : `${Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, window.innerHeight - 24))}px`;
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
  const resizeHandle = target.closest('[data-cwmb-resize-handle="true"]');
  if (resizeHandle) {
    const rect = root.getBoundingClientRect();
    resizeState = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height
    };
    event.preventDefault();
    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', stopResize);
    document.addEventListener('pointercancel', stopResize);
    return;
  }
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

function onResizeMove(event: PointerEvent): void {
  if (!root || !resizeState || event.pointerId !== resizeState.pointerId) {
    return;
  }

  const nextSize = clampPanelSize({
    width: resizeState.startWidth + (event.clientX - resizeState.originX),
    height: resizeState.startHeight + (event.clientY - resizeState.originY)
  });
  root.style.width = `${nextSize.width}px`;
  root.style.height = state.panelCollapsed ? 'auto' : `${nextSize.height}px`;
  savePanelSize(nextSize);
  applyPanelPosition();
  if (lastSnapshot) {
    lastSnapshot.panelSize = nextSize;
  }
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

function stopResize(event: PointerEvent): void {
  if (!resizeState || event.pointerId !== resizeState.pointerId) {
    return;
  }

  resizeState = null;
  document.removeEventListener('pointermove', onResizeMove);
  document.removeEventListener('pointerup', stopResize);
  document.removeEventListener('pointercancel', stopResize);
}

function applyPanelPosition(): void {
  if (!root) {
    return;
  }

  const defaultRightOffset = 12;
  const defaultTop = Math.max(12, Math.round(window.innerHeight * 0.18));
  if (!state.panelPosition) {
    root.style.right = `${defaultRightOffset}px`;
    root.style.top = `${defaultTop}px`;
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
  const size = getEffectivePanelSize();
  const width = root?.offsetWidth ?? size.width;
  const height = root?.offsetHeight ?? (state.panelCollapsed ? 320 : size.height);
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop)
  };
}

function getEffectivePanelSize(): PanelSize {
  return clampPanelSize(state.panelSize ?? {
    width: 460,
    height: 640
  });
}

function clampPanelSize(size: PanelSize): PanelSize {
  return {
    width: Math.min(
      Math.max(MIN_PANEL_WIDTH, Math.round(size.width)),
      Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, window.innerWidth - 24))
    ),
    height: Math.min(
      Math.max(MIN_PANEL_HEIGHT, Math.round(size.height)),
      Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, window.innerHeight - 24))
    )
  };
}
