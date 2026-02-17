// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import tinycolor from 'tinycolor2';

import type { FlamePalette, FlameCellPalette } from '../types.svelte';

type color = tinycolor.Instance;

const DefaultActiveCellPalette: FlameCellPalette = {
  normal: {
    foreground: "#ffffff",
    backgrounds: ["#1e3a8a", "#60a5fa"]
  },
  hover: {
    foreground: "#0f172a",
    background: "#93c5fd",
  },
  selected: {
    background: "#172554",
    foreground: "#ffffff",
  },
  highlighted: {
    foreground: "#0f172a",
    background: "#93c5fd",
  }
}

const DefaultInactiveCellPalette: FlameCellPalette = {
  normal: {
    foreground: "#8b8f95",
    backgrounds: ["#1f2933"]
  },
  hover: {
    foreground: "#4b5563",
    background: "#c7cdd8",
  },
  selected: {
    background: "#e5e7eb",
    foreground: "#111827",
  },
  highlighted: {
    background: "#e5e7eb",
    foreground: "#111827",
  }
}

export function createPaletteFromCss(css: CSSStyleDeclaration) {
  const primaryFg = css.getPropertyValue('--qt-primary-foreground').trim();
  const primaryBg = css.getPropertyValue('--qt-primary-background').trim();
  const primaryHoverBg = css.getPropertyValue('--qt-primary-hoverBackground').trim();
  const infoFg = css.getPropertyValue('--qt-info-foreground').trim();
  const infoBg = css.getPropertyValue('--qt-info-background').trim();

  // active
  const active = DefaultActiveCellPalette;
  active.normal = {
    ...active.normal,
    ...(primaryFg ? { foreground: primaryFg } : {}),
    ...(primaryBg ? { backgrounds: createGradientColors(primaryBg) } : {})
  };

  active.hover = {
    ...active.hover,
    ...(primaryFg ? { foreground: primaryFg } : {}),
    ...(primaryHoverBg ? { background: primaryHoverBg} : {})
  }

  active.selected = {
    ...active.selected,
    ...(infoFg ? { foreground: infoFg } : {}),
    ...(infoBg ? { background: infoBg } : {})
  }

  active.highlighted = active.hover;

  // inactive
  const inactive = DefaultInactiveCellPalette;
  const surfaceFg = css.getPropertyValue('--qt-surface-foreground').trim();
  const surfaceBg = css.getPropertyValue('--qt-surface-background').trim();

  inactive.normal = {
    ...inactive.normal,
    ...(surfaceFg ? { foreground: surfaceFg } : {}),
    ...(surfaceBg ? { backgrounds: [surfaceBg] } : {})
  };

  inactive.hover = {
    ...inactive.hover,
    ...(primaryFg ? { foreground: primaryFg } : {}),
    ...(primaryHoverBg ? { background: primaryHoverBg} : {})
  }

  inactive.selected = {
    ...inactive.selected,
    ...(infoFg ? { foreground: infoFg } : {}),
    ...(infoBg ? { background: infoBg } : {})
  }

  inactive.highlighted = inactive.hover;

  return {
    active,
    inactive,
    scaleBar: {
      foreground: inactive.normal.foreground
    }
  } as FlamePalette;
}

export function createGradientColors(base: string) {
  const { dark, light } = ensureContrast(
    tinycolor(base).darken(30),
    tinycolor(base).brighten(30)
  )

  const { darkHsl, lightHsl } = adjustHue(dark, light)
  return [
    tinycolor(darkHsl).toHexString(),
    tinycolor(lightHsl).toHexString()
  ];
}

// helpers
function ensureContrast(dark: color, light: color) {
  const step = 2;
  const minContrast = 5.0;

  let contrast = tinycolor.readability(dark, light);

  while (contrast < minContrast) {
    dark = dark.darken(step);
    light = light.brighten(step);

    if (dark.getBrightness() <= 0 || light.getBrightness() >= 255)
      break;

    contrast = tinycolor.readability(dark, light);
  }

  return { dark, light }
}

function adjustHue(dark: color, light: color) {
  const darkHsl = dark.toHsl();
  const lightHsl = light.toHsl();
  const hueShiftAmount = 20;

  darkHsl.h = (darkHsl.h - hueShiftAmount + 360) % 360;
  lightHsl.h = (lightHsl.h + hueShiftAmount) % 360;

  return { darkHsl, lightHsl }
}
