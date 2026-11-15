import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Pattern,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

type DoorType = "swing" | "sliding" | "double_swing";
type WindowType = "casement" | "sliding" | "awning" | "fixed" | "jalousie";

type Opening = {
  id?: string;
  edge?: "top" | "right" | "bottom" | "left";
  position: number;
  kind: "door" | "window";
  width: number;
  height: number;
  sillHeight: number;
  swingDirection?: "in" | "out";
  hingeSide?: "left" | "right";
  type?: DoorType | WindowType;
};

type Room3D = {
  id: string;
  name: string;
  x: number;
  z: number;
  length: number;
  width: number;
  color: string;
  doors: Opening[];
  windows: Opening[];
};

type Wall3D = {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  name?: string;
  topProfile?: WallTopPoint[];
  openings: Opening[];
};

type WallTopPoint = { position: number; height: number };

export type RoofType = "pelana" | "limas" | "joglo" | "datar" | "mansard";

export const ROOF_OPTIONS: { type: RoofType; label: string; shortLabel: string }[] = [
  { type: "pelana", label: "Atap pelana (gable)", shortLabel: "Pelana" },
  { type: "limas", label: "Atap limas (pyramid)", shortLabel: "Limas" },
  { type: "joglo", label: "Atap joglo", shortLabel: "Joglo" },
  { type: "datar", label: "Atap datar", shortLabel: "Datar" },
  { type: "mansard", label: "Atap mansard", shortLabel: "Mansard" },
];

const isRoofType = (value: unknown): value is RoofType =>
  ROOF_OPTIONS.some((option) => option.type === value);

export type Plan3D = {
  landLength: number;
  landWidth: number;
  wallHeight: number;
  roofType: RoofType;
  rooms: Room3D[];
  walls: Wall3D[];
  areas: {
    id: string;
    name: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }[];
};

type Point3D = { x: number; y: number; z: number };
type Point2D = { x: number; y: number };

type Face = {
  points: Point3D[];
  color: string;
  opacity?: number;
};

type WallSegment = {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  name?: string;
  topProfile?: WallTopPoint[];
  openings: Opening[];
};

type ProjectedFace = {
  points: Point2D[];
  depth: number;
  color: string;
  opacity?: number;
};

const WALL_THICKNESS = 0.14;
const ROOF_RISE = 1.25;
const ROOF_OVERHANG = 0.2;

const ZOOM_MIN = 0.65;
const ZOOM_MAX = 2.2;

// ✅ Dari Kode 2: tinggi mata & jangkauan interaksi
const EYE_HEIGHT = 1.6;
const INTERACT_RADIUS = 2.5;

const getFootprintBounds = (plan: Plan3D) => {
  const xCoordinates = [
    ...plan.rooms.flatMap((room) => [room.x, room.x + room.length]),
    ...plan.walls.flatMap((wall) => [wall.x1, wall.x2]),
  ];
  const zCoordinates = [
    ...plan.rooms.flatMap((room) => [room.z, room.z + room.width]),
    ...plan.walls.flatMap((wall) => [wall.z1, wall.z2]),
  ];
  if (!xCoordinates.length || !zCoordinates.length) return null;
  return {
    minX: Math.min(...xCoordinates),
    maxX: Math.max(...xCoordinates),
    minZ: Math.min(...zCoordinates),
    maxZ: Math.max(...zCoordinates),
  };
};

const makeContactShadow = (plan: Plan3D): Face | null => {
  const bounds = getFootprintBounds(plan);
  if (!bounds) return null;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const radiusX = (bounds.maxX - bounds.minX) / 2 + ROOF_OVERHANG;
  const radiusZ = (bounds.maxZ - bounds.minZ) / 2 + ROOF_OVERHANG;
  const points = Array.from({ length: 32 }, (_, index) => {
    const angle = (index / 32) * Math.PI * 2;
    return {
      x: centerX + Math.cos(angle) * radiusX,
      y: -0.065,
      z: centerZ + Math.sin(angle) * radiusZ,
    };
  });
  return { points, color: "#475569", opacity: 0.2 };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown, fallback = 0) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeDoorType = (value: unknown, legacyValue: unknown): DoorType => {
  if (value === "swing" || value === "sliding" || value === "double_swing") {
    return value;
  }
  if (legacyValue === "sliding") return "sliding";
  if (legacyValue === "swing-double") return "double_swing";
  return "swing";
};

const normalizeWindowType = (value: unknown): WindowType | undefined =>
  value === "casement" ||
  value === "sliding" ||
  value === "awning" ||
  value === "fixed" ||
  value === "jalousie"
    ? value
    : undefined;

const readOpenings = (value: unknown, kind: Opening["kind"]): Opening[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const position = finiteNumber(item.position, -1);
    const edge = item.edge;
    if (
      position < 0 ||
      position > 1 ||
      (edge !== undefined &&
        edge !== "top" &&
        edge !== "right" &&
        edge !== "bottom" &&
        edge !== "left")
    ) {
      return [];
    }
    return [
      {
        edge,
        position,
        kind,
        width: finiteNumber(item.width, kind === "door" ? 0.8 : 1.2),
        height: finiteNumber(item.height, kind === "door" ? 2.1 : 1.2),
        sillHeight: finiteNumber(item.sillHeight, kind === "door" ? 0 : 0.9),
        swingDirection:
          item.swingDirection === "in" || item.swingDirection === "out"
            ? item.swingDirection
            : undefined,
        hingeSide:
          item.hingeSide === "left" || item.hingeSide === "right"
            ? item.hingeSide
            : undefined,
        type:
          kind === "door"
            ? normalizeDoorType(item.type, item.doorType)
            : normalizeWindowType(item.type),
      },
    ];
  });
};

const readWallOpenings = (
  wall: Record<string, unknown>,
  wallIndex: number,
): Opening[] => [
  ...(["doors", "windows"] as const).flatMap((field) => {
    const kind: Opening["kind"] = field === "doors" ? "door" : "window";
    return readOpenings(wall[field], kind).map((opening, index) => ({
      ...opening,
      id: `wall-${wallIndex}:${kind}:${index}`,
    }));
  }),
];

const parseRooms = (value: unknown): Room3D[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const x = finiteNumber(item.x, Number.NaN);
    const z = finiteNumber(item.y, Number.NaN);
    const length = finiteNumber(item.panjang, Number.NaN);
    const width = finiteNumber(item.lebar, Number.NaN);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      !Number.isFinite(length) ||
      !Number.isFinite(width) ||
      length <= 0 ||
      width <= 0
    ) {
      return [];
    }
    const id = typeof item.id === "string" ? item.id : `room-${index}`;
    return [
      {
        id,
        name: typeof item.nama === "string" ? item.nama : "Ruangan",
        x,
        z,
        length,
        width,
        color: typeof item.color === "string" ? item.color : "#DBEAFE",
        doors: readOpenings(item.doors, "door").map((opening, openingIndex) => ({
          ...opening,
          id: `${id}:door:${openingIndex}`,
        })),
        windows: readOpenings(item.windows, "window").map((opening, openingIndex) => ({
          ...opening,
          id: `${id}:window:${openingIndex}`,
        })),
      },
    ];
  });
};

const parseWalls = (value: unknown): Wall3D[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, wallIndex) => {
    if (!isRecord(item)) return [];
    const x1 = finiteNumber(item.x1, Number.NaN);
    const z1 = finiteNumber(item.y1, Number.NaN);
    const x2 = finiteNumber(item.x2, Number.NaN);
    const z2 = finiteNumber(item.y2, Number.NaN);
    if (![x1, z1, x2, z2].every(Number.isFinite)) return [];
    const topProfile = Array.isArray(item.topProfile)
      ? [...new Map(item.topProfile.flatMap((point) => {
          if (!isRecord(point)) return [];
          const position = finiteNumber(point.position, Number.NaN);
          const height = finiteNumber(point.height, Number.NaN);
          return Number.isFinite(position) &&
            position >= 0 &&
            position <= 1 &&
            Number.isFinite(height) &&
            height > 0 &&
            height <= 10
            ? [[position, { position, height }] as const]
            : [];
        })).values()].sort((a, b) => a.position - b.position)
      : undefined;
    return [{
      x1,
      z1,
      x2,
      z2,
      name: typeof item.nama === "string" ? item.nama : undefined,
      topProfile: topProfile?.length ? topProfile : undefined,
      openings: readWallOpenings(item, wallIndex),
    }];
  });
};

export const parsePlan3DData = (json: string): Plan3D | null => {
  try {
    const value: unknown = JSON.parse(json);
    if (!isRecord(value)) return null;
    const landLength = finiteNumber(value.panjangLahan);
    const landWidth = finiteNumber(value.lebarLahan);
    const rooms = parseRooms(value.rooms);
    const walls = parseWalls(value.walls);
    const areas = Array.isArray(value.areas)
      ? value.areas.flatMap((item, index) => {
          if (!isRecord(item)) return [];
          const left = finiteNumber(item.left, Number.NaN);
          const top = finiteNumber(item.top, Number.NaN);
          const right = finiteNumber(item.right, Number.NaN);
          const bottom = finiteNumber(item.bottom, Number.NaN);
          if (
            ![left, top, right, bottom].every(Number.isFinite) ||
            right <= left ||
            bottom <= top
          ) {
            return [];
          }
          return [
            {
              id: String(item.id ?? `area-${index}`),
              name: typeof item.nama === "string" ? item.nama : "Area",
              left,
              top,
              right,
              bottom,
            },
          ];
        })
      : [];
    const wallHeight = finiteNumber(value.wallHeight, 3);
    const roofType = isRoofType(value.roofType) ? value.roofType : "pelana";
    if (landLength <= 0 || landWidth <= 0 || (!rooms.length && !walls.length)) {
      return null;
    }
    if (wallHeight < 2 || wallHeight > 6) return null;
    return {
      landLength,
      landWidth,
      wallHeight,
      roofType,
      rooms,
      walls,
      areas,
    };
  } catch (error) {
    console.error("Data denah untuk viewer 3D tidak valid:", error);
    return null;
  }
};

