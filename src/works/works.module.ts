import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { WorksService } from './works.service.js';
import { WorksController } from './works.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
  ],
  providers: [WorksService],
  controllers: [WorksController],
  exports: [WorksService],
})
export class WorksModule {}
