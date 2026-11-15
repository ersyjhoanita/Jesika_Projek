// src/app/_layout.tsx

import "react-native-gesture-handler";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { Stack, useRouter } from "expo-router";

import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font"; // <-- 1. Import useFonts
import {
  DeviceEventEmitter,
  useColorScheme,
  StyleSheet,
  View,
  ActivityIndicator,
  Animated,
  Image,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient"; 
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import { getToken } from "../services/storage";
import {
  ADMIN_LOGOUT_EVENT,
  getAdminToken,
} from "../services/admin-auth";
import SuperAdminLoginScreen from "../screens/SuperAdminLoginScreen";

SplashScreen.preventAutoHideAsync().catch(() => {});

// ============================================
// CUSTOM THEME
// ============================================
const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#0F172A",
    border: "#E2E8F0",
    primary: "#0F172A",
    notification: "#EA580C",
  },
};

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#0F172A",
    card: "#1E293B",
    text: "#F8FAFC",
    border: "#334155",
    primary: "#F59E0B",
    notification: "#EA580C",
  },
};

// ============================================
// ROOT LAYOUT
// ============================================
export default function RootLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();

  // 2. Tambahkan state untuk memuat font
  const [fontsLoaded, fontError] = useFonts({
   "StyleScript-Regular": require("@/assets/fonts/StyleScript-Regular.ttf"), // Sesuaikan path dengan lokasi file font Anda
  });

  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const [showSplash, setShowSplash] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    checkAuth();
    playSplashAnimation();
  }, []);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const [savedToken, savedAdminToken] = await Promise.all([
        getToken(),
        getAdminToken(),
      ]);
      setToken(savedToken);
      setAdminToken(savedAdminToken);
    } finally {
      setIsLoading(false);
    }
  };

  const playSplashAnimation = async () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 20,
        useNativeDriver: true,
      }),
    ]).start();

    // Tampilkan splash sebentar, lalu buka aplikasi setelah animasi selesai.
    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShowSplash(false);
      });
    }, 900);
  };

  // 3. Pantau kapan Splash Screen boleh hilang
  useEffect(() => {
    // Jika animasi splash sudah selesai DAN font sudah termuat (atau error)
    if (!showSplash && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [showSplash, fontsLoaded, fontError]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      ADMIN_LOGOUT_EVENT,
      () => setAdminToken(null),
    );
    return () => subscription.remove();
  }, []);

  // ============================================
  // RENDER: Splash Screen (Gradasi & Animasi)
  // ============================================
  // 4. Tambahkan kondisi fontsLoaded & fontError di sini
  if (showSplash || isLoading || (!fontsLoaded && !fontError)) {
    return (
      <LinearGradient
        colors={["#FFFFFF", "#F1F5F9", "#E2E8F0"]}
        style={styles.splashContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.Image
          source={require("../../assets/images/logo-griya-andari.png")}
          style={[
            styles.splashLogo,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          resizeMode="contain"
        />
      </LinearGradient>
    );
  }

  // ============================================
  // RENDER: Tampilan Jika Belum Login
  // ============================================
  if (!token && !adminToken) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? CustomDarkTheme : CustomLightTheme}
          >
            {showAdminLogin ? (
              <SuperAdminLoginScreen
                onBack={() => setShowAdminLogin(false)}
                onSuccessLogin={(newToken) => {
                  setAdminToken(newToken);
                  setShowAdminLogin(false);
                  router.replace("/super-admin-dashboard");
                }}
              />
            ) : showRegister ? (
              <RegisterScreen
                onBack={() => setShowRegister(false)}
                onRegistrationComplete={() => setShowRegister(false)}
              />
            ) : (
              <LoginScreen
                onGoToRegister={() => setShowRegister(true)}
                onGoToAdmin={() => setShowAdminLogin(true)}
                onSuccessLogin={(newToken) => setToken(newToken)}
              />
            )}
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // ============================================
  // RENDER: Tampilan Jika Sudah Login
  // ============================================
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? CustomDarkTheme : CustomLightTheme}
        >
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="form-proyek" />
            <Stack.Screen name="grid-denah" />
            <Stack.Screen name="viewer-3d" />
            <Stack.Screen name="rab" />
            <Stack.Screen name="super-admin-rute_login" />
            <Stack.Screen name="super-admin-dashboard" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  splashLogo: {
    width: 280,
    height: 180,
  },
});