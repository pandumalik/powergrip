import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CloudCredentialService } from './cloud-credential.service';

@Injectable()
export class ScannerSchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private isScanning = false;

  constructor(
    @Inject(forwardRef(() => InventoryService)) private inventoryService: InventoryService,
    @Inject(CloudCredentialService) private credService: CloudCredentialService,
  ) {}

  onModuleInit() {
    console.log('⏰ [ScannerScheduler] Cloud Inventory Automated Periodic Re-scan worker initialized');
    // Check every 60 seconds
    this.timer = setInterval(() => {
      this.checkAndRunScheduledScans().catch((err) => {
        console.error('[ScannerScheduler] Unhandled error during scheduled check:', err);
      });
    }, 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Parse human-readable interval strings to milliseconds
   */
  private parseIntervalToMs(intervalStr: string): number | null {
    if (!intervalStr || intervalStr.toUpperCase() === 'OFF') return null;

    const trimmed = intervalStr.trim().toLowerCase();
    if (trimmed.endsWith('m')) {
      const minutes = parseInt(trimmed.replace('m', ''), 10);
      return isNaN(minutes) ? null : minutes * 60 * 1000;
    }
    if (trimmed.endsWith('h')) {
      const hours = parseInt(trimmed.replace('h', ''), 10);
      return isNaN(hours) ? null : hours * 60 * 60 * 1000;
    }
    if (trimmed.endsWith('d')) {
      const days = parseInt(trimmed.replace('d', ''), 10);
      return isNaN(days) ? null : days * 24 * 60 * 60 * 1000;
    }

    return 60 * 60 * 1000; // Default 1 hour
  }

  async checkAndRunScheduledScans() {
    if (this.isScanning) {
      return;
    }

    try {
      this.isScanning = true;
      const allCreds = await this.credService.findAll();
      const activeCreds = allCreds.filter((c) => c.isActive && c.autoScanInterval !== 'OFF');

      const now = Date.now();

      for (const cred of activeCreds) {
        const intervalMs = this.parseIntervalToMs(cred.autoScanInterval);
        if (!intervalMs) continue;

        const lastScannedTime = cred.lastScannedAt ? new Date(cred.lastScannedAt).getTime() : 0;
        const elapsed = now - lastScannedTime;

        if (elapsed >= intervalMs) {
          console.log(
            `🚀 [ScannerScheduler] Periodic scan triggered for credential "${cred.name}" (Interval: ${cred.autoScanInterval}, Elapsed: ${Math.round(elapsed / 60000)}m)`,
          );

          try {
            const result = await this.inventoryService.reScanServiceAccount(cred.id);
            console.log(
              `✅ [ScannerScheduler] Re-scan completed for "${cred.name}": Discovered ${result.totalDiscovered}, Updated ${result.updatedAssetsCount}, Drift Events ${result.driftEvents.length}`,
            );
          } catch (scanErr: any) {
            console.error(`❌ [ScannerScheduler] Scan failed for "${cred.name}":`, scanErr.message);
          }
        }
      }
    } finally {
      this.isScanning = false;
    }
  }
}
