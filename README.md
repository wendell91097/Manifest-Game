# Manifest

**Live prototype:** https://manifest-henna.vercel.app/

Narrative strategy game set in the 1800s American West. Built in React. Part of a larger game design project documented at the [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/).

---

## What This Is

A newspaper-desk strategy game. You are a landowner at the crossroads of everything America is becoming. Three people — Esperanza Vallejo, Solomon Reed, and J.T. Whitmore — are watching what you do. Every season you make decisions. Every decision moves something. Some of what you set in motion won't land for years.

This is a prototype. It proves the threshold system works. The full scope — fifty years, a larger guest roster, the compounding newspaper mechanic — is still ahead.

---

## How It Works

**Stars** are the three primary characters. Each tracks multiple named Passions independently.

**Passions** run from -100 to +100. Nine named bands:

| Band | Range |
|---|---|
| Devoted | 75 to 100 |
| Steadfast | 50 to 75 |
| Trusted | 30 to 50 |
| Favorable | 15 to 30 |
| Neutral | -15 to 15 |
| Strained | -30 to -15 |
| Opposed | -50 to -30 |
| Hostile | -75 to -50 |
| Irreconcilable | -100 to -75 |

Each band is a behavioral state, not a number. Crossing a threshold changes what that person does in the world — concretely, legibly, with downstream consequences. The overall relationship with each Star is a **Macropassion** label, derived from the average across all their Passions: from *Known Acquaintance* at neutral to *Bound Ally* or *Sworn Enemy* at the extremes.

**Reputation** tracks Fame and Infamy independently for each Star. High Fame and high Infamy together produce a different named reputation than either alone — you can be well-known and dangerous at the same time. These combine into four named reputation states per Star (e.g. *Known Paradox*, *Honored Neighbor*, *Dangerous Debtor*, *Quiet Stranger* for Esperanza).

**Seasons** advance on the player's call. The Decisions column shows what requires your hand this season. The Chronicle logs everything in period voice. The Persons column tracks where each Star stands across all their Passions.

**Ruin** is possible through three paths: a single Star's Infamy reaching 65, two Stars' Infamy both reaching 45, or all Passions for a single Star falling below -50. The game ends early with a final Chronicle entry.

---

## Systems

### Actions
Each decision is tied to a source Star and an availability window. Effects move Passion values and Fame/Infamy scores across multiple Stars simultaneously. Serving one person usually costs another. Some actions expire if left unanswered.

### Deferred Consequences
Most actions plant a deferred outcome that fires years later in the Chronicle — a Sacramento court ruling, a railroad decision, a territorial record becoming permanent. The deferred entry arrives regardless of what you do afterward. What you decided in 1812 is still in the newspaper in 1819.

### Reactive Events
When a Passion crosses a threshold, a reactive event fires automatically. These appear in the Chronicle as news items, apply secondary effects, and can unlock new actions. Esperanza's trust crossing -50 files a formal complaint against you. Solomon's Autonomy crossing -50 closes the post to your accounts. Whitmore's standing crossing 75 gets him promoted to District Supervisor with expanded authority.

### Convergence Events
When conditions across multiple Stars are simultaneously met, a forced choice appears as a modal. These present direct confrontations between Star interests that cannot be avoided or deferred. The Northern Boundary confrontation fires when both Esperanza's Land Security and Whitmore's Route Completion are above 30 — they call on you in the same week regarding the same strip of land. You must choose.

### Transient Guests
One-off visitors arrive for a window of seasons. The player must respond before advancing the season or they depart unanswered. Unanswered guests are recorded in the Crossroads ledger. Guest choices affect Fame and Infamy and add Chronicle entries with or without the player's name attached, depending on the choice made.

### Hidden Passions
Some Passions are not visible at the start. Solomon's Brotherhood Passion — his search for his brother Caleb, missing since the Nevada silver rush — is hidden until the Macropassion average for Solomon reaches 30. It cannot be acted on until it is visible.

### World Dispatches
Historical events arrive in the Chronicle regardless of player action, dated and dateline-attributed to period newspapers. The War of 1812, the Missouri Compromise, Jackson's election, the founding of the Anti-Slavery Society, Texas independence, the Mexican-American War, the Gold Rush. These are texture, not mechanics — but they frame what your decisions mean in their moment.

---

## The Stars

**Esperanza Vallejo — Land Grant Heir**
Passions: Land Security, Anglo Distrust, Coalition Strength.
She represents 47 people whose livelihoods depend on the Vallejo grant. At Devoted on Land Security she names you publicly as a protector of the old grants. At Devoted on Anglo Distrust she tells you things she tells no one else. At Irreconcilable on either, she pursues you in court by name and tells people what you did.

**Solomon Reed — Freedman & Trader**
Passions: Permanence, Independence, Brotherhood (hidden).
He built something in this valley with no safety net and no federal protection. At Devoted on Permanence he lists you as a trusted partner in territorial filings. At Devoted on Independence he shares routes and contacts he shares with very few. At Irreconcilable he relocates the post's most valuable operations beyond your reach.

**J.T. Whitmore — Railroad Surveyor**
Passions: Route Completion, Company Standing, Claim Dominance.
Pacific Railroad's man in the valley, with 89 people's livelihoods running through the company. At Devoted on Company Standing he names you in his reports as instrumental — the company knows you. At Devoted on Claim Dominance he treats your land as an extension of the railroad's protected zone. At Irreconcilable he brings the full weight of Pacific Railroad's legal office against you.

---

## Stack

- React 19
- Vite
- No external UI libraries — all styling is inline
- Deployed on Vercel

---

## Running Locally

```bash
npm install
npm run dev
```

---

## Design Notes

The design question this prototype answers: does the threshold system produce meaningful decisions? A tension between Stars that can't be resolved by optimizing all three simultaneously — where serving Esperanza's land interests obstructs Whitmore's corridor, backing Solomon's independence complicates the railroad's commercial ambitions, and the deferred consequences of early decisions keep arriving regardless of what you do next.

That's what this prototype is for.

The full design document is in the [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/) under Game Concepts → GC-003.

---

## Contact

wendell91097@gmail.com · [sovereigndev.itch.io](https://sovereigndev.itch.io) · [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/)
