import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { CloudCredentialController } from './cloud-credential.controller';
import { CloudCredentialService } from './cloud-credential.service';
import { ScannerSchedulerService } from './scanner-scheduler.service';

@Module({
  controllers: [InventoryController, CloudCredentialController],
  providers: [InventoryService, CloudCredentialService, ScannerSchedulerService],
  exports: [InventoryService, CloudCredentialService, ScannerSchedulerService],
})
export class InventoryModule {}
