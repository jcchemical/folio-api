import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const YEAR_PATTERN = /^(\d{4})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidBibliographicDate(value: string): boolean {
  const yearMatch = YEAR_PATTERN.exec(value);
  if (yearMatch) return true;

  const monthMatch = MONTH_PATTERN.exec(value);
  if (monthMatch) {
    const month = Number(monthMatch[2]);
    return month >= 1 && month <= 12;
  }

  const dateMatch = DATE_PATTERN.exec(value);
  if (!dateMatch) return false;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function IsBibliographicDate(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      name: 'isBibliographicDate',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options,
      validator: {
        validate(value: unknown, _args: ValidationArguments): boolean {
          return typeof value === 'string' && isValidBibliographicDate(value);
        },
        defaultMessage(): string {
          return 'Date must use YYYY, YYYY-MM, or YYYY-MM-DD format.';
        },
      },
    });
  };
}

export type BibliographicDatePrecision = 'YEAR' | 'YEAR_MONTH' | 'FULL_DATE';

export function bibliographicDatePrecision(value: string): BibliographicDatePrecision {
  if (YEAR_PATTERN.test(value)) return 'YEAR';
  if (MONTH_PATTERN.test(value)) return 'YEAR_MONTH';
  return 'FULL_DATE';
}
