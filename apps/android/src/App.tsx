import React, { useEffect, useRef, useState, type ComponentProps, type ElementRef } from 'react';
import { AppState, BackHandler, KeyboardAvoidingView, RefreshControl, ScrollView, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static';
import { QueryClient, QueryClientProvider, focusManager, useMutation, useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Appbar, BottomNavigation, Button, Dialog, Divider, List, MD3DarkTheme, PaperProvider, Portal, RadioButton, Text, TextInput } from 'react-native-paper';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { calendarDate, createMobileClient } from '@verdeai/mobile-core';
import config from '@verdeai/mobile-core/config';
import { messages, type MessageKey } from '@verdeai/mobile-core/messages';
import { resolveLocale, SUPPORTED_LOCALES, type ChatMessage, type SupportedLocale } from '@verdeai/shared-types';

const api = createMobileClient(config.apiUrl);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
const languages: Record<SupportedLocale, string> = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिन्दी', fr: 'Français', es: 'Español' };
const tabs = ['forecast', 'wasteRisk', 'explain'] as const;
const icons = ['chart-bar', 'alert-circle-outline', 'chat-outline'];
const theme = { ...MD3DarkTheme, colors: { ...MD3DarkTheme.colors, primary: '#4ade80', onPrimary: '#052e16', primaryContainer: '#14532d', onPrimaryContainer: '#dcfce7', background: '#020617', surface: '#0f172a', surfaceVariant: '#1e293b', onSurface: '#f1f5f9', onSurfaceVariant: '#cbd5e1', outline: '#64748b', error: '#fca5a5' } };
const icon = ({ name, ...props }: { name: string; size: number; color?: string }) => <MaterialDesignIcons {...props} name={name as ComponentProps<typeof MaterialDesignIcons>['name']} />;

function Dashboard() {
  const insets = useSafeAreaInsets();
  const expanded = useWindowDimensions().width >= 700;
  const [locale, setLocale] = useState<SupportedLocale>(() => resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale));
  const [ready, setReady] = useState(false);
  const [restaurantId, setRestaurantId] = useState('R001');
  // Same initial seeded calendar day as the web dashboard; selectable via the native date picker.
  const [date, setDate] = useState('2026-02-05');
  const [tab, setTab] = useState(0);
  const [dialog, setDialog] = useState<'language' | 'restaurant' | null>(null);
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<Record<string, ChatMessage[]>>({});
  const scroll = useRef<ElementRef<typeof ScrollView>>(null);
  const request = useRef<AbortController | null>(null);
  const key = `${restaurantId}:${date}:${locale}`;
  const currentKey = useRef(key);
  currentKey.current = key;
  const t = (name: MessageKey, values: Record<string, number> = {}) => messages[locale][name].replace(/\{(\w+)\}/g, (_, token: string) => new Intl.NumberFormat(locale).format(values[token] ?? 0));
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('verdeai.language').then(value => { if (active && value) setLocale(resolveLocale(value)); }).catch(() => {}).finally(() => { if (active) setReady(true); });
    const subscription = AppState.addEventListener('change', state => focusManager.setFocused(state === 'active'));
    return () => { active = false; subscription.remove(); request.current?.abort(); };
  }, []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dialog) { setDialog(null); return true; }
      if (tab !== 0) { setTab(0); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [tab, dialog]);

  const restaurants = useQuery({ queryKey: ['restaurants'], queryFn: ({ signal }) => api.restaurants(signal), enabled: ready });
  const health = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => api.health(signal), enabled: ready });
  const insight = useQuery({ queryKey: ['insight', key], queryFn: ({ signal }) => api.insight(restaurantId, date, locale, signal), enabled: ready && restaurants.isSuccess && restaurants.data.length > 0 });
  useEffect(() => {
    if (restaurants.data?.length && !restaurants.data.some(r => r.restaurantId === restaurantId)) setRestaurantId(restaurants.data[0].restaurantId);
  }, [restaurants.data, restaurantId]);

  const send = useMutation({
    mutationFn: async (turn: { key: string; restaurantId: string; date: string; locale: SupportedLocale; messages: ChatMessage[] }) => {
      request.current = new AbortController();
      return api.chat(turn.restaurantId, turn.date, turn.messages, turn.locale, request.current.signal);
    },
    onSuccess: (result, turn) => {
      setHistory(previous => ({ ...previous, [turn.key]: [...turn.messages, result.reply] }));
      // A response for another restaurant/language must never clear the current draft.
      if (currentKey.current === turn.key) setDraft('');
    },
  });
  const visibleMessages = history[key] ?? [];
  const pendingHere = send.isPending && send.variables?.key === key;
  const failedHere = send.isError && send.variables?.key === key;
  const refresh = () => { void restaurants.refetch(); void insight.refetch(); void health.refetch(); };
  const restaurant = restaurants.data?.find(r => r.restaurantId === restaurantId);
  const switchContext = (action: () => void) => { request.current?.abort(); setDraft(''); send.reset(); action(); };
  const routes = tabs.map((name, index) => ({ key: name, title: t(name), focusedIcon: icons[index], unfocusedIcon: icons[index] }));
  const error = restaurants.isError || insight.isError;
  const loading = !ready || restaurants.isPending || (insight.isPending && !!restaurants.data?.length);

  return <View style={[styles.root, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
    <StatusBar barStyle="light-content" />
    <Appbar.Header statusBarHeight={0}>
      <Appbar.Content title="VerdeAI" titleStyle={styles.brand} />
      <Appbar.Action icon="translate" accessibilityLabel={t('language')} onPress={() => setDialog('language')} />
    </Appbar.Header>
    <View style={styles.context}>
      {!!health.data && <Text variant="labelMedium" style={styles.secondary}>{t(health.data.dataSource === 'mock' ? 'demo' : 'live')}</Text>}
      <Button mode="outlined" icon="storefront-outline" onPress={() => setDialog('restaurant')} accessibilityLabel={`${t('restaurant')}: ${restaurant?.name ?? ''}`} contentStyle={styles.touch}>{restaurant?.name ?? t('restaurant')}</Button>
      <Button mode="text" icon="calendar" contentStyle={styles.touch} onPress={() => {
        const [year, month, day] = date.split('-').map(Number);
        DateTimePickerAndroid.open({ value: new Date(year, month - 1, day), mode: 'date', onChange: (event, chosen) => { if (event.type === 'set' && chosen) switchContext(() => setDate(calendarDate(chosen))); } });
      }} accessibilityLabel={t('date')}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))}</Button>
    </View>
    <Divider />
    <View style={styles.workspace}>
      {expanded && <View style={styles.rail}>{routes.map((route, index) => <Button key={route.key} icon={route.focusedIcon} mode={tab === index ? 'contained-tonal' : 'text'} contentStyle={styles.touch} onPress={() => setTab(index)}>{route.title}</Button>)}</View>}
      <KeyboardAvoidingView behavior="height" style={styles.flex}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={insight.isRefetching || restaurants.isRefetching} onRefresh={refresh} tintColor={theme.colors.primary} />}
          onContentSizeChange={() => { if (tab === 2) scroll.current?.scrollToEnd({ animated: false }); }}>
          <Text variant="headlineSmall" accessibilityRole="header" style={styles.heading}>{t(tabs[tab])}</Text>
          {loading ? <View style={styles.state}><ActivityIndicator /><Text>{t('loadingInsight')}</Text></View> : error ? <View accessibilityRole="alert" style={styles.state}><Text>{t('loadError')}</Text><Button onPress={refresh}>{t('retry')}</Button></View> : <>
            {tab === 0 && (insight.data?.forecasts.length ? insight.data.forecasts.map(row => <View key={row.id} style={styles.row}>
              <Text variant="titleMedium">{row.item}</Text>
              <View style={styles.quantity}><Text style={styles.secondary}>{t('predicted')}</Text><Text variant="titleLarge" style={styles.numeric}>{number(row.predictedQuantity)}</Text></View>
              <View style={styles.quantity}><Text style={styles.secondary}>{t('historical')}</Text><Text style={styles.numeric}>{number(Math.round(row.historicalAverage))}</Text></View>
              <Divider style={styles.divider} />
            </View>) : <Text>{t('emptyForecast')}</Text>)}
            {tab === 1 && (insight.data?.wasteRisk.length ? <>
              <Text style={styles.summary}>{t('riskSummary', { count: insight.data.wasteRisk.filter(row => row.riskScore === 'HIGH').length, total: insight.data.wasteRisk.length })}</Text>
              {insight.data.wasteRisk.map(row => <View key={row.id} style={styles.row}>
                <Text variant="titleMedium">{row.item}</Text>
                <Text style={{ color: row.riskScore === 'HIGH' ? theme.colors.error : theme.colors.primary }}>{t(row.riskScore === 'HIGH' ? 'high' : 'low')}</Text>
                <Text style={styles.secondary}>{t('units', { count: row.predictedQuantity })}</Text><Divider style={styles.divider} />
              </View>)}
            </> : <Text>{t('emptyRisk')}</Text>)}
            {tab === 2 && <>
              {!!insight.data?.explanation && <Text selectable style={styles.explanation}>{insight.data.explanation}</Text>}
              {visibleMessages.map((message, index) => <View key={index} style={[styles.message, message.role === 'user' && styles.userMessage]}><Text variant="labelLarge" style={styles.secondary}>{message.role === 'assistant' ? 'VerdeAI' : t('ask')}</Text><Text selectable>{message.content}</Text></View>)}
              {pendingHere && <View accessibilityLiveRegion="polite" style={styles.message}><Text>{send.variables?.messages.at(-1)?.content}</Text><ActivityIndicator size="small" /><Text>{t('thinking')}</Text></View>}
              {failedHere && <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>{t('sendError')}</Text>}
            </>}
          </>}
        </ScrollView>
        {tab === 2 && <View style={styles.composer}>
          <TextInput mode="outlined" label={t('ask')} placeholder={t('placeholder')} value={draft} onChangeText={setDraft} multiline maxLength={4000} disabled={send.isPending} style={styles.input} />
          <Button mode="contained" icon="send" contentStyle={styles.touch} disabled={!draft.trim() || send.isPending || !insight.data || error} loading={pendingHere} onPress={() => {
            const question = draft.trim();
            send.mutate({ key, restaurantId, date, locale, messages: [...visibleMessages, { role: 'user', content: question }] });
          }}>{t('send')}</Button>
        </View>}
      </KeyboardAvoidingView>
    </View>
    {!expanded ? <BottomNavigation.Bar navigationState={{ index: tab, routes }} onTabPress={({ route }) => setTab(routes.findIndex(r => r.key === route.key))} safeAreaInsets={{ bottom: insets.bottom }}
      renderIcon={({ route, color }) => icon({ name: route.focusedIcon, size: 24, color })}
      renderLabel={({ route, color }) => <Text variant="labelSmall" style={{ color, textAlign: 'center' }}>{route.title}</Text>} /> : <View style={{ height: insets.bottom }} />}
    <Portal><Dialog visible={dialog !== null} onDismiss={() => setDialog(null)} style={styles.dialog}>
      <Dialog.Title>{t(dialog === 'language' ? 'language' : 'restaurant')}</Dialog.Title>
      <Dialog.ScrollArea><ScrollView>
        {dialog === 'language' ? SUPPORTED_LOCALES.map(value => <RadioButton.Item key={value} label={languages[value]} value={value} status={locale === value ? 'checked' : 'unchecked'} onPress={() => {
          switchContext(() => setLocale(value)); setDialog(null); void AsyncStorage.setItem('verdeai.language', value).catch(() => {});
        }} />) : restaurants.data?.map(value => <List.Item key={value.restaurantId} title={value.name} description={value.location} onPress={() => { switchContext(() => setRestaurantId(value.restaurantId)); setDialog(null); }} />)}
      </ScrollView></Dialog.ScrollArea>
    </Dialog></Portal>
  </View>;
}

