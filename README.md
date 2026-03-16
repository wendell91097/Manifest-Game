# Manifest

**Live prototype:** https://manifest-henna.vercel.app/

Narrative strategy game set in the 1800s American West. Built in React as a playable proof-of-concept of Ken Levine's [Narrative Legos](https://www.gdcvault.com/play/1020243/Narrative) design framework. Part of a larger game design project documented at the [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/).

---

## What This Is

### The story

You have arrived in California in 1810 with land, some money, and a name not yet known. Three people are already here and already watching: Esperanza Vallejo, whose family held this valley before the surveys and the paper that now claims to govern it; Solomon Reed, who built a trading post on the valley road with no safety net and no federal protection; and J.T. Whitmore, who arrived with a railroad survey and the full weight of Pacific Railroad behind him. Their interests cannot all be satisfied. Every season you make decisions. Every decision moves something. The ledger is permanent.

### The framework

A scenario-agnostic engine for stories about power, competing interests, and time. The underlying problem is identical across every setting: you are one node in a web of powerful actors with incompatible interests, time passes, and your decisions compound. Everything setting-specific lives in a `SCENARIO` config object and four data arrays. Replace those and you have a different game. The reducer, the threshold system, the relationship mechanics, the win and ruin conditions — none of it knows it is in 1810 California.

---

## Two Explanations

### Short — the story

You are a landowner in 1810 California. Three people — a Californio land heir, a freedman trader, and a railroad surveyor — have incompatible visions for the valley. Every season you make one decision. Every decision costs you with someone. The Chronicle records everything, including what you didn't do.

### Short — the framework

A relationship engine where Stars have Passions, Passions have thresholds, and crossing a threshold changes what happens in the world. The engine is fully scenario-agnostic. The same system runs a Roman senator navigating three factions or a DEA agent in Medellín managing incompatible loyalties.

---

### Long — the story

California, 1810. You are a landowner at the crossroads of everything America is becoming.

Esperanza Vallejo's family held this land before American annexation, before the surveys, before any of the paper that now claims to govern it. Forty-seven people's livelihoods depend on the Vallejo grant. She has watched Anglo landowners arrive and rewrite the map before. The difference between you and the ones who came before, if there is one, is not yet established. She'll be watching.

Solomon Reed built a trading post on the valley road with no safety net and no federal protection. Thirty-one people orbit it — freedmen, mixed-race families, independent traders — with no other reliable anchor in the valley. The post has grown to the point where it is no longer easy to ignore. You may be the first whose noticing matters to him.

J.T. Whitmore arrived with Pacific Railroad's survey authority and eighty-nine people's livelihoods running through the company he represents. He is professional, thorough, and operating under instructions written in an office a long way from this valley. He is under no illusions about what his presence means for the people who were here first.

Every season you make decisions. Each one moves something. Each one costs you somewhere. Serving Esperanza's land interests works against Whitmore's corridor. Building Solomon's network draws federal scrutiny. Doing nothing has consequences too — the Chronicle prints what you declined, and deferred outcomes from earlier decisions arrive years later whether you are paying attention or not.

The relationships you build hold or erode based on their depth. A close ally forgives minor friction without being asked. A thin acquaintance's goodwill evaporates quietly. A rival's grudges are stable — they don't soften with time, only with active repair. And an enemy's occasional respect erodes fastest of all, because the overall hostility poisons everything it touches.

The game ends three ways. You can build something — a beneficial arrangement where no one was destroyed, a hard bargain where your closest allies are deeply loyal and your rivals are at least manageable, or dominant gravity where one relationship became so powerful the others organized around it. You can fail — ruin fires when effective standing collapses past the conditional threshold, buffered by strong alliances elsewhere, or absolute when it falls far enough that nothing can cover it. Or the world moves on without you — ten seasons of inactivity and the valley finds its own arrangement. The homestead stays yours on paper. Your name stops appearing in anyone else's accounting.

