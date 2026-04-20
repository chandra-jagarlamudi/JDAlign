import LoginClient from "@/components/LoginClient";

export default function LoginPage() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'false';
  return <LoginClient authEnabled={authEnabled} />;
}
