"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SyncProgressModal } from "@/components/sync-progress-modal";

export function SyncButton() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button onClick={() => setShowModal(true)} disabled={showModal} size="sm">
        {showModal ? "Syncing..." : "Sync Now"}
      </Button>
      <SyncProgressModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
}
