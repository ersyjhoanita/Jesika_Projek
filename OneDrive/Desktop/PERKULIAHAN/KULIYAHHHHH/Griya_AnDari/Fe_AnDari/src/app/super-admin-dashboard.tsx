// src/screens/SuperAdminDashboardScreen.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import axios from "axios";
import { API_TIMEOUT, API_URL } from "@/constants/config";
import { clearAdminToken, getAdminToken } from "@/services/admin-auth";
import { Ionicons } from "@expo/vector-icons";

type Region = {
  id: number;
  nama: string;
  provinsi?: string | null;
  kode?: string | null;
  is_active: boolean;
};
type Material = {
  id: number;
  nama_material: string;
  satuan: string;
  harga_satuan: string;
  region: number;
  region_nama?: string;
  is_active: boolean;
};
type Labor = {
  id: number;
  nama_peran: string;
  kategori: string;
  satuan: string;
  deskripsi?: string | null;
  is_active: boolean;
};
type LaborPrice = {
  id: number;
  labor: number;
  region: number;
  region_nama?: string;
  upah_per_satuan: string;
  source: string;
  is_active: boolean;
};
type Stats = {
  total_materials: number;
  total_labor_roles: number;
  total_labor_prices: number;
  total_regions: number;
  total_projects: number;
};
type Section = "materials" | "labor-prices" | "labors" | "regions";
type Item = Material | LaborPrice | Labor | Region;

const SECTIONS: { id: Section; label: string }[] = [
  { id: "materials", label: "Bahan" },
  { id: "labor-prices", label: "Harga upah" },
  { id: "labors", label: "Tenaga kerja" },
  { id: "regions", label: "Wilayah" },
];

const emptyStats: Stats = {
  total_materials: 0,
  total_labor_roles: 0,
  total_labor_prices: 0,
  total_regions: 0,
  total_projects: 0,
};

function getList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    typeof data === "object" &&
    data !== null &&
    "results" in data &&
    Array.isArray(data.results)
  ) {
    return data.results as T[];
  }
  throw new Error("Format data dari server tidak dikenali.");
}

