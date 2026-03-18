import type { WizardData } from "./CampaignWizard";

const DRAFTS_KEY_V2 = "campaign-wizard-drafts-v2";
const DRAFTS_KEY_V1 = "campaign-wizard-drafts-v1";

function normalizeDraft(data: WizardData & { buildMode?: string }): WizardData {
  const legacyMode =
    data.buildMode === "manual"
      ? "guided_buddy"
      : data.buildMode === "ai"
        ? "conversation_builder"
        : data.buildMode === "upload"
          ? "template_story"
          : undefined;

  return {
    ...data,
    creationMode: data.creationMode || legacyMode,
  };
}

export function loadDrafts(): Array<{
  id: string;
  updatedAt: string;
  data: WizardData;
}> {
  try {
    const rawV2 = window.localStorage.getItem(DRAFTS_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((draft) => ({
        ...draft,
        data: normalizeDraft(draft.data || {}),
      }));
    }

    const rawV1 = window.localStorage.getItem(DRAFTS_KEY_V1);
    if (!rawV1) return [];
    const parsed = JSON.parse(rawV1);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((draft) => ({
      ...draft,
      data: normalizeDraft(draft.data || {}),
    }));
  } catch {
    return [];
  }
}

export function saveDrafts(
  drafts: Array<{ id: string; updatedAt: string; data: WizardData }>,
) {
  window.localStorage.setItem(DRAFTS_KEY_V2, JSON.stringify(drafts));
  window.localStorage.removeItem(DRAFTS_KEY_V1);
}

export function addDraft(data: WizardData) {
  const drafts = loadDrafts();
  const id = data.draftId || crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const filtered = drafts.filter((d) => d.id !== id);
  saveDrafts([{ id, updatedAt, data: { ...data, draftId: id } }, ...filtered]);
}

export function removeDraft(id: string) {
  const drafts = loadDrafts().filter((d) => d.id !== id);
  saveDrafts(drafts);
}
