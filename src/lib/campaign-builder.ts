import type { Campaign } from "@/lib/supabase-types";
import type { WizardData } from "@/components/admin/campaign-wizard/CampaignWizard";

export const LOCAL_CAMPAIGNS_KEY = "client-pulse-local-campaigns";
export const WIZARD_DRAFT_KEYS = [
  "campaign-wizard-draft-v2",
  "campaign-wizard-draft-v1",
] as const;
export const DEFAULT_CREATION_MODE_KEY = "campaign-default-creation-mode";

export function readLocalCampaigns(): Campaign[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_CAMPAIGNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Campaign[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalCampaigns(campaigns: Campaign[]) {
  window.localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(campaigns));
}

export function clearWizardDrafts() {
  WIZARD_DRAFT_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

export function hasSavedWizardDraft(): boolean {
  try {
    return WIZARD_DRAFT_KEYS.some((key) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { data?: WizardData };
      const draft = parsed?.data;
      if (!draft) return false;
      return Boolean(
        draft.selectedCompanyId ||
          draft.name?.trim() ||
          draft.description?.trim() ||
          draft.startDate ||
          draft.endDate ||
          draft.questions?.length,
      );
    });
  } catch {
    return false;
  }
}
