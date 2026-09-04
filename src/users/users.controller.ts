import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Criar um novo utilizador' })
  @ApiCreatedResponse({
    description: 'Utilizador criado com sucesso.',
    example: {
      id: 'uuid',
      email: 'andre@exemplo.pt',
      name: 'André',
      createdAt: '2026-09-04T19:00:00.000Z',
      updatedAt: '2026-09-04T19:00:00.000Z',
    },
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os utilizadores' })
  @ApiOkResponse({
    description: 'Lista de utilizadores ordenada por createdAt.',
    type: [Object],
  })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter um utilizador por ID' })
  @ApiOkResponse({
    description: 'Detalhes do utilizador.',
    example: {
      id: 'uuid',
      email: 'andre@exemplo.pt',
      name: 'André',
      createdAt: '2026-09-04T19:00:00.000Z',
      updatedAt: '2026-09-04T19:00:00.000Z',
    },
  })
  @ApiNotFoundResponse({ description: 'Utilizador não encontrado.' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}