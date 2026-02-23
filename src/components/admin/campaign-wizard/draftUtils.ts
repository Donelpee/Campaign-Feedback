import type { WizardData } from "./CampaignWizard";

const DRAFTS_KEY = "campaign-wizard-drafts-v1";

export function loadDrafts(): Array<{
  id: string;
  updatedAt: string;
  data: WizardData;
}> {
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveDrafts(
  drafts: Array<{ id: string; updatedAt: string; data: WizardData }>,
) {
  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
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
