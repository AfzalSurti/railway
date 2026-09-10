import { describe, expect, it } from 'vitest';
import { toHumanActionType } from '../src/services/humanAction.service';

describe('toHumanActionType', () => {
  it('maps known action-required names to a HumanActionType', () => {
    expect(toHumanActionType('LOGIN')).toBe('LOGIN');
    expect(toHumanActionType('otp')).toBe('OTP');
    expect(toHumanActionType('CAPTCHA')).toBe('CAPTCHA');
    expect(toHumanActionType('PAYMENT')).toBe('PAYMENT');
    expect(toHumanActionType('CONFIRMATION')).toBe('CONFIRMATION');
    expect(toHumanActionType('MANUAL_REVIEW')).toBe('MANUAL_REVIEW');
  });

  it('falls back to MANUAL_REVIEW for unknown or missing names', () => {
    expect(toHumanActionType(null)).toBe('MANUAL_REVIEW');
    expect(toHumanActionType(undefined)).toBe('MANUAL_REVIEW');
    expect(toHumanActionType('NONE')).toBe('MANUAL_REVIEW');
    expect(toHumanActionType('something-else')).toBe('MANUAL_REVIEW');
  });
});
