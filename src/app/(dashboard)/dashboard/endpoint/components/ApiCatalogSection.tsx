"use client";

import { useTranslations } from "next-intl";
import { EndpointData, SearchProvider } from "../types";
import { EndpointSection } from "./EndpointSection";

interface ApiCatalogSectionProps {
  endpointData: EndpointData;
  searchProviders: SearchProvider[];
  currentEndpoint: string;
  expandedEndpoint: string | null;
  setExpandedEndpoint: (id: string | null) => void;
  copy: (text: string, id: string) => void;
  copied: string | null;
}

export function ApiCatalogSection({
  endpointData,
  searchProviders,
  currentEndpoint,
  expandedEndpoint,
  setExpandedEndpoint,
  copy,
  copied,
}: ApiCatalogSectionProps) {
  const t = useTranslations("endpoint");

  return (
    <div className="flex flex-col gap-6">
      {/* Core APIs */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-sm text-primary">hub</span>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            {t("categoryCore") || "Core APIs"}
          </h3>
          <div className="flex-1 h-px bg-border/50" />
        </div>
        <div className="flex flex-col gap-3">
          <EndpointSection
            icon="chat"
            iconColor="text-blue-500"
            iconBg="bg-blue-500/10"
            title={t("chatCompletions")}
            path="/v1/chat/completions"
            description={t("chatDesc")}
            models={endpointData.chat}
            expanded={expandedEndpoint === "chat"}
            onToggle={() => setExpandedEndpoint(expandedEndpoint === "chat" ? null : "chat")}
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />

          <EndpointSection
            icon="code"
            iconColor="text-indigo-500"
            iconBg="bg-indigo-500/10"
            title={t("responses") || "Responses API"}
            path="/v1/responses"
            description={
              t("responsesDesc") || "OpenAI Responses API for Codex and advanced agentic workflows"
            }
            models={endpointData.chat}
            expanded={expandedEndpoint === "responses"}
            onToggle={() =>
              setExpandedEndpoint(expandedEndpoint === "responses" ? null : "responses")
            }
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />

          <EndpointSection
            icon="text_fields"
            iconColor="text-orange-500"
            iconBg="bg-orange-500/10"
            title={t("completionsLegacy") || "Completions (Legacy)"}
            path="/v1/completions"
            description={
              t("completionsLegacyDesc") ||
              "Legacy OpenAI text completions — accepts both prompt and messages format"
            }
            models={endpointData.chat}
            expanded={expandedEndpoint === "completions"}
            onToggle={() =>
              setExpandedEndpoint(expandedEndpoint === "completions" ? null : "completions")
            }
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />
        </div>
      </div>

      {/* Media & Multi-Modal */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-sm text-purple-400">perm_media</span>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            {t("categoryMedia") || "Media & Multi-Modal"}
          </h3>
          <div className="flex-1 h-px bg-border/50" />
        </div>
        <div className="flex flex-col gap-3">
          <EndpointSection
            icon="data_array"
            iconColor="text-emerald-500"
            iconBg="bg-emerald-500/10"
            title={t("embeddings")}
            path="/v1/embeddings"
            description={t("embeddingsDesc")}
            models={endpointData.embeddings}
            expanded={expandedEndpoint === "embeddings"}
            onToggle={() =>
              setExpandedEndpoint(expandedEndpoint === "embeddings" ? null : "embeddings")
            }
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />

          <EndpointSection
            icon="image"
            iconColor="text-purple-500"
            iconBg="bg-purple-500/10"
            title={t("imageGeneration")}
            path="/v1/images/generations"
            description={t("imageDesc")}
            models={endpointData.images}
            expanded={expandedEndpoint === "images"}
            onToggle={() => setExpandedEndpoint(expandedEndpoint === "images" ? null : "images")}
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />

          <EndpointSection
            icon="mic"
            iconColor="text-rose-500"
            iconBg="bg-rose-500/10"
            title={t("audioTranscription")}
            path="/v1/audio/transcriptions"
            description={t("audioTranscriptionDesc")}
            models={endpointData.audioTranscription}
            expanded={expandedEndpoint === "audioTranscription"}
            onToggle={() =>
              setExpandedEndpoint(
                expandedEndpoint === "audioTranscription" ? null : "audioTranscription"
              )
            }
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />

          <EndpointSection
            icon="record_voice_over"
            iconColor="text-cyan-500"
            iconBg="bg-cyan-500/10"
            title={t("textToSpeech")}
            path="/v1/audio/speech"
            description={t("textToSpeechDesc")}
            models={endpointData.audioSpeech}
            expanded={expandedEndpoint === "audioSpeech"}
            onToggle={() =>
              setExpandedEndpoint(expandedEndpoint === "audioSpeech" ? null : "audioSpeech")
            }
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />

          <EndpointSection
            icon="music_note"
            iconColor="text-fuchsia-500"
            iconBg="bg-fuchsia-500/10"
            title={t("musicGeneration") || "Music Generation"}
            path="/v1/music/generations"
            description={
              t("musicDesc") ||
              "Generate music and audio tracks via ComfyUI (Stable Audio, MusicGen)"
            }
            models={endpointData.music}
            expanded={expandedEndpoint === "music"}
            onToggle={() => setExpandedEndpoint(expandedEndpoint === "music" ? null : "music")}
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />
        </div>
      </div>

      {/* Search & Discovery */}
      {searchProviders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-sm text-cyan-400">travel_explore</span>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              {t("categorySearch") || "Search & Discovery"}
            </h3>
            <div className="flex-1 h-px bg-border/50" />
          </div>
          <div className="flex flex-col gap-3">
            <EndpointSection
              icon="search"
              iconColor="text-cyan-500"
              iconBg="bg-cyan-500/10"
              title={t("webSearch") || "Web Search"}
              path="/v1/search"
              description={
                t("webSearchDesc") ||
                "Unified web search across multiple providers with automatic failover and caching"
              }
              models={searchProviders.map((p) => ({
                id: p.id,
                name: p.name,
                owned_by: p.id,
                type: "search",
              }))}
              expanded={expandedEndpoint === "search"}
              onToggle={() => setExpandedEndpoint(expandedEndpoint === "search" ? null : "search")}
              copy={copy}
              copied={copied}
              baseUrl={currentEndpoint}
            />
          </div>
        </div>
      )}

      {/* Utility & Management */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-sm text-amber-400">build</span>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            {t("categoryUtility") || "Utility & Management"}
          </h3>
          <div className="flex-1 h-px bg-border/50" />
        </div>
        <div className="flex flex-col gap-3">
          <EndpointSection
            icon="sort"
            iconColor="text-amber-500"
            iconBg="bg-amber-500/10"
            title={t("rerank")}
            path="/v1/rerank"
            description={t("rerankDesc")}
            models={endpointData.rerank}
            expanded={expandedEndpoint === "rerank"}
            onToggle={() => setExpandedEndpoint(expandedEndpoint === "rerank" ? null : "rerank")}
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />

          <EndpointSection
            icon="shield"
            iconColor="text-orange-500"
            iconBg="bg-orange-500/10"
            title={t("moderations")}
            path="/v1/moderations"
            description={t("moderationsDesc")}
            models={endpointData.moderation}
            expanded={expandedEndpoint === "moderation"}
            onToggle={() =>
              setExpandedEndpoint(expandedEndpoint === "moderation" ? null : "moderation")
            }
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />

          <EndpointSection
            icon="list"
            iconColor="text-teal-500"
            iconBg="bg-teal-500/10"
            title={t("listModels") || "List Models"}
            path="/v1/models"
            description={
              t("listModelsDesc") || "List all available models across all connected providers"
            }
            models={[]}
            expanded={expandedEndpoint === "models"}
            onToggle={() => setExpandedEndpoint(expandedEndpoint === "models" ? null : "models")}
            copy={copy}
            copied={copied}
            baseUrl={currentEndpoint}
          />
        </div>
      </div>
    </div>
  );
}