Everything is recorded in the Chronicle. A period newspaper in the voice of the valley. Deferred consequences arrive dateline-attributed, years after the decision that caused them. What you did in 1812 is still in the paper in 1819. Declined actions are recorded too. The Chronicle is the permanent ledger of the kind of person you were when the decisions were hard.

### Long — the framework

Manifest is a direct implementation of Ken Levine's [Narrative Legos](https://www.gdcvault.com/play/1020243/Narrative) framework, extended with three original contributions and designed from the start to be scenario-agnostic.

**The framework.** Levine's thesis: traditional narrative is linear, which makes it incompatible with systems. But if you break narrative into its smallest non-abstract elements — Stars, Passions, transparent triggers — you can generate a nearly infinite array of story outcomes from a limited set of parts. A Star is a character whose motivations can be acted on or against. A Passion is a named dimension of a relationship, tracked on a scale from -100 to +100 with nine named behavioral bands. Crossing a threshold changes what that Star does in the world — concretely, legibly, with downstream consequences. A Macropassion is the aggregate of all a Star's Passions, producing a named relationship state that gates systematic effects.

**The extensions.** Three design contributions beyond Levine's original framework:

*Deferred consequences.* Decisions plant Chronicle entries that fire years later regardless of subsequent actions. Levine's framework addressed immediate effects. Manifest adds the dimension of time — what you decided in 1812 is still in the newspaper in 1819, and the player must reckon with the gap between action and consequence.

*A three-state ending system.* Levine left endpoint design open. Manifest answers with ruin (active failure through relationship collapse), victory (offered as a choice when thresholds are crossed, never imposed), and obscurity (passive irrelevance — ten seasons of inactivity and the world fills the space you left). Three qualitatively distinct answers to what kind of story this was.

*Macropassion-gated systematic modifiers.* Individual Passion thresholds describe what a Star is doing in the world. Macropassion determines the strength and direction of systematic effects: fame and infamy multipliers, passion gain bonuses, delta visibility, action rate limits, guest access, and information asymmetry. The dominant Passion at the time of check determines the flavor of the effect. All Passions can contribute simultaneously — the effects are cumulative.

**The decay system.** Passions drift toward zero at a rate determined by the macropassion, bidirectionally. Strong alliances hold their ground. Thin acquaintanceships drift slowly in both directions. Active hostility makes goodwill evaporate fast. Deep hostility requires active repair. The mechanic is a mirror: allies forgive, enemies erode whatever goodwill exists.

**The scenario.** California 1810 is one instance of a recurring problem. The engine doesn't know it's in California. It knows it has Stars, Passions, and a tick counter. If the setting has power, competing interests, and time, it runs on this engine.

---

## A Framework for Narrative Legos

Everything setting-specific lives in a `SCENARIO` config object and four data arrays: `INITIAL_STARS`, `ACTIONS`, `CONVERGENCE_EVENTS`, and `WORLD_DISPATCHES`. Replace those and you have a different game.

In every case, each Star represents not just themselves but a constituency — a community, a faction, a network of people whose interests move with them. When a Star turns against you, it is never just one person. To illustrate:

