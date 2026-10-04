# DhruvSetu frontend

This folder contains the DhruvSetu web interface. It uses Next.js, React,
TypeScript, and Tailwind CSS.

## Run locally

Copy the safe API setting before starting the frontend:

```bash
cp .env.example .env.local
```

The default value, `API_URL=http://127.0.0.1:8000`, is the address of the
FastAPI backend. It is used only on the server and is not sent to the browser.
The browser calls `/api/...` on the frontend's own address, and Next.js passes
those calls on to the backend (see `next.config.ts`).

Two settings in `next.config.ts` belong to that hand-over. `proxyTimeout` gives
slow answers up to two minutes. `proxyClientMaxBodySize` is `21mb`, because
Next.js passes a request body on whole only up to that size (10 MB by default):
it has to cover the largest upload the API accepts, a 20 MB document. Raise it
if the upload limit in the backend is ever raised.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Check the frontend

```bash
npm run lint
npm test
npm run build
```

`npm test` runs the tests in `src/**/*.test.{ts,tsx}` with Vitest.

## Login and roles

Browsing needs no login. The header shows "Login" to a visitor, and the name,
role and "Logout" to a signed-in account. There are three roles: `user`,
`researcher` and `admin`. Student, Teacher, Journalist and Public are Outreach
Studio audience settings, not roles.

| Page | Who can use it |
|---|---|
| `/login` | Anyone. Sign In with an email address and a password. There is no role choice: the role comes from the account. |
| `/register` | Anyone. Create Account, as a General User or with a request for researcher access. It always creates a `user` account. |
| `/welcome` | A signed-in account, straight after creating it. Shows the account type and, when there is a request, the researcher access status. |
| `/account/researcher-access` | Any signed-in account. Shows where the account stands and, when allowed, the Request Researcher Access form. |
| `/researcher` | `researcher` and `admin`. The Research Workspace: own submissions and the two submit actions. |
| `/researcher/submit/document`, `/researcher/submit/dataset` | `researcher` and `admin`. The submission forms. |
| `/data-lab` | `researcher` and `admin`. Others see "Polar Data Lab is available to research users." |
| `/admin`, `/admin/records/...` | `admin`. Verification counts, the queue, and the review page. |
| `/admin/researcher-requests`, `/admin/researcher-requests/...` | `admin`. The requests, filtered by status, and the page to approve or reject one. |
| `/admin/users` | `admin`. Switches an account between `user` and `researcher`. |

Researcher access in the pages:

- The account menu shows "Researcher Access" to a normal user and "Research
  Workspace" to a researcher or an admin.
- The words for the state are always shown as text with the badge: "No
  researcher access request", "Pending Review", "Approved", "Rejected" or
  "Removed". A waiting request is never shown as researcher access; the account
  type stays "General User" until an admin approves it.
- The researcher questions are one component (`ResearcherFields`) with one set
  of checks, used both when signing up and on the Researcher Access page.
- A rejected person sees the administrator's note, if one was written, and gets
  the form again. While a request is pending the form is not shown.
- Approve and Reject ask for confirmation before anything is sent. After an
  approval the person is signed out and signs in again as a researcher.
- The submission forms check the file type and size before sending (PDF or TXT
  up to 20 MB, CSV or JSON up to 5 MB). They never send a verification status
  or a submitter: the API sets both. A new submission is shown as Uploaded.
- Public document and dataset pages show "Submitted by" with the display name
  only. The admin review page also shows the submitter's email.
- All of these pages are plain forms and lists, and work the same in Lite Mode.

The Sign In and Create Account pages:

- Both use `AuthLayout` (`src/components/auth-layout.tsx`): the DhruvSetu panel
  beside the form on wide screens, and the form alone below 1024px.
- The forms are `LoginForm` and `RegisterForm` in
  `src/components/auth-form.tsx`. The checks are plain functions in
  `src/lib/auth-validation.ts` and repeat the API's rules (a password of 10 to
  128 characters, nothing stricter).
- Every field has a label, problems are shown under the field and linked to it,
  and the first field with a problem gets the focus. Each password has a
  "Show password" / "Hide password" button. A form cannot be sent twice.
- "I want to join as" offers General User and Researcher. Admin is never
  offered. Choosing Researcher shows the researcher questions and the note
  "Researcher access requires administrator approval. Your account will
  initially have normal user access."
- The password confirmation is checked in the browser and is not sent. No role
  is ever sent. The researcher answers are saved by the API as a request, which
  an admin cannot review yet (see the backend README, "Signing up").
- A `?next=` address is kept across Sign In, Create Account and the welcome
  page, so a person returns to where they were going.

How it fits together:

- The login cookie is HTTP-only. Page scripts never see it, and nothing about
  the login is kept in `localStorage`.
- The root layout asks the backend who is signed in (`getCurrentUser` in
  `src/lib/auth-server.ts`) and shares the answer through `AuthProvider`
  (`src/components/auth.tsx`). Client components read it with `useAuth()`.
