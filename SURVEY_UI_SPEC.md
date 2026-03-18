# Survey Creation UI Spec

## Goal
Create a professional, low-friction campaign creation experience that is easy for first-time users.

## Interaction Principles
- One primary action per screen (`Next` or `Create Campaign`).
- Progressive disclosure: advanced tools hidden unless requested.
- Inline validation near the exact field with clear fix text.
- Keep helper text to one short sentence.
- Autosave feedback remains visible but subtle.

## Visual Direction
- Calm, friendly palette:
  - setup: cool blue neutral
  - build: soft mint neutral
  - review: warm neutral
- Card-first layout with soft elevation and rounded corners.
- Motion is supportive, not distracting:
  - gentle panel entrance
  - subtle button pulse
  - low-contrast drifting background

## Component Rules
- Headers:
  - short title
  - one-line subtitle
  - no checklist clutter
- Inputs:
  - labels above fields
  - placeholders are examples, not instructions
  - required field errors shown only when user tries to continue
- Question builder:
  - easy mode defaults on
  - advanced controls hidden by default
  - quick actions for fast starts

## Copy Rules
- Use direct verbs: `Select`, `Enter`, `Add`, `Review`.
- Avoid abstract UX wording.
- Keep each sentence under ~14 words where practical.
