# Welcome & first-launch onboarding

## Welcome window (no profile yet)

Shown once on a brand-new install (`profile === null`):

| Path | What happens |
|---|---|
| **I'm new — start fresh** | Identity form (skippable) → sample CRM → guided tour → demo choice |
| **Restore a backup** | Plain `.json` or encrypted `.pcrm.json` → CRM opens with restored data |
| **Connect with Google** | Paste OAuth Client ID → live connect → identity (optional) |
| **Multi-device sync via GitHub Gist** | Paste gist-scoped PAT → pull/push sync file → open |
| **Skip setup** | Sample CRM immediately |

Everything is local. Google / Gist only talk to backends the user controls.

## Post-tour demo choice

After the **first** completed guided tour on a cold install (seed data still loaded):

- **Continue with demo data** — keep exploring; wipe later in Settings
- **Reset — wipe demo data** — clears contacts/tasks/notes/events/tags/groups/…  
  **Keeps** profile, pincode, licence, Google/Gist tokens

Flags in `helpPrefs`:

- `hasDemoData` — seed still present
- `demoChoiceDone` — prompt answered (or migrated / restored / synced)

Returning installs migrate with `demoChoiceDone: true` so the prompt never reappears.