A **Greek temple administrator** whose Stars are the gods themselves — Athena's constituency is every craftsman, soldier, and philosopher who prays at her altar; Ares's is every army in the field; Hades's is the dead, who are patient and numerous. The inter-Star passions are already written in mythology. When Athena and Ares are both watching what you do, neutrality is not available. A **Roman senator** in the late Republic — the equestrian merchant class who funded his campaign, the plebeian tribal assembly whose votes he needs, and the patrician faction that will destroy him the moment he stops being useful. The **Greek city-states** at the edge of the Persian Wars — the Athenian democratic assembly, the Spartan ephors speaking for the agoge and its warriors, and the Theban Sacred Band whose allegiance could decide the peninsula. **Aztec Mexico** before contact — the tribute-collecting military caste, the priesthood whose calendar determines when wars are permitted, the pochteca merchant class who move wealth and intelligence across every border the empire has, and the Tlaxcalans whose loyalty to the Triple Alliance has been purchased rather than earned and whose accounting of that debt is precise. A **customs official in Constantinople** in the late Byzantine period, where the Venetian quarter, the Genoese rivals, and the Ottoman commercial envoy each control a piece of the harbor and none of them control all of it. **Viking-age Scandinavia** — the jarl's huscarls who enforce his word by sword, the völva whose prophecy the entire community navigates by, and the Christian missionary who carries the weight of a Frankish emperor's patience behind every sermon. A **high fantasy mercenary guild leader** holding contracts from an Elven court representing generations of accumulated grievance, a Dwarven mining consortium whose labor force is the mountain, and an Orcish warlord whose clan loyalty runs deeper than any signed agreement. **French Indochina** — the French military command whose definition of order differs from the civilian colonial administration's in ways that matter, the Vietnamese resistance network whose members are also the labor force the colony depends on, and the Chinese commercial diaspora that finances both sides and belongs to neither. **British Hong Kong** in the opium trade years — the East India Company's commercial directorate, the Cantonese merchant guild whose routes predate the British by two centuries, and the Qing imperial customs office that is theoretically sovereign and practically not. An **unknown foreign element in early Sakhalin**, 1905 — the island changing hands, a Russian fishing collective waiting to see if they still have a country, a Japanese imperial surveyor whose maps are already drawn, and an indigenous Ainu community that has watched three empires name their land without asking. A **banana republic** in the 1920s — the United Fruit Company's regional directorate, the general whose army the company funds, and the labor organizer whose union represents the only workforce either of them depends on. A **WW2 military logistics coordinator** keeping three Allied commanders supplied while the British imperial supply chain, the American industrial machine, and the Free French resistance network each have incompatible definitions of priority. A **DEA agent embedded in Medellín** during the Escobar years, running relationships with a cartel intermediary who speaks for the sicario network, a Colombian federal official whose loyalties are institutionally compromised, and a community of journalists and lawyers who represent the civilian dead and will not stop counting them. A **Tammany Hall-era New York city official** managing the Irish ward machine that delivered the election, the newly arrived Italian community organizing its own parallel patronage network, and a reform-minded banker whose loans finance both sides and whose patience is not unlimited. The **International Space Station** under communications blackout — the Roscosmos crew whose political instructions are six months stale, the NASA mission specialist who answers to a congressional committee watching the feed, and the CNSA observer whose government's entire manned program is being evaluated through what happens in the next seventy-two hours. An **exoplanet colony** at the edge of contact range — the corporate terraforming directorate whose shareholders are three years away by signal, the indigenous-contact team whose loyalties run simultaneously to the protocol's authors back on Earth and to whatever is on the other end of it, and the colony's elected council whose mandate comes from the people living there and no one else. A **Martian civilization** at first contact with Earth — the same problem from the other side of the telescope, with the same stakes and less paperwork. And a **clown college** — the traditionalist faculty whose pedagogy traces back to the commedia, the physical comedy modernists who think the old forms are dead, and the student body whose graduation showcase is the only thing the grant committee will actually watch. The threshold system does not care what the passions are made of. A clown's investment in their bit and a senator's investment in his faction are structurally identical.

The point: if the setting has power, competing interests, and time — it runs on this engine.

---

## How It Works

**Stars** are primary entities with their own timeline presence. Each carries a `ya` field defining when they enter the valley and an optional `spawnCondition` function for dynamic arrival — a Star can emerge in response to macropassion thresholds, faction conditions, or any other game state. When a Star enters `revealedStars`, their intro modal fires and their actions become available. Stars are not derived from actions. Actions are expressions of an existing relationship.

**Passions** run from -100 to +100. Nine named bands:

| Band | Range |
|---|---|
| Devoted | 75 to 100 |
| Steadfast | 50 to 75 |
| Trusted | 30 to 50 |
| Favorable | 15 to 30 |
| Neutral | 15 to -15 |
| Strained | -15 to -30 |
| Opposed | -30 to -50 |
| Hostile | -50 to -75 |
| Irreconcilable | -75 to -100 |

Each band is a behavioral state, not a number. Crossing a threshold changes what that person does in the world — concretely, legibly, with downstream consequences. The overall relationship with each Star is a **Macropassion** label, derived from the average across all their Passions. Nine named states cover the full range:

