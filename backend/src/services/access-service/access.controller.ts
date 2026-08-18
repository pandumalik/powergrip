import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Inject } from '@nestjs/common';
import { AccessService } from './access.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, UserContext } from '../../common/decorators/current-user.decorator';

@Controller('accesses')
@UseGuards(AuthGuard)
export class AccessController {
  constructor(@Inject(AccessService) private readonly accessService: AccessService) {}

  @Get()
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('inventoryId') inventoryId?: string,
    @Query('status') status?: any,
  ) {
    return this.accessService.findAll({ employeeId, inventoryId, status });
  }

  @Get('audit-logs')
  @Roles('ADMIN', 'SECURITY_OFFICER')
  async getAuditLogs(
    @Query('inventoryId') inventoryId?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.accessService.getAuditLogs(inventoryId, employeeId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.accessService.findOne(id);
  }

  @Post('request')
  async requestAccess(
    @CurrentUser() user: UserContext,
    @Body()
    body: {
      inventoryId: string;
      projectId?: string;
      accessLevel: any;
      grantType: any;
      durationHours?: number;
      justification: string;
    },
  ) {
    return this.accessService.requestAccess({
      employeeId: user?.userId || 'e1111111-1111-1111-1111-111111111111',
      inventoryId: body.inventoryId,
      projectId: body.projectId,
      accessLevel: body.accessLevel,
      grantType: body.grantType,
      durationHours: body.durationHours,
      justification: body.justification,
    });
  }

  @Patch(':id/endorse')
  @Roles('ADMIN', 'SRE_LEAD', 'PROJECT_MANAGER')
  async endorseAccess(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
    @Body('notes') notes?: string,
  ) {
    return this.accessService.endorseAccess(id, user?.userId || 'e1111111-1111-1111-1111-111111111111', notes);
  }

  @Patch(':id/approve')
  @Roles('ADMIN', 'SRE_LEAD', 'SECURITY_OFFICER')
  async approveAccess(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
    @Body('notes') notes?: string,
  ) {
    return this.accessService.approveAccess(id, user?.userId || 'e1111111-1111-1111-1111-111111111111', notes);
  }

  @Patch(':id/reject')
  @Roles('ADMIN', 'SRE_LEAD', 'SECURITY_OFFICER')
  async rejectAccess(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
    @Body('reason') reason?: string,
  ) {
    return this.accessService.rejectAccess(id, user?.userId || 'e1111111-1111-1111-1111-111111111111', reason);
  }

  @Patch(':id/revoke')
  @Roles('ADMIN', 'SECURITY_OFFICER', 'SRE_LEAD')
  async revokeAccess(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
    @Body('reason') reason?: string,
  ) {
    return this.accessService.revokeAccess(id, user?.userId || 'e1111111-1111-1111-1111-111111111111', reason);
  }
}
