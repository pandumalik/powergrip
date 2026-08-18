import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthGuard } from './common/guards/auth.guard';
import { ClientModule } from './services/client-service/client.module';
import { ProjectModule } from './services/project-service/project.module';
import { EmployeeModule } from './services/employee-service/employee.module';
import { InventoryModule } from './services/inventory-service/inventory.module';
import { AccessModule } from './services/access-service/access.module';
import { MiscModule } from './services/misc-service/misc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    ClientModule,
    ProjectModule,
    EmployeeModule,
    InventoryModule,
    AccessModule,
    MiscModule,
  ],
  providers: [AuthGuard],
  exports: [AuthGuard],
})
export class AppModule {}
