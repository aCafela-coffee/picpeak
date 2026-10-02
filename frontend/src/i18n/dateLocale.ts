import i18n from './config';

// Some upstream views use native Date formatting rather than useLocalizedDate.
// Override their locale only for Korean screens; retain their existing fallback.
export function screenDateLocale(fallback?: string): string | undefined {
  return i18n.language?.toLowerCase().split('-')[0] === 'ko' ? 'ko-KR' : fallback;
}
