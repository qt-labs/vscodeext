// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { type ReferenceElement } from '@floating-ui/dom';

function createPopoverBase() {
  let _visible = $state(false);
  let _refEl = $state<ReferenceElement>();

  function _setVisible(visible: boolean) {
    if (_visible !== visible) {
      _visible = visible;

      if (_refEl === undefined && _visible) {
        console.warn("Invalid reference element while make it visible");
      }
    }
  }

  return {
    get visible() { return _visible; },
    set visible(v) { _setVisible(v); },
    get refEl() { return _refEl; },
    set refEl(el) { _refEl = el; },

    show: () => { _setVisible(true); },
    hide: () => { _setVisible(false); },
    toggle: () => { _setVisible(!_visible); }
  };
}

export type PopoverControllerBase = ReturnType<typeof createPopoverBase>;

export function createPopoverController<T extends object>(extra?: T) {
  const c = createPopoverBase();
  if (!extra) {
    return c as (typeof c & T);
  }

  return Object.defineProperties(
    c,
    Object.getOwnPropertyDescriptors(extra)
  ) as (typeof c & T);
}
