/* ═════════════════════════════════════════════════════════════════════════════
 * KNOWLEDGE BASE — content, glossary, tooltip registry and search.
 *
 * Everything in here is static content + pure helpers: no React, no storage.
 * The article library ships with the app (works completely offline); anything
 * the user writes themselves is kept in the store under `kbArticles` so it is
 * included in backups like any other data.
 *
 * Body syntax is a small, safe markdown subset rendered by Markdown.jsx:
 *   ## heading · ### subheading · - bullet · 1. step · > [!TIP] text
 *   ```fenced code``` · | table | rows | · --- rule
 *   inline **bold**, *italic*, `code`, [label](article:slug), [label](https://…)
 * ═════════════════════════════════════════════════════════════════════════════ */

export const KB_VERSION = '2026.09.0'

/* ── categories ───────────────────────────────────────────────────────────── */
export const CATEGORIES = [
  { id: 'start',   label: 'Getting started',        icon: 'Sparkles',       color: '#818cf8',
    blurb: 'Set up in five minutes, learn the layout, then move fast with the keyboard.' },
  { id: 'people',  label: 'People & relationships', icon: 'Users',          color: '#38bdf8',
    blurb: 'Contacts, groups, tags, relationship rhythms and the network graph.' },
  { id: 'rhythm',  label: 'Staying in touch',       icon: 'HeartHandshake', color: '#fb7185',
    blurb: 'Tasks, follow-ups, calendar, birthdays and the notification inbox.' },
  { id: 'notes',   label: 'Notes & knowledge',      icon: 'StickyNote',     color: '#fbbf24',
    blurb: 'Markdown notes with contact links, plus this knowledge base.' },
  { id: 'data',    label: 'Data, backup & sync',    icon: 'Database',       color: '#34d399',
    blurb: 'Import, export, backups, multi-device sync and automations.' },
  { id: 'privacy', label: 'Privacy & security',     icon: 'ShieldCheck',    color: '#a78bfa',
    blurb: 'Where your data lives, the app lock, and exactly what leaves the device.' },
  { id: 'fix',     label: 'Troubleshooting',        icon: 'LifeBuoy',       color: '#f97316',
    blurb: 'Forgotten pincodes, tricky imports, empty calendars, sync conflicts.' },
  { id: 'ref',     label: 'Reference',              icon: 'BookOpen',       color: '#22d3ee',
    blurb: 'Glossary, keyboard shortcuts, release notes and FAQs.' },
]
export const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))

