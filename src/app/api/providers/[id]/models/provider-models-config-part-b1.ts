import { asRecord } from "./json-utils";
import type { ProviderModelsConfigEntry } from "./provider-models-config-types";

export const providerModelsConfigPartB1: Record<string, ProviderModelsConfigEntry> = {
  deepinfra: {
    url: "https://api.deepinfra.com/v1/openai/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => {
      const record = asRecord(data);
      return (record.data as unknown[]) || (record.models as unknown[]) || [];
    },
  },
  sambanova: {
    url: "https://api.sambanova.ai/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => {
      const record = asRecord(data);
      return (record.data as unknown[]) || (record.models as unknown[]) || [];
    },
  },
  venice: {
    url: "https://api.venice.ai/api/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => {
      const record = asRecord(data);
      return (record.data as unknown[]) || (record.models as unknown[]) || [];
    },
  },
  groq: {
    url: "https://api.groq.com/openai/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => {
      const record = asRecord(data);
      return (record.data as unknown[]) || (record.models as unknown[]) || [];
    },
  },
  blackbox: {
    url: "https://api.blackbox.ai/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => {
      const record = asRecord(data);
      return (record.data as unknown[]) || (record.models as unknown[]) || [];
    },
  },
  xai: {
    url: "https://api.x.ai/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => {
      const record = asRecord(data);
      return (record.data as unknown[]) || (record.models as unknown[]) || [];
    },
  },
  mistral: {
    url: "https://api.mistral.ai/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => {
      const record = asRecord(data);
      return (record.data as unknown[]) || (record.models as unknown[]) || [];
    },
  },

  together: {
    url: "https://api.together.xyz/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => {
      const record = asRecord(data);
      return (record.data as unknown[]) || (record.models as unknown[]) || [];
    },
  },
  fireworks: {
    url: "https://api.fireworks.ai/inference/v1/models",
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => {
      const record = asRecord(data);
      return (record.data as unknown[]) || (record.models as unknown[]) || [];
    },
  },
};
