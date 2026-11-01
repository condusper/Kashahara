import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeProvider';
import { radii, spacing, typography } from '../theme/tokens';
import type { Tone } from '../lib/format';

interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
}

interface ToastContextValue {
  show: (title: string, options?: { description?: string; tone?: Tone }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcon: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  neutral: 'information-circle-outline',
  success: 'checkmark-circle',
  warning: 'alert-circle',
  danger: 'close-circle',
  info: 'information-circle',
  brand: 'sparkles',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-16));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -12, duration: 180, useNativeDriver: true }),
    ]).start(() => setMessage(null));
  }, [opacity, translateY]);

  const show = useCallback(
    (title: string, options?: { description?: string; tone?: Tone }) => {
      if (timer.current) clearTimeout(timer.current);
      counter.current += 1;
      setMessage({
        id: counter.current,
        title,
        description: options?.description,
        tone: options?.tone ?? 'neutral',
      });
      opacity.setValue(0);
      translateY.setValue(-16);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      timer.current = setTimeout(hide, 4200);
    },
    [hide, opacity, translateY],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (title, description) => show(title, { description, tone: 'success' }),
      error: (title, description) => show(title, { description, tone: 'danger' }),
      info: (title, description) => show(title, { description, tone: 'info' }),
    }),
    [show],
  );

  const toneColor =
    message?.tone === 'success'
      ? colors.success
      : message?.tone === 'danger'
        ? colors.danger
        : message?.tone === 'warning'
          ? colors.warning
          : message?.tone === 'brand'
            ? colors.accent
            : colors.info;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrapper,
            { top: insets.top + spacing.xs, opacity, transform: [{ translateY }] },
          ]}
        >
          <Pressable
            accessibilityRole="alert"
            accessibilityLabel={`${message.title}. ${message.description ?? ''}`}
            onPress={hide}
            style={[
              styles.toast,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${toneColor}1A` }]}>
              <Ionicons name={toneIcon[message.tone]} size={20} color={toneColor} />
            </View>
            <View style={styles.copy}>
              <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
                {message.title}
              </Text>
              {message.description ? (
                <Text
                  style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
                  numberOfLines={3}
                >
                  {message.description}
                </Text>
              ) : null}
            </View>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 620,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
});
