import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { projects } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class ProjectService {
  constructor(@Inject(DatabaseService) private dbService: DatabaseService) {}

  async findAll() {
    return this.dbService.db.query.projects.findMany({
      with: {
        client: true,
        contract: true,
        projectManager: true,
        inventories: true,
      },
      orderBy: [desc(projects.createdAt)],
    });
  }

  async findOne(id: string) {
    const project = await this.dbService.db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        client: true,
        contract: true,
        projectManager: true,
        inventories: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
    return project;
  }

  async create(data: any) {
    const [newProject] = await this.dbService.db
      .insert(projects)
      .values(data)
      .returning();
    return newProject;
  }

  async update(id: string, data: any) {
    const [updated] = await this.dbService.db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Project ${id} not found`);
    return updated;
  }

  async assignMember(projectId: string, memberData: { employeeId: string; role: string }) {
    const project = await this.findOne(projectId);
    const existingMembers = (project.assignedMembers as any[]) || [];

    const updatedMembers = [
      ...existingMembers.filter((m) => m.employee_id !== memberData.employeeId),
      {
        employee_id: memberData.employeeId,
        role: memberData.role,
        assigned_at: new Date().toISOString(),
        is_active: true,
      },
    ];

    const [updated] = await this.dbService.db
      .update(projects)
      .set({
        assignedMembers: updatedMembers,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    return updated;
  }

  async removeMember(projectId: string, employeeId: string) {
    const project = await this.findOne(projectId);
    const existingMembers = (project.assignedMembers as any[]) || [];

    const updatedMembers = existingMembers.filter((m) => m.employee_id !== employeeId);

    const [updated] = await this.dbService.db
      .update(projects)
      .set({
        assignedMembers: updatedMembers,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    return updated;
  }

  async delete(id: string) {
    try {
      const [deleted] = await this.dbService.db
        .delete(projects)
        .where(eq(projects.id, id))
        .returning();

      if (!deleted) throw new NotFoundException(`Project ${id} not found`);
      return deleted;
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      if (err.code === '23503' || (err.message && err.message.includes('violates foreign key constraint'))) {
        throw new ConflictException(
          'Cannot delete project because it has assigned inventory resources, team member grants, or contract bindings.'
        );
      }
      throw err;
    }
  }
}
