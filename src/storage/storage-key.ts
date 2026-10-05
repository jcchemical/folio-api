const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;

export function assertSafeOrganizationId(organizationId: string): void {
  if (
    !organizationId ||
    !SAFE_PATH_SEGMENT.test(organizationId) ||
    organizationId === '.' ||
    organizationId === '..'
  ) {
    throw new Error('Invalid organization id for storage path');
  }
}

export function parseStorageKey(storageKey: string): [string, string] {
  // A storage key is exactly two safe components: organizationId/cuid.
  // The one slash is the required separator, not an arbitrary path.
  const segments = storageKey.split('/');
  if (
    segments.length !== 2 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        !SAFE_PATH_SEGMENT.test(segment),
    ) ||
    storageKey.includes('\\')
  ) {
    throw new Error('Invalid storage key');
  }

  return [segments[0], segments[1]];
}
