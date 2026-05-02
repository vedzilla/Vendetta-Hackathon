import { Dashboard } from "@/components/Dashboard";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string }>;
}) {
  const params = await searchParams;
  return <Dashboard initialDevPanelVisible={params.dev === "1"} />;
}
