# Manifest

**Live prototype:** https://manifest-henna.vercel.app/

Narrative strategy game set in the 1800s American West. Built in React as a playable proof-of-concept of Ken Levine's [Narrative Legos](https://www.gdcvault.com/play/1020243/Narrative) design framework. Part of a larger game design project documented at the [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/).

\---

## What This Is

A game about the consequences of your actions. You are a landowner at the crossroads of everything America is becoming. Three people — Esperanza Vallejo, Solomon Reed, and J.T. Whitmore — are watching what you do. Every season you make decisions. Every decision moves something. What you set in motion will ripple forward with each passing season.

Everything is recorded in the Chronicle — a period newspaper that prints what happened, including what you didn't do. The aesthetic is ink and parchment. The ledger is permanent.

This is a prototype. It proves the threshold system works. The full scope — fifty years, a larger guest roster, the compounding newspaper mechanic — is still ahead.

\---

## A Framework for Narrative Legos

Manifest is built on Ken Levine's [Narrative Legos](https://www.gdcvault.com/play/1020243/Narrative) thesis: break narrative down to its smallest non-abstract elements — Stars, Passions, transparent triggers — and you can generate a nearly infinite array of story outcomes from a limited set of parts. The engine here is a direct implementation of that framework, and it is fully scenario-agnostic.

Everything setting-specific lives in a `SCENARIO` config object and four data arrays: `INITIAL\_STARS`, `ACTIONS`, `CONVERGENCE\_EVENTS`, and `WORLD\_DISPATCHES`. Replace those and you have a different game. The reducer, the threshold system, the fame/infamy mechanics, ruin, win conditions, deferred consequences, hidden passions, convergence events — none of it knows it is in 1810 California. It knows it has Stars, Passions, and a tick counter.

The underlying problem is identical across every setting: you are one node in a web of powerful actors with incompatible interests, time passes, and your decisions compound. The engine works anywhere that description holds. In every case, each Star represents not just themselves but a constituency — a community, a faction, a network of people whose interests move with them. When a Star turns against you, it is never just one person. To illustrate:

A **Greek temple administrator** whose Stars are the gods themselves — Athena's constituency is every craftsman, soldier, and philosopher who prays at her altar; Ares's is every army in the field; Hades's is the dead, who are patient and numerous. The inter-Star passions are already written in mythology. When Athena and Ares are both watching what you do, neutrality is not available. A **Roman senator** in the late Republic — the equestrian merchant class who funded his campaign, the plebeian tribal assembly whose votes he needs, and the patrician faction that will destroy him the moment he stops being useful. The **Greek city-states** at the edge of the Persian Wars — the Athenian democratic assembly, the Spartan ephors speaking for the agoge and its warriors, and the Theban Sacred Band whose allegiance could decide the peninsula. **Aztec Mexico** before contact — the tribute-collecting military caste, the priesthood whose calendar determines when wars are permitted, the pochteca merchant class who move wealth and intelligence across every border the empire has, and the Tlaxcalans whose loyalty to the Triple Alliance has been purchased rather than earned and whose accounting of that debt is precise. A **customs official in Constantinople** in the late Byzantine period, where the Venetian quarter, the Genoese rivals, and the Ottoman commercial envoy each control a piece of the harbor and none of them control all of it. **Viking-age Scandinavia** — the jarl's huscarls who enforce his word by sword, the völva whose prophecy the entire community navigates by, and the Christian missionary who carries the weight of a Frankish emperor's patience behind every sermon. A **high fantasy mercenary guild leader** holding contracts from an Elven court representing generations of accumulated grievance, a Dwarven mining consortium whose labor force is the mountain, and an Orcish warlord whose clan loyalty runs deeper than any signed agreement. **French Indochina** — the French military command whose definition of order differs from the civilian colonial administration's in ways that matter, the Vietnamese resistance network whose members are also the labor force the colony depends on, and the Chinese commercial diaspora that finances both sides and belongs to neither. **British Hong Kong** in the opium trade years — the East India Company's commercial directorate, the Cantonese merchant guild whose routes predate the British by two centuries, and the Qing imperial customs office that is theoretically sovereign and practically not. An **unknown foreign element in early Sakhalin**, 1905 — the island changing hands, a Russian fishing collective waiting to see if they still have a country, a Japanese imperial surveyor whose maps are already drawn, and an indigenous Ainu community that has watched three empires name their land without asking. A **banana republic** in the 1920s — the United Fruit Company's regional directorate, the general whose army the company funds, and the labor organizer whose union represents the only workforce either of them depends on. A **WW2 military logistics coordinator** keeping three Allied commanders supplied while the British imperial supply chain, the American industrial machine, and the Free French resistance network each have incompatible definitions of priority. A **DEA agent embedded in Medellín** during the Escobar years, running relationships with a cartel intermediary who speaks for the sicario network, a Colombian federal official whose loyalties are institutionally compromised, and a community of journalists and lawyers who represent the civilian dead and will not stop counting them. The **International Space Station** under communications blackout — the Roscosmos crew whose political instructions are six months stale, the NASA mission specialist who answers to a congressional committee watching the feed, and the CNSA observer whose government's entire manned program is being evaluated through what happens in the next seventy-two hours. An **exoplanet colony** at the edge of contact range — the corporate terraforming directorate whose shareholders are three years away by signal, the indigenous-contact team whose loyalties run simultaneously to the protocol's authors back on Earth and to whatever is on the other end of it, and the colony's elected council whose mandate comes from the people living there and no one else. And a **clown college** — the traditionalist faculty whose pedagogy traces back to the commedia, the physical comedy modernists who think the old forms are dead, and the student body whose graduation showcase is the only thing the grant committee will actually watch. The threshold system does not care what the passions are made of. The clown's investment in their bit and a senator's investment in his faction are structurally identical.

