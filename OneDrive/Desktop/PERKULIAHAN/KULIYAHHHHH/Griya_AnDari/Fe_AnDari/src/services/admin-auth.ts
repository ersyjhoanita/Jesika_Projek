import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

const ADMIN_TOKEN_KEY = "@andari_admin_token";
export const ADMIN_LOGOUT_EVENT = "andari:admin-logout";

export async function getAdminToken(): Promise<string | null> {
  return AsyncStorage.getItem(ADMIN_TOKEN_KEY);
}

export async function saveAdminToken(token: string): Promise<void> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error("Token admin tidak valid.");
  }
  await AsyncStorage.setItem(ADMIN_TOKEN_KEY, normalizedToken);
}

export async function loginAdmin(_credentials: {
  username: string;
  password: string;
}): Promise<string> {
  throw new Error(
    "Login admin belum tersedia: backend belum menyediakan endpoint autentikasi admin.",
  );
}

export async function logoutAdmin(): Promise<void> {
  await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
  DeviceEventEmitter.emit(ADMIN_LOGOUT_EVENT);
}
