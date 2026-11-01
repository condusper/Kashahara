import type { TransactionType } from '@kashahara/shared';
import type { ThemeColors } from './tokens';
import type { Tone } from '../lib/format';

export interface ToneColors {
  foreground: string;
  background: string;
  border: string;
}

export function toneColors(colors: ThemeColors, tone: Tone): ToneColors {
  switch (tone) {
    case 'success':
      return {
        foreground: colors.success,
        background: colors.successSoft,
        border: colors.successSoft,
      };
    case 'warning':
      return {
        foreground: colors.warning,
        background: colors.warningSoft,
        border: colors.warningSoft,
      };
    case 'danger':
      return {
        foreground: colors.danger,
        background: colors.dangerSoft,
        border: colors.dangerSoft,
      };
    case 'info':
      return {
        foreground: colors.info,
        background: colors.infoSoft,
        border: colors.infoSoft,
      };
    case 'brand':
      return {
        foreground: colors.primary,
        background: colors.primarySoft,
        border: colors.primarySoft,
      };
    default:
      return {
        foreground: colors.textSecondary,
        background: colors.surfaceAlt,
        border: colors.border,
      };
  }
}

/**
 * Per-service tints. Muted, mineral tones keep every service distinct without
 * the interface turning into a rainbow.
 */
export interface ServiceTint {
  foreground: string;
  background: string;
}

const lightServiceTints: Record<TransactionType, ServiceTint> = {
  airtime: { foreground: '#0E5A43', background: '#E7F1EC' },
  data: { foreground: '#2C6480', background: '#E9F2F6' },
  electricity: { foreground: '#9A6A1E', background: '#FBF1DE' },
  cable: { foreground: '#7A4A63', background: '#F5EBF0' },
  exam: { foreground: '#4F5B8C', background: '#EDEFF7' },
  wallet_funding: { foreground: '#2F7A55', background: '#E8F3ED' },
};

const darkServiceTints: Record<TransactionType, ServiceTint> = {
  airtime: { foreground: '#7FD6B2', background: '#11291F' },
  data: { foreground: '#8BC4DC', background: '#12242B' },
  electricity: { foreground: '#E3B766', background: '#2B2211' },
  cable: { foreground: '#D3A3BE', background: '#2A1B24' },
  exam: { foreground: '#AEB6E0', background: '#1D2033' },
  wallet_funding: { foreground: '#6FD3A4', background: '#10271C' },
};

export function serviceTint(isDark: boolean, type: TransactionType): ServiceTint {
  return (isDark ? darkServiceTints : lightServiceTints)[type];
}
