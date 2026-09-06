import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedUser } from './auth.types.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { LoginDto } from './dto/login.dto.js';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Authenticate a user and issue a JWT' })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token and issue new tokens' })
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token session' })
  async logout(@Body() body: RefreshTokenDto): Promise<{ success: true }> {
    await this.authService.logout(body.refreshToken);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Return the authenticated user' })
  me(@Req() request: Request): Promise<AuthenticatedUser> {
    return this.authService.getCurrentUser(
      (request.user as AuthenticatedUser).id,
    );
  }
}
