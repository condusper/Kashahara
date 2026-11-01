import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReceiptModel, ReceiptTone } from '../lib/receipt';
import { SUPPORT_EMAIL } from '../lib/receipt';
import { fonts } from '../theme/tokens';
import { BrandMark } from './BrandMark';

/**
 * Logical width the receipt is laid out at. It is rendered off-screen and then
 * captured at a higher pixel width, so every value here can stay generous
 * without the document becoming physically large on screen.
 */
export const RECEIPT_WIDTH = 720;

const ink = '#1C1B17';
const inkSoft = '#4D4A42';
const hairline = '#E7DFD1';
const emerald = '#0E5A43';
const bronze = '#A8814A';
const bronzeSoft = '#F5EDDF';
const bronzeBorder = '#E7DFD1';

const tones: Record<ReceiptTone, { dot: string; wash: string }> = {
  success: { dot: '#6FD3A4', wash: 'rgba(111, 211, 164, 0.18)' },
  failed: { dot: '#E88978', wash: 'rgba(232, 137, 120, 0.18)' },
  info: { dot: '#8BC4DC', wash: 'rgba(139, 196, 220, 0.18)' },
  pending: { dot: '#E3B766', wash: 'rgba(227, 183, 102, 0.18)' },
};

export interface ReceiptDocumentProps {
  model: ReceiptModel;
}

/**
 * The downloadable receipt. Deliberately fixed-width, theme-independent and
 * built from plain views so it captures identically on every device.
 */
