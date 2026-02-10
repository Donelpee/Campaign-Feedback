

# Campaign Editing and Dynamic Question Types

## Problem Summary

1. **No edit functionality** -- Campaigns can only be created and deleted, never edited after creation.
2. **Hardcoded feedback form** -- The public feedback form (`FeedbackForm.tsx`) renders a fixed template (satisfaction slider, star rating, likert scale, improvement areas) instead of dynamically rendering the campaign's actual questions.
3. **Limited question types** -- The wizard only supports: rating, scale, multiple_choice, text, and NPS. Missing common field types like dropdown, checkboxes, and radio buttons.
4. **No "Other" option** -- Multiple choice questions don't support an "Other" write-in field.

## Plan

### 1. Add New Question Types

Expand the `CampaignQuestion` type in `src/lib/supabase-types.ts` to support:
- **dropdown** -- Single-select dropdown menu
- **checkbox** -- Multi-select checkboxes
- **radio** -- Single-select radio buttons

Add an `allow_other` boolean field to multiple_choice, checkbox, radio, and dropdown question types to enable a free-text "Other" option.

### 2. Update the Question Builder (StepQuestions)

Modify `src/components/admin/campaign-wizard/StepQuestions.tsx`:
- Add the new question types (dropdown, checkbox, radio) to the type selector.
- For multiple_choice, checkbox, radio, and dropdown types, replace the comma-separated text input for options with a proper list where you can add/remove individual options.
- Add an "Allow Other" toggle that appears for option-based question types. When enabled, the public form will show an extra "Other" option with a text input.

### 3. Add Campaign Edit Functionality

**CampaignsManager changes** (`src/components/admin/CampaignsManager.tsx`):
- Add an "Edit" button on each campaign row.
- When clicked, open the same `CampaignWizard` dialog but pre-populated with the existing campaign data.
- The wizard will accept an optional `editingCampaign` prop. When present, the submit button says "Save Changes" and performs an UPDATE instead of INSERT.

**CampaignWizard changes** (`src/components/admin/campaign-wizard/CampaignWizard.tsx`):
- Accept an optional `initialData` prop (the campaign to edit).
- Pre-populate all wizard state from `initialData` when provided.
- On submit, call `onComplete` as before -- the parent decides whether to insert or update.

### 4. Dynamic Feedback Form Rendering

This is the most significant change. The public feedback form currently ignores the campaign's questions entirely.

**Update the `get_feedback_link_data` database function** to also return the campaign's `questions` JSONB and `campaign_type` field so the public form has access to them.

**Rewrite `FeedbackForm.tsx`** to:
- Fetch questions from the link data.
- Dynamically render each question based on its `type`:
  - **text** -- Textarea input
  - **rating** -- Star rating (reuse existing `StarRating` component)
  - **scale** -- Slider (reuse existing `SatisfactionSlider`)
  - **nps** -- NPS scale 0-10 (reuse existing `LikertScale`)
  - **multiple_choice** -- Checkboxes for multi-select
  - **dropdown** -- Select dropdown
  - **checkbox** -- Checkboxes
  - **radio** -- Radio button group
- For any question with `allow_other: true`, render an "Other" option with a text input that appears when selected.
- Collect responses as an array of `{ question_id, answer }` objects.

**Update the `feedback_responses` table** via migration:
- Add a `responses` JSONB column to store the dynamic answers as `[{ question_id: string, answer: string | number | string[] }]`.
- The existing fixed columns (overall_satisfaction, etc.) remain for backward compatibility but new submissions will use the `responses` column.

### 5. Update StepReview

Update `src/components/admin/campaign-wizard/StepReview.tsx` to display the new question types (dropdown, checkbox, radio) and show the "Other" indicator.

---

## Technical Details

### Updated CampaignQuestion Type
```typescript
export interface CampaignQuestion {
  id: string;
  type: 'rating' | 'scale' | 'multiple_choice' | 'text' | 'nps' | 'dropdown' | 'checkbox' | 'radio';
  question: string;
  required: boolean;
  options?: string[];
  allow_other?: boolean;
  min?: number;
  max?: number;
}
```

### Database Migration
```sql
ALTER TABLE feedback_responses 
ADD COLUMN responses jsonb DEFAULT '[]'::jsonb;
```

### Updated RPC Function
The `get_feedback_link_data` function will be updated to include `camp.questions` and `camp.campaign_type` in the returned JSON.

### Files to Create
- None (all changes are to existing files)

### Files to Modify
- `src/lib/supabase-types.ts` -- Add new question types and `allow_other` field
- `src/components/admin/campaign-wizard/StepQuestions.tsx` -- New field types, proper options editor, "Allow Other" toggle
- `src/components/admin/campaign-wizard/StepReview.tsx` -- Display new question types
- `src/components/admin/campaign-wizard/CampaignWizard.tsx` -- Accept `initialData` for edit mode
- `src/components/admin/CampaignsManager.tsx` -- Add edit button and update handler
- `src/pages/FeedbackForm.tsx` -- Dynamic question rendering based on campaign config
- Database migration: add `responses` column to `feedback_responses`
- Database migration: update `get_feedback_link_data` function to return questions
