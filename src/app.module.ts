import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { InstitutionsModule } from './institutions/institutions.module.js';
import { WorksModule } from './works/works.module.js';
import { CataloguesModule } from './catalogues/catalogues.module.js';
import { ExportsModule } from './exports/exports.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    AuthModule,
    HealthModule,
    UsersModule,
    InstitutionsModule,
    WorksModule,
    CataloguesModule,
    ExportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
