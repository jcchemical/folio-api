import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from './jwt.strategy.js';
import {
  JWT_CONFIGURATION,
  JwtConfigurationModule,
  type JwtConfiguration,
} from './jwt.configuration.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtConfigurationModule,
    JwtModule.registerAsync({
      imports: [JwtConfigurationModule],
      inject: [JWT_CONFIGURATION],
      useFactory: (configuration: JwtConfiguration) => ({
        secret: configuration.secret,
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, JwtStrategy],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
