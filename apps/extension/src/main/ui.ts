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
let resizeState: {
  pointerId: number;
  edge: ResizeEdge;
  originX: number;
  originY: number;
  startWidth: number;
  startHeight: number;
} | null = null;
let reactRoot: Root | null = null;
let lastSnapshot: WorkSurfaceSnapshot | null = null;
let uiActionRunner: ((action: WorkSurfaceActionRequest) => Promise<void> | void) | null = null;
const MIN_PANEL_WIDTH = 360;
const MAX_PANEL_WIDTH = 720;
const MIN_COLLAPSED_PANEL_HEIGHT = 160;
const MIN_PANEL_HEIGHT = 260;
const MAX_PANEL_HEIGHT = 860;
const RESIZE_EDGE_HIT_SIZE = 10;
const DEFAULT_COLLAPSED_PANEL_SIZE: PanelSize = {
  width: 460,
  height: 180
};
const DEFAULT_EXPANDED_PANEL_SIZE: PanelSize = {
  width: 460,
  height: 640
};

type ResizeEdge = 'bottom' | 'corner' | 'right';

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
  root.removeEventListener('pointermove', handleRootPointerMove);
  root.removeEventListener('pointerleave', handleRootPointerLeave);
  root.remove();
  root = null;
  dragState = null;
  resizeState = null;
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
  root.addEventListener('pointermove', handleRootPointerMove);
  root.addEventListener('pointerleave', handleRootPointerLeave);
  (mountTarget ?? document.body).appendChild(root);
  reactRoot = createRoot(root);
}

function applyPanelSize(): void {
  if (!root) {
    return;
  }

  const size = getEffectivePanelSize();
  root.style.width = `${size.width}px`;
  root.style.height = shouldUseAutoCollapsedHeight() ? 'auto' : `${size.height}px`;
  root.style.maxWidth = `${Math.max(MIN_PANEL_WIDTH, window.innerWidth - 24)}px`;
  root.style.maxHeight = `${getPanelHeightBounds().max}px`;
  root.style.overflow = state.panelCollapsed ? 'visible' : 'hidden';
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
  const resizeEdge = getResizeEdge(event);
  if (resizeEdge) {
    const rect = root.getBoundingClientRect();
    resizeState = {
      edge: resizeEdge,
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

function handleRootPointerMove(event: PointerEvent): void {
  if (!root || dragState || resizeState) {
    return;
  }

  const edge = getResizeEdge(event);
  root.style.cursor = edge === 'corner'
    ? 'nwse-resize'
    : edge === 'right'
      ? 'ew-resize'
      : edge === 'bottom'
        ? 'ns-resize'
        : '';
}

function handleRootPointerLeave(): void {
  if (!root || dragState || resizeState) {
    return;
  }

  root.style.cursor = '';
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
    width: resizeState.edge === 'right' || resizeState.edge === 'corner'
      ? resizeState.startWidth + (event.clientX - resizeState.originX)
      : resizeState.startWidth,
    height: resizeState.edge === 'bottom' || resizeState.edge === 'corner'
      ? resizeState.startHeight + (event.clientY - resizeState.originY)
      : resizeState.startHeight
  });
  root.style.width = `${nextSize.width}px`;
  root.style.height = `${nextSize.height}px`;
  root.style.cursor = resizeState.edge === 'corner'
    ? 'nwse-resize'
    : resizeState.edge === 'right'
      ? 'ew-resize'
      : 'ns-resize';
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
  if (!root || !resizeState || event.pointerId !== resizeState.pointerId) {
    return;
  }

  resizeState = null;
  root.style.cursor = '';
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
  const height = root?.offsetHeight ?? (shouldUseAutoCollapsedHeight() ? 320 : size.height);
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop)
  };
}

function getEffectivePanelSize(): PanelSize {
  return clampPanelSize(
    state.panelSize ?? (state.panelCollapsed ? DEFAULT_COLLAPSED_PANEL_SIZE : DEFAULT_EXPANDED_PANEL_SIZE)
  );
}

function shouldUseAutoCollapsedHeight(): boolean {
  return state.panelCollapsed && !state.panelCollapsedSize;
}

function getPanelHeightBounds(): { max: number; min: number } {
  const viewportMax = Math.max(
    state.panelCollapsed ? MIN_COLLAPSED_PANEL_HEIGHT : MIN_PANEL_HEIGHT,
    Math.min(MAX_PANEL_HEIGHT, window.innerHeight - 24)
  );
  return {
    min: state.panelCollapsed ? MIN_COLLAPSED_PANEL_HEIGHT : MIN_PANEL_HEIGHT,
    max: viewportMax
  };
}

function clampPanelSize(size: PanelSize): PanelSize {
  const heightBounds = getPanelHeightBounds();
  return {
    width: Math.min(
      Math.max(MIN_PANEL_WIDTH, Math.round(size.width)),
      Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, window.innerWidth - 24))
    ),
    height: Math.min(
      Math.max(heightBounds.min, Math.round(size.height)),
      heightBounds.max
    )
  };
}

function getResizeEdge(event: PointerEvent): ResizeEdge | null {
  if (!root) {
    return null;
  }

  const rect = root.getBoundingClientRect();
  const onRightEdge = event.clientX >= rect.right - RESIZE_EDGE_HIT_SIZE && event.clientX <= rect.right;
  const onBottomEdge = event.clientY >= rect.bottom - RESIZE_EDGE_HIT_SIZE && event.clientY <= rect.bottom;

  if (onRightEdge && onBottomEdge) {
    return 'corner';
  }
  if (onRightEdge) {
    return 'right';
  }
  if (onBottomEdge) {
    return 'bottom';
  }

  return null;
}
