import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { clients, contracts } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class ClientService {
  constructor(@Inject(DatabaseService) private dbService: DatabaseService) {}

  async findAll() {
    return this.dbService.db.query.clients.findMany({
      with: {
        contracts: true,
        projects: true,
      },
      orderBy: [desc(clients.createdAt)],
    });
  }

  async findOne(id: string) {
    const client = await this.dbService.db.query.clients.findFirst({
      where: eq(clients.id, id),
      with: {
        contracts: true,
        projects: true,
        inventories: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    return client;
  }

  async create(data: any) {
    const [newClient] = await this.dbService.db
      .insert(clients)
      .values(data)
      .returning();
    return newClient;
  }

  async update(id: string, data: any) {
    const [updated] = await this.dbService.db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Client ${id} not found`);
    return updated;
  }

  async createContract(clientId: string, data: any) {
    await this.findOne(clientId);
    const [newContract] = await this.dbService.db
      .insert(contracts)
      .values({ ...data, clientId })
      .returning();
    return newContract;
  }

  async getContracts(clientId?: string) {
    if (clientId) {
      return this.dbService.db.select().from(contracts).where(eq(contracts.clientId, clientId));
    }
    return this.dbService.db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }

  async delete(id: string) {
    const [deleted] = await this.dbService.db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning();

    if (!deleted) throw new NotFoundException(`Client ${id} not found`);
    return deleted;
  }
}