/* ── articles ─────────────────────────────────────────────────────────────── */
export const ARTICLES = [
  /* ── getting started ─────────────────────────────────────────────────────── */
  {
    id: 'start.first-5-minutes', cat: 'start', title: 'Your first five minutes',
    summary: 'Register, pick a pincode, import your people, set your first rhythm.',
    tags: ['setup', 'begin', 'onboarding', 'start'], updated: '2026-09-24',
    body: `Personal CRM keeps every record **on this device**. There is no account to create and no server that holds your data — which also means a backup is your responsibility.

## 1 · Tell the app who you are
On first launch the app asks for your name, email and mobile. That is used for your greeting, for verification badges and for support — nothing else. You can skip it and fill it in later from **Settings → Identity**.

## 2 · Choose a pincode (optional but recommended)
A 4–6 digit pincode locks the app at every start and after 15 minutes in the background. It is stored as a **salted hash** — the code itself is never written to disk, so it cannot be read back by anyone, including us. Skip it if you prefer, and turn it on later from **Settings → App lock**.

## 3 · Bring your people in
- **Import → CSV or vCard** for a phone export or spreadsheet.
- **Quick Capture** (the floating ⚡ button) for one person at a time — name and number, saved as a lead in two taps.
- **Contacts → New contact** for the full record.

## 4 · Set a rhythm for each person
Every contact has a **relationship rhythm** — how often you realistically want to be in touch (Close Friend every 14 days, Family 21, Client 30, Colleague 45, Lead 7, Acquaintance 90). The app then tells you who is drifting.

## 5 · Do the smallest useful thing
Open **Follow-Ups**, pick the most overdue person, and send one message. Mark them contacted. That single habit is the whole product.

> [!TIP] Turn on sync only when you want it. Everything works offline; sync is opt-in and explained in [Multi-device sync](article:data.sync).`,
    related: ['start.tour', 'privacy.registration', 'data.import', 'people.rel-rhythm'],
  },
  {
    id: 'start.tour', cat: 'start', title: 'Take the guided tour',
    summary: 'A 60-second spotlight walkthrough of the screen you are looking at.',
    tags: ['tour', 'onboarding', 'walkthrough', 'coach'], updated: '2026-09-24',
    body: `The tour dims the screen and spotlights one control at a time, explaining what it does. It runs once on your first visit and you can replay it any time.

## Start it
- **Knowledge base → Guided tour**, or
- press **?** and choose **Replay the tour**.

## During the tour
- **→ / Next** (or **Enter**) advances, **←** goes back.
- **Esc** quits at any step.
- Move your mouse or scroll if a spotlight looks off — it re-measures on every step.

On a phone the tour is the same, but the card sits at the bottom where your thumb is.

> [!NOTE] The tour remembers where it stopped, so closing the app mid-tour resumes where you left off.`,
    related: ['start.first-5-minutes', 'ref.shortcuts', 'start.layout'],
  },
  {
    id: 'start.layout', cat: 'start', title: 'How the app is laid out',
    summary: 'Sidebar, topbar, Quick Capture, and what each screen is for.',
    tags: ['ui', 'layout', 'sidebar', 'navigation', 'screen'], updated: '2026-09-24',
    body: `## Sidebar (left)
Your navigation. On a phone it collapses into a **☰ hamburger menu** — tap it to slide the menu out, tap a destination or the dimmed background to close it. Badges show counts that need attention: overdue tasks, overdue follow-ups, unread inbox items.

## Topbar
Page title on the left; on the right: multi-device sync status, light/dark theme, **Global search (⌘K)** and quick-add buttons. On narrow screens the quick-adds hide — the floating **⚡ Quick Capture** button covers them.

## Quick Capture (floating ⚡)
Bottom-right. Two fields — name and number — saved straight as a lead. It is the fastest path from "just met someone" to "they are in the system".

## Screens at a glance
| Screen | Use it for |
| --- | --- |
| **Dashboard** | Today's picture: what is due, who is drifting, what changed |
| **Contacts** | Every person, with groups, tags and rhythms |
| **Tasks** | Kanban of things you promised to do |
| **Notes** | Markdown notes you can link to people |
| **Follow-Ups** | Who you owe a message, sorted by how overdue |
| **Inbox** | Notifications, with snooze |
| **Network** | Who introduces whom |
| **Analytics** | How your network is actually behaving |

> [!TIP] Press **g** then a letter to jump: **g d** dashboard, **g c** contacts, **g t** tasks, **g n** notes, **g f** follow-ups, **g b** birthdays.

Stuck on a screen? The **Guide** chip beside its title opens the article about exactly that screen.`,
    related: ['start.first-5-minutes', 'ref.shortcuts', 'notes.kb'],
  },
  {
    id: 'start.quick-capture', cat: 'start', title: 'Quick Capture: name + number → lead',
    summary: 'The two-tap path from meeting someone to having them in your CRM.',
    tags: ['capture', 'lead', 'fast', 'fab', 'add'], updated: '2026-09-24',
    body: `Quick Capture exists because the full contact form is too slow when you are standing next to someone.

## How it works
1. Tap the floating **⚡** button (bottom-right).
2. Type a **name** and a **number**.
3. Save — the person lands in your contacts with the **Lead** rhythm (touch base every 7 days) and is added to the **Leads** group if you use it.

The badge on the button counts how many people you captured in this session, so a day of networking has a number attached to it.

## After capturing
Leads captured this way are deliberately thin — a name and a number. When you get to a keyboard, open the contact and fill in the company, email, where you met and what you promised. The **Network** screen can then show who introduced you.

> [!TIP] On the Android app Quick Capture sits above the gesture bar, so it never fights with system navigation.`,
    related: ['people.contacts', 'people.rel-rhythm', 'people.merge'],
  },

  /* ── people ──────────────────────────────────────────────────────────────── */
  {
    id: 'people.contacts', cat: 'people', title: 'Contacts: the heart of the app',
    summary: 'Every field explained, plus the actions you will use daily.',
    tags: ['contact', 'person', 'fields', 'record', 'edit'], updated: '2026-09-24',
    body: `A contact is more than a phone number. The record holds:

| Field | Why it matters |
| --- | --- |
| **Name / role / company** | What you would say if you introduced them |
| **Phone / email** | One tap to call, message or mail |
| **Groups** | The circles they belong to — they can be in many |
| **Tags** | Free-form slices: *VIP*, *investor*, *cricket* |
| **Relationship rhythm** | How often you want to be in touch |
| **Last contact** | Updated when you mark them contacted |
| **Birthday / anniversary** | Feeds the Birthdays screen |
| **Interests, gift ideas** | The details that make a message feel personal |
| **Introduced by** | Powers the network graph |

## Daily actions
- **Mark contacted** resets the clock on their rhythm — do this the moment you hang up or hit send.
- **Add a task** turns "I said I'd send the deck" into something you will actually see.
- **Snooze** hides them from Follow-Ups for a week if the timing is wrong.
- **Merge** combines two records when you accidentally add the same person twice (see [Merging duplicates](article:people.merge)).

## Search and filters
Search matches name, role and company. Combine it with a group, a tag or a rhythm to narrow down — *everyone in Leads I have not spoken to in a fortnight* is two clicks away.

> [!TIP] Star the handful of people you would never want to lose touch with. They survive every filter.`,
    related: ['people.groups', 'people.tags', 'people.rel-rhythm', 'people.merge'],
  },
  {
    id: 'people.rel-rhythm', cat: 'people', title: 'Relationship rhythms',
    summary: 'How often you want to talk, and how the app nags you about it.',
    tags: ['rhythm', 'cadence', 'frequency', 'touch', 'rel'], updated: '2026-09-24',
    body: `Every relationship has a natural cadence. Set it once and the app keeps time for you.

## The presets
| Rhythm | Every | Fits |
| --- | --- | --- |
| Close Friend | 14 days | Your inner circle |
| Family | 21 days | Relatives |
| Client | 30 days | Paying accounts |
| Colleague | 45 days | Professional circle |
| Lead | 7 days | Fresh opportunities |
| Acquaintance | 90 days | Everyone else |

You can edit any of these — and add your own — in **Settings → Relationship rhythms**.

## What the app does with it
- **ok** — you are inside the window.
- **due soon** — within three days of the window closing.
- **overdue** — you have drifted; they appear in **Follow-Ups**, sorted by how far past.
- **snoozed** — you asked to be reminded later.

> [!NOTE] The rhythm is a suggestion, not a rule. Snooze without guilt when life is busy — the point is that nobody is forgotten *forever*.`,
    related: ['rhythm.followups', 'people.contacts', 'rhythm.inbox'],
  },
  {
    id: 'people.groups', cat: 'people', title: 'Groups: many-to-many circles',
    summary: 'Family, clients, leads — a contact can belong to several at once.',
    tags: ['group', 'circle', 'segment', 'organise'], updated: '2026-09-24',
    body: `Groups are the big buckets: **Family**, **Work Colleagues**, **Close Friends**, **Clients**, **Leads**, **College Friends**.

A contact can be in **more than one group** — a college friend who is now a client belongs in both. Groups carry a colour so they are recognisable everywhere.

## Using groups
- Filter Contacts by group.
- Sync only a group to a particular backend.
- Export or act on a whole circle at once.

## Groups vs tags
Groups are the few, stable, structural circles. **Tags** are the many, ad-hoc labels. If you are wondering whether something is a group or a tag: if you would use it to filter your whole address book, it is a group.`,
    related: ['people.tags', 'people.contacts', 'data.sync'],
  },
  {
    id: 'people.tags', cat: 'people', title: 'Tags: slice your network',
    summary: 'Ad-hoc labels with colours and icons — the fastest way to narrow a list.',
    tags: ['tag', 'label', 'filter', 'organise'], updated: '2026-09-24',
    body: `Tags are free-form: **VIP**, **Investors**, **Cricket circle**, **Q4 push**, **Dhaka**. Each has a colour and an icon.

- Add or remove tags on one contact, or on a whole selection at once.
- Filter by several tags together.
- Rename a tag everywhere from **Tags**, and see how many people carry it.

> [!TIP] Tag the *reason* you know someone, not just their category. "Met at the Dhaka meetup" is more useful in six months than "work".`,
    related: ['people.groups', 'people.contacts'],
  },
  {
    id: 'people.graph', cat: 'people', title: 'Network graph: who introduces whom',
    summary: 'A live map of your relationships, coloured by group.',
    tags: ['graph', 'network', 'map', 'introduced', 'visual'], updated: '2026-09-24',
    body: `The network graph draws every contact as a node, sized by how strong the relationship is and coloured by group. Lines connect people through the **Introduced by** field, so you can see at a glance which relationships came through which person.

## Reading it
- **Bigger node** — more touches, more recent contact.
- **Cluster** — a circle of people who know each other.
- **Bridge** — the one person connecting two clusters. Those are your most valuable relationships.

## Using it
Drag nodes to untangle, hover (or tap) for the mini profile, and click through to the full contact. If you are looking for a warm introduction to someone, this is where you find the path.

> [!NOTE] The graph only draws connections you have recorded. Fill in **Introduced by** on a few key people and it comes alive.`,
    related: ['people.contacts', 'people.groups', 'notes.notes'],
  },
  {
    id: 'people.merge', cat: 'people', title: 'Merging duplicate contacts',
    summary: 'Combine two records without losing groups, tags or history.',
    tags: ['merge', 'duplicate', 'cleanup', 'dedupe'], updated: '2026-09-24',
    body: `Phone exports are full of duplicates, and Quick Capture is fast enough that you will occasionally add someone twice.

## How a merge behaves
Merging moves **groups, tags and links** from the duplicate onto the record you keep. Where both records have a value (say, two different phone numbers), the one on the record you keep wins — so pick the *better* record as the survivor, not the older one.

The duplicate is deleted and the merge is written to **History**, so you can see what happened.

> [!TIP] Merge before you sync. Cleaning up on one device and then syncing is much tidier than reconciling duplicates across two.`,
    related: ['people.contacts', 'data.import', 'data.sync'],
  },

  /* ── staying in touch ────────────────────────────────────────────────────── */
  {
    id: 'rhythm.tasks', cat: 'rhythm', title: 'Tasks: the promise board',
    summary: 'A four-column kanban for everything you said you would do.',
    tags: ['task', 'kanban', 'todo', 'priority', 'due'], updated: '2026-09-24',
    body: `Tasks are the things you owe people: send the deck, make the introduction, check in after the interview.

## The columns
| Column | Meaning |
| --- | --- |
| **To do** | Committed, not started |
| **In progress** | Actively working on it |
| **Waiting** | Blocked on someone else |
| **Done** | Shipped |

## Each task carries
- a **contact** it belongs to, so you can see everything you owe one person;
- a **priority** (high / medium / low);
- a **due date**, which drives the overdue count in the sidebar;
- **subtasks** for anything multi-step;
- **tags**, so you can group by project.

Drag between columns, or open a task and change it there. Tasks due today or overdue are counted in the sidebar badge.

> [!TIP] "Waiting" is the most underrated column. Things you are blocked on stop cluttering To do, but do not disappear.`,
    related: ['rhythm.followups', 'people.contacts', 'rhythm.inbox'],
  },
  {
    id: 'rhythm.followups', cat: 'rhythm', title: 'Follow-Ups: who you owe a message',
    summary: 'Everyone past their rhythm, sorted by how far past.',
    tags: ['follow-up', 'overdue', 'drifting', 'snooze', 'touch'], updated: '2026-09-24',
    body: `Follow-Ups is the screen that makes the product work. It lists every contact who is **due soon** or **overdue** against their relationship rhythm, most overdue first.

## What you can do from here
- **Mark contacted** — you spoke; the clock resets.
- **Snooze** — 3, 7 or 30 days. Use it when you genuinely cannot right now.
- **Add a task** — the conversation needs a follow-up action.
- **Open the contact** — check the notes before you write.

## Reading the numbers
\`\`\`
42d since contact · 12d overdue
\`\`\`
The first number is how long since you last marked them contacted; the second is how far past their rhythm you are.

> [!TIP] Work this list top-down for ten minutes a day. Ten minutes beats an hour once a month, because the people at the top never get scary.`,
    related: ['people.rel-rhythm', 'rhythm.inbox', 'rhythm.tasks'],
  },
  {
    id: 'rhythm.calendar', cat: 'rhythm', title: 'Calendar & events',
    summary: 'Month view for birthdays, anniversaries and things you scheduled.',
    tags: ['calendar', 'event', 'month', 'schedule', 'plan'], updated: '2026-09-24',
    body: `The calendar has two jobs.

## 1 · Scheduled events
Things with a date: calls, coffees, reviews, deadlines. Each has a colour and can be linked to a contact.

## 2 · What the app works out for you
**Birthdays and anniversaries** from your contacts appear on their day, every year, without you creating an event. That is usually why a calendar looks busy — and why it is worth keeping those fields filled in.

Drag an event to another day to reschedule it; the change is recorded in **History**.

> [!TIP] If the month view looks empty, check that contacts actually have birthdays stored and that you are on the right month — see [Calendar looks empty](article:fix.calendar-empty).`,
    related: ['rhythm.birthdays', 'data.google', 'data.carddav'],
  },
  {
    id: 'rhythm.birthdays', cat: 'rhythm', title: 'Birthdays & anniversaries',
    summary: 'Never be the person who forgets. Includes gift ideas.',
    tags: ['birthday', 'anniversary', 'gift', 'reminder', 'date'], updated: '2026-09-24',
    body: `Birthdays come from the **birthday** field on a contact; anniversaries from the **anniversary** field. Both roll over every year automatically.

The Birthdays screen shows this month and what is coming, with a countdown. Open a person to see the **gift ideas** field — the note you left yourself in a wiser moment.

> [!TIP] Fill in gift ideas when you think of them, not on the morning of. Future-you has no ideas at 8am.`,
    related: ['rhythm.calendar', 'people.contacts', 'rhythm.inbox'],
  },
  {
    id: 'rhythm.inbox', cat: 'rhythm', title: 'Notification inbox & snoozing',
    summary: 'Everything the app wants to tell you, in one dismissible list.',
    tags: ['inbox', 'notification', 'snooze', 'dismiss', 'reminder'], updated: '2026-09-24',
    body: `The inbox collects **overdue follow-ups**, **tasks due today**, **events**, **birthdays** and **system notices** into one list, newest first.

## Actions
- **Mark read** — acknowledged.
- **Snooze** — 1, 3 or 7 days, or until a date.
- **Dismiss** — gone.
- **Jump** — straight to the contact, task or event it is about.

## Turning types off
**Settings → Notifications** lets you switch off any category (tasks, follow-ups, birthdays, events, system) without touching the others.

> [!NOTE] Snoozing is per-notification and remembered, so the same thing will not keep coming back every hour.`,
    related: ['people.rel-rhythm', 'rhythm.followups', 'fix.no-notifications'],
  },

  /* ── notes & knowledge ───────────────────────────────────────────────────── */
  {
    id: 'notes.notes', cat: 'notes', title: 'Notes with contact links',
    summary: 'Markdown notes you can attach to the people they are about.',
    tags: ['note', 'markdown', 'writing', 'link', 'journal'], updated: '2026-09-24',
    body: `Notes are for the things a contact form cannot hold: how the meeting went, what they are worried about, what you promised.

## Linking a note to people
Attach contacts to a note and it becomes searchable from both sides — open the person and you will see every note they appear in.

## Markdown support
Headings, bold, italic, lists, checkboxes, inline \`code\`, code blocks, quotes and links all render. If you write in Markdown elsewhere, it will feel familiar.

> [!TIP] Write the note **while you are still in the room**, even if it is three lines. Details decay fast.`,
    related: ['notes.kb', 'people.contacts'],
  },
  {
    id: 'notes.kb', cat: 'notes', title: 'This knowledge base',
    summary: 'Search it, bookmark it, and write articles of your own.',
    tags: ['kb', 'help', 'docs', 'manual', 'guide', 'search'], updated: '2026-09-24',
    body: `Everything in the app is documented here, and it works entirely offline.

## Finding things
- **Type to search** — it searches titles, summaries, tags and the full text, and shows you *why* each result matched.
- **Browse by category** on the left.
- Press **/** to jump to the search box, **↑ ↓** to move, **Enter** to open, **Esc** to go back.
- **⌘K** also finds articles from anywhere in the app.

## Bookmarks
Star an article to pin it; your stars appear at the top of the home screen and are remembered on this device.

## Was this helpful?
The 👍 / 👎 at the foot of every article stores your vote locally. It tells us which articles need work the next time you are online with the developer.

## Write your own
**Your articles** are yours: meeting playbooks, scripts, templates, a personal CRM philosophy. They are stored with your data, so they travel in your backups, and they are searchable exactly like the built-in ones.

> [!TIP] Anything you find yourself explaining over and over belongs in *Your articles*.`,
    related: ['ref.glossary', 'ref.changelog', 'start.tour'],
  },

  /* ── data ────────────────────────────────────────────────────────────────── */
  {
    id: 'data.import', cat: 'data', title: 'Importing contacts (CSV & vCard)',
    summary: 'Bring in a phone export or spreadsheet with column mapping.',
    tags: ['import', 'csv', 'vcard', 'vcf', 'migrate', 'mapping'], updated: '2026-09-24',
    body: `Import handles two formats:

- **CSV** — anything exported from a spreadsheet, Gmail or another CRM.
- **vCard (.vcf)** — the standard phone-contacts export.

## How it goes
1. Pick the file.
2. **Map the columns** — match your spreadsheet's headers to name, phone, email, company, role and the rest. The app makes a sensible guess and you correct it.
3. **Preview** — see the first rows as they will land.
4. **Import** — duplicates are reported, not silently created.

## Afterwards
Run [Merging duplicates](article:people.merge) over anything the import flagged, then take a backup.

> [!TIP] Imports are additive — nothing is deleted. If an import goes wrong, restore the backup you took before it.`,
    related: ['data.backup', 'people.merge', 'fix.import-mapping'],
  },
  {
    id: 'data.backup', cat: 'data', title: 'Backup, restore & export',
    summary: 'One JSON file holds everything. Take one before anything risky.',
    tags: ['backup', 'restore', 'export', 'json', 'csv', 'safe'], updated: '2026-09-24',
    body: `Because your data lives on this device, **you are the backup**. That is the trade for having no server — and the file is small and plain.

## Full backup (JSON)
**Settings → Download all data** writes a single JSON file with contacts, tasks, notes, events, groups, tags, history, settings and your own knowledge-base articles.

**Restore** reads that file back. Restoring replaces what is on the device, so download the current state first if you are unsure.

## CSV export
Any list can be exported as CSV from its toolbar — useful for a spreadsheet or another tool, but **not** a complete backup (it will not contain notes or history).

## When to back up
- before an import;
- before a restore;
- before wiping;
- after a big cleanup session.

> [!WARN] Clearing browser site data, uninstalling the Android app, or using a private window erases everything on that device. The app cannot recover it for you — only your JSON can.`,
    related: ['data.sync', 'privacy.where-data-lives', 'fix.forgot-pin'],
  },
  {
    id: 'data.sync', cat: 'data', title: 'Multi-device sync (Gist & Drive)',
    summary: 'Optional, end-to-end sharing between your own devices.',
    tags: ['sync', 'gist', 'drive', 'device', 'conflict', 'multi'], updated: '2026-09-24',
    body: `Sync is **opt-in**. Turn it off and the app never touches the network.

## How it works
Your data is encrypted-at-rest in a single file you control:
- **GitHub Gist** — a secret gist only you can see; no OAuth round-trip needed, just a token.
- **Google Drive** — a file in your own Drive (app data folder).

On every sync the app compares its copy with the remote one and merges **field by field**: the newer change wins per record, not per file. That is why two devices can both be used offline and still converge.

## Conflicts
When both sides changed the same field, you get a **sync report** naming the records, and both versions are kept until you decide.

## First sync
The first time, one device establishes the **baseline**. Later devices join that baseline rather than overwriting it.

> [!TIP] Sync one device at a time on the first day. Let each finish before starting the next.`,
    related: ['data.google', 'fix.sync-conflicts', 'data.backup'],
  },
  {
    id: 'data.google', cat: 'data', title: 'Google hub: Calendar, Contacts & Drive',
    summary: 'Connect your own Google project for live calendar and Drive backup.',
    tags: ['google', 'calendar', 'drive', 'contacts', 'oauth', 'live'], updated: '2026-09-24',
    body: `Google features are **live-only**: they need your own Google Client ID, because there is no server of ours in the middle.

## Setup in short
1. Create a project in Google Cloud Console.
2. Enable the Calendar / Drive / People APIs you want.
3. Create an **OAuth client** for a web application and add the app's origin.
4. On Android, add the signing **SHA-1** — the build prints it.
5. Paste the Client ID into **Settings → Google hub**.

## What you get
- **Calendar** — import your events, and push birthdays and anniversaries into a calendar of your choosing.
- **Drive** — store the sync file in your own Drive instead of a Gist.
- **Contacts (CardDAV/People)** — see [CardDAV & ICS feeds](article:data.carddav).

> [!NOTE] Tokens live in memory only — they are never written to storage. Restarting the app signs you out.`,
    related: ['data.sync', 'data.carddav', 'data.backup'],
  },
  {
    id: 'data.carddav', cat: 'data', title: 'CardDAV & ICS feeds',
    summary: 'Talk to standard contact and calendar servers, read-only or push.',
    tags: ['carddav', 'ics', 'caldav', 'feed', 'server', 'standard'], updated: '2026-09-24',
    body: `For anything that is not Google, the app speaks the open standards.

## CardDAV
Point it at a CardDAV server (Nextcloud, Fastmail, iCloud, Radicale…) with a URL, username and password. Use **Test connection** first — the browser has to be allowed to reach that server, which is a server-side CORS setting.

## ICS feeds
Subscribe to any \`.ics\` URL — a sports fixture list, a public holiday calendar, a school term calendar. Feeds refresh on a schedule and their events appear alongside your own, clearly marked.

> [!WARN] Credentials for CardDAV are stored on this device in the browser's local storage. On a shared machine, prefer read-only feeds.`,
    related: ['data.google', 'data.sync', 'rhythm.calendar'],
  },
  {
    id: 'data.webhooks', cat: 'data', title: 'Webhooks & automations',
    summary: 'Fire an HTTP call when something happens, with a delivery log.',
    tags: ['webhook', 'automation', 'integration', 'zapier', 'log'], updated: '2026-09-24',
    body: `Webhooks let your CRM talk to whatever else you run — a home-automation box, a Zapier catch-hook, a spreadsheet service.

## Events you can listen for
- **New lead captured**
- **Contact added**
- **Task completed**
- **Contact marked as contacted**

## Setup
**Settings → Webhooks**: paste a URL, choose the events, and use **Send test** to confirm delivery. Every call is logged with its status so you can see what fired and when.

> [!WARN] A webhook is an outbound HTTP request from your device to a URL you chose. Only use endpoints you control — anything you send is visible to whoever runs that server.`,
    related: ['data.sync', 'privacy.what-we-send'],
  },

  /* ── privacy & security ──────────────────────────────────────────────────── */
  {
    id: 'privacy.where-data-lives', cat: 'privacy', title: 'Where your data lives',
    summary: 'On this device. No account, no server, no analytics.',
    tags: ['privacy', 'local', 'storage', 'offline', 'data'], updated: '2026-09-24',
    body: `Your entire CRM is a set of records in this device's local storage:

- **Web / PWA** — the browser's local storage for this site, on this device and browser profile.
- **Android app** — the app's private storage, sandboxed from other apps.

There is **no account**, so there is nowhere else it could be. Nothing is uploaded unless you explicitly turn on sync, connect Google, or add a webhook — and each of those is off by default.

## What that means in practice
- It works **offline**, always.
- Nobody can read it over the network, because it is not on one.
- **You are the backup.** See [Backup, restore & export](article:data.backup).
- Clearing site data or uninstalling removes it permanently.

> [!NOTE] "The cloud" here is a file *you* own in *your* Drive or a *secret* gist in *your* GitHub account. We never see it.`,
    related: ['privacy.what-we-send', 'data.backup', 'privacy.lock'],
  },
  {
    id: 'privacy.lock', cat: 'privacy', title: 'App lock (pincode)',
    summary: 'A 4–6 digit pincode, stored only as a salted hash.',
    tags: ['pin', 'lock', 'pincode', 'security', 'hash', 'session'], updated: '2026-09-24',
    body: `The app lock asks for a pincode **at every start** and after 15 minutes in the background.

## How it is stored
The code is combined with a random **salt** and hashed. Only the salt and the hash are saved — never the digits. That is why we cannot email you your pincode, and why a correct-looking guess is required.

## Changing or removing it
**Settings → App lock → Change pincode** needs the current code first. **Remove** also requires the current code, so a lost pincode cannot be used by someone else to switch the lock off.

## Sessions
Unlocking lasts for the session only — it is held in memory, not on disk. Reload the app and you are asked again.

> [!WARN] There is no recovery by design. If you forget the pincode, see [I forgot my pincode](article:fix.forgot-pin).`,
    related: ['fix.forgot-pin', 'privacy.where-data-lives', 'privacy.registration'],
  },
  {
    id: 'privacy.registration', cat: 'privacy', title: 'Registration & verification',
    summary: 'What you are asked for, and how a verification code reaches you.',
    tags: ['registration', 'verify', 'email', 'mobile', 'code', 'identity'], updated: '2026-09-24',
    body: `On first launch the app asks for your **name, email and mobile**. It is used for your greeting, for verification badges and for support. You may skip it.

## Verifying an email or mobile
**Settings → Identity → Verification** issues a 6-digit code. The app stores only a **salted hash** of the code, so the code exists for a short window and then only in the message you receive.

## How the message is delivered
There is no server of ours, so the app cannot send you an email or SMS by itself. Instead it prepares the message and hands it to a relay you configure. When no relay is configured, the app says so plainly and shows you the developer's address — it never invents a code or pretends one was sent.

## What is shared, if you verify
Name, email or mobile, the code, and a device label — sent to the relay you chose, and to the developer only when you have configured that. Nothing is shared when you do not verify.

> [!NOTE] Registration is stored on this device only. It is not an account and it does not sync unless you sync your data.`,
    related: ['privacy.what-we-send', 'privacy.where-data-lives'],
  },
  {
    id: 'privacy.what-we-send', cat: 'privacy', title: 'What leaves your device',
    summary: 'Nothing, until you switch something on. Then only what you chose.',
    tags: ['privacy', 'network', 'telemetry', 'tracking', 'offline'], updated: '2026-09-24',
    body: `Out of the box the app makes **no network requests** with your data. There is no analytics, no crash reporting, no telemetry — we cannot see how you use it, and we would rather keep it that way.

## Things that do reach the network (all off by default)
| Feature | What goes out | Where |
| --- | --- | --- |
| Multi-device sync | your data file | *your* Gist or Drive |
| Google hub | calendar/contact data | *your* Google account |
| CardDAV / ICS | credentials / feed URL | the server you configured |
| Webhooks | the event payload | the URL you configured |
| Verification | name, email/mobile, code | the relay you configured |

Each one needs a key, token or URL that only you can supply, and each can be switched off without losing your data.

> [!TIP] The honest answer to "where is my data?" is: on your device, in a file you can read, that we have never seen.`,
    related: ['privacy.where-data-lives', 'data.sync', 'data.webhooks'],
  },

  /* ── troubleshooting ─────────────────────────────────────────────────────── */
  {
    id: 'fix.forgot-pin', cat: 'fix', title: 'I forgot my pincode',
    summary: 'Why nobody can reset it, and what you can still do.',
    tags: ['pin', 'forgot', 'reset', 'lock', 'recover', 'wipe'], updated: '2026-09-24',
    body: `Because the pincode is stored only as a salted hash, **there is no recovery path** — not for us, not for anyone. That is the point of a local lock: a reset mechanism would be a back door.

## Your options
1. **Try the codes you actually use.** Most forgotten pincodes are a variation of a familiar one.
2. **Wait for the session.** If the app is still open and unlocked in the background, quickly take a backup (**Settings → Download all data**) before the 15-minute session expires.
3. **Wipe and restore.** Settings offers **Wipe everything**, which asks for the pincode. If you cannot supply it, the remaining route is to clear the app's data (or site data in the browser) and start fresh — then **restore your JSON backup**.

## After a wipe
Your data is gone from the device, so the restore is what brings it back. **This is the single strongest argument for taking regular backups.**

> [!WARN] Without a backup, a forgotten pincode means starting over. There is no support process that can change that, and any tool claiming otherwise should not be trusted with your data.`,
    related: ['privacy.lock', 'data.backup', 'privacy.where-data-lives'],
  },
  {
    id: 'fix.import-mapping', cat: 'fix', title: 'My import did not map correctly',
    summary: 'Fix header rows, merged name columns and split phone numbers.',
    tags: ['import', 'csv', 'mapping', 'columns', 'headers', 'fix'], updated: '2026-09-24',
    body: `Almost every import problem is one of four things.

## 1 · The header row is not row one
Exports often start with a title or a blank line. Delete everything above the real headers, or re-export with headers in row one.

## 2 · Names in one column
"First name" and "Last name" can be mapped separately. If your file has a single **Name** column, map it to name and let the app split it.

## 3 · Phone numbers losing their plus
A spreadsheet will happily turn \`+880 1711 853769\` into a number and mangle it. Format phone columns as **text** before exporting, or fix them after import with a quick edit.

## 4 · Dates in a local format
Use **YYYY-MM-DD** for birthdays and anniversaries. Anything else is a guess.

> [!TIP] Import into a scratch copy first — take a backup, import, check, and only then keep going.`,
    related: ['data.import', 'data.backup', 'people.merge'],
  },
  {
    id: 'fix.no-notifications', cat: 'fix', title: 'Notifications are not showing',
    summary: 'Preferences, snoozes, and how the in-app inbox actually works.',
    tags: ['notification', 'inbox', 'missing', 'quiet', 'prefs'], updated: '2026-09-24',
    body: `## First, what kind of notification?
This app has an **in-app inbox** (the bell in the sidebar) and, on Android, **system notifications**. They are related but not identical.

## In-app inbox is empty
1. **Settings → Notifications** — is the category switched on?
2. Are the items **snoozed**? Snoozed entries come back on their date, not before.
3. Are they **dismissed**? Dismissing is remembered.
4. **Follow-Ups** only fills up once contacts drift past their rhythm — a brand-new network produces very few notifications on day one.

## Nothing appears on the phone
- Android: Settings → Apps → Personal CRM → **Notifications** must be allowed.
- Battery optimisation can delay delivery; exempt the app if you want them on time.
- Web/PWA: the browser must have notification permission, and the page must be allowed to run in the background.

> [!NOTE] Notifications are computed from your data on this device. Nothing is scheduled on a server, so if the app never opens, nothing fires.`,
    related: ['rhythm.inbox', 'people.rel-rhythm', 'start.layout'],
  },
  {
    id: 'fix.sync-conflicts', cat: 'fix', title: 'Sync conflicts & how they resolve',
    summary: 'Field-level merging, baselines, and reading a sync report.',
    tags: ['sync', 'conflict', 'merge', 'baseline', 'report'], updated: '2026-09-24',
    body: `## How merging works
Sync is **field-level**: for each record, whichever side changed that field more recently wins. So an address edited on your phone and a note edited on your laptop both survive.

A **conflict** is reported only when the *same field* changed on both sides since the last sync. Then you get a report naming the record and the field, and both values are kept until you pick one.

## If things look wrong
1. Read the **sync report** — it names exactly what conflicted.
2. Take a **backup** on the device that looks correct.
3. Restore that backup on the other device, or re-establish the baseline by resetting sync on both and syncing the good device first.

## Preventing them
Sync before you start editing on a second device, then sync again when you stop. Conflicts happen when two devices edit the same field while both are offline for days.

> [!TIP] When in doubt, the newer backup wins — that is what the JSON file is for.`,
    related: ['data.sync', 'data.backup'],
  },
  {
    id: 'fix.calendar-empty', cat: 'fix', title: 'Calendar looks empty',
    summary: 'Birthdays, feeds and month navigation — what shows up and why.',
    tags: ['calendar', 'empty', 'birthday', 'feed', 'missing'], updated: '2026-09-24',
    body: `The calendar shows three kinds of thing: **events** you created, **birthdays/anniversaries** from your contacts, and **subscribed ICS feeds**.

## Nothing is showing
1. **Right month?** Use the month arrows — it opens on today.
2. **Do contacts have birthdays stored?** No birthday field, no birthday on the calendar.
3. **Feeds connected?** An ICS feed only appears once subscribed in Settings and fetched at least once.
4. **Google connected?** Importing your calendar is an explicit action in the Google hub.

## Some things are missing
- Anniversaries need the **anniversary** field — they are separate from birthdays.
- A feed may have failed to fetch; check its status in Settings.

> [!TIP] A calendar with only your own events in it is a calendar that is not doing much work. Fill in birthdays for the fifty people who matter and it fills up by itself.`,
    related: ['rhythm.calendar', 'rhythm.birthdays', 'data.carddav'],
  },
  {
    id: 'fix.migrating', cat: 'fix', title: 'Moving to a new phone or browser',
    summary: 'The five-minute move: backup, transfer the file, restore.',
    tags: ['migrate', 'new device', 'phone', 'transfer', 'move'], updated: '2026-09-24',
    body: `## The reliable way
1. On the **old** device: **Settings → Download all data**. You get one JSON file.
2. Move that file however you like — cable, email to yourself, cloud drive. It is just a file.
3. On the **new** device: install and open the app, then **Settings → Restore from backup** and pick the file.
4. Check **Contacts** count matches, then set up sync again (tokens do not travel).

## If you use sync
Even simpler: turn on sync on the old device, let it finish, then sign in on the new one and sync. The data arrives through *your* Gist or Drive — but **still take a local backup first**.

> [!WARN] The pincode is per-device. The new device starts without a lock, so set one up as soon as you restore.`,
    related: ['data.backup', 'data.sync', 'privacy.lock'],
  },

  /* ── reference ───────────────────────────────────────────────────────────── */
  {
    id: 'ref.glossary', cat: 'ref', title: 'Glossary of terms',
    summary: 'Every piece of jargon in the app, in plain language.',
    tags: ['glossary', 'terms', 'jargon', 'meaning', 'dictionary'], updated: '2026-09-24',
    body: `Hover any underlined term in the app for these definitions.

- **Rhythm** — how often you want to be in touch with someone. Drives follow-ups.
- **Touch** — one recorded interaction. Marking someone contacted resets their clock.
- **Follow-up** — a nudge that you have drifted past someone's rhythm.
- **Snooze** — hide a person or notification until a later date. Per-item and remembered.
- **Group** — a stable circle (Family, Clients, Leads). A contact can be in several.
- **Tag** — an ad-hoc label with a colour and icon, used for filtering.
- **Lead** — someone new you are still qualifying; the Lead rhythm is 7 days.
- **Introduced by** — who connected you to this person; powers the network graph.
- **Bridge** — in the graph, the one person linking two clusters.
- **Kanban** — the four task columns: To do, In progress, Waiting, Done.
- **Baseline** — the snapshot sync measures against when deciding what changed.
- **Conflict** — the same field changed on two devices between syncs.
- **Rev (revision)** — a counter that increments on every sync; how sync knows what is new.
- **Audit / History** — the running log of everything you changed.
- **Pincode** — the 4–6 digit app lock, stored only as a salted hash.
- **Session** — the period after unlocking; held in memory, never on disk.
- **PWA** — the installable web version; same data, no app store.
- **CardDAV** — the open standard for syncing contacts.
- **ICS** — the calendar file format used by subscriptions.
- **vCard (.vcf)** — the standard phone-contacts file.
- **Gist** — a small file hosted on GitHub; a *secret* gist is visible only to you.
- **Webhook** — an HTTP call your app makes when something happens.
- **Widget** — one card on the dashboard; reorder or hide them freely.`,
    related: ['notes.kb', 'ref.shortcuts', 'ref.faq'],
  },
  {
    id: 'ref.shortcuts', cat: 'ref', title: 'Keyboard shortcuts',
    summary: 'Move around without the mouse. Press ? any time.',
    tags: ['keyboard', 'shortcut', 'hotkey', 'fast', 'navigation'], updated: '2026-09-24',
    body: `Press **?** anywhere (when you are not typing) for this list. The **Guide** chip beside any screen title opens that screen's article.

## Everywhere
| Keys | Action |
| --- | --- |
| **⌘K** / **Ctrl K** | Global search |
| **?** | This shortcut list |
| **g** then **d** | Dashboard |
| **g** then **c** | Contacts |
| **g** then **t** | Tasks |
| **g** then **n** | Notes |
| **g** then **f** | Follow-Ups |
| **g** then **b** | Birthdays |
| **g** then **k** | Knowledge base |
| **Esc** | Close whatever is open |

## In the knowledge base
| Keys | Action |
| --- | --- |
| **/** | Focus search |
| **↑ ↓** | Move through results |
| **Enter** | Open the highlighted article |
| **←** | Back |
| **b** | Bookmark the open article |

## In dialogs
**Enter** confirms, **Esc** closes. In the pincode field, typing four digits jumps to the confirm field automatically.

> [!TIP] "g" stands for *go*. Press it, pause, then the letter — you have about a second and a half.`,
    related: ['start.tour', 'start.layout', 'notes.kb'],
  },
  {
    id: 'ref.changelog', cat: 'ref', title: "What's new",
    summary: 'Release notes, newest first.',
    tags: ['changelog', 'release', 'new', 'version', 'updates'], updated: '2026-09-24',
    body: `## 2026.09 · Knowledge & guidance
- **Knowledge base** — a searchable manual covering every screen, plus the ability to write articles of your own.
- **Tooltips** — hover or tap any control for an explanation; every tooltip can open the matching article.
- **Guided tour** — a spotlight walkthrough, replayable from the knowledge base.
- **Shortcut overlay** — press **?** for the full keyboard reference.
- **Go-mode navigation** — **g** then a letter jumps straight to a screen.
- **Glossary** — jargon is underlined in place and defined on hover.
- **Per-screen guides** — every screen title carries a **Guide** chip that opens the article about that screen.
- **Contextual tooltips** — hover any control for an explanation, with a link straight into the manual.
- **Mobile layout** — the sidebar is now a ☰ drawer on phones, layouts reflow down to 320px, and the pincode field no longer loses focus between digits.

## Earlier
- Registration with optional email/mobile verification.
- App lock (pincode) with salted-hash storage.
- Multi-device sync via Gist or Drive, with field-level merging.
- Google hub, CardDAV and ICS feeds.
- Quick Capture, network graph, analytics, dashboard widgets.`,
    related: ['notes.kb', 'ref.faq'],
  },
  {
    id: 'ref.faq', cat: 'ref', title: 'Frequently asked questions',
    summary: 'Short answers to the things people ask first.',
    tags: ['faq', 'questions', 'answers', 'help'], updated: '2026-09-24',
    body: `**Do I need an account?**
No. There is no account, and no way for us to see your data. See [Where your data lives](article:privacy.where-data-lives).

**Is it really offline?**
Yes — the whole app runs from local storage. Sync, Google, CardDAV and webhooks are all opt-in.

**Can I use it on my phone and laptop?**
Yes, with sync (Gist or Drive) — or by moving a JSON backup across. See [Multi-device sync](article:data.sync).

**Where is my data backed up?**
Wherever you put it. **Settings → Download all data** gives you the file. See [Backup, restore & export](article:data.backup).

**I forgot my pincode.**
Nobody can reset it, including us. See [I forgot my pincode](article:fix.forgot-pin).

**Can I get my data out?**
Always, in JSON (complete) or CSV (per list). It is your data.

**Does it send emails or SMS for me?**
No — there is no server. Verification prepares a message and hands it to a relay you configure; without one, nothing is sent and the app says so.

**How much does it cost / is there a subscription?**
This build is a one-time purchase. There is no subscription and no server to pay for.

**Who built it?**
BITSCOL — [www.bitscol.com](https://www.bitscol.com) · sales@bitscol.com · +880 1711-853769.`,
    related: ['notes.kb', 'ref.glossary', 'privacy.where-data-lives'],
  },
]

