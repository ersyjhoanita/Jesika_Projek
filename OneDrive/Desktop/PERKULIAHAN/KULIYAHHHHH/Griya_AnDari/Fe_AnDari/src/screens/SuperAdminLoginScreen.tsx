import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { API_TIMEOUT, API_URL } from "@/constants/config";
import { saveAdminToken } from "@/services/admin-auth";

type Props = {
  onSuccessLogin: (token: string) => void;
  onBack: () => void;
};

type LoginResponse = { token: string };

export default function SuperAdminLoginScreen({
  onSuccessLogin,
  onBack,
}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!username.trim() || !password) {
      Alert.alert("Data belum lengkap", "Masukkan username dan password admin.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post<LoginResponse>(
        `${API_URL}/admin/login/`,
        { username: username.trim(), password },
        { timeout: API_TIMEOUT },
      );
      if (typeof response.data?.token !== "string" || !response.data.token.trim()) {
        throw new Error("Server tidak mengirim token admin yang valid.");
      }

      await saveAdminToken(response.data.token);
      onSuccessLogin(response.data.token);
    } catch (error: unknown) {
      const message = axios.isAxiosError<{ error?: string; message?: string }>(
        error,
      )
        ? error.response?.data?.error ??
          error.response?.data?.message ??
          "Tidak dapat masuk. Periksa koneksi backend dan akun super admin."
        : error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat login.";
      Alert.alert("Login Super Admin gagal", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Kembali ke login"
          style={styles.backButton}
          onPress={onBack}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Image
          source={require("@/assets/images/logo-griya-andari_putih_login.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Super Admin</Text>
        <Text style={styles.headerSubtitle}>Masuk untuk mengelola aplikasi</Text>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.formSection}
      >
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.formTitle}>Login Admin</Text>
          <Text style={styles.formSubtitle}>
            Masukkan akun Super Admin untuk melanjutkan.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#64748B"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Username admin"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
                editable={!loading}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#64748B"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Password admin"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={() => void login()}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Sembunyikan password" : "Tampilkan password"
                }
                onPress={() => setShowPassword((visible) => !visible)}
                style={styles.eyeButton}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={() => void login()}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Masuk</Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color="#FFFFFF"
                  style={styles.loginButtonIcon}
                />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A2B4C" },
  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 30,
    backgroundColor: "#1A2B4C",
  },
  backButton: {
    position: "absolute",
    left: 16,
    top: 16,
    zIndex: 1,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  logo: { width: 72, height: 72, marginTop: 24, marginBottom: 12 },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  headerSubtitle: { color: "#CBD5E1", fontSize: 13, marginTop: 6 },
  formSection: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  formContent: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 40 },
  formTitle: {
    color: "#1A2B4C",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 6,
  },
  formSubtitle: { color: "#64748B", fontSize: 13, marginBottom: 28 },
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    color: "#1A2B4C",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputWrapper: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
  },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, color: "#0F172A", fontSize: 14 },
  eyeButton: { padding: 4, marginLeft: 8 },
  loginButton: {
    height: 54,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5A93D",
    borderRadius: 12,
  },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  loginButtonIcon: { marginLeft: 8 },
});
