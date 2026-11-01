import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/providers/ThemeProvider';
import { useToast } from '../../src/providers/ToastProvider';
import {
  errorMessage,
  supportApi,
  type SupportFaqItem,
  type SupportTicket,
} from '../../src/lib/api';
import { formatDateTime } from '../../src/lib/format';
import { Screen } from '../../src/components/Screen';
import { Header } from '../../src/components/Header';
import { Card } from '../../src/components/Card';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { Badge } from '../../src/components/Badge';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { Skeleton } from '../../src/components/Skeleton';
import { spacing } from '../../src/theme/tokens';

export default function SupportScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ reference?: string; transactionId?: string }>();
  const reference = typeof params.reference === 'string' ? params.reference : '';
  const transactionId =
    typeof params.transactionId === 'string' ? params.transactionId : '';

  const [faq, setFaq] = useState<SupportFaqItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const [subject, setSubject] = useState(reference ? 'Help with a transaction' : '');
  const [message, setMessage] = useState(
    reference ? `Hello, I need help with transaction ${reference}.\n\n` : '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [faqResult, ticketResult] = await Promise.all([
        supportApi.faq(),
        supportApi.tickets(),
      ]);
      setFaq(faqResult.items);
      setTickets(ticketResult.items);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // State is only updated after the support requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submit = async () => {
    if (subject.trim().length < 3) {
      setFormError('Add a short subject so we can route your message.');
      return;
    }
    if (message.trim().length < 10) {
      setFormError('Tell us a little more so we can help (at least 10 characters).');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await supportApi.createTicket({
        subject: subject.trim(),
        message: message.trim(),
      });
      setTickets((current) => [result.ticket, ...current]);
      setSubject('');
      setMessage('');
      toast.success('Message sent', 'Our support team will review your ticket.');
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header showBack eyebrow="Help" title="Support" subtitle="Answers, receipts, and human help" />
      {reference ? (
        <Card tone="primary" style={styles.reference}>
          <Ionicons name="receipt-outline" size={18} color={colors.primary} />
          <View style={styles.referenceCopy}>
            <AppText variant="caption" color="textSecondary">
              Helping with transaction
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {reference}
            </AppText>
          </View>
          {transactionId ? (
            <Button
              label="Open"
              size="sm"
              variant="secondary"
              fullWidth={false}
              onPress={() => router.push(`/transaction/${transactionId}` as Href)}
            />
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title="Common questions" subtitle="Tap a question to read the answer" />
      {loading && faq.length === 0 ? (
        <Card style={styles.faqCard}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.faqSkeleton}>
              <Skeleton width="80%" height={14} />
              <Skeleton width="30%" height={11} />
            </View>
          ))}
        </Card>
      ) : error && faq.length === 0 ? (
        <Card tone="alt" style={styles.errorCard}>
          <AppText variant="caption" color="danger">
            {error}
          </AppText>
          <Button label="Try again" variant="secondary" size="sm" fullWidth={false} onPress={() => void load()} />
        </Card>
      ) : (
        <Card style={styles.faqCard}>
          {faq.map((item, index) => {
            const open = openFaq === item.id;
            return (
              <View key={item.id}>
                {index > 0 ? (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                ) : null}
                <Pressable
                  onPress={() => setOpenFaq(open ? null : item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={item.question}
                  style={({ pressed }) => [styles.faqRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <AppText variant="bodyStrong" style={styles.faqQuestion}>
                    {item.question}
                  </AppText>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={17}
                    color={colors.textMuted}
                  />
                </Pressable>
                {open ? (
                  <AppText variant="caption" color="textSecondary" style={styles.faqAnswer}>
                    {item.answer}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </Card>
      )}

      <SectionHeader title="Contact support" subtitle="Create a ticket with the details" />
      <Card style={styles.form}>
        {formError ? (
          <Card tone="alt" style={[styles.formError, { borderColor: colors.danger }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <AppText variant="caption" color="danger" style={styles.formErrorText}>
              {formError}
            </AppText>
          </Card>
        ) : null}
        <TextField
          label="Subject"
          placeholder="What do you need help with?"
          value={subject}
          onChangeText={setSubject}
          maxLength={160}
          leftIcon="chatbox-ellipses-outline"
        />
        <TextField
          label="Message"
          placeholder="Include the transaction reference, amount, and what happened."
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={4000}
          hint={`${message.length}/4000 characters`}
        />
        <Button
          label={submitting ? 'Sending…' : 'Send message'}
          icon="send-outline"
          onPress={() => void submit()}
          loading={submitting}
          disabled={subject.trim().length < 3 || message.trim().length < 10}
        />
      </Card>

      <SectionHeader title="Your tickets" subtitle="Newest first" />
      {loading && tickets.length === 0 ? (
        <Card style={styles.faqCard}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="45%" height={11} />
        </Card>
      ) : tickets.length === 0 ? (
        <Card>
          <EmptyState
            icon="chatbubbles-outline"
            title="No support tickets yet"
            description="If something goes wrong, send us a message and we will keep the thread here."
          />
        </Card>
      ) : (
        <View style={styles.tickets}>
          {tickets.map((ticket) => (
            <Card key={ticket.id} style={styles.ticket}>
              <View style={styles.ticketHeader}>
                <AppText variant="bodyStrong" numberOfLines={2} style={styles.ticketSubject}>
                  {ticket.subject}
                </AppText>
                <Badge
                  label={ticket.status === 'open' ? 'Open' : 'Closed'}
                  tone={ticket.status === 'open' ? 'info' : 'neutral'}
                  compact
                />
              </View>
              <AppText variant="caption" color="textSecondary" numberOfLines={3}>
                {ticket.message}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {formatDateTime(ticket.createdAt)}
              </AppText>
            </Card>
          ))}
        </View>
      )}

      <Card tone="alt" style={styles.safety}>
        <AppText variant="bodyStrong">Before you write</AppText>
        <AppText variant="caption" color="textMuted">
          Never send your password, transaction PIN, card number, or one-time codes. For a
          disputed order, include the transaction reference only. If a payment is marked
          uncertain, do not retry it — we will reconcile it with the supplier.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  reference: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  referenceCopy: {
    flex: 1,
    gap: 1,
  },
  faqCard: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.md,
  },
  faqSkeleton: {
    gap: 6,
    paddingVertical: spacing.sm,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  faqQuestion: {
    flex: 1,
  },
  faqAnswer: {
    paddingBottom: spacing.sm,
    paddingRight: spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  errorCard: {
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  form: {
    gap: spacing.sm,
  },
  formError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  formErrorText: {
    flex: 1,
  },
  tickets: {
    gap: spacing.sm,
  },
  ticket: {
    gap: spacing.xs,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  ticketSubject: {
    flex: 1,
  },
  safety: {
    gap: spacing.xs,
  },
});
