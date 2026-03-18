import { MessageCircleHeart, Zap, BookTemplate, MessagesSquare } from "lucide-react";
import { ModeCard } from "./ModeCard";
import type { CreationMode } from "./CampaignWizard";

interface ModePickerProps {
  selectedMode?: CreationMode;
  onModeSelect: (mode: CreationMode) => void;
}

export function ModePicker({ selectedMode, onModeSelect }: ModePickerProps) {
  return (
    <div className="space-y-5">
      <div className="cw-soft-panel p-5 md:p-6">
        <p className="text-xl font-semibold text-slate-900">Choose your creation style</p>
        <p className="mt-2 text-base text-slate-600">
          Pick one flow. Each style uses a different page and interaction model.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ModeCard
          title="Guided Buddy"
          subtitle="Full guided pages with live helper feedback and checks."
          icon={MessageCircleHeart}
          selected={selectedMode === "guided_buddy"}
          onSelect={() => onModeSelect("guided_buddy")}
        />
        <ModeCard
          title="Quick Start"
          subtitle="Lean setup, starter questions, minimal editing controls."
          icon={Zap}
          selected={selectedMode === "quick_start"}
          onSelect={() => onModeSelect("quick_start")}
        />
        <ModeCard
          title="Template Story"
          subtitle="Pick a campaign template flow and customize each question."
          icon={BookTemplate}
          selected={selectedMode === "template_story"}
          onSelect={() => onModeSelect("template_story")}
        />
        <ModeCard
          title="Conversation Builder"
          subtitle="Build question-by-question as a guided conversation script."
          icon={MessagesSquare}
          selected={selectedMode === "conversation_builder"}
          onSelect={() => onModeSelect("conversation_builder")}
        />
      </div>
    </div>
  );
}
