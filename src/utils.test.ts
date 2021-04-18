import { isValidSemVer } from './utils';

describe('isValidSemVer', () => {
  it('returns true for clean SemVer version strings', () => {
    expect(isValidSemVer('0.0.1')).toStrictEqual(true);
    expect(isValidSemVer('0.1.0')).toStrictEqual(true);
    expect(isValidSemVer('1.0.0')).toStrictEqual(true);
    expect(isValidSemVer('1.0.1')).toStrictEqual(true);
    expect(isValidSemVer('1.1.0')).toStrictEqual(true);
    expect(isValidSemVer('1.1.1')).toStrictEqual(true);
    expect(isValidSemVer('1.0.0-0')).toStrictEqual(true);
    expect(isValidSemVer('1.0.0-beta')).toStrictEqual(true);
    expect(isValidSemVer('1.0.0-beta1')).toStrictEqual(true);
    expect(isValidSemVer('1.0.0-beta.1')).toStrictEqual(true);
  });

  it('returns false for non-string values', () => {
    expect(isValidSemVer(null)).toStrictEqual(false);
  });

  it('returns false for v-prefixed SemVer strings', () => {
    expect(isValidSemVer('v1.0.0')).toStrictEqual(false);
  });
});
