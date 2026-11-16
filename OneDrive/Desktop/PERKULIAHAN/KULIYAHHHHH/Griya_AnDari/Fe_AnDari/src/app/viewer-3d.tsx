// Rute Expo Router sekaligus halaman utama viewer 3D.
import React, { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Plan3DScene,
  ROOF_OPTIONS,
  parsePlan3DData,
  type Plan3D,
  type OpeningSelection,
  type RoomWallSelection,
} from "@/components/Plan3DScene";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_TIMEOUT, API_URL } from "@/constants/config";
import { updateProject3DSettings } from "@/services/project-history";

type RoofType = Plan3D["roofType"];
type ElementTab = "door" | "window" | "wall" | "roof";
type DoorType = "swing" | "sliding" | "double_swing";

const getDoorType = (opening: { type?: string }): DoorType =>
  opening.type === "sliding" || opening.type === "double_swing"
    ? opening.type
    : "swing";

const getGridDoorType = (
  opening: { type?: string },
  originalDoor: unknown,
): "single" | "double" | "sliding" | "folding" => {
  const doorType = getDoorType(opening);
  if (doorType === "sliding") return "sliding";
  if (doorType === "double_swing") return "double";
  if (
    typeof originalDoor === "object" &&
    originalDoor !== null &&
    !Array.isArray(originalDoor) &&
    "type" in originalDoor &&
    originalDoor.type === "folding"
  ) {
    return "folding";
  }
  return "single";
};

const getOpeningId = (selection: OpeningSelection) =>
  `${selection.wallIndex === undefined ? selection.roomId : `wall-${selection.wallIndex}`}:${selection.kind}:${selection.index}`;

const getProjectParams = (data?: string) => {
  if (!data) return null;
  try {
    const payload: unknown = JSON.parse(data);
    if (typeof payload !== "object" || payload === null) return null;
    const project = payload as Record<string, unknown>;
    const rawBuildingId = String(project.buildingId ?? "");
    const backendOK =
      project.backendOK !== false && project.backendOK !== "false";
    return {
      backendOK,
      buildingId: /^\d+$/.test(rawBuildingId) ? rawBuildingId : undefined,
      floorId: /^\d+$/.test(String(project.floorId ?? ""))
        ? String(project.floorId)
        : undefined,
      projectId: String(project.projectId ?? ""),
      localProjectId: /^\d+$/.test(String(project.projectId ?? ""))
        ? String(project.projectId)
        : "local",
      localBuildingId: /^\d+$/.test(rawBuildingId) ? rawBuildingId : "local",
      namaProyek:
        typeof project.namaProyek === "string" ? project.namaProyek : "Proyek",
      regionName:
        typeof project.regionName === "string" ? project.regionName : "",
      landLength:
        typeof project.panjangLahan === "number"
          ? String(project.panjangLahan)
          : undefined,
      landWidth:
        typeof project.lebarLahan === "number"
          ? String(project.lebarLahan)
          : undefined,
    };
  } catch {
    return null;
  }
};

export default function Viewer3DScreen() {
  const { data } = useLocalSearchParams<{ data?: string }>();

  return <Viewer3DContent key={data ?? ""} data={data} />;
}

