import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LibrariesController } from './libraries.controller.js';
import { LibrariesService } from './libraries.service.js';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    OrganizationsModule,
    PrismaModule,
  ],
  controllers: [LibrariesController],
  providers: [LibrariesService],
})
export class LibrariesModule {}
