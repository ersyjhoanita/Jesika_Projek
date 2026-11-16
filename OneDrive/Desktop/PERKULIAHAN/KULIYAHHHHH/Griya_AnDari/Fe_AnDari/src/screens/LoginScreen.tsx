// src/screens/LoginScreen.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { login } from "@/services/auth"; // <-- Import fungsi login dari service

type LoginScreenProps = {
  onGoToRegister: () => void;
  onGoToAdmin: () => void;
  onSuccessLogin: (token: string) => void;
};

export default function LoginScreen({
  onGoToRegister,
  onGoToAdmin,
  onSuccessLogin,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Data Kosong", "Silakan isi email dan password Anda terlebih dahulu.");
      return;
    }

    setIsLoading(true);

    try {
      // Memanggil fungsi login dari services/auth.ts (Mode Simulasi akan berjalan)
      const response = await login({
        email: email.trim(),
        password: password,
      });

      if (response && response.token) {
        onSuccessLogin(response.token);
      } else {
        throw new Error("Gagal mendapatkan token.");
      }

    } catch (error: any) {
      let errorMessage = "Terjadi kesalahan saat login.";
      if (error?.message) errorMessage = error.message;
      Alert.alert("Login Gagal", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      
      {/* HEADER BIRU GELAP */}
      <SafeAreaView edges={["top"]} style={styles.headerSection}>
        <View style={styles.headerContent}>
          <Image
            source={require("@/assets/images/logo-griya-andari_putih_login.png")} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>

      {/* FORM PUTIH MELENGKUNG */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.formSection}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.formTitle}>Login</Text>
          <Text style={styles.formSubtitle}>
            Gunakan email & password yang terdaftar
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="email@contoh.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
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
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
               <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Masuk</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Belum punya akun? </Text>
            <TouchableOpacity onPress={onGoToRegister}>
              <Text style={styles.registerLink}>Daftar Sekarang</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.adminLink} onPress={onGoToAdmin}>
            <Text style={styles.adminLinkText}>Masuk Super Admin</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A2B4C",
  },
  headerSection: {
    backgroundColor: "#1A2B4C", 
    paddingBottom: 10,
    paddingTop: 20,
  },
  headerContent: {
    alignItems: "center", 
    justifyContent: "center",
    marginBottom: 40,
    marginTop: 20,
  },
  logo: {
    width: 80,
    height: 80,
  },
  formSection: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A2B4C",
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A2B4C",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
  },
  eyeIcon: {
    padding: 4,
  },
  loginButton: {
    backgroundColor: "#D4AF37",
    borderRadius: 12,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  registerText: {
    fontSize: 13,
    color: "#64748B",
  },
  registerLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#D4A017",
  },
  adminLink: {
    alignItems: "center",
    paddingVertical: 10,
  },
  adminLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A2B4C",
  },
});