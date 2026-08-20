import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { employees, departments } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class EmployeeService {
  constructor(@Inject(DatabaseService) private dbService: DatabaseService) {}

  async findAll() {
    return this.dbService.db.query.employees.findMany({
      with: {
        department: true,
        manager: true,
        accessGrants: true,
      },
      orderBy: [desc(employees.createdAt)],
    });
  }

  async findOne(id: string) {
    const employee = await this.dbService.db.query.employees.findFirst({
      where: eq(employees.id, id),
      with: {
        department: true,
        manager: true,
        accessGrants: {
          with: {
            inventory: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return employee;
  }

  async findByUserId(userId: string) {
    return this.dbService.db.query.employees.findFirst({
      where: eq(employees.userId, userId),
      with: {
        department: true,
      },
    });
  }

  async create(data: any) {
    // Generate hierarchy path based on manager
    let hierarchyPath = data.employeeNumber;
    if (data.managerId) {
      const manager = await this.findOne(data.managerId);
      if (manager && manager.hierarchyPath) {
        hierarchyPath = `${manager.hierarchyPath}.${data.employeeNumber}`;
      }
    }

    const [newEmployee] = await this.dbService.db
      .insert(employees)
      .values({ ...data, hierarchyPath })
      .returning();
    return newEmployee;
  }

  async update(id: string, data: any) {
    const [updated] = await this.dbService.db
      .update(employees)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Employee ${id} not found`);
    return updated;
  }

  async offboard(id: string, exitDate?: string) {
    const [updated] = await this.dbService.db
      .update(employees)
      .set({
        employmentStatus: 'TERMINATED',
        exitDate: exitDate || new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id))
      .returning();

    return updated;
  }

  // Department methods
  async findAllDepartments() {
    return this.dbService.db.select().from(departments);
  }

  async createDepartment(data: any) {
    const [newDept] = await this.dbService.db
      .insert(departments)
      .values(data)
      .returning();
    return newDept;
  }

  async delete(id: string) {
    try {
      const [deleted] = await this.dbService.db
        .delete(employees)
        .where(eq(employees.id, id))
        .returning();

      if (!deleted) throw new NotFoundException(`Employee ${id} not found`);
      return deleted;
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      if (err.code === '23503' || (err.message && err.message.includes('violates foreign key constraint'))) {
        throw new ConflictException(
          'Cannot delete employee because they are assigned to projects, access grants, or department structures. Initiate employee offboarding instead.'
        );
      }
      throw err;
    }
  }
}
