import { describe, expect, it } from 'vitest';
import {
  bibliographicDatePrecision,
  isValidBibliographicDate,
} from './bibliographic-date.js';

describe('bibliographic dates', () => {
  it.each(['2022', '2022-06', '2022-06-21', '2020-02-29'])(
    'accepts %s',
    (value) => {
      expect(isValidBibliographicDate(value)).toBe(true);
    },
  );

  it.each([
    ' 2022',
    '2022 ',
    '2022/06/21',
    '2022-00',
    '2022-13',
    '2022-02-29',
    '2022-06-31',
    '2022-06-21T00:00:00Z',
  ])('rejects %s', (value) => {
    expect(isValidBibliographicDate(value)).toBe(false);
  });

  it.each([
    ['2022', 'YEAR'],
    ['2022-06', 'YEAR_MONTH'],
    ['2022-06-21', 'FULL_DATE'],
  ] as const)('derives precision for %s', (value, precision) => {
    expect(bibliographicDatePrecision(value)).toBe(precision);
  });
});
