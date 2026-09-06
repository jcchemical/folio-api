import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OrganizationMembershipService } from './organization-membership.service.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationMembershipService, OrganizationsService],
  exports: [OrganizationMembershipService, OrganizationsService],
})
export class OrganizationsModule {}
