import type { MetricCardId } from "../../core/monitoring";

export type LayoutPresetId = "default" | "focus" | "balanced" | "custom";

export type LayoutPreset = {
  id: Exclude<LayoutPresetId, "custom">;
  nameKey: string;
  descriptionKey: string;
  metricOrder: MetricCardId[];
};

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "default",
    nameKey: "layouts.default.name",
    descriptionKey: "layouts.default.description",
    metricOrder: ["cpu", "cores", "ram", "disk"],
  },
  {
    id: "focus",
    nameKey: "layouts.focus.name",
    descriptionKey: "layouts.focus.description",
    metricOrder: ["cpu", "ram", "disk", "cores"],
  },
  {
    id: "balanced",
    nameKey: "layouts.balanced.name",
    descriptionKey: "layouts.balanced.description",
    metricOrder: ["disk", "cpu", "ram", "cores"],
  },
];

export const findLayoutPresetById = (id: LayoutPresetId | string) =>
  LAYOUT_PRESETS.find((preset) => preset.id === id);

export const findLayoutPresetIdForOrder = (order: MetricCardId[]) =>
  LAYOUT_PRESETS.find(
    (preset) =>
      preset.metricOrder.length === order.length &&
      preset.metricOrder.every((metric, index) => metric === order[index])
  )?.id;
