import { Injectable } from '@nestjs/common';
import { env } from 'src/utils/env';
import * as fs from 'fs';
import * as http2 from 'http2';
import * as jwt from 'jsonwebtoken';

type PushType = 'alert' | 'background' | 'voip' | 'complication' | 'fileprovider' | 'mdm';

export interface ApnsAlertPayload {
  title: string;
  body: string;
}

export interface ApnsPayload {
  aps: {
    alert?: ApnsAlertPayload | string;
    sound?: string | { critical?: number; name?: string; volume?: number };
    badge?: number;
    'content-available'?: number;
    category?: string;
    'mutable-content'?: number;
  };
  [key: string]: unknown;
}

@Injectable()
export class ApnsService {
  private keyId?: string;
  private teamId?: string;
  private bundleId?: string;
  private privateKey?: string;
  private useSandbox = false;

  constructor() {
    this.keyId = env.APNS_KEY_ID;
    this.teamId = env.APNS_TEAM_ID;
    this.bundleId = env.APNS_BUNDLE_ID;
    const keyPath = env.APNS_P8_PATH;
    this.useSandbox = (env.APNS_ENV ?? 'production') !== 'production';

    if (keyPath && fs.existsSync(keyPath)) {
      this.privateKey = fs.readFileSync(keyPath, 'utf8');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.keyId && this.teamId && this.bundleId && this.privateKey);
  }

  async sendToTokens(tokens: string[], alert: { title: string; body: string }, custom?: Record<string, unknown>, pushType: PushType = 'alert', collapseId?: string, imageUrl?: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    const audience = this.useSandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
    const client = http2.connect(audience);

    const token = this.createJwt();

    const payload: ApnsPayload = {
      aps: {
        alert,
        sound: 'default',
        ...(imageUrl ? { 'mutable-content': 1 } : {}),
      },
      ...(custom ?? {}),
      ...(imageUrl ? { imageUrl } : {}),
    };

    await Promise.all(tokens.map(async (deviceToken) => {
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        'authorization': `bearer ${token}`,
        'apns-topic': this.bundleId!,
        'apns-push-type': pushType,
        ...(collapseId ? { 'apns-collapse-id': collapseId } : {}),
      });

      const data = JSON.stringify(payload);
      return await new Promise<void>((resolve) => {
        req.setEncoding('utf8');
        req.on('response', () => { /* noop */ });
        req.on('error', () => resolve());
        req.on('end', () => resolve());
        req.end(data);
      });
    }));

    client.close();
  }

  private createJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign({ iss: this.teamId, iat: now }, this.privateKey!, {
      algorithm: 'ES256',
      keyid: this.keyId,
    });
  }
}