The point: if the setting has power, competing interests, and time — it runs on this engine.

\---

## How It Works

**Stars** are the primary characters. Each tracks multiple named Passions independently.

**Passions** run from -100 to +100. Nine named bands:

|Band|Range|
|-|-|
|Devoted|75 to 100|
|Steadfast|50 to 75|
|Trusted|30 to 50|
|Favorable|15 to 30|
|Neutral|15 to -15|
|Strained|-15 to -30|
|Opposed|-30 to -50|
|Hostile|-50 to -75|
|Irreconcilable|-75 to -100|

Each band is a behavioral state, not a number. Crossing a threshold changes what that person does in the world — concretely, legibly, with downstream consequences. The overall relationship with each Star is a **Macropassion** label, derived from the average across all their Passions. Nine named states cover the full range:

|Macropassion|Average|
|-|-|
|Bound Ally|75 to 100|
|Steadfast Friend|50 to 75|
|Trusted Ally|30 to 50|
|Cautious Friend|15 to 30|
|Known Acquaintance|-15 to 15|
|Wary Stranger|-30 to -15|
|Open Opponent|-50 to -30|
|Active Adversary|-75 to -50|
|Sworn Enemy|-100 to -75|

**Reputation** tracks Fame and Infamy independently for each Star. These measure political relevance — how much you currently register in each Star's world — not a permanent ledger. They combine into four named reputation states per Star (e.g. *Known Paradox*, *Honored Neighbor*, *Dangerous Debtor*, *Quiet Stranger* for Esperanza). Both values decay each season without active maintenance. Higher values compound on the way up and decay more slowly — described further under Systems.

**Seasons** advance on the player's call. The Decisions column shows what requires your hand this season. The Chronicle logs everything in period voice. The Persons column tracks where each Star stands across all their Passions.

**Ruin** is the failure state. It fires through Effective Standing — a single measure that integrates macropassion with political relevance. If any Star's effective standing falls to -50 and the other two don't collectively provide enough cover, the game ends. At -100, it ends unconditionally. Fame buffers hostility — a Star who has publicly vouched for you has skin in the game and won't move against you while that holds.

**Victory** is offered, not imposed. Three win conditions check Effective Standing across all Stars. When a threshold is crossed, the game presents a choice: accept and close the ledger, or decline and keep playing. A declined win is recorded and never resurfaces, even if the thresholds hold.

\---

## Systems

### Actions

Each decision is tied to a source Star and an availability window. Effects move Passion values and Fame/Infamy scores across multiple Stars simultaneously. Serving one person usually costs another. Some actions expire if left unanswered.

