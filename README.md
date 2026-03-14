# Manifest

**Live prototype:** https://manifest-henna.vercel.app/

Narrative strategy game set in the 1800s American West. Built in React as a playable proof-of-concept of Ken Levine's [Narrative Legos](https://www.gdcvault.com/play/1020243/Narrative) design framework. Part of a larger game design project documented at the [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/).

---

## What This Is

A game about the consequences of your actions. You are a landowner at the crossroads of everything America is becoming. Three people — Esperanza Vallejo, Solomon Reed, and J.T. Whitmore — are watching what you do. Every season you make decisions. Every decision moves something. What you set in motion will ripple forward with each passing season.

Everything is recorded in the Chronicle — a period newspaper that prints what happened, including what you didn't do. The aesthetic is ink and parchment. The ledger is permanent.

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

Each band is a behavioral state, not a number. Crossing a threshold changes what that person does in the world — concretely, legibly, with downstream consequences. The overall relationship with each Star is a **Macropassion** label, derived from the average across all their Passions. Nine named states cover the full range:

| Macropassion | Average |
|---|---|
| Bound Ally | 75 to 100 |
| Steadfast Friend | 50 to 75 |
| Trusted Ally | 30 to 50 |
| Cautious Friend | 15 to 30 |
| Known Acquaintance | -15 to 15 |
| Wary Stranger | -30 to -15 |
| Open Opponent | -50 to -30 |
| Active Adversary | -75 to -50 |
| Sworn Enemy | -100 to -75 |

**Reputation** tracks Fame and Infamy independently for each Star. These measure political relevance — how much you currently register in each Star's world — not a permanent ledger. They combine into four named reputation states per Star (e.g. *Known Paradox*, *Honored Neighbor*, *Dangerous Debtor*, *Quiet Stranger* for Esperanza). Both values decay each season without active maintenance and compound on the way up via a logarithmic curve — described further under Systems.

**Seasons** advance on the player's call. The Decisions column shows what requires your hand this season. The Chronicle logs everything in period voice. The Persons column tracks where each Star stands across all their Passions.

**Ruin** is possible through three paths: a single Star's Infamy reaching 65, two Stars' Infamy both reaching 45, or all Passions for a single Star falling below -50. The game ends early with a final Chronicle entry. Fame buffers the first two paths — a Star who has publicly vouched for you has skin in the game and won't move to destroy you while that investment holds. Ruin is suppressed as long as your Fame with that Star is at least 80% of your Infamy.

---

## Systems

### Actions
Each decision is tied to a source Star and an availability window. Effects move Passion values and Fame/Infamy scores across multiple Stars simultaneously. Serving one person usually costs another. Some actions expire if left unanswered.

### Repair and Betrayal
Some actions only surface after prior damage or prior trust has been established. Repair actions are gated behind Passion thresholds — they exist to give players a costly path back from a bad position, not a cheap undo. Betrayal actions work the opposite way: they only appear once a Passion is high enough that there's something real to exploit. Using someone's trust as an instrument against them is an available move, with consequences that reflect what it actually means.

### Fame & Infamy
Fame and Infamy don't accumulate permanently — they measure how much you currently matter to each Star's world. Both values are whole numbers between 0 and 100.

**Decay.** Each season, both values fall at a rate inverse to their current level. Low values fade quickly; high values carry inertia and barely move. Going quiet with a Star is a viable survival strategy when Infamy is moderate, but once notoriety is entrenched it can no longer be waited out — decay slows almost to nothing, and you are forced to act rather than disappear.

**Compounding.** Gains scale logarithmically with your current level, following the same equal-ratio property as the Richter scale: each equal interval of value multiplies incoming gains by the same factor. At low values the modifier is nearly imperceptible — 20 Fame adds roughly 6% to further Fame gains. At high values the acceleration becomes significant — 80 Infamy adds roughly 59% to further Infamy gains, and 100 adds 100%. Early accumulation is relatively cheap; the upper range becomes self-reinforcing fast. Losses are never amplified; only gains compound.

### Passion Neglect
Relationships not actively tended lose ground slowly. Each season, the game scans the last eight log entries for each Star. If none of those entries involved that Star's effects, their positive Passions drift down by 1 point. Only positive Passions decay this way — negative ones require active repair to shift. The floor is 0. Neglect can fully erode what you built, but gradually.

### Deferred Consequences
Most actions plant a deferred outcome that fires years later in the Chronicle — a Sacramento court ruling, a railroad decision, a territorial record becoming permanent. The deferred entry arrives regardless of what you do afterward. What you decided in 1812 is still in the newspaper in 1819.

