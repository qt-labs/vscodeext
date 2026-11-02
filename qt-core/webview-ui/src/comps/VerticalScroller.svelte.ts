// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

const ScrollToTopDuration_ms = 150;
const ScrollToTopThresholdPx = 200;

export interface ScrollToTopOption {
  mode: 'instant' | 'smooth'
}

export const ScrollToTopOptionDefault: ScrollToTopOption = {
  mode: 'smooth'
};

export function createVerticalScroller() {
  let targetEl: HTMLElement | undefined;
  let animationId: number | undefined;
  let scrolledEnough = $state(false);

  function attach(rootEl: HTMLElement) {
    function onScroll(e: Event) {
      const el = e.target;
      if (!(el instanceof HTMLElement) || el.parentElement !== rootEl) {
        return;
      }

      targetEl = el;
      scrolledEnough = el.scrollTop > ScrollToTopThresholdPx;
    }

    rootEl.addEventListener('scroll', onScroll, true);

    return {
      destroy() {
        cancelAnimation();
        rootEl.removeEventListener('scroll', onScroll, true);
        targetEl = undefined;
        scrolledEnough = false;
      }
    };
  }

  function scrollToTop(o = ScrollToTopOptionDefault) {
    if (!targetEl?.isConnected) {
      return;
    }

    cancelAnimation();

    if (o.mode === 'instant') {
      targetEl.scrollTop = 0;
      return;
    }

    const el = targetEl;
    const initTop = el.scrollTop;
    const initTime = performance.now();

    function animate(now: number) {
      const frame = calcAnimationFrame(now, initTop, initTime);
      el.scrollTop = frame.top;
      animationId = frame.finished ? undefined : requestAnimationFrame(animate);
    }

    animationId = requestAnimationFrame(animate);
  }

  function cancelAnimation() {
    if (animationId !== undefined) {
      cancelAnimationFrame(animationId);
      animationId = undefined;
    }
  }

  return {
    get scrolledEnough() {
      return scrolledEnough && !!targetEl?.isConnected;
    },

    attach,
    scrollToTop
  };
}

function calcAnimationFrame(now: number, initY: number, initTime: number) {
  const progress = Math.min((now - initTime) / ScrollToTopDuration_ms, 1);
  const easedProgress = 1 - (1 - progress) ** 3;

  return {
    top: initY * (1 - easedProgress),
    finished: progress >= 1
  };
}