Every action card shows **Accept** and **Decline** buttons explicitly — clicking the card itself does nothing. Declining an action with consequences fires those consequences immediately and records the refusal in the Chronicle. A small number of actions carry opaque expiry windows: Decline hides the card, but the natural expiry still fires at its scheduled season regardless.

### Effect Scale

Action effects follow a four-weight scale: ±5 (minor), ±10 (moderate), ±20 (significant), ±30 (major). The weights are editorial — a designer chose *significant* or *major*, not a calculated value. The Chronicle renders these as symbol strings (+ / ++ / +++ / ++++) so magnitude reads at a glance.

### Repair and Betrayal

Some actions only surface after prior damage or prior trust has been established. Repair actions are gated behind Passion thresholds — they exist to give players a costly path back from a bad position, not a cheap undo. Betrayal actions work the opposite way: they only appear once a Passion is high enough that there's something real to exploit. Using someone's trust as an instrument against them is an available move, with consequences that reflect what it actually means.

### Fame \& Infamy

Fame and Infamy don't accumulate permanently — they measure how much you currently matter to each Star's world. Both values are whole numbers between 0 and 100.

**Decay.** Each season, both values fall at a tiered rate based on their current level:

|Value range|Decay per season|
|-|-|
|0–30|1.00 points|
|30–50|0.75 points|
|50–100|0.50 points|

Going quiet with a Star is a viable survival strategy when Infamy is moderate, but entrenched notoriety is slow to leave — a value above 50 takes over 20 seasons to fully decay without new actions driving it up.

**Positive only.** Fame and Infamy are always additive — taking an action makes you more relevant to a Star, never less. Negative outcomes register as Infamy with the affected party rather than erasing Fame. The two values are independent: you can be simultaneously famous and notorious with the same person.

**Compounding.** Each gain is multiplied by `1 + (currentValue / 100)`. At 0 the modifier is 1.0 — no amplification. At 50 it is 1.5 — gains are 50% larger. At 100 it is 2.0 — gains are doubled. The modifier is applied at the moment of gain only; losses are never amplified. The result is a self-reinforcing upper range: the higher a value climbs, the faster it climbs further.

### Effective Standing

Effective Standing integrates macropassion with political relevance into a single value used by both the ruin and win systems. It is not displayed directly — it is the engine beneath the surface.

The formula: `effectiveMP = macropassionValue × modifier`, where `modifier = 1 + netRelevance / 100` for positive net relevance (fame exceeds infamy) and `1 / (1 + |netRelevance| / 100)` for negative. Positive fame amplifies strong relationships further; high infamy dampens even a friendly Macropassion toward zero.

### Win Conditions

Three paths to a closing. Each fires once — when the threshold is first crossed, a modal interrupts play. The player can accept and close the ledger, or decline and keep playing. Declining records the condition in history and it never resurfaces. The moment doesn't wait.

**A Beneficial Agreement** — all three Stars' Effective Standing ≥ 50. You navigated the distance between them without harming any of them in the process.

**Hard-Driven Bargain** — two Stars' Effective Standing ≥ 75, third ≥ 15. You made the people who mattered most deeply loyal, and kept the third from becoming an enemy.

**Dominant Power** — one Star's Effective Standing ≥ 200, others ≥ -15. You didn't build consensus — you built gravity.

### Passion Neglect

Relationships not actively tended lose ground slowly. Each season, the game scans the last eight log entries for each Star. If none of those entries involved that Star's effects, their positive Passions drift down by 1 point. Only positive Passions decay this way — negative ones require active repair to shift. The floor is 0.

### Deferred Consequences

Most actions plant a deferred outcome that fires years later in the Chronicle — a Sacramento court ruling, a railroad decision, a territorial record becoming permanent. The deferred entry arrives regardless of what you do afterward. What you decided in 1812 is still in the newspaper in 1819.

### Probabilistic Outcomes

Some actions have outcomes that depend on timing. The search for Caleb Reed has a success chance of 100% in 1814 that declines 10% for each year the player waits, with a floor of 20%. If the search fails, the Chronicle records the empty result and damages the Brotherhood Passion; no deferred consequence fires. The player sees no percentage — only the clock.

