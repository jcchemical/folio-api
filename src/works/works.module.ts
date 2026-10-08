import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { WorksService } from './works.service.js';
import { WorksController } from './works.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EditionsService } from '../editions/editions.service.js';
import { BibliographicRecordsService } from '../bibliographic-records/bibliographic_records.service.js';
import { ItemsService } from '../items/items.service.js';
import { EditionsController } from '../editions/editions.controller.js';
import { BibliographicRecordsController } from '../bibliographic-records/bibliographic_records.controller.js';
import { ItemsController } from '../items/items.controller.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ContributionsService } from '../contributions/contributions.service.js';
import { ContributionsController } from '../contributions/contributions.controller.js';
import { EditionCoverService } from '../editions/edition-cover.service.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    OrganizationsModule,
    StorageModule,
  ],
  providers: [
    WorksService,
    EditionsService,
    EditionCoverService,
    BibliographicRecordsService,
    ItemsService,
    ContributionsService,
  ],
  controllers: [
    WorksController,
    EditionsController,
    BibliographicRecordsController,
    ItemsController,
    ContributionsController,
  ],
  exports: [
    WorksService,
    EditionsService,
    BibliographicRecordsService,
    ItemsService,
    ContributionsService,
  ],
})
export class WorksModule {}
