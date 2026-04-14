import { useState, useEffect, useMemo, useCallback } from "react";
import { EndpointData, EndpointModel, SearchProvider } from "../types";

export function useModelCatalog() {
  const [allModels, setAllModels] = useState<EndpointModel[]>([]);
  const [searchProviders, setSearchProviders] = useState<SearchProvider[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/v1/models");
      if (res.ok) {
        const data = (await res.json()) as { data?: EndpointModel[] };
        setAllModels(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) {
      console.log("Error fetching models:", e);
    }
  }, []);

  const fetchSearchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/search/providers");
      if (res.ok) {
        const data = (await res.json()) as { providers?: SearchProvider[] };
        setSearchProviders(Array.isArray(data.providers) ? data.providers : []);
      }
    } catch {
      // Search endpoint may not be available
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void Promise.allSettled([fetchModels(), fetchSearchProviders()]).finally(() => {
        setModelsLoading(false);
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [fetchModels, fetchSearchProviders]);

  const endpointData = useMemo<EndpointData>(() => {
    const chat = allModels.filter((m) => !m.type && !m.parent);
    const embeddings = allModels.filter((m) => m.type === "embedding" && !m.parent);
    const images = allModels.filter((m) => m.type === "image" && !m.parent);
    const rerank = allModels.filter((m) => m.type === "rerank" && !m.parent);
    const audioTranscription = allModels.filter(
      (m) => m.type === "audio" && m.subtype === "transcription" && !m.parent
    );
    const audioSpeech = allModels.filter(
      (m) => m.type === "audio" && m.subtype === "speech" && !m.parent
    );
    const moderation = allModels.filter((m) => m.type === "moderation" && !m.parent);
    const music = allModels.filter((m) => m.type === "music" && !m.parent);

    return {
      chat,
      embeddings,
      images,
      rerank,
      audioTranscription,
      audioSpeech,
      moderation,
      music,
    };
  }, [allModels]);

  return {
    allModels,
    searchProviders,
    endpointData,
    modelsLoading,
    refreshModels: fetchModels,
  };
}
