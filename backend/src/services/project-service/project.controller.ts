import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { ProjectService } from './project.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectController {
  constructor(@Inject(ProjectService) private readonly projectService: ProjectService) {}

  @Get()
  async findAll() {
    return this.projectService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.projectService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'PROJECT_MANAGER', 'SRE_LEAD')
  async create(@Body() createProjectDto: any) {
    return this.projectService.create(createProjectDto);
  }

  @Put(':id')
  @Roles('ADMIN', 'PROJECT_MANAGER')
  async update(@Param('id') id: string, @Body() updateProjectDto: any) {
    return this.projectService.update(id, updateProjectDto);
  }

  @Post(':id/members')
  @Roles('ADMIN', 'PROJECT_MANAGER', 'SRE_LEAD')
  async assignMember(
    @Param('id') id: string,
    @Body() memberDto: { employeeId: string; role: string },
  ) {
    return this.projectService.assignMember(id, memberDto);
  }

  @Delete(':id/members/:employeeId')
  @Roles('ADMIN', 'PROJECT_MANAGER', 'SRE_LEAD')
  async removeMember(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.projectService.removeMember(id, employeeId);
  }
}
