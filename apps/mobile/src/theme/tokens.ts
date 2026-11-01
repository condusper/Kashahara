/**
 * Design tokens.
 *
 * Kashahara's visual language is quiet luxury: a warm ivory canvas, deep
 * emerald ink, a restrained bronze accent and editorial serif headlines
 * (EB Garamond) paired with a precise interface sans (Inter). Colour is used
 * sparingly, always to carry meaning, and motion is slow enough to feel calm.
 */

export const palette = {
  white: '#FFFFFF',
  ivory: '#FBF8F2',
  paper: '#F7F3EB',
  paperDeep: '#F1EBDF',
  ink: '#1C1B17',
  inkSoft: '#4D4A42',
  gray: '#8A8578',
  grayLight: '#D6CCBA',
  hairline: '#E7DFD1',
  emerald: '#0E5A43',
  emeraldDeep: '#0A3F30',
  emeraldSoft: '#E7F1EC',
  bronze: '#A8814A',
  bronzeSoft: '#F5EDDF',
  green: '#2F7A55',
  greenSoft: '#E8F3ED',
  orange: '#9A6A1E',
  orangeSoft: '#FBF1DE',
  red: '#B3402F',
  redSoft: '#FBEDEA',
  midnight: '#0B0D0C',
  midnightSurface: '#151916',
  midnightAlt: '#1C211D',
} as const;

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceAlt: string;
  surfaceStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  shadow: string;
  tabBar: string;
  input: string;
  skeleton: string;
  /** Decorative gradient stops for the wallet hero. */
  heroFrom: string;
  heroMid: string;
  heroTo: string;
  heroInk: string;
  link: string;
  chip: string;
}

export const lightColors: ThemeColors = {
  background: '#F7F3EB',
  backgroundElevated: '#F1EBDF',
  surface: '#FFFDF8',
  surfaceAlt: '#F2EDE3',
  surfaceStrong: '#E7DFD1',
  text: '#1C1B17',
  textSecondary: '#4D4A42',
  textMuted: '#8A8578',
  border: '#E7DFD1',
  borderStrong: '#D6CCBA',
  primary: '#0E5A43',
  primaryPressed: '#0A4433',
  primarySoft: '#E7F1EC',
  onPrimary: '#FFFDF8',
  accent: '#A8814A',
  accentSoft: '#F5EDDF',
  onAccent: '#1C1B17',
  danger: '#B3402F',
  dangerSoft: '#FBEDEA',
  success: '#2F7A55',
  successSoft: '#E8F3ED',
  warning: '#9A6A1E',
  warningSoft: '#FBF1DE',
  info: '#2C6480',
  infoSoft: '#E9F2F6',
  overlay: 'rgba(20, 18, 14, 0.46)',
  shadow: 'rgba(40, 32, 18, 0.10)',
  tabBar: 'rgba(251, 248, 242, 0.86)',
  input: '#F3EEE4',
  skeleton: '#ECE6DA',
  heroFrom: '#08261D',
  heroMid: '#0C3D2D',
  heroTo: '#126A4E',
  heroInk: '#FBF7EE',
  link: '#0E5A43',
  chip: 'rgba(28, 27, 23, 0.05)',
};

export const darkColors: ThemeColors = {
  background: '#0B0D0C',
  backgroundElevated: '#111412',
  surface: '#151916',
  surfaceAlt: '#1C211D',
  surfaceStrong: '#28302A',
  text: '#F3EFE5',
  textSecondary: '#CFC9BB',
  textMuted: '#8F8A7D',
  border: '#2A302B',
  borderStrong: '#3A423B',
  primary: '#69C7A1',
  primaryPressed: '#8AD9B8',
  primarySoft: '#11291F',
  onPrimary: '#082019',
  accent: '#D6B478',
  accentSoft: '#2B2417',
  onAccent: '#1C1B17',
  danger: '#E88978',
  dangerSoft: '#2E1714',
  success: '#6FD3A4',
  successSoft: '#10271C',
  warning: '#E3B766',
  warningSoft: '#2B2211',
  info: '#8BC4DC',
  infoSoft: '#12242B',
  overlay: 'rgba(0, 0, 0, 0.66)',
  shadow: 'rgba(0, 0, 0, 0.5)',
  tabBar: 'rgba(13, 16, 14, 0.88)',
  input: '#1A1F1B',
  skeleton: '#232924',
  heroFrom: '#061812',
  heroMid: '#0A2C21',
  heroTo: '#0F4E39',
  heroInk: '#FBF7EE',
  link: '#7FD6B2',
  chip: 'rgba(255, 255, 255, 0.06)',
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
} as const;

export const radii = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 30,
  xxl: 38,
  pill: 999,
} as const;

export const fonts = {
  regular: 'SFProText-Regular',
  medium: 'SFProText-Medium',
  semibold: 'SFProText-Semibold',
  bold: 'SFProText-Bold',
  heavy: 'SFProText-Heavy',
  serif: 'SFProDisplay-Regular',
  serifSemibold: 'SFProDisplay-Semibold',
  serifBold: 'SFProDisplay-Bold',
  serifItalic: 'SFProDisplay-RegularItalic',
} as const;

type TypeSpec = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  letterSpacing: number;
  textTransform?: 'uppercase';
};

export const typography = {
  display: {
    fontSize: 46,
    lineHeight: 50,
    fontFamily: fonts.serifSemibold,
    letterSpacing: -0.7,
  },
  h1: {
    fontSize: 38,
    lineHeight: 43,
    fontFamily: fonts.serifSemibold,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 30,
    lineHeight: 35,
    fontFamily: fonts.serifSemibold,
    letterSpacing: -0.35,
  },
  h3: {
    fontSize: 23,
    lineHeight: 28,
    fontFamily: fonts.serifSemibold,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: fonts.regular,
    letterSpacing: -0.1,
  },
  bodyStrong: {
    fontSize: 17,
    lineHeight: 25,
    fontFamily: fonts.semibold,
    letterSpacing: -0.15,
  },
  callout: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.medium,
    letterSpacing: -0.05,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.medium,
    letterSpacing: -0.02,
  },
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.semibold,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  mono: {
    fontSize: 16,
    lineHeight: 23,
    fontFamily: fonts.semibold,
    letterSpacing: 0.6,
  },
  quote: {
    fontSize: 20,
    lineHeight: 29,
    fontFamily: fonts.serifItalic,
    letterSpacing: -0.1,
  },
} satisfies Record<string, TypeSpec>;

export type TextVariant = keyof typeof typography;

export const shadows = {
  card: {
    shadowColor: '#2A2114',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 28,
    elevation: 3,
  },
  floating: {
    shadowColor: '#2A2114',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.14,
    shadowRadius: 40,
    elevation: 12,
  },
  hero: {
    shadowColor: '#041A13',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.3,
    shadowRadius: 44,
    elevation: 14,
  },
} as const;

export const layout = {
  maxContentWidth: 760,
  maxFormWidth: 520,
  tabBarHeight: 64,
  headerHeight: 56,
  touchTarget: 48,
  /** Used to keep the editorial vertical rhythm consistent. */
  sectionGap: 32,
} as const;
