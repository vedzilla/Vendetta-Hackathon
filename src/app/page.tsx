import { DashboardClient } from "@/components/DashboardClient";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string }>;
}) {
  const params = await searchParams;
  return <DashboardClient initialDevPanelVisible={params.dev === "1"} />;
}
