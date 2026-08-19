import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { ClientService } from './client.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('clients')
@UseGuards(AuthGuard)
export class ClientController {
  constructor(@Inject(ClientService) private readonly clientService: ClientService) {}

  @Get()
  async findAll() {
    return this.clientService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.clientService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'PROJECT_MANAGER')
  async create(@Body() createClientDto: any) {
    return this.clientService.create(createClientDto);
  }

  @Put(':id')
  @Roles('ADMIN', 'PROJECT_MANAGER')
  async update(@Param('id') id: string, @Body() updateClientDto: any) {
    return this.clientService.update(id, updateClientDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async delete(@Param('id') id: string) {
    return this.clientService.delete(id);
  }

  @Post(':id/contracts')
  @Roles('ADMIN', 'PROJECT_MANAGER')
  async createContract(@Param('id') id: string, @Body() createContractDto: any) {
    return this.clientService.createContract(id, createContractDto);
  }

  @Get(':id/contracts')
  async getContracts(@Param('id') id: string) {
    return this.clientService.getContracts(id);
  }
}