### Reactive Events
When a Passion crosses a threshold, a reactive event fires automatically. These appear in the Chronicle as news items, apply secondary effects, and can unlock new actions. Crossing thresholds in either direction can trigger events — positive ones open doors, negative ones close them. Esperanza's trust crossing -50 files a formal complaint against you; crossing +50 grants access to the coalition's private archive and unlocks new strategic options. Solomon's Autonomy crossing -50 restricts your access to the post; his Brotherhood Passion crossing +50 opens contact with his brother's Nevada network. Whitmore's standing crossing +75 gets him promoted to District Supervisor with expanded authority; his Corridor Claim falling below -50 draws a company auditor north.

### Convergence Events
When conditions across multiple Stars are simultaneously met, a forced choice appears as a modal. These present direct confrontations between Star interests that cannot be avoided or deferred. Four convergence events are in the prototype.

The **Northern Boundary** confrontation fires when both Esperanza's Land Security and Whitmore's Corridor Claim are above 30 — they call on you in the same week regarding the same strip of land. You must choose.

The **Unlikely Meeting** fires when Solomon's Independence (in either direction, ≥30 in absolute value) and Esperanza's Coalition Strength are both above 30 — each has come to see something the other has, and you are the only person both of them trust. Whether to broker that alliance is yours to decide.

The **Surveyor's Letter** fires when both of Whitmore's visible Passions are above 30 — he asks you, off the record, to help him write to his wife in Cincinnati. He also needs your name on a corridor extension before the month ends. He doesn't connect the two requests out loud. He doesn't have to. Three choices are available: help with the letter first, push him to the filing first, or attempt both badly.

**Three Letters in One Week** fires when all three Stars' Macropassion averages (in absolute value) reach 20 — meaning each relationship has moved meaningfully in some direction. All three call on you in the same week with urgent, incompatible needs. You can only answer one. The choice text changes depending on your prior history with Solomon's warehouse loan, making this the most context-sensitive moment in the prototype.

### Transient Guests
One-off visitors arrive for a window of seasons. The player must respond before advancing the season or they depart unanswered. Unanswered guests are recorded in the Homestead ledger. Guest choices affect Fame and Infamy and add Chronicle entries with or without the player's name attached, depending on the choice made.

### Hidden Passions
Some Passions are not visible at the start. Both Solomon and Whitmore each carry one hidden Passion that reveals only once the Macropassion average reaches 15 — the *Cautious Friend* threshold. Once revealed, a hidden Passion stays visible permanently; a subsequent dip in the average can't hide knowledge already earned.

Solomon's **Brotherhood** Passion tracks his search for his brother Caleb, missing since the Nevada silver rush. Whitmore's **The Distance** Passion tracks his relationship with his wife Margaret in Cincinnati — the months that have become years, and what that silence is costing both of them. Neither can be acted on until it surfaces.

### Hidden Passion Reveal
When a hidden Passion first becomes visible, a modal interrupts play before the game continues. Each reveal is a short piece of first-person narration — the character letting something slip that they normally keep close — rather than a system notification. The dialogue body is time-aware: it calculates elapsed years from a fixed historical anchor (Caleb left for Nevada in 1809; Whitmore arrived in the valley in 1811) and writes the duration in natural language. A reveal that fires in 1814 reads differently from one that fires in 1822. Once dismissed, the Passion appears in the Star card permanently. The modal closes with a single continue button and leaves a signal that there may be something the player can do about what they just heard.

### World Dispatches
Historical events arrive in the Chronicle regardless of player action, dated and dateline-attributed to period newspapers. The War of 1812, the Missouri Compromise, Jackson's election, the founding of the Anti-Slavery Society, Texas independence, the Mexican-American War, the Gold Rush. These are texture, not mechanics — but they frame what your decisions mean in their moment.

### Chronicle Display
The Chronicle groups all entries under a single season header per year and season. Every entry from 1812, Spring — an inaction consequence, a world dispatch, a reactive event — appears under one shared header with the season symbol and date, rather than repeating the date on each card. Deferred consequences (⚡) and narrative events (◈) retain their type indicators within the group. The current season is marked with a ● New badge on the group header.

---

## The Stars

**Esperanza Vallejo — Land Grant Heir**
Passions: Land Security, Anglo Distrust, Coalition Strength.
She represents 47 people whose livelihoods depend on the Vallejo grant. At Devoted on Land Security she names you publicly as a protector of the old grants. At Devoted on Anglo Distrust she tells you things she tells no one else. At Irreconcilable on either, she pursues you in court by name and tells people what you did.

**Solomon Reed — Freedman & Trader**
Passions: Permanence, Independence, Brotherhood (hidden).
He built something in this valley with no safety net and no federal protection, with 31 people who orbit his post and have no other reliable anchor in the valley. At Devoted on Permanence he lists you as a trusted partner in territorial filings. At Devoted on Independence he shares routes and contacts he shares with very few. At Irreconcilable he relocates the post's most valuable operations beyond your reach.

