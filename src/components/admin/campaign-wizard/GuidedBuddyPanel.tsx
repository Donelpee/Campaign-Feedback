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

  return (
    <Card className="cw-soft-panel h-full min-h-[560px] overflow-hidden">
      <CardContent className="flex h-full min-h-0 flex-col gap-4 pt-5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="text-sm font-extrabold tracking-wide">
            Buddy helper
          </Badge>
          <span className="text-sm font-extrabold text-slate-700">
            Step {step} of {totalSteps}
          </span>
        </div>

        <div className="flex-1 min-h-0 p-1">
          <div className="relative flex h-full min-h-0 items-end justify-center">
            {isWaiting ? (
              <div className="absolute left-3 top-3 z-10 max-w-[240px] rounded-2xl border border-amber-300 bg-amber-50/95 px-3 py-2 text-sm text-amber-900 shadow-sm">
                <span className="absolute -bottom-2 left-8 h-4 w-4 rotate-45 border-b border-r border-amber-300 bg-amber-50/95" />
                <p className="font-semibold">I am waiting for you...</p>
              </div>
            ) : trackStatus !== "off_track" ? (
              <div className="absolute left-3 top-3 z-10 max-w-[250px] rounded-2xl border border-slate-300 bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-sm">
                <span className="absolute -bottom-2 left-8 h-4 w-4 rotate-45 border-b border-r border-slate-300 bg-white/95" />
                <p className="font-semibold text-slate-900">
                  {isHappy ? happyTitle : title}
                </p>
                {(isHappy ? happySubtitle : subtitle) ? (
                  <p className="mt-1">{isHappy ? happySubtitle : subtitle}</p>
                ) : null}
              </div>
            ) : (
              <div className="absolute left-3 top-3 z-10 max-w-[260px] rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 shadow-sm">
                <span className="absolute -bottom-2 left-8 h-4 w-4 rotate-45 border-b border-r border-rose-300 bg-rose-50" />
                <p className="text-base font-extrabold text-rose-800">{warningTitle}</p>
                {warningSubtitle ? (
                  <p className="mt-1 text-sm font-bold text-rose-700">
                    {warningSubtitle}
                  </p>
                ) : null}
              </div>
            )}
            <img
              src={mascotSrc}
              alt="Assistant mascot"
              className={`cw-gentle-bob h-[82%] w-auto max-w-full object-contain ${moodClass}`}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