export default function SuperAdminDashboardScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [regions, setRegions] = useState<Region[]>([]);
  const [labors, setLabors] = useState<Labor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [laborPrices, setLaborPrices] = useState<LaborPrice[]>([]);
  const [section, setSection] = useState<Section>("materials");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [province, setProvince] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [laborId, setLaborId] = useState<number | null>(null);

  const handleUnauthorized = useCallback(
    async (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await clearAdminToken();
        setToken(null);
        Alert.alert("Sesi berakhir", "Silakan masuk kembali sebagai super admin.");
        router.replace("/super-admin-rute_login");
        return true;
      }
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        await clearAdminToken();
        setToken(null);
        Alert.alert("Akses ditolak", "Akun ini bukan super admin.");
        router.replace("/(tabs)");
        return true;
      }
      return false;
    },
    [router],
  );

  const loadDashboard = useCallback(
    async (accessToken: string) => {
      const config = {
        headers: { Authorization: `Token ${accessToken}` },
        timeout: API_TIMEOUT,
      };
      try {
        const [
          statsResponse,
          regionResponse,
          laborResponse,
          materialResponse,
          priceResponse,
        ] = await Promise.all([
          axios.get<Stats>(`${API_URL}/admin/dashboard/`, config),
          axios.get(`${API_URL}/regions/`, config),
          axios.get(`${API_URL}/labors/`, config),
          axios.get(`${API_URL}/materials/`, config),
          axios.get(`${API_URL}/labor-prices/`, config),
        ]);
        setStats(statsResponse.data);
        setRegions(getList<Region>(regionResponse.data));
        setLabors(getList<Labor>(laborResponse.data));
        setMaterials(getList<Material>(materialResponse.data));
        setLaborPrices(getList<LaborPrice>(priceResponse.data));
      } catch (error: unknown) {
        if (await handleUnauthorized(error)) return;
        const message = axios.isAxiosError(error)
          ? error.response?.data?.detail ?? error.message
          : error instanceof Error
            ? error.message
            : "Tidak dapat memuat data dashboard.";
        Alert.alert("Dashboard gagal dimuat", String(message));
      } finally {
        setLoading(false);
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    let active = true;
    void getAdminToken().then((savedToken) => {
      if (!active) return;
      if (!savedToken) {
        router.replace("/super-admin-rute_login");
        return;
      }
      setToken(savedToken);
      void loadDashboard(savedToken);
    });
    return () => {
      active = false;
    };
  }, [loadDashboard, router]);

  const list: Item[] = useMemo(
    () => ({ materials, "labor-prices": laborPrices, labors, regions })[section],
    [laborPrices, labors, materials, regions, section],
  );

  const resetForm = () => {
    setEditing(null);
    setName("");
    setUnit("");
    setProvince("");
    setRegionCode("");
    setCategory("");
    setDescription("");
    setAmount("");
    setRegionId(regions.find((item) => item.is_active)?.id ?? null);
    setLaborId(labors.find((item) => item.is_active)?.id ?? null);
  };

  const openCreate = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEdit = (item: Item) => {
    setEditing(item);
    if (section === "materials") {
      const material = item as Material;
      setName(material.nama_material);
      setUnit(material.satuan);
      setAmount(String(material.harga_satuan));
      setRegionId(material.region);
    } else if (section === "labor-prices") {
      const price = item as LaborPrice;
      setAmount(String(price.upah_per_satuan));
      setRegionId(price.region);
      setLaborId(price.labor);
    } else if (section === "labors") {
      const labor = item as Labor;
      setName(labor.nama_peran);
      setCategory(labor.kategori);
      setUnit(labor.satuan);
      setDescription(labor.deskripsi ?? "");
    } else {
      const region = item as Region;
      setName(region.nama);
      setProvince(region.provinsi ?? "");
      setRegionCode(region.kode ?? "");
    }
    setModalVisible(true);
  };

  const saveItem = async () => {
    if (!token) return;
    const hasPrice = section === "materials" || section === "labor-prices";
    const priceValue = amount.trim() ? Number(amount.replace(",", ".")) : NaN;
    if (hasPrice && (!Number.isFinite(priceValue) || priceValue < 0)) {
      Alert.alert("Harga tidak valid", "Harga atau upah wajib diisi dan tidak boleh negatif.");
      return;
    }
    if (["materials", "labors", "regions"].includes(section) && !name.trim()) {
      Alert.alert("Data belum lengkap", "Nama wajib diisi.");
      return;
    }
    if (section === "materials" && (!unit.trim() || !regionId)) {
      Alert.alert("Data belum lengkap", "Satuan dan wilayah wajib dipilih.");
      return;
    }
    if (section === "labor-prices" && (!laborId || !regionId)) {
      Alert.alert("Data belum lengkap", "Jenis tenaga kerja dan wilayah wajib dipilih.");
      return;
    }
    if (section === "labors" && (!category.trim() || !unit.trim())) {
      Alert.alert("Data belum lengkap", "Kategori dan satuan tenaga kerja wajib diisi.");
      return;
    }

    const payload: Record<string, string | number | boolean | null> =
      section === "materials"
        ? {
            nama_material: name.trim(),
            satuan: unit.trim(),
            harga_satuan: priceValue,
            region: regionId,
            source: "manual",
            external_url: "",
            is_active: editing?.is_active ?? true,
          }
        : section === "labor-prices"
          ? {
              labor: laborId!,
              region: regionId!,
              upah_per_satuan: priceValue,
              source: "MANUAL",
              is_active: editing?.is_active ?? true,
            }
          : section === "labors"
            ? {
                nama_peran: name.trim(),
                kategori: category.trim(),
                satuan: unit.trim(),
                deskripsi: description.trim(),
                is_active: editing?.is_active ?? true,
              }
            : {
                nama: name.trim(),
                provinsi: province.trim(),
                kode: regionCode.trim() || null,
                is_active: editing?.is_active ?? true,
              };

    const existingPrice =
      section === "labor-prices" && !editing
        ? laborPrices.find(
            (item) => item.labor === laborId && item.region === regionId,
          )
        : undefined;
    setSaving(true);
    try {
      const config = {
        headers: { Authorization: `Token ${token}` },
        timeout: API_TIMEOUT,
      };
      const existingId = editing?.id ?? existingPrice?.id;
      if (existingId) {
        await axios.patch(
          `${API_URL}/${section}/${existingId}/`,
          payload,
          config,
        );
      } else {
        await axios.post(`${API_URL}/${section}/`, payload, config);
      }
      setModalVisible(false);
      await loadDashboard(token);
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) return;
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? JSON.stringify(error.response?.data) ?? error.message
        : error instanceof Error
          ? error.message
          : "Perubahan tidak dapat disimpan.";
      Alert.alert("Gagal menyimpan", String(message));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (item: Item) => {
    if (!token) return;
    Alert.alert(
      item.is_active ? "Nonaktifkan data?" : "Aktifkan data?",
      item.is_active
        ? "Data tetap tersimpan, tetapi tidak akan ditampilkan kepada customer."
        : "Data akan tersedia kembali untuk customer.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: item.is_active ? "Nonaktifkan" : "Aktifkan",
          style: item.is_active ? "destructive" : "default",
          onPress: () => {
            void (async () => {
              try {
                await axios.patch(
                  `${API_URL}/${section}/${item.id}/`,
                  { is_active: !item.is_active },
                  {
                    headers: { Authorization: `Token ${token}` },
                    timeout: API_TIMEOUT,
                  },
                );
                await loadDashboard(token);
              } catch (error: unknown) {
                if (await handleUnauthorized(error)) return;
                Alert.alert(
                  "Status tidak dapat diubah",
                  axios.isAxiosError(error)
                    ? error.response?.data?.detail ?? error.message
                    : "Data tidak dapat diperbarui.",
                );
              }
            })();
          },
        },
      ],
    );
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post(
          `${API_URL}/admin/logout/`,
          {},
          {
            headers: { Authorization: `Token ${token}` },
            timeout: API_TIMEOUT,
          },
        );
      }
    } catch (error: unknown) {
      if (!(axios.isAxiosError(error) && error.response?.status === 401)) {
        Alert.alert(
          "Logout server gagal",
          "Token perangkat tetap dihapus. Sesi server mungkin masih aktif.",
        );
      }
    } finally {
      await clearAdminToken();
      setToken(null);
      router.replace("/(tabs)");
    }
  };

  if (loading || !token) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color="#EA580C" />
        <Text style={styles.muted}>Memuat dashboard super admin...</Text>
      </SafeAreaView>
    );
  }

  const regionsForForm = regions.filter(
    (item) => item.is_active || item.id === regionId,
  );
  const laborsForForm = labors.filter(
    (item) => item.is_active || item.id === laborId,
  );

  return (
    <View style={styles.container}>
      
      {/* ============================================ */}
      {/* 1. HEADER BIRU GELAP MELENGKUNG              */}
      {/* ============================================ */}
      <SafeAreaView edges={["top"]} style={styles.blueHeader}>
        <View style={styles.headerContent}>
          
          {/* BARIS LOGO & TEKS GRIYA ANDARI */}
          <View style={styles.brandRow}>
            <Image
              source={require("@/assets/images/logo-griya-andari_putih_login.png")}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            
            {/* TEKS DITUMPUK LURUS KE BAWAH */}
            <View style={styles.textScriptWrapper}>
              <Text style={styles.textScriptGriya}>Griya</Text>
              <Text style={styles.textScriptAnDari}>AnDari</Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>PANEL PENGELOLA</Text>
          
          <View style={styles.titleRow}>
            <Text style={styles.title}>Dashboard Admin</Text>
            
            {/* TOMBOL LOGOUT DENGAN IKON PANAH KELUAR & TEKS */}
            <TouchableOpacity onPress={() => void logout()} style={styles.logout}>
              <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
              <Text style={styles.logoutText}>Keluar</Text>
            </TouchableOpacity>
            
          </View>
          <Text style={styles.headerDesc}>Kelola data aplikasi AnDari</Text>
        </View>
      </SafeAreaView>

      {/* ============================================ */}
      {/* 2. KONTEN UTAMA                              */}
      {/* ============================================ */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* STATISTIK */}
        <View style={styles.statsGrid}>
          <StatCard label="Bahan" value={stats.total_materials} />
          <StatCard label="Tenaga kerja" value={stats.total_labor_roles} />
          <StatCard label="Harga upah" value={stats.total_labor_prices} />
          <StatCard label="Wilayah aktif" value={stats.total_regions} />
          <StatCard label="Proyek" value={stats.total_projects} />
        </View>

        {/* SECTION KELOLA */}
        <View style={styles.manageHeader}>
          <View>
            <Text style={styles.sectionTitle}>Kelola data aplikasi</Text>
            <Text style={styles.muted}>Perubahan tersimpan ke database.</Text>
          </View>
          <TouchableOpacity onPress={openCreate} style={styles.addButton}>
            <Text style={styles.addButtonText}>＋ Tambah</Text>
          </TouchableOpacity>
        </View>

        {/* TAB MENU */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segment}
        >
          {SECTIONS.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setSection(item.id)}
              style={[
                styles.segmentButton,
                section === item.id && styles.segmentButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  section === item.id && styles.segmentTextSelected,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* LIST DATA */}
        {list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.rowTitle}>Belum ada data</Text>
            <Text style={styles.muted}>Gunakan tombol Tambah untuk membuat data.</Text>
          </View>
        ) : (
          list.map((item) => (
            <DataRow
              key={`${section}-${item.id}`}
              item={item}
              section={section}
              regions={regions}
              labors={labors}
              onEdit={() => openEdit(item)}
              onToggleActive={() => toggleActive(item)}
            />
          ))
        )}
      </ScrollView>

      {/* MODAL FORM */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.sectionTitle}>
                  {editing ? "Ubah data" : "Tambah data"}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.muted}>Tutup</Text>
                </TouchableOpacity>
              </View>

              {section === "materials" ? (
                <>
                  <Field label="Nama bahan">
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Contoh: Batu bata" />
                  </Field>
                  <Field label="Satuan">
                    <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="buah, zak, m3" />
                  </Field>
                </>
              ) : section === "labor-prices" ? (
                <Field label="Jenis tenaga kerja">
                  <View style={styles.chips}>
                    {laborsForForm.map((item) => (
                      <ChoiceChip
                        key={item.id}
                        title={`${item.nama_peran}${item.is_active ? "" : " · Nonaktif"}`}
                        selected={laborId === item.id}
                        onPress={() => setLaborId(item.id)}
                      />
                    ))}
                  </View>
                </Field>
              ) : section === "labors" ? (
                <>
                  <Field label="Nama tenaga kerja">
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Contoh: Tukang batu" />
                  </Field>
                  <Field label="Kategori">
                    <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Contoh: Sipil" />
                  </Field>
                  <Field label="Satuan">
                    <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="OH" />
                  </Field>
                  <Field label="Deskripsi (opsional)">
                    <TextInput style={styles.input} value={description} onChangeText={setDescription} />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Nama wilayah">
                    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Contoh: Bandung" />
                  </Field>
                  <Field label="Provinsi (opsional)">
                    <TextInput style={styles.input} value={province} onChangeText={setProvince} placeholder="Jawa Barat" />
                  </Field>
                  <Field label="Kode (opsional)">
                    <TextInput style={styles.input} value={regionCode} onChangeText={setRegionCode} placeholder="JBR" />
                  </Field>
                </>
              )}

              {(section === "materials" || section === "labor-prices") && (
                <>
                  <Field label={section === "materials" ? "Harga satuan (Rp)" : "Upah per satuan (Rp)"}>
                    <TextInput
                      style={styles.input}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Wilayah">
                    <View style={styles.chips}>
                      {regionsForForm.map((item) => (
                        <ChoiceChip
                          key={item.id}
                          title={`${item.nama}${item.is_active ? "" : " · Nonaktif"}`}
                          selected={regionId === item.id}
                          onPress={() => setRegionId(item.id)}
                        />
                      ))}
                    </View>
                  </Field>
                </>
              )}
              <TouchableOpacity
                disabled={saving}
                onPress={() => void saveItem()}
                style={[styles.saveButton, saving && styles.disabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Simpan ke database</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ============================================
// KOMPONEN PENDUKUNG
// ============================================
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function DataRow({
  item,
  section,
  regions,
  labors,
  onEdit,
  onToggleActive,
}: {
  item: Item;
  section: Section;
  regions: Region[];
  labors: Labor[];
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  let title = "";
  let details = "";
  let price: string | null = null;
  if (section === "materials") {
    const material = item as Material;
    title = material.nama_material;
    details = `${material.region_nama ?? regions.find((r) => r.id === material.region)?.nama ?? "Wilayah"} · ${material.satuan}`;
    price = material.harga_satuan;
  } else if (section === "labor-prices") {
    const laborPrice = item as LaborPrice;
    title = labors.find((labor) => labor.id === laborPrice.labor)?.nama_peran ?? "Tenaga kerja";
    details = `${laborPrice.region_nama ?? regions.find((r) => r.id === laborPrice.region)?.nama ?? "Wilayah"} · ${labors.find((labor) => labor.id === laborPrice.labor)?.satuan ?? ""}`;
    price = laborPrice.upah_per_satuan;
  } else if (section === "labors") {
    const labor = item as Labor;
    title = labor.nama_peran;
    details = `${labor.kategori} · ${labor.satuan}`;
  } else {
    const region = item as Region;
    title = region.nama;
    details = [region.provinsi, region.kode].filter(Boolean).join(" · ") || "Data wilayah";
  }

  return (
    <View style={styles.dataRow}>
      <View style={styles.dataMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.muted}>{details}</Text>
        {price !== null && (
          <Text style={styles.price}>Rp {Number(price).toLocaleString("id-ID")}</Text>
        )}
        <Text style={[styles.badge, item.is_active ? styles.active : styles.inactive]}>
          {item.is_active ? "Aktif" : "Nonaktif"}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity onPress={onEdit} style={styles.editButton}>
          <Text style={styles.editText}>Ubah</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onToggleActive}
          style={[styles.statusButton, item.is_active ? styles.disableButton : styles.enableButton]}
        >
          <Text style={[styles.statusText, item.is_active ? styles.disableText : styles.enableText]}>
            {item.is_active ? "Nonaktifkan" : "Aktifkan"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChoiceChip({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  loading: { flex: 1, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },

  // ==========================================
  // HEADER BIRU GELAP
  // ==========================================
  blueHeader: {
    backgroundColor: "#1A2B4C", 
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerContent: {
    marginTop: 10,
  },
  
  // STYLE BARU UNTUK LOGO & TEKS GRIYA ANDARI
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  brandLogo: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  textScriptWrapper: {
    flexDirection: "column",
    justifyContent: "center",
  },
  textScriptGriya: {
    fontSize: 24,
    color: "#FFFFFF",
    fontFamily: "StyleScript-Regular",
    lineHeight: 26,
    marginBottom: -10,
  },
  textScriptAnDari: {
    fontSize: 24,
    color: "#CBB67A",
    fontFamily: "StyleScript-Regular",
    lineHeight: 26,
  },
  // ==========================================

  eyebrow: {
    color: "#F5A623", 
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF", 
    fontSize: 26,
    fontWeight: "800",
  },
  headerDesc: {
    color: "#CBD5E1", 
    fontSize: 14,
  },
  
  // TOMBOL LOGOUT
  logout: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)", 
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    gap: 6,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // ==========================================
  // KONTEN BAWAH
  // ==========================================
  content: { padding: 18, paddingBottom: 40 },
  sectionTitle: { color: "#0F172A", fontSize: 17, fontWeight: "800" },
  muted: { color: "#64748B", fontSize: 12, marginTop: 4 },
  
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 25 },
  statCard: { minWidth: "30%", flexGrow: 1, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 13, borderWidth: 1, borderColor: "#E2E8F0" },
  statValue: { color: "#0F172A", fontSize: 22, fontWeight: "800" },
  
  manageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  addButton: { backgroundColor: "#EA580C", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10 },
  addButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  
  segment: { flexDirection: "row", backgroundColor: "#E2E8F0", padding: 4, borderRadius: 11, marginBottom: 12, gap: 4 },
  segmentButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: "center" },
  segmentButtonSelected: { backgroundColor: "#FFFFFF" },
  segmentText: { color: "#64748B", fontSize: 11, fontWeight: "700" },
  segmentTextSelected: { color: "#0F172A" },
  
  empty: { alignItems: "center", padding: 24, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" },
  
  dataRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 13, padding: 13, marginBottom: 9 },
  dataMain: { flex: 1 },
  rowTitle: { color: "#0F172A", fontSize: 14, fontWeight: "700" },
  price: { color: "#C2410C", fontSize: 13, fontWeight: "800", marginTop: 6 },
  badge: { alignSelf: "flex-start", overflow: "hidden", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: "700", marginTop: 6 },
  active: { color: "#15803D", backgroundColor: "#DCFCE7" },
  inactive: { color: "#64748B", backgroundColor: "#E2E8F0" },
  
  rowActions: { gap: 7, marginLeft: 8 },
  editButton: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#EFF6FF", borderRadius: 7 },
  editText: { color: "#1D4ED8", fontWeight: "700", fontSize: 11 },
  statusButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7 },
  disableButton: { backgroundColor: "#FEF2F2" },
  enableButton: { backgroundColor: "#F0FDF4" },
  statusText: { fontWeight: "700", fontSize: 11 },
  disableText: { color: "#B91C1C" },
  enableText: { color: "#15803D" },
  
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#0F172A99" },
  modalScroll: { flexGrow: 1, justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 35 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  field: { marginTop: 15 },
  fieldLabel: { color: "#334155", fontSize: 12, fontWeight: "700", marginBottom: 7 },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, color: "#0F172A" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 },
  chipSelected: { borderColor: "#EA580C", backgroundColor: "#FFF7ED" },
  chipText: { color: "#475569", fontSize: 11, fontWeight: "600" },
  chipTextSelected: { color: "#C2410C" },
  saveButton: { minHeight: 47, backgroundColor: "#0F172A", borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 23 },
  saveButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.6 },
});