### Reactive Events

When a Passion crosses a threshold, a reactive event fires automatically. These appear in the Chronicle as news items, apply secondary effects, and can unlock new actions. Crossing thresholds in either direction can trigger events — positive ones open doors, negative ones close them. Esperanza's trust crossing -50 files a formal complaint against you; crossing +50 grants access to the coalition's private archive. Solomon's Autonomy crossing -50 restricts your access to the post; his Brotherhood crossing +50 opens contact with his brother's Nevada network. Whitmore's standing crossing +75 earns him a promotion; his Corridor Claim falling below -50 draws a company auditor north.

### Convergence Events

When conditions across multiple Stars are simultaneously met, a forced choice appears as a modal. These present direct confrontations between Star interests that cannot be avoided or deferred. Four convergence events are in the prototype.

The **Northern Boundary** confrontation fires when both Esperanza's Land Security and Whitmore's Corridor Claim are above 30 — they call on you in the same week regarding the same strip of land. You must choose.

The **Unlikely Meeting** fires when Solomon's Independence (in either direction, ≥30 in absolute value) and Esperanza's Coalition Strength are both above 30 — each has come to see something the other has, and you are the only person both of them trust.

The **Surveyor's Letter** fires when both of Whitmore's visible Passions are above 30 — he asks you, off the record, to help him write to his wife in Cincinnati. He also needs your name on a corridor extension before the month ends. Three choices are available: help with the letter first, push him to the filing first, or attempt both badly.

**Three Letters in One Week** fires when all three Stars' Macropassion averages (in absolute value) reach 20. All three call on you in the same week with urgent, incompatible needs. You can only answer one. The choice text changes depending on your prior history with Solomon's warehouse loan — whether you backed it, declined it, or it expired without your involvement.

### Transient Guests

One-off visitors arrive for a window of seasons. The player must respond before advancing the season or they depart unanswered. Unanswered guests are recorded in the Homestead ledger. Guest choices affect Fame and Infamy and add Chronicle entries with or without the player's name attached, depending on the choice made.

### Hidden Passions

Some Passions are not visible at the start. Both Solomon and Whitmore each carry one hidden Passion that reveals only once the Macropassion average reaches 15 — the *Cautious Friend* threshold. Once revealed, a hidden Passion stays visible permanently.

Solomon's **Brotherhood** Passion tracks his search for his brother Caleb, missing since the Nevada silver rush. Whitmore's **The Distance** Passion tracks his relationship with his wife Margaret in Cincinnati — the months that have become years, and what that silence is costing both of them. Neither can be acted on until it surfaces.

### Hidden Passion Reveal

When a hidden Passion first becomes visible, a modal interrupts play. Each reveal is a short piece of first-person narration — the character letting something slip that they normally keep close. The dialogue body is time-aware, calculating elapsed years from a fixed historical anchor and writing the duration in natural language. A reveal that fires in 1814 reads differently from one that fires in 1822.

### World Dispatches

Historical events arrive in the Chronicle regardless of player action, dated and dateline-attributed to period newspapers. The War of 1812, the Missouri Compromise, Jackson's election, the founding of the Anti-Slavery Society, Texas independence, the Mexican-American War, the Gold Rush. These are texture, not mechanics — but they frame what your decisions mean in their moment.

### Chronicle Display

The Chronicle groups all entries under a single season header per year and season. Deferred consequences (⚡) and narrative events (◈) retain their type indicators within the group. The current season is marked with a ● New badge on the group header.

\---

## The Stars

**Esperanza Vallejo — Land Grant Heir**
Passions: Land Security, Anglo Distrust, Coalition Strength.
She represents 47 people whose livelihoods depend on the Vallejo grant. At Devoted on Land Security she names you publicly as a protector of the old grants. At Devoted on Anglo Distrust she tells you things she tells no one else. At Irreconcilable on either, she pursues you in court by name and tells people what you did.

**Solomon Reed — Freedman \& Trader**
Passions: Permanence, Independence, Brotherhood (hidden).
He built something in this valley with no safety net and no federal protection, with 31 people who orbit his post and have no other reliable anchor in the valley. At Devoted on Permanence he lists you as a trusted partner in territorial filings. At Devoted on Independence he shares routes and contacts he shares with very few. At Irreconcilable he relocates the post's most valuable operations beyond your reach.

