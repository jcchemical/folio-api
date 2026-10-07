import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OrganizationMembershipService } from './organization-membership.service.js';
import { OrganizationContextResolver } from './organization-context.resolver.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
  ],
  controllers: [OrganizationsController],
  providers: [
    OrganizationMembershipService,
    OrganizationContextResolver,
    OrganizationsService,
  ],
  exports: [
    OrganizationMembershipService,
    OrganizationContextResolver,
    OrganizationsService,
  ],
})
export class OrganizationsModule {}
