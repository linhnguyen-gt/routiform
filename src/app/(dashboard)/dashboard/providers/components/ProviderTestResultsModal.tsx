"use client";

import { Modal } from "@/shared/components";
import { ProviderTestResultsView } from "./ProviderTestResultsView";
import type { TestResults } from "../types";

interface ProviderTestResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: TestResults;
}

/**
 * Wraps test results in the shared Modal component for proper
 * focus trapping, escape key handling, and overlay behavior.
 */
export function ProviderTestResultsModal({
  isOpen,
  onClose,
  results,
}: ProviderTestResultsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" className="max-w-[600px]">
      <ProviderTestResultsView results={results} />
    </Modal>
  );
}
