import { useState } from "react";

export interface UseProviderDetailModalsReturn {
  showOAuthModal: boolean;
  setShowOAuthModal: (show: boolean) => void;
  showAddApiKeyModal: boolean;
  setShowAddApiKeyModal: (show: boolean) => void;
  showEditModal: boolean;
  setShowEditModal: (show: boolean) => void;
  showEditNodeModal: boolean;
  setShowEditNodeModal: (show: boolean) => void;
  selectedConnection: any;
  setSelectedConnection: (conn: any) => void;
  batchTestResults: any;
  setBatchTestResults: (results: any) => void;
}

export function useProviderDetailModals(): UseProviderDetailModalsReturn {
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [showAddApiKeyModal, setShowAddApiKeyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditNodeModal, setShowEditNodeModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<any>(null);
  const [batchTestResults, setBatchTestResults] = useState<any>(null);

  return {
    showOAuthModal,
    setShowOAuthModal,
    showAddApiKeyModal,
    setShowAddApiKeyModal,
    showEditModal,
    setShowEditModal,
    showEditNodeModal,
    setShowEditNodeModal,
    selectedConnection,
    setSelectedConnection,
    batchTestResults,
    setBatchTestResults,
  };
}
