import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

@Injectable()
export class OtpSender {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
  async send(challengeId: string, phone: string, code: string, expiresAt: Date) {
    if (this.config.get('OTP_DELIVERY_MODE') === 'file') {
      if (['staging', 'production'].includes(this.config.get<string>('APP_ENVIRONMENT') ?? '')) throw new ServiceUnavailableException();
      const directory = fileURLToPath(new URL('../../../../.local/otp/', import.meta.url));
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(`${directory}/${challengeId}.json`, JSON.stringify({ code, expiresAt }), { mode: 0o600, flag: 'wx' });
      return;
    }
    // Real adapter is disabled until explicitly configured. Never used by local tests.
    const sid = this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST', signal: AbortSignal.timeout(10_000),
        headers: {
          authorization: `Basic ${Buffer.from(`${sid}:${this.config.getOrThrow<string>('TWILIO_AUTH_TOKEN')}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, From: this.config.getOrThrow<string>('TWILIO_FROM'), Body: `Home Clean verification code: ${code}. Valid for 5 minutes.` }),
      });
      if (!response.ok) throw new Error('Delivery failed');
    } catch { throw new ServiceUnavailableException({ code: 'AUTH_DELIVERY_UNAVAILABLE' }); }
  }
}