| Macropassion | Average |
|---|---|
| Bound Ally | 75 to 100 |
| Steadfast Friend | 50 to 75 |
| Friendly Neighbor | 30 to 50 |
| Cautious Friend | 15 to 30 |
| Known Acquaintance | -15 to 15 |
| Clear Competitor | -30 to -15 |
| Open Opponent | -50 to -30 |
| Active Adversary | -75 to -50 |
| Sworn Enemy | -100 to -75 |

**Reputation** tracks Fame and Infamy independently for each Star. Both values decay each season without active maintenance. Higher values compound on the way up and decay more slowly.

**Seasons** advance on the player's call. The Decisions column shows what requires your hand this season. The Chronicle logs everything in period voice. The Persons column tracks where each Star stands across all their Passions.

**Ruin** is the failure state. It fires through Effective Standing — a single measure that integrates macropassion with political relevance. If any Star's effective standing falls to -50 and the other two don't collectively provide enough cover, the game ends. At -100, it ends unconditionally.

**Victory** is offered, not imposed. Three win conditions check Effective Standing across all Stars. When a threshold is crossed, the game presents a choice: accept and close the ledger, or decline and keep playing. A declined win is recorded in the Chronicle in period newspaper voice and never resurfaces.

**Obscurity** is the third ending — not failure, not victory, but absence. Ten seasons without a meaningful decision and the world closes around the space you left. The homestead remains yours on paper. Your name stops appearing in anyone else's accounting.

---

## Systems

### Actions
Each decision is tied to a source Star and an availability window. Effects move Passion values and Fame/Infamy scores across multiple Stars simultaneously. Serving one person usually costs another. Some actions expire if left unanswered.

Every action card shows **Accept** and **Decline** buttons explicitly. Declining an action fires its consequences immediately and records the refusal in the Chronicle. A number of actions carry opaque expiry windows: Decline hides the card but the natural expiry still fires at its scheduled season. Others expire immediately when declined. The distinction is editorial — some people give up at once, others hold out hope until the last possible moment.

Effect delta values are progressively revealed as the relationship deepens. Below Cautious Friend, you can see who is affected and which passion, but not by how much. The exact magnitudes become information earned through trust.

### Effect Scale
Action effects follow a four-weight scale: ±5 (minor), ±10 (moderate), ±20 (significant), ±30 (major). The Chronicle renders these as symbol strings (+ / ++ / +++ / ++++) so magnitude reads at a glance.

### Macropassion Modifiers
Macropassion determines systematic buffs and debuffs applied at action resolution. The dominant Passion — whichever has the highest absolute value — flavors the effect. All Passions can contribute simultaneously; the effects are cumulative.

At ally tiers: fame gains are amplified, infamy gains are dampened, passion bonuses apply to positive gains, and information opens up — expiry timers visible, delta values revealed, guest pool expanded.

At hostile tiers: fame gains are dampened, infamy gains are amplified, delta values are hidden, action rate limits apply, and convergence event choices are reduced.

At Sworn Enemy: the Star's actions are removed from Decisions entirely. Reparation-type actions remain available — the path back is always open.

### Passion Decay
Passions drift toward zero at a rate determined by macropassion, bidirectionally. The table mirrors: allies forgive, enemies erode goodwill.

| Macropassion | Positive decay | Negative decay | Negative floor |
|---|---|---|---|
| ≥ 50 | 0 | 0.5/season | -15 |
| ≥ 30 | 0.25/season | 0.25/season | -30 |
| ≥ 15 | 0.5/season | 0.5/season | -50 |
| -15 to 15 | 0.75/season | 0.75/season | -50 |
| ≤ -15 | 1.0/season | 0 | none |
| ≤ -30 | 2.0/season | 0 | none |

Negative passions below the floor require active repair to move. Grudges held by people who have decided against you do not soften with time.

### Fame & Infamy
Fame and Infamy measure how much you currently register in each Star's world. Both decay each season. Each gain is multiplied by `1 + (currentValue / 100)`. At 0 the modifier is 1.0. At 50 it is 1.5. At 100 it is 2.0. Losses are never amplified; only gains compound.

