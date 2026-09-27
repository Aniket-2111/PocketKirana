import {
  HomepageLayoutConfig,
  HomepageSectionConfig,
  HomepageVersionSnapshot,
  HomepageAuditLog,
  HomepagePublishDiff,
  HomepageApiResponse,
  CustomerPersona,
} from '@/types/homepageCms';
import { DEFAULT_HOMEPAGE_LAYOUT } from './defaultHomepageLayout';

// In-memory canonical state with persistence helpers
let memoryLayout: HomepageLayoutConfig = {
  ...DEFAULT_HOMEPAGE_LAYOUT,
  version: 1,
  status: 'PUBLISHED',
  publishedAt: '2026-08-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
};

let memoryVersions: HomepageVersionSnapshot[] = [
  {
    id: `ver-1`,
    layoutId: DEFAULT_HOMEPAGE_LAYOUT.id,
    version: 1,
    name: DEFAULT_HOMEPAGE_LAYOUT.name,
    sections: JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_LAYOUT.sections)),
    publishedAt: '2026-08-01T00:00:00.000Z',
    publishedBy: 'System Default',
    changeSummary: 'Initial Default Master Layout',
  },
];

let memoryAuditLogs: HomepageAuditLog[] = [
  {
    id: `audit-init-1`,
    action: 'HOMEPAGE_PUBLISHED',
    adminId: 'admin_sys',
    adminName: 'System Setup',
    adminRole: 'SuperAdmin',
    version: 1,
    details: 'Initial Master Layout Published',
    timestamp: '2026-08-01T00:00:00.000Z',
  },
];

export class HomepageCmsService {
  /**
   * Get Current Layout (for Admin editing - includes draft sections)
   */
  static getLayout(): HomepageLayoutConfig {
    return JSON.parse(JSON.stringify(memoryLayout));
  }

  /**
   * Update Working/Draft Layout
   */
  static updateLayout(
    layout: Partial<HomepageLayoutConfig>,
    admin = { id: 'admin_1', name: 'Admin', role: 'Admin' }
  ): HomepageLayoutConfig {
    memoryLayout = {
      ...memoryLayout,
      ...layout,
      updatedAt: new Date().toISOString(),
    };
    return JSON.parse(JSON.stringify(memoryLayout));
  }

  /**
   * Save / Update a single section
   */
  static saveSection(
    section: HomepageSectionConfig,
    admin = { id: 'admin_1', name: 'Admin', role: 'Admin' }
  ): { layout: HomepageLayoutConfig; log: HomepageAuditLog } {
    const existingIndex = memoryLayout.sections.findIndex((s) => s.id === section.id);
    const oldSection = existingIndex >= 0 ? memoryLayout.sections[existingIndex] : null;
    const isNew = existingIndex === -1;

    let updatedSections = [...memoryLayout.sections];
    if (isNew) {
      updatedSections.push({
        ...section,
        displayOrder: section.displayOrder || updatedSections.length + 1,
      });
    } else {
      updatedSections[existingIndex] = {
        ...updatedSections[existingIndex],
        ...section,
      };
    }

    // Sort by displayOrder
    updatedSections.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    memoryLayout.sections = updatedSections;
    memoryLayout.updatedAt = new Date().toISOString();

    const log: HomepageAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action: isNew ? 'SECTION_CREATED' : 'SECTION_UPDATED',
      adminId: admin.id,
      adminName: admin.name,
      adminRole: admin.role,
      version: memoryLayout.version,
      sectionId: section.id,
      sectionTitle: section.title,
      details: isNew
        ? `Added new ${section.type} section: "${section.title}"`
        : `Updated ${section.type} section: "${section.title}"`,
      oldState: oldSection,
      newState: section,
      timestamp: new Date().toISOString(),
    };

    memoryAuditLogs.unshift(log);

