import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { inventories } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';

@Injectable()
export class InventoryService {
  constructor(@Inject(DatabaseService) private dbService: DatabaseService) {}

  async findAll(query?: {
    scope?: any;
    type?: any;
    provider?: any;
    clientId?: string;
  }) {
    const conditions = [];

    if (query?.scope) conditions.push(eq(inventories.assetScope, query.scope));
    if (query?.type) conditions.push(eq(inventories.assetType, query.type));
    if (query?.provider) conditions.push(eq(inventories.provider, query.provider));
    if (query?.clientId) conditions.push(eq(inventories.clientId, query.clientId));

    return this.dbService.db.query.inventories.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        client: true,
        project: true,
        accessGrants: true,
      },
      orderBy: [desc(inventories.createdAt)],
    });
  }

  async findOne(id: string) {
    const item = await this.dbService.db.query.inventories.findFirst({
      where: eq(inventories.id, id),
      with: {
        client: true,
        project: true,
        accessGrants: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return item;
  }

  async create(data: any) {
    const [newItem] = await this.dbService.db
      .insert(inventories)
      .values(data)
      .returning();
    return newItem;
  }

  async update(id: string, data: any) {
    const [updated] = await this.dbService.db
      .update(inventories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inventories.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Inventory item ${id} not found`);
    return updated;
  }

  async updateSpecs(id: string, specs: Record<string, any>) {
    const item = await this.findOne(id);
    const updatedSpecs = { ...(item.specs as Record<string, any>), ...specs };

    const [updated] = await this.dbService.db
      .update(inventories)
      .set({
        specs: updatedSpecs,
        updatedAt: new Date(),
      })
      .where(eq(inventories.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Inventory item ${id} not found`);
    return updated;
  }

  async updateStatus(id: string, status: any) {
    const [updated] = await this.dbService.db
      .update(inventories)
      .set({ status, updatedAt: new Date() })
      .where(eq(inventories.id, id))
      .returning();

    return updated;
  }
}