export function ReceiptDocument({ model }: ReceiptDocumentProps) {
  const tone = tones[model.tone];

  return (
    <View style={styles.canvas}>
      <View style={styles.card}>
        <LinearGradient
          colors={['#08261D', '#0C3D2D', '#126A4E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.brandRow}>
            <View style={styles.brand}>
              <BrandMark size={46} />
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>Kashahara</Text>
                <Text style={styles.brandTag}>Premium payments</Text>
              </View>
            </View>
            <Text style={styles.docLabel}>{model.documentLabel.toUpperCase()}</Text>
          </View>

          <Text style={styles.headline}>{model.headline}</Text>
          <Text style={styles.amount}>{model.amount}</Text>

          <View style={[styles.pill, { backgroundColor: tone.wash }]}>
            <View style={[styles.dot, { backgroundColor: tone.dot }]} />
            <Text style={styles.pillText}>{model.status}</Text>
          </View>

          <Text style={styles.note}>{model.note}</Text>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>Transaction details</Text>

          <View style={styles.rows}>
            {model.subtotal ? (
              <DetailRow
                label={model.subtotalLabel ?? 'Amount before fee'}
                value={model.subtotal}
              />
            ) : null}
            {model.fee ? (
              <DetailRow label={model.feeLabel ?? 'Fee'} value={model.fee} />
            ) : null}
            {model.total ? (
              <DetailRow label={model.totalLabel ?? 'Total'} value={model.total} />
            ) : null}
            {model.rows.map((row, index) => (
              <DetailRow
                key={`${row.label}-${index}`}
                label={row.label}
                value={row.value}
                mono={row.mono}
                last={
                  index === model.rows.length - 1 && model.secrets.length === 0
                }
              />
            ))}
          </View>

          {model.secrets.length > 0 ? (
            <View style={styles.secrets}>
              <Text style={styles.secretsTitle}>
                {(model.secretsTitle ?? 'Keep these safe').toUpperCase()}
              </Text>
              {model.secrets.map((secret, index) => (
                <View
                  key={`${secret.label}-${index}`}
                  style={[
                    styles.secretRow,
                    index === model.secrets.length - 1 ? styles.secretRowLast : null,
                  ]}
                >
                  <Text style={styles.secretLabel}>{secret.label}</Text>
                  <Text style={styles.secretValue}>{secret.value}</Text>
                </View>
              ))}
              {model.secretsHint ? (
                <Text style={styles.secretsHint}>{model.secretsHint}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={styles.footerBrand}>
              <BrandMark size={30} />
              <View>
                <Text style={styles.footerName}>Kashahara</Text>
                <Text style={styles.footerMeta}>Issued {model.issuedAt}</Text>
              </View>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.footerLabel}>Support</Text>
              <Text style={styles.footerSupport}>{SUPPORT_EMAIL}</Text>
            </View>
          </View>

          {model.preparedFor ? (
            <Text style={styles.preparedFor} numberOfLines={1}>
              Prepared for {model.preparedFor}
            </Text>
          ) : null}

          <Text style={styles.legal}>
            This receipt is proof of payment. Keep it for your records.
          </Text>
        </View>

        <LinearGradient
          colors={['#0E5A43', '#A8814A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentBar}
        />
      </View>
    </View>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}

function DetailRow({ label, value, mono, last }: DetailRowProps) {
  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, mono ? styles.rowValueMono : null]}
        selectable={false}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: RECEIPT_WIDTH,
    backgroundColor: '#F1EBDF',
    padding: 40,
  },
  card: {
    backgroundColor: '#FFFDF8',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E7DFD1',
  },
  header: {
    paddingHorizontal: 44,
    paddingTop: 40,
    paddingBottom: 44,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brandCopy: {
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: fonts.serifSemibold,
    fontSize: 27,
    letterSpacing: -0.3,
    color: '#FBF7EE',
  },
  brandTag: {
    fontFamily: fonts.regular,
    fontSize: 15,
    letterSpacing: 0.3,
    color: 'rgba(251, 247, 238, 0.62)',
    marginTop: 1,
  },
  docLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    letterSpacing: 2.4,
    color: 'rgba(214, 180, 120, 0.9)',
    marginTop: 8,
  },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.2,
    color: 'rgba(251, 247, 238, 0.82)',
  },
  amount: {
    fontFamily: fonts.heavy,
    fontSize: 68,
    lineHeight: 78,
    letterSpacing: -2,
    color: '#FBF7EE',
    marginTop: 8,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(214, 180, 120, 0.35)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 22,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  pillText: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    letterSpacing: 0.4,
    color: '#FBF7EE',
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 19,
    lineHeight: 28,
    color: 'rgba(251, 247, 238, 0.72)',
    marginTop: 20,
  },
  body: {
    paddingHorizontal: 44,
    paddingTop: 36,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    letterSpacing: 2.4,
    color: bronze,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  rows: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: hairline,
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 24,
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 20,
    lineHeight: 27,
    color: inkSoft,
    flexShrink: 0,
  },
  rowValue: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 22,
    lineHeight: 29,
    color: ink,
    textAlign: 'right',
    marginLeft: 28,
  },
  rowValueMono: {
    fontFamily: fonts.bold,
    letterSpacing: 0.6,
  },
  secrets: {
    backgroundColor: bronzeSoft,
    borderWidth: 1,
    borderColor: bronzeBorder,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 24,
    marginTop: 10,
    marginBottom: 24,
  },
  secretsTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: 2.4,
    color: bronze,
    marginBottom: 16,
  },
  secretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 129, 74, 0.2)',
  },
  secretRowLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  secretLabel: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: inkSoft,
  },
  secretValue: {
    fontFamily: fonts.bold,
    fontSize: 28,
    letterSpacing: 2,
    color: ink,
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 20,
  },
  secretsHint: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
    color: inkSoft,
    marginTop: 18,
  },
  footer: {
    backgroundColor: '#F7F3EB',
    borderTopWidth: 1,
    borderTopColor: hairline,
    paddingHorizontal: 44,
    paddingTop: 26,
    paddingBottom: 30,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  footerName: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    letterSpacing: 0.2,
    color: ink,
  },
  footerMeta: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: inkSoft,
    marginTop: 2,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  footerLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 1.8,
    color: inkSoft,
    textTransform: 'uppercase',
  },
  footerSupport: {
    fontFamily: fonts.medium,
    fontSize: 17,
    color: emerald,
    marginTop: 3,
  },
  preparedFor: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: inkSoft,
    marginTop: 20,
  },
  legal: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#8A8578',
    marginTop: 12,
  },
  accentBar: {
    height: 8,
  },
});
