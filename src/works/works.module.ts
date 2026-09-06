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
import { EditionsController } from '../editions/editions.controller.js';
import { ContributorsController } from '../contributors/contributors.controller.js';
import { BibliographicRecordsController } from '../bibliographic-records/bibliographic_records.controller.js';
import { ItemsController } from '../items/items.controller.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    OrganizationsModule,
  ],
  providers: [
    WorksService,
    EditionsService,
    ContributorsService,
    ExternalIdentifiersService,
    BibliographicRecordsService,
    ItemsService,
  ],
  controllers: [
    WorksController,
    EditionsController,
    ContributorsController,
    BibliographicRecordsController,
    ItemsController,
  ],
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
