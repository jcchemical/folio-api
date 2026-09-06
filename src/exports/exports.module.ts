import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ExportsController } from './exports.controller.js';
import { ExportsService } from './exports.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
