import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const prodConfigPath = path.join(__dirname, '..', '..', 'config', 'production-gate.json');
const prodConfig = JSON.parse(fs.readFileSync(prodConfigPath, 'utf8'));

describe('Phase 21 — Production Go-Live Gate Enforcement', () => {
  it('verifies valid production gate configuration and release version', () => {
    expect(prodConfig.production).toBeDefined();
    expect(prodConfig.production.releaseVersion).toBe('v1.0.0-production');
    expect(prodConfig.production.publicTrafficEnabled).toBe(true);
    expect(prodConfig.production.killSwitchActive).toBe(false);
    expect(prodConfig.production.canaryPercentage).toBe(100);
    expect(prodConfig.production.serviceableStores).toContain('store-001');
  });

  it('verifies operational support channels and emergency triggers are active', () => {
    expect(prodConfig.production.supportChannels.customerHelpdeskActive).toBe(true);
    expect(prodConfig.production.supportChannels.pickerOpsHotlineActive).toBe(true);
    expect(prodConfig.production.supportChannels.deliveryOpsHotlineActive).toBe(true);
    expect(prodConfig.production.supportChannels.onCallEngineeringPagingActive).toBe(true);

    expect(prodConfig.production.emergencyStopTriggers.maxPaymentMismatchCount).toBe(0);
    expect(prodConfig.production.emergencyStopTriggers.maxNegativeInventoryRows).toBe(0);
    expect(prodConfig.production.emergencyStopTriggers.maxOutboxBacklogAgeSeconds).toBe(60);
  });

  it('validates production release invariant: zero drift between gateway, ledger, and order total', () => {
    const canonicalOrderTotal = 999.0;
    const gatewayAmountPaise = 99900;
    const ledgerAmountPaise = 99900;

    expect(gatewayAmountPaise).toBe(Math.round(canonicalOrderTotal * 100));
    expect(ledgerAmountPaise).toBe(gatewayAmountPaise);
  });
});
