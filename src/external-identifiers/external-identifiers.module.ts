import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ExternalIdentifiersController } from './external-identifiers.controller.js';
import { ExternalIdentifiersService } from './external_identifiers.service.js';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    OrganizationsModule,
    PrismaModule,
  ],
  controllers: [ExternalIdentifiersController],
  providers: [ExternalIdentifiersService],
})
export class ExternalIdentifiersModule {}
