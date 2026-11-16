// src/app/index.tsx

import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, Linking, Modal, Image, Animated, Alert, DeviceEventEmitter,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { logout } from "@/services/auth";
import { CUSTOMER_LOGOUT_EVENT } from "./_layout";

// ============================================
// DATA ALUR APLIKASI
// ============================================
const ALUR_APLIKASI = [
  { id: "01", title: "Luas Tanah", desc: "Atur lebar, panjang, bentuk lahan, dan lokasi.", icon: "home-outline", route: "/form-proyek", color: "#F59E0B" },
  { id: "02", title: "Denah 2D", desc: "Pilih proyek untuk menyusun tata letak ruangan di atas grid meter.", icon: "grid-outline", route: "/projek", color: "#3B82F6" },
  { id: "03", title: "Tampilan 3D", desc: "Pilih proyek untuk melihat visualisasi bentuk rumah dari berbagai sisi.", icon: "cube-outline", route: "/projek", color: "#8B5CF6" },
  { id: "04", title: "Estimasi Anggaran", desc: "Lihat perkiraan total biaya dan harga material untuk hasil desainmu.", icon: "calculator-outline", route: "/projek", color: "#10B981" },
];

const TEAM_MEMBERS = [
  { name: "Intan Fadlilah", role: "Frontend Developer", color: "#3B82F6", email: "mailto:intan@example.com", instagram: "https://instagram.com/intan", linkedin: "https://linkedin.com/in/intan", github: "https://github.com/intan" },
  { name: "Setiawan Rizki P.W.", role: "Backend Developer", color: "#F59E0B", email: "mailto:setiawan@example.com", instagram: "https://instagram.com/setiawan", linkedin: "https://linkedin.com/in/setiawan", github: "https://github.com/setiawan" },
  { name: "Yoanita Ersyputri", role: "Frontend Developer", color: "#10B981", email: "mailto:ersy8731@gmail.com", instagram: "https://instagram.com/yoanita", linkedin: "https://linkedin.com/in/yoanita", github: "https://github.com/yoanita" },
];

