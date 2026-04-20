import HomeClient from "@/components/HomeClient";

export default function Home() {
  // Read environment variables at runtime (server-side)
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'false';
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  return <HomeClient authEnabled={authEnabled} apiBaseUrl={apiBaseUrl} />;
}