    return {
      layout: JSON.parse(JSON.stringify(memoryLayout)),
      log,
    };
  }

  /**
   * Delete section
   */
  static deleteSection(
    sectionId: string,
    admin = { id: 'admin_1', name: 'Admin', role: 'Admin' }
  ): { layout: HomepageLayoutConfig; log: HomepageAuditLog | null } {
    const sectionToDelete = memoryLayout.sections.find((s) => s.id === sectionId);
    if (!sectionToDelete) {
      return { layout: JSON.parse(JSON.stringify(memoryLayout)), log: null };
    }

    memoryLayout.sections = memoryLayout.sections.filter((s) => s.id !== sectionId);
    // Re-index display orders
    memoryLayout.sections.forEach((s, idx) => {
      s.displayOrder = idx + 1;
    });
    memoryLayout.updatedAt = new Date().toISOString();

    const log: HomepageAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action: 'SECTION_DELETED',
      adminId: admin.id,
      adminName: admin.name,
      adminRole: admin.role,
      version: memoryLayout.version,
      sectionId: sectionToDelete.id,
      sectionTitle: sectionToDelete.title,
      details: `Deleted ${sectionToDelete.type} section: "${sectionToDelete.title}"`,
      oldState: sectionToDelete,
      timestamp: new Date().toISOString(),
    };

    memoryAuditLogs.unshift(log);

    return {
      layout: JSON.parse(JSON.stringify(memoryLayout)),
      log,
    };
  }

  /**
   * Reorder sections by IDs
   */
  static reorderSections(
    orderedSectionIds: string[],
    admin = { id: 'admin_1', name: 'Admin', role: 'Admin' }
  ): { layout: HomepageLayoutConfig; log: HomepageAuditLog } {
    const idMap = new Map(orderedSectionIds.map((id, index) => [id, index + 1]));

    memoryLayout.sections = memoryLayout.sections.map((s) => {
      const newOrder = idMap.get(s.id);
      return {
        ...s,
        displayOrder: newOrder !== undefined ? newOrder : s.displayOrder,
      };
    });

    memoryLayout.sections.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    memoryLayout.updatedAt = new Date().toISOString();

    const log: HomepageAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action: 'SECTION_REORDERED',
      adminId: admin.id,
      adminName: admin.name,
      adminRole: admin.role,
      version: memoryLayout.version,
      details: `Reordered ${memoryLayout.sections.length} layout sections`,
      timestamp: new Date().toISOString(),
    };

    memoryAuditLogs.unshift(log);

    return {
      layout: JSON.parse(JSON.stringify(memoryLayout)),
      log,
    };
  }

  /**
   * Calculate changes/diff between current working draft and last published version
   */
  static getPublishDiff(): HomepagePublishDiff {
    const lastPublished = memoryVersions[0];
    const oldSections = lastPublished ? lastPublished.sections : [];
    const currentSections = memoryLayout.sections;

    const oldMap = new Map(oldSections.map((s) => [s.id, s]));
    const currentMap = new Map(currentSections.map((s) => [s.id, s]));

    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];

    currentSections.forEach((s) => {
      if (!oldMap.has(s.id)) {
        added.push(`+ ${s.title} (${s.type})`);
      } else {
        const old = oldMap.get(s.id)!;
        if (
          old.title !== s.title ||
          old.isActive !== s.isActive ||
          old.ctaLink !== s.ctaLink ||
          old.subtitle !== s.subtitle ||
          old.badge !== s.badge ||
          old.targetPersona !== s.targetPersona ||
          JSON.stringify(old.targetCategoryIds) !== JSON.stringify(s.targetCategoryIds) ||
          JSON.stringify(old.targetProductIds) !== JSON.stringify(s.targetProductIds)
        ) {
          modified.push(`~ ${s.title} (${s.type})`);
        }
      }
    });

    oldSections.forEach((s) => {
      if (!currentMap.has(s.id)) {
        removed.push(`- ${s.title} (${s.type})`);
      }
    });

    const isReordered = currentSections.some((s, idx) => {
      const old = oldSections[idx];
      return !old || old.id !== s.id;
    });

    return {
      added,
      modified,
      removed,
      reordered: isReordered && oldSections.length === currentSections.length,
      totalSections: currentSections.length,
      targetVersion: memoryLayout.version + 1,
    };
  }

  /**
   * Atomically Publish current layout
   */
  static publish(
    admin = { id: 'admin_1', name: 'Admin', role: 'Admin' },
    customSummary?: string
  ): {
    success: boolean;
    version: number;
    publishedAt: string;
    message: string;
    layout: HomepageLayoutConfig;
    log: HomepageAuditLog;
  } {
    const nextVersion = (memoryLayout.version || 1) + 1;
    const now = new Date().toISOString();

    const diff = this.getPublishDiff();
    const summary =
      customSummary ||
      [
        diff.added.length > 0 ? `${diff.added.length} added` : null,
        diff.modified.length > 0 ? `${diff.modified.length} modified` : null,
        diff.removed.length > 0 ? `${diff.removed.length} removed` : null,
        diff.reordered ? 'sections reordered' : null,
      ]
        .filter(Boolean)
        .join(', ') || 'General content update';

    // Update master layout
    memoryLayout = {
      ...memoryLayout,
      version: nextVersion,
      status: 'PUBLISHED',
      publishedAt: now,
      updatedAt: now,
      createdBy: admin.name,
    };

    // Create immutable version snapshot
    const versionSnapshot: HomepageVersionSnapshot = {
      id: `ver-${nextVersion}-${Date.now()}`,
      layoutId: memoryLayout.id,
      version: nextVersion,
      name: memoryLayout.name,
      sections: JSON.parse(JSON.stringify(memoryLayout.sections)),
      publishedAt: now,
      publishedBy: admin.name,
      changeSummary: summary,
    };

    memoryVersions.unshift(versionSnapshot);

    // Audit log
    const log: HomepageAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action: 'HOMEPAGE_PUBLISHED',
      adminId: admin.id,
      adminName: admin.name,
      adminRole: admin.role,
      version: nextVersion,
      details: `Published Version ${nextVersion}: ${summary}`,
      timestamp: now,
    };

    memoryAuditLogs.unshift(log);

    return {
      success: true,
      version: nextVersion,
      publishedAt: now,
      message: `Homepage Version ${nextVersion} published successfully!`,
      layout: JSON.parse(JSON.stringify(memoryLayout)),
      log,
    };
  }

  /**
   * Rollback to a previous version snapshot
   */
  static rollback(
    targetVersion: number,
    admin = { id: 'admin_1', name: 'Admin', role: 'Admin' }
  ): {
    success: boolean;
    version: number;
    message: string;
    layout: HomepageLayoutConfig;
    log: HomepageAuditLog;
  } {
    const targetSnapshot = memoryVersions.find((v) => v.version === targetVersion);
    if (!targetSnapshot) {
      throw new Error(`Version ${targetVersion} snapshot not found in history`);
    }

    const nextVersion = (memoryLayout.version || 1) + 1;
    const now = new Date().toISOString();

    // Reconstruct sections from target snapshot
    const restoredSections = JSON.parse(JSON.stringify(targetSnapshot.sections));

    memoryLayout = {
      ...memoryLayout,
      version: nextVersion,
      status: 'PUBLISHED',
      sections: restoredSections,
      publishedAt: now,
      updatedAt: now,
      createdBy: admin.name,
    };

    const versionSnapshot: HomepageVersionSnapshot = {
      id: `ver-${nextVersion}-${Date.now()}`,
      layoutId: memoryLayout.id,
      version: nextVersion,
      name: `Rollback to Version ${targetVersion}`,
      sections: JSON.parse(JSON.stringify(restoredSections)),
      publishedAt: now,
      publishedBy: admin.name,
      changeSummary: `Restored exact content from Version ${targetVersion}`,
    };

    memoryVersions.unshift(versionSnapshot);

    const log: HomepageAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action: 'HOMEPAGE_ROLLED_BACK',
      adminId: admin.id,
      adminName: admin.name,
      adminRole: admin.role,
      version: nextVersion,
      details: `Rolled back homepage to content of Version ${targetVersion} as new Version ${nextVersion}`,
      timestamp: now,
    };

    memoryAuditLogs.unshift(log);

    return {
      success: true,
      version: nextVersion,
      message: `Successfully rolled back to Version ${targetVersion}. Published as Version ${nextVersion}.`,
      layout: JSON.parse(JSON.stringify(memoryLayout)),
      log,
    };
  }

  /**
   * Get Published Customer API Payload
   * Filters out:
   * - Inactive sections
   * - Expired or future-scheduled campaigns
   * - Ineligible persona content (if persona is specified)
   */
  static getPublishedCustomerHomepage(persona: CustomerPersona = 'ALL'): HomepageApiResponse {
    const now = new Date();

    const activeSections = memoryLayout.sections
      .filter((s) => s.isActive)
      .filter((s) => {
        // Schedule Start Check
        if (s.scheduleStart) {
          const start = new Date(s.scheduleStart);
          if (!isNaN(start.getTime()) && now < start) {
            return false;
          }
        }
        // Schedule End / Expiry Check
        if (s.scheduleEnd) {
          const end = new Date(s.scheduleEnd);
          if (!isNaN(end.getTime()) && now > end) {
            return false;
          }
        }
        return true;
      })
      .filter((s) => {
        if (!s.targetPersona || s.targetPersona === 'ALL') return true;
        if (persona === 'ALL') return true;
        return s.targetPersona === persona;
      })
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    return {
      version: memoryLayout.version,
      status: 'PUBLISHED',
      publishedAt: memoryLayout.publishedAt || memoryLayout.createdAt,
      sections: activeSections,
      serverTime: now.toISOString(),
    };
  }

  /**
   * Get Version History
   */
  static getVersionHistory(): HomepageVersionSnapshot[] {
    return JSON.parse(JSON.stringify(memoryVersions));
  }

  /**
   * Get Audit Logs
   */
  static getAuditLogs(): HomepageAuditLog[] {
    return JSON.parse(JSON.stringify(memoryAuditLogs));
  }

  /**
   * Reset to Factory Default
   */
  static resetToDefault(admin = { id: 'admin_1', name: 'Admin', role: 'Admin' }): HomepageLayoutConfig {
    const nextVersion = (memoryLayout.version || 1) + 1;
    const now = new Date().toISOString();

    memoryLayout = {
      ...DEFAULT_HOMEPAGE_LAYOUT,
      version: nextVersion,
      status: 'PUBLISHED',
      publishedAt: now,
      updatedAt: now,
      createdBy: admin.name,
    };

    const snapshot: HomepageVersionSnapshot = {
      id: `ver-${nextVersion}-${Date.now()}`,
      layoutId: memoryLayout.id,
      version: nextVersion,
      name: 'Factory Default Reset',
      sections: JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_LAYOUT.sections)),
      publishedAt: now,
      publishedBy: admin.name,
      changeSummary: 'Reset to standard factory default sections',
    };

    memoryVersions.unshift(snapshot);

    const log: HomepageAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action: 'LAYOUT_RESET',
      adminId: admin.id,
      adminName: admin.name,
      adminRole: admin.role,
      version: nextVersion,
      details: `Reset homepage layout to factory default`,
      timestamp: now,
    };

    memoryAuditLogs.unshift(log);

    return JSON.parse(JSON.stringify(memoryLayout));
  }
}