**J.T. Whitmore — Railroad Surveyor**
Passions: Corridor Claim, Company Standing, The Distance (hidden).
Pacific Railroad's man in the valley, with 89 people's livelihoods running through the company. At Devoted on Company Standing he names you in his reports as instrumental — the company knows you. At Devoted on Corridor Claim he treats your land as an extension of the railroad's protected zone. The Distance is his relationship with his wife Margaret in Cincinnati, invisible until the relationship is deep enough to reveal it. At Irreconcilable he brings the full weight of Pacific Railroad's legal office against you.

\---

## Stack

* React 19
* Vite
* No external UI libraries — all styling is inline
* Deployed on Vercel

**Architecture.** The entire game is a single `App.jsx` file (\~3,100 lines). State is managed with `useReducer`; theme tokens — color, typography, spacing — are distributed via a `ThemeContext` through a `mkT(darkMode)` function. Stars, Passions, Actions, and World Dispatches are defined as static data objects. Core logic functions (`decayRate`, `effectiveMP`, `getThreshold`, `checkRuin`, `checkWin`) are small and pure.

**Scenario config.** A `SCENARIO` object at the top of the file holds every setting-specific string and value: game name, paper name, fonts, time units, starting year, panel labels, and accent color. To run the engine in a different setting, replace `SCENARIO` and supply new `INITIAL\_STARS`, `ACTIONS`, `GUESTS`, `CONVERGENCE\_EVENTS`, and `WORLD\_DISPATCHES`. The engine is fully agnostic to scenario content and requires no other modification.

\---

## Running Locally

```bash
npm install
npm run dev
```

\---

## Design Notes

Manifest is a direct implementation of Ken Levine's [Narrative Legos](https://www.gdcvault.com/play/1020243/Narrative) framework, presented at GDC. The core thesis: narrative doesn't lend itself to systems because traditional narrative is linear, but if you break it into its smallest non-abstract elements — Stars, Passions, transparent triggers — you can build a nearly infinite array of narrative outcomes from a limited set of parts.

The framework maps onto Manifest like this:

* **Stars and Passions** — Levine's Frank the Orc translated into Esperanza, Solomon, and Whitmore, each with a small set of motivations the player can act on or against
* **Macropassion as aggregation** — a named relationship state derived from the average of all Passions, with behavioral thresholds rather than raw numbers
* **Zero-sum tension** — Levine's Frank-and-Pete problem: two Stars who can't both be fully served, where the northern boundary dispute forces a direct confrontation between Esperanza's land claim and Whitmore's federal filing
* **Transparency** — every effect surfaces a plain-language `why`, keeping triggers legible rather than opaque
* **Hidden Passions** — Solomon's Brotherhood Passion and Whitmore's The Distance are both invisible until the relationship is deep enough to reveal them, exactly as Levine describes

Deferred consequences — decisions planting Chronicle entries that fire years later — extend beyond the talk. Levine didn't address time-delayed outcomes; that's the original design contribution this prototype adds to the framework.

Levine also left open the question of endpoints. Manifest now answers with both a failure system and a win system. Ruin fires through Effective Standing — conditional at -50 and absolute at -100. Win conditions fire when Effective Standing crosses positive thresholds and are offered as a choice rather than imposed: accept and close the ledger, or decline and keep playing. A declined win is gone. The moment doesn't wait.

The design question the prototype answers: does the threshold system produce meaningful tension? Can you build something where serving one person genuinely costs you with another — not as a stat penalty, but as a story?

It does. That's what the prototype is for.

\---

## Design Considerations for Larger Scenarios

The three-Star prototype is a proof of concept. The engine is designed to scale, and several design problems become visible only at scale. These are documented here as forward-looking considerations, not gaps in the current build.

**Star count and faction structure.** Scenarios can support anywhere from three Stars to upwards of twenty-five. At scale, Stars should be organized into factions — major factions carrying five to ten Stars each, minor factions carrying one or two. The player doesn't track twenty-five individual relationships with equal attention; they track faction-level standing, with individual Stars mattering when they're directly in front of you. The current guest system already gestures at this: a minor-faction Star appears, the player engages, and the relationship either matures into something tracked or closes. At larger scale that pattern becomes the primary interface for peripheral Stars.

