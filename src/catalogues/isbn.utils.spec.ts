import { describe, expect, it } from 'vitest';
import { isValidIsbn, normalizeIsbn } from './isbn.utils.js';

describe('ISBN utilities', () => {
  it('removes spaces and hyphens and uppercases ISBN-10 suffixes', () => {
    expect(normalizeIsbn(' 0-306-40615-x ')).toBe('030640615X');
    expect(normalizeIsbn('978 972-44-2649-5')).toBe('9789724426495');
  });

  it('accepts valid ISBN-10 and ISBN-13 values', () => {
    expect(isValidIsbn('0-306-40615-2')).toBe(true);
    expect(isValidIsbn('9789724426495')).toBe(true);
  });

  it('rejects invalid check digits and unsupported formats', () => {
    expect(isValidIsbn('9789724426496')).toBe(false);
    expect(isValidIsbn('123456789')).toBe(false);
    expect(isValidIsbn('978972442649')).toBe(false);
  });
});
