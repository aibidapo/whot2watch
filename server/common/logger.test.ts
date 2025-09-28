import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from './logger';

describe('Logger', () => {
  let spyInfo: any;
  let spyWarn: any;
  let spyError: any;
  let spyDebug: any;

  beforeEach(() => {
    spyInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    spyDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts sensitive fields', () => {
    const logger = new Logger({ level: 'debug' });
    logger.info('test', { token: 'secret', deep: { password: 'p', keep: 'ok' } });
    expect(spyInfo).toHaveBeenCalledTimes(1);
    const arg = spyInfo.mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed.meta.token).toBe('[REDACTED]');
    expect(parsed.meta.deep.password).toBe('[REDACTED]');
    expect(parsed.meta.deep.keep).toBe('ok');
  });

  it('honors minimum log level', () => {
    const logger = new Logger({ level: 'warn' });
    logger.debug('nope');
    logger.info('nope');
    logger.warn('show');
    logger.error('show');
    expect(spyDebug).not.toHaveBeenCalled();
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalled();
    expect(spyError).toHaveBeenCalled();
  });
});
