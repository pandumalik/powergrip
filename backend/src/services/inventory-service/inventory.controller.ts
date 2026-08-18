import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('inventories')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventoryService: InventoryService) {}

  @Get()
  async findAll(
    @Query('scope') scope?: any,
    @Query('type') type?: any,
    @Query('provider') provider?: any,
    @Query('clientId') clientId?: string,
  ) {
    return this.inventoryService.findAll({ scope, type, provider, clientId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'SRE_LEAD', 'DEVOPS_ENGINEER')
  async create(@Body() createInventoryDto: any) {
    return this.inventoryService.create(createInventoryDto);
  }

  @Put(':id')
  @Roles('ADMIN', 'SRE_LEAD')
  async update(@Param('id') id: string, @Body() updateInventoryDto: any) {
    return this.inventoryService.update(id, updateInventoryDto);
  }

  @Patch(':id/specs')
  @Roles('ADMIN', 'SRE_LEAD', 'DEVOPS_ENGINEER')
  async updateSpecs(
    @Param('id') id: string,
    @Body() specsDto: Record<string, any>,
  ) {
    return this.inventoryService.updateSpecs(id, specsDto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SRE_LEAD')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: any,
  ) {
    return this.inventoryService.updateStatus(id, status);
  }
}