export const ARTICLE_BY_ID = Object.fromEntries(ARTICLES.map(a => [a.id, a]))

/* ── tooltips ────────────────────────────────────────────────────────────────
 * One registry powers every tooltip in the app. Add an entry here and any
 * element carrying data-tip="<id>" explains itself — no component changes.
 * `learn` points at the article that goes deeper. */
export const TIPS = {
  /* navigation */
  'nav.dashboard':   { title: 'Dashboard', body: 'Your day in one screen: what is due, who is drifting, what changed recently.', learn: 'start.layout' },
  'nav.contacts':    { title: 'Contacts', body: 'Everyone you know, with groups, tags and a rhythm for each.', learn: 'people.contacts' },
  'nav.tasks':       { title: 'Tasks', body: 'What you promised, on a four-column board. The badge counts what is due today or overdue.', learn: 'rhythm.tasks' },
  'nav.notes':       { title: 'Notes', body: 'Markdown notes, linkable to the people they are about.', learn: 'notes.notes' },
  'nav.email':       { title: 'Email', body: 'Connect a mailbox to see correspondence next to your contacts.' },
  'nav.calendar':    { title: 'Calendar', body: 'Your events plus every birthday and anniversary, worked out for you.', learn: 'rhythm.calendar' },
  'nav.birthdays':   { title: 'Birthdays', body: 'This month and next, with gift ideas you left yourself.', learn: 'rhythm.birthdays' },
  'nav.followups':   { title: 'Follow-Ups', body: 'Everyone past their rhythm, most overdue first. The badge is the overdue count.', learn: 'rhythm.followups' },
  'nav.inbox':       { title: 'Inbox', body: 'Notifications in one list — snooze, dismiss or jump straight to the person.', learn: 'rhythm.inbox' },
  'nav.groups':      { title: 'Groups', body: 'The stable circles: family, clients, leads. People can be in several.', learn: 'people.groups' },
  'nav.graph':       { title: 'Network', body: 'Who introduced whom — and who bridges two circles.', learn: 'people.graph' },
  'nav.analytics':   { title: 'Analytics', body: 'How your network is actually behaving over time.' },
  'nav.tags':        { title: 'Tags', body: 'Ad-hoc labels with colour and icon. Rename once, updates everywhere.', learn: 'people.tags' },
  'nav.import':      { title: 'Import', body: 'Bring in a CSV or vCard with column mapping and a preview.', learn: 'data.import' },
  'nav.history':     { title: 'History', body: 'Every change you made, in an audit log — including merges and restores.' },
  'nav.integrations':{ title: 'Integrations', body: 'Google, CardDAV, ICS feeds, sync backends and webhooks.' },
  'nav.settings':    { title: 'Settings', body: 'Identity, pincode, backups, sync, notifications and dashboard widgets.' },
  'nav.about':       { title: 'About', body: 'Version, licence, third-party notices, privacy and how to reach BITSCOL.' },
  'nav.knowledge':   { title: 'Knowledge base', body: 'The manual, searchable offline — plus articles of your own.', learn: 'notes.kb' },

  /* topbar */
  'topbar.menu':     { title: 'Menu', body: 'On phones the sidebar lives in here.', learn: 'start.layout' },
  'topbar.search':   { title: 'Global search', body: 'Find any contact, task, note, event, group or tag — and help articles too.', shortcut: '⌘K', learn: 'start.layout' },
  'topbar.theme':    { title: 'Theme', body: 'Switch between dark and light. Remembered on this device.' },
  'topbar.sync':     { title: 'Sync', body: 'Status of multi-device sync. Off until you configure a Gist or Drive backend.', learn: 'data.sync' },
  'topbar.add-contact': { title: 'Add contact', body: 'Full record: company, email, rhythm, birthday, notes.' },
  'topbar.add-task': { title: 'New task', body: 'Something you promised, with an optional person and due date.', learn: 'rhythm.tasks' },
  'topbar.add-event':{ title: 'New event', body: 'Put it on the calendar and link it to a person.', learn: 'rhythm.calendar' },

  /* contacts */
  'contacts.new':    { title: 'New contact', body: 'The full record. For speed, use the floating ⚡ Quick Capture instead.', learn: 'start.quick-capture' },
  'contacts.search': { title: 'Search', body: 'Matches name, role and company. Combine with a group, tag or rhythm filter.', learn: 'people.contacts' },
  'contacts.merge':  { title: 'Merge duplicates', body: 'Groups, tags and links move to the record you keep. Pick the better one as the survivor.', learn: 'people.merge' },
  'contacts.touch':  { title: 'Mark contacted', body: 'Resets the clock on their rhythm. Do it the moment you hang up.', learn: 'people.rel-rhythm' },
  'contacts.snooze': { title: 'Snooze', body: 'Hide them from Follow-Ups for 3, 7 or 30 days. Timing matters.', learn: 'rhythm.followups' },
  'contacts.rel':    { title: 'Relationship rhythm', body: 'How often you realistically want to be in touch. This is what makes follow-ups work.', learn: 'people.rel-rhythm' },
  'contacts.group':  { title: 'Groups', body: 'A person can belong to several circles at once.', learn: 'people.groups' },
  'contacts.tag':    { title: 'Tags', body: 'Free-form labels. Tag the reason you know someone, not just their category.', learn: 'people.tags' },

  /* tasks & rhythm */
  'tasks.todo':      { title: 'To do', body: 'Committed, not started.' },
  'tasks.progress':  { title: 'In progress', body: 'Actively working on it.' },
  'tasks.waiting':   { title: 'Waiting', body: 'Blocked on someone else. Keeps To do honest without losing the thread.', learn: 'rhythm.tasks' },
  'tasks.done':      { title: 'Done', body: 'Shipped. Cleared tasks still appear in History.' },
  'tasks.priority':  { title: 'Priority', body: 'High, medium or low — drives ordering and the notification tone.' },
  'followups.overdue': { title: 'Overdue', body: 'Days past the rhythm you set for this person.', learn: 'rhythm.followups' },

  /* capture & misc */
  'quickcapture.fab':{ title: 'Quick Capture', body: 'Name and number → saved as a lead in two taps. The badge counts this session.', learn: 'start.quick-capture' },
  'settings.lock':   { title: 'App lock', body: 'A 4–6 digit pincode at every start. Stored as a salted hash — unrecoverable by design.', learn: 'privacy.lock' },
  'settings.backup': { title: 'Backup', body: 'One JSON file with everything in it. Take one before anything risky.', learn: 'data.backup' },
  'settings.wipe':   { title: 'Wipe everything', body: 'Erases all local data and asks for your pincode first. Back up beforehand.', learn: 'fix.forgot-pin' },
  'settings.gist':   { title: 'Gist sync', body: 'A secret gist in your GitHub account — no OAuth round-trip, just a token.', learn: 'data.sync' },
  'kb.search':       { title: 'Search the manual', body: 'Titles, summaries, tags and full text. Press / to jump here.', shortcut: '/', learn: 'notes.kb' },
  'kb.bookmark':     { title: 'Bookmark', body: 'Pin this article to the top of the knowledge base home.', shortcut: 'b' },
  'kb.yours':        { title: 'Your articles', body: 'Write your own playbooks and templates. They are backed up with your data.', learn: 'notes.kb' },
  'kb.tour':         { title: 'Guided tour', body: 'A spotlight walkthrough of this screen. Esc quits at any step.', learn: 'start.tour' },
}

