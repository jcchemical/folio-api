import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { InstitutionsModule } from './institutions/institutions.module.js';
import { WorksModule } from './works/works.module.js';

@Module({
  imports: [
    AuthModule,
    HealthModule,
    UsersModule,
    InstitutionsModule,
    WorksModule,
  ],
})
export class AppModule {}
