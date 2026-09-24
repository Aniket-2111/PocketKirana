'use client';

import React from 'react';

/**
 * NotificationSimulator — Disabled component.
 * Retained as empty stub for test file existence and backward compatibility.
 */
export const NotificationSimulator: React.FC = () => {
  // Completely disabled across all environments
  if (process.env.NODE_ENV !== 'development' || true) {
    return null;
  }
  return null;
};