/* ── glossary (underlined in place, defined on hover) ─────────────────────── */
export const TERMS = {
  'rhythm':      { term: 'Rhythm', def: 'How often you want to be in touch with someone. Drives every follow-up.', learn: 'people.rel-rhythm' },
  'touch':       { term: 'Touch', def: 'One recorded interaction. Marking someone contacted resets their clock.', learn: 'people.rel-rhythm' },
  'follow-up':   { term: 'Follow-up', def: 'A nudge that you have drifted past someone’s rhythm.', learn: 'rhythm.followups' },
  'snooze':      { term: 'Snooze', def: 'Hide a person or notification until a later date. Per-item and remembered.', learn: 'rhythm.inbox' },
  'group':       { term: 'Group', def: 'A stable circle like Family or Clients. A person can be in several.', learn: 'people.groups' },
  'tag':         { term: 'Tag', def: 'An ad-hoc label with a colour and icon, used for filtering.', learn: 'people.tags' },
  'lead':        { term: 'Lead', def: 'Someone new you are still qualifying. The Lead rhythm is 7 days.', learn: 'start.quick-capture' },
  'introduced-by': { term: 'Introduced by', def: 'Who connected you to this person — it powers the network graph.', learn: 'people.graph' },
  'bridge':      { term: 'Bridge', def: 'In the network graph, the one person linking two separate circles.', learn: 'people.graph' },
  'kanban':      { term: 'Kanban', def: 'The four task columns: To do, In progress, Waiting, Done.', learn: 'rhythm.tasks' },
  'conflict':    { term: 'Conflict', def: 'The same field changed on two devices between syncs. Both values are kept until you choose.', learn: 'fix.sync-conflicts' },
  'baseline':    { term: 'Baseline', def: 'The snapshot sync measures against when deciding what changed.', learn: 'data.sync' },
  'rev':         { term: 'Revision', def: 'A counter that increments on every sync — how sync knows what is new.', learn: 'data.sync' },
  'audit':       { term: 'Audit log', def: 'The running history of every change you made.', learn: 'start.layout' },
  'pincode':     { term: 'Pincode', def: 'The 4–6 digit app lock, stored only as a salted hash.', learn: 'privacy.lock' },
  'session':     { term: 'Session', def: 'The period after unlocking. Held in memory, never written to disk.', learn: 'privacy.lock' },
  'pwa':         { term: 'PWA', def: 'The installable web version — same data, no app store involved.', learn: 'privacy.where-data-lives' },
  'carddav':     { term: 'CardDAV', def: 'The open standard for syncing contacts with a server.', learn: 'data.carddav' },
  'ics':         { term: 'ICS', def: 'The calendar file format used by subscriptions and exports.', learn: 'data.carddav' },
  'vcard':       { term: 'vCard', def: 'The standard phone-contacts file, usually a .vcf.', learn: 'data.import' },
  'gist':        { term: 'Gist', def: 'A small file hosted on GitHub. A secret gist is visible only to you.', learn: 'data.sync' },
  'webhook':     { term: 'Webhook', def: 'An HTTP call your app makes to a URL you chose when something happens.', learn: 'data.webhooks' },
  'widget':      { term: 'Widget', def: 'One card on the dashboard. Reorder or hide them freely.', learn: 'start.layout' },
  'csv':         { term: 'CSV', def: 'A plain-text spreadsheet format — good for moving lists, not for backups.', learn: 'data.import' },
}

