import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface GuidedBuddyPanelProps {
  title: string;
  subtitle: string;
  step: number;
  totalSteps: number;
  mood?: "idle" | "point" | "celebrate";
  scene?: "setup" | "build" | "review";
  trackStatus?: "neutral" | "on_track" | "off_track";
  isWaiting?: boolean;
  isHappy?: boolean;
  happyTitle?: string;
  happySubtitle?: string;
  warningTitle?: string;
  warningSubtitle?: string;
}

const cowboyByEmotion = {
  wave: "/illustrations/mascot/Cowboy Character 1.png",
  laugh: "/illustrations/mascot/Cowboy Character 1.png",
  win: "/illustrations/mascot/Cowboy Character 1.png",
  confused: "/illustrations/mascot/Cartoon Character Confused 2.png",
  happy: "/illustrations/mascot/Happy%20Cowboy.png",
  waiting: "/illustrations/mascot/Idle%20Cowboy.png",
} as const;

export function GuidedBuddyPanel({
  title,
  subtitle,
  step,
  totalSteps,
  mood = "idle",
  scene = "setup",
  trackStatus = "neutral",
  isWaiting = false,
  isHappy = false,
  happyTitle = "We did It...All fields are filled correctly",
  happySubtitle = "",
  warningTitle = "Add more words to continue.",
  warningSubtitle = "Field 2 or 3 needs at least 10 characters.",
}: GuidedBuddyPanelProps) {
  const mascotSrc =
    isWaiting
      ? cowboyByEmotion.waiting
      : isHappy
      ? cowboyByEmotion.happy
      : trackStatus === "off_track"
      ? cowboyByEmotion.confused
      : scene === "setup"
        ? cowboyByEmotion.wave
      : scene === "build"
          ? cowboyByEmotion.laugh
          : cowboyByEmotion.win;

  const moodClass =
    isWaiting
      ? "cw-cowboy-waiting"
      : isHappy
        ? "cw-cowboy-happy"
        : trackStatus === "off_track"
          ? "cw-cowboy-confused"
          : scene === "build"
            ? "cw-cowboy-laugh"
            : scene === "review" || mood === "celebrate"
              ? "cw-cowboy-win"
              : "cw-cowboy-wave";

  const renderQuotedSpeech = (content: string, tone: "default" | "warning" = "default") => (
    <span
      className={
        tone === "warning"
          ? "font-bold text-rose-800"
          : "font-bold text-slate-900"
      }
    >
      "{content}"
    </span>
  );

  return (
    <Card className="cw-soft-panel h-full min-h-[440px] overflow-hidden xl:h-full xl:min-h-0">
      <CardContent className="flex h-full min-h-0 flex-col gap-2.5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="text-sm font-extrabold tracking-wide">
            Buddy helper
          </Badge>
          <span className="text-sm font-extrabold text-slate-700">
            Step {step} of {totalSteps}
          </span>
        </div>

        <div className="flex-1 min-h-0 p-1">
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
            <div className="flex min-h-[118px] items-start justify-center px-3 pb-1 pt-2">
              {isWaiting ? (
                <div className="relative w-full max-w-[230px] rounded-2xl border border-amber-300 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm">
                  <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-amber-300 bg-amber-50/95" />
                  <p className="leading-snug">{renderQuotedSpeech("I am waiting for you...")}</p>
                </div>
              ) : trackStatus !== "off_track" ? (
                <div className="relative w-full max-w-[300px] rounded-2xl border border-slate-300 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-slate-300 bg-white/95" />
                  <p className="leading-snug">{renderQuotedSpeech(isHappy ? happyTitle : title)}</p>
                  {(isHappy ? happySubtitle : subtitle) ? (
                    <p className="mt-1 leading-snug">
                      {renderQuotedSpeech(isHappy ? happySubtitle : subtitle)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="relative w-full max-w-[280px] rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs shadow-sm">
                  <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-rose-300 bg-rose-50" />
                  <p className="leading-snug">{renderQuotedSpeech(warningTitle, "warning")}</p>
                  {warningSubtitle ? (
                    <p className="mt-1 leading-snug">
                      <span className="font-bold text-rose-700">"{warningSubtitle}"</span>
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex min-h-0 items-end justify-center overflow-hidden pt-2">
              <img
                src={mascotSrc}
                alt="Assistant mascot"
                className={`cw-gentle-bob translate-y-8 h-[108%] w-auto max-w-full object-contain object-bottom sm:h-[114%] xl:translate-y-10 xl:h-[118%] ${moodClass}`}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
