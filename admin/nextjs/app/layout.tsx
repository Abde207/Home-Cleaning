import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import './styles.css';

export const metadata = { title: 'Home Clean Operations', description: 'Home Clean administrative application' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await headers()).get('x-admin-locale') === 'ar' ? 'ar' : 'en';
  return <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}><body>{children}</body></html>;
}