/* ── keyboard shortcuts (documented and live) ─────────────────────────────── */
export const SHORTCUTS = [
  { keys: ['⌘', 'K'], alt: ['Ctrl', 'K'], label: 'Global search', hint: 'Contacts, tasks, notes, events — and help' },
  { keys: ['?'], label: 'Shortcuts & help', hint: 'This list, plus links into the knowledge base' },
  { keys: ['g', 'd'], label: 'Go to Dashboard', group: 'Go' },
  { keys: ['g', 'c'], label: 'Go to Contacts', group: 'Go' },
  { keys: ['g', 't'], label: 'Go to Tasks', group: 'Go' },
  { keys: ['g', 'n'], label: 'Go to Notes', group: 'Go' },
  { keys: ['g', 'f'], label: 'Go to Follow-Ups', group: 'Go' },
  { keys: ['g', 'b'], label: 'Go to Birthdays', group: 'Go' },
  { keys: ['g', 'k'], label: 'Go to Knowledge base', group: 'Go' },
  { keys: ['g', 's'], label: 'Go to Settings', group: 'Go' },
  { keys: ['/'], label: 'Search the knowledge base', group: 'Knowledge base' },
  { keys: ['↑', '↓'], label: 'Move through results', group: 'Knowledge base' },
  { keys: ['Enter'], label: 'Open the highlighted article', group: 'Knowledge base' },
  { keys: ['b'], label: 'Bookmark the open article', group: 'Knowledge base' },
  { keys: ['Esc'], label: 'Close dialog, drawer or article', group: 'Everywhere' },
]

