import { resolveNestedComboModels } from "./combo-dag.ts";
import { normalizeModelEntry } from "./combo-model-entry.ts";
import { orderModelsForWeightedFallback, selectWeightedModel } from "./combo-selection-weighted.ts";

type LogLike = { info: (tag: string, msg: string) => void };

/** First pass: flatten nested combos and resolve weighted selection order. */
export function resolveInitialOrderedModels(
  combo: { models?: unknown[]; name?: string },
  allCombos: unknown,
  strategy: string,
  models: unknown[],
  log: LogLike
): string[] {
  let orderedModels: string[];

  if (allCombos) {
    const flatModels = resolveNestedComboModels(
      combo as { name: string; models?: unknown[] },
      allCombos
    );
    if (strategy === "weighted") {
      const selected = selectWeightedModel(models);
      orderedModels = orderModelsForWeightedFallback(models, selected);
      orderedModels = orderedModels.flatMap((m) => {
        const combos = Array.isArray(allCombos)
          ? allCombos
          : (allCombos as { combos?: unknown[] })?.combos || [];
        const nested = combos.find((c: { name?: string }) => c.name === m) as
          | { name: string; models?: unknown[] }
          | undefined;
        if (nested) return resolveNestedComboModels(nested, allCombos);
        return [m];
      });
      log.info(
        "COMBO",
        `Weighted selection with nested resolution: ${orderedModels.length} total models`
      );
    } else {
      orderedModels = flatModels;
      log.info("COMBO", `${strategy} with nested resolution: ${orderedModels.length} total models`);
    }
  } else if (strategy === "weighted") {
    const selected = selectWeightedModel(models);
    orderedModels = orderModelsForWeightedFallback(models, selected);
    log.info("COMBO", `Weighted selection: ${selected} (from ${models.length} models)`);
  } else {
    orderedModels = models.map((m) => normalizeModelEntry(m).model);
  }

  return orderedModels;
}
