import { useRouter } from "expo-router";
import SuperAdminLoginScreen from "../screens/SuperAdminLoginScreen";

export default function SuperAdminLoginRoute() {
  const router = useRouter();

  return (
    <SuperAdminLoginScreen
      onBack={() => router.back()}
      onSuccessLogin={() => router.replace("/super-admin-dashboard")}
    />
  );
}
