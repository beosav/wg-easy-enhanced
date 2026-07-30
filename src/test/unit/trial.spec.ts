import { describe, expect, it } from 'vitest';
import {
  getBearerToken,
  getTrialState,
  hashTrialValue,
  isInstallationToken,
  safeHashEquals,
  trialResponse,
} from '../../server/utils/trial';

describe('trial helpers', () => {
  it('creates stable, secret-dependent hashes', () => {
    const first = hashTrialValue('a'.repeat(32), 'installation-token');
    const repeated = hashTrialValue('a'.repeat(32), 'installation-token');
    const otherSecret = hashTrialValue('b'.repeat(32), 'installation-token');

    expect(first).toBe(repeated);
    expect(first).not.toBe(otherSecret);
    expect(safeHashEquals(first, repeated)).toBe(true);
    expect(safeHashEquals(first, otherSecret)).toBe(false);
  });

  it('parses only a single bearer token', () => {
    expect(getBearerToken('Bearer abc_123')).toBe('abc_123');
    expect(getBearerToken('bearer abc_123')).toBe('abc_123');
    expect(getBearerToken('Basic abc_123')).toBeNull();
    expect(getBearerToken('Bearer abc extra')).toBeNull();
    expect(getBearerToken()).toBeNull();
    expect(isInstallationToken('a'.repeat(43))).toBe(true);
    expect(isInstallationToken('a'.repeat(42))).toBe(false);
    expect(isInstallationToken(`${'a'.repeat(42)}!`)).toBe(false);
  });

  it('reports active, disabled, and expired states', () => {
    const now = new Date('2026-07-30T12:00:00.000Z');
    const future = '2026-07-31T12:00:00.000Z';
    const past = '2026-07-29T12:00:00.000Z';

    expect(getTrialState(future, true, now)).toBe('active');
    expect(getTrialState(future, false, now)).toBe('disabled');
    expect(getTrialState(past, true, now)).toBe('expired');
    expect(trialResponse(future, true, now)).toEqual({
      state: 'active',
      expiresAt: future,
      serverTime: now.toISOString(),
    });
  });
});
