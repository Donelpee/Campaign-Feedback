import type { Campaign, CampaignType, SurveySection, CampaignQuestion } from "./supabase-types";

export type CampaignTemplateVisibility = "organization" | "personal";

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string | null;
  campaign_type: CampaignType;
  visibility_scope: CampaignTemplateVisibility;
  created_by_user_id?: string | null;
  sections: SurveySection[];
  questions: CampaignQuestion[];
  source_campaign_id?: string | null;
  created_at: string;
  updated_at: string;
}

const LOCAL_CAMPAIGN_TEMPLATES_KEY = "client-pulse-local-campaign-templates";

export function readLocalCampaignTemplates(): CampaignTemplate[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_CAMPAIGN_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      visibility_scope:
        item?.visibility_scope === "personal" ? "personal" : "organization",
      created_by_user_id: item?.created_by_user_id || null,
    })) as CampaignTemplate[];
  } catch {
    return [];
  }
}

export function writeLocalCampaignTemplates(templates: CampaignTemplate[]) {
  window.localStorage.setItem(
    LOCAL_CAMPAIGN_TEMPLATES_KEY,
    JSON.stringify(templates),
  );
}

export function makeTemplateFromCampaign(
  campaign: Campaign,
  name: string,
  description?: string,
  visibilityScope: CampaignTemplateVisibility = "organization",
  createdByUserId?: string | null,
): CampaignTemplate {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description?.trim() || campaign.description || null,
    campaign_type: campaign.campaign_type,
    visibility_scope: visibilityScope,
    created_by_user_id: createdByUserId || null,
    sections: campaign.sections || [],
    questions: campaign.questions || [],
    source_campaign_id: campaign.id,
    created_at: now,
    updated_at: now,
  };
}
