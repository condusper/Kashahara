import type { ViewStyle } from 'react-native';

/** Semantic depth levels for the Liquid Glass surfaces. */
export type GlassVariant = 'clear' | 'thin' | 'regular' | 'thick';

export interface GlassPalette {
  /** Translucent body tint. */
  fill: string;
  /** Slightly stronger body tint used for raised / focused states. */
  fillStrong: string;
  /** Hairline edge that defines the glass against the canvas. */
  border: string;
  /** Bright specular line along the top edge. */
  highlight: string;
  /** Gradient wash from the top-left of the surface. */
  topSheen: string;
  /** Very faint light gathered along the bottom edge. */
  bottomSheen: string;
  blurTint: 'light' | 'dark' | 'default';
  shadow: string;
}

const lightPalette: Record<GlassVariant, GlassPalette> = {
  clear: {
    fill: 'rgba(255, 255, 255, 0.28)',
    fillStrong: 'rgba(255, 255, 255, 0.42)',
    border: 'rgba(255, 255, 255, 0.52)',
    highlight: 'rgba(255, 255, 255, 0.92)',
    topSheen: 'rgba(255, 255, 255, 0.46)',
    bottomSheen: 'rgba(255, 255, 255, 0.04)',
    blurTint: 'light',
    shadow: 'rgba(38, 48, 40, 0.16)',
  },
  thin: {
    fill: 'rgba(255, 255, 255, 0.44)',
    fillStrong: 'rgba(255, 255, 255, 0.58)',
    border: 'rgba(255, 255, 255, 0.62)',
    highlight: 'rgba(255, 255, 255, 0.94)',
    topSheen: 'rgba(255, 255, 255, 0.56)',
    bottomSheen: 'rgba(255, 255, 255, 0.05)',
    blurTint: 'light',
    shadow: 'rgba(38, 48, 40, 0.16)',
  },
  regular: {
    fill: 'rgba(255, 255, 255, 0.58)',
    fillStrong: 'rgba(255, 255, 255, 0.7)',
    border: 'rgba(255, 255, 255, 0.7)',
    highlight: 'rgba(255, 255, 255, 0.96)',
    topSheen: 'rgba(255, 255, 255, 0.62)',
    bottomSheen: 'rgba(255, 255, 255, 0.06)',
    blurTint: 'light',
    shadow: 'rgba(38, 48, 40, 0.18)',
  },
  thick: {
    fill: 'rgba(255, 255, 255, 0.72)',
    fillStrong: 'rgba(255, 255, 255, 0.82)',
    border: 'rgba(255, 255, 255, 0.78)',
    highlight: 'rgba(255, 255, 255, 0.98)',
    topSheen: 'rgba(255, 255, 255, 0.7)',
    bottomSheen: 'rgba(255, 255, 255, 0.08)',
    blurTint: 'light',
    shadow: 'rgba(38, 48, 40, 0.2)',
  },
};

const darkPalette: Record<GlassVariant, GlassPalette> = {
  clear: {
    fill: 'rgba(255, 255, 255, 0.035)',
    fillStrong: 'rgba(255, 255, 255, 0.055)',
    border: 'rgba(255, 255, 255, 0.1)',
    highlight: 'rgba(255, 255, 255, 0.22)',
    topSheen: 'rgba(255, 255, 255, 0.08)',
    bottomSheen: 'rgba(255, 255, 255, 0.01)',
    blurTint: 'dark',
    shadow: 'rgba(0, 0, 0, 0.5)',
  },
  thin: {
    fill: 'rgba(255, 255, 255, 0.05)',
    fillStrong: 'rgba(255, 255, 255, 0.075)',
    border: 'rgba(255, 255, 255, 0.12)',
    highlight: 'rgba(255, 255, 255, 0.26)',
    topSheen: 'rgba(255, 255, 255, 0.1)',
    bottomSheen: 'rgba(255, 255, 255, 0.015)',
    blurTint: 'dark',
    shadow: 'rgba(0, 0, 0, 0.5)',
  },
  regular: {
    fill: 'rgba(255, 255, 255, 0.07)',
    fillStrong: 'rgba(255, 255, 255, 0.1)',
    border: 'rgba(255, 255, 255, 0.14)',
    highlight: 'rgba(255, 255, 255, 0.3)',
    topSheen: 'rgba(255, 255, 255, 0.12)',
    bottomSheen: 'rgba(255, 255, 255, 0.02)',
    blurTint: 'dark',
    shadow: 'rgba(0, 0, 0, 0.55)',
  },
  thick: {
    fill: 'rgba(255, 255, 255, 0.1)',
    fillStrong: 'rgba(255, 255, 255, 0.14)',
    border: 'rgba(255, 255, 255, 0.18)',
    highlight: 'rgba(255, 255, 255, 0.36)',
    topSheen: 'rgba(255, 255, 255, 0.15)',
    bottomSheen: 'rgba(255, 255, 255, 0.025)',
    blurTint: 'dark',
    shadow: 'rgba(0, 0, 0, 0.6)',
  },
};

export function glassPalette(isDark: boolean, variant: GlassVariant = 'regular'): GlassPalette {
  return (isDark ? darkPalette : lightPalette)[variant];
}

export type GlassShadow = 'none' | 'soft' | 'floating' | 'hero';

export function glassShadowStyle(shadow: GlassShadow, color: string): ViewStyle {
  switch (shadow) {
    case 'soft':
      return {
        shadowColor: color,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 22,
        elevation: 2,
      };
    case 'floating':
      return {
        shadowColor: color,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.16,
        shadowRadius: 34,
        elevation: 8,
      };
    case 'hero':
      return {
        shadowColor: color,
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: 0.22,
        shadowRadius: 46,
        elevation: 12,
      };
    default:
      return {};
  }
}

/** Converts a #RRGGBB colour to rgba() with the supplied opacity. */
export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Darkens (or lightens) a #RRGGBB colour by a 0–1 multiplier. */
export function shadeColor(hex: string, factor: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) =>
    Math.round(
      Math.max(
        0,
        Math.min(255, parseInt(normalized.slice(offset, offset + 2), 16) * factor),
      ),
    ),
  );
  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