const darker = (color: string, amount: number) => {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  const rgba = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  const values = match
    ? match[1].match(/.{2}/g)?.map((part) => parseInt(part, 16)) ?? []
    : rgba
      ? [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])]
      : [];
  if (!values.length) return amount < 0 ? "#CBD5E1" : "#F8FAFC";
  const factor = 1 + amount;
  return `#${values
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value * factor)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

const makePrismFaces = (
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  bottom: number,
  top: number,
  thickness: number,
): Face[] => {
  return makeProfilePrismFaces(x1, z1, x2, z2, bottom, top, top, thickness);
};

const makeProfilePrismFaces = (
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  bottom: number,
  topStart: number,
  topEnd: number,
  thickness: number,
): Face[] => {
  if (Math.min(topStart, topEnd) <= bottom) return [];
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  if (length < 0.001) return [];
  const ox = (dz / length) * thickness * 0.5;
  const oz = (-dx / length) * thickness * 0.5;
  const a: Point3D = { x: x1 + ox, y: bottom, z: z1 + oz };
  const b: Point3D = { x: x2 + ox, y: bottom, z: z2 + oz };
  const c: Point3D = { x: x2 - ox, y: bottom, z: z2 - oz };
  const d: Point3D = { x: x1 - ox, y: bottom, z: z1 - oz };
  const topA = { ...a, y: topStart };
  const topB = { ...b, y: topEnd };
  const topC = { ...c, y: topEnd };
  const topD = { ...d, y: topStart };
  return [
    { points: [a, b, topB, topA], color: "#F5F1EA" },
    { points: [c, d, topD, topC], color: "#D7D2C9" },
    { points: [b, c, topC, topB], color: "#E9E4DC" },
    { points: [d, a, topA, topD], color: "#E0DBD2" },
    { points: [topA, topB, topC, topD], color: "#FFFDF8" },
  ];
};

const roomEdges = (
  room: Room3D,
): {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  edge: "top" | "right" | "bottom" | "left";
}[] => [
  { x1: room.x, z1: room.z, x2: room.x + room.length, z2: room.z, edge: "top" },
  {
    x1: room.x + room.length,
    z1: room.z,
    x2: room.x + room.length,
    z2: room.z + room.width,
    edge: "right",
  },
  {
    x1: room.x,
    z1: room.z + room.width,
    x2: room.x + room.length,
    z2: room.z + room.width,
    edge: "bottom",
  },
  { x1: room.x, z1: room.z, x2: room.x, z2: room.z + room.width, edge: "left" },
];

const isRoomEdgeFacingCamera = (
  edge: "top" | "right" | "bottom" | "left",
  yaw: number,
) => {
  const cameraX = Math.sin(yaw);
  const cameraZ = Math.cos(yaw);
  const outward =
    edge === "top"
      ? { x: 0, z: -1 }
      : edge === "right"
        ? { x: 1, z: 0 }
        : edge === "bottom"
          ? { x: 0, z: 1 }
          : { x: -1, z: 0 };
  return outward.x * cameraX + outward.z * cameraZ > 0;
};

const mergeWallSegments = (segments: WallSegment[]): WallSegment[] => {
  const groups = new Map<
    string,
    {
      ux: number;
      uz: number;
      offset: number;
      segments: { start: number; end: number; name?: string; openings: Opening[] }[];
    }
  >();

  for (const segment of segments) {
    const dx = segment.x2 - segment.x1;
    const dz = segment.z2 - segment.z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.001) continue;

    let ux = dx / length;
    let uz = dz / length;
    if (ux < -0.001 || (Math.abs(ux) <= 0.001 && uz < 0)) {
      ux = -ux;
      uz = -uz;
    }
    const offset = -uz * segment.x1 + ux * segment.z1;
    const key = `${ux.toFixed(3)},${uz.toFixed(3)},${offset.toFixed(3)}`;
    const startPoint = segment.x1 * ux + segment.z1 * uz;
    const endPoint = segment.x2 * ux + segment.z2 * uz;
    const start = Math.min(startPoint, endPoint);
    const end = Math.max(startPoint, endPoint);
    const sameDirection = endPoint >= startPoint;
    const group = groups.get(key) ?? { ux, uz, offset, segments: [] };
    group.segments.push({
      start,
      end,
      name: segment.name,
      openings: segment.openings.map((opening) => ({
        ...opening,
        position:
          (start +
            (sameDirection ? opening.position : 1 - opening.position) *
              length -
            start) /
          (end - start),
      })),
    });
    groups.set(key, group);
  }

  const merged: WallSegment[] = [];
  for (const group of groups.values()) {
    const ordered = [...group.segments].sort(
      (first, second) => first.start - second.start,
    );
    const ranges: {
      start: number;
      end: number;
      name?: string;
      openings: Opening[];
    }[] = [];
    for (const segment of ordered) {
      const current = ranges[ranges.length - 1];
      if (!current || segment.start > current.end + 0.001) {
        ranges.push({
          start: segment.start,
          end: segment.end,
          name: segment.name,
          openings: [...segment.openings],
        });
      } else {
        const nextLength = segment.end - segment.start;
        if (!current.name && segment.name) current.name = segment.name;
        const mergedEnd = Math.max(current.end, segment.end);
        const currentLength = current.end - current.start;
        current.openings = current.openings.map((opening) => ({
          ...opening,
          position:
            (current.start + opening.position * currentLength - current.start) /
            Math.max(mergedEnd - current.start, 0.001),
        }));
        current.openings.push(...segment.openings.map((opening) => {
          const center = segment.start + opening.position * nextLength;
          return {
            ...opening,
            position:
              (center - current.start) / Math.max(mergedEnd - current.start, 0.001),
          };
        }));
        current.end = mergedEnd;
      }
    }

    for (const range of ranges) {
      const length = range.end - range.start;
      const openingKeys = new Set<string>();
      const openings = range.openings.flatMap((opening) => {
        const center = range.start + opening.position * length;
        const key = [
          opening.kind,
          center.toFixed(3),
          opening.width.toFixed(3),
          opening.height.toFixed(3),
          opening.sillHeight.toFixed(3),
          opening.type ?? "",
        ].join(":");
        if (openingKeys.has(key)) return [];
        openingKeys.add(key);
        return [{ ...opening, position: (center - range.start) / length }];
      });
      const pointAt = (distance: number) => ({
        x: group.ux * distance - group.uz * group.offset,
        z: group.uz * distance + group.ux * group.offset,
      });
      const first = pointAt(range.start);
      const second = pointAt(range.end);
      merged.push({
        x1: first.x,
        z1: first.z,
        x2: second.x,
        z2: second.z,
        name: range.name,
        openings,
      });
    }
  }

  return merged;
};

// ✅ Dari Kode 2: parameter `firstPerson` untuk render lantai & plafon interior
const buildFaces = (
  plan: Plan3D,
  showRoof: boolean,
  openingProgress: Record<string, number> = {},
  firstPerson = false,
): Face[] => {
  const faces: Face[] = [];
  const wallSegments: WallSegment[] = [];

  for (const room of plan.rooms) {
    const color = darker(room.color, -0.06);
    const roomCorners: Point3D[] = [
      { x: room.x, y: 0.025, z: room.z },
      { x: room.x + room.length, y: 0.025, z: room.z },
      { x: room.x + room.length, y: 0.025, z: room.z + room.width },
      { x: room.x, y: 0.025, z: room.z + room.width },
    ];
    faces.push({ points: roomCorners, color });

    for (const edge of roomEdges(room)) {
      const openingsForEdge = [...room.doors, ...room.windows].filter(
        (opening) => opening.edge === edge.edge,
      );
      wallSegments.push({ ...edge, openings: openingsForEdge });
    }
  }

  for (const wall of plan.walls) {
    wallSegments.push(wall);
  }

  const wallsForRendering = [
    ...mergeWallSegments(wallSegments.filter((wall) => !wall.topProfile?.length)),
    ...wallSegments.filter((wall) => wall.topProfile?.length),
  ];
  for (const wall of wallsForRendering) {
    const length = Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1);
    if (length < 0.001) continue;
    const intervals = [0, length];
    for (const point of wall.topProfile ?? []) {
      intervals.push(point.position * length);
    }
    const openings = wall.openings.map((opening) => {
      const width = opening.width;
      const center = opening.position * length;
      const start = Math.max(0, center - width / 2);
      const end = Math.min(length, center + width / 2);
      intervals.push(start, end);
      return {
        id: opening.id,
        start,
        end,
        kind: opening.kind,
        bottom: opening.kind === "door" ? 0 : opening.sillHeight,
        top:
          opening.kind === "door"
            ? opening.height
            : opening.sillHeight + opening.height,
        hingeSide: opening.hingeSide,
        type: opening.type,
        swingDirection: opening.swingDirection,
      };
    });
    const sorted = [...new Set(intervals)].sort((a, b) => a - b);
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const start = sorted[index];
      const end = sorted[index + 1];
      if (end - start < 0.001) continue;
      const middle = (start + end) / 2;
      const opening = openings.find(
        (candidate) => middle > candidate.start && middle < candidate.end,
      );
      const xAt = (distance: number) =>
        wall.x1 + ((wall.x2 - wall.x1) * distance) / length;
      const zAt = (distance: number) =>
        wall.z1 + ((wall.z2 - wall.z1) * distance) / length;
      const profile = wall.topProfile ?? [];
      const heightAt = (distance: number) => {
        const position = distance / length;
        if (!profile.length) return plan.wallHeight;
        if (position <= profile[0].position) return profile[0].height;
        for (let pointIndex = 1; pointIndex < profile.length; pointIndex += 1) {
          const previous = profile[pointIndex - 1];
          const next = profile[pointIndex];
          if (position <= next.position) {
            const ratio =
              (position - previous.position) / (next.position - previous.position);
            return previous.height + (next.height - previous.height) * ratio;
          }
        }
        return profile[profile.length - 1].height;
      };
      faces.push(
        ...makeProfilePrismFaces(
          xAt(start),
          zAt(start),
          xAt(end),
          zAt(end),
          opening?.top ?? 0,
          heightAt(start),
          heightAt(end),
          WALL_THICKNESS,
        ),
      );
      if (opening && opening.kind === "window" && opening.bottom > 0) {
        faces.push(
          ...makeProfilePrismFaces(
            xAt(start),
            zAt(start),
            xAt(end),
            zAt(end),
            0,
            Math.min(opening.bottom, heightAt(start)),
            Math.min(opening.bottom, heightAt(end)),
            WALL_THICKNESS,
          ),
        );
      }

      if (opening) {
        const openingBottom = opening.bottom;
        const openingTop = opening.top;
        const localLen = end - start;

        const dirX = (wall.x2 - wall.x1) / length;
        const dirZ = (wall.z2 - wall.z1) / length;
        const nx = dirZ;
        const nz = -dirX;
        const off = 0.012;

        if (opening.kind === "door") {
          const doorType =
            opening.type === "sliding" || opening.type === "double_swing"
              ? opening.type
              : "swing";
          const center = (start + end) / 2;
          const swingSide = opening.swingDirection === "in" ? -1 : 1;
          const progress = opening.id
            ? Math.max(0, Math.min(1, openingProgress[opening.id] ?? 0))
            : 0;
          const slideDirection = length - end >= start ? 1 : -1;
          const slideDistance =
            Math.min(localLen, Math.max(start, length - end)) * progress;
          const doorPoint = (
            t: number,
            y: number,
            leafIndex: number,
            depth = 0,
          ): Point3D => {
            if (doorType === "sliding") {
              const movedT = t + slideDirection * slideDistance;
              return {
                x: xAt(movedT) + nx * depth,
                y,
                z: zAt(movedT) + nz * depth,
              };
            }
            const hingeAtStart =
              doorType === "double_swing"
                ? leafIndex === 0
                : opening.hingeSide !== "right";
            const hingeT = hingeAtStart ? start : end;
            const direction = hingeAtStart ? 1 : -1;
            const distance = (t - hingeT) * direction;
            const angle = (Math.PI / 2) * progress;
            return {
              x:
                xAt(hingeT) +
                dirX * direction * distance * Math.cos(angle) +
                nx * swingSide * distance * Math.sin(angle) +
                nx * depth,
              y,
              z:
                zAt(hingeT) +
                dirZ * direction * distance * Math.cos(angle) +
                nz * swingSide * distance * Math.sin(angle) +
                nz * depth,
            };
          };
          const addDoorLeaf = (
            leafStart: number,
            leafEnd: number,
            leafIndex: number,
          ) => {
            faces.push({
              points: [
                doorPoint(leafStart, openingBottom, leafIndex),
                doorPoint(leafEnd, openingBottom, leafIndex),
                doorPoint(leafEnd, openingTop, leafIndex),
                doorPoint(leafStart, openingTop, leafIndex),
              ],
              color: "url(#doorWood)",
            });
          };
          if (doorType === "double_swing") {
            addDoorLeaf(start, center, 0);
            addDoorLeaf(center, end, 1);
          } else {
            addDoorLeaf(start, end, 0);
          }
          if (doorType === "double_swing" && progress < 0.01) {
            const seamWidth = Math.min(0.018, localLen * 0.025);
            faces.push({
              points: [
                { x: xAt(center - seamWidth / 2), y: openingBottom, z: zAt(center - seamWidth / 2) + nx * off },
                { x: xAt(center + seamWidth / 2), y: openingBottom, z: zAt(center + seamWidth / 2) + nx * off },
                { x: xAt(center + seamWidth / 2), y: openingTop, z: zAt(center + seamWidth / 2) + nx * off },
                { x: xAt(center - seamWidth / 2), y: openingTop, z: zAt(center - seamWidth / 2) + nx * off },
              ],
              color: "#5D4037",
              opacity: 0.8,
            });
          }

          const trim = Math.min(0.055, localLen * 0.12);
          const trimY = Math.min(0.055, (openingTop - openingBottom) * 0.08);
          const trimFaces: Face[] = [
            {
              points: [
                { x: xAt(start), y: openingBottom, z: zAt(start) },
                { x: xAt(start + trim), y: openingBottom, z: zAt(start + trim) },
                { x: xAt(start + trim), y: openingTop, z: zAt(start + trim) },
                { x: xAt(start), y: openingTop, z: zAt(start) },
              ],
              color: "#5D4037",
            },
            {
              points: [
                { x: xAt(end - trim), y: openingBottom, z: zAt(end - trim) },
                { x: xAt(end), y: openingBottom, z: zAt(end) },
                { x: xAt(end), y: openingTop, z: zAt(end) },
                { x: xAt(end - trim), y: openingTop, z: zAt(end - trim) },
              ],
              color: "#5D4037",
            },
            {
              points: [
                { x: xAt(start), y: openingTop - trimY, z: zAt(start) },
                { x: xAt(end), y: openingTop - trimY, z: zAt(end) },
                { x: xAt(end), y: openingTop, z: zAt(end) },
                { x: xAt(start), y: openingTop, z: zAt(start) },
              ],
              color: "#8B5A2B",
            },
          ];
          faces.push(...trimFaces);

          const leaves =
            doorType === "double_swing"
              ? [
                  { start, end: center, index: 0 },
                  { start: center, end, index: 1 },
                ]
              : [{ start, end, index: 0 }];
          const grainWidth = Math.min(0.012, localLen * 0.025);
          for (const leaf of leaves) {
            for (const fraction of [0.28, 0.62]) {
              const grainT = leaf.start + (leaf.end - leaf.start) * fraction;
              faces.push({
                points: [
                  doorPoint(grainT - grainWidth / 2, openingBottom + trimY, leaf.index, off * 1.1),
                  doorPoint(grainT + grainWidth / 2, openingBottom + trimY, leaf.index, off * 1.1),
                  doorPoint(grainT + grainWidth / 2, openingTop - trimY, leaf.index, off * 1.1),
                  doorPoint(grainT - grainWidth / 2, openingTop - trimY, leaf.index, off * 1.1),
                ],
                color: "#995A32",
                opacity: 0.55,
              });
            }
          }

          const handleHeight = Math.min(0.16, (openingTop - openingBottom) * 0.1);
          const handleY = openingBottom + (openingTop - openingBottom) * 0.48;
          const handleHalfWidth = Math.min(0.018, localLen * 0.035);
          for (const leaf of leaves) {
            const handleT =
              doorType === "double_swing"
                ? (leaf.start + leaf.end) / 2 +
                  (leaf.index === 0 ? localLen * 0.08 : -localLen * 0.08)
                : doorType === "swing" && opening.hingeSide !== "right"
                  ? end - localLen * 0.14
                  : start + localLen * 0.14;
            const handleStart = handleT - handleHalfWidth;
            const handleEnd = handleT + handleHalfWidth;
            faces.push({
              points: [
                doorPoint(handleStart, handleY - handleHeight / 2, leaf.index, 0.035),
                doorPoint(handleEnd, handleY - handleHeight / 2, leaf.index, 0.035),
                doorPoint(handleEnd, handleY + handleHeight / 2, leaf.index, 0.035),
                doorPoint(handleStart, handleY + handleHeight / 2, leaf.index, 0.035),
              ],
              color: "#171717",
            });
          }
        } else {
          const windowType = opening.type ?? "sliding";
          const progress = opening.id
            ? Math.max(0, Math.min(1, openingProgress[opening.id] ?? 0))
            : 0;
          const windowAngle = progress * (Math.PI / 3);
          const center = (start + end) / 2;
          const hingeAtStart = opening.hingeSide !== "right";
          const hingeT = hingeAtStart ? start : end;
          const swingSide = opening.swingDirection === "in" ? -1 : 1;
          const slideDistance = (localLen / 2) * progress;
          const panePoint = (t: number, y: number): Point3D => {
            if (windowType === "casement") {
              const distance = t - hingeT;
              return {
                x:
                  xAt(hingeT) +
                  dirX * distance * Math.cos(windowAngle) +
                  nx * swingSide * Math.abs(distance) * Math.sin(windowAngle),
                y,
                z:
                  zAt(hingeT) +
                  dirZ * distance * Math.cos(windowAngle) +
                nz * swingSide * Math.abs(distance) * Math.sin(windowAngle),
              };
            }
            if (windowType === "awning" && y < openingTop) {
              const ratio = (openingTop - y) / (openingTop - openingBottom);
              const offset = ratio * (openingTop - openingBottom) * Math.sin(windowAngle);
              return {
                x: xAt(t) + nx * swingSide * offset,
                y: openingTop - (openingTop - y) * Math.cos(windowAngle),
                z: zAt(t) + nz * swingSide * offset,
              };
            }
            return { x: xAt(t), y, z: zAt(t) };
          };
          const slidingPanePoint = (
            t: number,
            y: number,
            moving: boolean,
          ): Point3D => {
            const movedT = moving ? t - slideDistance : t;
            const depth = moving ? off * 1.5 : 0;
            return {
              x: xAt(movedT) + nx * depth,
              y,
              z: zAt(movedT) + nz * depth,
            };
          };
          if (windowType === "sliding") {
            faces.push(
              {
                points: [
                  slidingPanePoint(start, openingBottom, false),
                  slidingPanePoint(center, openingBottom, false),
                  slidingPanePoint(center, openingTop, false),
                  slidingPanePoint(start, openingTop, false),
                ],
                color: "url(#windowGlass)",
              },
              {
                points: [
                  slidingPanePoint(center, openingBottom, true),
                  slidingPanePoint(end, openingBottom, true),
                  slidingPanePoint(end, openingTop, true),
                  slidingPanePoint(center, openingTop, true),
                ],
                color: "url(#windowGlass)",
              },
            );
          } else if (windowType !== "jalousie") {
            faces.push({
              points: [
                panePoint(start, openingBottom),
                panePoint(end, openingBottom),
                panePoint(end, openingTop),
                panePoint(start, openingTop),
              ],
              color: "url(#windowGlass)",
            });
          }

          const fs = Math.min(0.055, localLen * 0.08, (openingTop - openingBottom) * 0.08);
          const rects: [number, number, number, number][] = [
            [start, end, openingTop - fs, openingTop],
            [start, end, openingBottom, openingBottom + fs],
            [start, start + fs, openingBottom, openingTop],
            [end - fs, end, openingBottom, openingTop],
          ];
          for (const [tA, tB, yA, yB] of rects) {
            faces.push({
              points: [
                { x: xAt(tA) + nx * off, y: yA, z: zAt(tA) + nz * off },
                { x: xAt(tB) + nx * off, y: yA, z: zAt(tB) + nz * off },
                { x: xAt(tB) + nx * off, y: yB, z: zAt(tB) + nz * off },
                { x: xAt(tA) + nx * off, y: yB, z: zAt(tA) + nz * off },
              ],
              color: "url(#windowFrame)",
            });
          }

          const addWindowBar = (
            t1: number,
            t2: number,
            y1: number,
            y2: number,
            color: string,
          ) => {
            const at = (t: number, y: number) =>
              windowType === "casement" || windowType === "awning"
                ? panePoint(t, y)
                : {
                    x: xAt(t) + nx * (off * 1.2),
                    y,
                    z: zAt(t) + nz * (off * 1.2),
                  };
            faces.push({
              points: [
                at(t1, y1),
                at(t2, y1),
                at(t2, y2),
                at(t1, y2),
              ],
              color,
            });
          };
          const addWindowDiagonal = (
            t1: number,
            y1: number,
            t2: number,
            y2: number,
          ) => {
            const deltaT = t2 - t1;
            const deltaY = y2 - y1;
            const diagonalLength = Math.hypot(deltaT, deltaY);
            if (diagonalLength < 0.001) return;
            const halfWidth = 0.012;
            const offsetT = (-deltaY / diagonalLength) * halfWidth;
            const offsetY = (deltaT / diagonalLength) * halfWidth;
            const points = [
              [t1 + offsetT, y1 + offsetY],
              [t2 + offsetT, y2 + offsetY],
              [t2 - offsetT, y2 - offsetY],
              [t1 - offsetT, y1 - offsetY],
            ];
            faces.push({
              points: points.map(([t, y]) => panePoint(t, y)),
              color: "#E2E8F0",
            });
          };
          const mullionWidth = Math.min(0.04, localLen * 0.055);
          if (windowType !== "sliding" && windowType !== "jalousie") {
            addWindowBar(
              center - mullionWidth / 2,
              center + mullionWidth / 2,
              openingBottom + fs,
              openingTop - fs,
              "url(#windowFrame)",
            );
          }
          const transomHeight = Math.min(
            0.055,
            (openingTop - openingBottom) * 0.07,
          );
          const transomY = openingTop - (openingTop - openingBottom) * 0.18;
          if (windowType !== "sliding" && windowType !== "jalousie") {
            addWindowBar(
              start + fs,
              end - fs,
              transomY - transomHeight / 2,
              transomY + transomHeight / 2,
              "url(#windowFrame)",
            );
          }

          if (windowType === "jalousie") {
            const slatHeight = Math.min(0.035, (openingTop - openingBottom) / 8);
            const barInset = Math.min(0.05, localLen * 0.1);
            const slatAngle = progress * (Math.PI / 5);
            for (let index = 1; index <= 4; index += 1) {
              const centerY =
                openingBottom +
                ((openingTop - openingBottom) * index) / 5;
              const halfHeight = (slatHeight * Math.cos(slatAngle)) / 2;
              const halfDepth = (slatHeight * Math.sin(slatAngle)) / 2;
              const slatPoint = (t: number, upper: boolean): Point3D => {
                const sign = upper ? 1 : -1;
                const depth = sign * halfDepth + off * 1.2;
                return {
                  x: xAt(t) + nx * depth,
                  y: centerY + sign * halfHeight,
                  z: zAt(t) + nz * depth,
                };
              };
              faces.push({
                points: [
                  slatPoint(start + barInset, false),
                  slatPoint(end - barInset, false),
                  slatPoint(end - barInset, true),
                  slatPoint(start + barInset, true),
                ],
                color: index % 2 === 0 ? "#292929" : "#151515",
              });
            }
          } else if (windowType === "awning") {
            const centerY = (openingBottom + openingTop) / 2;
            const barInset = Math.min(0.04, localLen * 0.1);
            addWindowBar(
              start + barInset,
              end - barInset,
              centerY - 0.025,
              centerY + 0.025,
              "#202020",
            );
          } else if (windowType === "casement") {
            const inset = Math.min(0.08, localLen * 0.15);
            const yInset = Math.min(0.08, (openingTop - openingBottom) * 0.15);
            addWindowDiagonal(
              opening.hingeSide === "right" ? end - inset : start + inset,
              openingBottom + yInset,
              opening.hingeSide === "right" ? start + inset : end - inset,
              openingTop - yInset,
            );
          } else if (windowType === "sliding") {
            const trackHeight = Math.min(
              0.035,
              (openingTop - openingBottom) * 0.04,
            );
            addWindowBar(
              start + fs,
              end - fs,
              openingBottom + fs,
              openingBottom + fs + trackHeight,
              "url(#windowFrame)",
            );
            const movingMullionT = center + localLen / 4 - slideDistance;
            faces.push({
              points: [
                slidingPanePoint(movingMullionT - mullionWidth / 2, openingBottom + fs, true),
                slidingPanePoint(movingMullionT + mullionWidth / 2, openingBottom + fs, true),
                slidingPanePoint(movingMullionT + mullionWidth / 2, openingTop - fs, true),
                slidingPanePoint(movingMullionT - mullionWidth / 2, openingTop - fs, true),
              ],
              color: "url(#windowFrame)",
            });
            addWindowBar(
              center - localLen / 4 - mullionWidth / 2,
              center - localLen / 4 + mullionWidth / 2,
              openingBottom + fs,
              openingTop - fs,
              "url(#windowFrame)",
            );
          }
        }
      }
    }
  }

  // ✅ Dari Kode 2: lantai & plafon interior saat First Person
  if (firstPerson) {
    for (const room of plan.rooms) {
      faces.push({
        points: [
          { x: room.x, y: 0.01, z: room.z },
          { x: room.x + room.length, y: 0.01, z: room.z },
          { x: room.x + room.length, y: 0.01, z: room.z + room.width },
          { x: room.x, y: 0.01, z: room.z + room.width },
        ],
        color: darker(room.color, 0.15),
      });
      faces.push({
        points: [
          { x: room.x, y: plan.wallHeight - 0.01, z: room.z },
          { x: room.x + room.length, y: plan.wallHeight - 0.01, z: room.z },
          { x: room.x + room.length, y: plan.wallHeight - 0.01, z: room.z + room.width },
          { x: room.x, y: plan.wallHeight - 0.01, z: room.z + room.width },
        ],
        color: "#F1F5F9",
      });
    }
  }

  if (showRoof) {
    const bounds = getFootprintBounds(plan);
    if (!bounds) return faces;
    const minX = bounds.minX - ROOF_OVERHANG;
    const maxX = bounds.maxX + ROOF_OVERHANG;
    const minZ = bounds.minZ - ROOF_OVERHANG;
    const maxZ = bounds.maxZ + ROOF_OVERHANG;

    if (maxX - minX > 0.5 && maxZ - minZ > 0.5) {
      const addGableRoof = (
        x1: number,
        x2: number,
        z1: number,
        z2: number,
        rise: number,
      ) => {
        const roofY = plan.wallHeight + rise;
        if (x2 - x1 >= z2 - z1) {
          const ridgeZ = (z1 + z2) / 2;
          faces.push(
            {
              points: [
                { x: x1, y: plan.wallHeight, z: z1 },
                { x: x2, y: plan.wallHeight, z: z1 },
                { x: x2, y: roofY, z: ridgeZ },
                { x: x1, y: roofY, z: ridgeZ },
              ],
              color: "url(#roofTiles)",
            },
            {
              points: [
                { x: x1, y: roofY, z: ridgeZ },
                { x: x2, y: roofY, z: ridgeZ },
                { x: x2, y: plan.wallHeight, z: z2 },
                { x: x1, y: plan.wallHeight, z: z2 },
              ],
              color: "url(#roofTiles)",
            },
            {
              points: [
                { x: x1, y: plan.wallHeight, z: z1 },
                { x: x1, y: roofY, z: ridgeZ },
                { x: x1, y: plan.wallHeight, z: z2 },
              ],
              color: "#475569",
            },
            {
              points: [
                { x: x2, y: plan.wallHeight, z: z1 },
                { x: x2, y: plan.wallHeight, z: z2 },
                { x: x2, y: roofY, z: ridgeZ },
              ],
              color: "#334155",
            },
          );
        } else {
          const ridgeX = (x1 + x2) / 2;
          faces.push(
            {
              points: [
                { x: x1, y: plan.wallHeight, z: z1 },
                { x: x1, y: plan.wallHeight, z: z2 },
                { x: ridgeX, y: roofY, z: z2 },
                { x: ridgeX, y: roofY, z: z1 },
              ],
              color: "url(#roofTiles)",
            },
            {
              points: [
                { x: ridgeX, y: roofY, z: z1 },
                { x: ridgeX, y: roofY, z: z2 },
                { x: x2, y: plan.wallHeight, z: z2 },
                { x: x2, y: plan.wallHeight, z: z1 },
              ],
              color: "url(#roofTiles)",
            },
            {
              points: [
                { x: x1, y: plan.wallHeight, z: z1 },
                { x: ridgeX, y: roofY, z: z1 },
                { x: x2, y: plan.wallHeight, z: z1 },
              ],
              color: "#475569",
            },
            {
              points: [
                { x: x1, y: plan.wallHeight, z: z2 },
                { x: x2, y: plan.wallHeight, z: z2 },
                { x: ridgeX, y: roofY, z: z2 },
              ],
              color: "#334155",
            },
          );
        }
      };
      const addHipRoof = (
        x1: number,
        x2: number,
        z1: number,
        z2: number,
        rise: number,
        baseY = plan.wallHeight,
      ) => {
        const spanX = x2 - x1;
        const spanZ = z2 - z1;
        const roofY = baseY + rise;
        if (spanX >= spanZ) {
          const ridgeZ = (z1 + z2) / 2;
          const ridgeStart = { x: x1 + spanZ / 2, y: roofY, z: ridgeZ };
          const ridgeEnd = { x: x2 - spanZ / 2, y: roofY, z: ridgeZ };
          faces.push(
            {
              points: [
                { x: x1, y: baseY, z: z1 },
                { x: x2, y: baseY, z: z1 },
                ridgeEnd,
                ridgeStart,
              ],
              color: "url(#roofTiles)",
            },
            {
              points: [
                ridgeStart,
                ridgeEnd,
                { x: x2, y: baseY, z: z2 },
                { x: x1, y: baseY, z: z2 },
              ],
              color: "url(#roofTiles)",
            },
            {
              points: [
                { x: x1, y: baseY, z: z1 },
                ridgeStart,
                { x: x1, y: baseY, z: z2 },
              ],
              color: "#475569",
            },
            {
              points: [
                { x: x2, y: baseY, z: z1 },
                { x: x2, y: baseY, z: z2 },
                ridgeEnd,
              ],
              color: "#334155",
            },
          );
        } else {
          const ridgeX = (x1 + x2) / 2;
          const ridgeStart = { x: ridgeX, y: roofY, z: z1 + spanX / 2 };
          const ridgeEnd = { x: ridgeX, y: roofY, z: z2 - spanX / 2 };
          faces.push(
            {
              points: [
                { x: x1, y: baseY, z: z1 },
                { x: x1, y: baseY, z: z2 },
                ridgeEnd,
                ridgeStart,
              ],
              color: "url(#roofTiles)",
            },
            {
              points: [
                ridgeStart,
                ridgeEnd,
                { x: x2, y: baseY, z: z2 },
                { x: x2, y: baseY, z: z1 },
              ],
              color: "url(#roofTiles)",
            },
            {
              points: [
                { x: x1, y: baseY, z: z1 },
                ridgeStart,
                { x: x2, y: baseY, z: z1 },
              ],
              color: "#475569",
            },
            {
              points: [
                { x: x1, y: baseY, z: z2 },
                { x: x2, y: baseY, z: z2 },
                ridgeEnd,
              ],
              color: "#334155",
            },
          );
        }
      };

      if (plan.roofType === "datar") {
        const roofY = plan.wallHeight + 0.08;
        faces.push({
          points: [
            { x: minX, y: roofY, z: minZ },
            { x: maxX, y: roofY, z: minZ },
            { x: maxX, y: roofY, z: maxZ },
            { x: minX, y: roofY, z: maxZ },
          ],
          color: "url(#roofTiles)",
        });
      } else if (plan.roofType === "joglo") {
        const spanX = maxX - minX;
        const spanZ = maxZ - minZ;
        const insetX = spanX * 0.22;
        const insetZ = spanZ * 0.22;
        const shoulderY = plan.wallHeight + ROOF_RISE * 0.58;
        const inner = {
          minX: minX + insetX,
          maxX: maxX - insetX,
          minZ: minZ + insetZ,
          maxZ: maxZ - insetZ,
        };
        faces.push(
          {
            points: [
              { x: minX, y: plan.wallHeight, z: minZ },
              { x: maxX, y: plan.wallHeight, z: minZ },
              { x: inner.maxX, y: shoulderY, z: inner.minZ },
              { x: inner.minX, y: shoulderY, z: inner.minZ },
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: maxX, y: plan.wallHeight, z: minZ },
              { x: maxX, y: plan.wallHeight, z: maxZ },
              { x: inner.maxX, y: shoulderY, z: inner.maxZ },
              { x: inner.maxX, y: shoulderY, z: inner.minZ },
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: maxX, y: plan.wallHeight, z: maxZ },
              { x: minX, y: plan.wallHeight, z: maxZ },
              { x: inner.minX, y: shoulderY, z: inner.maxZ },
              { x: inner.maxX, y: shoulderY, z: inner.maxZ },
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: minX, y: plan.wallHeight, z: maxZ },
              { x: minX, y: plan.wallHeight, z: minZ },
              { x: inner.minX, y: shoulderY, z: inner.minZ },
              { x: inner.minX, y: shoulderY, z: inner.maxZ },
            ],
            color: "url(#roofTiles)",
          },
        );
        addHipRoof(
          inner.minX,
          inner.maxX,
          inner.minZ,
          inner.maxZ,
          ROOF_RISE * 0.72,
          shoulderY,
        );
      } else if (plan.roofType === "mansard") {
        const insetX = Math.min((maxX - minX) * 0.22, 0.75);
        const insetZ = Math.min((maxZ - minZ) * 0.22, 0.75);
        const lowerY = plan.wallHeight + ROOF_RISE * 0.62;
        const inner = {
          minX: minX + insetX,
          maxX: maxX - insetX,
          minZ: minZ + insetZ,
          maxZ: maxZ - insetZ,
        };
        faces.push(
          {
            points: [
              { x: minX, y: plan.wallHeight, z: minZ },
              { x: maxX, y: plan.wallHeight, z: minZ },
              { x: inner.maxX, y: lowerY, z: inner.minZ },
              { x: inner.minX, y: lowerY, z: inner.minZ },
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: maxX, y: plan.wallHeight, z: minZ },
              { x: maxX, y: plan.wallHeight, z: maxZ },
              { x: inner.maxX, y: lowerY, z: inner.maxZ },
              { x: inner.maxX, y: lowerY, z: inner.minZ },
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: maxX, y: plan.wallHeight, z: maxZ },
              { x: minX, y: plan.wallHeight, z: maxZ },
              { x: inner.minX, y: lowerY, z: inner.maxZ },
              { x: inner.maxX, y: lowerY, z: inner.maxZ },
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: minX, y: plan.wallHeight, z: maxZ },
              { x: minX, y: plan.wallHeight, z: minZ },
              { x: inner.minX, y: lowerY, z: inner.minZ },
              { x: inner.minX, y: lowerY, z: inner.maxZ },
            ],
            color: "url(#roofTiles)",
          },
        );
        addHipRoof(inner.minX, inner.maxX, inner.minZ, inner.maxZ, ROOF_RISE * 0.38);
      } else if (plan.roofType === "limas") {
        const apex = {
          x: (minX + maxX) / 2,
          y: plan.wallHeight + ROOF_RISE,
          z: (minZ + maxZ) / 2,
        };
        faces.push(
          {
            points: [
              { x: minX, y: plan.wallHeight, z: minZ },
              { x: maxX, y: plan.wallHeight, z: minZ },
              apex,
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: maxX, y: plan.wallHeight, z: minZ },
              { x: maxX, y: plan.wallHeight, z: maxZ },
              apex,
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: maxX, y: plan.wallHeight, z: maxZ },
              { x: minX, y: plan.wallHeight, z: maxZ },
              apex,
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: minX, y: plan.wallHeight, z: maxZ },
              { x: minX, y: plan.wallHeight, z: minZ },
              apex,
            ],
            color: "url(#roofTiles)",
          },
        );
      } else if (maxX - minX >= maxZ - minZ) {
        const ridgeZ = (minZ + maxZ) / 2;
        const ridgeY = plan.wallHeight + ROOF_RISE;
        faces.push(
          {
            points: [
              { x: minX, y: plan.wallHeight, z: minZ },
              { x: maxX, y: plan.wallHeight, z: minZ },
              { x: maxX, y: ridgeY, z: ridgeZ },
              { x: minX, y: ridgeY, z: ridgeZ },
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: minX, y: ridgeY, z: ridgeZ },
              { x: maxX, y: ridgeY, z: ridgeZ },
              { x: maxX, y: plan.wallHeight, z: maxZ },
              { x: minX, y: plan.wallHeight, z: maxZ },
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: minX, y: plan.wallHeight, z: minZ },
              { x: minX, y: ridgeY, z: ridgeZ },
              { x: minX, y: plan.wallHeight, z: maxZ },
            ],
            color: "#475569",
          },
          {
            points: [
              { x: maxX, y: plan.wallHeight, z: minZ },
              { x: maxX, y: plan.wallHeight, z: maxZ },
              { x: maxX, y: ridgeY, z: ridgeZ },
            ],
            color: "#334155",
          },
        );
      } else {
        const ridgeX = (minX + maxX) / 2;
        const ridgeY = plan.wallHeight + ROOF_RISE;
        faces.push(
          {
            points: [
              { x: minX, y: plan.wallHeight, z: minZ },
              { x: minX, y: plan.wallHeight, z: maxZ },
              { x: ridgeX, y: ridgeY, z: maxZ },
              { x: ridgeX, y: ridgeY, z: minZ },
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: ridgeX, y: ridgeY, z: minZ },
              { x: ridgeX, y: ridgeY, z: maxZ },
              { x: maxX, y: plan.wallHeight, z: maxZ },
              { x: maxX, y: plan.wallHeight, z: minZ },
            ],
            color: "url(#roofTiles)",
          },
          {
            points: [
              { x: minX, y: plan.wallHeight, z: minZ },
              { x: ridgeX, y: ridgeY, z: minZ },
              { x: maxX, y: plan.wallHeight, z: minZ },
            ],
            color: "#475569",
          },
          {
            points: [
              { x: minX, y: plan.wallHeight, z: maxZ },
              { x: maxX, y: plan.wallHeight, z: maxZ },
              { x: ridgeX, y: ridgeY, z: maxZ },
            ],
            color: "#334155",
          },
        );
      }
    }
  }
  return faces;
};

// ✅ Dari Kode 2: projectPoint dengan camY
const projectPoint = (
  point: Point3D,
  yaw: number,
  pitch: number,
  camX: number = 0,
  camY: number = 0,
  camZ: number = 0,
): { point: Point2D; depth: number } => {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const dx = point.x - camX;
  const dz = point.z - camZ;
  const dy = point.y - camY;
  const horizontal = dx * cosYaw - dz * sinYaw;
  const depth = dx * sinYaw + dz * cosYaw;
  return {
    point: {
      x: horizontal,
      y: -dy * Math.cos(pitch) + depth * Math.sin(pitch),
    },
    depth,
  };
};

const faceCenterDepth = (
  face: Face,
  yaw: number,
  pitch: number,
  camX: number = 0,
  camY: number = 0,
  camZ: number = 0,
) => {
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  const avgX = face.points.reduce((s, p) => s + p.x, 0) / face.points.length;
  const avgZ = face.points.reduce((s, p) => s + p.z, 0) / face.points.length;
  const avgY = face.points.reduce((s, p) => s + p.y, 0) / face.points.length;
  const dx = avgX - camX;
  const dz = avgZ - camZ;
  const dy = avgY - camY;
  return (dx * sinYaw + dz * cosYaw) * Math.cos(pitch) + dy * Math.sin(pitch);
};

export const renderPlan3DViews = (plan: Plan3D) => {
  const angles = [
    { label: "Tampak depan", yaw: 0, pitch: 0 },
    { label: "Tampak kanan", yaw: Math.PI / 2, pitch: 0 },
    { label: "Tampak belakang", yaw: Math.PI, pitch: 0 },
    { label: "Tampak kiri", yaw: (3 * Math.PI) / 2, pitch: 0 },
    { label: "Tampak atas", yaw: 0, pitch: Math.PI / 2 },
  ];
  const width = 420;
  const height = 250;
  const ground: Face = {
    points: [
      { x: 0, y: -0.08, z: 0 },
      { x: plan.landLength, y: -0.08, z: 0 },
      { x: plan.landLength, y: -0.08, z: plan.landWidth },
      { x: 0, y: -0.08, z: plan.landWidth },
    ],
    color: "url(#groundSurface)",
  };
  const contactShadow = makeContactShadow(plan);

  return angles.map(({ label, yaw, pitch }) => {
    const projectedFaces = [
      ...buildFaces(plan, true),
      ground,
      ...(contactShadow ? [contactShadow] : []),
    ]
      .map((face) => ({
        points: face.points.map(
          (point) => projectPoint(point, yaw, pitch).point,
        ),
        depth: faceCenterDepth(face, yaw, pitch),
        color: face.color,
        opacity: face.opacity,
      }))
      .sort((first, second) => first.depth - second.depth);
    const points = projectedFaces.flatMap((face) => face.points);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const padding = 1.5;
    const viewWidth = Math.max(maxX - minX, 1) + padding * 2;
    const viewHeight = Math.max(maxY - minY, 1) + padding * 2;
    const scale = Math.min(width / viewWidth, height / viewHeight);
    const offsetX = (width - viewWidth * scale) / 2;
    const offsetY = (height - viewHeight * scale) / 2;
    const svgFaces = projectedFaces
      .map((face) => {
        const polygonPoints = face.points
          .map(
            (point) =>
              `${offsetX + (point.x - minX + padding) * scale},${offsetY + (point.y - minY + padding) * scale}`,
          )
          .join(" ");
        const opacity = face.opacity === undefined ? "" : ` fill-opacity="${face.opacity}"`;
        return `<polygon points="${polygonPoints}" fill="${face.color}"${opacity} stroke="#64748B" stroke-width="0.8" stroke-linejoin="round"/>`;
      })
      .join("");
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <linearGradient id="sceneBackground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F8FAFC"/><stop offset="1" stop-color="#E7ECEA"/></linearGradient>
          <linearGradient id="groundSurface" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#DDE5D8"/><stop offset="1" stop-color="#C8D3C4"/></linearGradient>
          <pattern id="roofTiles" width="32" height="18" patternUnits="userSpaceOnUse"><rect width="32" height="18" fill="#A64B34"/><path d="M0 1H32 M0 9H32 M0 17H32 M8 1V9 M24 9V17" fill="none" stroke="#D18368" stroke-width="1"/><path d="M0 2H32 M0 10H32" fill="none" stroke="#753321" stroke-width="0.7"/></pattern>
          <linearGradient id="doorWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#75421F"/><stop offset="0.45" stop-color="#A45E2B"/><stop offset="1" stop-color="#6B3B1D"/></linearGradient>
          <linearGradient id="windowGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9C9C6" stop-opacity="0.9"/><stop offset="0.55" stop-color="#667C78" stop-opacity="0.9"/><stop offset="1" stop-color="#354C49" stop-opacity="0.96"/></linearGradient>
          <linearGradient id="windowFrame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#292929"/><stop offset="0.5" stop-color="#111111"/><stop offset="1" stop-color="#050505"/></linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#sceneBackground)"/>
        ${svgFaces}
      </svg>
    `;
    return { label, svg };
  });
};

