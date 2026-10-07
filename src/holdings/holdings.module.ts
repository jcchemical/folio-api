import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HoldingsController } from './holdings.controller.js';
import { HoldingsService } from './holdings.service.js';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    OrganizationsModule,
    PrismaModule,
  ],
  controllers: [HoldingsController],
  providers: [HoldingsService],
})
export class HoldingsModule {}
