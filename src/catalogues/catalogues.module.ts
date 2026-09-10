import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module.js';
import { CataloguesController } from './catalogues.controller.js';
import { CataloguesService } from './catalogues.service.js';
import { CatalogueService } from './catalogue.service.js';
import { PorbaseAdapter } from './adapters/porbase.adapter.js';
import { ImportPreviewService } from './import-preview.service.js';
import { PorbaseImportService } from './porbase-import.service.js';
import { PorbaseCatalogueProvider } from './porbase/porbase.provider.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { WorksModule } from '../works/works.module.js';

const timeout = readPositiveEnvironmentNumber('PORBASE_URN_TIMEOUT_MS', 5_000);

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    OrganizationsModule,
    WorksModule,
    HttpModule.register({
      timeout,
      maxRedirects: 0,
    }),
  ],
  controllers: [CataloguesController],
  providers: [
    CatalogueService,
    CataloguesService,
    PorbaseAdapter,
    ImportPreviewService,
    PorbaseImportService,
    PorbaseCatalogueProvider,
  ],
  exports: [CatalogueService, CataloguesService],
})
export class CataloguesModule {}

function readPositiveEnvironmentNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
