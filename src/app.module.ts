import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { WorksModule } from './works/works.module.js';
import { CataloguesModule } from './catalogues/catalogues.module.js';
import { ExportsModule } from './exports/exports.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { StorageModule } from './storage/storage.module.js';
import { LibrariesModule } from './libraries/libraries.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { HoldingsModule } from './holdings/holdings.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { THROTTLE_LIMIT, THROTTLE_TTL_MS } from './common/throttling.config.js';
import { ExternalIdentifiersModule } from './external-identifiers/external-identifiers.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT }],
      ignoreUserAgents: [/node-fetch/],
    }),
    AuthModule,
    HealthModule,
    UsersModule,
    WorksModule,
    CataloguesModule,
    ExportsModule,
    OrganizationsModule,
    StorageModule,
    LibrariesModule,
    LocationsModule,
    HoldingsModule,
    ExternalIdentifiersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
