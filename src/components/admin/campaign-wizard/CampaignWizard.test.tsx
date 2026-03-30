import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignWizard } from "./CampaignWizard";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));

vi.mock("./GuidedBuddyPanel", () => ({
  GuidedBuddyPanel: ({
    title,
    subtitle,
    warningTitle,
    warningSubtitle,
    trackStatus,
  }: {
    title: string;
    subtitle: string;
    warningTitle?: string;
    warningSubtitle?: string;
    trackStatus?: "neutral" | "on_track" | "off_track";
  }) => (
    <div data-testid="buddy-panel">
      <div data-testid="buddy-track">{trackStatus}</div>
      {trackStatus === "off_track" ? (
        <>
          <p>{warningTitle}</p>
          {warningSubtitle ? <p>{warningSubtitle}</p> : null}
        </>
      ) : (
        <>
          <p>{title}</p>
          <p>{subtitle}</p>
        </>
      )}
    </div>
  ),
}));

vi.mock("./StepBasicInfo", () => ({
  StepBasicInfo: ({
    data,
    onChange,
  }: {
    data: {
      selectedCompanyId: string;
      name: string;
      description: string;
      startDate: string;
      endDate: string;
    };
    onChange: (data: Record<string, unknown>) => void;
  }) => (
    <div>
      <label htmlFor="company">Company</label>
      <input
        id="company"
        aria-label="Company"
        value={data.selectedCompanyId}
        onChange={(event) =>
          onChange({
            selectedCompanyId: event.target.value,
            selectedCompanyName: event.target.value ? "Acme Corp" : "",
          })
        }
      />
      <label htmlFor="name">Campaign Name</label>
      <input
        id="name"
        aria-label="Campaign Name"
        value={data.name}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <label htmlFor="description">Goal</label>
      <textarea
        id="description"
        aria-label="Goal"
        value={data.description}
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <label htmlFor="startDate">Start Date</label>
      <input
        id="startDate"
        aria-label="Start Date"
        value={data.startDate}
        onChange={(event) => onChange({ startDate: event.target.value })}
      />
      <label htmlFor="endDate">End Date</label>
      <input
        id="endDate"
        aria-label="End Date"
        value={data.endDate}
        onChange={(event) => onChange({ endDate: event.target.value })}
      />
    </div>
  ),
}));

vi.mock("./StepQuestions", () => ({
  StepQuestions: ({
    onChange,
  }: {
    onChange: (data: Record<string, unknown>) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onChange({
            questions: [
              {
                id: "q-invalid",
                type: "textarea",
                question: "short",
                required: true,
              },
            ],
          })
        }
      >
        Use Short Question
      </button>
      <button
        type="button"
        onClick={() =>
          onChange({
            questions: [
              {
                id: "q-valid",
                type: "textarea",
                question: "What should we improve next?",
                required: true,
              },
            ],
          })
        }
      >
        Use Valid Question
      </button>
    </div>
  ),
}));

vi.mock("./StepReview", () => ({
  StepReview: () => <div>Review step</div>,
}));

function renderWizard() {
  const onComplete = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();

  render(
    <CampaignWizard
      open
      onOpenChange={onOpenChange}
      onComplete={onComplete}
      initialDraft={null}
      defaultCreationMode="guided_buddy"
    />,
  );

  return { onComplete, onOpenChange };
}

function fillValidBasicInfo() {
  fireEvent.change(screen.getByLabelText("Company"), {
    target: { value: "company-1" },
  });
  fireEvent.change(screen.getByLabelText("Campaign Name"), {
    target: { value: "Customer Pulse" },
  });
  fireEvent.change(screen.getByLabelText("Goal"), {
    target: { value: "Learn what customers value most." },
  });
  fireEvent.change(screen.getByLabelText("Start Date"), {
    target: { value: "2026-03-24" },
  });
  fireEvent.change(screen.getByLabelText("End Date"), {
    target: { value: "2026-03-31" },
  });
}

describe("CampaignWizard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("blocks progression when required setup fields are empty", () => {
    renderWizard();

    expect(screen.queryByTestId("buddy-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /looks good, continue/i }));

    expect(
      screen.getAllByText(
        /please fill all required fields before clicking on the continue button\./i,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByTestId("buddy-panel").length).toBeGreaterThan(0);
    expect(screen.queryByText("Review step")).not.toBeInTheDocument();
  });

  it("blocks progression when a question is too short", () => {
    renderWizard();
    fillValidBasicInfo();

    fireEvent.click(screen.getByRole("button", { name: /looks good, continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /use short question/i }));
    fireEvent.click(screen.getByRole("button", { name: /review form/i }));

    expect(
      screen.getAllByText(/each question must be at least 8 characters long\./i).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Review step")).not.toBeInTheDocument();
  });

  it("advances to review when setup data and questions are valid", async () => {
    renderWizard();
    fillValidBasicInfo();

    fireEvent.click(screen.getByRole("button", { name: /looks good, continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /use valid question/i }));
    fireEvent.click(screen.getByRole("button", { name: /review form/i }));

    await waitFor(() => {
      expect(screen.getByText("Review step")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create campaign/i }),
      ).toBeInTheDocument();
    });
  });

  it("submits a valid campaign on the happy path", async () => {
    const { onComplete, onOpenChange } = renderWizard();
    fillValidBasicInfo();

    fireEvent.click(screen.getByRole("button", { name: /looks good, continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /use valid question/i }));
    fireEvent.click(screen.getByRole("button", { name: /review form/i }));
    fireEvent.click(screen.getByRole("button", { name: /create campaign/i }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          creationMode: "guided_buddy",
          selectedCompanyId: "company-1",
          selectedCompanyName: "Acme Corp",
          name: "Customer Pulse",
          description: "Learn what customers value most.",
          startDate: "2026-03-24",
          endDate: "2026-03-31",
          questions: [
            expect.objectContaining({
              id: "q-valid",
              question: "What should we improve next?",
            }),
          ],
        }),
      );
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("renders in page mode without relying on dialog context", () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <CampaignWizard
        mode="page"
        onOpenChange={onOpenChange}
        onComplete={onComplete}
        initialDraft={null}
        defaultCreationMode="guided_buddy"
      />,
    );

    expect(
      screen.getByRole("heading", { name: /create campaign \/ survey - basic info/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("buddy-panel")).not.toBeInTheDocument();
  });
});
