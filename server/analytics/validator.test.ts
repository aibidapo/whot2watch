import { describe, it, expect, beforeEach } from 'vitest';
import { validateAnalyticsEvent, validateEnvelope, _resetSchemaCache } from './validator';

beforeEach(() => {
  _resetSchemaCache();
  process.env.ANALYTICS_VALIDATION_ENABLED = 'true';
  process.env.ANALYTICS_VALIDATION_SAMPLE_RATE = '1.0';
});

describe('validateAnalyticsEvent', () => {
  it('valid alert_set passes', () => {
    const result = validateAnalyticsEvent('alert_set', {
      alert_id: '00000000-0000-0000-0000-000000000001',
      type: 'availability',
    });
    expect(result.valid).toBe(true);
  });

  it('invalid alert_set (missing required field) fails', () => {
    const result = validateAnalyticsEvent('alert_set', {
      // Missing alert_id and type
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('unknown event name passes permissively', () => {
    const result = validateAnalyticsEvent('totally_unknown_event', { foo: 'bar' });
    expect(result.valid).toBe(true);
  });

  it('sampling at 0.0 skips validation', () => {
    process.env.ANALYTICS_VALIDATION_SAMPLE_RATE = '0.0';
    const result = validateAnalyticsEvent('alert_set', {
      // Missing required fields — but sampling skips it
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateEnvelope', () => {
  it('valid envelope passes', () => {
    const result = validateEnvelope({
      event_name: 'alert_set',
      ts_iso: new Date().toISOString(),
      anonymous_id: 'anon-123',
      session_id: 'sess-456',
      region: 'US',
      device: 'web',
      private_mode: false,
      properties: { alert_id: 'a1', type: 'availability' },
    });
    expect(result.valid).toBe(true);
  });

  it('invalid envelope (missing required) fails', () => {
    const result = validateEnvelope({
      event_name: 'alert_set',
      // Missing other required fields
    });
    expect(result.valid).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
  });
});