/* ── guided tour steps ────────────────────────────────────────────────────── */
export const TOUR_STEPS = [
  { sel: '[data-tour="menu"]',     title: 'Your menu', body: 'Everything lives in here. On a phone it is the ☰ button; on a desktop the sidebar is always open.' },
  { sel: '[data-tour="search"]',   title: 'Find anything fast', body: 'Press ⌘K (or Ctrl K) to search contacts, tasks, notes, events and the manual.' },
  { sel: '[data-tour="widgets"]',  title: 'Your day', body: 'This dashboard is yours to arrange — reorder the cards, or hide the ones you never read.' },
  { sel: '[data-tour="quickadd"]', title: 'Quick adds', body: 'Create a contact, task or event without leaving the page you are on.' },
  { sel: '[data-tour="fab"]',      title: 'Quick Capture', body: 'The fastest possible add: name and number, saved as a lead. Use it while you are still talking to them.' },
  { sel: '[data-tour="help"]',     title: 'Help is everywhere', body: 'Hover any control for an explanation, press ? for shortcuts, or open the knowledge base for the full manual.' },
]

/* ── which article explains which screen ──────────────────────────────────────
 * SectionHead reads this, so every screen gets a "Guide" chip for free. */
export const SCREEN_GUIDE = {
  '/':               'start.layout',
  '/contacts':       'people.contacts',
  '/tasks':          'rhythm.tasks',
  '/notes':          'notes.notes',
  '/calendar':       'rhythm.calendar',
  '/birthdays':      'rhythm.birthdays',
  '/follow-ups':     'rhythm.followups',
  '/notifications':  'rhythm.inbox',
  '/groups':         'people.groups',
  '/graph':          'people.graph',
  '/analytics':      'start.layout',
  '/tags':           'people.tags',
  '/import':         'data.import',
  '/integrations':   'data.sync',
  '/settings':       'data.backup',
  '/knowledge':      'notes.kb',
}

