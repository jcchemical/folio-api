import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { invalidAccessToken } from '../common/api-errors.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    error: unknown,
    user: TUser | null | false,
  ): TUser {
    if (error || !user) throw invalidAccessToken();
    return user as TUser;
  }
}
