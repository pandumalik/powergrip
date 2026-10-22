import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('employees')
@UseGuards(AuthGuard)
export class EmployeeController {
  constructor(@Inject(EmployeeService) private readonly employeeService: EmployeeService) {}

  @Get()
  async findAll() {
    return this.employeeService.findAll();
  }

  @Get('departments')
  async findAllDepartments() {
    return this.employeeService.findAllDepartments();
  }

  @Post('departments')
  @Roles('ADMIN')
  async createDepartment(@Body() createDeptDto: any) {
    return this.employeeService.createDepartment(createDeptDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.employeeService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() createEmployeeDto: any) {
    return this.employeeService.create(createEmployeeDto);
  }

  @Put(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() updateEmployeeDto: any) {
    return this.employeeService.update(id, updateEmployeeDto);
  }

  @Patch(':id/offboard')
  @Roles('ADMIN', 'SECURITY_OFFICER')
  async offboard(
    @Param('id') id: string,
    @Body('exitDate') exitDate?: string,
  ) {
    return this.employeeService.offboard(id, exitDate);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async delete(@Param('id') id: string) {
    return this.employeeService.delete(id);
  }
}