export type OpeningSelection = {
  roomId: string;
  wallIndex?: number;
  kind: Opening["kind"];
  index: number;
};

export type RoomWallSelection = {
  roomId: string;
  wallIndex?: number;
  roomName: string;
  edge: "top" | "right" | "bottom" | "left";
  length: number;
};

type OpeningTarget = {
  roomName: string;
  opening: Opening;
  selection: OpeningSelection;
  position: Point3D;
};

type Plan3DSceneProps = {
  plan: Plan3D;
  openingProgress?: Record<string, number>;
  markerMode?: "door" | "window" | "wall" | null;
  selectedOpeningId?: string | null;
  selectedWallId?: string | null;
  forceShowRoof?: boolean;
  onRoofToggle?: (visible: boolean) => void;
  onSelectOpening?: (selection: OpeningSelection) => void;
  onSelectWall?: (selection: RoomWallSelection) => void;
  isFirstPerson?: boolean;
  onToggleFirstPerson?: () => void;
  isFlyover?: boolean;
  onToggleFlyover?: () => void;
  onBackgroundPress?: () => void;
  /** ✅ Dari Kode 2: interaksi pintu/jendela dari first person */
  onInteractOpening?: (selection: OpeningSelection) => void;
};

const openingSelectionId = (selection: OpeningSelection) =>
  `${selection.wallIndex === undefined ? selection.roomId : `wall-${selection.wallIndex}`}:${selection.kind}:${selection.index}`;