**J.T. Whitmore — Railroad Surveyor**
Passions: Corridor Claim, Company Standing, The Distance (hidden).
Pacific Railroad's man in the valley, with 89 people's livelihoods running through the company. At Devoted on Company Standing he names you in his reports as instrumental — the company knows you. At Devoted on Corridor Claim he treats your land as an extension of the railroad's protected zone. The Distance is his relationship with his wife Margaret in Cincinnati, invisible until the relationship is deep enough to reveal it. At Irreconcilable he brings the full weight of Pacific Railroad's legal office against you.

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

Manifest is a direct implementation of Ken Levine's [Narrative Legos](https://www.gdcvault.com/play/1020243/Narrative) framework, presented at GDC. The core thesis: narrative doesn't lend itself to systems because traditional narrative is linear, but if you break it into its smallest non-abstract elements — Stars, Passions, transparent triggers — you can build a nearly infinite array of narrative outcomes from a limited set of parts.

The framework maps onto Manifest like this:

- **Stars and Passions** — Levine's Frank the Orc translated into Esperanza, Solomon, and Whitmore, each with a small set of motivations the player can act on or against
- **Macropassion as aggregation** — a named relationship state derived from the average of all Passions, with behavioral thresholds rather than raw numbers
- **Zero-sum tension** — Levine's Frank-and-Pete problem: two Stars who can't both be fully served, where the northern boundary dispute forces a direct confrontation between Esperanza's land claim and Whitmore's federal filing
- **Transparency** — every effect surfaces a plain-language `why`, keeping triggers legible rather than opaque
- **Hidden Passions** — Solomon's Brotherhood Passion (his search for his missing brother) and Whitmore's The Distance (his marriage strained by years in the field) are both invisible until the relationship is deep enough to reveal them, exactly as Levine describes

Deferred consequences — decisions planting Chronicle entries that fire years later — extend beyond the talk. Levine didn't address time-delayed outcomes; that's the original design contribution this prototype adds to the framework.

Levine also left open the question of endpoints: when does the game end — when everything is destroyed, or everything is perfect? Manifest answers with the Ruin system: three distinct failure paths based on Infamy accumulation and Passion collapse, rather than a single win condition. The Fame buffer adds a further dimension: the same Infamy that ruins you with a stranger may not be enough to move a Star whose public reputation is tied to yours.

The design question the prototype answers: does the threshold system produce meaningful tension? Can you build something where serving one person genuinely costs you with another — not as a stat penalty, but as a story?

It does. That's what the prototype is for.

The full design document is in the [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/) under Game Concepts → GC-003.

---

## Prototype Scope and Known Gaps

The prototype proves what it sets out to prove: the threshold system produces meaningful tension, deferred consequences land, and the Narrative Legos framework scales to a multi-Star setting. The gaps below are documented as design work, not bugs.

**No resolution.** The game timeline runs to 1848 and the Gold Rush arrives as a world dispatch — but the game continues without synthesis. For a system built around long-term consequence, there's no final Chronicle entry that pulls the threads together, no moment where the player understands what they built or lost. Even a ruin-equivalent for positive outcomes would change the player's relationship to every earlier decision.

**Action density collapses after 1824.** The last core action is in 1824. The back quarter of the game is passive — world dispatches and quiet seasons, but no new player decisions. The deferred consequences from earlier actions are still firing, but the player has no agency in the final twenty-four years.

**The Distance doesn't arc.** Whitmore's hidden Passion about his wife in Cincinnati has presence early and appears in one convergence event, but has no quest chain and no structural payoff. Brotherhood builds — `hold_letter` → `find_brother` → `introduce_caleb` → `nevada_contacts`. The Distance doesn't, which makes it feel like flavor rather than system.

**The fourth convergence event's trigger is invisible.** Three Letters in One Week fires when all three Stars' absolute Macropassion values reach 20. The player can see individual Passion bars and Macropassion labels, but the combined cross-Star condition is never displayed. The other three convergence events have legible triggers. This one will arrive unexpectedly and won't arrive when waited for.

**The guests run parallel to the main narrative.** The Comanche traveler and Isaiah Drum are the most morally serious scenes in the prototype. Their mechanical connection to the main narrative is thin — small Fame deltas, minor Passion movements. They were written at a level of moral weight the current integration doesn't use. Guest outcomes could feed convergence event conditions or reactive event triggers; currently they don't.

**The Chronicle doesn't support cause-and-effect navigation.** The deferred consequence mechanic's power is the link between a past decision and a future outcome. Once thirty or forty entries have accumulated, tracing those links requires finding the original entry in the scroll. The "consequence of" attribution text helps, but not enough. This is the known gap the "compounding newspaper mechanic" is meant to address in the full version.

---

## Contact

wendell91097@gmail.com · [sovereigndev.itch.io](https://sovereigndev.itch.io) · [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/)
