# EdgeLog Pro

EdgeLog Pro is an advanced, AI-powered trading journal designed to help traders track, analyze, and improve their performance. It features a modern Next.js architecture, secure cloud sync via Supabase, and an AI Coach powered by Google Gemini.

## Features

*   **Journaling:** detailed logging of trades with entry/exit/management notes.
*   **Charts:** Upload and annotate trade charts. Images are stored securely in the cloud.
*   **Analytics:** Advanced statistics including Win Rate, Profit Factor, Expectancy, and "Best/Worst" setup analysis.
*   **Cloud Sync:** Secure authentication and data persistence using Supabase (PostgreSQL).
*   **Guest/Demo Mode:** Fully functional local-only mode for trying out the tool without signing up (uses LocalStorage).
*   **AI Coach:** Built-in AI analysis using Google Gemini to review your execution, risk management, and psychology.
*   **Import Wizard:** Smart CSV importer with a fallback wizard for mapping custom column formats.
*   **Export:** Export your entire portfolio to CSV for backup.

## Tech Stack

*   **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **Backend/Auth/DB:** [Supabase](https://supabase.com/)
*   **AI:** [Google Gemini API](https://ai.google.dev/)
*   **Icons:** Lucide React

## Prerequisites

Before you begin, ensure you have:
*   Node.js (v18 or higher) installed.
*   A [Supabase](https://supabase.com/) project.
*   A [Google Gemini API Key](https://aistudio.google.com/).

## Setup Instructions

### 1. Clone & Install
```bash
git clone <repository-url>
cd edgelog
npm install
```

### 2. Environment Configuration
The application relies on a `.env.local` file for configuration.
A template has been created for you. Ensure it contains the following keys:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
# Optional: Specify AI Model (defaults to gemini-flash-latest)
GOOGLE_GEMINI_MODEL=gemini-2.5-pro
```

### 3. Database Setup (Supabase)
1.  Go to your Supabase project's **SQL Editor**.
2.  Open the file `supabase_schema.sql` located in the root of this repository.
3.  Copy the content and run it in the SQL Editor. This will:
    *   Create the `trades` table.
    *   Enable Row Level Security (RLS) so users only see their own data.
    *   Create the `trade-images` storage bucket and policies.

### 4. Running Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Vercel (Recommended)
1.  Push your code to a Git repository (GitHub/GitLab).
2.  Import the project into [Vercel](https://vercel.com/).
3.  In the Vercel project settings, add the **Environment Variables** listed above (`NEXT_PUBLIC_SUPABASE_URL`, etc.).
4.  Deploy.

## How to Use

*   **Import Data:** Click "Import Data" in the sidebar. Upload a CSV. If the format isn't recognized, the Wizard will appear to help you map columns.
*   **AI Analysis:** Select a trade, scroll to the "Review" section, and look for the "AI Coach" card. Click "Analyze Trade".
*   **Sync:** Sign in via the Sidebar to sync your data to the cloud. If you are a guest, data is saved to your browser's Local Storage.