**Star mortality.** In Levine's original framework, Stars were not protected — this is a medieval action game where characters, including Stars, can be killed. Manifest's current model has no concept of Star death. Adding it changes several systems: a dead Star's community doesn't disappear, someone inherits their constituency and their grievances, and the successor relationship becomes a design problem in its own right. Ruin and win conditions need to account for absence, not just hostility. A Star killed by the player's hand carries different downstream consequences than one killed by faction conflict the player enabled or failed to prevent. Successor relationships are a second original contribution beyond Levine's framework — the first being deferred consequences, the second being what happens to a community when its Star is gone.

**Inter-Star passions.** The current model is player-centric: every Passion measures a Star's relationship to the player. But Stars should also carry Passions toward each other — Esperanza's Coalition Strength already implicitly includes her regard for Solomon's post as an anchor; Solomon's Autonomy is partly about resisting entanglement with the coalition. Making these explicit means player actions create ripples between Stars that don't pass through the player at all. The player becomes a catalyst in relationships they don't fully control, rather than the hub of a wheel. This is a more honest model of how power actually works, and it's essential at twenty-five Stars — otherwise every relationship reduces to a bilateral transaction with the player at the center.

The data model already partially supports this: effects arrays can reference any Star, so an action can move Esperanza's coalition passion and Solomon's autonomy in the same step. What's missing is a target field on passions that denotes another Star rather than a topic, and a display layer that surfaces inter-Star tension to the player without overwhelming them. The Star card would need a secondary view for standing between Stars, not just standing with the player.

**Scenario-specific passion types.** In a medieval action scenario, a Star might carry a Passion for the player's survival — or for their death. Passions that are directional toward other Stars (protection, rivalry, debt, grief) open up emergent storylines that the current model can't generate. A warlord's enforcer who has a Passion for the warlord's approval; a merchant's daughter who has a hidden Passion for a rival merchant's son; a general who holds a Passion for the commander who betrayed him twenty years ago. These are not player-facing mechanics — they fire in the background, shifting the political landscape between Star turns, and surface in the Chronicle as events the player didn't cause but must navigate.

The full design document is in the [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/) under Game Concepts → GC-003.

\---

## Prototype Scope and Known Gaps

The prototype proves what it sets out to prove: the threshold system produces meaningful tension, deferred consequences land, and the Narrative Legos framework scales to a multi-Star setting. The gaps below are documented as design work, not bugs.

**Action density collapses after 1824.** The last core action is in 1824. The back quarter of the game is passive — world dispatches and quiet seasons, but no new player decisions. The deferred consequences from earlier actions are still firing, but the player has no agency in the final twenty-four years.

**The Distance doesn't arc.** Whitmore's hidden Passion about his wife in Cincinnati has presence early and appears in one convergence event, but has no quest chain and no structural payoff. Brotherhood builds — `hold\_letter` → `find\_brother` → `introduce\_caleb` → `nevada\_contacts`. The Distance doesn't, which makes it feel like flavor rather than system.

**The fourth convergence event's trigger is invisible.** Three Letters in One Week fires when all three Stars' absolute Macropassion values reach 20. The player can see individual Passion bars and Macropassion labels, but the combined cross-Star condition is never displayed. The other three convergence events have legible triggers. This one will arrive unexpectedly and won't arrive when waited for.

**The guests run parallel to the main narrative.** The Comanche traveler and Isaiah Drum are the most morally serious scenes in the prototype. Their mechanical connection to the main narrative is thin — small Fame deltas, minor Passion movements. Guest outcomes could feed convergence event conditions or reactive event triggers; currently they don't.

**The Chronicle doesn't support cause-and-effect navigation.** The deferred consequence mechanic's power is the link between a past decision and a future outcome. Once thirty or forty entries have accumulated, tracing those links requires finding the original entry in the scroll. This is the known gap the "compounding newspaper mechanic" is meant to address in the full version.

\---

## Contact

wendell91097@gmail.com · [sovereigndev.itch.io](https://sovereigndev.itch.io) · [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/)

