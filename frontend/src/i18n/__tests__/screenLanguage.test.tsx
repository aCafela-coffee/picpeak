import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../config';
import { applyServerLanguage, documentLanguage, getScreenLanguage, SCREEN_LANGUAGE_KEY, selectScreenLanguage } from '../screenLanguage';
import { CompactLanguageSelector, SUPPORTED_LANGUAGES, SUPPORTED_UI_LANGUAGES } from '../../components/common/LanguageSelector';
import { useLocalizedDate } from '../../hooks/useLocalizedDate';
import { CustomerAuthProvider, useCustomerAuth } from '../../contexts/CustomerAuthContext';

vi.mock('../../hooks/usePublicSettings', () => ({ usePublicSettings: () => ({ data: {} }) }));
const session = vi.hoisted(() => vi.fn());
vi.mock('../../services/customer.service', () => ({
  customerService: { session, logout: vi.fn() },
  DEFAULT_CUSTOMER_FEATURES: { calendar: false, quotes: false, bills: false, contracts: false, documents: false },
}));

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage('en');
  session.mockResolvedValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('browser-only screen language', () => {
  it('keeps official persisted language options and adds Korean only to screens', () => {
    expect(SUPPORTED_LANGUAGES.map(l => l.code)).toEqual(['en','de','ru','pt','nl','fr','es','sl']);
    expect(SUPPORTED_UI_LANGUAGES.map(l => l.code)).toContain('ko');
    expect(documentLanguage('ko')).toBe('en');
    expect(documentLanguage('ko-KR')).toBe('en');
    expect(documentLanguage('de')).toBe('de');
  });

  it('retains official server-language behaviour when no explicit choice exists', async () => {
    await i18n.changeLanguage('ko'); // Automatic browser detection is not an explicit selection.
    expect(getScreenLanguage()).toBeUndefined();
    await applyServerLanguage(i18n, 'de');
    expect(i18n.language).toBe('de');
  });

  it('switches from the selector without network writes and survives route remount and regional tags', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const view = render(<CompactLanguageSelector />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ko' } });
    await waitFor(() => expect(i18n.language).toBe('ko'));
    expect(localStorage.getItem(SCREEN_LANGUAGE_KEY)).toBe('ko');
    await applyServerLanguage(i18n, 'en');
    await applyServerLanguage(i18n, 'de');
    expect(i18n.language).toBe('ko');
    view.unmount();
    render(<CompactLanguageSelector />);
    expect(screen.getByRole('combobox')).toHaveValue('ko');
    expect(getScreenLanguage()).toBe('ko'); // This is the value config reads on reload.
    await selectScreenLanguage(i18n, 'ko-KR');
    expect(i18n.language).toBe('ko');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('preserves Korean after customer login and session restoration without altering the profile', async () => {
    await selectScreenLanguage(i18n, 'ko');
    const profile = { id: 1, email: 'customer@example.com', preferredLanguage: 'de' };
    session.mockResolvedValue({ customer: profile, features: {}, branding: { showLogo: true, showCompanyName: true } });
    function Probe() {
      const auth = useCustomerAuth();
      return <><span>{auth.customer?.preferredLanguage}</span><button onClick={() => auth.setCustomer(profile)}>Login</button></>;
    }
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}><CustomerAuthProvider>{children}</CustomerAuthProvider></QueryClientProvider>
    );
    const view = render(<Probe />, { wrapper });
    await screen.findByText('de');
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(i18n.language).toBe('ko');
    view.unmount();
    render(<Probe />, { wrapper });
    await screen.findByText('de');
    expect(i18n.language).toBe('ko');
    expect(profile.preferredLanguage).toBe('de');
  });

  it('renders Korean dates, relative time and plurals, including ko-KR', async () => {
    await i18n.changeLanguage('ko-KR');
    const { result } = renderHook(() => useLocalizedDate());
    expect(result.current.format(new Date(2026, 9, 2), 'PPP')).toMatch(/2026년 10월 2일/);
    expect(result.current.formatDistanceToNow(new Date(Date.now() - 3 * 86400000), { addSuffix: true })).toBe('3일 전');
    expect(result.current.locale.code).toBe('ko');
    expect(i18n.t('events.externalSource.rescanDone', { count: 2 })).toBe('스캔 완료: 새 사진 2장');
  });
});
