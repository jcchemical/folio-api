import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { WorksService } from './works.service.js';
import { WorksController } from './works.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EditionsService } from '../editions/editions.service.js';
import { ContributorsService } from '../contributors/contributors.service.js';
import { ExternalIdentifiersService } from '../external-identifiers/external_identifiers.service.js';
import { BibliographicRecordsService } from '../bibliographic-records/bibliographic_records.service.js';
import { ItemsService } from '../items/items.service.js';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
  ],
  providers: [
    WorksService,
    EditionsService,
    ContributorsService,
    ExternalIdentifiersService,
    BibliographicRecordsService,
    ItemsService,
  ],
  controllers: [WorksController],
  exports: [
    WorksService,
    EditionsService,
    ContributorsService,
    ExternalIdentifiersService,
    BibliographicRecordsService,
    ItemsService,
  ],
})
export class WorksModule {}
