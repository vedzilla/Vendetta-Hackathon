"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityTicker } from "@/components/ActivityTicker";
import { CampaignDetail } from "@/components/CampaignDetail";
import { CampaignList } from "@/components/CampaignList";
import { DevPanel } from "@/components/DevPanel";
import { LessonsRail } from "@/components/LessonsRail";
import {
  type CampaignDetailResponse,
  type CampaignListResponse,
  type DashboardCampaign,
  type Lesson,
  fallbackCampaigns,
  fallbackLessons,
} from "@/components/types";

type MobileTab = "campaigns" | "detail" | "lessons";

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function normalizeCampaignList(data: CampaignListResponse | DashboardCampaign[] | null) {
  if (data === null) return null;
  if (Array.isArray(data)) return { campaigns: data, lessons: [] as Lesson[] };
  return {
    campaigns: data?.campaigns ?? data?.grievances ?? [],
    lessons: data?.lessons ?? [],
  };
}

function normalizeCampaignDetail(data: CampaignDetailResponse | DashboardCampaign | null) {
  if (!data) return undefined;
  if ("id" in data) return data;
  return data.campaign ?? data.grievance;
}

function lessonsFromCampaigns(campaigns: DashboardCampaign[]): Lesson[] {
  return campaigns.flatMap((campaign) =>
    campaign.timeline
      .filter((event) => event.kind === "lesson_learned")
      .map((event, index) => ({
        id: `${campaign.id}-${event.at}-${index}`,
        content: event.summary.replace(/^Lesson:\s*/i, ""),
        category: campaign.category,
        sourceCompany: campaign.facts.company ?? "Campaign",
        outcome: campaign.status === "LOST" ? "failure" : "success",
      }))
  );
}

export function Dashboard({ initialDevPanelVisible }: { initialDevPanelVisible: boolean }) {
  const [campaigns, setCampaigns] = useState<DashboardCampaign[]>(fallbackCampaigns);
  const [lessons, setLessons] = useState<Lesson[]>(fallbackLessons);
  const [selectedId, setSelectedId] = useState(fallbackCampaigns[0]?.id);
  const [pendingSelectedId, setPendingSelectedId] = useState<string>();
  const [mobileTab, setMobileTab] = useState<MobileTab>("detail");

  const selected = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedId) ?? (selectedId ? undefined : campaigns[0]),
    [campaigns, selectedId]
  );

  const refreshList = useCallback(async (preferredId?: string) => {
    const data = normalizeCampaignList(await getJson<CampaignListResponse | DashboardCampaign[]>("/api/grievances"));
    if (data === null) return;

    const focusId = preferredId ?? pendingSelectedId;
    const focusIdIsPresent = focusId
      ? data.campaigns.some((campaign) => campaign.id === focusId)
      : false;

    setCampaigns(data.campaigns);
    setSelectedId((current) => {
      if (focusId && focusIdIsPresent) return focusId;
      if (focusId && current === focusId) return current;
      if (data.campaigns.some((campaign) => campaign.id === current)) return current;
      return data.campaigns[0]?.id ?? current;
    });
    if (focusIdIsPresent) setPendingSelectedId(undefined);

    const derivedLessons = data.lessons.length > 0 ? data.lessons : lessonsFromCampaigns(data.campaigns);
    setLessons((current) => {
      if (derivedLessons.length > 0) return derivedLessons;
      return data.campaigns.length === 0 ? [] : current;
    });

    if (data.campaigns.length === 0) {
      setMobileTab("campaigns");
    }
  }, [pendingSelectedId]);

  const refreshSelected = useCallback(async () => {
    if (!selectedId) return;
    const campaign = normalizeCampaignDetail(
      await getJson<CampaignDetailResponse | DashboardCampaign>(`/api/grievances/${selectedId}`)
    );
    if (!campaign) return;
    setCampaigns((current) => current.map((item) => (item.id === campaign.id ? campaign : item)));
  }, [selectedId]);

  useEffect(() => {
    void refreshList();
    const interval = window.setInterval(() => void refreshList(), 3000);
    return () => window.clearInterval(interval);
  }, [refreshList]);

  useEffect(() => {
    void refreshSelected();
    const interval = window.setInterval(() => void refreshSelected(), 3000);
    return () => window.clearInterval(interval);
  }, [refreshSelected]);

  const demoInFlight = campaigns.some(
    (campaign) =>
      campaign.metadata?.demoMode &&
      !["WON", "LOST", "CANCELLED"].includes(campaign.status)
  );

  function selectCampaign(id: string) {
    setSelectedId(id);
    setMobileTab("detail");
  }

  function handleDemoRun(grievanceId?: string) {
    if (grievanceId) {
      setPendingSelectedId(grievanceId);
      setSelectedId(grievanceId);
      setMobileTab("detail");
    }
    void refreshList(grievanceId);
  }

  return (
    <div className="min-h-screen bg-[#0F0E0C] pb-[60px] text-[var(--text-primary)]">
      <div className="md:hidden">
        <div className="grid grid-cols-3 border-b border-[var(--border)] bg-[var(--surface)]">
          {(["campaigns", "detail", "lessons"] as const).map((tab) => (
            <button
              className={`mono border-r border-[var(--border)] px-2 py-3 text-[10px] uppercase ${
                mobileTab === tab ? "text-[#B8954E]" : "text-[var(--text-muted)]"
              }`}
              key={tab}
              onClick={() => setMobileTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
        <div className={mobileTab === "campaigns" ? "block" : "hidden"}>
          <CampaignList campaigns={campaigns} onSelect={selectCampaign} selectedId={selectedId} />
        </div>
        <div className={mobileTab === "detail" ? "block" : "hidden"}>
          <CampaignDetail campaign={selected} onRefresh={refreshSelected} />
        </div>
        <div className={mobileTab === "lessons" ? "block" : "hidden"}>
          <LessonsRail lessons={lessons} />
        </div>
      </div>

      <div className="hidden min-h-[calc(100vh-60px)] grid-cols-[320px_minmax(0,1fr)_320px] md:grid">
        <CampaignList campaigns={campaigns} onSelect={selectCampaign} selectedId={selectedId} />
        <CampaignDetail campaign={selected} onRefresh={refreshSelected} />
        <LessonsRail lessons={lessons} />
      </div>

      <ActivityTicker campaigns={campaigns} />
      <DevPanel
        demoInFlight={demoInFlight}
        initialVisible={initialDevPanelVisible}
        onRun={handleDemoRun}
      />
    </div>
  );
}
