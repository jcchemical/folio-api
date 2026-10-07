import { HttpStatus } from '@nestjs/common';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';

export type HoldingOwnership = {
  edition: { work: { organizationId: string } };
  location: { library: { organizationId: string } };
};

export function requireHoldingOrganization(holding: HoldingOwnership): string {
  const editionOrganizationId = holding.edition.work.organizationId;
  const locationOrganizationId = holding.location.library.organizationId;

  if (editionOrganizationId !== locationOrganizationId) {
    throw new ApiException(
      HttpStatus.CONFLICT,
      API_ERROR_CODES.ORGANIZATION_CONTEXT_CONFLICT,
      'The Holding Edition and Location must belong to the same organization.',
    );
  }

  return editionOrganizationId;
}
