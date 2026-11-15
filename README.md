# Student Expense Tracker

A mobile-first expense tracker and budget manager built for students at African Leadership University (ALU) in Kigali. It replaces spreadsheet-and-notes budgeting with a small installable web app that records expenses in seconds, understands Rwandan Mobile Money (MoMo) SMS messages, and keeps every record in the student's own Firebase account.

**Live app:** https://alu-expense-tracker.web.app

Current version: **1.9.1** (release notes live in `src/version.ts` and are shown inside the app under Settings → About).

---

## Table of contents

1. [What the app does](#what-the-app-does)
2. [Tech stack](#tech-stack)
3. [Run it on your computer](#run-it-on-your-computer)
4. [Build for production](#build-for-production)
5. [Deploy to Firebase Hosting](#deploy-to-firebase-hosting)
6. [Configuration](#configuration)
7. [Use your own Firebase project](#use-your-own-firebase-project)
8. [Project structure](#project-structure)
9. [How data is stored](#how-data-is-stored)
10. [Privacy and security](#privacy-and-security)
11. [Troubleshooting](#troubleshooting)
12. [Documentation](#documentation)

---

## What the app does

- **Accounts** — email and password sign-up and sign-in with Firebase Authentication, password reset by email, and a profile with a photo.
- **Expenses** — record an amount, category, note and date; edit or delete any record. Records are saved one at a time, so a slow connection can never overwrite the rest of the list.
- **Budget** — a monthly spending cap, a configurable cycle start day, and a warning threshold.
- **MoMo import** — paste a Mobile Money SMS and the app extracts the amount, merchant and date instead of typing it by hand.
- **Insights** — category breakdown, a spending trend chart, and detection of recurring expenses.
- **Export** — download records as a spreadsheet file or print a clean statement.
- **Works offline** — installable as a PWA; saves made offline are queued and sent when the connection returns.
- **In-app updates** — the app compares its build version with the published one and offers a refresh when a new release exists.
- **Bug reports** — reports are written to a Firestore collection and, if an email key is configured, forwarded by email.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript, Tailwind CSS 4, lucide-react icons |
| Build | Vite 8, `vite-plugin-pwa` (service worker and manifest) |
| Backend | Firebase Authentication (email/password) and Cloud Firestore |
| Hosting | Firebase Hosting (static build in `dist/`) |
| Dev server | Express + Vite middleware (`server.ts`) |

No custom server is needed in production: the deployed app is static files that talk to Firebase directly.

---

## Run it on your computer

### Prerequisites

- **Node.js 22.18 or newer** — check with `node --version`
- **npm** (installed with Node.js)
- A browser (Chrome, Edge, Firefox or Safari)

Nothing else is required. The app is pre-configured to talk to the project's Firebase backend, so it runs immediately after `npm install`.

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/<your-username>/student-expense-tracker.git
   cd student-expense-tracker
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   This downloads React, Vite and the Firebase SDK into `node_modules/`. It takes a minute or two the first time.

3. **Create your local environment file (optional but recommended)**

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell use `Copy-Item .env.example .env` instead.
   The only value worth setting is `VITE_WEB3FORMS_KEY`; without it everything works except emailed bug reports. Never commit `.env` — it is already ignored by git.

4. **Start the development server**

   ```bash
   npm run dev
   ```

   The terminal prints something like `Server running at http://0.0.0.0:3000`. The server compiles the TypeScript on the fly; the first start takes a few seconds.

5. **Open the app**

   Go to **http://localhost:3000** in your browser.

   If port 3000 is already used by another program, stop that program or run on another port:
   - macOS / Linux / Git Bash: `PORT=3001 npm run dev`
   - Windows Command Prompt: `set PORT=3001&& npm run dev`
   - Windows PowerShell: `$env:PORT=3001; npm run dev`

6. **Create an account**

   Use the sign-up screen with any email you can access. The account is created in the project's Firebase Authentication. Do not use a real password you use elsewhere — this is a demo environment.

To make the app installable while developing, use the production build (step 4 of the next section), because the service worker is disabled in development.

---

## Build for production

```bash
npm run build
```

This writes a static site into `dist/`, including `dist/version.json` (read by the in-app update checker) and the PWA service worker. Preview it locally with:

```bash
npm run preview
```

To check the code without building:

```bash
npm run lint
```

---

## Deploy to Firebase Hosting

Only needed if you are publishing your own copy. The commands below assume the Firebase CLI is available through `npx`.

1. Sign in to Firebase:

   ```bash
   npx firebase-tools login
   ```

2. Make sure the project alias points at the right Firebase project (`.firebaserc` already contains `alu-expense-tracker`; change it for your own project):

   ```bash
   npx firebase-tools use --add
   ```

3. Build and deploy the site plus the Firestore security rules:

   ```bash
   npm run build
   npx firebase-tools deploy --only hosting,firestore:rules --project alu-expense-tracker
   ```

   To deploy only the site: `npx firebase-tools deploy --only hosting --project alu-expense-tracker`.

4. Open the Hosting URL printed at the end (for this project: https://alu-expense-tracker.web.app).

Never edit files in `dist/` by hand — they are rebuilt from `src/` on every deploy.

---

## Configuration

| File | Purpose | Safe to publish? |
| --- | --- | --- |
| `firebase-applet-config.json` | Firebase web config (project id, web API key, Auth domain, database id). The web API key identifies the project; it is not a secret. Access is controlled by security rules. | Yes |
| `.env` | Optional `VITE_WEB3FORMS_KEY` for bug-report emails. Ignored by git. | **No** |
| `firestore.rules` | Who may read and write each collection. Deployed with `firestore:rules`. | Yes |
| `storage.rules` | Rules for Cloud Storage (a bucket is not currently used; photos are stored in the profile document). | Yes |
| `.firebaserc` | Default Firebase project alias. | Yes |

---

## Use your own Firebase project

1. Create a project at https://console.firebase.google.com.
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database.** Pick a location close to your users (this project uses `nam5`) and start in production mode.
4. Add a **Web app** in Project settings, copy its config values into `firebase-applet-config.json`, and set `firestoreDatabaseId` to the database id you created (`default` unless you named it).
5. Deploy the rules: `npx firebase-tools deploy --only firestore:rules --project <your-project-id>`.
6. If you host somewhere other than Firebase, add that domain under **Authentication → Settings → Authorized domains**.

The data model expects only two collections (`users/...` and `feedback`), so no manual collection creation is needed.

---

## Project structure

```
.
├── index.html                 # HTML entry point
├── src/
│   ├── App.tsx                # App shell, routing between screens, save/delete flows
│   ├── main.tsx               # React bootstrap
│   ├── index.css              # Design tokens and global styles (Tailwind 4)
│   ├── version.ts             # App version + release notes shown in Settings → About
│   ├── components/            # Screens and modals (auth, dashboard, expenses, settings…)
│   ├── hooks/                 # PWA install prompt, scroll reveal
│   ├── lib/                   # Firebase init, Firestore sync, avatars, bug reports
│   ├── types/                 # Shared TypeScript types (expense, budget, profile…)
│   └── utils/                 # MoMo SMS parser, categoriser, recurring detector, storage
├── public/                    # Icons, manifest, static assets
├── firestore.rules            # Owner-only access rules
├── storage.rules
├── firebase.json              # Hosting, auth and Firestore deploy configuration
├── vite.config.ts             # Build, PWA manifest and service-worker strategy
├── server.ts                  # Local dev server (Express + Vite middleware)
└── docs/                      # Technical handbook and installation guide
```

`npm run dev` uses `server.ts` only as a convenience: it serves the Vite app on one port. The deployed site is pure static hosting.

---

## How data is stored

Every account has two Firestore documents:

- `users/{uid}` — the profile root document (name, email, avatar).
- `users/{uid}/data/store` — the student's data: `profile`, `budget` (monthly cap, cycle start day, warning threshold), `transactions` (array of records), `categories`, `deletedTransactionIds` (tombstones so a deleted record cannot come back), and `updatedAt`.

Saves use per-record `arrayUnion` / `arrayRemove` instead of rewriting the whole list, which is what prevents one device from silently replacing another device's records. Bug reports go to `feedback/{autoId}` with `create`-only permission.

Each record has an `id`, `amount`, `category`, `note`, `date` (`YYYY-MM-DD`), `time`, `source`, `createdAt` and `updatedAt` (ISO timestamps), plus optional recurring fields. Dates are kept as strings so a record stored on one device keeps exactly the date the student typed, regardless of time zone.

---

## Privacy and security

- Firestore rules are **default deny**. A signed-in user can read and write only their own `users/{uid}` documents, and may only create feedback entries carrying their own uid.
- No student records, emails or passwords live in this repository. `data/user_database.json`, `cookies.txt`, `private_files/` and `.env` are ignored by git.
- Passwords are hashed by Firebase Authentication; the app never sees or stores them.
- The Firebase web API key in `firebase-applet-config.json` is public by design. It identifies the project; it does not grant access. Security rules are what protect the data.
- Profile photos are compressed in the browser and stored as a data URL inside the user's profile document, because this project does not use a Cloud Storage bucket.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `npm run dev` fails with `EADDRINUSE` | Port 3000 is taken | Use `PORT=3001` as shown above |
| The installed app shows old screens | The PWA is serving a cached shell | Reload once; if it persists, clear site data for the site and sign in again |
| Sign-in works but the list is empty | You signed into a different account, or the record was deleted on another device | Check the email under Settings; deletion is intentional and permanent |
| Records say "Saved on this phone, will sync" | Device is offline or Firestore is unreachable | Nothing to do — the app retries on reconnect, on reopen and every 20 seconds |
| Password reset email never arrives | Firebase sends to the registered address only; check spam | Request once, wait two minutes before requesting again |
| Bug report not emailed | `VITE_WEB3FORMS_KEY` is missing from the build | Add it to `.env`, rebuild, redeploy (reports are still saved in Firestore without it) |
| `node --version` is below 22.18 | The dev server uses TypeScript type stripping | Install the current LTS from https://nodejs.org |

---

## Documentation

- `docs/handbook/Technical-Handbook.pdf` — 22-page technical handbook: front-end decisions, backend tour, data model, security rules, full release history, publishing steps.
- `docs/handbook/handbook.html` — the same handbook in a browser.
- `docs/install-guide/install-guide.html` — how to install the app on a phone.

---

## Version

**1.9.1** — see `src/version.ts` for every release from 1.1 to 1.9.1 and the changes each one made. The in-app update check compares the running build with `version.json` published by the latest deploy.

Built for the ALU Software Development summative, November 2026.
