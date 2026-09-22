'use client';

import { useParams } from 'next/navigation';
import { messagesFor } from '../../messages';

export default function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale: string }>();
  const t = messagesFor(params.locale === 'ar' ? 'ar' : 'en');
  return <main className="center-state" role="alert"><h1>{t.unexpectedTitle}</h1><p>{t.unexpectedDescription}</p>
    {error.digest && <small>{t.requestId}: {error.digest}</small>}<button type="button" onClick={reset}>{t.tryAgain}</button></main>;
}

