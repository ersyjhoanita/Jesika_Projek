import { ambilDetailProyek, updateProyek } from "../db";
import type { Plan3D } from "../components/Plan3DScene";

type ProjectSettings = {
  wallHeight: number;
  roofType: Plan3D["roofType"];
};

type ProjectGeometry = {
  rooms: unknown[];
  walls: unknown[];
  areas: unknown[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function updateProject3DSettings(
  projectId: string,
  settings: ProjectSettings,
  geometry?: ProjectGeometry,
): Promise<void> {
  if (!/^\d+$/.test(projectId)) {
    throw new Error("ID proyek lokal tidak valid.");
  }

  const id = Number(projectId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("ID proyek lokal tidak valid.");
  }

  const project: unknown = ambilDetailProyek(id);
  if (!isRecord(project)) {
    throw new Error("Proyek tidak ditemukan di penyimpanan lokal.");
  }

  const currentDesign = isRecord(project.data_desain) ? project.data_desain : {};
  const updatedDesign = {
    ...currentDesign,
    ...(geometry ?? {}),
    ...settings,
  };
  const dimension =
    typeof project.dimensi === "string" ? project.dimensi : "";

  updateProyek(id, updatedDesign, dimension);
}
