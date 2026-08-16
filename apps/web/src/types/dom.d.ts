// apps/web/src/types/dom.d.ts
interface BatteryManager extends EventTarget {
  readonly charging: boolean;
  readonly chargingTime: number;
  readonly dischargingTime: number;
  readonly level: number;
}

interface Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

interface ServiceWorkerRegistration {
  readonly sync?: SyncManager;
}
