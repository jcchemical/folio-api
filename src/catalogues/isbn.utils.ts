export function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIsbn(value: string): boolean {
  const isbn = normalizeIsbn(value);

  if (/^\d{9}[\dX]$/.test(isbn)) {
    return isValidIsbn10(isbn);
  }

  if (/^\d{13}$/.test(isbn)) {
    return isValidIsbn13(isbn);
  }

  return false;
}

function isValidIsbn10(isbn: string): boolean {
  const checksum = isbn.split('').reduce((total, character, index) => {
    const digit = character === 'X' ? 10 : Number(character);
    return total + digit * (10 - index);
  }, 0);

  return checksum % 11 === 0;
}

function isValidIsbn13(isbn: string): boolean {
  if (!isbn.startsWith('978') && !isbn.startsWith('979')) {
    return false;
  }

  const checksum = isbn
    .slice(0, 12)
    .split('')
    .reduce(
      (total, character, index) =>
        total + Number(character) * (index % 2 === 0 ? 1 : 3),
      0,
    );

  return (10 - (checksum % 10)) % 10 === Number(isbn[12]);
}
