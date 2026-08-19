import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { accessGrants, accessAuditLogs } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';

@Injectable()
export class AccessService {
  constructor(@Inject(DatabaseService) private dbService: DatabaseService) {}

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
    const now = new Date();
    const durationHours = data.durationHours || 4;
    const requestedEndTime = new Date(now.getTime() + durationHours * 3600 * 1000);

    const [grant] = await this.dbService.db
      .insert(accessGrants)
      .values({
        employeeId: data.employeeId,
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
      employeeId: data.employeeId,
      inventoryId: data.inventoryId,
      action: 'ACCESS_REQUESTED',
      metadata: { accessLevel: grant.accessLevel, durationHours },
    });

    return grant;
  }

  async endorseAccess(id: string, endorserId: string, notes?: string) {
    const grant = await this.findOne(id);
    if (grant.status !== 'PENDING') {
      throw new BadRequestException(`Cannot endorse grant in ${grant.status} state`);
    }

    const [updated] = await this.dbService.db
      .update(accessGrants)
      .set({
        status: 'ENDORSED',
        reviewedBy: endorserId,
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

    const now = new Date();
    const durationHours = (grant.metadata as any)?.requestedDurationHours || 4;
    const validUntil = new Date(now.getTime() + durationHours * 3600 * 1000);

    const [updated] = await this.dbService.db
      .update(accessGrants)
      .set({
        status: 'ACTIVE',
        validFrom: now,
        validUntil: validUntil,
        reviewedBy: approverId,
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
      metadata: { approvedBy: approverId, validUntil: validUntil.toISOString() },
    });

    return updated;
  }

  async rejectAccess(id: string, approverId: string, reason?: string) {
    const grant = await this.findOne(id);

    const [updated] = await this.dbService.db
      .update(accessGrants)
      .set({
        status: 'REJECTED',
        reviewedBy: approverId,
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

    const [updated] = await this.dbService.db
      .update(accessGrants)
      .set({
        status: 'REVOKED',
        revokedBy: revokerId,
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
      metadata: { revokedBy: revokerId, reason },
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
    const [log] = await this.dbService.db
      .insert(accessAuditLogs)
      .values(data)
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
    const [deleted] = await this.dbService.db
      .delete(accessGrants)
      .where(eq(accessGrants.id, id))
      .returning();

    if (!deleted) throw new NotFoundException(`Access grant ${id} not found`);
    return deleted;
  }
}
