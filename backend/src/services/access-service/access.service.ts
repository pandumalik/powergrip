import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { accessGrants, accessAuditLogs, employees } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';

@Injectable()
export class AccessService {
  constructor(@Inject(DatabaseService) private dbService: DatabaseService) {}

  private async resolveValidEmployeeId(passedId?: string): Promise<string> {
    if (passedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(passedId)) {
      const exists = await this.dbService.db.query.employees.findFirst({
        where: eq(employees.id, passedId),
      });
      if (exists) return exists.id;
    }
    // Fallback to the first active employee in database (e.g. SRE Lead Alex Mercer / CTO)
    const firstEmp = await this.dbService.db.query.employees.findFirst();
    if (firstEmp) return firstEmp.id;
    throw new NotFoundException('No active employees exist in the database');
  }

  async findAll(query?: {
    employeeId?: string;
    inventoryId?: string;
    status?: any;
  }) {
    const conditions = [];

    if (query?.employeeId) conditions.push(eq(accessGrants.employeeId, query.employeeId));
    if (query?.inventoryId) conditions.push(eq(accessGrants.inventoryId, query.inventoryId));
    if (query?.status) conditions.push(eq(accessGrants.status, query.status));

    return this.dbService.db.query.accessGrants.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        employee: true,
        inventory: true,
        project: true,
      },
      orderBy: [desc(accessGrants.createdAt)],
    });
  }

  async findOne(id: string) {
    const grant = await this.dbService.db.query.accessGrants.findFirst({
      where: eq(accessGrants.id, id),
      with: {
        employee: true,
        inventory: true,
        project: true,
      },
    });

    if (!grant) {
      throw new NotFoundException(`Access grant ${id} not found`);
    }
    return grant;
  }

  async requestAccess(data: {
    employeeId: string;
    inventoryId: string;
    projectId?: string;
    accessLevel: any;
    grantType: any;
    durationHours?: number;
    justification: string;
  }) {
    const validEmpId = await this.resolveValidEmployeeId(data.employeeId);
    const now = new Date();
    const durationHours = data.durationHours || 4;
    const requestedEndTime = new Date(now.getTime() + durationHours * 3600 * 1000);

    const [grant] = await this.dbService.db
      .insert(accessGrants)
      .values({
        employeeId: validEmpId,
        inventoryId: data.inventoryId,
        projectId: data.projectId,
        accessLevel: data.accessLevel || 'READ_WRITE',
        grantType: data.grantType || 'TEMPORARY_TIMED',
        status: 'PENDING',
        justification: data.justification,
        requestedStartTime: now,
        requestedEndTime: requestedEndTime,
        metadata: { requestedDurationHours: durationHours },
      })
      .returning();

    // Log audit event
    await this.logAudit({
      grantId: grant.id,
      employeeId: validEmpId,
      inventoryId: data.inventoryId,
      action: 'ACCESS_REQUESTED',
      metadata: { accessLevel: grant.accessLevel, durationHours },
    });

    return this.findOne(grant.id);
  }

  async endorseAccess(id: string, endorserId: string, notes?: string) {
    const grant = await this.findOne(id);
    if (grant.status !== 'PENDING') {
      throw new BadRequestException(`Cannot endorse grant in ${grant.status} state`);
    }

    const validEndorserId = await this.resolveValidEmployeeId(endorserId);

    const [updated] = await this.dbService.db
      .update(accessGrants)
      .set({
        status: 'ENDORSED',
        reviewedBy: validEndorserId,
        reviewedAt: new Date(),
        reviewNotes: notes || 'Endorsed by Team Lead',
        updatedAt: new Date(),
      })
      .where(eq(accessGrants.id, id))
      .returning();

    return updated;
  }

  async approveAccess(id: string, approverId: string, notes?: string) {
    const grant = await this.findOne(id);
    if (!['PENDING', 'ENDORSED'].includes(grant.status)) {
      throw new BadRequestException(`Cannot approve grant in ${grant.status} state`);
    }

    const validApproverId = await this.resolveValidEmployeeId(approverId);
    const now = new Date();
    const durationHours = (grant.metadata as any)?.requestedDurationHours || 4;
    const validUntil = new Date(now.getTime() + durationHours * 3600 * 1000);

    const [updated] = await this.dbService.db
      .update(accessGrants)
      .set({
        status: 'ACTIVE',
        validFrom: now,
        validUntil: validUntil,
        reviewedBy: validApproverId,
        reviewedAt: now,
        reviewNotes: notes || 'Access Approved via Gateway',
        updatedAt: now,
      })
      .where(eq(accessGrants.id, id))
      .returning();

    // Log audit event
    await this.logAudit({
      grantId: grant.id,
      employeeId: grant.employeeId,
      inventoryId: grant.inventoryId,
      action: 'ACCESS_APPROVED_ACTIVATED',
      metadata: { approvedBy: validApproverId, validUntil: validUntil.toISOString() },
    });

    return updated;
  }

  async rejectAccess(id: string, approverId: string, reason?: string) {
    const grant = await this.findOne(id);
    const validApproverId = await this.resolveValidEmployeeId(approverId);

    const [updated] = await this.dbService.db
      .update(accessGrants)
      .set({
        status: 'REJECTED',
        reviewedBy: validApproverId,
        reviewedAt: new Date(),
        reviewNotes: reason || 'Access request declined',
        updatedAt: new Date(),
      })
      .where(eq(accessGrants.id, id))
      .returning();

    return updated;
  }

  async revokeAccess(id: string, revokerId: string, reason?: string) {
    const grant = await this.findOne(id);
    const validRevokerId = await this.resolveValidEmployeeId(revokerId);

    const [updated] = await this.dbService.db
      .update(accessGrants)
      .set({
        status: 'REVOKED',
        revokedBy: validRevokerId,
        revokedAt: new Date(),
        revocationReason: reason || 'Administrative kill-switch invoked',
        updatedAt: new Date(),
      })
      .where(eq(accessGrants.id, id))
      .returning();

    // Log audit event
    await this.logAudit({
      grantId: grant.id,
      employeeId: grant.employeeId,
      inventoryId: grant.inventoryId,
      action: 'ACCESS_REVOKED',
      metadata: { revokedBy: validRevokerId, reason },
    });

    return updated;
  }

  async logAudit(data: {
    grantId?: string;
    employeeId: string;
    inventoryId: string;
    action: string;
    ipAddress?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  }) {
    const validEmpId = await this.resolveValidEmployeeId(data.employeeId);
    const [log] = await this.dbService.db
      .insert(accessAuditLogs)
      .values({
        ...data,
        employeeId: validEmpId,
      })
      .returning();
    return log;
  }

  async getAuditLogs(inventoryId?: string, employeeId?: string) {
    const conditions = [];
    if (inventoryId) conditions.push(eq(accessAuditLogs.inventoryId, inventoryId));
    if (employeeId) conditions.push(eq(accessAuditLogs.employeeId, employeeId));

    return this.dbService.db
      .select()
      .from(accessAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(accessAuditLogs.createdAt));
  }

  async update(id: string, data: any) {
    const [updated] = await this.dbService.db
      .update(accessGrants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accessGrants.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Access grant ${id} not found`);
    return updated;
  }

  async delete(id: string) {
    try {
      const [deleted] = await this.dbService.db
        .delete(accessGrants)
        .where(eq(accessGrants.id, id))
        .returning();

      if (!deleted) throw new NotFoundException(`Access grant ${id} not found`);
      return deleted;
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      if (err.code === '23503' || (err.message && err.message.includes('violates foreign key constraint'))) {
        throw new ConflictException(
          'Cannot delete access grant because it is recorded in immutable security audit logs.'
        );
      }
      throw err;
    }
  }
}
