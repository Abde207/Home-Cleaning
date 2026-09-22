import type { Locale } from '../lib/i18n.ts';
import { ar } from './ar.ts';
import { en } from './en.ts';

export type Messages = typeof en;

export function messagesFor(locale: Locale): Messages {
  return (locale === 'ar' ? ar : en) as Messages;
}
