import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { CloudCredentialService, CloudCredentialDto } from './cloud-credential.service';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('cloud-credentials')
@UseGuards(AuthGuard)
export class CloudCredentialController {
  constructor(
    @Inject(CloudCredentialService) private readonly credService: CloudCredentialService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
  ) {}

  @Get()
  async findAll() {
    return this.credService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.credService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'SRE_LEAD', 'DEVOPS_ENGINEER')
  async create(@Body() dto: CloudCredentialDto) {
    return this.credService.create(dto);
  }

  @Post('batch')
  @Roles('ADMIN', 'SRE_LEAD', 'DEVOPS_ENGINEER')
  async batchCreate(@Body() payload: { items: CloudCredentialDto[] }) {
    return this.credService.batchCreate(payload.items);
  }

  @Put(':id')
  @Roles('ADMIN', 'SRE_LEAD')
  async update(@Param('id') id: string, @Body() updateDto: any) {
    return this.credService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SRE_LEAD')
  async delete(@Param('id') id: string) {
    return this.credService.delete(id);
  }

  @Post(':id/scan')
  @Roles('ADMIN', 'SRE_LEAD', 'DEVOPS_ENGINEER')
  async scanOne(@Param('id') id: string) {
    return this.inventoryService.reScanServiceAccount(id);
  }

  @Post('scan-all')
  @Roles('ADMIN', 'SRE_LEAD', 'DEVOPS_ENGINEER')
  async scanAll() {
    return this.inventoryService.reScanAllActiveCredentials();
  }
}
