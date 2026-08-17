// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  flip,
  shift,
  offset,
  autoUpdate,
  computePosition,
  type Placement
} from '@floating-ui/dom';

export function placeNear(node: HTMLElement, o: PlaceOption) {
  let cleanup: (() => void) | undefined;
  let recentOpts = o;

  function callAutoUpdate(oo: PlaceOption) {
    recentOpts = oo;
    cleanup = oo.ref
      ? autoUpdate(oo.ref, node, () => place(node, recentOpts))
      : undefined;
  }

  callAutoUpdate(o);

  return {
    update(newO: PlaceOption) {
      cleanup?.();
      callAutoUpdate(newO);
    },

    destroy() {
      cleanup?.();
    }
  };
}

export function portal(
  node: HTMLElement,
  target: HTMLElement | string = 'body'
) {
  let targetEl: HTMLElement;

  function resolveTarget(target: HTMLElement | string): HTMLElement {
    if (typeof target === 'string') {
      const el = document.querySelector<HTMLElement>(target);
      if (!el) {
        throw new Error(`Portal target not found: ${target}`);
      }

      return el;
    }

    return target;
  }

  function move(target: HTMLElement | string) {
    const el = resolveTarget(target);

    if (el !== targetEl) {
      targetEl = el;
      targetEl.appendChild(node);
    }
  }

  move(target);

  return {
    update: move,
    destroy() {
      node.remove();
    }
  };
}

export function clickOutside(el: HTMLElement, cb: (ev: MouseEvent) => void) {
  function onclick(ev: MouseEvent) {
    const target = ev.target;
    if (el && target instanceof Node && !el.contains(target)) {
      cb(ev);
    }
  }

  document.addEventListener('click', onclick, true);

  return {
    destroy() {
      document.removeEventListener('click', onclick, true);
    }
  };
}

export function tooltip(node: HTMLElement, options: TooltipOptions) {
  let opts = options;
  let tooltipEl: HTMLElement | null = null;
  let showTimer: ReturnType<typeof setTimeout> | null = null;

  function show() {
    showTimer = setTimeout(() => {
      tooltipEl = document.createElement('div');
      tooltipEl.classList.add('qt-tooltip');
      tooltipEl.textContent = opts.text;
      document.body.appendChild(tooltipEl);

      place(tooltipEl, {
        ref: node,
        width: options.width,
        offset: options.offset,
        placement: options.placement
      });
    }, opts.delay ?? 400);
  }

  function hide() {
    if (showTimer) {
      clearTimeout(showTimer);
    }

    tooltipEl?.remove();
    tooltipEl = null;
  }

  node.addEventListener('mouseenter', show);
  node.addEventListener('mouseleave', hide);
  node.addEventListener('focus', show);
  node.addEventListener('blur', hide);

  return {
    update(newOptions: TooltipOptions) {
      opts = newOptions;
    },

    destroy() {
      hide();
      node.removeEventListener('mouseenter', show);
      node.removeEventListener('mouseleave', hide);
      node.removeEventListener('focus', show);
      node.removeEventListener('blur', hide);
    }
  };
}

// helpers
interface PlaceOption {
  ref?: HTMLElement;
  width?: 'full' | number;
  offset?: number;
  placement?: Placement;
}

interface TooltipOptions extends Omit<PlaceOption, 'ref'> {
  text: string;
  delay?: number;
}

async function place(node: HTMLElement, o: PlaceOption) {
  if (!o.ref) {
    return;
  }

  if (o.width) {
    const rr = o.ref.getBoundingClientRect();
    node.style.width = `${o.width === 'full' ? rr.width : o.width}px`;
  }

  const { x, y } = await computePosition(o.ref, node, {
    placement: o.placement ?? 'bottom-start',
    middleware: [offset(o.offset ?? 3), flip(), shift({ padding: 8 })]
  });

  Object.assign(node.style, {
    top: `${y}px`,
    left: `${x}px`
  });
}
