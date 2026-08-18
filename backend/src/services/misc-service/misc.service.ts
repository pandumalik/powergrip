import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { misc } from '../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class MiscService {
  constructor(
    @Inject(DatabaseService)
    private readonly dbService: DatabaseService,
  ) {}

  async getAll() {
    return this.dbService.db.select().from(misc);
  }

  async getByKey(key: string) {
    const upperKey = key.toUpperCase();
    const [found] = await this.dbService.db.select().from(misc).where(eq(misc.key, upperKey));
    if (!found) {
      if (upperKey === 'INDUSTRIES') {
        return {
          key: 'INDUSTRIES',
          value: [
            'Financial Services',
            'E-Commerce & Retail',
            'Healthcare & Pharma',
            'Telecommunications',
            'Logistics & Supply Chain',
            'Government & Public Sector',
            'Energy & Mining',
            'Media & Entertainment',
            'Software & SaaS',
          ],
        };
      }
      throw new NotFoundException(`Misc entry with key ${key} not found`);
    }
    return found;
  }

  async setKey(key: string, value: any, description?: string) {
    const upperKey = key.toUpperCase();
    const [existing] = await this.dbService.db.select().from(misc).where(eq(misc.key, upperKey));
    if (existing) {
      const [updated] = await this.dbService.db
        .update(misc)
        .set({
          value,
          description: description !== undefined ? description : existing.description,
          updatedAt: new Date(),
        })
        .where(eq(misc.key, upperKey))
        .returning();
      return updated;
    }

    const [created] = await this.dbService.db
      .insert(misc)
      .values({
        key: upperKey,
        value,
        description,
      })
      .returning();
    return created;
  }

  async appendToList(key: string, item: any) {
    const upperKey = key.toUpperCase();
    let current: any[] = [];
    try {
      const entry = await this.getByKey(upperKey);
      if (Array.isArray(entry.value)) {
        current = entry.value;
      }
    } catch {
      current = [];
    }

    if (!current.includes(item)) {
      current.push(item);
    }
    return this.setKey(upperKey, current);
  }
}