export function Plan3DScene({
  plan,
  openingProgress = {},
  markerMode = null,
  selectedOpeningId = null,
  selectedWallId = null,
  forceShowRoof,
  onRoofToggle,
  onSelectOpening,
  onSelectWall,
  isFirstPerson = false,
  onToggleFirstPerson,
  isFlyover = false,
  onToggleFlyover,
  onBackgroundPress,
  onInteractOpening,
}: Plan3DSceneProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [yaw, setYaw] = useState(-Math.PI / 4);
  const [pitch, setPitch] = useState(1.08);
  const [zoom, setZoom] = useState(1.55);
  const [showRoof, setShowRoof] = useState(forceShowRoof ?? false);
  const [showDimensions, setShowDimensions] = useState(false);
  const yawRef = useRef(yaw);
  const pitchRef = useRef(pitch);
  const zoomRef = useRef(zoom);
  const [cameraX, setCameraX] = useState(0);
  const [cameraY, setCameraY] = useState(0);
  const [cameraZ, setCameraZ] = useState(0);
  const cameraXRef = useRef(0);
  const cameraYRef = useRef(0);
  const cameraZRef = useRef(0);

  const pinchStartDistanceRef = useRef(0);
  const pinchStartZoomRef = useRef(1.55);
  const firstPersonDeltaRef = useRef({ dx: 0, dy: 0 });

  const dragStart = useRef({
    x: 0,
    y: 0,
    yaw: 0,
    pitch: 0,
  });
  const lastUpdateRef = useRef(0);

  // ✅ Dari Kode 2: nearby opening
  const [nearbyOpening, setNearbyOpening] = useState<{
    selection: OpeningSelection;
    kind: "door" | "window";
    distance: number;
    name: string;
  } | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (forceShowRoof !== undefined) {
      setShowRoof(forceShowRoof);
      const nextPitch = forceShowRoof ? 0.72 : 1.08;
      pitchRef.current = nextPitch;
      setPitch(nextPitch);
    }
  }, [forceShowRoof]);

  // ✅ Reset kamera saat First Person berubah
  useEffect(() => {
    if (isFirstPerson) {
      const bounds = getFootprintBounds(plan);
      const centerX = bounds ? (bounds.minX + bounds.maxX) / 2 : 0;
      const centerZ = bounds ? (bounds.minZ + bounds.maxZ) / 2 : 0;
      cameraXRef.current = centerX;
      cameraYRef.current = EYE_HEIGHT;
      cameraZRef.current = centerZ;
      setCameraX(centerX);
      setCameraY(EYE_HEIGHT);
      setCameraZ(centerZ);
      pitchRef.current = 0;
      yawRef.current = 0;
      setPitch(0);
      setYaw(0);
      // ✅ Dari Kode 1: zoom 3.0 (lebih lebar pandangan)
      setZoom(3.0);
      zoomRef.current = 3.0;
      firstPersonDeltaRef.current = { dx: 0, dy: 0 };
      setNearbyOpening(null);
    } else {
      cameraXRef.current = 0;
      cameraYRef.current = 0;
      cameraZRef.current = 0;
      setCameraX(0);
      setCameraY(0);
      setCameraZ(0);
      pitchRef.current = 1.08;
      yawRef.current = -Math.PI / 4;
      setPitch(1.08);
      setYaw(-Math.PI / 4);
      setZoom(1.55);
      zoomRef.current = 1.55;
      firstPersonDeltaRef.current = { dx: 0, dy: 0 };
      setNearbyOpening(null);
    }
  }, [isFirstPerson, plan.rooms, plan.walls]);

  useEffect(() => {
    if (!isFlyover || isFirstPerson) return;
    const intervalId = setInterval(() => {
      const nextYaw = yawRef.current + 0.012;
      yawRef.current = nextYaw;
      setYaw(nextYaw);
    }, 50);
    return () => clearInterval(intervalId);
  }, [isFlyover, isFirstPerson]);

  const allOpeningTargets: OpeningTarget[] = useMemo(() => {
    return [
      ...plan.rooms.flatMap((room) =>
        (["door", "window"] as const).flatMap((kind) =>
          (kind === "door" ? room.doors : room.windows).map((opening, index) => {
            const position = Math.max(0, Math.min(1, opening.position));
            const y = opening.sillHeight + opening.height / 2;
            const pos: Point3D =
              opening.edge === "right"
                ? { x: room.x + room.length, y, z: room.z + position * room.width }
                : opening.edge === "bottom"
                  ? { x: room.x + position * room.length, y, z: room.z + room.width }
                  : opening.edge === "left"
                    ? { x: room.x, y, z: room.z + position * room.width }
                    : { x: room.x + position * room.length, y, z: room.z };
            return {
              roomName: room.name,
              opening,
              selection: { roomId: room.id, kind, index },
              position: pos,
            };
          }),
        ),
      ),
      ...plan.walls.flatMap((wall, wallIndex) =>
        (["door", "window"] as const).flatMap((kind) =>
          wall.openings
            .filter((opening) => opening.kind === kind)
            .map((opening, index) => {
              const y = opening.sillHeight + opening.height / 2;
              return {
                roomName: `Dinding ${wallIndex + 1}`,
                opening,
                selection: { roomId: `wall-${wallIndex}`, wallIndex, kind, index },
                position: {
                  x: wall.x1 + (wall.x2 - wall.x1) * opening.position,
                  y,
                  z: wall.z1 + (wall.z2 - wall.z1) * opening.position,
                },
              };
            }),
        ),
      ),
    ];
  }, [plan.rooms, plan.walls]);

  useEffect(() => {
    if (!isFirstPerson) {
      setNearbyOpening(null);
      return;
    }
    let closest: {
      selection: OpeningSelection;
      kind: "door" | "window";
      distance: number;
      name: string;
    } | null = null;
    let closestDistance = INTERACT_RADIUS;
    for (const target of allOpeningTargets) {
      const dx = target.position.x - cameraX;
      const dz = target.position.z - cameraZ;
      const distance = Math.hypot(dx, dz);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = {
          selection: target.selection,
          kind: target.opening.kind,
          distance,
          name:
            target.opening.kind === "door"
              ? `Pintu · ${target.roomName}`
              : `Jendela · ${target.roomName}`,
        };
      }
    }
    setNearbyOpening(closest);
  }, [isFirstPerson, cameraX, cameraZ, allOpeningTargets]);

  // ✅ PanResponder: gabungan Kode 1 (pinch fix, FP simpel) + Kode 2 (cameraY)
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (event, gestureState) =>
          event.nativeEvent.touches.length >= 2 ||
          Math.abs(gestureState.dx) > 4 ||
          Math.abs(gestureState.dy) > 4,
        onMoveShouldSetPanResponderCapture: () => false,

        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2) {
            pinchStartDistanceRef.current = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY,
            );
            pinchStartZoomRef.current = zoomRef.current;
          }
          dragStart.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
            yaw: yawRef.current,
            pitch: pitchRef.current,
          };
          firstPersonDeltaRef.current = { dx: 0, dy: 0 };
        },

        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches;

          // Pinch zoom
          if (touches.length >= 2) {
            const distance = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY,
            );
            if (pinchStartDistanceRef.current <= 0) {
              pinchStartDistanceRef.current = distance;
              pinchStartZoomRef.current = zoomRef.current;
              return;
            }
            const ratio = distance / pinchStartDistanceRef.current;
            const nextZoom = Math.max(
              ZOOM_MIN,
              Math.min(ZOOM_MAX, pinchStartZoomRef.current * ratio),
            );
            setZoom(nextZoom);
            zoomRef.current = nextZoom;
            return;
          }

          pinchStartDistanceRef.current = 0;

          const currentX = event.nativeEvent.pageX;
          const currentY = event.nativeEvent.pageY;
          const prev = firstPersonDeltaRef.current;
          const dx = currentX - prev.dx;
          const dy = currentY - prev.dy;
          firstPersonDeltaRef.current = { dx: currentX, dy: currentY };

          // First Person: geser = lihat + jalan
          if (isFirstPerson) {
            const yawSpeed = 0.006;
            const nextYaw = yawRef.current + dx * yawSpeed;
            yawRef.current = nextYaw;
            setYaw(nextYaw);

            const pitchSpeed = 0.004;
            const nextPitch = Math.max(
              -0.8,
              Math.min(0.8, pitchRef.current + dy * pitchSpeed),
            );
            pitchRef.current = nextPitch;
            setPitch(nextPitch);

            const forwardSpeed = 0.012;
            const forward = -dy * forwardSpeed;

            const dirX = Math.sin(nextYaw);
            const dirZ = Math.cos(nextYaw);

            let newCamX = cameraXRef.current + dirX * forward;
            let newCamZ = cameraZRef.current + dirZ * forward;

            const bounds = getFootprintBounds(plan);
            if (bounds) {
              // ✅ Dari Kode 1: margin 0.3
              const margin = 0.3;
              newCamX = Math.max(
                bounds.minX + margin,
                Math.min(bounds.maxX - margin, newCamX),
              );
              newCamZ = Math.max(
                bounds.minZ + margin,
                Math.min(bounds.maxZ - margin, newCamZ),
              );
            }

            cameraXRef.current = newCamX;
            cameraZRef.current = newCamZ;
            setCameraX(newCamX);
            setCameraZ(newCamZ);
            return;
          }

          // Mode normal
          const nextYaw = dragStart.current.yaw + (currentX - dragStart.current.x) * 0.008;
          const nextPitch = Math.max(
            0.2,
            Math.min(1.25, dragStart.current.pitch - (currentY - dragStart.current.y) * 0.004),
          );
          yawRef.current = nextYaw;
          pitchRef.current = nextPitch;
          setYaw(nextYaw);
          setPitch(nextPitch);
        },

        onPanResponderRelease: () => {
          pinchStartDistanceRef.current = 0;
          firstPersonDeltaRef.current = { dx: 0, dy: 0 };
        },

        onPanResponderTerminate: () => {
          pinchStartDistanceRef.current = 0;
          firstPersonDeltaRef.current = { dx: 0, dy: 0 };
        },
      }),
    [isFirstPerson, plan],
  );

  const faces = useMemo(
    () => buildFaces(plan, showRoof, openingProgress, isFirstPerson),
    [openingProgress, plan, showRoof, isFirstPerson],
  );

  const scene = useMemo(() => {
    const projected: ProjectedFace[] = faces.map((face) => ({
      points: face.points.map(
        (point) => projectPoint(point, yaw, pitch, cameraX, cameraY, cameraZ).point,
      ),
      depth: faceCenterDepth(face, yaw, pitch, cameraX, cameraY, cameraZ),
      color: face.color,
      opacity: face.opacity,
    }));

    if (!isFirstPerson) {
      const footprint = getFootprintBounds(plan);
      const baseMargin = 0.45;
      const landPoints: Point3D[] = [
        { x: (footprint?.minX ?? 0) - baseMargin, y: -0.08, z: (footprint?.minZ ?? 0) - baseMargin },
        { x: (footprint?.maxX ?? plan.landLength) + baseMargin, y: -0.08, z: (footprint?.minZ ?? 0) - baseMargin },
        { x: (footprint?.maxX ?? plan.landLength) + baseMargin, y: -0.08, z: (footprint?.maxZ ?? plan.landWidth) + baseMargin },
        { x: (footprint?.minX ?? 0) - baseMargin, y: -0.08, z: (footprint?.maxZ ?? plan.landWidth) + baseMargin },
      ];
      projected.push({
        points: landPoints.map((point) => projectPoint(point, yaw, pitch, cameraX, cameraY, cameraZ).point),
        depth:
          faceCenterDepth({ points: landPoints, color: "#E2E8F0" }, yaw, pitch, cameraX, cameraY, cameraZ) -
          0.01,
        color: "url(#groundSurface)",
      });
      const contactShadow = makeContactShadow(plan);
      if (contactShadow) {
        projected.push({
          points: contactShadow.points.map(
            (point) => projectPoint(point, yaw, pitch, cameraX, cameraY, cameraZ).point,
          ),
          depth: faceCenterDepth(contactShadow, yaw, pitch, cameraX, cameraY, cameraZ),
          color: contactShadow.color,
          opacity: contactShadow.opacity,
        });
      }
    }

    projected.sort((a, b) => a.depth - b.depth);

    if (showRoof) {
      const roofFaces = projected.filter(f => f.color === "url(#roofTiles)");
      const otherFaces = projected.filter(f => f.color !== "url(#roofTiles)");
      projected.length = 0;
      projected.push(...otherFaces, ...roofFaces);
    }

    const allPoints = projected.flatMap((face) => face.points);
    const minX = Math.min(...allPoints.map((point) => point.x));
    const maxX = Math.max(...allPoints.map((point) => point.x));
    const minY = Math.min(...allPoints.map((point) => point.y));
    const maxY = Math.max(...allPoints.map((point) => point.y));
    const padding = 1.5;
    const width = Math.max(maxX - minX, 1) + padding * 2;
    const height = Math.max(maxY - minY, 1) + padding * 2;
    return {
      faces: projected,
      minX: minX - padding,
      minY: minY - padding,
      width,
      height,
    };
  }, [faces, plan.landLength, plan.landWidth, plan.rooms, plan.walls, pitch, yaw, cameraX, cameraY, cameraZ, isFirstPerson, showRoof]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const projectToCanvas = (point: Point3D) => {
    const projected = projectPoint(point, yaw, pitch, cameraX, cameraY, cameraZ).point;
    const drawWidth = (size.width - 28) * zoom;
    const drawHeight = (size.height - 28) * zoom;
    return {
      x: ((projected.x - scene.minX) / scene.width) * drawWidth + (size.width - drawWidth) / 2,
      y: ((projected.y - scene.minY) / scene.height) * drawHeight + (size.height - drawHeight) / 2,
    };
  };

  const roomTargets = plan.rooms.map((room) => ({
    id: `room:${room.id}`,
    name: room.name,
    area: room.length * room.width,
    length: room.length,
    width: room.width,
    position: {
      x: room.x + room.length / 2,
      y: 0.06,
      z: room.z + room.width / 2,
    },
  }));

  const rotateBy = (amount: number) => {
    const nextYaw = yawRef.current + amount;
    yawRef.current = nextYaw;
    setYaw(nextYaw);
  };

  const resetView = () => {
    yawRef.current = -Math.PI / 4;
    pitchRef.current = 0.72;
    setYaw(-Math.PI / 4);
    setPitch(0.72);
    setZoom(1.55);
    zoomRef.current = 1.55;
  };

  const zoomBy = (delta: number) => {
    setZoom((current) => {
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current + delta));
      zoomRef.current = next;
      return next;
    });
  };

  const moveFirstPerson = (forwardDelta: number) => {
    const nextYaw = yawRef.current;
    const dirX = Math.sin(nextYaw);
    const dirZ = Math.cos(nextYaw);
    let newX = cameraXRef.current + dirX * forwardDelta;
    let newZ = cameraZRef.current + dirZ * forwardDelta;
    const bounds = getFootprintBounds(plan);
    if (bounds) {
      const margin = 0.3;
      newX = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, newX));
      newZ = Math.max(bounds.minZ + margin, Math.min(bounds.maxZ - margin, newZ));
    }
    cameraXRef.current = newX;
    cameraZRef.current = newZ;
    setCameraX(newX);
    setCameraZ(newZ);
  };

  const rotateFirstPerson = (deltaYaw: number) => {
    const nextYaw = yawRef.current + deltaYaw;
    yawRef.current = nextYaw;
    setYaw(nextYaw);
  };

  const pitchFirstPerson = (deltaPitch: number) => {
    const nextPitch = Math.max(-0.8, Math.min(0.8, pitchRef.current + deltaPitch));
    pitchRef.current = nextPitch;
    setPitch(nextPitch);
  };

  const handleInteract = () => {
    if (!nearbyOpening) return;
    onInteractOpening?.(nearbyOpening.selection);
  };

  return (
    <View style={styles.container}>
      {/* TOOLBAR */}
      <View style={styles.toolbarRow}>
        <TouchableOpacity
          style={styles.control}
          onPress={() => rotateBy(-Math.PI / 8)}
          accessibilityLabel="Putar ke kiri"
        >
          <Text style={styles.controlText}>↶</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.control}
          onPress={() => zoomBy(-0.15)}
          accessibilityLabel="Perkecil model"
        >
          <Text style={styles.controlText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.control} onPress={resetView}>
          <Text style={styles.resetText}>Atur ulang</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.control}
          onPress={() => zoomBy(0.15)}
          accessibilityLabel="Perbesar model"
        >
          <Text style={styles.controlText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.control}
          onPress={() => rotateBy(Math.PI / 8)}
          accessibilityLabel="Putar ke kanan"
        >
          <Text style={styles.controlText}>↷</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolbarRowCenter}>
        <TouchableOpacity
          style={[styles.control, showRoof && styles.activeControl]}
          onPress={() => {
            if (onRoofToggle) {
              onRoofToggle(!showRoof);
            } else {
              setShowRoof((visible) => {
                const nextVisible = !visible;
                const nextPitch = nextVisible ? 0.72 : 1.08;
                pitchRef.current = nextPitch;
                setPitch(nextPitch);
                return nextVisible;
              });
            }
          }}
        >
          <Text style={[styles.resetText, showRoof && styles.activeControlText]}>
            {showRoof ? "Atap: On" : "Atap: Off"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.control, showDimensions && styles.activeControl]}
          onPress={() => setShowDimensions((visible) => !visible)}
        >
          <Text style={[styles.resetText, showDimensions && styles.activeControlText]}>
            Ukuran: {showDimensions ? "On" : "Off"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.control, isFlyover && styles.activeControl]}
          onPress={onToggleFlyover}
        >
          <Text style={[styles.resetText, isFlyover && styles.activeControlText]}>
            🎥 {isFlyover ? "Flyover: On" : "Flyover"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.control, isFirstPerson && styles.activeControl]}
          onPress={onToggleFirstPerson}
        >
          <Text style={[styles.resetText, isFirstPerson && styles.activeControlText]}>
            👁️ {isFirstPerson ? "On" : "Off"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.canvas} onLayout={onLayout} {...responder.panHandlers}>
        {size.width > 0 && size.height > 0 && (
          <Svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`}>
            <Defs>
              <LinearGradient id="sceneBackground" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={isFirstPerson ? "#87CEEB" : "#F8FAFC"} />
                <Stop offset="1" stopColor={isFirstPerson ? "#B0E0E6" : "#E7ECEA"} />
              </LinearGradient>
              <LinearGradient id="groundSurface" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#DDE5D8" />
                <Stop offset="1" stopColor="#C8D3C4" />
              </LinearGradient>
              <Pattern id="roofTiles" width={32} height={18} patternUnits="userSpaceOnUse">
                <Rect width={32} height={18} fill="#A64B34" />
                <Path d="M0 1H32 M0 9H32 M0 17H32 M8 1V9 M24 9V17" fill="none" stroke="#D18368" strokeWidth={1} />
                <Path d="M0 2H32 M0 10H32" fill="none" stroke="#753321" strokeWidth={0.7} />
              </Pattern>
              <LinearGradient id="doorWood" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#75421F" />
                <Stop offset="0.45" stopColor="#A45E2B" />
                <Stop offset="1" stopColor="#6B3B1D" />
              </LinearGradient>
              <LinearGradient id="windowGlass" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#DDF6FF" stopOpacity="0.18" />
                <Stop offset="0.5" stopColor="#B9E5F5" stopOpacity="0.12" />
                <Stop offset="1" stopColor="#8CCDE5" stopOpacity="0.20" />
              </LinearGradient>
              <LinearGradient id="windowFrame" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#292929" />
                <Stop offset="0.5" stopColor="#111111" />
                <Stop offset="1" stopColor="#050505" />
              </LinearGradient>
            </Defs>

            <Rect width={size.width} height={size.height} fill="url(#sceneBackground)" />
            {scene.faces.map((face, index) => {
              const drawWidth = (size.width - 28) * zoom;
              const drawHeight = (size.height - 28) * zoom;
              const offsetX = (size.width - drawWidth) / 2;
              const offsetY = (size.height - drawHeight) / 2;
              const points = face.points.map((point) => ({
                x: ((point.x - scene.minX) / scene.width) * drawWidth + offsetX,
                y: ((point.y - scene.minY) / scene.height) * drawHeight + offsetY,
              }));
              const isRoof = face.color === "url(#roofTiles)";

              return (
                <Polygon
                  key={`face-${index}`}
                  points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill={face.color}
                  opacity={face.opacity}
                  stroke={isFirstPerson ? "none" : "#64748B"}
                  strokeWidth={0.8}
                  strokeLinejoin="round"
                  {...(isRoof ? { zIndex: 10 } : { zIndex: 1 })}
                />
              );
            })}

            {/* ✅ Crosshair First Person */}
            {isFirstPerson && (
              <>
                <Path
                  d={`M ${size.width / 2 - 10} ${size.height / 2} L ${size.width / 2 + 10} ${size.height / 2}`}
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth={2}
                />
                <Path
                  d={`M ${size.width / 2} ${size.height / 2 - 10} L ${size.width / 2} ${size.height / 2 + 10}`}
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth={2}
                />
                <Rect
                  x={size.width / 2 - 2}
                  y={size.height / 2 - 2}
                  width={4}
                  height={4}
                  fill="rgba(255,255,255,0.9)"
                />
              </>
            )}

            {!isFirstPerson && showDimensions && !showRoof &&
              roomTargets.map((room) => {
                const point = projectToCanvas(room.position);
                return (
                  <React.Fragment key={`room-dimension-${room.id}`}>
                    <SvgText x={point.x} y={point.y - 7} fill="#000000" fontSize={9} textAnchor="middle">
                      {room.name}
                    </SvgText>
                    <SvgText x={point.x} y={point.y + 9} fill="#000000" fontSize={8} textAnchor="middle">
                      {`${room.length.toFixed(2)} × ${room.width.toFixed(2)} m`}
                    </SvgText>
                  </React.Fragment>
                );
              })}
          </Svg>
        )}

        {/* ✅ D-pad First Person: lihat kiri/kanan (yaw) + atas/bawah (pitch) */}
        {isFirstPerson && size.width > 0 && size.height > 0 && (
          <View style={styles.fpDPad}>
            <TouchableOpacity
              style={styles.fpButton}
              onPress={() => pitchFirstPerson(0.15)}
              accessibilityLabel="Lihat ke atas"
            >
              <Text style={styles.fpButtonText}>▲</Text>
            </TouchableOpacity>
            <View style={styles.fpRow}>
              <TouchableOpacity
                style={styles.fpButton}
                onPress={() => rotateFirstPerson(-0.15)}
                accessibilityLabel="Lihat ke kiri"
              >
                <Text style={styles.fpButtonText}>◀</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.fpButton}
                onPress={() => rotateFirstPerson(0.15)}
                accessibilityLabel="Lihat ke kanan"
              >
                <Text style={styles.fpButtonText}>▶</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.fpButton}
              onPress={() => pitchFirstPerson(-0.15)}
              accessibilityLabel="Lihat ke bawah"
            >
              <Text style={styles.fpButtonText}>▼</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ✅ Tombol Jalan (First Person) — Dari Kode 2 */}
        {isFirstPerson && size.width > 0 && size.height > 0 && (
          <View style={styles.fpWalkPad}>
            <TouchableOpacity
              style={styles.fpWalkButton}
              onPress={() => moveFirstPerson(0.5)}
              accessibilityLabel="Jalan maju"
            >
              <Text style={styles.fpWalkButtonText}>Maju</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fpWalkButton}
              onPress={() => moveFirstPerson(-0.5)}
              accessibilityLabel="Jalan mundur"
            >
              <Text style={styles.fpWalkButtonText}>Mundur</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ✅ Tombol Interaksi pintu/jendela — Dari Kode 2 */}
        {isFirstPerson && nearbyOpening && (
          <TouchableOpacity
            style={styles.interactButton}
            onPress={handleInteract}
            activeOpacity={0.8}
          >
            <Text style={styles.interactIcon}>
              {nearbyOpening.kind === "door" ? "🚪" : "🪟"}
            </Text>
            <Text style={styles.interactLabel}>
              Buka/Tutup {nearbyOpening.kind === "door" ? "Pintu" : "Jendela"}
            </Text>
            <Text style={styles.interactDistance}>
              {nearbyOpening.distance.toFixed(1)} m
            </Text>
          </TouchableOpacity>
        )}

        <View pointerEvents="none" style={styles.hint}>
          <Text style={styles.hintText}>
            {isFirstPerson
              ? "Geser = lihat · ▲▼ = lihat atas/bawah · Maju/Mundur = jalan · Dekati pintu/jendela untuk interaksi"
              : isFlyover
                ? "Flyover aktif"
                : "Geser untuk memutar · Cubit 2 jari untuk zoom"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  toolbarRowCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  control: {
    minWidth: 34,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
  },
  controlText: { color: "#1E293B", fontSize: 20, fontWeight: "700" },
  resetText: { color: "#1E293B", fontSize: 11, fontWeight: "600" },
  activeControl: { backgroundColor: "#EA580C" },
  activeControlText: { color: "#FFFFFF" },
  openingHitTarget: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    backgroundColor: "#EA580C",
    elevation: 3,
  },
  openingHitTargetSelected: {
    borderColor: "#EA580C",
    transform: [{ scale: 1.12 }],
  },
  windowHitTarget: { backgroundColor: "#2563EB" },
  markerText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  windowMarkerText: { color: "#FFFFFF" },
  doorMarkerText: { color: "#FFFFFF" },
  wallHitTarget: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    backgroundColor: "#334155",
    elevation: 2,
  },
  wallHitTargetSelected: {
    borderColor: "#EA580C",
    transform: [{ scale: 1.12 }],
  },
  canvas: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
  },
  hint: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  hintText: { color: "#FFFFFF", fontSize: 11, textAlign: "center" },

  fpDPad: {
    position: "absolute",
    bottom: 90,
    right: 16,
    alignItems: "center",
    gap: 4,
    zIndex: 20,
  },
  fpRow: { flexDirection: "row", gap: 4 },
  fpButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  fpButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },

  fpWalkPad: {
    position: "absolute",
    bottom: 90,
    left: 16,
    gap: 6,
    zIndex: 20,
  },
  fpWalkButton: {
    minWidth: 80,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  fpWalkButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  interactButton: {
    position: "absolute",
    bottom: 160,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    backgroundColor: "rgba(234, 88, 12, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 30,
  },
  interactIcon: { fontSize: 22 },
  interactLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  interactDistance: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
});