export default function App() {
  return <SafeAreaProvider><PaperProvider theme={theme} settings={{ icon }}><QueryClientProvider client={queryClient}><Dashboard /></QueryClientProvider></PaperProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background }, flex: { flex: 1, minWidth: 0 },
  brand: { fontWeight: '700' }, context: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, alignItems: 'flex-start' },
  touch: { minHeight: 48 }, workspace: { flex: 1, flexDirection: 'row' }, rail: { width: 220, padding: 12, gap: 12, backgroundColor: theme.colors.surface },
  content: { padding: 20, gap: 12, flexGrow: 1, width: '100%', maxWidth: 840, alignSelf: 'center' },
  heading: { marginBottom: 12 }, secondary: { color: theme.colors.onSurfaceVariant }, numeric: { fontVariant: ['tabular-nums'] },
  quantity: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  row: { gap: 12 }, divider: { marginTop: 8, marginBottom: 12 }, summary: { marginBottom: 16 },
  explanation: { lineHeight: 26, marginBottom: 16 }, message: { padding: 16, gap: 10, backgroundColor: theme.colors.surface, borderRadius: 12 },
  userMessage: { backgroundColor: theme.colors.primaryContainer }, state: { paddingVertical: 32, gap: 16, alignItems: 'center' },
  composer: { padding: 12, gap: 12, backgroundColor: theme.colors.surface }, input: { maxHeight: 140 }, dialog: { maxHeight: '75%' },
});