### Effective Standing
`effectiveMP = macropassionValue × modifier`, where `modifier = 1 + netRelevance / 100` for positive net relevance and `1 / (1 + |netRelevance| / 100)` for negative. Used by both the ruin and win systems.

### Win Conditions
**A Beneficial Agreement** — all three Stars' Effective Standing ≥ 50. You navigated the distance between them without harming any of them in the process.

**Hard-Driven Bargain** — two Stars' Effective Standing ≥ 150, third ≥ -15. You made the people who mattered most deeply loyal, and kept the third from becoming an enemy.

**Dominant Power** — one Star's Effective Standing ≥ 150, others ≥ -15. You didn't build consensus — you built gravity.

### Deferred Consequences
Most actions plant a deferred outcome that fires years later in the Chronicle regardless of what you do afterward. What you decided in 1812 is still in the newspaper in 1819.

### Probabilistic Outcomes
Some actions have outcomes that depend on timing. The search for Caleb Reed has a success chance of 100% in 1814 that declines 10% per year with a floor of 20%. The player sees no percentage — only the clock.

### Reactive Events
When a Passion crosses a threshold, a reactive event fires automatically — but only if macropassion confirms the relationship context. A single high passion in an otherwise cold relationship does not open doors that haven't been earned.

### Convergence Events
When conditions across multiple Stars are simultaneously met, a forced choice appears. Four convergence events are in the prototype. Three Letters in One Week is gated on Whitmore being visible in Persons, and requires all three Stars' absolute macropassion to reach 30 — not merely acquaintance territory.

### Transient Guests
Strangers arrive via a Poisson-style draw. Each season after the last guest departed, the draw probability increases by 1% starting two seasons after the previous guest left — 0% the next season, 0% the season after, then climbing. The pool of eight guests is drawn by weighted random selection; some require a Star's macropassion to be above a threshold before they can appear. Once seen, a guest doesn't return.

### Star Introductions
Stars carry their own `ya` / `yaSeasonIdx` timeline fields. Esperanza is present from Spring 1810. Solomon enters Summer 1810. Whitmore arrives Spring 1811. Each introduction surfaces as a modal — period newspaper voice, dateline paper line, single continue button — when the Star's tick is reached. Stars with `spawnCondition` functions remain dormant until their condition fires, then introduce through the same infrastructure.

### Hidden Passions
Solomon's **Brotherhood** Passion tracks his search for his brother Caleb, missing since the Nevada silver rush. Whitmore's **The Distance** Passion tracks his relationship with his wife Margaret in Cincinnati. Neither surfaces until the macropassion reaches Cautious Friend. Once revealed, a hidden Passion stays visible permanently.

### Obscurity
A perpetual ten-season timer resets on any meaningful player decision — accepting or declining an action, resolving a convergence event, or a deferred consequence firing. At ten seasons the world closes around the absence.

### World Dispatches
Historical events arrive in the Chronicle regardless of player action. The War of 1812, the Missouri Compromise, Jackson's election, the Anti-Slavery Society, Texas independence, the Mexican-American War, the Gold Rush. These are texture, not mechanics.

### Chronicle Display
The Chronicle groups all entries under a single season header. Ruin, win, and obscurity endings do not log Chronicle entries — their overlays are the record.

---

## The Stars

**Esperanza Vallejo — Land Grant Heir**
Passions: Land Security, Anglo Distrust, Coalition Strength.
Her family held this land before American annexation, before the surveys, before any of the paper that now claims to govern it. Forty-seven people's livelihoods depend on the grant holding. She has seen what happens when new landowners arrive with money and intentions. The difference between you and the ones who came before, if there is one, is not yet established.

**Solomon Reed — Freedman & Trader**
Passions: Permanence, Independence, Brotherhood (hidden).
He built something in this valley with no safety net and no federal protection, with 31 people who orbit his post and have no other reliable anchor in the valley. The post has grown to a size where it is no longer easy to ignore. You may be the first whose noticing matters to him.