- Hiding a link or a page is only for convenience. The backend checks the
  login and the role on every protected request, so a hidden control that is
  called anyway is refused.
- The "Admin" entry is shown only to admins. A signed-out visitor who opens
  `/admin` is sent to `/login` and returned after logging in.
- Lite Mode works the same signed in or signed out.

Accounts, the admin and researcher setup command, and the security limits are
described in the backend README under "Accounts and roles".

## Images

Every photograph is a file in `public/images`. None is loaded from another
website, and `next.config.ts` allows no remote image.

| Place | Photograph | Licence |
|---|---|---|
| Home page hero | Mountains and glaciers near the Larsen C ice shelf (NASA Operation IceBridge, 2017) | CC BY 2.0 |
| Sign-in, Create Account and welcome panel | Antarctic mountains near the Getz Ice Shelf (NASA / Christy Hansen, 2012) | Public domain |
| Home page, "India in the Polar Regions"; Antarctic expedition pages | Maitri station (Prakash khatarkar) | CC BY-SA 4.0 |
| Antarctic expedition cards | Aerial view of Maitri, 2005 (Government of India, through PIB) | GODL-India |
| Arctic expedition cards and pages | Ny-Ålesund seen from Kongsfjorden, 2012 (Bjoertvedt) | CC BY-SA 3.0 |
| Arctic expedition cards | Shore of Kongsfjorden, 2013 (Rob Oo) | CC BY 2.0 |
| Expeditions page header | Schirmacher Hills, 1983 (Pavan Nair) | CC BY-SA 4.0 |

Rules:

- An image is added only when its own source page states a licence that
  permits reuse. A picture that is merely visible on a website is not used.
  This includes the NCPOR website, which is a source of facts only.
- Each image is listed in two places that must agree:
  `public/images/ATTRIBUTIONS.md`, the record to read, and `src/lib/images.ts`,
  which holds the path, alt text, caption, credit, licence and source page that
  the pages use. `src/lib/images.test.tsx` fails when a file in the folder is
  not listed, when a listed file is missing, or when the two disagree.
- Credits are shown on the page `/image-credits`, linked from the footer, and
  beside the larger photographs.
- Alt text says only what the photograph shows. Expedition photographs show the
  region or a station, not the expedition itself, and their captions say so.
- No portrait of a scientist is used. Profiles show initials.
- Datasets, publications, documents, search, the Data Lab and the admin pages
  have no decorative photograph. There is no licensed photograph of Bharati or
  of the Himadri building, so none is shown.
- Images are resized and compressed before they are added. `next/image` then
  serves a size that fits the screen. Only the homepage hero and a page's main
  banner load with priority.
- A page never depends on a photograph. Each image area has a plain background
  behind it, and Lite Mode leaves the photographs out.

## Lite Mode

Lite Mode makes DhruvSetu usable on slow or expensive connections. It is
switched on and off with the "Lite Mode" switch in the header and uses the same
pages and links as normal mode.

What it does:

- Photographs are not sent at all: the homepage hero and station photo, the
  Expeditions page header, the photos on expedition cards and on the expedition
  page, and the photo in the sign-in panel. The text, counts
  and search box stay.
- The Polar Map page does not load the map library or any map tiles. It shows
  the same locations as text: name, region, coordinates, station, verification
  status and related expeditions.
- Code is shown in the device's own monospace font instead of a downloaded one.

What stays the same: search (keyword and semantic), expeditions, scientists,
publications, datasets with their preview table, column statistics and chart,
documents and provenance, the assistant page, Outreach Studio, and Polar Data
Lab. The dataset chart stays because it is drawn in the browser from the
preview data and makes no extra request. A Data Lab session still starts only
when a dataset is opened in the Data Lab.

Loading the map on request: the Polar Map page has a "Load Interactive Map"
button in Lite Mode. It loads the map for that page only. Lite Mode stays on,
and after leaving or reloading the page the map is not loaded again until the
button is used.

How the choice is stored: in this browser only, in `localStorage`
(`dhruvsetu.liteMode`). It is copied into a small cookie (`dhruvsetu_lite`) so
that the server can leave the images out before the page is sent. Nothing is
stored in the database and no login is needed. Clearing the browser data
resets it.

Slow connections: if the browser reports data saving or a 2G connection
(`navigator.connection`), a one-time suggestion to turn on Lite Mode is shown.
Lite Mode is never switched on automatically, and browsers that report nothing
show no suggestion.

Switching from normal mode to Lite Mode stops further image and map requests.
Anything already downloaded stays in the browser cache.

Where it lives: `src/lib/lite-mode.ts` (saved choice), `src/lib/lite-mode-server.ts`
(server check), `src/components/lite-mode.tsx` (shared state and the switch).
Server pages call `isLiteMode()` and skip the image; client components use
`useLiteMode()`.
