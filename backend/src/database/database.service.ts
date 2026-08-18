import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private client!: postgres.Sql;
  public db!: ReturnType<typeof drizzle<typeof schema>>;

  constructor(
    @Optional() @Inject(ConfigService) private configService?: ConfigService,
  ) {}

  onModuleInit() {
    const connectionString =
      this.configService?.get<string>('database.url') ||
      process.env.DATABASE_URL ||
      'postgresql://vcams_user:vcams_secure_password_2026@localhost:5432/vcams_db';

    const pg = typeof postgres === 'function' ? postgres : (postgres as any).default;
    this.client = pg(connectionString, { max: 10, connect_timeout: 5 });
    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.end();
    }
  }
}