/* ── search ───────────────────────────────────────────────────────────────── */
const strip = s => (s || '').toLowerCase().replace(/[#*`>|\-_[\]()]/g, ' ')

/** Tokenised, weighted search over an article list. Returns articles with a
 *  `score`, plus the snippet of body text that matched (for the "why" line). */
export function searchArticles(articles, query, { cat = 'all', limit = 40 } = {}) {
  const q = (query || '').trim().toLowerCase()
  const pool = cat === 'all' ? articles : articles.filter(a => a.cat === cat)
  if (!q) return pool.slice(0, limit).map(a => ({ a, score: 0, why: '' }))

  const terms = q.split(/\s+/).filter(Boolean)
  const out = []
  for (const a of pool) {
    const title = (a.title || '').toLowerCase()
    const summary = (a.summary || '').toLowerCase()
    const tags = (a.tags || []).join(' ').toLowerCase()
    const body = strip(a.body)
    let score = 0, hitAll = true, why = ''

    for (const t of terms) {
      let s = 0
      if (title.includes(t)) s += title.startsWith(t) ? 40 : 22
      if (tags.includes(t)) s += 14
      if (summary.includes(t)) s += 10
      if (body.includes(t)) s += 5
      if ((a.id || '').includes(t)) s += 8
      if (!s) { hitAll = false; break }
      score += s
      if (!why && body.includes(t)) {
        const i = body.indexOf(t)
        why = a.body.slice(Math.max(0, i - 60), i + 90).replace(/\s+/g, ' ').trim()
      }
    }
    if (!hitAll) continue
    if (!why) why = a.summary || ''
    out.push({ a, score, why })
  }
  return out.sort((x, y) => y.score - x.score || x.a.title.localeCompare(y.a.title)).slice(0, limit)
}

/** Articles that share a category or a tag with the given one. */
export function relatedTo(article, all = ARTICLES, n = 4) {
  if (!article) return []
  const scored = all
    .filter(a => a.id !== article.id)
    .map(a => {
      let s = 0
      if (a.cat === article.cat) s += 3
      s += (a.tags || []).filter(t => (article.tags || []).includes(t)).length * 2
      if ((article.related || []).includes(a.id)) s += 6
      return { a, s }
    })
    .filter(x => x.s > 0)
    .sort((x, y) => y.s - x.s)
  return scored.slice(0, n).map(x => x.a)
}

/** Word count and a rough reading time for an article body. */
export const readingTime = body => {
  const words = (body || '').replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length
  return { words, minutes: Math.max(1, Math.round(words / 220)) }
}
