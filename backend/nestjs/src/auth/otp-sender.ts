import { HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface OtpProvider {
  send(challengeId: string, phone: string, code: string, expiresAt: Date): Promise<void>;
  verify(phone: string, code: string): Promise<boolean>;
}

export class TwilioVerifyProvider implements OtpProvider {
  constructor(private readonly serviceSid: string, private readonly accountSid: string,
    private readonly authToken: string, private readonly request: typeof fetch = fetch,
    private readonly sleep: (milliseconds: number) => Promise<void> = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))) {}

  private async call(path: string, fields: Record<string, string>) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let response: Response;
      try {
        response = await this.request(`https://verify.twilio.com/v2/Services/${this.serviceSid}/${path}`, {
          method: 'POST', signal: AbortSignal.timeout(8_000),
          headers: { authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields),
        });
      } catch {
        if (attempt < 2) { await this.sleep(250); continue; }
        throw new ServiceUnavailableException({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
      }
      if (path === 'VerificationCheck' && response.status === 404) return { status: 'expired' };
      if (response.status === 429) {
        if (attempt < 2) {
          const retryAfter = Number(response.headers.get('retry-after'));
          await this.sleep(Number.isFinite(retryAfter) ? Math.min(Math.max(retryAfter * 1000, 250), 2_000) : 500);
          continue;
        }
        throw new HttpException({ code: 'AUTH_PROVIDER_RATE_LIMITED' }, 429);
      }
      if (response.status >= 500) {
        if (attempt < 2) { await this.sleep(250); continue; }
        throw new ServiceUnavailableException({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
      }
      if (!response.ok) throw new ServiceUnavailableException({ code: 'AUTH_PROVIDER_REJECTED' });
      try {
        const result = await response.json() as { status?: string };
        if (typeof result.status !== 'string') throw new Error('missing status');
        return result;
      } catch { throw new ServiceUnavailableException({ code: 'AUTH_PROVIDER_INVALID_RESPONSE' }); }
    }
    throw new ServiceUnavailableException({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
  }

  async send(_challengeId: string, phone: string, _code: string, _expiresAt: Date) {
    const result = await this.call('Verifications', { To: phone, Channel: 'sms' });
    if (result.status !== 'pending') throw new ServiceUnavailableException({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
  }
  async verify(phone: string, code: string) {
    const result = await this.call('VerificationCheck', { To: phone, Code: code });
    return result.status === 'approved';
  }
}

export class LocalOtpProvider implements OtpProvider {
  async send(challengeId: string, _phone: string, code: string, expiresAt: Date) {
    const directory = fileURLToPath(new URL('../../../../.local/otp/', import.meta.url));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(`${directory}/${challengeId}.json`, JSON.stringify({ code, expiresAt }), { mode: 0o600, flag: 'wx' });
  }
  async verify(_phone: string, _code: string): Promise<boolean> { throw new Error('Local OTP verification uses the stored challenge hash'); }
}

@Injectable()
export class OtpSender implements OtpProvider {
  private readonly provider: OtpProvider;
  readonly remote: boolean;
  constructor(@Inject(ConfigService) config: ConfigService) {
    this.remote = config.get('OTP_DELIVERY_MODE') === 'twilio';
    if (!this.remote && ['staging', 'production'].includes(config.get<string>('APP_ENVIRONMENT') ?? ''))
      throw new ServiceUnavailableException({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
    this.provider = this.remote ? new TwilioVerifyProvider(config.getOrThrow('TWILIO_VERIFY_SERVICE_SID'),
      config.getOrThrow('TWILIO_ACCOUNT_SID'), config.getOrThrow('TWILIO_AUTH_TOKEN')) : new LocalOtpProvider();
  }
  send(challengeId: string, phone: string, code: string, expiresAt: Date) { return this.provider.send(challengeId, phone, code, expiresAt); }
  verify(phone: string, code: string) { return this.provider.verify(phone, code); }
}
