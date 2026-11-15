import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { API_TIMEOUT, API_URL } from "@/constants/config";

type RabItem = {
  code: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
  total: number | null;
  status: "priced" | "missing_price";
  note?: string | null;
  source?: string;
};

type RabEstimate = {
  region: string;
  items: RabItem[];
  subtotal: number;
  grand_total: number | null;
  is_complete: boolean;
  missing_items: string[];
  notes: string[];
};

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseData: unknown = error.response?.data;
    if (
      typeof responseData === "object" &&
      responseData !== null &&
      "error" in responseData &&
      typeof responseData.error === "string"
    ) {
      return responseData.error;
    }
    if (error.response?.status === 404) {
      return "Daerah proyek atau layanan RAB belum tersedia di backend.";
    }
    return error.message || "Tidak dapat menghubungi backend RAB.";
  }
  return error instanceof Error ? error.message : "Terjadi kesalahan sistem.";
}

export default function RabScreen() {
  const router = useRouter();
  const { namaProyek, regionName, planData, wallHeight, roofType } =
    useLocalSearchParams<{
      namaProyek?: string;
      regionName?: string;
      planData?: string;
      wallHeight?: string;
      roofType?: string;
    }>();
  const [estimate, setEstimate] = useState<RabEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadEstimate = async () => {
      setLoading(true);
      setEstimate(null);
      setErrorMessage("");

      if (!planData || !regionName) {
        setErrorMessage(
          "Data denah atau daerah belum tersedia. Buka Estimasi Anggaran dari tampilan 3D proyek.",
        );
        setLoading(false);
        return;
      }

      try {
        const parsedPlan: unknown = JSON.parse(planData);
        if (
          typeof parsedPlan !== "object" ||
          parsedPlan === null ||
          Array.isArray(parsedPlan)
        ) {
          throw new Error("Format data denah tidak valid.");
        }

        const plan = {
          ...parsedPlan,
          ...(wallHeight ? { wallHeight: Number(wallHeight) } : {}),
          ...(roofType ? { roofType } : {}),
        };
        const response = await axios.post<RabEstimate>(
          `${API_URL}/rab/estimate/`,
          { region_name: regionName, plan },
          { timeout: API_TIMEOUT },
        );
        if (active) setEstimate(response.data);
      } catch (error: unknown) {
        if (active) setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadEstimate();
    return () => {
      active = false;
    };
  }, [planData, regionName, wallHeight, roofType]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={23} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Estimasi RAB</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {namaProyek || "Rancangan Rumah"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.loadingText}>Menghitung berdasarkan katalog daerah…</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={52} color="#DC2626" />
          <Text style={styles.errorTitle}>RAB belum dapat dihitung</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.backAction}
            onPress={() => router.back()}
          >
            <Text style={styles.backActionText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      ) : estimate ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.regionLabel}>Harga daerah</Text>
            <Text style={styles.regionName}>{estimate.region}</Text>
            <Text style={styles.totalLabel}>
              {estimate.is_complete
                ? "Total estimasi"
                : "Subtotal harga yang tersedia"}
            </Text>
            <Text style={styles.totalValue}>
              {formatRupiah(
                estimate.is_complete
                  ? estimate.grand_total ?? 0
                  : estimate.subtotal,
              )}
            </Text>
            {!estimate.is_complete && (
              <Text style={styles.incompleteNotice}>
                RAB belum lengkap karena sebagian harga belum tersedia.
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Rincian estimasi</Text>
            {estimate.items.map((item) => (
              <View key={item.code} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>
                    {item.quantity.toLocaleString("id-ID", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    {item.unit}
                    {item.unit_price !== null
                      ? ` · ${formatRupiah(item.unit_price)}/${item.unit}`
                      : ""}
                  </Text>
                  {item.note && (
                    <Text style={styles.itemNote}>{item.note}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.itemTotal,
                    item.total === null && styles.missingPrice,
                  ]}
                >
                  {item.total === null
                    ? "Harga belum ada"
                    : formatRupiah(item.total)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Catatan estimasi</Text>
            {estimate.notes.map((note) => (
              <Text key={note} style={styles.noteText}>
                • {note}
              </Text>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: { padding: 6, marginRight: 10 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  headerSubtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  loadingText: {
    color: "#64748B",
    fontSize: 14,
    marginTop: 14,
    textAlign: "center",
  },
  errorTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 14,
  },
  errorMessage: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  backAction: {
    backgroundColor: "#0F172A",
    borderRadius: 9,
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  backActionText: { color: "#FFFFFF", fontWeight: "700" },
  content: { padding: 16, gap: 14 },
  summaryCard: {
    backgroundColor: "#1A2B4C",
    borderRadius: 14,
    padding: 20,
  },
  regionLabel: { color: "#CBD5E1", fontSize: 12 },
  regionName: { color: "#FFFFFF", fontSize: 17, fontWeight: "700", marginTop: 3 },
  totalLabel: { color: "#CBD5E1", fontSize: 13, marginTop: 22 },
  totalValue: { color: "#FFFFFF", fontSize: 27, fontWeight: "900", marginTop: 4 },
  incompleteNotice: { color: "#FDE68A", fontSize: 12, marginTop: 10 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingTop: 15,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  itemRow: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  itemInfo: { flex: 1 },
  itemName: { color: "#0F172A", fontSize: 14, fontWeight: "700" },
  itemQuantity: { color: "#64748B", fontSize: 12, marginTop: 4 },
  itemNote: { color: "#64748B", fontSize: 11, lineHeight: 16, marginTop: 4 },
  itemTotal: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    maxWidth: 120,
  },
  missingPrice: { color: "#B45309" },
  noteCard: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  noteTitle: { color: "#9A3412", fontSize: 14, fontWeight: "800" },
  noteText: { color: "#7C2D12", fontSize: 12, lineHeight: 18 },
});
