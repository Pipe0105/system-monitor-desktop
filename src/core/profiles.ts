export type ProfileId = "default" | "gaming" | "work" | "ahorro";

type Thresholds = {
  cpu: number;
  ram: number;
  disk: number;
};

export type PerformanceProfile = {
  id: ProfileId;
  nameKey: string;
  descriptionKey: string;
  intervalMs: number;
  thresholds: Thresholds;
};

export const PROFILES: PerformanceProfile[] = [
  {
    id: "default",
    nameKey: "profiles.default.name",
    descriptionKey: "profiles.default.description",
    intervalMs: 1000,
    thresholds: {
      cpu: 80,
      ram: 80,
      disk: 75,
    },
  },
  {
    id: "gaming",
    nameKey: "profiles.gaming.name",
    descriptionKey: "profiles.gaming.description",
    intervalMs: 1000,
    thresholds: {
      cpu: 88,
      ram: 88,
      disk: 82,
    },
  },
  {
    id: "work",
    nameKey: "profiles.work.name",
    descriptionKey: "profiles.work.description",
    intervalMs: 2000,
    thresholds: {
      cpu: 78,
      ram: 78,
      disk: 72,
    },
  },
  {
    id: "ahorro",
    nameKey: "profiles.ahorro.name",
    descriptionKey: "profiles.ahorro.description",
    intervalMs: 5000,
    thresholds: {
      cpu: 70,
      ram: 70,
      disk: 65,
    },
  },
];

export const findProfileById = (id: ProfileId | string) =>
  PROFILES.find((profile) => profile.id === id);
