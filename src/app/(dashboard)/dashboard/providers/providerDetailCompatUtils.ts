import { MODEL_COMPAT_PROTOCOL_KEYS } from "@/shared/constants/modelCompat";
export {
  UPSTREAM_HEADERS_UI_MAX,
  compatProtocolLabelKey,
  normalizeCodexLimitPolicy,
} from "./providerDetailCompatViewUtils";

import type { CompatModelMap, CompatModelRow } from "./[id]/types";

export const CC_COMPATIBLE_LABEL = "CC Compatible";
export const CC_COMPATIBLE_DETAILS_TITLE = "CC Compatible Details";
export const CC_COMPATIBLE_DEFAULT_CHAT_PATH = "/v1/messages?beta=true";

export type HeaderDraftRow = { id: string; name: string; value: string };

export function buildCompatMap(rows: CompatModelRow[]): CompatModelMap {
  const map = new Map<string, CompatModelRow>();
  for (const row of rows) {
    if (row.id) map.set(row.id, row);
  }
  return map;
}

export function getProtoSlice(
  customRow: CompatModelRow | undefined,
  overrideRow: CompatModelRow | undefined,
  protocol: string
) {
  return customRow?.compatByProtocol?.[protocol] ?? overrideRow?.compatByProtocol?.[protocol];
}

export function effectiveNormalizeForProtocol(
  modelId: string,
  protocol: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const custom = customMap.get(modelId);
  const override = overrideMap.get(modelId);
  const protoSlice = getProtoSlice(custom, override, protocol);
  if (protoSlice && Object.prototype.hasOwnProperty.call(protoSlice, "normalizeToolCallId")) {
    return Boolean(protoSlice.normalizeToolCallId);
  }
  if (custom?.normalizeToolCallId) return true;
  return Boolean(override?.normalizeToolCallId);
}

export function effectivePreserveForProtocol(
  modelId: string,
  protocol: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const custom = customMap.get(modelId);
  const override = overrideMap.get(modelId);
  const protoSlice = getProtoSlice(custom, override, protocol);
  if (
    protoSlice &&
    Object.prototype.hasOwnProperty.call(protoSlice, "preserveOpenAIDeveloperRole")
  ) {
    return Boolean(protoSlice.preserveOpenAIDeveloperRole);
  }
  if (custom && Object.prototype.hasOwnProperty.call(custom, "preserveOpenAIDeveloperRole")) {
    return Boolean(custom.preserveOpenAIDeveloperRole);
  }
  if (override && Object.prototype.hasOwnProperty.call(override, "preserveOpenAIDeveloperRole")) {
    return Boolean(override.preserveOpenAIDeveloperRole);
  }
  return true;
}

export function anyNormalizeCompatBadge(
  modelId: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const custom = customMap.get(modelId);
  const override = overrideMap.get(modelId);
  if (custom?.normalizeToolCallId || override?.normalizeToolCallId) return true;
  for (const protocol of MODEL_COMPAT_PROTOCOL_KEYS) {
    const protoSlice = getProtoSlice(custom, override, protocol);
    if (protoSlice?.normalizeToolCallId) return true;
  }
  return false;
}

export function anyNoPreserveCompatBadge(
  modelId: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const custom = customMap.get(modelId);
  const override = overrideMap.get(modelId);

  if (
    custom &&
    Object.prototype.hasOwnProperty.call(custom, "preserveOpenAIDeveloperRole") &&
    custom.preserveOpenAIDeveloperRole === false
  ) {
    return true;
  }

  if (
    override &&
    Object.prototype.hasOwnProperty.call(override, "preserveOpenAIDeveloperRole") &&
    override.preserveOpenAIDeveloperRole === false
  ) {
    return true;
  }

  for (const protocol of MODEL_COMPAT_PROTOCOL_KEYS) {
    const protoSlice = getProtoSlice(custom, override, protocol);
    if (
      protoSlice &&
      Object.prototype.hasOwnProperty.call(protoSlice, "preserveOpenAIDeveloperRole") &&
      protoSlice.preserveOpenAIDeveloperRole === false
    ) {
      return true;
    }
  }

  return false;
}

export function upstreamHeadersRecordsEqual(
  left: Record<string, string>,
  right: Record<string, string>
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

export function recordToHeaderRows(
  record: Record<string, string>,
  genId: () => string
): HeaderDraftRow[] {
  const entries = Object.entries(record).filter(([key]) => key.trim());
  if (entries.length === 0) return [{ id: genId(), name: "", value: "" }];
  return entries.map(([name, value]) => ({ id: genId(), name, value }));
}

export function headerRowsToRecord(rows: HeaderDraftRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    out[name] = row.value;
  }
  return out;
}

export function effectiveUpstreamHeadersForProtocol(
  modelId: string,
  protocol: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): Record<string, string> {
  const custom = customMap.get(modelId);
  const override = overrideMap.get(modelId);
  const base: Record<string, string> = {};

  if (custom?.upstreamHeaders && typeof custom.upstreamHeaders === "object") {
    Object.assign(base, custom.upstreamHeaders);
  } else if (override?.upstreamHeaders && typeof override.upstreamHeaders === "object") {
    Object.assign(base, override.upstreamHeaders);
  }

  const protoSlice = getProtoSlice(custom, override, protocol);
  if (protoSlice?.upstreamHeaders && typeof protoSlice.upstreamHeaders === "object") {
    Object.assign(base, protoSlice.upstreamHeaders);
  }

  return base;
}

export function anyUpstreamHeadersBadge(
  modelId: string,
  customMap: CompatModelMap,
  overrideMap: CompatModelMap
): boolean {
  const custom = customMap.get(modelId);
  const override = overrideMap.get(modelId);

  const hasHeaders = (value: unknown): boolean =>
    Boolean(
      value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0
    );

  if (hasHeaders(custom?.upstreamHeaders) || hasHeaders(override?.upstreamHeaders)) return true;

  for (const protocol of MODEL_COMPAT_PROTOCOL_KEYS) {
    const protoSlice = getProtoSlice(custom, override, protocol);
    if (hasHeaders(protoSlice?.upstreamHeaders)) return true;
  }

  return false;
}