export default function HomeScreen() {
  const router = useRouter();
  const [isTeamModalVisible, setIsTeamModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerBackgroundColor = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: ["rgba(26, 43, 76, 0)", "rgba(255, 255, 255, 0.95)"],
    extrapolate: "clamp",
  });
  const textGriyaColor = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: ["#FFFFFF", "#1A2B4C"],
    extrapolate: "clamp",
  });
  const iconColor = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: ["#FFFFFF", "#1A2B4C"],
    extrapolate: "clamp",
  });

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else console.log("URL tidak didukung: " + url);
    } catch (error) {
      console.error("Gagal membuka URL:", error);
    }
  };

  const handleLogout = () => {
    Alert.alert("Keluar akun", "Apakah kamu yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await logout();
            DeviceEventEmitter.emit(CUSTOMER_LOGOUT_EVENT); 
          } catch (error) {
            console.error("Gagal logout:", error);
            Alert.alert("Logout gagal", "Sesi belum dapat dihapus. Silakan coba lagi.");
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  // ============================================
  // FUNGSI: Menangani Klik pada Kartu Alur
  // ============================================
  const handleCardPress = (item: typeof ALUR_APLIKASI[0]) => {
    // ✅ ALUR BARU (AKTIF): Semua menu langsung ke Form Proyek
    if (item.id === "02" || item.id === "03" || item.id === "04") {
      router.push("/form-proyek");
    } else {
      router.push(item.route as any);
    }

    // =====================================================================
    // ⚠️ ALUR LAMA (HAPUS TANDA // DI BAWAH UNTUK MENGAKTIFKAN KEMBALI)
    // Jika kamu ingin mengembalikan alur memilih proyek terlebih dahulu, 
    // hapus tanda // di setiap baris kode lama ini, dan hapus/blok kode "ALUR BARU" di atas.
    // =====================================================================
    // if (item.id === "02") {
    //   // Denah 2D: Arahkan ke projek dengan mode 2d
    //   router.push("/projek?mode=2d" as any);
    // } else if (item.id === "03") {
    //   // Pilih proyek terlebih dahulu, lalu buka viewer 3D dari proyek terpilih.
    //   router.push("/projek?mode=3d" as any);
    // } else if (item.id === "04") {
    //   // Pilih proyek terlebih dahulu, lalu hitung estimasi RAB proyek tersebut.
    //   router.push("/projek?mode=rab" as any);
    // } else {
    //   // Menu lain (1)
    //   router.push(item.route as any);
    // }
  };

  return (
    <View style={styles.container}>
      {/* ============ HEADER FLOATING ============ */}
      <Animated.View style={[styles.floatingHeader, { backgroundColor: headerBackgroundColor }]}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Image
                source={require("@/assets/images/logo-griya-andari_putih.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={styles.textScriptWrapper}>
                <Animated.Text style={[styles.textScriptGriya, { color: textGriyaColor }]}>
                  Griya{" "}
                </Animated.Text>
                <Text style={styles.textScriptAnDari}>AnDari</Text>
              </View>
            </View>

            {/* Tombol Logout */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleLogout}
              disabled={isLoggingOut}
              accessibilityRole="button"
              accessibilityLabel="Keluar dari akun"
            >
              <Animated.Text style={{ color: iconColor }}>
                <Ionicons name="log-out-outline" size={22} color="#D4AF37" />
              </Animated.Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* ============ SCROLL CONTENT ============ */}
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* HERO */}
        <View style={styles.heroSection}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>
              Desain Rumahmu dan{"\n"}Hitung Estimasi{" "}
              <Text style={styles.heroHighlight}>RAB</Text>-nya!
            </Text>
            <Text style={styles.heroDescription}>
              Rancang rumah impian mulai dari ukuran tanah, susun denah 2D,
              lihat visualisasi 3D, hingga estimasi biaya pembangunan.
            </Text>
          </View>
        </View>

        {/* ALUR APLIKASI */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Alur Aplikasi</Text>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>4 Langkah</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            Ketuk pada salah satu langkah di bawah untuk memulai.
          </Text>

          <View style={styles.cardsContainer}>
            {ALUR_APLIKASI.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => handleCardPress(item)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.cardDesc}>{item.desc}</Text>
                </View>
                <View style={styles.chevronContainer}>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FOOTER MINIMALIS */}
        <View style={styles.footerSection}>
          <Text style={styles.supportedTitle}>Didukung Oleh</Text>
          <View style={styles.logoRow}>
            <TouchableOpacity onPress={() => openLink("https://www.krsjawa3.com")} activeOpacity={0.7}>
              <Image source={require("@/assets/images/logo_BP3KP.png")} style={styles.partnerLogo} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openLink("https://www.utdi.ac.id")} activeOpacity={0.7}>
              <Image source={require("@/assets/images/UTDI_logo.png")} style={styles.partnerLogo} resizeMode="contain" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.teamButton}
            onPress={() => setIsTeamModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={16} color="#64748B" />
            <Text style={styles.teamButtonText}>Developer Team</Text>
          </TouchableOpacity>

          <Text style={styles.copyright}>
            © {new Date().getFullYear()} Griya AnDari · Dibuat dengan ❤️ untuk Indonesia
          </Text>
        </View>
      </Animated.ScrollView>

      {/* ============ BOTTOM NAV ============ */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => router.replace("/")}
          activeOpacity={0.8}
        >
          <Ionicons name="home" size={24} color="#EA580C" />
          <Text style={[styles.bottomNavText, { color: "#EA580C" }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => router.push("/projek")}
          activeOpacity={0.8}
        >
          <Ionicons name="folder-open-outline" size={24} color="#64748B" />
          <Text style={[styles.bottomNavText, { color: "#64748B" }]}>Proyek</Text>
        </TouchableOpacity>
      </View>

      {/* ============ MODAL TIM ============ */}
      <Modal
        visible={isTeamModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTeamModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsTeamModalVisible(false)}
        >
          <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrapper}>
                <Ionicons name="people" size={24} color="#EA580C" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Tim Pengembang</Text>
                <Text style={styles.modalSubtitle}>Mahasiswa Magang UTDI</Text>
              </View>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalMemberList}>
              {TEAM_MEMBERS.map((member, index) => (
                <View key={index} style={styles.memberCard}>
                  <View style={[styles.memberDot, { backgroundColor: member.color }]} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberRole}>{member.role}</Text>
                  </View>
                  <View style={styles.socialIconsRow}>
                    <TouchableOpacity onPress={() => openLink(member.email)} style={styles.socialIconBtn}>
                      <Ionicons name="mail" size={18} color="#64748B" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openLink(member.instagram)} style={styles.socialIconBtn}>
                      <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openLink(member.linkedin)} style={styles.socialIconBtn}>
                      <Ionicons name="logo-linkedin" size={18} color="#0077B5" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openLink(member.github)} style={styles.socialIconBtn}>
                      <Ionicons name="logo-github" size={18} color="#333" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsTeamModalVisible(false)}>
              <Text style={styles.modalCloseText}>Tutup</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { paddingBottom: 120 }, 

  // === Header floating ===
  floatingHeader: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 },
  headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerLogo: { width: 40, height: 40, marginRight: 8 },
  textScriptWrapper: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
  textScriptGriya: { fontSize: 20, fontFamily: "StyleScript-Regular", lineHeight: 34 },
  textScriptAnDari: { fontSize: 20, color: "#D4AF37", fontFamily: "StyleScript-Regular", lineHeight: 34 },
  iconButton: { padding: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12 },

  // === Hero ===
  heroSection: { backgroundColor: "#1A2B4C", borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingTop: 100, paddingBottom: 40, overflow: "hidden", position: "relative" },
  decorCircle1: { position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.05)" },
  decorCircle2: { position: "absolute", bottom: -80, left: -40, width: 250, height: 250, borderRadius: 125, backgroundColor: "rgba(245, 166, 35, 0.08)" },
  heroContent: { paddingHorizontal: 24, paddingTop: 8 },
  heroTitle: { color: "#FFFFFF", fontSize: 25, fontWeight: "800", lineHeight: 38, marginBottom: 12, letterSpacing: -0.5 },
  heroHighlight: { color: "#D4AF37" },
  heroDescription: { color: "#CBD5E1", fontSize: 14, lineHeight: 22, maxWidth: "95%" },

  // === Section ===
  sectionContainer: { paddingHorizontal: 24, paddingTop: 28 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sectionTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  stepBadge: { backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  stepBadgeText: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  sectionSubtitle: { fontSize: 13, color: "#64748B", marginBottom: 20 },

  // === Cards ===
  cardsContainer: { gap: 12 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", shadowColor: "#0F172A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: "#F1F5F9" },
  iconContainer: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 14 },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  cardDesc: { fontSize: 12, color: "#64748B", lineHeight: 18 },
  chevronContainer: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center", marginLeft: 8 },

  // === Admin access ===
  adminAccess: { marginTop: 16, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FED7AA", backgroundColor: "#FFF7ED" },
  adminAccessText: { color: "#C2410C", fontSize: 13, fontWeight: "700" },

  // === Footer minimalis ===
  footerSection: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 10, alignItems: "center" },
  supportedTitle: { fontSize: 13, fontWeight: "600", color: "#64748B", marginBottom: 16 },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32, marginBottom: 24 },
  partnerLogo: { width: 100, height: 60 },
  teamButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#F1F5F9", borderRadius: 20, marginBottom: 32 },
  teamButtonText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  copyright: { textAlign: "center", fontSize: 11, color: "#94A3B8", fontWeight: "500" },

  // === Bottom Nav ===
  bottomNavBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#FFFFFF", flexDirection: "row",
    justifyContent: "space-around", alignItems: "center",
    paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 28 : 16, 
    borderTopWidth: 1, borderTopColor: "#F1F5F9", 
    elevation: 8, shadowColor: "#000", 
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05, shadowRadius: 5,
  },
  bottomNavItem: { alignItems: "center", justifyContent: "center", flex: 1 },
  bottomNavText: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  
  // === Modal ===
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 23, 42, 0.5)" },
  modalContent: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  modalIconWrapper: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  modalSubtitle: { fontSize: 12, color: "#64748B", marginTop: 2 },
  modalDivider: { height: 1, backgroundColor: "#F1F5F9", marginBottom: 16 },
  modalMemberList: { gap: 16, marginBottom: 24 },
  memberCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#F1F5F9" },
  memberDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  memberRole: { fontSize: 11, color: "#64748B", marginTop: 2 },
  socialIconsRow: { flexDirection: "row", gap: 8 },
  socialIconBtn: { padding: 6, backgroundColor: "#FFFFFF", borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  modalCloseBtn: { minHeight: 48, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  modalCloseText: { fontSize: 14, fontWeight: "700", color: "#334155" },
});