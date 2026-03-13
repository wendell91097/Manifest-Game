# Manifest

**Live prototype:** https://manifest-henna.vercel.app/

Narrative strategy game set in the 1800s American West. Built in React. Part of a larger game design project documented at the [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/).

---

## What This Is

A newspaper-desk strategy game. You are a landowner at the crossroads of everything America is becoming. Three people — Esperanza Vallejo, Solomon Reed, and Reverend Whitmore — have noticed what you do with your leverage. Every season you make decisions. Every decision moves something.

This is a prototype. It proves the threshold system works. The full scope — fifty years, a guest roster, the compounding newspaper mechanic — is still ahead.

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

Each band is a behavioral state, not a number. Crossing a threshold changes what that person does in the world — concretely, legibly, with downstream consequences.

**Seasons** advance on the player's call. The Decisions column shows what requires your hand this season. The Chronicle logs everything in period voice. The Persons column tracks where each Star stands across all their Passions.

**Ruin** is possible. Enough threshold crossings in the wrong direction and the game ends early.

---

## The Stars

**Esperanza Vallejo — Land Grant Heir**
Passions: Land Security, Personal Trust, Coalition Strength.
She represents 47 people whose livelihoods depend on the Vallejo grant. At Devoted she names you a public protector of the old grants. At Irreconcilable she pursues you in court by name.

**Solomon Reed — Freedman & Trader**
Passions: Permanence, Independence, Network Reach.
He built something in this valley with no safety net. At Devoted he lists you as a trusted partner in territorial filings. At Irreconcilable he relocates his most valuable operations beyond your reach.

**Reverend Whitmore — Territorial Institutions**
Passions: Moral Authority, Federal Alignment, Settlement Order.
The institutional face of the expanding American project. Useful. Expensive to cross. At Devoted he endorses your interests from the pulpit. At Irreconcilable he testifies against you in federal proceedings.

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

The design question this prototype answers: does the threshold system produce meaningful decisions? A tension between Stars that can't be resolved by optimizing all three simultaneously — where serving Esperanza's land interests slides Solomon toward Strained, and backing Whitmore's institutional order costs both.

It does. That's what the prototype is for.

The full design document is in the [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/) under Game Concepts → GC-003.

---

## Contact

wendell91097@gmail.com · [sovereigndev.itch.io](https://sovereigndev.itch.io) · [QA Portfolio](https://wendell91097.github.io/QA-Portfolio/)
