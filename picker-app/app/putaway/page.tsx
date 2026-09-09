'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import PickerShell from '../../components/PickerShell';
import { PutawayWorkflow } from '@/components/picker/PutawayWorkflow';

export default function PickerPutaway() {
  const {
    products,
    storageLocations,
    inventoryMovements,
    performPutaway,
  } = useAppStore();

  return (
    <PickerShell>
      <PutawayWorkflow
        products={products}
        storageLocations={storageLocations}
        inventoryMovements={inventoryMovements}
        onPerformPutaway={performPutaway}
      />
    </PickerShell>
  );
}
