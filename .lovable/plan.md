

# Quarterly Feedback Collection System - POC

## Overview
A professional feedback collection platform that allows your client to distribute service/product feedback forms to staff at multiple client companies (1-30 companies, 50+ staff each) while keeping responses completely anonymous and segregated by company.

---

## Phase 1: Core Infrastructure

### Company & Campaign Management
- **Company registry** - Admin can add/manage client companies (e.g., MTN Nigeria, Airtel)
- **Campaign creation** - Admin can create quarterly feedback campaigns with:
  - Campaign name (e.g., "Q1 2026 Feedback")
  - Start and end dates
  - Select which companies to include
- **Unique URL generation** - Each company gets a unique, shareable link for each campaign (e.g., `/feedback/abc123` for MTN Q1, `/feedback/xyz789` for Airtel Q1)

---

## Phase 2: Staff Feedback Form

### Anonymous Feedback Interface
- Clean, professional form accessible via unique company URLs
- Company name displayed (so staff know they're on the right form)
- **POC form sections** (placeholder questions you can customize later):
  - Overall satisfaction rating (1-10 scale)
  - Service quality rating (star rating)
  - Recommendation likelihood (Likert scale)
  - Areas for improvement (multiple choice)
  - Additional comments (text field)
- Mobile-responsive design for easy access on any device
- Confirmation page after submission

---

## Phase 3: Admin Dashboard

### Secure Admin Area
- **Login system** for multiple admins
- Role-based access (admin management)

### Dashboard Features
- **Response rate tracking** - See how many staff responded per company
- **Satisfaction scores** - Average ratings with visual charts
- **Company comparisons** - Side-by-side metrics across companies
- **Trend analysis** - Track scores over quarterly campaigns
- **Visual KPIs** - Charts, progress bars, and summary cards

### Data Management
- View all responses (anonymous, grouped by company/campaign)
- Export data to CSV and excel for further analysis (The export should already contain infographics like those on the dashboard and more.)
- Filter by company, campaign, or date range

---

## Phase 4: Link Management

### URL Generation & Sharing
- Generate unique links per company per campaign
- Copy link functionality for easy sharing
- Track link status (active/expired based on campaign dates)
- View which links have been accessed

---

## Technical Approach

### Backend (Supabase)
- **Companies table** - Store client company information
- **Campaigns table** - Track quarterly feedback periods
- **Company-campaign links table** - Unique URLs and associations
- **Responses table** - Anonymous feedback data, linked to company & campaign only (not individual users)
- **Admins** - Authentication for dashboard access

### Security & Data Separation
- Complete anonymity for respondents (no user tracking)
- Data segregated by company ID in every response
- Row-level security to prevent data mixing
- Secure admin authentication

---

## Design Direction
- **Professional & corporate** aesthetic
- Clean typography and structured layouts
- Subtle use of charts and data visualization
- Consistent branding throughout form and dashboard

