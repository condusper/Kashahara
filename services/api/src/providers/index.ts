import type { Config } from '../config';
import { BigisubVtuProvider } from './bigisub';
import { HttpVtuProvider } from './http';
import { MockVtuProvider } from './mock';
import { OgdamsVtuProvider } from './ogdams';
import type { VtuProvider } from './types';

export * from './types';
export { MockVtuProvider } from './mock';
export { HttpVtuProvider } from './http';
export { OgdamsVtuProvider } from './ogdams';
export { BigisubVtuProvider } from './bigisub';

export function createProvider(config: Config, fetchImpl?: typeof fetch): VtuProvider {
  if (config.vtuProvider === 'bigisub') {
    if (!config.bigisubApiToken || !config.bigisubTransactionPin) {
      throw new Error(
        'Bigisub provider selected without BIGISUB_API_TOKEN and BIGISUB_TRANSACTION_PIN',
      );
    }
    return new BigisubVtuProvider({
      baseUrl: config.bigisubBaseUrl,
      apiToken: config.bigisubApiToken,
      pin: config.bigisubTransactionPin,
      markupPercent: config.dataMarkupPercent,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
  }
  if (config.vtuProvider === 'ogdams') {
    if (!config.ogdamsApiKey) {
      throw new Error('Ogdams provider selected without OGDAMS_API_KEY');
    }
    return new OgdamsVtuProvider({
      baseUrl: config.ogdamsBaseUrl,
      apiKey: config.ogdamsApiKey,
      airtimeType: config.ogdamsAirtimeType,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
  }
  if (config.vtuProvider === 'http') {
    if (!config.vtuBaseUrl || !config.vtuApiKey) {
      throw new Error('HTTP VTU provider selected without credentials');
    }
    return new HttpVtuProvider({
      baseUrl: config.vtuBaseUrl,
      apiKey: config.vtuApiKey,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
  }
  return new MockVtuProvider();
}
