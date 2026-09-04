import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar saúde da API e ligação à base de dados' })
  @ApiOkResponse({
    description: 'API e base de dados operacionais.',
    example: {
      status: 'ok',
      database: 'connected',
      timestamp: '2026-09-04T19:00:00.000Z',
    },
  })
  async check() {
    return this.healthService.check();
  }
}