function Viewer3DContent({ data }: { data?: string }) {
  const router = useRouter();
  const initialPlan = typeof data === "string" ? parsePlan3DData(data) : null;
  const projectParams =
    typeof data === "string" ? getProjectParams(data) : null;
  const [editablePlan, setEditablePlan] = useState<Plan3D | null>(initialPlan);
  const [selectedOpening, setSelectedOpening] = useState<OpeningSelection | null>(null);
  const [selectedWall, setSelectedWall] = useState<RoomWallSelection | null>(null);
  const [activeElementTab, setActiveElementTab] = useState<ElementTab | null>(
    null,
  );
  const [openingWidthInput, setOpeningWidthInput] = useState("");
  const [openingHeightInput, setOpeningHeightInput] = useState("");
  const [windowSillHeightInput, setWindowSillHeightInput] = useState("");
  const [openingProgress, setOpeningProgress] = useState<Record<string, number>>({});
  const openingProgressRef = useRef<Record<string, number>>({});
  const openingAnimations = useRef(new Map<string, Animated.Value>());
  const openingAnimationListeners = useRef(new Map<string, string>());
  const [roofDropdownOpen, setRoofDropdownOpen] = useState(false);
  const [wallHeight, setWallHeight] = useState(initialPlan?.wallHeight ?? 3);
  const [wallHeightInput, setWallHeightInput] = useState(
    String(initialPlan?.wallHeight ?? 3),
  );
  const [wallStartHeightInput, setWallStartHeightInput] = useState("");
  const [wallEndHeightInput, setWallEndHeightInput] = useState("");
  const [roofType, setRoofType] = useState<RoofType>(
    initialPlan?.roofType ?? "pelana",
  );
  const [saving, setSaving] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const [isFlyover, setIsFlyover] = useState(false);
  const [viewModePopupVisible, setViewModePopupVisible] = useState(false);

  const plan = editablePlan
    ? { ...editablePlan, wallHeight, roofType }
    : null;

  useEffect(
    () => () => {
      openingAnimations.current.forEach((value, key) => {
        const listenerId = openingAnimationListeners.current.get(key);
        if (listenerId) value.removeListener(listenerId);
        value.stopAnimation();
      });
      openingAnimations.current.clear();
      openingAnimationListeners.current.clear();
    },
    [],
  );

  const selectedOpeningData = (() => {
    if (!plan || !selectedOpening) return null;
    if (selectedOpening.wallIndex !== undefined) {
      const wall = plan.walls[selectedOpening.wallIndex];
      const opening = wall?.openings.filter(
        (item) => item.kind === selectedOpening.kind,
      )[selectedOpening.index];
      return opening
        ? { roomName: `Dinding ${selectedOpening.wallIndex + 1}`, opening }
        : null;
    }
    const room = plan.rooms.find((item) => item.id === selectedOpening.roomId);
    if (!room) return null;
    const collection = selectedOpening.kind === "door" ? room.doors : room.windows;
    const opening = collection[selectedOpening.index];
    return opening ? { roomName: room.name, opening } : null;
  })();
  const selectedOpeningIsOpen = selectedOpening
    ? (openingProgress[getOpeningId(selectedOpening)] ?? 0) > 0.5
    : false;
  const selectedOpeningLimits = (() => {
    if (!plan || !selectedOpening || !selectedOpeningData) return null;
    const opening = selectedOpeningData.opening;
    let wallLength: number;
    let wallTop = plan.wallHeight;
    if (selectedOpening.wallIndex !== undefined) {
      const wall = plan.walls[selectedOpening.wallIndex];
      if (!wall) return null;
      wallLength = Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1);
      if (wall.topProfile?.length) {
        const heightAt = (position: number) => {
          const profile = wall.topProfile ?? [];
          if (position <= profile[0].position) return profile[0].height;
          for (let index = 1; index < profile.length; index += 1) {
            const previous = profile[index - 1];
            const next = profile[index];
            if (position <= next.position) {
              const ratio =
                (position - previous.position) /
                (next.position - previous.position);
              return previous.height + (next.height - previous.height) * ratio;
            }
          }
          return profile[profile.length - 1].height;
        };
        const halfWidthRatio =
          wallLength > 0 ? opening.width / (2 * wallLength) : 0;
        const start = Math.max(0, opening.position - halfWidthRatio);
        const end = Math.min(1, opening.position + halfWidthRatio);
        wallTop = Math.min(
          heightAt(start),
          heightAt(end),
          ...wall.topProfile
            .filter((point) => point.position > start && point.position < end)
            .map((point) => point.height),
        );
      }
    } else {
      const room = plan.rooms.find(
        (item) => item.id === selectedOpening.roomId,
      );
      if (!room) return null;
      wallLength =
        opening.edge === "left" || opening.edge === "right"
          ? room.width
          : room.length;
    }
    const center = opening.position * wallLength;
    const maxWidth = Math.min(
      3.5,
      center * 2,
      (wallLength - center) * 2,
    );
    return {
      maxWidth,
      maxHeight: Math.min(
        3.5,
        Math.max(0, wallTop - opening.sillHeight),
      ),
      maxSillHeight: Math.max(0, wallTop - opening.height),
    };
  })();

  const selectOpening = (selection: OpeningSelection) => {
    setSelectedWall(null);
    setActiveElementTab(selection.kind);
    setSelectedOpening(selection);
    if (selection.wallIndex !== undefined) {
      const opening = editablePlan?.walls[selection.wallIndex]?.openings.filter(
        (item) => item.kind === selection.kind,
      )[selection.index];
      if (opening) {
        setOpeningWidthInput(String(opening.width));
        setOpeningHeightInput(String(opening.height));
        setWindowSillHeightInput(
          selection.kind === "window"
            ? String(Number((opening.sillHeight * 100).toFixed(1)))
            : "",
        );
      }
      return;
    }
    const room = editablePlan?.rooms.find((item) => item.id === selection.roomId);
    if (!room) return;
    const collection = selection.kind === "door" ? room.doors : room.windows;
    const opening = collection[selection.index];
    if (opening) {
      setOpeningWidthInput(String(opening.width));
      setOpeningHeightInput(String(opening.height));
      setWindowSillHeightInput(
        selection.kind === "window"
          ? String(Number((opening.sillHeight * 100).toFixed(1)))
          : "",
      );
    }
  };

  const selectWall = (selection: RoomWallSelection) => {
    setSelectedOpening(null);
    setActiveElementTab("wall");
    setSelectedWall(selection);
    if (selection.wallIndex !== undefined) {
      const profile = editablePlan?.walls[selection.wallIndex]?.topProfile;
      setWallStartHeightInput(String(profile?.[0]?.height ?? wallHeight));
      setWallEndHeightInput(
        String(profile?.[profile.length - 1]?.height ?? wallHeight),
      );
    }
  };

  const updateSelectedWallHeight = (endpoint: "start" | "end", rawValue: string) => {
    if (selectedWall?.wallIndex === undefined) return;
    const height = Number(rawValue.trim().replace(",", "."));
    if (!Number.isFinite(height) || height < 1 || height > 10) {
      Alert.alert("Tinggi tidak valid", "Tinggi titik dinding harus antara 1 hingga 10 meter.");
      return;
    }
    const roundedHeight = Math.round(height * 100) / 100;
    const currentProfile =
      editablePlan?.walls[selectedWall.wallIndex]?.topProfile ?? [];
    const startHeight =
      endpoint === "start"
        ? roundedHeight
        : currentProfile[0]?.height ?? wallHeight;
    const endHeight =
      endpoint === "end"
        ? roundedHeight
        : currentProfile[currentProfile.length - 1]?.height ?? wallHeight;
    setEditablePlan((current) => {
      if (!current) return current;
      return {
        ...current,
        walls: current.walls.map((wall, index) =>
          index === selectedWall.wallIndex
            ? {
                ...wall,
                topProfile: [
                  { position: 0, height: startHeight },
                  { position: 1, height: endHeight },
                ],
              }
            : wall,
        ),
      };
    });
    if (endpoint === "start") setWallStartHeightInput(String(roundedHeight));
    else setWallEndHeightInput(String(roundedHeight));
  };

  const toggleSelectedOpening = () => {
    if (!selectedOpening) return;
    const id = getOpeningId(selectedOpening);
    let animation = openingAnimations.current.get(id);
    if (!animation) {
      animation = new Animated.Value(openingProgressRef.current[id] ?? 0);
      const listenerId = animation.addListener(({ value }) => {
        openingProgressRef.current = {
          ...openingProgressRef.current,
          [id]: value,
        };
        setOpeningProgress(openingProgressRef.current);
      });
      openingAnimations.current.set(id, animation);
      openingAnimationListeners.current.set(id, listenerId);
    }
    const activeAnimation = animation;
    if (!activeAnimation) return;
    activeAnimation.stopAnimation((currentValue) => {
      Animated.timing(activeAnimation, {
        toValue: currentValue >= 0.5 ? 0 : 1,
        duration: 360,
        useNativeDriver: false,
      }).start();
    });
  };

  const updateSelectedOpening = (
    dimension: "width" | "height" | "sillHeight",
    rawValue: string,
  ) => {
    if (!selectedOpening) return;
    const value = Number(rawValue.trim().replace(",", "."));
    const minValue = dimension === "sillHeight" ? 0 : 0.3;
    const maxValue =
      dimension === "width"
        ? (selectedOpeningLimits?.maxWidth ?? 3.5)
        : dimension === "height"
          ? (selectedOpeningLimits?.maxHeight ?? 3.5)
          : (selectedOpeningLimits?.maxSillHeight ?? wallHeight) * 100;
    if (
      !Number.isFinite(value) ||
      value < minValue ||
      value > maxValue ||
      (dimension === "sillHeight" && selectedOpening?.kind !== "window")
    ) {
      const currentValue = selectedOpeningData?.opening[dimension];
      if (dimension === "width") {
        setOpeningWidthInput(currentValue === undefined ? "" : String(currentValue));
      } else if (dimension === "height") {
        setOpeningHeightInput(currentValue === undefined ? "" : String(currentValue));
      } else {
        setWindowSillHeightInput(
          currentValue === undefined
            ? ""
            : String(Number((currentValue * 100).toFixed(1))),
        );
      }
      Alert.alert(
        "Ukuran tidak valid",
        dimension === "sillHeight"
          ? `Jarak bawah jendela harus antara 0 cm hingga ${Math.floor(maxValue)} cm agar tetap muat di dinding.`
          : dimension === "width"
            ? `Lebar bukaan harus antara 0,3 hingga ${maxValue.toFixed(2)} meter agar tetap berada di dinding.`
            : `Tinggi bukaan harus antara 0,3 hingga ${maxValue.toFixed(2)} meter agar tetap muat di dinding.`,
      );
      return;
    }
    const bounded =
      dimension === "sillHeight"
        ? Math.round((value / 100) * 1000) / 1000
        : Math.round(value * 100) / 100;
    if (dimension === "width") setOpeningWidthInput(String(bounded));
    else if (dimension === "height") setOpeningHeightInput(String(bounded));
    else
      setWindowSillHeightInput(
        String(Number((bounded * 100).toFixed(1))),
      );
    setEditablePlan((current) => {
      if (!current) return current;
      return {
        ...current,
        walls:
          selectedOpening.wallIndex === undefined
            ? current.walls
            : current.walls.map((wall, wallIndex) => {
                if (wallIndex !== selectedOpening.wallIndex) return wall;
                const targetOpening = wall.openings.filter(
                  (opening) => opening.kind === selectedOpening.kind,
                )[selectedOpening.index];
                return {
                  ...wall,
                  openings: wall.openings.map((opening) =>
                    opening === targetOpening
                      ? { ...opening, [dimension]: bounded }
                      : opening,
                  ),
                };
              }),
        rooms: current.rooms.map((room) => {
          if (selectedOpening.wallIndex !== undefined) return room;
          if (room.id !== selectedOpening.roomId) return room;
          if (selectedOpening.kind === "door") {
            return {
              ...room,
              doors: room.doors.map((opening, index) =>
                index === selectedOpening.index ? { ...opening, [dimension]: bounded } : opening,
              ),
            };
          }
          return {
            ...room,
            windows: room.windows.map((opening, index) =>
              index === selectedOpening.index ? { ...opening, [dimension]: bounded } : opening,
            ),
          };
        }),
      };
    });
  };

  const stepSelectedOpeningDimension = (
    dimension: "width" | "height" | "sillHeight",
    amount: number,
  ) => {
    const currentValue = selectedOpeningData?.opening[dimension];
    if (currentValue === undefined) return;
    updateSelectedOpening(
      dimension,
      String(
        dimension === "sillHeight"
          ? (currentValue + amount) * 100
          : currentValue + amount,
      ),
    );
  };

  const changeWallHeight = (nextHeight: number) => {
    const boundedHeight = Math.max(2, Math.min(6, nextHeight));
    const roundedHeight = Math.round(boundedHeight * 10) / 10;
    setWallHeight(roundedHeight);
    setWallHeightInput(String(roundedHeight));
  };

  const save3DSettings = async () => {
    if (!data || !initialPlan) return;
    setSaving(true);
    setActiveElementTab(null);
    setSelectedOpening(null);
    setSelectedWall(null);

    try {
      const rawPayload: unknown = JSON.parse(data);
      if (
        typeof rawPayload !== "object" ||
        rawPayload === null ||
        Array.isArray(rawPayload)
      ) {
        throw new Error("Data rancangan tidak dapat disimpan.");
      }
      const sourcePayload = rawPayload as Record<string, unknown>;

      const updatedRooms = Array.isArray(sourcePayload.rooms)
        ? sourcePayload.rooms.map((rawRoom, index) => {
            if (typeof rawRoom !== "object" || rawRoom === null || Array.isArray(rawRoom)) return rawRoom;
            const roomRecord = rawRoom as Record<string, unknown>;
            const originalDoors = Array.isArray(roomRecord.doors)
              ? roomRecord.doors
              : [];
            const editedRoom = editablePlan?.rooms[index];
            if (!editedRoom) return rawRoom;
            return {
              ...roomRecord,
              doors: editedRoom.doors.map(({ id: _id, ...door }, doorIndex) => ({
                ...door,
                type: getGridDoorType(door, originalDoors[doorIndex]),
              })),
              windows: editedRoom.windows.map(({ id: _id, ...window }) => window),
            };
          })
        : sourcePayload.rooms ?? [];

      const updatedWalls = Array.isArray(sourcePayload.walls)
        ? sourcePayload.walls.map((rawWall, index) => {
            if (
              typeof rawWall !== "object" ||
              rawWall === null ||
              Array.isArray(rawWall)
            ) {
              return rawWall;
            }
            const wallRecord = rawWall as Record<string, unknown>;
            const originalDoors = Array.isArray(wallRecord.doors)
              ? wallRecord.doors
              : [];
            const editedWall = editablePlan?.walls[index];
            if (!editedWall) return rawWall;
            return {
              ...wallRecord,
              doors: editedWall.openings
                .filter((opening) => opening.kind === "door")
                .map(({ id: _id, ...door }, doorIndex) => ({
                  ...door,
                  type: getGridDoorType(door, originalDoors[doorIndex]),
                })),
              windows: editedWall.openings
                .filter((opening) => opening.kind === "window")
                .map(({ id: _id, ...window }) => window),
              ...(editedWall.topProfile
                ? { topProfile: editedWall.topProfile }
                : {}),
            };
          })
        : sourcePayload.walls ?? [];

      const updatedPayload: Record<string, unknown> = {
        ...sourcePayload,
        rooms: updatedRooms,
        walls: updatedWalls,
        wallHeight,
        roofType,
      };

      const localKey = `andari-plan:${projectParams?.localProjectId ?? "local"}:${projectParams?.localBuildingId ?? "local"}`;
      await AsyncStorage.setItem(
        localKey,
        JSON.stringify({
          rooms: updatedPayload.rooms ?? [],
          walls: updatedPayload.walls ?? [],
          areas: updatedPayload.areas ?? [],
          wallHeight,
          roofType,
        }),
      );

      if (projectParams?.projectId) {
        await updateProject3DSettings(
          projectParams.projectId,
          { wallHeight, roofType },
          {
            rooms: Array.isArray(updatedPayload.rooms)
              ? updatedPayload.rooms
              : [],
            walls: Array.isArray(updatedPayload.walls)
              ? updatedPayload.walls
              : [],
            areas: Array.isArray(updatedPayload.areas)
              ? updatedPayload.areas
              : [],
          },
        );
      }

      let serverFloorId = projectParams?.backendOK
        ? projectParams.floorId
        : undefined;
      if (projectParams?.backendOK && projectParams.buildingId) {
        const floorsResponse = await axios.get(
          `${API_URL}/floors/?building=${projectParams.buildingId}`,
          { timeout: API_TIMEOUT },
        );
        const floorsData: unknown = floorsResponse.data;
        const floors = Array.isArray(floorsData)
          ? floorsData
          : typeof floorsData === "object" &&
              floorsData !== null &&
              "results" in floorsData &&
              Array.isArray(floorsData.results)
            ? floorsData.results
            : [];
        const matchingFloor = floors.find(
          (floor): floor is { id: number | string } =>
            typeof floor === "object" &&
            floor !== null &&
            "id" in floor &&
            (typeof floor.id === "number" || typeof floor.id === "string") &&
            String(floor.id) === String(serverFloorId ?? ""),
        );
        const firstFloor = floors.find(
          (floor): floor is { id: number | string } =>
            typeof floor === "object" &&
            floor !== null &&
            "id" in floor &&
            (typeof floor.id === "number" || typeof floor.id === "string"),
        );
        serverFloorId = (matchingFloor?.id ?? firstFloor?.id)?.toString();

        if (!serverFloorId) {
          const createdFloor = await axios.post(
            `${API_URL}/floors/`,
            {
              building: projectParams.buildingId,
              level: 1,
              tinggi_dinding: wallHeight,
            },
            { timeout: API_TIMEOUT },
          );
          if (
            typeof createdFloor.data !== "object" ||
            createdFloor.data === null ||
            !("id" in createdFloor.data) ||
            (typeof createdFloor.data.id !== "number" &&
              typeof createdFloor.data.id !== "string")
          ) {
            throw new Error("ID lantai baru dari server tidak valid.");
          }
          serverFloorId = String(createdFloor.data.id);
        }
      }

      if (serverFloorId) {
        const response = await axios.put(
          `${API_URL}/floors/${serverFloorId}/plan/`,
          {
            rooms: updatedPayload.rooms ?? [],
            walls: updatedPayload.walls ?? [],
            areas: updatedPayload.areas ?? [],
            wallHeight,
            roofType,
          },
          { timeout: API_TIMEOUT },
        );
        if (typeof response.data === "object" && response.data !== null) {
          const normalizedPayload = {
            ...updatedPayload,
            ...(response.data as Record<string, unknown>),
          };
          await AsyncStorage.setItem(
            localKey,
            JSON.stringify({
              rooms: normalizedPayload.rooms ?? [],
              walls: normalizedPayload.walls ?? [],
              areas: normalizedPayload.areas ?? [],
              wallHeight,
              roofType,
            }),
          );
        }
      } else {
        Alert.alert(
          "Tersimpan di perangkat",
          "Pengaturan 3D tersimpan secara lokal. Proyek ini belum memiliki ID bangunan di server, jadi belum bisa disinkronkan.",
        );
      }
    } catch (error: unknown) {
      console.error("Gagal menyimpan pengaturan 3D:", error);
      Alert.alert(
        "Pengaturan belum tersimpan",
        error instanceof Error
          ? error.message
          : "Tinggi dinding dan bentuk atap tidak dapat disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Tampilan 3D</Text>
      </View>
      {plan && (
        <ScrollView
          style={styles.designSettings}
          contentContainerStyle={{ flexGrow: 0, paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.controlsRow}>
            <ScrollView
              horizontal
              style={styles.elementTabs}
              contentContainerStyle={styles.elementTabsContent}
              showsHorizontalScrollIndicator={false}
            >
              {(["door", "window", "wall", "roof"] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeElementTab === tab }}
                  style={[
                    styles.elementTab,
                    activeElementTab === tab && styles.elementTabActive,
                  ]}
                  onPress={() => {
                    setActiveElementTab((current) =>
                      current === tab ? null : tab,
                    );
                    setSelectedOpening(null);
                    setSelectedWall(null);
                  }}
                >
                  <Text
                    style={[
                      styles.elementTabText,
                      activeElementTab === tab && styles.elementTabTextActive,
                    ]}
                  >
                    {tab === "door"
                      ? "Pintu"
                      : tab === "window"
                        ? "Jendela"
                        : tab === "wall"
                          ? "Dinding"
                          : "Atap"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {activeElementTab === "roof" && (
              <View style={styles.roofControl}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ expanded: roofDropdownOpen }}
                  style={styles.roofDropdownTrigger}
                  onPress={() => setRoofDropdownOpen((open) => !open)}
                >
                  <Text style={styles.roofDropdownText}>
                    {ROOF_OPTIONS.find((option) => option.type === roofType)
                      ?.shortLabel ?? "Pelana"}
                  </Text>
                  <Text style={styles.roofDropdownChevron}>
                    {roofDropdownOpen ? "⌃" : "⌄"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.saveControl, saving && styles.saveControlDisabled]}
              onPress={() => void save3DSettings()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveControlText}>Simpan</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {selectedOpeningData && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => {
            setSelectedOpening(null);
            setActiveElementTab(null);
          }}
        >
          <TouchableOpacity
            style={styles.bottomSheetOverlay}
            activeOpacity={1}
            onPress={() => {
              setSelectedOpening(null);
              setActiveElementTab(null);
            }}
          >
            <View style={styles.bottomSheetContent}>
              <View style={styles.bottomSheetHandle} />

              <Text style={styles.bottomSheetTitle}>
                {selectedOpeningData.opening.kind === "door" ? "Pintu" : "Jendela"} · {selectedOpeningData.roomName}
              </Text>

              {selectedOpeningData.opening.kind === "door" ||
              selectedOpeningData.opening.type !== "fixed" ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.openingToggleButton}
                  onPress={toggleSelectedOpening}
                >
                  <Text style={styles.openingToggleText}>
                    {selectedOpeningIsOpen ? "Tutup" : "Buka"}{" "}
                    {selectedOpeningData.opening.kind === "door" ? "pintu" : "jendela"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.fixedOpeningHint}>
                  Jendela fixed tidak dapat dibuka.
                </Text>
              )}

              <View style={styles.openingInputRow}>
                <View style={styles.openingInputGroup}>
                  <Text style={styles.openingInputLabel}>Lebar (m)</Text>
                  <View style={styles.openingDimensionControl}>
                    <TouchableOpacity
                      style={[styles.openingStepButton, selectedOpeningData.opening.width <= 0.3 && styles.openingStepButtonDisabled]}
                      onPress={() => stepSelectedOpeningDimension("width", -0.1)}
                      disabled={selectedOpeningData.opening.width <= 0.3}
                    >
                      <Text style={styles.openingStepButtonText}>−</Text>
                    </TouchableOpacity>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={openingWidthInput}
                      onChangeText={setOpeningWidthInput}
                      onEndEditing={(event) => updateSelectedOpening("width", event.nativeEvent.text)}
                      style={styles.openingInput}
                    />
                    <TouchableOpacity
                      style={[styles.openingStepButton, selectedOpeningData.opening.width >= (selectedOpeningLimits?.maxWidth ?? 3.5) && styles.openingStepButtonDisabled]}
                      onPress={() => stepSelectedOpeningDimension("width", 0.1)}
                      disabled={selectedOpeningData.opening.width >= (selectedOpeningLimits?.maxWidth ?? 3.5)}
                    >
                      <Text style={styles.openingStepButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.openingInputGroup}>
                  <Text style={styles.openingInputLabel}>Tinggi (m)</Text>
                  <View style={styles.openingDimensionControl}>
                    <TouchableOpacity
                      style={[styles.openingStepButton, selectedOpeningData.opening.height <= 0.3 && styles.openingStepButtonDisabled]}
                      onPress={() => stepSelectedOpeningDimension("height", -0.1)}
                      disabled={selectedOpeningData.opening.height <= 0.3}
                    >
                      <Text style={styles.openingStepButtonText}>−</Text>
                    </TouchableOpacity>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={openingHeightInput}
                      onChangeText={setOpeningHeightInput}
                      onEndEditing={(event) => updateSelectedOpening("height", event.nativeEvent.text)}
                      style={styles.openingInput}
                    />
                    <TouchableOpacity
                      style={[styles.openingStepButton, selectedOpeningData.opening.height >= (selectedOpeningLimits?.maxHeight ?? 3.5) && styles.openingStepButtonDisabled]}
                      onPress={() => stepSelectedOpeningDimension("height", 0.1)}
                      disabled={selectedOpeningData.opening.height >= (selectedOpeningLimits?.maxHeight ?? 3.5)}
                    >
                      <Text style={styles.openingStepButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.clearSelectionButton}
                  onPress={() => {
                    setSelectedOpening(null);
                    setActiveElementTab(null);
                  }}
                >
                  <Text style={styles.clearSelectionText}>×</Text>
                </TouchableOpacity>
              </View>

              {selectedOpeningData.opening.kind === "window" && (
                <View style={styles.sillHeightSection}>
                  <View style={styles.sillHeightHeader}>
                    <Text style={styles.openingInputLabel}>
                      Jarak bawah jendela dari lantai
                    </Text>
                    <Text style={styles.sillHeightUnit}>cm</Text>
                  </View>
                  <TextInput
                    keyboardType="decimal-pad"
                    value={windowSillHeightInput}
                    onChangeText={setWindowSillHeightInput}
                    onEndEditing={(event) => updateSelectedOpening("sillHeight", event.nativeEvent.text)}
                    style={styles.sillHeightInput}
                    placeholder="Contoh: 2"
                  />
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      <Modal
        visible={selectedWall !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSelectedWall(null);
          setActiveElementTab(null);
        }}
      >
        {selectedWall && (
          <View style={styles.elementModalOverlay}>
            <View style={styles.openingEditor}>
              <View style={styles.wallModalHeader}>
                <View>
                  <Text style={styles.openingEditorTitle}>
                    Informasi Dinding
                  </Text>
                  <Text style={styles.wallModalSubtitle}>
                    {selectedWall.roomName} · {selectedWall.length.toFixed(2)} m
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Tutup informasi dinding"
                  style={styles.clearSelectionButton}
                  onPress={() => {
                    setSelectedWall(null);
                    setActiveElementTab(null);
                  }}
                >
                  <Text style={styles.clearSelectionText}>×</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.openingInputLabel}>
                Tinggi semua dinding (m)
              </Text>
              <View style={styles.heightControl}>
                <TouchableOpacity
                  accessibilityLabel="Kurangi tinggi dinding"
                  style={styles.heightButton}
                  onPress={() => changeWallHeight(wallHeight - 0.1)}
                  disabled={wallHeight <= 2}
                >
                  <Text style={styles.heightButtonText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  accessibilityLabel="Tinggi dinding dalam meter"
                  keyboardType="decimal-pad"
                  value={wallHeightInput}
                  onChangeText={setWallHeightInput}
                  onEndEditing={() => {
                    const nextHeight = Number(wallHeightInput.replace(",", "."));
                    if (
                      Number.isFinite(nextHeight) &&
                      nextHeight >= 2 &&
                      nextHeight <= 6
                    ) {
                      changeWallHeight(nextHeight);
                    } else {
                      setWallHeightInput(String(wallHeight));
                      Alert.alert(
                        "Tinggi tidak valid",
                        "Tinggi dinding harus berada antara 2 hingga 6 meter.",
                      );
                    }
                  }}
                  style={styles.heightInput}
                />
                <Text style={styles.settingsUnit}>m (2–6 m)</Text>
                <TouchableOpacity
                  accessibilityLabel="Tambah tinggi dinding"
                  style={styles.heightButton}
                  onPress={() => changeWallHeight(wallHeight + 0.1)}
                  disabled={wallHeight >= 6}
                >
                  <Text style={styles.heightButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              {selectedWall.wallIndex !== undefined && (
                <>
                  <Text style={styles.openingInputLabel}>
                    Profil tinggi dinding terpilih (m)
                  </Text>
                  <View style={styles.heightControl}>
                    <View style={styles.profileHeightField}>
                      <Text style={styles.settingsUnit}>Ujung awal</Text>
                      <TextInput
                        accessibilityLabel="Tinggi ujung awal dinding"
                        keyboardType="decimal-pad"
                        value={wallStartHeightInput}
                        onChangeText={setWallStartHeightInput}
                        onEndEditing={() =>
                          updateSelectedWallHeight("start", wallStartHeightInput)
                        }
                        style={styles.heightInput}
                      />
                    </View>
                    <View style={styles.profileHeightField}>
                      <Text style={styles.settingsUnit}>Ujung akhir</Text>
                      <TextInput
                        accessibilityLabel="Tinggi ujung akhir dinding"
                        keyboardType="decimal-pad"
                        value={wallEndHeightInput}
                        onChangeText={setWallEndHeightInput}
                        onEndEditing={() =>
                          updateSelectedWallHeight("end", wallEndHeightInput)
                        }
                        style={styles.heightInput}
                      />
                    </View>
                  </View>
                </>
              )}
              <Text style={styles.wallModalNote}>
                Perubahan tinggi diterapkan ke semua dinding.
              </Text>
            </View>
          </View>
        )}
      </Modal>

      <Modal
        visible={roofDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRoofDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.roofDropdownMenuBackground}
          activeOpacity={1}
          onPress={() => setRoofDropdownOpen(false)}
        >
          <View style={styles.roofDropdownMenu}>
            <ScrollView
              style={{ maxHeight: 300 }}
              contentContainerStyle={{ flexGrow: 0 }}
              showsVerticalScrollIndicator={false}
            >
              {ROOF_OPTIONS.map(({ type, label }) => (
                <TouchableOpacity
                  key={type}
                  accessibilityRole="button"
                  accessibilityState={{ selected: roofType === type }}
                  style={[
                    styles.roofDropdownOption,
                    roofType === type && styles.roofChoiceSelected,
                  ]}
                  onPress={() => {
                    setRoofType(type);
                    setRoofDropdownOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.roofChoiceText,
                      roofType === type && styles.roofChoiceTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                  {roofType === type && (
                    <Text style={styles.roofDropdownCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {plan ? (
        // ✅ FIX: TIDAK ADA TouchableWithoutFeedback yang membungkus Plan3DScene.
        // Pinch zoom & drag sekarang sampai ke PanResponder di dalam Plan3DScene.
        <View style={styles.sceneCapture}>
          <Plan3DScene
            plan={plan}
            openingProgress={openingProgress}
            markerMode={activeElementTab === "roof" ? null : activeElementTab}
            forceShowRoof={
              isFirstPerson
                ? false
                : isFlyover || activeElementTab === "roof"
            }
            isFirstPerson={isFirstPerson}
            onToggleFirstPerson={() => {
              setIsFirstPerson((current) => !current);
              setIsFlyover(false);
            }}
            isFlyover={isFlyover}
            onToggleFlyover={() => setIsFlyover((current) => !current)}
            selectedOpeningId={
              selectedOpening
                ? `${selectedOpening.wallIndex === undefined ? selectedOpening.roomId : `wall-${selectedOpening.wallIndex}`}:${selectedOpening.kind}:${selectedOpening.index}`
                : null
            }
            selectedWallId={
              selectedWall
                ? `${selectedWall.roomId}:${selectedWall.edge}`
                : null
            }
            onSelectOpening={selectOpening}
            onSelectWall={selectWall}
            onBackgroundPress={() => {
              setSelectedOpening(null);
              setSelectedWall(null);
              setActiveElementTab(null);
            }}
            onInteractOpening={(selection) => {
              setSelectedOpening(selection);
              const id = getOpeningId(selection);
              let animation = openingAnimations.current.get(id);
              if (!animation) {
                animation = new Animated.Value(
                  openingProgressRef.current[id] ?? 0,
                );
                const listenerId = animation.addListener(({ value }) => {
                  openingProgressRef.current = {
                    ...openingProgressRef.current,
                    [id]: value,
                  };
                  setOpeningProgress({ ...openingProgressRef.current });
                });
                openingAnimations.current.set(id, animation);
                openingAnimationListeners.current.set(id, listenerId);
              }
              animation.stopAnimation((currentValue) => {
                Animated.timing(animation!, {
                  toValue: currentValue >= 0.5 ? 0 : 1,
                  duration: 360,
                  useNativeDriver: false,
                }).start();
              });
            }}
          />
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.heading}>Denah belum dapat ditampilkan</Text>
          <Text style={styles.description}>
            Data denah tidak ditemukan atau formatnya tidak valid. Kembali ke
            grid, lalu simpan atau buka tampilan 3D lagi.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.primaryActionButton}
            onPress={() => router.push("/grid-denah")}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryActionText}>Buka denah 2D</Text>
            <Text style={styles.primaryActionIcon}>›</Text>
          </TouchableOpacity>
        </View>
      )}
      {plan && (
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.primaryActionButton, { backgroundColor: "#334155", flex: 1 }]}
            onPress={() => setViewModePopupVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryActionText}>🎬 Mode Tampilan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.primaryActionButton, { flex: 1 }]}
            onPress={() =>
              router.push({
                pathname: "/rab",
                params: {
                  namaProyek: projectParams?.namaProyek ?? "Proyek",
                  regionName: projectParams?.regionName ?? "",
                  planData: data ?? "",
                  wallHeight: String(wallHeight),
                  roofType,
                },
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.primaryActionText}>Estimasi Anggaran</Text>
            <Text style={styles.primaryActionIcon}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={viewModePopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewModePopupVisible(false)}
      >
        <TouchableOpacity
          style={styles.elementModalOverlay}
          activeOpacity={1}
          onPress={() => setViewModePopupVisible(false)}
        >
          <View style={styles.viewModePopup}>
            <Text style={styles.viewModeTitle}>Pilih Mode Tampilan</Text>

            <TouchableOpacity
              style={styles.viewModeItem}
              onPress={() => {
                setViewModePopupVisible(false);
                setIsFirstPerson(false);
                setIsFlyover(true);
              }}
            >
              <Text style={styles.viewModeIcon}>🎥</Text>
              <Text style={styles.viewModeLabel}>Flyover</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewModeItem}
              onPress={() => {
                setViewModePopupVisible(false);
                setIsFlyover(false);
                setIsFirstPerson(true);
              }}
            >
              <Text style={styles.viewModeIcon}>👁️</Text>
              <Text style={styles.viewModeLabel}>First person</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  topBar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  topBarTitle: {
    marginLeft: 8,
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  designSettings: {
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    flexGrow: 0,
  },
  designSettingsContent: {},
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  elementTabs: {
    flex: 1,
    maxWidth: "100%",
  },
  elementTabsContent: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    gap: 4,
  },
  elementTab: {
    minHeight: 38,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
  },
  elementTabActive: {
    backgroundColor: "#EA580C",
    shadowColor: "#EA580C",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  elementTabText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  elementTabTextActive: {
    color: "#FFFFFF",
  },
  markerHint: {
    color: "#64748B",
    fontSize: 10,
    textAlign: "left",
    paddingBottom: 4,
    paddingLeft: 4,
  },
  roofControl: {
    width: 114,
    gap: 4,
  },
  saveControl: {
    minWidth: 76,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EA580C",
  },
  saveControlDisabled: { opacity: 0.6 },
  saveControlText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  roofControlLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
  },
  heightControl: { flexDirection: "row", alignItems: "center", gap: 8 },
  profileHeightField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  heightButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  heightButtonText: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "600",
  },
  heightInput: {
    width: 64,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 7,
    textAlign: "center",
    color: "#0F172A",
  },
  settingsUnit: {
    color: "#64748B",
    fontSize: 10,
    flex: 1,
  },
  roofDropdownTrigger: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  roofDropdownText: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "600",
  },
  roofDropdownChevron: {
    color: "#475569",
    fontSize: 16,
    fontWeight: "600",
  },
  roofDropdownMenuBackground: {
    flex: 1,
  },
  roofDropdownMenu: {
    position: "absolute",
    top: 120,
    right: 15,
    width: 200,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  roofSectionTitle: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  roofPreviewNote: {
    paddingHorizontal: 12,
    paddingBottom: 9,
    color: "#92400E",
    fontSize: 10,
    lineHeight: 14,
    backgroundColor: "#FFFBEB",
  },
  roofDropdownOption: {
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  roofDropdownCheck: { color: "#C2410C", fontWeight: "800" },

  elementModalOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  wallModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  wallModalSubtitle: {
    color: "#475569",
    fontSize: 13,
    marginTop: 3,
  },
  wallModalNote: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 10,
  },
  openingEditor: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FFFFFF",
    marginVertical: 4,
  },
  openingEditorTitle: {
    color: "#0F172A",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 5,
  },
  openingToggleButton: {
    minHeight: 40,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#EA580C",
  },
  openingToggleText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  fixedOpeningHint: {
    marginBottom: 10,
    color: "#64748B",
    fontSize: 11,
  },
  openingInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  sillHeightSection: {
    marginTop: 12,
    padding: 10,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFFBEB",
  },
  sillHeightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sillHeightUnit: { color: "#64748B", fontSize: 11, fontWeight: "600" },
  sillHeightInput: {
    minHeight: 42,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 15,
  },
  sillHeightHint: { color: "#64748B", fontSize: 10 },

  openingInputGroup: { flex: 1, gap: 4 },
  openingInputLabel: {
    color: "#475569",
    fontSize: 9,
    fontWeight: "500",
  },
  openingDimensionControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  openingStepButton: {
    width: 30,
    height: 38,
    borderRadius: 7,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  openingStepButtonDisabled: { opacity: 0.45 },
  openingStepButtonText: {
    color: "#C2410C",
    fontSize: 18,
    fontWeight: "600",
  },
  openingInput: {
    flex: 1,
    minWidth: 40,
    minHeight: 38,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    textAlign: "center"
  },
  clearSelectionButton: {
    width: 34,
    height: 38,
    borderRadius: 7,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center"
  },
  clearSelectionText: {
    color: "#C2410C",
    fontSize: 23,
    fontWeight: "500",
    lineHeight: 25
  },
  roofChoiceSelected: {
    backgroundColor: "#FFF7ED",
    borderColor: "#EA580C"
  },
  roofChoiceText: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "500",
  },
  roofChoiceTextSelected: { color: "#C2410C" },

  bottomSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  bottomSheetContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 8,
  },
  bottomSheetTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 10,
  },

  sceneCapture: { flex: 1, backgroundColor: "#F8FAFC" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  heading: {
    color: "#0F172A",
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 420,
  },
  actions: {
    margin: 16,
    marginTop: 10,
    gap: 8,
    flexDirection: "row",
  },
  primaryActionButton: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: "#EA580C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  primaryActionIcon: { color: "#FFFFFF", fontSize: 24, lineHeight: 26 },

  viewModePopup: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    width: "85%",
    alignSelf: "center",
  },
  viewModeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 16,
    textAlign: "center",
  },
  viewModeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  viewModeIcon: { fontSize: 22 },
  viewModeLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
});