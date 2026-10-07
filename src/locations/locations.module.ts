import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LocationsController } from './locations.controller.js';
import { LocationsService } from './locations.service.js';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    OrganizationsModule,
    PrismaModule,
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