**J.T. Whitmore — Railroad Surveyor**
Passions: Corridor Claim, Company Standing, The Distance (hidden).
Pacific Railroad's man in the valley, with 89 people's livelihoods running through the company. He is professional, thorough, and operating under instructions written in an office a long way from this valley. He is under no illusions about what his presence means for the people who were here first.

---

## Stack

- React 19
- Vite
- No external UI libraries — all styling is inline
- Deployed on Vercel

**Architecture.** The entire game is a single `App.jsx` file (~3,700 lines). State is managed with `useReducer`; theme tokens are distributed via `ThemeContext` through a `mkT(darkMode)` function. Core logic functions (`macropassionValue`, `effectiveMP`, `computeModifiers`, `effectVisibility`, `checkRuin`, `checkWin`) are small and pure. Stars are primary entities with their own `ya` timeline fields and optional `spawnCondition` functions — `revealedStars` state drives Persons column visibility directly, with no action-derived inference. The `computeModifiers` function derives all active buffs and debuffs from current macropassion at action resolution with no persistent modifier state.

**Scenario config.** A `SCENARIO` object at the top of the file holds every setting-specific string and value. To run the engine in a different setting, replace `SCENARIO` and supply new `INITIAL_STARS`, `ACTIONS`, `GUEST_POOL`, `CONVERGENCE_EVENTS`, and `WORLD_DISPATCHES`. The engine requires no other modification.

---

## Running Locally

```bash
npm install
npm run dev
```

---

## Design Considerations for Larger Scenarios

The three-Star prototype is a proof of concept. The engine is designed to scale, and several design problems become visible only at scale.

**Star count and faction structure.** Scenarios can support anywhere from three Stars to upwards of twenty-five. At scale, Stars should be organized into factions — major factions carrying five to ten Stars each, minor factions carrying one or two. Dynamic Stars with `spawnCondition` functions handle faction emergence, antagonist arrival, and relationship-triggered characters natively.

**Star mortality.** In Levine's original framework, Stars were not protected — this is a medieval action game where characters can be killed. A dead Star's community doesn't disappear; someone inherits their constituency and their grievances. Successor relationships are a design problem in their own right. Ruin and win conditions need to account for absence, not just hostility.

**Inter-Star passions.** The current model is player-centric: every Passion measures a Star's relationship to the player. But Stars should also carry Passions toward each other — making player actions create ripples between Stars that don't pass through the player at all. The player becomes a catalyst in relationships they don't fully control. The data model already partially supports this: effects arrays can reference any Star.

**Scenario-specific passion types.** In a medieval action scenario, a Star might carry a Passion for the player's survival — or for their death. Passions directional toward other Stars open up emergent storylines that the current model can't generate — firing in the background and surfacing in the Chronicle as events the player didn't cause but must navigate.

The full design document is in the [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/) under Game Concepts → GC-003.

---

## Prototype Scope and Known Gaps

**Action density collapses after 1824.** The last core action is in 1824. The obscurity timer provides a structural floor, but the absence of new player agency in the final twenty-four years is a content gap, not a systems gap.

**The Distance doesn't arc.** Whitmore's hidden Passion has presence early and appears in one convergence event, but has no quest chain. Brotherhood builds through four linked actions. The Distance doesn't.

**The fourth convergence event's trigger is invisible.** Three Letters in One Week fires when all three Stars' absolute macropassion values reach 30. The combined cross-Star condition is never displayed to the player.

**The buff/debuff table is partially implemented.** The modifier architecture is in place and cumulative effects apply at action resolution, but the per-Star per-dominant-passion specific effects documented in the design notes are not yet fully wired. The infrastructure holds; the authorship is pending.

**The Chronicle doesn't support cause-and-effect navigation.** Tracing a deferred consequence back to its origin requires finding the original entry in the scroll. This is the gap the compounding newspaper mechanic is meant to address in the full version.

---

## Contact

wendell91097@gmail.com · [sovereigndev.itch.io](https://sovereigndev.itch.io) · [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/)
