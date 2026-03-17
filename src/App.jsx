import { useState, useReducer, useRef, useEffect, createContext, useContext } from "react";

// ─── SCENARIO CONFIG ──────────────────────────────────────────────────────────
// Everything here is scenario-specific. To hot-swap this engine into a new
// setting — a Greek temple, a medieval trading post, a colonial court — replace
// SCENARIO with a new object and supply new INITIAL_STARS, ACTIONS, GUESTS,
// CONVERGENCE_EVENTS, and WORLD_DISPATCHES. The engine (reducer, threshold
// system, fame/infamy, ruin, deferred consequences) is fully agnostic to
// the content of those arrays and will run any valid scenario data without
// modification.
const SCENARIO = {
  // Identity
  gameName:    'MANIFEST',
  paperName:   'The Territorial Standard',
  paperEst:    'Est. 1810',
  accentColor: '#c9a14a',

  // Typography
  fonts:       `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');`,
  displayFont: "'Playfair Display', serif",
  monoFont:    "'Courier Prime', monospace",

  // Time
  startYear:     1810,
  startSeason:   'Spring',
  timeUnits:     ['Spring', 'Summer', 'Autumn', 'Winter'],
  timeUnitLabel: 'Season',

  // UI labels
  panelStars:     'Personal Relationships',
  panelDecisions: 'Matters Requiring Decision',
  chronicleHeader: (paperName) => `${paperName} — Chronicle`,
  emptyLedger:    'The ledger is empty.\n\nYou have land, some money, and a series of obligations not yet named.',
};

// ─── THEME ───────────────────────────────────────────────────────────────────
// mkT(darkMode) returns a token object consumed via ThemeCtx throughout all
// components. Two palettes: dark (charred parchment) and light (aged newsprint).
// Token naming convention:
//   bg/surf/card/hdr       — surface layers, darkest → lightest
//   cardHov/cardSub        — hover and nested card variants
//   bdr/bdrHi/bdrSub       — border intensities
//   ink/inkMid/inkMut/inkDim/inkFaint/inkWhy  — text hierarchy
//   dispInk/dispFaint      — dispatch/newspaper card text (inverted in dark mode)
//   modalBg                — semi-opaque modal overlay
//   defBg/reactBg/newBg/inactBg/ruinBg/ruinCardBg — entry-type tint layers
const ThemeCtx = createContext({});

function mkT(dm) {
  // Layout tokens — theme-independent, merged into every T object so components
  // access spacing, typography, and color through a single context value.
  const layout = {
    // Typography scale
    fsXxs: 7,   // meta labels, type badges, ● New markers
    fsXs:  8,   // captions, section headers, tooltips
    fsSm:  9,   // body small, why text, behavior descriptions
    fsMd:  10,  // body standard, effect labels
    fsBase: 11, // body large, log body text
    fsMdLg: 13, // card titles, dispatch headings
    // Shape
    radiusSm: 1,  // progress bars, thin tracks
    radius:   2,  // cards, buttons, badges, modals
    // Line heights
    lhSnug:    1.4,
    lhNormal:  1.5,
    lhRelaxed: 1.55,
    lhLoose:   1.65,
    // Letter spacing
    lsSm:     '0.07em',
    lsNormal: '0.1em',
    lsMd:     '0.12em',
    lsWide:   '0.15em',
    lsXWide:  '0.2em',
    // Padding
    padBadge:   '1px 5px',
    padBtn:     '4px 12px',
    padTip:     '7px 10px',
    padCardSm:  '8px 10px',
    padSection: '9px 12px',
    padCard:    '10px 12px 12px',
    padModal:   '28px 28px 24px',
    // Gap
    gapSm: 5,
    gapMd: 8,
  };
  return { ...layout, ...(dm ? {
    bg:'#0e0c07',surf:'#141008',card:'#1a1508',hdr:'#1a1408',
    cardHov:'#1e1a09',cardSub:'#211c0a',
    bdr:'#2a2110',bdrHi:'#453618',bdrSub:'#22190a',
    ink:'#e4d4a8',inkMid:'#c0a878',inkMut:'#aa9068',inkDim:'#8a7040',
    inkFaint:'#6a5828',inkWhy:'#9a8058',dispInk:'#d4c090',dispFaint:'#8a7848',
    modalBg:'rgba(8,7,4,0.92)',defBg:'#110606',reactBg:'#0e0a18',
    newBg:'#161208',inactBg:'#110a08',ruinBg:'#0a0806',ruinCardBg:'#141008',
    scrollTrack:'#0e0c07',scrollThumb:'#2a2110',scrollHover:'#453618',
  } : {
    // Aged newsprint parchment — dark brown ink only, NO hue inversion
    bg:'#f2ead6',surf:'#e9e0c8',card:'#e4dac4',hdr:'#ddd4bc',
    cardHov:'#d8cfb8',cardSub:'#d2c9b0',
    bdr:'#b8a880',bdrHi:'#8a7850',bdrSub:'#c4b48a',
    ink:'#18110a',inkMid:'#26190e',inkMut:'#40301a',inkDim:'#5c4828',
    inkFaint:'#7a6040',inkWhy:'#4a3820',dispInk:'#18110a',dispFaint:'#5c4828',
    modalBg:'rgba(210,196,168,0.96)',defBg:'#f0e8e0',reactBg:'#ede8f2',
    newBg:'#eae4d0',inactBg:'#ede6d4',ruinBg:'#f2ead6',ruinCardBg:'#e9e0c8',
    scrollTrack:'#f2ead6',scrollThumb:'#b8a880',scrollHover:'#8a7850',
  }) };
}

// ─── FAME / INFAMY SYSTEM ─────────────────────────────────────────────────────
// Fame and Infamy measure political/power relevance — not a permanent ledger,
// but how much you currently register in each Star's world.
//
// Decay: tiered by current value. Grace period: no decay in the season a value
// was last modified — tracked via fameLastChanged / infamyLastChanged tick stamps.
//   0–30:   1.00 points/season
//   30–50:  0.75 points/season
//   50–100: 0.50 points/season
//
// Effective Standing: integrates MP with fame/infamy into one value used by ruin.
//   For allies  (mp >= 0): effectiveMP = mp × (1 + fame/100) × (1 - infamy/100)
//   For enemies (mp <  0): effectiveMP = mp × (1 + infamy/100) × (1 - fame/100)
//
//   Fame amplifies allies and dampens enemies.
//   Infamy amplifies enemies and dampens allies.
//   Each force is zeroed out at 100 on the opposing side.

// ─── UNIFIED RUIN / OBSCURITY CHECK ──────────────────────────────────────────
// Classification uses raw macropassion — how they feel about you.
// Cohesion is measured by effectiveMP — what they can actually do about it.
//
// allies  = Stars with macropassion > +15  (Cautious Friend or better)
// enemies = Stars with macropassion < -15  (Clear Competitor or worse)
// neutral = -15 to +15                     (excluded from both sides)
//
// allyCohesion  = mean(effectiveMP of allies)
// enemyCohesion = mean(|effectiveMP| of enemies)
//
// RUIN fires when:      enemies exist AND enemyCohesion > allyCohesion
// OBSCURITY fires when: decisionTick >= 20
//   — suppressed if:    allies exist AND allyCohesion > enemyCohesion
//   — becomes RUIN if:  enemyCohesion > allyCohesion at that moment
//   — fires normally if: no allies AND no enemies (pure neutral)

function ruinStrengths(stars) {
  const starList = Object.values(stars);
  const allies  = starList.filter(s => macropassionValue(s.passions) > 15);
  const enemies = starList.filter(s => macropassionValue(s.passions) < -15);
  const allyCohesion  = allies.length  ? allies.reduce((sum,s)  => sum + effectiveMP(s), 0)          / allies.length  : 0;
  const enemyCohesion = enemies.length ? enemies.reduce((sum,s) => sum + Math.abs(effectiveMP(s)), 0) / enemies.length : 0;
  return { allyCohesion, enemyCohesion, allies, enemies };
}

function isRuined(stars) {
  const { allyCohesion, enemyCohesion, enemies } = ruinStrengths(stars);
  return enemies.length > 0 && enemyCohesion > allyCohesion;
}

function isObscuritySuppressed(stars) {
  const { allyCohesion, enemyCohesion, allies, enemies } = ruinStrengths(stars);
  // Suppressed if allies exist and ally cohesion exceeds enemy cohesion
  return allies.length > 0 && allyCohesion > enemyCohesion;
}

function decayRate(value) {
  if (value <= 30)  return 1.00;
  if (value <= 50)  return 0.75;
  return 0.50;
}

// Effective standing — MP amplified by politically relevant pressure in its own direction.
//
// Fame and infamy are both positive amplifiers, but they act on opposite signs:
//   fame  amplifies positive MP (ally strength) and dampens negative MP (enemy strength)
//   infamy amplifies negative MP (enemy strength) and dampens positive MP (ally strength)
//
//   effectiveMP = mp × (1 + fame/100) × (1 - infamy/100)   when mp >= 0 (ally)
//   effectiveMP = mp × (1 + infamy/100) × (1 - fame/100)   when mp <  0 (enemy)
//
// This means:
//   An ally with high fame hits harder for you. High infamy softens them.
//   An enemy with high infamy hits harder against you. High fame softens them.
//   At infamy/fame = 100, the opposing force is fully zeroed out.
function effectiveMP(star) {
  const mp = macropassionValue(star.passions);
  if (mp >= 0) {
    // Ally path: fame amplifies, infamy dampens
    return mp * (1 + star.fame / 100) * Math.max(0, 1 - star.infamy / 100);
  } else {
    // Enemy path: infamy amplifies magnitude, fame dampens it
    return mp * (1 + star.infamy / 100) * Math.max(0, 1 - star.fame / 100);
  }
}

// ─── THRESHOLD SYSTEM ────────────────────────────────────────────────────────
// Each passion runs -100 to +100, starting at 0.
// Positive = player's actions align with what this person cares about.
// Negative = player's actions work against it.
// Thresholds at ±15, ±30, ±50, ±75, ±100 unlock named states and described behaviors.

const THRESHOLDS = [
  { min:  75, max:  100, label: 'Devoted',        valence: 'positive' },
  { min:  50, max:   75, label: 'Steadfast',       valence: 'positive' },
  { min:  30, max:   50, label: 'Trusted',         valence: 'positive' },
  { min:  15, max:   30, label: 'Favorable',       valence: 'positive' },
  { min: -15, max:   15, label: 'Neutral',         valence: 'neutral'  },
  { min: -30, max:  -15, label: 'Strained',        valence: 'negative' },
  { min: -50, max:  -30, label: 'Opposed',         valence: 'negative' },
  { min: -75, max:  -50, label: 'Hostile',         valence: 'negative' },
  { min: -100, max: -75, label: 'Irreconcilable',  valence: 'negative' },
];

function getThreshold(v) {
  return THRESHOLDS.find(t => v >= t.min && (v < t.max || (t.max === 100 && v <= 100))) || THRESHOLDS[4];
}

function thresholdColor(v) {
  if (v >= 75)  return '#4a8e42';
  if (v >= 50)  return '#6a9e42';
  if (v >= 30)  return '#8aae42';
  if (v >= 15)  return '#9aae52';
  if (v > -15)  return '#8a8060';
  if (v > -30)  return '#be8040';
  if (v > -50)  return '#be6030';
  if (v > -75)  return '#be3820';
  return '#9e1a10';
}

// ─── STARS ───────────────────────────────────────────────────────────────────
// Passions are now all positive-directional spectrums.
// value = how well the player has served this passion (-100 to +100).
// behaviors = what this person does at each threshold band, from the player's perspective.

const INITIAL_STARS = {
  esperanza: {
    id: 'esperanza', name: 'Esperanza Vallejo', role: 'Land Grant Heir',
    ya: 1810, yaSeasonIdx: 0, // present from game start — predates the player's arrival
    color: '#c87830',
    community: 'The Californio families of the valley and their servants — 47 people whose livelihoods depend on the Vallejo grant.',
    intro: {
      headline: 'The Vallejo grant has been here longer than the territory has.',
      body: "Esperanza Vallejo's family held this land before American annexation, before the surveys, before any of the paper that now claims to govern it. Forty-seven people's livelihoods depend on the grant holding. She has seen what happens when new landowners arrive with money and intentions. The difference between you and the ones who came before, if there is one, is not yet established.",
      paperLine: "The Territorial Standard notes the Vallejo grant remains active in the valley. Esperanza Vallejo, of the old Californio families, is understood to be accounting for new arrivals.",
      continueLabel: "She'll be watching",
    },
    passions: {
      land: {
        label: 'Land Security',
        desc: 'The survival of the Vallejo grant against legal and physical encroachment.',
        value: 0,
        behaviors: {
          75:  'She names you publicly as a protector of the old grants. Doors open.',
          50:  'She consults you before any legal decision touching the land.',
          30:  'She shares intelligence about railroad survey movements.',
          15:  'She acknowledges your role and returns correspondence promptly.',
          0:   'No position formed on this yet.',
          '-15': 'She no longer invites you to family gatherings.',
          '-30': 'She warns the coalition families about your land dealings.',
          '-50': 'She files counter-claims against any holdings you share with the railroad.',
          '-75': 'She pursues you in court by name.',
        },
      },
      trust: {
        label: 'Anglo Distrust',
        desc: 'A weaker Anglo presence gives the Californio families more influence in the valley.',
        value: 0,
        behaviors: {
          75:  'She tells you things she tells no one else. You are inside the circle.',
          50:  'She introduces you to the coalition as someone worth knowing.',
          30:  'She speaks well of you to the Californio families unprompted.',
          15:  'She assumes good faith in your dealings.',
          0:   'No position formed on this yet.',
          '-15': 'She qualifies every exchange with visible reservation.',
          '-30': 'She assumes your motives serve the railroad, not the valley.',
          '-50': 'She refuses private meetings. All dealings through intermediaries.',
          '-75': 'She tells people what you did. By name.',
        },
      },
      coalition: {
        label: 'Coalition Strength',
        desc: 'The unity of the old Californio families in resisting displacement.',
        value: 0,
        behaviors: {
          75:  'The coalition formally names you a friend of Californio interests.',
          50:  'Coalition members extend you credit, shelter, and legal standing.',
          30:  'You are welcome at coalition meetings as a neutral observer.',
          15:  'Individual family members speak to you candidly.',
          0:   'No position formed on this yet.',
          '-15': 'You are discussed, not favorably, at meetings you are not invited to.',
          '-30': 'The coalition treats you as a hostile interest.',
          '-50': 'They organize specifically against your land transactions.',
          '-75': 'Every legal move you make in the valley is contested.',
        },
      },
    },
    fame: 0, infamy: 0, fameLastChanged: null, infamyLastChanged: null,
  },

  solomon: {
    id: 'solomon', name: 'Solomon Reed', role: 'Freedman & Trader',
    ya: 1810, yaSeasonIdx: 1, // post has been here — becomes relevant Summer 1810
    color: '#5a8e52',
    community: 'The freedmen, mixed-race families, and independent traders who orbit Reed\'s post — 31 people with no other reliable anchor in the valley.',
    intro: {
      headline: 'Reed\'s Trading Post has been a fixture of the valley road for some years.',
      body: "Solomon Reed built it from nothing, without federal protection and without the kind of backing that makes building easy. It has grown quietly — thirty-one people orbit it now, freedmen and mixed-race families and independent traders who have no other reliable anchor in the valley. It has reached a size where it is no longer easy to ignore. You are not the first to notice. You may be the first whose noticing matters to him.",
      paperLine: "Reed's Trading Post on the valley road continues to expand its commercial reach. Solomon Reed, proprietor, has not sought attention and has not been given the courtesy of avoiding it.",
      continueLabel: 'The post is noted',
    },
    passions: {
      roots: {
        label: 'Permanence',
        desc: 'His ability to build something in this valley that cannot be taken from him.',
        value: 0,
        behaviors: {
          75:  'He formally lists you as a trusted partner in territorial filings.',
          50:  'He involves you in the post\'s long-term decisions.',
          30:  'He extends you credit and storage without being asked.',
          15:  'He notices when you act in his interest and says so.',
          0:   'No position formed on this yet.',
          '-15': 'He stops sharing information about what moves through the post.',
          '-30': 'He routes valuable trade around you.',
          '-50': 'He tells the freedmen network to be cautious of you.',
          '-75': 'He relocates the post\'s most valuable operations beyond your reach.',
        },
      },
      autonomy: {
        label: 'Independence',
        desc: 'His freedom from federal entanglement, railroad dependency, and obligations he did not choose.',
        value: 0,
        behaviors: {
          75:  'He openly credits you with protecting his independence. It is worth something.',
          50:  'He shares routes, contacts, and information he shares with very few.',
          30:  'He will do you a favor off the books. No record.',
          15:  'He trusts that you understand the difference between help and control.',
          0:   'No position formed on this yet.',
          '-15': 'He keeps transactions formal and brief.',
          '-30': 'He considers you part of the system he is trying to avoid.',
          '-50': 'He refuses to do business where federal or railroad paper is involved.',
          '-75': 'He considers you a threat to everything he has built.',
        },
      },
      caleb: {
        label: 'Brotherhood',
        desc: 'The search for his brother Caleb, missing since the Nevada silver rush.',
        // hiddenUntil: 15 matches the "Cautious Friend" macro-passion threshold —
        // the full 3-passion average (roots + autonomy + caleb) after grant_sanctuary
        // and lend_solomon. Using the same average as the display label means no jump
        // on reveal. state.revealedPassions locks it permanently once crossed.
        hiddenUntil: 15,
        value: 0,
        behaviors: {
          75:  'He says you gave him back something he had stopped believing he would find.',
          50:  'He introduces you to Caleb, who is wary but present.',
          30:  'He names your help openly, which is rare for him.',
          15:  'He tells you more about Caleb than he tells most people.',
          0:   'No position formed on this yet.',
          '-15': 'He stops mentioning Caleb around you.',
          '-30': 'He believes you complicated the search.',
          '-50': 'He holds you responsible for time lost.',
          '-75': 'This is the thing he does not forgive.',
        },
      },
    },
    fame: 0, infamy: 0, fameLastChanged: null, infamyLastChanged: null,
  },

  whitmore: {
    id: 'whitmore', name: 'J.T. Whitmore', role: 'Railroad Surveyor',
    ya: 1811, yaSeasonIdx: 0, // arrives Spring 1811 to begin the survey
    color: '#3e6e9a',
    community: 'The survey crews, company agents, and federal contacts working the northern corridor — 89 people whose livelihoods run through Pacific Railroad.',
    intro: {
      headline: 'J.T. Whitmore has arrived to survey the northern corridor.',
      body: "Pacific Railroad sent him. He is professional, thorough, and operating under instructions that were written in an office a long way from this valley. Eighty-nine people's livelihoods run through the company he represents. He did not choose the route — the route was chosen for him — and he is under no illusions about what his presence here means for the people who were here first. He is watching you the way a man watches someone who might make his work easier or considerably harder.",
      paperLine: "J.T. Whitmore of Pacific Railroad has arrived in the valley to conduct survey work on the proposed northern corridor. He is understood to carry federal authority for the filing.",
      continueLabel: 'The valley awaits your decisions',
    },
    passions: {
      corridor: {
        label: 'Corridor Claim',
        desc: 'The completion and legal dominance of the northern survey route — unobstructed from the valley to Shasta.',
        value: 0,
        behaviors: {
          75:  'He treats your land as an extension of the railroad\'s protected zone. The company\'s legal resources are effectively yours.',
          50:  'He shares advance notice of survey movements and federal filings, and tips you to competing claims he plans to suppress.',
          30:  'He smooths your dealings with federal offices. Your paperwork moves without a fight.',
          15:  'He treats your land transactions as legitimate and notes your name favorably in corridor filings.',
          0:   'No position formed on this yet.',
          '-15': 'He flags your transactions for legal review and notes your name in obstructive filings.',
          '-30': 'He files competing surveys against your boundary claims and routes crews to maximize pressure.',
          '-50': 'He funds active legal challenges to your property and challenges your standing in federal court.',
          '-75': 'He treats your land as an enemy holding and brings the full weight of Pacific Railroad\'s legal office against it.',
        },
      },
      standing: {
        label: 'Company Standing',
        desc: 'His advancement within Pacific Railroad — his ability to be the man who delivers the northern route.',
        value: 0,
        behaviors: {
          75:  'He names you in his reports as instrumental. The company knows you.',
          50:  'He leverages his rising position to smooth your dealings in Sacramento.',
          30:  'He introduces you to the company\'s legal office as a useful contact.',
          15:  'He speaks your name in rooms you are not in.',
          0:   'No position formed on this yet.',
          '-15': 'He omits you from his correspondence.',
          '-30': 'He tells the company you are an obstacle.',
          '-50': 'He assigns survey resources to work against your land interests.',
          '-75': 'He brings the full weight of Pacific Railroad\'s legal office against you.',
        },
      },
      margaret: {
        label: 'The Distance',
        desc: 'His wife Margaret in Cincinnati — the months that became years, and what that silence is costing both of them.',
        hiddenUntil: 15,
        value: 0,
        behaviors: {
          75:  'He shows you her letters. He talks about going home. For the first time he sounds like a man with something to lose beyond the route.',
          50:  'He mentions her by name. Not often. When he does, it means he trusts you with something he doesn\'t share with the company.',
          30:  'He has started leaving Sundays clear. It is a small sign. You notice it.',
          15:  'He is more measured than his orders require. Someone is moderating him.',
          0:   'No position formed on this yet.',
          '-15': 'He has stopped writing letters east. The survey crew has noticed the change in him.',
          '-30': 'He takes risks with the survey timeline the company hasn\'t sanctioned. He is trying to finish and go home and it is making him sloppy.',
          '-50': 'He is making commitments he cannot keep. The company will notice before she does.',
          '-75': 'He has stopped mentioning going home. Something has broken in him that the corridor will not fix.',
        },
      },
    },
    fame: 0, infamy: 0, fameLastChanged: null, infamyLastChanged: null,
  },
};

// ─── REPUTATION GRID ─────────────────────────────────────────────────────────
// Each entry: { label, behavior }
// label    — what you are called in rooms you're not in
// behavior — what that Star actually does differently at this reputation state
const REP_LABELS = {
  esperanza: {
    HH: { label: 'Known Paradox',    behavior: "She has publicly backed you and publicly opposed you. Coalition members ask her about you directly; her answers are careful and noncommittal. She won't move against you, but she won't take a room for you either." },
    HL: { label: 'Honored Neighbor', behavior: "She names you in coalition meetings as someone who has acted correctly. Families extend small courtesies unprompted. The valley's doors open a little wider when your name is attached." },
    LH: { label: 'Dangerous Debtor', behavior: "She hasn't pressed the attack herself, but coalition members treat your presence as a liability. Introductions dry up. Credit that existed last season doesn't this one." },
    LL: { label: 'Quiet Neighbor',   behavior: "You have not made enough of an impression in either direction to register in her accounting. She neither advances nor obstructs you." },
  },
  solomon: {
    HH: { label: 'Double-Sided Coin', behavior: "He trades with you but rarely in front of witnesses. Useful, watchful, noncommittal. You are neither inside the circle nor outside it — something more ambiguous than either." },
    HL: { label: 'Good Credit',       behavior: "He routes valuable information your way first and extends terms without being asked. His people treat your name as a reference. The post works with you." },
    LH: { label: 'Shadowed Account',  behavior: "He serves you across the counter but won't be seen standing beside you. Others at the post notice. His name won't appear next to yours in any record that matters." },
    LL: { label: 'Passing Through',   behavior: "You have not yet mattered enough to the post's world to be trusted or feared. He extends no unusual courtesy and registers no particular caution." },
  },
  whitmore: {
    HH: { label: 'Useful Enemy',       behavior: "He works against your interests in court while privately respecting your competence. The company knows your name as a complication worth accounting for — which is its own kind of standing." },
    HL: { label: 'Company Man',        behavior: "His legal office treats your filings as friendly. Federal contacts in Sacramento smooth your paperwork without requiring explanation. You are on the right side of the company's ledger." },
    LH: { label: 'Liable Obstruction', behavior: "Survey crews have been briefed on your parcels. Every filing you make draws a counter within the week. The railroad's legal resources are pointed at your land specifically." },
    LL: { label: 'Inconsequential',    behavior: "You have not made enough of an impression on the company's interests to register as either asset or threat. He neither routes resources toward you nor against you." },
  },
};

// ─── ACTIONS ─────────────────────────────────────────────────────────────────
// effects: { star, passion, delta, why }
//   delta moves the passion value on the -100..100 spectrum
//   why explains in plain language why this passion moves

const ACTIONS = [
  {
    id: 'survey_support', ya: 1810, source: 'esperanza', msgType: 'Initiative',
    dispatch: "Commission a Survey of the Vallejo Grant",
    desc: "You will pay a surveyor to formally document the Vallejo grant's boundaries and submit them to the territorial examiner. The record becomes part of the legal landscape. So does your name.",
    result: "VALLEJO GRANT FORMALLY SURVEYED — Settler commissions boundary work on Californio land claim.",
    resultBody: "A survey of the Vallejo parcel was completed this spring at the commission of a local landholder. The documented boundaries have been submitted to the territorial examiner. Whitmore's company took notice of the filing within the week.",
    bodyHidden:  "A survey of the Vallejo parcel was completed this spring at the commission of a local landholder. The documented boundaries have been submitted to the territorial examiner. A party with interests in the northern corridor is said to have taken notice of the filing. Their name has not appeared in any record yet.",
    effects: [
      { star: 'esperanza', passion: 'land',     delta: +20, why: "A formal survey is the first legal protection the grant has had. It makes dispossession harder." },
      { star: 'esperanza', passion: 'trust',    delta: +10, why: "You acted in her interest without being asked and without asking for anything." },
      { star: 'whitmore',  passion: 'corridor', delta: -10, why: "The documented boundary complicates the corridor survey and legitimizes a competing land claim." },
    ],
    repBonus: [
      { star: 'esperanza', repState: 'HL', extraEffects: [{ star: 'esperanza', passion: 'coalition', delta: +10, why: "Your standing with the families gives the survey more legitimacy than the document alone would carry." }] },
    ],
    def: {
      years: 7,
      headline: 'VALLEJO GRANT SURVIVES SACRAMENTO TRIBUNAL — Documented boundaries upheld. Competing railroad survey dismissed as defective.',
      body: "Seven years after the original filing, Sacramento's land court ruled in favor of the Vallejo survey record. The railroad's competing plat was struck for irregularities. What had seemed a paper gesture in 1810 held the land in 1817.",
      effects: [
        { star: 'esperanza', passion: 'land',  delta: +20, why: "The court decision is now part of the permanent record." },
        { star: 'whitmore',  passion: 'corridor', delta: -20, why: "The corridor is legally obstructed by the upheld boundary." },
      ],
    },
  },
  {
    id: 'hold_letter', ya: 1810, yaSeasonIdx: 1, source: 'solomon', expires: 1810, expiresSeason: 'Winter', msgType: 'Request',
    dispatch: "Hold Solomon's Letter at the Post Under Your Name",
    desc: "Solomon has asked you to hold a piece of correspondence at the post under your name — not his. He does not explain why his own name cannot be on it. The ask is a small thing and an unusual one. You either accept or you don't.",
    result: "CORRESPONDENCE HELD — Letter received and kept under valley landholder's name.",
    resultBody: "A piece of correspondence arrived at the post this season and was held under a local landholder's name at the request of Solomon Reed. No further details were entered into the post's record. Reed did not explain the arrangement and was not asked to.",
    effects: [
      { star: 'solomon', passion: 'autonomy', delta: +10, why: "You accepted a quiet ask without pressing for an explanation. That is the kind of trust he does not take for granted." },
      { star: 'solomon', passion: 'caleb',    delta: +10, why: "The letter was for his brother. He does not know yet whether it will reach him. You made it possible." },
    ],
    def: null,
    inaction: {
      headline: "REQUEST DECLINED — Reed's arrangement fell through. Letter unplaced.",
      body: "Solomon Reed made a quiet request this season regarding a piece of correspondence. The arrangement was not made. He has not raised the matter again.",
      effects: [
        { star: 'solomon', passion: 'autonomy', delta: -5, why: "He asked a small thing without explanation and was turned away. He will not ask again." },
      ],
    },
  },
  {
    id: 'introduce_whitmore', ya: 1811, source: 'whitmore', expires: 1811, expiresSeason: 'Summer', msgType: 'Request',
    dispatch: "Introduce Whitmore to the Valley",
    desc: "Whitmore is known here as a railroad agent — a surveyor, a federal interest, an instrument of the company. You could change that. Land office contacts, the Merchant's Association, a dinner at the right house. He becomes a person in the valley rather than just a presence. The valley will remember who vouched for him.",
    result: "RAILROAD SURVEYOR INTRODUCED TO VALLEY SOCIETY — Local landholder brokers entry into merchant and land circles.",
    resultBody: "J.T. Whitmore of Pacific Railroad has been introduced to the valley's business community through the efforts of a local landholder. He attended a Merchant's Association dinner this month and was received without incident. Esperanza Vallejo was not present.",
    effects: [
      { star: 'whitmore',  passion: 'standing', delta: +10, why: "A man with standing in the valley is harder to recall and easier to work with. He knows what this cost you." },
      { star: 'whitmore',  passion: 'margaret', delta:  +10, why: "A life with weight here gives him something to describe in letters home. The work is not only exile. He has written more this month than in the previous three." },
      { star: 'esperanza', passion: 'trust',    delta: -10, why: "You socially sponsored the man whose surveys threaten her land. She does not separate the person from the instrument." },
      { star: 'solomon',   passion: 'autonomy', delta:  -5, why: "The railroad's man is now comfortable in the valley. Comfort has a way of becoming permanence." },
    ],
    def: null,
    inaction: {
      headline: "WHITMORE REMAINS OUTSIDE VALLEY CIRCLES — No introductions made. Railroad agent stays unknown.",
      body: "J.T. Whitmore has not been introduced to the valley's merchant and land community. He attends the Merchant's Association without a local sponsor and is received as what he is: a railroad man on company business.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: -5, why: "Without a local sponsor he remains an outsider in the rooms that matter." },
      ],
    },
  },
  {
    id: 'federal_claim', ya: 1811, source: 'whitmore', expires: 1812, mysteryExpiry: true, msgType: 'Proposal',
    dispatch: "Co-Sign the Federal Route Claim with Whitmore",
    desc: "Whitmore needs a local landowner's signature to give the federal filing credibility. Your name on this paper establishes the northern corridor as a federal zone and extinguishes prior claims within it. Esperanza will hear about it. Others in the valley will too.",
    descRevealed: { star: 'solomon', text: "Whitmore needs a local landowner's signature to give the federal filing credibility. Your name on this paper establishes the northern corridor as a federal zone and extinguishes prior claims within it. Solomon will see the filing. Esperanza will hear about it." },
    result: "LOCAL SETTLER JOINS RAILROAD IN FEDERAL FILING — Northern route corridor claim submitted to Washington.",
    resultBody: "A joint claim establishing the northern survey corridor was submitted to the federal land office, co-signed by a valley landholder and J.T. Whitmore of Pacific Railroad. The filing extinguishes prior competing claims within the corridor. Solomon Reed declined to comment.",
    bodyHidden:  "A joint claim establishing the northern survey corridor was submitted to the federal land office, co-signed by a valley landholder and J.T. Whitmore of Pacific Railroad. The filing extinguishes prior competing claims within the corridor. At least one valley trader was reached for comment. He declined.",
    effects: [
      { star: 'whitmore',  passion: 'corridor', delta: +20, why: "The federal co-signature clears the corridor's legal standing." },
      { star: 'whitmore',  passion: 'standing', delta: +10, why: "Securing local signatures is exactly what the company sent him here to do." },
      { star: 'solomon',   passion: 'autonomy', delta: -20, why: "Federal paper is now in the valley record, and you helped put it there. He knows." },
      { star: 'esperanza', passion: 'trust',    delta: -20, why: "You sided with the federal apparatus against valley interests. She noticed." },
      { star: 'esperanza', passion: 'land',     delta: -10, why: "The corridor filing encroaches on the grant's northern boundary." },
      { star: 'whitmore',  passion: 'margaret', delta:  -5, why: "Helping the railroad is helping the machine. He is grateful but it deepens the trench." },
    ],
    def: {
      years: 9,
      headline: 'NORTHERN CORRIDOR DECLARED FEDERAL LAND — Old grant claims extinguished. Railroad holds clear title.',
      body: "Nine years after the original filing, Washington's ruling is final. The corridor is federal. Every claim predating the 1811 joint filing is now void. What the settler's signature enabled in a single morning took nearly a decade to be fully understood.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: +30, why: "The company awarded him the credit for delivering the corridor." },
        { star: 'esperanza', passion: 'land',     delta: -30, why: "The federal ruling directly voids portions of the Vallejo grant." },
        { star: 'solomon',   passion: 'autonomy', delta: -20, why: "The federal presence in the valley is now permanent." },
      ],
    },
    inaction: {
      headline: 'FEDERAL CORRIDOR FILING STALLS — Railroad unable to secure local co-signature for northern route claim.',
      body: "Pacific Railroad's proposed federal filing for the northern corridor has been set aside for want of a credible local co-signatory. J.T. Whitmore has not commented publicly. The valley road is quiet, for now.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: -10,  why: "He was sent here to secure local signatures. He did not." },
        { star: 'esperanza', passion: 'trust',    delta: +5,  why: "You did not lend your name to the railroad's filing. She noticed the absence." },
      ],
    },
  },
  {
    id: 'lend_solomon', ya: 1812, source: 'solomon', msgType: 'Request', expires: 1813, expiresSeason: 'Winter', mysteryExpiry: true,
    dispatch: "Back Solomon's Warehouse with a Private Loan",
    desc: "Solomon needs capital for the new warehouse but wants no federal paper trail. You can extend a private note — no government strings, no Pacific Railroad bank, no record that anyone else can touch. He has asked no one else. He will not ask twice.",
    result: "REED'S TRADING POST EXPANDS — Private investment backs new warehouse construction on valley road.",
    resultBody: "Solomon Reed broke ground this week on a substantial warehouse addition to his trading post on the valley road. The project is privately financed. Reed would not name the backer. Whitmore's survey crew was observed marking the adjacent road corridor the same afternoon.",
    bodyHidden:  "Solomon Reed broke ground this week on a substantial warehouse addition to his trading post on the valley road. The project is privately financed. Reed would not name the backer. A survey crew was observed marking the adjacent road corridor the same afternoon. Their employer's name was not given to this paper.",
    effects: [
      { star: 'solomon', passion: 'roots',    delta: +20, why: "The warehouse makes his presence in the valley harder to uproot." },
      { star: 'solomon', passion: 'autonomy', delta: +10, why: "A private loan with no federal strings is exactly the kind of help he can accept." },
      { star: 'solomon', passion: 'caleb',    delta:  +5, why: "A stable base gives Caleb somewhere to come back to." },
      { star: 'esperanza', passion: 'coalition', delta: +5, why: "A strong independent post in the valley is a resource the coalition can use. She notices what you built." },
      { star: 'whitmore',passion: 'standing', delta:  -10, why: "A thriving independent post complicates the railroad's commercial ambitions in the valley." },
    ],
    def: {
      years: 6,
      headline: "REED'S POST NAMED COUNTY'S LEADING TRADING HUB — Warehouse expansion draws commerce from three counties.",
      body: "Six years after the expansion, Solomon Reed's post has become the valley's commercial anchor. Whitmore's planned company depot at the same junction was never built. The private loan has paid back in ways that cannot be counted in coin.",
      effects: [
        { star: 'solomon',  passion: 'roots',   delta: +20, why: "The post is now too established to displace quietly." },
        { star: 'whitmore', passion: 'corridor', delta: -10, why: "The commercial corridor bypasses the railroad's preferred path." },
      ],
    },
    inaction: {
      headline: "REED'S POST EXPANDS UNDER OUTSIDE BACKING — Warehouse finally built. Backer unknown.",
      body: "Solomon Reed's warehouse expansion eventually went forward, financed through a creditor outside the valley — terms he does not discuss and a relationship that cost him something to build. He found what he needed. It took longer than it should have, and you were not the one who provided it. He has not mentioned the arrangement.",
      effects: [
        { star: 'solomon', passion: 'roots',    delta: -10, why: "The expansion happened, but without you. The foundation of what he built here doesn't include your name." },
        { star: 'solomon', passion: 'autonomy', delta: -10, why: "He had to find another way in. That kind of patience has a cost he keeps to himself." },
      ],
    },
  },
  {
    id: 'testify_whitmore', ya: 1813, source: 'whitmore', expires: 1814, mysteryExpiry: true, msgType: 'Demand',
    moral: '"In the mouth of two or three witnesses shall every word be established." — 2 Corinthians 13:1',
    dispatch: "Give Sworn Testimony for Whitmore in Land Court",
    desc: "Whitmore's land case hinges on a credible local witness. He needs someone who can say under oath that they saw the survey markers, that the route was established. Render unto Caesar what is Caesar's — but a false oath is a different matter than a true one. Your word carries weight precisely because it is not yet spent.",
    result: "SETTLER TESTIFIES FOR RAILROAD IN DISPUTED SURVEY CASE — Sworn statement validates Pacific Railroad corridor claim.",
    resultBody: "A local landholder provided sworn testimony this week in the Sacramento land tribunal, affirming the validity of Pacific Railroad's northern survey. Esperanza Vallejo, present in the gallery, departed before the reading was concluded. The case continues.",
    effects: [
      { star: 'whitmore',  passion: 'corridor', delta: +20, why: "Your testimony is the credible local corroboration the case needed." },
      { star: 'whitmore',  passion: 'standing', delta: +20, why: "He delivered a witness. The company pays attention to that." },
      { star: 'esperanza', passion: 'trust',    delta: -20, why: "She was in the room when you testified. There is no interpretation that spares you." },
      { star: 'esperanza', passion: 'land',     delta: -20, why: "Your testimony directly supports the claim that threatens the grant." },
      { star: 'solomon',   passion: 'autonomy', delta: -10, why: "You participated in the federal legal system against valley interests. He did not miss it." },
      { star: 'whitmore',  passion: 'margaret', delta: +10, why: "You came when he needed someone to stand with him. That is not nothing, whatever your reasons." },
    ],
    repBonus: [
      { star: 'whitmore', repState: 'HL', extraEffects: [{ star: 'whitmore', passion: 'standing', delta: +10, why: "Your existing reputation with the company amplifies the value of your word. He can point to a track record." }] },
    ],
    def: {
      years: 4,
      headline: 'TRIBUNAL VERDICT FINAL: RAILROAD PREVAILS — Settler testimony cited as decisive. Disputed parcels awarded.',
      body: "Four years after the testimony, Sacramento's ruling is entered into the record. The disputed parcels pass to railroad title. The judge cited the local witness account as the deciding evidence. Esperanza Vallejo has not spoken to the settler since the day of testimony.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: +30, why: "He won the case. The company made him a district supervisor." },
        { star: 'esperanza', passion: 'land',     delta: -30, why: "The ruling extinguishes the disputed parcels. She lost them in court, with your help." },
      ],
    },
    inaction: {
      headline: 'RAILROAD SURVEY CASE WEAKENED — Local witness declines to appear. Tribunal questions corridor claim.',
      body: "Pacific Railroad's land tribunal case has been significantly weakened after an expected local witness did not appear to give testimony. J.T. Whitmore requested a continuance. The disputed parcels remain in question. The case continues without the corroboration he had anticipated.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: -10, why: "The case faltered without the local witness he promised the company he could deliver." },
        { star: 'whitmore',  passion: 'corridor', delta: -10,  why: "The corridor claim is legally weakened without sworn corroboration." },
        { star: 'esperanza', passion: 'land',     delta: +10, why: "The disputed parcels were not awarded. The threat recedes, for now." },
        { star: 'esperanza', passion: 'trust',    delta: +10,  why: "You were asked to testify against her interests. You did not come." },
      ],
    },
  },
  {
    id: 'find_brother', ya: 1814, source: 'solomon', msgType: 'Appeal', requiresPassionVisible: { star: 'solomon', passion: 'caleb' },
    dispatch: "Use Your Contacts to Search for Caleb Reed",
    desc: "Solomon has asked nothing of you. But you have riders and contacts across the territories and he does not. You can put word out carefully — staying off federal record, avoiding anything that draws official attention. This will cost you time, favors, and some exposure you cannot fully control.",
    result: "CALEB REED SOUGHT IN NEVADA TERRITORY — Valley merchant's brother believed to be in Comstock district.",
    resultBody: "Inquiries conducted through private channels have placed Caleb Reed, brother of Solomon Reed of this valley, in the vicinity of the Comstock silver district. The search was conducted outside federal record at the family's request. No further details at this time.",
    // Success chance: 100% in 1814, -10% per year. Floor at 20%.
    // Roll happens at play time in the reducer. Success fires def; failure fires failureEffects only.
    successChanceFn: (year) => Math.max(0.2, 1 - (year - 1814) * 0.1),
    effects: [
      { star: 'solomon', passion: 'caleb',    delta: +10, why: "You put real effort into finding someone he had given up finding on his own." },
      { star: 'solomon', passion: 'roots',    delta: +10, why: "The fact that someone worked for his family's benefit matters." },
      { star: 'solomon', passion: 'autonomy', delta: +10, why: "You did this outside federal channels, the way he needed it done." },
    ],
    def: {
      years: 3,
      headline: 'CALEB REED FOUND ALIVE IN COMSTOCK — Brother of valley merchant located after three years.',
      body: "Three years after the search began, Caleb Reed has been found working a claim near Virginia City. He is alive and in reasonable health. Solomon Reed received the news at his post and closed the store for the remainder of the day. The search succeeded because it was conducted quietly.",
      effects: [
        { star: 'solomon', passion: 'caleb',    delta: +30, why: "Caleb is found. Solomon knows who made that possible." },
        { star: 'solomon', passion: 'roots',    delta: +20, why: "His brother coming back changes what the valley means to him." },
        { star: 'solomon', passion: 'autonomy', delta: -10, why: "Caleb's arrival draws some outside attention he hadn't planned for." },
      ],
    },
    failureResult: "CALEB REED NOT FOUND — Search through private channels yields nothing.",
    failureResultBody: "Inquiries conducted through private channels have returned without result. No one who knows Caleb Reed's movements is talking, or no one who is talking knows. Solomon received the news quietly. He has not asked whether another attempt is possible.",
    failureEffects: [
      { star: 'solomon', passion: 'caleb', delta: -20, why: "The search came back empty. He has been gone long enough that what's left is mostly absence." },
    ],
  },
  {
    id: 'water_rights', ya: 1815, source: 'whitmore', msgType: 'Offer',
    moral: '"The earth is the LORD\'s, and the fulness thereof; the world, and they that dwell therein." — Psalm 24:1',
    dispatch: "Sell the Creek Easements to Pacific Railroad",
    desc: "Whitmore's company has made a substantial offer for the water rights over the creek corridor. The money is real. The valley farms that depend on that water for irrigation are also real. You can have the money or the valley can have the water. You cannot arrange both.",
    result: "CREEK CORRIDOR WATER RIGHTS SOLD TO PACIFIC RAILROAD — Valley easements transferred in private transaction.",
    resultBody: "Pacific Railroad has acquired the water rights to the upper creek corridor in a transaction concluded this month. Esperanza Vallejo called the sale 'a theft wearing a deed.' Farmers downstream have begun inquiring about alternative water sources.",
    effects: [
      { star: 'whitmore',  passion: 'corridor', delta: +20, why: "The creek corridor is now cleared for grading. The route is materially closer to complete." },
      { star: 'whitmore',  passion: 'standing', delta: +10, why: "Acquiring the water rights was his assignment. He delivered." },
      { star: 'esperanza', passion: 'land',     delta: -20, why: "Valley water rights are inseparable from land security. You sold them." },
      { star: 'esperanza', passion: 'trust',    delta: -20, why: "You chose the railroad's money over the valley's water. In her accounting, that is definitive." },
      { star: 'solomon',   passion: 'roots',    delta: -20, why: "A valley without reliable water is a valley that cannot sustain what he has built." },
    ],
    def: {
      years: 8,
      headline: 'RAIL LINE REACHES SHASTA — Creek corridor complete. Valley farms report third consecutive year of irrigation failure.',
      body: "Eight years after the easement sale, the railroad's northern line has reached Shasta. Three farms in the lower valley have been abandoned this season for want of water. The money spent well. The valley spent harder.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: +30, why: "Delivering the Shasta line made his career." },
        { star: 'esperanza', passion: 'land',     delta: -30, why: "Three abandoned farms near the grant have been absorbed by railroad land claims." },
        { star: 'solomon',   passion: 'roots',    delta: -10, why: "The commercial ecosystem his post depended on is contracting." },
      ],
    },
  },
  {
    id: 'californio_meeting', ya: 1817, source: 'esperanza', msgType: 'Request',
    dispatch: "Host the Californio Coalition at Solomon's Post",
    desc: "The old grant families want neutral ground for their coordinating meeting. Offering Solomon's post means asking Solomon to carry the political exposure you are creating. Whitmore will notice who provided the venue. This is not a neutral act, and the people in the room will know that.",
    result: "CALIFORNIO LAND COALITION CONVENES IN VALLEY — Meeting of old grant families held at trading post.",
    resultBody: "Representatives of the old Californio grant families convened this week at Reed's Trading Post on the valley road. Esperanza Vallejo chaired the session. J.T. Whitmore has filed a formal inquiry with the territorial office regarding the gathering.",
    effects: [
      { star: 'esperanza', passion: 'coalition', delta: +20, why: "A meeting that actually happened, in a safe venue, with the right families present." },
      { star: 'esperanza', passion: 'trust',     delta: +10, why: "You chose coalition ground over railroad ground in a season when that choice was not free. She registers that." },
      { star: 'solomon',   passion: 'roots',     delta:  +10, why: "The post has become a place of consequence. He understands the value of that." },
      { star: 'solomon',   passion: 'autonomy',  delta: -20, why: "The political exposure you created will follow him. Whitmore filed an inquiry the same week." },
      { star: 'whitmore',  passion: 'corridor',  delta: -20, why: "A coordinated coalition is precisely what he was sent here to prevent." },
    ],
    def: {
      years: 5,
      headline: 'CALIFORNIO COALITION FILES SUIT IN SACRAMENTO — Coordinated legal challenge targets railroad survey practices.',
      body: "Five years after the valley meeting, the coalition has filed a coordinated legal challenge against Pacific Railroad's survey methodology. Eight families are named as plaintiffs. The meeting you hosted in 1817 is now a lawsuit.",
      effects: [
        { star: 'esperanza', passion: 'land',      delta: +20, why: "The lawsuit has suspended railroad action on the disputed parcels." },
        { star: 'whitmore',  passion: 'corridor',  delta: -20, why: "The litigation has halted the northern corridor for at least a season." },
        { star: 'solomon',   passion: 'autonomy',  delta: -10, why: "The inquiry Whitmore filed in 1817 is now a deposition request." },
      ],
    },
  },
  {
    id: 'report_trespass', ya: 1818, source: 'esperanza', expires: 1819, mysteryExpiry: true, msgType: 'Appeal',
    dispatch: "File a Formal Trespass Complaint Against the Railroad",
    desc: "Whitmore's survey crew has crossed the Vallejo parcel without legal authorization, again. You can file a formal complaint with the territorial magistrate. Bearing false witness is a sin; so is silence in the face of wrong. He will not forget the name on the filing — but you will know what you did and did not do.",
    result: "TRESPASS COMPLAINT FILED AGAINST PACIFIC RAILROAD — Settler charges survey crew with unlawful entry on Vallejo parcel.",
    resultBody: "A formal trespass complaint has been filed with the territorial magistrate against Pacific Railroad survey personnel, alleging unlawful entry on the Vallejo parcel. J.T. Whitmore dismissed the filing as 'a nuisance action by a landowner with no standing.' The complaint has been accepted for review.",
    effects: [
      { star: 'esperanza', passion: 'land',     delta: +10, why: "The complaint creates a legal record of unauthorized survey entry." },
      { star: 'esperanza', passion: 'trust',    delta: +20, why: "You filed against the railroad on her land's behalf, at cost to yourself." },
      { star: 'whitmore',  passion: 'corridor', delta: -10, why: "The complaint delays survey work on the parcel." },
      { star: 'whitmore',  passion: 'standing', delta: -10, why: "His crew was named in a public filing. The company noticed." },
    ],
    def: null,
    inaction: {
      headline: 'RAILROAD SURVEY CREWS CONTINUE UNCHALLENGED ON VALLEJO PARCEL — No complaint filed. Work proceeds.',
      body: "Pacific Railroad survey personnel have continued operations on the Vallejo parcel without formal challenge. Esperanza Vallejo had sought a trespass filing. None was made. Whitmore's crew finished the season's marking work before the first snow.",
      effects: [
        { star: 'esperanza', passion: 'trust',    delta: -10, why: "She came to you with a specific ask. You said nothing." },
        { star: 'esperanza', passion: 'land',     delta: -10,  why: "No legal record of unauthorized entry. The crews continue." },
        { star: 'whitmore',  passion: 'corridor', delta: +5,  why: "Unchallenged survey progress. The season's marking work is complete." },
      ],
    },
  },
  {
    id: 'introduce_caleb', ya: 1819, source: 'solomon', msgType: 'Request',
    // Quest chain: find_brother must be completed before this action surfaces.
    // Without this, introduce_caleb would appear in 1819 regardless of whether
    // the search was ever conducted — bypassing the entire chain.
    requiresTaken: 'find_brother',
    dispatch: "Introduce Caleb Reed to the Valley Community",
    desc: "Caleb has arrived from Nevada and knows no one here. Solomon wants him established. You can open doors — make introductions, speak for him at the Merchant's Association meeting, use your standing as a local landowner to give him a foundation he could not build alone. Your standing is the currency you are spending.",
    result: "CALEB REED JOINS BROTHER'S TRADING CONCERN — Former Comstock miner settles in valley, joins family business.",
    resultBody: "Caleb Reed, recently arrived from the Nevada silver district, has been welcomed into his brother's trading concern on the valley road. A local settler provided the Merchant's Association introduction. Solomon Reed expressed gratitude in terms that were, for him, unusually direct.",
    effects: [
      { star: 'solomon', passion: 'caleb',    delta: +20, why: "Caleb is settled. The search that haunted him has a resolution." },
      { star: 'solomon', passion: 'roots',    delta: +10, why: "Two Reeds in the valley is harder to uproot than one." },
      { star: 'solomon', passion: 'autonomy', delta:  -10, why: "You spent social capital on his behalf. He is now, in some sense, obligated. He knows it and doesn't entirely like it." },
    ],
    def: {
      years: 4,
      headline: "REED BROTHERS EXPAND — New trading company formally registered. Valley's largest independent merchant concern.",
      body: "Four years after Caleb's arrival, the Reed brothers have incorporated under territorial law. Solomon manages the post; Caleb runs the Nevada routes. The introduction cost you standing at the Merchant's Association. It built something that will outlast the railroad's corridor planning.",
      effects: [
        { star: 'solomon',  passion: 'roots',   delta: +30, why: "The incorporated company is now a permanent valley institution." },
        { star: 'whitmore', passion: 'corridor', delta: -10, why: "An independent trading company of this scale complicates railroad commerce claims in the corridor." },
      ],
    },
  },
  {
    id: 'deed_esperanza', ya: 1820, source: 'esperanza', expires: 1822, mysteryExpiry: true, msgType: 'Request',
    dispatch: "Help Esperanza Secure the Deed in Her Own Name",
    desc: "The Vallejo grant is held under her late father's estate. She cannot navigate the territorial recorder's office without an Anglo intermediary — the law, in practice, requires one. You can serve that function. It is a half-day's work and it will bind you to her cause in ways that are not undone by subsequent choices.",
    result: "VALLEJO LAND GRANT RE-RECORDED UNDER ESPERANZA VALLEJO — Old Californio claim formally transferred to surviving heir.",
    resultBody: "The Vallejo land grant has been re-recorded in the name of Esperanza Vallejo following action at the territorial recorder's office. A local settler is noted as the filing intermediary. The grant is now formally held in a living name for the first time in fourteen years. Whitmore has been informed.",
    effects: [
      { star: 'esperanza', passion: 'land',      delta: +30, why: "The grant is now held in a living name that can actively defend it in court." },
      { star: 'esperanza', passion: 'trust',     delta: +20, why: "You navigated a system that is designed to exclude her, on her behalf. She will not forget." },
      { star: 'esperanza', passion: 'coalition', delta: +10, why: "Her secure title gives the coalition a concrete legal anchor." },
      { star: 'whitmore',  passion: 'corridor',  delta: -20, why: "A title in a living name both strengthens the boundary against encroachment and is far harder to challenge in court." },
    ],
    repBonus: [
      { star: 'esperanza', repState: 'HH', extraEffects: [{ star: 'esperanza', passion: 'trust', delta: +10, why: "Given the complicated history between you, this action lands differently. She did not expect it and says so." }] },
    ],
    def: {
      years: 6,
      headline: "VALLEJO DEED UPHELD AGAINST RAILROAD CHALLENGE — Court affirms Californio heir's title. Railroad appeal denied.",
      body: "Six years after the re-recording, Pacific Railroad's legal challenge to the Vallejo title has been denied at final appeal. The grant stands. Esperanza Vallejo's name is in the record and will remain there. The intermediary who made the filing possible was not mentioned in the court's opinion. They did not need to be.",
      effects: [
        { star: 'esperanza', passion: 'land',      delta: +30, why: "Final appeal denial. The title is permanent." },
        { star: 'whitmore',  passion: 'corridor',  delta: -20, why: "The corridor's northern segment is now legally obstructed by an unassailable claim." },
        { star: 'esperanza', passion: 'coalition', delta: +20, why: "A won case is more valuable to the coalition than any amount of organizing." },
      ],
    },
    inaction: {
      headline: 'VALLEJO DEED REMAINS IN ESTATE LIMBO — Re-recording effort abandoned. Title legally vulnerable.',
      body: "Efforts to re-record the Vallejo land grant under a living name have not proceeded. The title remains held under the original estate filing. Territorial law does not require the error to be corrected. Pacific Railroad's attorneys are aware of the situation.",
      effects: [
        { star: 'esperanza', passion: 'land',      delta: -20, why: "A title in estate limbo cannot actively defend itself in court. The vulnerability is known." },
        { star: 'esperanza', passion: 'trust',     delta: -10, why: "She needed an intermediary. The law required one. You did not come." },
        { star: 'esperanza', passion: 'coalition', delta: -10,  why: "The coalition needed a secured title as its legal anchor. It did not materialize." },
      ],
    },
  },

  // ─── REPAIR ACTIONS ──────────────────────────────────────────────────────────
  // Gate behind prior damage (requiresPassionBelow). All cost you with a third party.
  // Cheap repair makes earlier decisions meaningless; these are not cheap.

  {
    id: 'remedy_esperanza_trust', ya: 1820, source: 'esperanza', msgType: 'Reparation',
    requiresPassionBelow: { star: 'esperanza', passion: 'trust', threshold: -25 },
    dispatch: "Make a Public Declaration in Support of Californio Titles",
    desc: "You can't undo what you did, but you can say something publicly that costs you something. A formal declaration in support of Californio land titles — filed with the territorial recorder, not just spoken at a dinner — puts your name against the same machine you helped. Whitmore will see the filing before the ink is dry. The gap between what you said then and what you are saying now will be in the public record permanently.",
    result: "SETTLER FILES PUBLIC DECLARATION IN SUPPORT OF CALIFORNIO TITLES — Statement entered into territorial record.",
    resultBody: "A local landholder has filed a formal declaration with the territorial recorder affirming the legitimacy of Californio land grants under their original deeds. The statement names no specific properties but is understood to speak to the Vallejo parcel in particular. J.T. Whitmore has requested a copy. Esperanza Vallejo has not commented publicly.",
    effects: [
      { star: 'esperanza', passion: 'trust',     delta: +20, why: "A public declaration is not the same as undoing the damage. But it is a formal record, and she knows the cost." },
      { star: 'esperanza', passion: 'coalition', delta: +10, why: "The coalition treats a public Anglo declaration as a meaningful shift in the political landscape." },
      { star: 'whitmore',  passion: 'corridor',  delta: -10, why: "A declaration of this kind directly complicates the corridor's legal position." },
      { star: 'whitmore',  passion: 'standing',  delta:  -10, why: "The company will note your reversal. Whitmore answers for the people he recommended." },
    ],
    def: null,
  },
  {
    id: 'remedy_solomon_autonomy', ya: 1818, source: 'solomon', msgType: 'Reparation',
    requiresTaken: 'federal_claim',
    requiresPassionBelow: { star: 'solomon', passion: 'autonomy', threshold: -25 },
    dispatch: "Dissolve Your Federal Business Arrangement with the Railroad",
    desc: "You have obligations to the railroad that created the entanglement Solomon is still paying for. Withdrawing from those arrangements — ending the federal paperwork, walking away from the corridor's commercial filing — is not costless. Whitmore will know within the week. But Solomon will also know, and that has come to matter more than you expected it to.",
    result: "SETTLER WITHDRAWS FROM RAILROAD COMMERCIAL FILINGS — Federal land arrangement formally dissolved.",
    resultBody: "A local landholder has formally withdrawn from commercial filings associated with Pacific Railroad's northern corridor. J.T. Whitmore declined to comment. Solomon Reed, reached at his post, said only that he had noted the development.",
    effects: [
      { star: 'solomon',  passion: 'autonomy', delta: +20, why: "You removed yourself from the federal apparatus on his behalf. He will not forget the cost of what you gave up." },
      { star: 'solomon',  passion: 'roots',    delta: +10, why: "A valley with one less federal entanglement is better for what he has built." },
      { star: 'whitmore', passion: 'corridor', delta: -10, why: "Losing a co-filer complicates the corridor's commercial claims." },
      { star: 'whitmore', passion: 'standing', delta:  -10, why: "He vouched for you. Your reversal reflects on him. The company will notice." },
    ],
    def: null,
  },
  {
    id: 'remedy_whitmore_standing', ya: 1822, source: 'whitmore', msgType: 'Reparation',
    requiresPassionBelow: { star: 'whitmore', passion: 'standing', threshold: -25 },
    dispatch: "Supply Whitmore with Evidence for His Audit Defense",
    desc: "The company auditor is in the valley and Whitmore's position is weaker than anyone knows. You have correspondence, survey records, and testimony that could clear the questions the auditor is asking. Giving it to him saves his career — and gives him leverage over valley land questions he may use against you for years. It will cost you with Esperanza, whose interests run directly opposite his. A man you help out of a crisis owns you a little, and he knows it.",
    result: "RAILROAD AUDITOR FINDS SURVEY RECORDS IN ORDER — Whitmore cleared of irregularity charges.",
    resultBody: "Pacific Railroad's northern survey audit has concluded without finding irregularities. J.T. Whitmore confirmed that local cooperation contributed to the result. The auditor departed south. Esperanza Vallejo declined to comment on the findings.",
    effects: [
      { star: 'whitmore',  passion: 'standing', delta: +30, why: "The audit resolved in his favor. His position in the company is restored." },
      { star: 'whitmore',  passion: 'corridor', delta: +10, why: "With the audit cleared, survey work resumes at full pace." },
      { star: 'esperanza', passion: 'trust',    delta: -20, why: "You handed Whitmore the evidence that protects the railroad. She knows what that means for the valley." },
      { star: 'esperanza', passion: 'land',     delta: -10, why: "A restored Whitmore is a more effective adversary against the grant." },
    ],
    def: null,
  },

  // ─── BETRAYAL ACTIONS ─────────────────────────────────────────────────────────
  // Gate behind high positive passion (requiresPassionAbove). Give high-positive
  // relationships actual stakes — something to lose, not just something to maintain.

  {
    id: 'exploit_esperanza_trust', ya: 1823, source: 'esperanza', msgType: 'Exploitation',
    requiresPassionAbove: { star: 'esperanza', passion: 'trust', threshold: 50 },
    moral: '"Thou shalt not bear false witness against thy neighbour." — Exodus 20:16',
    dispatch: "Use the Coalition's Private Records to Clear a Legal Challenge to Your Own Land",
    desc: "The coalition archive she shared with you contains boundary records that predate the railroad's entire filing history. You can use them — not to protect the grant, but to resolve a legal challenge to your own holdings that has nothing to do with hers. The records won't be returned. The use will become clear to anyone who reads the filing carefully. She trusted you with something. You are deciding what that means.",
    result: "SETTLER RESOLVES LAND DISPUTE USING CALIFORNIO RECORDS — Pre-annexation documents cited in private filing.",
    resultBody: "A local landholder has resolved a disputed land claim by citing pre-annexation Californio boundary records in a private territorial filing. The records' origin has not been publicly confirmed. Esperanza Vallejo declined to comment. Several coalition families have reportedly asked her directly about the filing.",
    effects: [
      { star: 'esperanza', passion: 'trust',     delta: -30, why: "She gave you those records for one purpose. What you did with them is a kind of theft that cannot be undone." },
      { star: 'esperanza', passion: 'coalition', delta: -20, why: "Coalition members who learn how the records were used hold her responsible for the exposure." },
      { star: 'solomon',   passion: 'autonomy',  delta: -10, why: "Using someone's trust as a legal instrument without their knowledge is the kind of thing he files and doesn't forgive." },
    ],
    def: null,
  },
  {
    id: 'call_solomon_loan', ya: 1824, source: 'solomon', msgType: 'Claim',
    requiresTaken: 'lend_solomon',
    requiresPassionAbove: { star: 'solomon', passion: 'roots', threshold: 45 },
    dispatch: "Demand Public Repayment of the Warehouse Loan",
    desc: "The private note on Solomon's warehouse expansion is yours to call in whenever you choose. Demanding repayment publicly — through the territorial bank rather than privately, as the agreement specified — turns a private debt into a public instrument. The money will come. Solomon built his entire operation by staying off the federal record. You are about to put him onto it.",
    result: "REED'S TRADING POST DEBT CALLED — Private warehouse note enters public territorial record.",
    resultBody: "A private loan note backing the expansion of Reed's Trading Post has been formally called for repayment through the territorial bank. Solomon Reed is expected to meet the obligation. He declined to comment. The loan's terms, previously unrecorded, are now a matter of public record.",
    effects: [
      { star: 'solomon', passion: 'roots',    delta: -30, why: "Calling the note publicly puts his most important holding into a federal record he spent years keeping it out of." },
      { star: 'solomon', passion: 'autonomy', delta: -20, why: "A private arrangement made public against his wishes is a violation he will not separate from the person who did it." },
      { star: 'solomon', passion: 'caleb',    delta: -10, why: "Caleb's future at the post is now entangled with a federal debt record he didn't choose." },
    ],
    def: null,
  },
];

// ─── QUIET SEASONS ────────────────────────────────────────────────────────────
// Each entry: { h, b, requires? }
// requires(state) — optional predicate. If present, entry only enters the pool
// when it returns true. Allows entries gated on prior decisions, macropassion
// levels, or year. Entries without requires are always eligible.
// Selection: pool is filtered to eligible entries, then drawn sequentially by
// season. When the seasonal pool is exhausted, falls back to QUIET_SEASONS_GENERIC.

const QUIET_SEASONS_BY_SEASON = {
  Spring: [
    { h: "SPRING PASSES WITHOUT INCIDENT",
      b: "The valley road is muddy with snowmelt. No surveys are filed. No court dates are pending. You spend three weeks repairing fences and attending to correspondence that requires nothing of consequence." },
    { h: "A QUIET SPRING ON THE LAND",
      b: "The rains come and go without consequence. No riders arrive with letters. No surveyors on the road. You note the absence of urgency and are not sure what to make of it." },
    { h: "SPRING PLANTING — THE VALLEY WORKS",
      b: "The fields go in without drama. The Vallejo hands are out early; you can see them from the road. No one exchanges more than a nod. The work proceeds on its own schedule, indifferent to whatever is happening in Sacramento." },
    { h: "A RIDER FROM THE SOUTH — NOTHING REQUIRING YOUR NAME",
      b: "A territorial rider passes through heading north. He leaves no letters at your door. You watch him go and return to the fence line. Whatever he is carrying, it isn't addressed to you." },
    // Gated: only after deed_esperanza is taken
    { h: "THE VALLEJO PARCEL — QUIET FOR NOW",
      b: "The boundary markers are undisturbed. No survey crew on the road. Whatever Whitmore's next move is, it hasn't arrived yet. Esperanza's name is on the record. The record holds.",
      requires: (s) => s.taken.includes('deed_esperanza') },
    // Gated: only after lend_solomon
    { h: "SOLOMON'S POST — OPEN FOR THE SEASON",
      b: "The post is doing a steady trade. You pass it on the way to the territorial road and note the new sign above the door — the expansion is visible from the outside now. Solomon is in the yard tallying freight. He lifts a hand as you pass. You lift one back.",
      requires: (s) => s.taken.includes('lend_solomon') },
    // Gated: year >= 1820
    { h: "SPRING, AND THE TERRITORY KEEPS CHANGING",
      b: "Another season. The land looks the same. The paperwork in Sacramento does not. New filings, new names on old parcels, new roads proposed on maps that don't reflect the ground. You note the gap between the territory on paper and the territory underfoot.",
      requires: (s) => s.year >= 1820 },
  ],
  Summer: [
    { h: "A QUIET SUMMER IN THE VALLEY",
      b: "The heat comes early and stays. Whitmore's crew is not seen on the roads this month. Solomon's post is busy with travelers. You have time to think, which is its own kind of discomfort." },
    { h: "MIDSUMMER — NO WORD FROM THE TERRITORY",
      b: "Nothing arrives by stage or rider that requires action. The valley bakes. You watch the road and wait for something that does not come." },
    { h: "THE ROAD IS DRY AND QUIET",
      b: "Dust on the valley road. The stage runs twice a week. No one on it is coming to see you. You attend to the homestead and the accounts. The season passes without requiring a signature." },
    { h: "HEAT AND SILENCE — NO SURVEYORS THIS MONTH",
      b: "The survey crews have moved south for the season. The roads are clear. You use the weeks to attend to the homestead and to correspondence that requires nothing beyond a brief reply." },
    // Gated: Whitmore is known and not an enemy
    { h: "WHITMORE'S CREW ON THE FAR ROAD",
      b: "You see the railroad survey crew in the distance, working the far slope. They are not on your parcel. They do not look up. Whatever Whitmore is mapping this season, it is not your immediate concern.",
      requires: (s) => s.revealedStars.includes('whitmore') && macropassionValue(s.stars.whitmore?.passions ?? {}) > -15 },
    // Gated: after introduce_caleb
    { h: "CALEB REED ON THE ROAD NORTH",
      b: "You pass Caleb Reed heading toward the Nevada route. He has the manner of a man who knows where he is going. Solomon's routes are working. The post is getting its legs. You exchange a few words about weather and road conditions. Nothing requiring decision.",
      requires: (s) => s.taken.includes('introduce_caleb') },
    // Gated: year >= 1825
    { h: "MIDSUMMER — THE VALLEY HAS GROWN COMPLICATED",
      b: "More people than a decade ago. More claims, more roads, more names. The valley that arrived with you is not quite the valley it is now. You attend to your parcel and your accounts. The complications are not, this season, yours.",
      requires: (s) => s.year >= 1825 },
  ],
  Autumn: [
    { h: "AUTUMN: NO WORD FROM SACRAMENTO",
      b: "The leaves turn. The stage brings no letters requiring action. You attend a dinner at the Merchant's Association and say nothing of consequence to anyone." },
    { h: "A STILL AUTUMN IN THE VALLEY",
      b: "The harvest moves without incident. No filings, no summons, no visitors at the door. The quiet accumulates like sediment." },
    { h: "THE HARVEST ACCOUNTS — NOTHING UNUSUAL",
      b: "The yield is what it was. The accounts close without drama. You write a brief summary for the territorial register and leave it on the stage. The season ends without requiring anything further of you." },
    { h: "AUTUMN ROAD — THE MERCHANTS CLOSE THEIR LEDGERS",
      b: "The trading season winds down. Solomon's post is stacking freight for winter storage. The Merchant's Association dinner was last week. You attended, said nothing memorable, and left before the second round." },
    // Gated: after report_trespass
    { h: "THE MAGISTRATE'S OFFICE — NO NEW FILINGS",
      b: "You check at the territorial recorder's office. No new survey challenges on record. The trespass complaint is still logged. It has not been resolved, but it has not been overturned either. The silence is its own kind of answer.",
      requires: (s) => s.taken.includes('report_trespass') },
    // Gated: Esperanza is an ally
    { h: "THE COALITION MEETS — YOU ARE NOT INVITED",
      b: "Esperanza's coalition holds a meeting at the Vallejo parcel. You are not there. You don't need to be — that is the arrangement. The coalition does its work. You do yours. The season passes without requiring you to be in two places at once.",
      requires: (s) => macropassionValue(s.stars.esperanza?.passions ?? {}) > 15 },
    // Gated: after find_brother
    { h: "WORD FROM NEVADA — THE ROUTES ARE OPEN",
      b: "A letter arrives from Caleb Reed, forwarded through Solomon's post. The Nevada routes are clear for the season. Solomon is at the counter when you read it; he doesn't ask what it says. He already knows.",
      requires: (s) => s.taken.includes('find_brother') },
    // Gated: year >= 1830
    { h: "AUTUMN, DECADES ON — THE TERRITORY HAS SETTLED INTO ITS SHAPE",
      b: "You have been in this valley long enough to see the road repaired twice. The names on the parcels adjacent to yours have changed at least once each. The territorial map in the recorder's office looks different from the one that was there when you arrived. The harvest comes in regardless.",
      requires: (s) => s.year >= 1830 },
  ],
  Winter: [
    { h: "WINTER CLOSES THE PASSES",
      b: "Snow on the northern route. Survey work is halted. Nothing needs to be done. You wait and watch the deferred things accumulate." },
    { h: "WINTER — THE ROAD GOES QUIET",
      b: "Nothing moves through the valley that wasn't already moving. You tend to small obligations and wait for the ground to thaw." },
    { h: "DEEP WINTER — THE ACCOUNTS ARE SETTLED",
      b: "The ledgers close for the year. Nothing outstanding, nothing overdue. The homestead is maintained. The passes are impassable. You wait for spring with no particular urgency." },
    { h: "WINTER ON THE LAND — NO RIDERS",
      b: "Three weeks without a letter. The road carries freight but no messages addressed to you. You split wood, repair the barn door, and attend to the kind of work that accumulates when decisions don't." },
    // Gated: Whitmore known
    { h: "WHITMORE'S CREW WINTERS IN TOWN",
      b: "The railroad survey crew has taken rooms at the Merchant's Inn for the cold months. They are not working. Whitmore himself was seen at the territorial recorder's office last week, but nothing has been filed under your parcel number. The winter holds.",
      requires: (s) => s.revealedStars.includes('whitmore') },
    // Gated: after federal_claim
    { h: "THE RAILROAD PAPERWORK — FILED AND DORMANT",
      b: "The federal corridor filing is in the record. Nothing has moved on it this season. The company's attorneys are in Sacramento; Whitmore is in the valley. You watch the gap between those two facts and wait for it to close.",
      requires: (s) => s.taken.includes('federal_claim') },
    // Gated: Solomon is ally
    { h: "SOLOMON'S POST — CLOSED FOR THE SEASON",
      b: "Reed's Trading Post shutters for deep winter. You pass the locked door on the valley road and note the freight stacked under canvas beside the barn. Solomon has prepared for a long close. The post will be ready in spring. So will you.",
      requires: (s) => macropassionValue(s.stars.solomon?.passions ?? {}) > 15 },
    // Gated: year >= 1835
    { h: "ANOTHER WINTER — THE TERRITORY IS NOT WHAT IT WAS",
      b: "You have seen this valley in every season now, many times over. The snow falls the same way. The road goes quiet the same way. The accounts close in the same columns. What has changed is everything around the edges — names, claims, roads, flags. You wait for spring.",
      requires: (s) => s.year >= 1835 },
  ],
};

const QUIET_SEASONS_GENERIC = [
  { h: "THE SEASON OFFERS NOTHING TO DECIDE",
    b: "There are days when history moves without you. This appears to be one of them. The valley persists. The people in it persist. You note the quiet and are not certain whether to be grateful or suspicious." },
  { h: "QUIET WEEKS ON THE LAND",
    b: "No summons. No surveyors. No letters requiring a signature. The work of the land goes on. You begin to suspect the calm." },
  { h: "THE LEDGER IS CURRENT — NOTHING PENDING",
    b: "All accounts settled. No actions outstanding. The valley is, for this season, attending to its own business without requiring yours. You find this neither reassuring nor alarming. It is simply the condition." },
  { h: "A SEASON WITHOUT CONSEQUENCE",
    b: "Some seasons have weight. This one does not. The decisions that will matter are either already made or not yet arrived. You maintain what you have built and wait for the territory to require something of you again." },
  { h: "THE VALLEY KEEPS ITS OWN PACE",
    b: "Nothing comes down the road addressed to you. The people who matter in this territory are attending to their own concerns. You do the same. The gap between your last decision and your next one stretches out like the valley road in dry summer." },
  // Gated generics — these surface regardless of season when their condition is met
  { h: "THE RECORDER'S OFFICE — NOTHING NEW UNDER YOUR NAME",
    b: "You send a rider to check the territorial filing index. Nothing new on your parcel. Nothing new adjacent. The paper record of your presence in this valley is exactly as you left it. That is either reassuring or ominous depending on the week.",
    requires: (s) => s.year >= 1818 },
  { h: "THE STAGE PASSES — NOTHING FOR YOU",
    b: "The weekly stage from Sacramento stops at Solomon's post, drops freight, takes on passengers. No letter addressed to your parcel. Whatever news is moving through the territory this season, it is not moving in your direction. You note the absence and return to the fence line.",
    requires: (s) => s.revealedStars.includes('solomon') },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const clamp = (v, lo = -100, hi = 100) => Math.max(lo, Math.min(hi, v));

function macropassionValue(passions) {
  const vals = Object.values(passions).map(p => p.value);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Once a hidden passion's threshold is crossed it is permanently revealed —
// stored in state.revealedPassions as "starId:passionKey" strings.
// isPassionVisible checks the permanent set first so that a macro-passion
// dip cannot hide knowledge the player has already earned or sever a quest
// chain mid-progress.
function isPassionVisible(stars, starId, passionKey, revealedPassions = []) {
  const passion = stars[starId]?.passions[passionKey];
  if (!passion) return false;
  if (!passion.hiddenUntil) return true;
  if (revealedPassions.includes(`${starId}:${passionKey}`)) return true;
  // Not yet permanently revealed — check the live threshold using the same
  // full average as macropassionValue so the number matches the label the
  // player already sees.
  return macropassionValue(stars[starId].passions) >= passion.hiddenUntil;
}

// Scans all stars for hidden passions that have newly crossed their threshold
// and returns an updated revealed set. Only ever appends — never removes.
function checkPassionReveals(stars, revealedPassions) {
  const updated = [...revealedPassions];
  for (const [starId, star] of Object.entries(stars)) {
    for (const [passionKey, passion] of Object.entries(star.passions)) {
      if (!passion.hiddenUntil) continue;
      const key = `${starId}:${passionKey}`;
      if (updated.includes(key)) continue;
      if (macropassionValue(star.passions) >= passion.hiddenUntil) {
        updated.push(key);
      }
    }
  }
  return updated;
}

function macropassion(passions) {
  const avg = macropassionValue(passions);
  if (avg >= 75)  return { label: 'Bound Ally',         col: '#4a8e42' };
  if (avg >= 50)  return { label: 'Steadfast Friend',   col: '#6a9e42' };
  if (avg >= 30)  return { label: 'Friendly Neighbor',  col: '#8aae42' };
  if (avg >= 15)  return { label: 'Cautious Friend',    col: '#9aae52' };
  if (avg > -15)  return { label: 'Known Acquaintance', col: '#8a8060' };
  if (avg > -30)  return { label: 'Clear Competitor',   col: '#be8040' };
  if (avg > -50)  return { label: 'Open Opponent',      col: '#be6030' };
  if (avg > -75)  return { label: 'Active Adversary',   col: '#be3820', warning: 'Willing to move against you. Your other alliances may still give them pause — for now.' };
  return              { label: 'Sworn Enemy',           col: '#9e1a10', warning: 'Will act to destroy you regardless of what it costs them or anyone else.' };
}

function reputation(fame, infamy, starId) {
  const fH = fame >= 25, iH = infamy >= 20;
  return fH && iH ? REP_LABELS[starId].HH
       : fH       ? REP_LABELS[starId].HL
       : iH       ? REP_LABELS[starId].LH
       :             REP_LABELS[starId].LL;
}

// Returns the two-letter rep state key ('HH'|'HL'|'LH'|'LL') for a star object.
// Used by the reducer to check repBonus conditions and by ActionCard to show active bonuses.
function repStateKey(star) {
  const fH = star.fame >= 25, iH = star.infamy >= 20;
  return fH && iH ? 'HH' : fH ? 'HL' : iH ? 'LH' : 'LL';
}

// ─── DELTA VISIBILITY ────────────────────────────────────────────────────────
// Effect delta values (the numbers) are progressively revealed as macropassion grows.
// The narrative why text is always visible — the player understands what is happening
// from context. The exact magnitude becomes information earned through relationship.
//
//  Default (below Cautious Friend): star name + passion label visible, delta hidden (±?)
//  Cautious Friend  (≥15):  source Star's own passion deltas visible
//  Friendly Neighbor(≥30):  all Stars' deltas on this source's actions visible
//  Steadfast Friend (≥50):  full visibility including threshold crossing previews
//
// effectVisibility(sourceStarId, effectStarId, stars) → 'hidden' | 'partial' | 'full'
function effectVisibility(sourceStarId, effectStarId, stars) {
  const sourceMacro = macropassionValue(stars[sourceStarId]?.passions ?? {});
  if (sourceMacro >= 50) return 'full';
  if (sourceMacro >= 30) return 'full';   // all Stars visible at Friendly Neighbor
  if (sourceMacro >= 15) {
    return effectStarId === sourceStarId ? 'full' : 'hidden';
  }
  return 'hidden';
}

// ─── MODIFIER COMPUTATION ─────────────────────────────────────────────────────
// Macropassion band sets a ceiling on how far individual passions can contribute
// their bonuses or penalties. The dominant passion (after capping) determines
// which specific behavior is active.
//
// Positive side — macropassion band caps individual passion contribution at:
//   15–30 (Cautious Friend)   → cap at +50 band
//   30–50 (Friendly Neighbor) → cap at +75 band
//   50–75 (Steadfast Friend)  → cap at +100 (fully unlocked)
//   ≥ 75  (Bound Ally)        → cap at +100 (fully unlocked)
//
// Negative side mirrors exactly:
//   -15 to -30 (Clear Competitor)  → cap at -50 band
//   -30 to -50 (Open Opponent)     → cap at -75 band
//   -50 to -75 (Active Adversary)  → cap at -100 (fully unlocked)
//   ≤ -75 (Sworn Enemy)            → cap at -100 (fully unlocked)
//
// The capped dominant passion value is returned as cappedDomValue for tooltip
// and active effects display.

function passionBandCap(macro) {
  if (macro >= 50)  return 100;
  if (macro >= 30)  return 75;
  if (macro >= 15)  return 50;
  if (macro > -15)  return 0;   // neutral — no positive bonuses
  if (macro > -30)  return -50;
  if (macro > -50)  return -75;
  return -100;
}

function computeModifiers(stars) {
  const mods = {};
  for (const starId of Object.keys(stars)) {
    const star = stars[starId];
    const macro = macropassionValue(star.passions);
    const cap = passionBandCap(macro);

    // Cap each passion's contribution at the band ceiling
    // Positive passions capped at +cap; negative passions capped at cap (which is negative)
    const cappedPassions = Object.entries(star.passions).map(([k, p]) => {
      const v = p.value;
      const capped = macro >= 0
        ? Math.min(v, cap)           // positive side: cap upward contribution
        : Math.max(v, cap);          // negative side: cap downward contribution
      return [k, { ...p, value: capped }];
    });

    // Dominant passion after capping
    const dominant = cappedPassions
      .reduce((a, [k, p]) => Math.abs(p.value) > Math.abs(a[1].value) ? [k, p] : a, ['', { value: 0 }]);
    const cappedDomValue = dominant[1].value ?? 0;

    let fameMult = 1.0;
    let infamyMult = 1.0;
    let passionBonus = 0;
    let deltaObscured = false;

    if (macro >= 75) {
      fameMult = 1.5; infamyMult = 0.5; passionBonus = 5;
    } else if (macro >= 50) {
      fameMult = 1.25; infamyMult = 0.75; passionBonus = 3;
    } else if (macro >= 30) {
      fameMult = 1.1;
    } else if (macro >= 15) {
      // Cautious Friend — no modifiers yet
    } else if (macro > -15) {
      deltaObscured = true;
    } else if (macro > -30) {
      fameMult = 0.75; infamyMult = 1.25; deltaObscured = true;
    } else if (macro > -50) {
      fameMult = 0.5; infamyMult = 1.5; deltaObscured = true;
    } else if (macro > -75) {
      fameMult = 0.5; infamyMult = 2.0; deltaObscured = true;
    } else {
      fameMult = 0.25; infamyMult = 2.0; deltaObscured = true;
    }

    mods[starId] = { fameMult, infamyMult, passionBonus, deltaObscured, macro, cappedDomValue, cap };
  }
  return mods;
}
// Shown once when a hidden passion first becomes visible (pendingReveal queue).
// body() receives the reveal year so duration language is accurate at any point
// in the timeline — both anchors are fixed historical events:
//   solomon:caleb     — Caleb left for Nevada in 1809
//   whitmore:margaret — Whitmore arrived in the valley in 1811
function yearsWord(n) {
  const words = ['one','two','three','four','five','six','seven','eight','nine','ten'];
  return n >= 1 && n <= 10 ? words[n - 1] : `${n}`;
}

const PASSION_REVEAL_DIALOGUES = {
  'solomon:caleb': {
    starName:     'Solomon Reed',
    starColor:    '#5a8e52',
    passionLabel: 'Brotherhood',
    headline:     'He mentions his brother.',
    body: (year) => {
      const n = year - 1809;
      return `It comes out sideways, the way things do with Solomon. Not a confession — more like a word that slips through a door he forgot to close. His brother Caleb went to Nevada for the silver rush ${yearsWord(n)} ${n === 1 ? 'year' : 'years'} ago and hasn't written since. He says it the way a man says something he has said to himself so many times it has lost its weight. You understand that it hasn't.`;
    },
    continueLabel: 'Acknowledge his silence',
  },
  'whitmore:margaret': {
    starName:     'J.T. Whitmore',
    starColor:    '#3e6e9a',
    passionLabel: 'The Distance',
    headline:     'He mentions his wife.',
    body: (year) => {
      const n = year - 1811;
      const duration = n <= 1 ? 'over a year' : `${yearsWord(n)} years`;
      return `He says her name — Margaret — once, in the middle of talking about something else, and then continues as if he hadn't. She is in Cincinnati. He has been in this valley for ${duration}. You have never heard him mention her before. The survey maps on his desk are dated. Her name is not on any of them.`;
    },
    continueLabel: 'More problems to consider',
  },
};

// ─── REACTIVE EVENTS ─────────────────────────────────────────────────────────
// Fire automatically when a passion crosses a threshold.
// direction: 'above' fires when value rises past threshold, 'below' when it falls past.
// unlocksActions: IDs of actions added to the player's pool when this fires.

const REACTIVE_EVENTS = [
  {
    id: 're_esperanza_trust_hostile',
    star: 'esperanza', passion: 'trust', threshold: -50, direction: 'below',
    requiresMacropassionMax: -15, // complaint only fires if relationship is Clear Competitor or worse
    headline: 'VALLEJO FILES FORMAL COMPLAINT — Settler named in public land dispute.',
    body: "Esperanza Vallejo has filed a formal complaint with the territorial court naming a local landholder as party to disputed boundary claims. She cited a pattern of actions working against Californio land interests. The filing is now public record.",
    effects: [
      { star: 'esperanza', passion: 'land', delta: +8, why: "Filing publicly shifts legal ground in her favor." },
    ],
    fameEffects:   { esperanza: 0, solomon: 0, whitmore: +5 },
    infamyEffects: { esperanza: 0, solomon: +5, whitmore:  0 },
    unlocksActions: [],
    isNegative: true,
  },
  {
    id: 're_esperanza_trust_ally',
    star: 'esperanza', passion: 'trust', threshold: 50, direction: 'above',
    requiresMacropassion: 30, // archive only opens if the overall relationship is Friendly Neighbor or better
    headline: 'VALLEJO OPENS COALITION ARCHIVE — Settler granted access to Californio land records.',
    body: "Esperanza Vallejo has granted a local settler access to the coalition's private land archive — the first Anglo to be so trusted. The records document boundary claims predating American annexation. What is done with them is yet to be seen.",
    effects: [],
    fameEffects:   { esperanza: 0, solomon: +5, whitmore: 0 },
    infamyEffects: { esperanza: 0, solomon: 0, whitmore: 0 },
    unlocksActions: ['archive_leverage', 'archive_share'],
    isNegative: false,
  },
  {
    id: 're_solomon_autonomy_hostile',
    star: 'solomon', passion: 'autonomy', threshold: -50, direction: 'below',
    requiresMacropassionMax: -15, // account restriction only fires if relationship is Clear Competitor or worse
    headline: "REED'S POST RESTRICTS CERTAIN ACCOUNTS — Trader quietly closes access to known railroad associates.",
    body: "Solomon Reed has quietly stopped doing business with several valley landholders, citing concerns about federal entanglement. He did not publish a list. He did not need to. People who trade at the post know who is no longer welcome.",
    effects: [],
    fameEffects:   { esperanza: 0, solomon: 0, whitmore: 0 },
    infamyEffects: { esperanza: 0, solomon: 0, whitmore: 0 },
    unlocksActions: [],
    isNegative: true,
  },
  {
    id: 're_solomon_caleb_found',
    star: 'solomon', passion: 'caleb', threshold: 50, direction: 'above',
    requiresMacropassion: 15, // Nevada contacts only shared if relationship is Cautious Friend or better
    headline: "CALEB REED RETURNS TO THE VALLEY — Freedman's brother arrives with Nevada contacts.",
    body: "Solomon Reed has word that his brother Caleb is alive and located in the Nevada silver territory — and that he knows men who move money outside federal channels. The contacts exist. Solomon is not yet sharing them freely, but for the right person, the door is open.",
    effects: [],
    fameEffects:   { esperanza: 0, solomon: 0, whitmore: 0 },
    infamyEffects: { esperanza: 0, solomon: 0, whitmore: 0 },
    unlocksActions: ['nevada_contacts'],
    isNegative: false,
  },
  {
    id: 're_whitmore_standing_promoted',
    star: 'whitmore', passion: 'standing', threshold: 75, direction: 'above',
    requiresMacropassion: 30, // promotion benefits you only if relationship is Friendly Neighbor or better
    headline: 'WHITMORE NAMED DISTRICT SUPERVISOR — Pacific Railroad elevates northern corridor lead.',
    body: "J.T. Whitmore has been named District Supervisor for the northern corridor, bringing with him full company authority over land filings in the valley. His promotion is a direct consequence of his progress here. The company now acts through him with considerably more force.",
    effects: [
      { star: 'whitmore', passion: 'corridor', delta: +15, why: "Supervisory authority expands his ability to suppress competing claims." },
    ],
    fameEffects:   { esperanza: 0, solomon: 0, whitmore: 0 },
    infamyEffects: { esperanza: 0, solomon: 0, whitmore: 0 },
    unlocksActions: [],
    isNegative: false,
  },
  {
    id: 're_whitmore_route_stalled',
    star: 'whitmore', passion: 'corridor', threshold: -50, direction: 'below',
    headline: 'COMPANY SENDS AUDITOR NORTH — Pacific Railroad reviews corridor progress.',
    body: "Pacific Railroad has dispatched an internal auditor to review the northern survey's progress. Whitmore met the auditor's stage alone. What was said between them is not public. What follows from it will be.",
    effects: [
      { star: 'whitmore', passion: 'standing', delta: -15, why: "An audit is a vote of no confidence. The company is watching." },
    ],
    fameEffects:   { esperanza: 0, solomon: 0, whitmore: 0 },
    infamyEffects: { esperanza: 0, solomon: 0, whitmore: +8 },
    unlocksActions: [],
    isNegative: true,
  },
  {
    id: 're_whitmore_margaret_breaking',
    star: 'whitmore', passion: 'margaret', threshold: -50, direction: 'below',
    headline: "WHITMORE PUSHES UNAUTHORIZED SURVEY NORTH — Corridor progress accelerates beyond company sanction.",
    body: "J.T. Whitmore has ordered survey crews onto contested parcels without waiting for the federal filings that would legitimize the work. The move advances the corridor timeline but creates legal exposure the company did not authorize. His personal correspondence east has reportedly gone unanswered for some months.",
    effects: [
      { star: 'whitmore', passion: 'standing', delta: -12, why: "Unauthorized field decisions draw company scrutiny. He is trying to finish and go home and it is making him reckless." },
      { star: 'whitmore', passion: 'corridor', delta: +8,  why: "The reckless push gains ground on the survey — but the paperwork will not hold under review." },
    ],
    fameEffects:   { esperanza: 0, solomon: 0, whitmore: 0 },
    infamyEffects: { esperanza: 0, solomon: 0, whitmore: 0 },
    unlocksActions: [],
    isNegative: true,
  },
];

// ─── UNLOCKABLE ACTIONS ───────────────────────────────────────────────────────
// These do not appear in the main action pool — they are added to unlockedActions[]
// in state when a reactive event fires.

const UNLOCKABLE_ACTIONS = [
  {
    id: 'archive_leverage',
    source: 'esperanza',
    msgType: 'Strategy',
    dispatch: "Use the Archive to Challenge Whitmore's Survey in Court",
    desc: "The coalition records document boundary claims that predate the railroad's entire filing history. A skilled attorney could use them to invalidate Whitmore's corridor survey — permanently, if the court agrees.",
    result: "SETTLER FILES CHALLENGE USING CALIFORNIO ARCHIVE — Pre-annexation boundary records submitted to Sacramento court.",
    resultBody: "A legal challenge to Pacific Railroad's northern survey has been filed using pre-annexation Californio land records, obtained through the Vallejo coalition. J.T. Whitmore's legal office has been served. The court date is set.",
    effects: [
      { star: 'esperanza', passion: 'land',      delta: +20, why: "The archive used as you intended. The legal challenge is serious." },
      { star: 'esperanza', passion: 'coalition', delta: +20, why: "Using the records publicly affirms the coalition's strategy." },
      { star: 'whitmore',  passion: 'corridor',  delta: -30, why: "Pre-annexation records are the most dangerous thing the railroad's surveyors can face." },
      { star: 'whitmore',  passion: 'standing',  delta: -10, why: "The company will hold him responsible for this exposure." },
    ],
    def: null,
  },
  {
    id: 'archive_share',
    source: 'esperanza',
    msgType: 'Opportunity',
    dispatch: "Share the Archive with Solomon — Let Him Decide Its Use",
    desc: "The records have value beyond the courtroom. Solomon knows people who move money and influence outside federal channels. Putting the archive in his hands leaves its use up to him — and binds you to whatever he does with it.",
    result: "COALITION ARCHIVE SHARED WITH VALLEY TRADER — Records passed to Solomon Reed for independent use.",
    resultBody: "Documents from the Vallejo coalition archive have been shared with Solomon Reed of the valley road trading post. Reed declined to comment on their contents or intended use. Esperanza Vallejo has not publicly confirmed the transfer.",
    effects: [
      { star: 'solomon',   passion: 'roots',    delta: +20, why: "Documents that legitimize Californio claims also protect his post's adjacent land." },
      { star: 'solomon',   passion: 'autonomy', delta: +10, why: "Information this valuable, obtained outside federal channels, is exactly what he values." },
      { star: 'esperanza', passion: 'trust',    delta: -10, why: "You remind her that your motivations aren't always aligned." },
      { star: 'esperanza', passion: 'coalition',delta:  -10, why: "Coalition documents outside coalition control is not what she intended." },
    ],
    def: null,
  },
  {
    id: 'nevada_contacts',
    source: 'solomon',
    msgType: 'Opportunity',
    dispatch: "Meet Caleb's Nevada Contacts Outside Federal Record",
    desc: "The men Caleb knows move silver, information, and influence through channels that don't appear in any federal register. A meeting — arranged quietly, off the valley road — could open possibilities that the official economy cannot. Solomon is offering something precious. He knows it and so do you.",
    result: "SETTLER MEETS WITH NEVADA INTERESTS — Private arrangement concluded outside territorial record.",
    resultBody: "A discreet meeting between a local settler and associates of Caleb Reed was concluded this week at an undisclosed location. No record was filed. No names were published. The valley road trading post was busy the same afternoon.",
    effects: [
      { star: 'solomon', passion: 'roots',      delta: +10, why: "A settler plugged into his brother's network is a settler with skin in Solomon's game." },
      { star: 'solomon', passion: 'autonomy',   delta: +20, why: "Operating outside federal record together creates a kind of trust that legal dealings cannot." },
      { star: 'solomon', passion: 'caleb',      delta: -15, why: "You have made his brother's network into an instrument. Solomon knows the difference between sharing and being used." },
      { star: 'whitmore', passion: 'standing',  delta: -10, why: "Off-record commerce in his corridor is a problem he will eventually be held accountable for." },
    ],
    def: {
      years: 6,
      headline: "NEVADA INTERESTS DELIVER — Arrangement from years prior produces return.",
      body: "The men introduced through Caleb Reed's Nevada network have quietly produced what was promised. A territorial filing — clean, uncontested, outside the railroad's sight lines — has been registered in the settler's name. Caleb Reed was not publicly thanked. He did not expect to be.",
      effects: [
        { star: 'solomon', passion: 'roots',  delta: +20, why: "The network delivered. Whatever the cost, the arrangement was real." },
      ],
    },
  },
];

// ─── CONVERGENCE EVENTS ───────────────────────────────────────────────────────
// Fire when a condition across Stars is met. Push a forced choice to pendingChoices[].
// choices: array of { label, desc, effects[], fameEffects, infamyEffects }

const CONVERGENCE_EVENTS = [
  {
    id: 'conv_land_corridor',
    condition: (stars) =>
      stars.esperanza.passions.land.value >= 30 &&
      stars.whitmore.passions.corridor.value >= 30,
    headline: 'THE NORTHERN BOUNDARY — A Direct Confrontation',
    body: "Esperanza Vallejo and J.T. Whitmore have both called on you in the same week regarding the same strip of land. The northern parcel sits directly across the railroad's planned route. Esperanza holds a surveyed claim. Whitmore holds a federal filing. They cannot both be right. They both know which way you have leaned. Now they want to know which way you will stand.",
    choices: [
      {
        id: 'side_esperanza',
        label: "Stand with Esperanza — the surveyed claim predates the railroad",
        desc: "You put your name to a statement affirming the Vallejo survey's priority over the federal filing. It will cost you with Whitmore. It may be the thing that saves the grant.",
        effects: [
          { star: 'esperanza', passion: 'land',     delta: +20, why: "Your statement gives the survey legal standing it didn't have on its own." },
          { star: 'esperanza', passion: 'trust',    delta: +20, why: "When it came to a direct choice, you chose her." },
          { star: 'whitmore',  passion: 'corridor', delta: -20, why: "The statement directly obstructs his filing." },
          { star: 'whitmore',  passion: 'standing', delta: -20, why: "Losing a local ally publicly is a failure the company will notice." },
        ],
        fameEffects:   { esperanza: +18, solomon: +8, whitmore:   0 },
        infamyEffects: { esperanza:   0, solomon:  0, whitmore: +14 },
      },
      {
        id: 'side_whitmore',
        label: "Stand with Whitmore — the federal filing supersedes the old grant",
        desc: "You confirm that the federal filing is the controlling document. You have seen the survey. You believe the corridor is legitimate. Esperanza will hear what you said within the week.",
        effects: [
          { star: 'whitmore',  passion: 'corridor', delta: +20, why: "Your confirmation shores up the filing's local legitimacy." },
          { star: 'whitmore',  passion: 'standing', delta: +20, why: "He delivered a local endorsement under pressure. The company approves." },
          { star: 'esperanza', passion: 'trust',    delta: -30, why: "Direct opposition at the moment of confrontation. She will not forget." },
          { star: 'esperanza', passion: 'land',     delta: -20, why: "Your confirmation weakens the survey's legal position." },
        ],
        fameEffects:   { esperanza:   0, solomon:  0, whitmore: +18 },
        infamyEffects: { esperanza: +18, solomon: +8, whitmore:   0 },
      },
      {
        id: 'side_neither',
        label: "Refuse to take a position — let the court decide",
        desc: "You tell both parties that the matter belongs before a judge. You will not add your name to either filing. You will not appear at the tribunal. Both will resent your absence. Neither will forgive the neutrality.",
        effects: [
          { star: 'esperanza', passion: 'trust',    delta: -10, why: "Neutrality at the moment she needed support reads as abandonment." },
          { star: 'whitmore',  passion: 'standing', delta:  -10, why: "He expected you to deliver. You didn't show." },
        ],
        fameEffects:   { esperanza:  0, solomon: 0, whitmore:  0 },
        infamyEffects: { esperanza: +8, solomon: 0, whitmore: +8 },
      },
    ],
  },
  {
    id: 'conv_solomon_coalition',
    condition: (stars) =>
      Math.abs(stars.solomon.passions.autonomy.value) >= 30 &&
      stars.esperanza.passions.coalition.value >= 30,
    headline: 'AN UNLIKELY MEETING — Reed and Vallejo',
    body: "Solomon Reed and Esperanza Vallejo have separately asked you to arrange a meeting between them. Solomon's trading independence and Esperanza's coalition have both grown significant enough that each sees something the other has. She wants his routes as an alternative to the federal commerce system. He wants her legal network as protection the post could not otherwise afford. They have never spoken directly. You are the only person both of them trust. Facilitating this changes all three relationships. So does refusing.",
    choices: [
      {
        id: 'facilitate_meeting',
        label: "Arrange the meeting — broker the alliance",
        desc: "You bring them together at the post, stay through the first hour, and leave them to it. What they build is theirs. What it costs you is the neutrality you no longer have.",
        effects: [
          { star: 'esperanza', passion: 'coalition', delta: +20, why: "A trade alliance with Reed's network materially strengthens the coalition's independence." },
          { star: 'solomon',   passion: 'autonomy',  delta: +20, why: "Coalition legal cover is exactly the kind of protection he couldn't build alone." },
          { star: 'solomon',   passion: 'roots',     delta: +10, why: "An alliance this useful makes the post harder to uproot." },
          { star: 'whitmore',  passion: 'corridor',  delta: -20, why: "A coordinated Californio-freedmen alliance is his worst outcome in this valley." },
        ],
        fameEffects:   { esperanza: +12, solomon: +12, whitmore:   0 },
        infamyEffects: { esperanza:   0, solomon:   0, whitmore: +14 },
      },
      {
        id: 'block_meeting',
        label: "Decline to arrange it — tell each of them the other isn't ready",
        desc: "You tell Esperanza that Solomon is cautious about coalition entanglement. You tell Solomon that Esperanza is not yet comfortable with the exposure. Both are partially true. The alliance doesn't form. You remain neutral. You remain alone.",
        effects: [
          { star: 'esperanza', passion: 'trust',    delta: -10, why: "She suspects you had more influence over this than you let on." },
          { star: 'solomon',   passion: 'autonomy', delta:  -10, why: "A door you could have opened, you left closed. He files that." },
        ],
        fameEffects:   { esperanza:  0, solomon:  0, whitmore: +5 },
        infamyEffects: { esperanza: +8, solomon: +8, whitmore:  0 },
      },
    ],
  },
  {
    id: 'conv_whitmore_personal',
    condition: (stars) =>
      stars.whitmore.passions.margaret.value >= 30 &&
      stars.whitmore.passions.corridor.value >= 30,
    headline: "THE SURVEYOR'S LETTER — Whitmore asks something off the record",
    body: "J.T. Whitmore has asked you, quietly and without preamble, for help drafting a letter to his wife in Cincinnati. He has been in the valley for three years. He has words for federal filings but not for her. He also needs your name on a corridor extension before the Sacramento office closes at the end of the month. He hasn't connected the two requests out loud. He doesn't have to.",
    choices: [
      {
        id: 'help_letter',
        label: "Help him with the letter first",
        desc: "You spend an afternoon on it. He postpones the filing. The company will wait. For a week, he seems like a different man.",
        effects: [
          { star: 'whitmore', passion: 'margaret', delta: +20, why: "You helped him say something he couldn't say alone. He will not forget that." },
          { star: 'whitmore', passion: 'corridor', delta: -10, why: "He postponed the filing to deal with something the company doesn't recognize as important. They noticed the delay." },
          { star: 'whitmore', passion: 'standing', delta:  -5, why: "A delayed filing is a mark against him in the company ledger." },
        ],
        fameEffects:   { esperanza: +4, solomon: +4, whitmore: +10 },
        infamyEffects: { esperanza:  0, solomon:  0, whitmore:   0 },
      },
      {
        id: 'push_filing_first',
        label: "Redirect him to the filing — the letter can wait",
        desc: "You tell him the Sacramento deadline is real and the letter can be written after. He signs the filing. He does not write the letter that week, or the week after.",
        effects: [
          { star: 'whitmore', passion: 'corridor', delta: +10, why: "The filing went through on time. The company is satisfied." },
          { star: 'whitmore', passion: 'standing', delta:  +10, why: "He delivered again. The company pays attention to that." },
          { star: 'whitmore', passion: 'margaret', delta: -20, why: "You were part of why he chose the route over the letter. He knows it. So does she, eventually." },
        ],
        fameEffects:   { esperanza:  0, solomon:  0, whitmore: +12 },
        infamyEffects: { esperanza: +4, solomon: +4, whitmore:   0 },
      },
      {
        id: 'attempt_both',
        label: "Promise to help with both — the letter and the filing",
        desc: "You tell him you'll manage both. The letter is short and impersonal. The filing goes through with a procedural objection. Neither is done well. She doesn't write back.",
        effects: [
          { star: 'whitmore', passion: 'corridor', delta: +5,  why: "The filing went through, technically, but it drew a procedural objection the company had to clear." },
          { star: 'whitmore', passion: 'margaret', delta: -5,  why: "The letter was not what he needed to send. He knew it when he read it back." },
          { star: 'whitmore', passion: 'standing', delta: -5,  why: "The procedural objection created paperwork. Minor, but noted." },
        ],
        fameEffects:   { esperanza: 0, solomon: 0, whitmore: +4 },
        infamyEffects: { esperanza: 0, solomon: 0, whitmore:  0 },
      },
    ],
  },
  {
    id: 'conv_three_star_reckoning',
    condition: (stars, taken, state) => {
      // Whitmore must be visible in Persons — his Star ya tick must have passed.
      const whitmoreRevealed = state?.revealedStars?.includes('whitmore') ?? false;
      const absMacro = s => Math.abs(macropassionValue(s.passions));
      return whitmoreRevealed &&
        absMacro(stars.esperanza) >= 30 && absMacro(stars.solomon) >= 30 && absMacro(stars.whitmore) >= 30;
    },
    headline: 'THREE LETTERS IN ONE WEEK — All of them need something.',
    bodyFn: (taken, declined) => taken.includes('lend_solomon') && !declined.includes('lend_solomon')
      ? "Three letters arrive in the same week. Esperanza Vallejo needs a witness at a boundary hearing in Sacramento — the case that will determine whether the grant survives the decade. Solomon Reed needs help navigating a federal challenge to his warehouse deed before the territorial office closes its docket; the post he built with your loan is now at legal risk. J.T. Whitmore needs your name on a critical corridor extension before it lapses. Each of them knows you are the right person for what they need. None of them knows about the other two letters. You cannot be in three places at once. The two you don't answer will remember your absence in different ways."
      : declined.includes('lend_solomon')
      ? "Three letters arrive in the same week. Esperanza Vallejo needs a witness at a boundary hearing in Sacramento — the case that will determine whether the grant survives the decade. Solomon Reed needs help navigating a federal challenge to his warehouse deed before the territorial office closes its docket; the post he built without your help is now at legal risk. J.T. Whitmore needs your name on a critical corridor extension before it lapses. Each of them knows you are the right person for what they need. None of them knows about the other two letters. You cannot be in three places at once. The two you don't answer will remember your absence in different ways."
      : "Three letters arrive in the same week. Esperanza Vallejo needs a witness at a boundary hearing in Sacramento — the case that will determine whether the grant survives the decade. Solomon Reed needs your name on a territorial filing that has come due without warning; he cannot navigate it alone and he will not ask twice. J.T. Whitmore needs your name on a critical corridor extension before it lapses. Each of them knows you are the right person for what they need. None of them knows about the other two letters. You cannot be in three places at once. The two you don't answer will remember your absence in different ways.",
    choices: [
      {
        id: 'answer_esperanza',
        label: "Answer Esperanza — appear at the boundary hearing",
        descFn: (taken, declined) => taken.includes('lend_solomon') && !declined.includes('lend_solomon')
          ? "You go to Sacramento. The hearing goes better with you there. Solomon's deed challenge draws an adverse ruling without you. Whitmore's corridor extension lapses and has to be re-filed at cost."
          : declined.includes('lend_solomon')
          ? "You go to Sacramento. The hearing goes better with you there. Solomon's deed challenge on the warehouse he built without you draws an adverse ruling. Whitmore's corridor extension lapses and has to be re-filed at cost."
          : "You go to Sacramento. The hearing goes better with you there. Solomon's filing goes uncontested without you. Whitmore's corridor extension lapses and has to be re-filed at cost.",
        effects: [
          { star: 'esperanza', passion: 'land',     delta: +20, why: "Your presence at the hearing gave the Vallejo survey its best legal day." },
          { star: 'esperanza', passion: 'trust',    delta: +10, why: "When it came to a direct choice across three demands, you came." },
          { star: 'solomon',   passion: 'roots',    delta: -10, why: (taken, declined) => taken.includes('lend_solomon') && !declined.includes('lend_solomon')
              ? "The adverse ruling while you were absent has put his warehouse deed in question."
              : declined.includes('lend_solomon')
              ? "The adverse ruling has put the warehouse deed in question. He built it without you; he's defending it without you too."
              : "The filing went badly without you. His footing in the valley is less certain." },
          { star: 'whitmore',  passion: 'standing', delta: -10, why: "The lapsed corridor extension is a failure he has to explain to the company." },
        ],
        fameEffects:   { esperanza: +16, solomon:   0, whitmore:   0 },
        infamyEffects: { esperanza:   0, solomon:  +8, whitmore: +10 },
      },
      {
        id: 'answer_solomon',
        labelFn: (taken, declined) => taken.includes('lend_solomon') && !declined.includes('lend_solomon')
          ? "Answer Solomon — defend the warehouse deed"
          : declined.includes('lend_solomon')
          ? "Answer Solomon — defend the warehouse deed"
          : "Answer Solomon — help navigate the territorial filing",
        descFn: (taken, declined) => taken.includes('lend_solomon') && !declined.includes('lend_solomon')
          ? "You go to the territorial office with Solomon. The deed challenge is turned back. The post you helped build is secure. Esperanza's hearing in Sacramento proceeds without its expected witness. Whitmore's extension lapses."
          : declined.includes('lend_solomon')
          ? "You go to the territorial office with Solomon. The deed challenge is turned back. The post he built without your help is secure — with your legal help, if not your money. Esperanza's hearing proceeds without its expected witness. Whitmore's extension lapses."
          : "You go to the territorial office with Solomon. The filing is resolved in his favor. Esperanza's hearing in Sacramento proceeds without its expected witness. Whitmore's extension lapses.",
        effects: [
          { star: 'solomon',   passion: 'roots',    delta: +20, why: (taken, declined) => taken.includes('lend_solomon') && !declined.includes('lend_solomon')
              ? "The deed challenge was turned back. The post is secure."
              : declined.includes('lend_solomon')
              ? "The deed challenge was turned back. He needed you for this even if he didn't need you for the money."
              : "The filing resolved in his favor. His position in the valley is firmer." },
          { star: 'solomon',   passion: 'autonomy', delta: +10, why: "You navigated federal process on his behalf without entangling him in it further." },
          { star: 'esperanza', passion: 'trust',    delta: -20, why: "She had asked specifically for you. You sent word you couldn't come. She went alone." },
          { star: 'whitmore',  passion: 'standing', delta: -10, why: "The lapsed extension is another failure on his record with the company." },
        ],
        fameEffects:   { esperanza:   0, solomon: +16, whitmore:   0 },
        infamyEffects: { esperanza: +10, solomon:   0, whitmore: +10 },
      },
      {
        id: 'answer_whitmore',
        label: "Answer Whitmore — sign the corridor extension",
        descFn: (taken, declined) => taken.includes('lend_solomon') && !declined.includes('lend_solomon')
          ? "You sign the extension and it goes through. Esperanza's hearing draws a split ruling — not a loss, but not the win she needed. Solomon's deed challenge draws an adverse ruling."
          : declined.includes('lend_solomon')
          ? "You sign the extension and it goes through. Esperanza's hearing draws a split ruling — not a loss, but not the win she needed. Solomon's deed challenge on the warehouse he built without you draws an adverse ruling."
          : "You sign the extension and it goes through. Esperanza's hearing draws a split ruling — not a loss, but not the win she needed. Solomon's filing goes against him.",
        effects: [
          { star: 'whitmore',  passion: 'corridor', delta: +20, why: "The extension went through. The corridor is secured for another season." },
          { star: 'whitmore',  passion: 'standing', delta: +10, why: "He delivered again. The company notes the name on the filing." },
          { star: 'esperanza', passion: 'trust',    delta: -20, why: "She had asked specifically for you. You were at Whitmore's office. She understands exactly what that means." },
          { star: 'solomon',   passion: 'roots',    delta: -10, why: (taken, declined) => taken.includes('lend_solomon') && !declined.includes('lend_solomon')
              ? "The adverse ruling on his deed has put the warehouse in question. He knows where you were."
              : declined.includes('lend_solomon')
              ? "The adverse ruling has put the warehouse in question. He built it without you and defended it without you. He knows where you were."
              : "The filing went against him. He knows where you were." },
        ],
        fameEffects:   { esperanza:   0, solomon:   0, whitmore: +18 },
        infamyEffects: { esperanza: +12, solomon: +10, whitmore:   0 },
      },
    ],
  },
];

// ─── TRANSIENT GUESTS ─────────────────────────────────────────────────────────
// ─── GUEST POOL ───────────────────────────────────────────────────────────────
// Strangers arrive via Poisson-style draw — roughly every 3–5 years on average.
// Each season after the last guest departed, the draw probability increases until
// a guest fires, then resets. Guests are drawn randomly from the available pool
// weighted by their weight value. Some guests require a Star's macropassion to
// be above a threshold before they can appear (gated by relationship depth).
//
// Fields:
//   weight: number          — relative probability weight (higher = more likely)
//   requiresMacropassion:   — { star, min } — gate on macropassion threshold
//   Any unlocked by Star passions can be added to the pool via unlocksGuests
//   on reactive events (infrastructure ready, not yet authored).
//
// Note: additional guests can be added to this pool freely — the draw system
// handles selection. Some guests intentionally only appear if the player has
// built certain relationships.

const GUEST_POOL = [
  {
    id: 'comanche_night',
    weight: 10,
    // No macropassion gate — can appear early, moral weight regardless of relationships
    name: 'Unknown — Traveling Under Another Name',
    role: 'Moving East. One Night.',
    arrival: 'He arrives at dusk with a single horse and says very little. He is traveling under a name that is not his. His sister is missing. He needs one night\'s shelter and your silence. The marshal will ask questions in the morning.',
    moral: '"And the stranger that dwelleth with you shall be unto you as one born among you." — Leviticus 19:34',
    choices: [
      {
        id: 'grant_sanctuary',
        label: 'Grant Sanctuary',
        desc: 'You give him the barn and say nothing to the marshal in the morning.',
        homesteadNote: 'Sheltered a man traveling under another name. The marshal came at dawn and left without answers.',
        effects: [
          { star: 'esperanza', passion: 'trust',    delta: +10,  why: "You defied the federal marshal. That is the kind of action she has been watching for." },
          { star: 'solomon',   passion: 'autonomy', delta: +10,  why: "You acted outside federal record and said nothing. He will hear about this." },
          { star: 'solomon',   passion: 'caleb',    delta: +5,  why: "You sheltered a man crossing three territories to find his sister. He knows what that costs." },
          { star: 'whitmore',  passion: 'corridor', delta: -5,  why: "The marshal left the crossroads empty-handed. Word of that travels." },
        ],
        fameEffects:   { esperanza: +4, solomon: +10, whitmore: 0 },
        infamyEffects: { esperanza: 0,  solomon: 0,  whitmore: +8 },
        logHeadline: 'MARSHAL REPORTS NO SIGN OF FUGITIVE — Continues north.',
        logBody: 'A territorial marshal passed through the valley in pursuit of a Comanche man wanted in the eastern territories. The settler at the crossroads reported no unusual visitors. The marshal continued north.',
        echoDef: { years: 2, dateline: 'El Fronterizo · Tucson', headline: 'COMANCHE WOMAN FOUND ALIVE IN SONORA — Brother credited with rescue.', body: 'A Comanche woman missing since the winter of 1810 has been located in Sonora in the care of a Mexican family. Her brother is said to have crossed three territories to reach her. Their names are not given here.' },
      },
      {
        id: 'turn_away_comanche',
        label: 'Turn Him Away',
        desc: 'You tell him you cannot help. He rides into the dark.',
        homesteadNote: 'Turned away a man at dusk who asked for one night.',
        effects: [
          { star: 'solomon',   passion: 'autonomy', delta: -5,  why: "You turned away someone the network would have helped. He will file that." },
          { star: 'esperanza', passion: 'trust',    delta: -5,  why: "You had a chance to act against the federal apparatus. You didn't." },
        ],
        fameEffects:   { esperanza: 0, solomon:  0, whitmore: 0 },
        infamyEffects: { esperanza: 0, solomon: +8, whitmore: 0 },
        logHeadline: 'MARSHAL FINDS NO INTELLIGENCE AT CROSSROADS — Search continues.',
        logBody: 'The territorial marshal found no useful intelligence at the valley crossroads. He continued north. No further reports.',
        echoDef: null,
      },
      {
        id: 'report_comanche',
        label: 'Report to the Marshal',
        desc: 'You tell the marshal which direction he rode. You know what follows from that.',
        homesteadNote: 'Gave the marshal the direction. Knew what it meant.',
        effects: [
          { star: 'solomon',   passion: 'autonomy', delta: -20, why: "You handed someone over to the federal apparatus. That is not a neutral act in his accounting." },
          { star: 'solomon',   passion: 'caleb',    delta: -10, why: "You sent a man searching for his sister into custody. He knows what that means." },
          { star: 'esperanza', passion: 'trust',    delta: -10, why: "You cooperated with federal authority against an outsider. She is taking notes." },
          { star: 'whitmore',  passion: 'corridor', delta:  +10, why: "You upheld the federal order when it cost you something. He respects that." },
          { star: 'whitmore',  passion: 'standing', delta:  +5, why: "A settler who cooperates with federal authority is a settler worth having. The company notices that kind of reliability." },
        ],
        fameEffects:   { esperanza:  0, solomon:   0, whitmore: +5 },
        infamyEffects: { esperanza: +8, solomon: +18, whitmore:  0 },
        logHeadline: 'COMANCHE MAN TAKEN INTO FEDERAL CUSTODY — Settler provides information leading to arrest.',
        logBody: 'A Comanche man traveling through the valley was taken into federal custody after a local settler provided the territorial marshal with directional intelligence. He was transported east. His sister\'s whereabouts remain unknown.',
        echoDef: { years: 3, dateline: 'Sacramento Union · California', headline: 'COMANCHE PRISONER DIES IN FEDERAL CUSTODY — No next of kin located.', body: 'A Comanche man held in federal custody since his arrest in the valley territories has died of illness at the territorial detention facility. His name, if it was ever recorded accurately, does not appear in the official ledger.' },
      },
    ],
  },
  {
    id: 'underground_conductor',
    weight: 10,
    requiresMacropassion: { star: 'solomon', min: 15 }, // Solomon must be at least Cautious Friend — his network surfaces this
    name: 'Isaiah Drum',
    role: 'Freedman. Moving People North.',
    arrival: 'He comes to the back door after dark with seven people who do not speak. He is moving them out of the South along a route that exists only in the memory of the people who walk it. He needs your barn for two nights and your silence indefinitely. He does not ask this lightly.',
    moral: '"Is not this the fast that I have chosen — to loose the bands of wickedness, to let the oppressed go free?" — Isaiah 58:6',
    choices: [
      {
        id: 'open_barn',
        label: 'Open the Barn',
        desc: 'Two nights. You feed them, say nothing, and watch them go north.',
        homesteadNote: 'Isaiah Drum passed through with seven. Two nights. They went north.',
        effects: [
          { star: 'solomon',   passion: 'autonomy', delta: +10, why: 'Word travels in the freedmen network. What you did here will be known to those who need to know it.' },
          { star: 'solomon',   passion: 'roots',    delta:  +5, why: "A crossroads that shelters people the network trusts is a crossroads worth anchoring to." },
          { star: 'esperanza', passion: 'trust',    delta: +5,  why: "You opened your door against the federal order. That is the kind of thing that travels in the right channels." },
          { star: 'whitmore',  passion: 'corridor', delta: -10,  why: "A settler running an unsanctioned operation out of the crossroads is a problem the railroad will eventually have to account for." },
        ],
        fameEffects:   { esperanza: +4, solomon: +20, whitmore: 0 },
        infamyEffects: { esperanza: 0,  solomon: 0,  whitmore: +14 },
        logHeadline: 'NO UNUSUAL REPORT — Crossroads quiet this week.',
        logBody: 'Nothing of note was reported at the valley crossroads.',
        echoDef: { years: 4, dateline: 'The Liberator · Boston', headline: 'SEVEN REACH ONTARIO — Conductor credits a station on the valley road.', body: 'Seven individuals who escaped bondage in the southern territories have arrived safely in Ontario. The conductor who brought them north credited the courage of those who opened their doors without being asked twice. No names are given.' },
      },
      {
        id: 'refuse_drum',
        label: 'Turn Them Away',
        desc: 'You tell him the risk is too great. He finds another way.',
        homesteadNote: 'Isaiah Drum came to the back door. You sent him on.',
        effects: [
          { star: 'solomon', passion: 'autonomy', delta: -10, why: "You turned away the freedmen network when it needed a door opened. He will hear about it." },
        ],
        fameEffects:   { esperanza: 0, solomon:   0, whitmore: 0 },
        infamyEffects: { esperanza: 0, solomon: +14, whitmore: 0 },
        logHeadline: 'NO REPORT — Crossroads quiet.',
        logBody: 'Nothing of note was reported at the valley crossroads this week.',
        echoDef: null,
      },
    ],
  },
  {
    id: 'the_teacher',
    weight: 10,
    // No macropassion gate — moral clarity is available regardless of standing
    name: 'Clara Finch',
    role: 'Schoolteacher. Heading to the Mining Camps.',
    arrival: 'She is heading to a mining camp that does not know it needs her. The road north forks: one route is faster but runs through contested territory with reports of violence this season. The other is longer and safer. She asks you which road to take. You know this country.',
    moral: '"A false witness shall not be unpunished, and he that speaketh lies shall not escape." — Proverbs 19:5',
    choices: [
      {
        id: 'safe_road',
        label: 'Send Her the Long Way',
        desc: 'You describe the safer route clearly. Three extra days, but she arrives.',
        homesteadNote: 'Clara Finch stopped heading north. Sent her the long road. Heard later she made it.',
        effects: [
          { star: 'esperanza', passion: 'coalition', delta: +5, why: "The school she builds will serve Californio children too. What you enabled here has a longer reach than it looks." },
          { star: 'solomon',   passion: 'roots',     delta: +5, why: "A settled, working valley is better for the post. You acted like someone who intends to stay." },
        ],
        fameEffects:   { esperanza: +5, solomon: +5, whitmore: 0 },
        infamyEffects: { esperanza: 0,  solomon: 0,  whitmore: 0 },
        logHeadline: 'SCHOOLTEACHER ARRIVES AT NORTHGATE CAMP — Plans to open school in spring.',
        logBody: 'Clara Finch, a schoolteacher from Ohio, has arrived at the Northgate mining camp. She credited a settler at the valley crossroads with giving her accurate road intelligence. The camp received the news favorably.',
        echoDef: { years: 3, dateline: 'Alta California · San Francisco', headline: 'NORTHGATE SCHOOL ENROLLS 34 — What one woman built in three years.', body: 'The school established at Northgate by Clara Finch now enrolls thirty-four students, including children of miners, Chinese laborers, and two Californio families from the adjacent valley. Miss Finch declined an interview.' },
      },
      {
        id: 'wrong_road',
        label: 'Send Her the Fast Way',
        desc: 'You tell her the direct route is passable. You know it is not entirely safe.',
        homesteadNote: 'Sent Clara Finch the fast road. Did not tell her everything.',
        effects: [
          { star: 'esperanza', passion: 'trust',    delta: -10, why: "An Anglo settler deceived a woman who trusted him with her life. This is the pattern she has been describing." },
          { star: 'solomon',   passion: 'roots',    delta: -5, why: "Death on the roads unsettles everything. The valley is harder to build in when it is that kind of place." },
        ],
        fameEffects:   { esperanza:  0, solomon:  0, whitmore: 0 },
        infamyEffects: { esperanza: +6, solomon: +6, whitmore: 0 },
        logHeadline: 'WOMAN MISSING ON NORTHERN ROAD — Last seen at valley crossroads.',
        logBody: 'A schoolteacher reported heading to the northern mining camps has not arrived at her destination. The territorial office has been notified. A search is being organized.',
        echoDef: { years: 1, dateline: 'Sacramento Union · California', headline: 'BODY RECOVERED ON NORTHERN PASS — Identified as Ohio schoolteacher.', body: 'The remains of a woman identified as Clara Finch of Medina, Ohio, were recovered on the northern pass road this week. She had been heading to the Northgate mining camp. No next of kin has been located. The camp she was heading for has no school.' },
      },
    ],
  },
  {
    id: 'retired_outlaw',
    weight: 9,
    requiresMacropassion: { star: 'esperanza', min: 15 },
    // Esperanza's community would recognize the name — requires she's at least Cautious Friend
    name: 'A Man Going to His Sister',
    role: 'Old Business. Quiet Road.',
    arrival: "He is older than he looks at first, riding a borrowed horse and carrying nothing worth stealing. He gives a name that is probably not his. Over supper he mentions a rancho near Monterey — a name the Californio families would recognize. Fifteen years ago, he was someone the valley was afraid of. He says he is going to his sister. He says he is done with the rest of it. You believe him more than you expected to.",
    moral: '"Blessed are the merciful, for they shall obtain mercy." — Matthew 5:7',
    choices: [
      {
        id: 'let_him_go',
        label: 'Say Nothing',
        desc: "He leaves at first light. You don't ask his name again.",
        homesteadNote: 'A man with an old name stopped one night. Left quiet. Said nothing about where he was going.',
        effects: [
          { star: 'esperanza', passion: 'trust',    delta: +8,  why: "A settler who holds his tongue about old Californio business is a settler she can work with." },
          { star: 'solomon',   passion: 'autonomy', delta: +5,  why: "You let a man pass without involving the law. That kind of judgment travels." },
        ],
        fameEffects:   { esperanza: +5, solomon: +8, whitmore: 0 },
        infamyEffects: { esperanza: 0,  solomon: 0,  whitmore: 0 },
        logHeadline: 'NO REPORT — Crossroads quiet.',
        logBody: 'Nothing of note was reported at the valley crossroads.',
        echoDef: null,
      },
      {
        id: 'warn_esperanza',
        label: "Send Word to Esperanza",
        desc: "You get a message to Esperanza before he's out of the valley. What happens next is hers to decide.",
        homesteadNote: 'Sent word to Vallejo about a man passing through. Did not wait to see what came of it.',
        effects: [
          { star: 'esperanza', passion: 'trust',      delta: +12, why: "You brought her information she would want. She will remember that." },
          { star: 'esperanza', passion: 'coalition',  delta: +5,  why: "Old justice handled inside the community, not through Anglo law." },
        ],
        fameEffects:   { esperanza: +10, solomon: 0, whitmore: 0 },
        infamyEffects: { esperanza: 0,   solomon: 0, whitmore: 0 },
        logHeadline: 'NO REPORT — Crossroads quiet.',
        logBody: 'Nothing of note was reported at the valley crossroads.',
        echoDef: null,
      },
      {
        id: 'report_outlaw',
        label: 'Report Him to the Territorial Office',
        desc: "You file a report. He's taken into custody two days down the road.",
        homesteadNote: 'Reported a man passing through. Heard later he was taken in for old business.',
        effects: [
          { star: 'esperanza', passion: 'trust',      delta: -15, why: "You handed a man over to Anglo law for something the community had already decided was finished. She will not forget that." },
          { star: 'esperanza', passion: 'coalition',  delta: -10, why: "The families will hear you went to the territorial office about one of their own." },
          { star: 'whitmore',  passion: 'standing',   delta: +5,  why: "A settler who cooperates with federal authority is a settler the railroad can work with." },
        ],
        fameEffects:   { esperanza: 0,  solomon: 0,  whitmore: +6 },
        infamyEffects: { esperanza: +8, solomon: +8, whitmore: 0  },
        logHeadline: 'MAN DETAINED ON VALLEY ROAD — Territorial office cites outstanding warrant.',
        logBody: 'A man detained on the valley road by territorial officers has been identified as the subject of a warrant issued some years prior. He was taken south under escort.',
        echoDef: null,
      },
    ],
  },
  {
    id: 'mountain_man',
    weight: 9,
    // No gate — appears to anyone
    name: 'Jedidiah Carp',
    role: 'Trapper. Sierra Nevada. Long Time Out.',
    arrival: "He comes down from the mountains in late autumn smelling like everything that lives up there. He's been working the eastern Sierra for two seasons and has a winter's worth of pelts and something else: a surveyor's map he found on a dead man in a northern pass. The map shows a route through the mountains that doesn't appear on any railroad filing. He doesn't know what he has. You do.",
    moral: '"A man that hath friends must show himself friendly." — Proverbs 18:24',
    choices: [
      {
        id: 'buy_the_map',
        label: 'Buy the Map',
        desc: "You pay him a fair price. He's satisfied. You now hold something Whitmore doesn't know exists.",
        homesteadNote: 'Bought a survey map off a mountain man. Came down from the northern pass. Did not say where I got it.',
        effects: [
          { star: 'whitmore',  passion: 'corridor', delta: -8,  why: "Information he should have is now in your hands instead." },
          { star: 'esperanza', passion: 'land',     delta: +8,  why: "A route through the northern pass that the railroad hasn't filed on is something she can use." },
        ],
        fameEffects:   { esperanza: +5, solomon: 0, whitmore: 0 },
        infamyEffects: { esperanza: 0,  solomon: 0, whitmore: 0 },
        logHeadline: 'TRAPPER PASSES THROUGH VALLEY — Winter supply stop.',
        logBody: 'A fur trapper passing through the valley crossroads stopped to resupply before heading south. No further details reported.',
        echoDef: null,
      },
      {
        id: 'send_to_whitmore',
        label: 'Point Him Toward Whitmore',
        desc: "You tell him the railroad man will pay more. Whitmore gets the map.",
        homesteadNote: 'Sent a mountain man with a survey map to Whitmore. Did not ask to see it first.',
        effects: [
          { star: 'whitmore', passion: 'corridor', delta: +12, why: "An unmapped pass through the northern Sierra is exactly what the railroad needs." },
          { star: 'whitmore', passion: 'standing', delta: +5,  why: "You brought him something useful without being asked. He will note that." },
        ],
        fameEffects:   { esperanza: 0, solomon: 0, whitmore: +8 },
        infamyEffects: { esperanza: 0, solomon: 0, whitmore: 0  },
        logHeadline: 'TRAPPER MEETS WITH RAILROAD SURVEYOR — Details undisclosed.',
        logBody: 'A fur trapper recently arrived from the Sierra Nevada was observed in conversation with J.T. Whitmore of Pacific Railroad. No statement was issued.',
        echoDef: { years: 4, dateline: 'Pacific Railroad Bulletin · Sacramento', headline: 'NORTHERN PASS ROUTE CONFIRMED — Survey work advances ahead of schedule.', body: 'Pacific Railroad has confirmed the viability of a northern pass route through the Sierra Nevada, citing new survey intelligence obtained through field sources. The corridor timeline has been advanced by two years.' },
      },
      {
        id: 'say_nothing_map',
        label: 'Feed Him and Send Him South',
        desc: "You give him a meal and directions to the trading post. The map stays with him.",
        homesteadNote: 'Mountain man stopped through. Good company. Sent him to Solomon\'s post.',
        effects: [
          { star: 'solomon', passion: 'roots', delta: +5, why: "You sent a traveler with useful trade goods to the post. That kind of referral matters." },
        ],
        fameEffects:   { esperanza: 0, solomon: +5, whitmore: 0 },
        infamyEffects: { esperanza: 0, solomon: 0,  whitmore: 0 },
        logHeadline: 'TRAPPER PASSES THROUGH — No report.',
        logBody: 'Nothing of note.',
        echoDef: null,
      },
    ],
  },
  {
    id: 'snake_oil',
    weight: 7,
    // No gate
    name: 'Professor Aurelius Crane',
    role: 'Medicine and Improvement. One Week Only.',
    arrival: "He sets up a wagon at the crossroads with painted signs in English and Spanish and begins drawing a crowd. His preparations treat everything: dysentery, rheumatism, difficult labors, grief. The Californio families are buying. Some of them can't afford to be buying. His remedies are alcohol and camphor in a brown bottle with a label that cost more than the contents. He will be gone by Sunday. The question is whether you say anything before then.",
    moral: '"Thou shalt not bear false witness against thy neighbour." — Exodus 20:16',
    choices: [
      {
        id: 'warn_quietly',
        label: 'Warn the Families Quietly',
        desc: "You go door to door among the Californio families. By the third day his sales have dried up. He packs early.",
        homesteadNote: 'Warned the valley families about the medicine man. He left early.',
        effects: [
          { star: 'esperanza', passion: 'trust',      delta: +10, why: "You protected the families without making a public scene. That's the kind of action she has been watching for." },
          { star: 'esperanza', passion: 'coalition',  delta: +8,  why: "The community will remember who went door to door for them." },
        ],
        fameEffects:   { esperanza: +10, solomon: +5, whitmore: 0 },
        infamyEffects: { esperanza: 0,   solomon: 0,  whitmore: 0 },
        logHeadline: 'MEDICINE WAGON DEPARTS EARLY — No statement from proprietor.',
        logBody: 'A traveling medicine vendor who had been operating at the valley crossroads departed ahead of his announced schedule. No explanation was given.',
        echoDef: null,
      },
      {
        id: 'report_to_whitmore',
        label: 'Report Him to the Territorial Office',
        desc: "You file a complaint. He's escorted out by the week's end. It becomes a public matter.",
        homesteadNote: 'Reported Professor Crane to the territorial office. He was removed.',
        effects: [
          { star: 'esperanza', passion: 'trust',    delta: -5,  why: "You went to Anglo law first instead of the community. The families would have preferred to handle it themselves." },
          { star: 'whitmore',  passion: 'standing', delta: +5,  why: "A settler who uses official channels is one the federal apparatus can count on." },
          { star: 'solomon',   passion: 'autonomy', delta: -5,  why: "Running to the territorial office is exactly the kind of reflex he's been watching for." },
        ],
        fameEffects:   { esperanza: 0, solomon: 0, whitmore: +5 },
        infamyEffects: { esperanza: 0, solomon: +5, whitmore: 0 },
        logHeadline: 'TERRITORIAL OFFICE REMOVES MEDICINE VENDOR — Operating without authorization.',
        logBody: 'A vendor operating a medicine show at the valley crossroads was removed by territorial officers following a complaint. The vendor\'s preparations were confiscated.',
        echoDef: null,
      },
      {
        id: 'say_nothing_crane',
        label: 'Say Nothing',
        desc: "He takes the community's money and leaves Sunday as promised.",
        homesteadNote: 'Professor Crane sold his remedies for a week and left. Said nothing.',
        effects: [
          { star: 'esperanza', passion: 'trust', delta: -8, why: "You watched and said nothing. She will hear about that." },
        ],
        fameEffects:   { esperanza: 0, solomon: 0, whitmore: 0 },
        infamyEffects: { esperanza: +8, solomon: 0, whitmore: 0 },
        logHeadline: 'MEDICINE SHOW CONCLUDES — Vendor departs Sunday as scheduled.',
        logBody: 'Professor Aurelius Crane\'s traveling medicine exhibition concluded its week-long engagement at the valley crossroads. The vendor departed Sunday morning.',
        echoDef: null,
      },
    ],
  },
  {
    id: 'boy_alone',
    weight: 8,
    // No gate — can appear to anyone, the dilemma requires nothing of the relationship
    name: 'A Boy on the Valley Road',
    role: 'Alone. Heading West.',
    arrival: "He is maybe ten years old, walking west on the valley road with a small pack and no explanation. He says his name is Thomas. He says he is going to his uncle in the coast settlements. He says it the way a child says something he has rehearsed. There is no uncle. You are fairly certain of this. The road west is thirty miles of open country with no shelter. He has cornbread and a canteen.",
    moral: '"Defend the poor and fatherless: do justice to the afflicted and needy." — Psalm 82:3',
    choices: [
      {
        id: 'take_him_in',
        label: 'Take Him In for the Night',
        desc: "You feed him and give him a place to sleep. In the morning you learn a little more about where he came from.",
        homesteadNote: 'A boy alone on the valley road. Stayed one night. Left in better shape than he arrived.',
        effects: [
          { star: 'esperanza', passion: 'coalition', delta: +8,  why: "The valley families will hear about this. A crossroads that takes in children traveling alone is a crossroads worth having." },
          { star: 'solomon',   passion: 'roots',     delta: +8,  why: "A valley where a child can find shelter is a valley worth building something in." },
        ],
        fameEffects:   { esperanza: +6, solomon: +6, whitmore: 0 },
        infamyEffects: { esperanza: 0,  solomon: 0,  whitmore: 0 },
        logHeadline: 'NO REPORT — Crossroads quiet.',
        logBody: 'Nothing of note was reported at the valley crossroads.',
        echoDef: null,
      },
      {
        id: 'send_to_mission',
        label: 'Send Him to the Mission',
        desc: "You give him directions to the nearest mission and a coin for the road. It is the responsible thing.",
        homesteadNote: 'Sent a boy alone on the road to the mission. Gave him a coin.',
        effects: [
          { star: 'esperanza', passion: 'coalition', delta: +3, why: "You did something. Not much, but something." },
        ],
        fameEffects:   { esperanza: +3, solomon: 0, whitmore: 0 },
        infamyEffects: { esperanza: 0,  solomon: 0, whitmore: 0 },
        logHeadline: 'NO REPORT.',
        logBody: 'Nothing of note.',
        echoDef: null,
      },
      {
        id: 'send_him_on',
        label: 'Send Him on His Way',
        desc: "You tell him the road is straight and wish him well. He thanks you and goes.",
        homesteadNote: 'A boy on the road. Sent him west. Did not ask questions.',
        effects: [
          { star: 'solomon', passion: 'roots', delta: -5, why: "A crossroads that sends a child alone into thirty miles of open country is not a crossroads that means anything." },
        ],
        fameEffects:   { esperanza: 0, solomon: 0, whitmore: 0 },
        infamyEffects: { esperanza: 0, solomon: 0, whitmore: 0 },
        logHeadline: 'NO REPORT.',
        logBody: 'Nothing of note.',
        echoDef: null,
      },
    ],
  },
  {
    id: 'russian_trader',
    weight: 7,
    // No gate — Fort Ross traders appear in the valley before any relationship is established
    name: 'Alexei Volkov',
    role: 'Trader. Fort Ross. Heading South.',
    arrival: "He comes from Fort Ross with a wagon of sea otter pelts and tools the valley hasn't seen before — Russian iron, good steel, things made to last in hard country. He speaks Spanish with a heavy accent and English with a heavier one. He wants to trade and he wants to know who the real powers in this valley are. He is mapping something, though he calls it conversation. The Russian Imperial Company's interest in California is not purely commercial and everyone knows it.",
    moral: '"A good name is rather to be chosen than great riches." — Proverbs 22:1',
    choices: [
      {
        id: 'trade_fairly',
        label: 'Trade Fairly and Say Little',
        desc: "You buy what you need at fair prices and answer his questions with what anyone would know.",
        homesteadNote: 'Russian trader from Fort Ross. Bought steel and tools. Told him nothing useful.',
        effects: [
          { star: 'solomon',  passion: 'roots',    delta: +6,  why: "Good tools at fair prices benefit the post and everyone connected to it." },
          { star: 'whitmore', passion: 'corridor', delta: +4,  why: "A settler who keeps his dealings with foreign agents unremarkable is one less problem for the federal filing." },
        ],
        fameEffects:   { esperanza: 0, solomon: +5, whitmore: +3 },
        infamyEffects: { esperanza: 0, solomon: 0,  whitmore: 0  },
        logHeadline: 'RUSSIAN TRADER PASSES THROUGH — Commercial visit reported.',
        logBody: 'A trader representing interests from the Russian settlement at Fort Ross conducted commercial business at the valley crossroads before continuing south.',
        echoDef: null,
      },
      {
        id: 'introduce_esperanza',
        label: 'Introduce Him to Esperanza',
        desc: "The Californio families and the Russians have a shared interest in keeping the Americans from consolidating California too quickly. You make the introduction.",
        homesteadNote: 'Introduced the Fort Ross trader to Esperanza Vallejo. Did not stay for the conversation.',
        effects: [
          { star: 'esperanza', passion: 'coalition',  delta: +10, why: "A foreign power with adjacent territorial claims is a useful relationship for the coalition." },
          { star: 'esperanza', passion: 'trust',      delta: +6,  why: "You brought her something with real political weight. She will remember it." },
          { star: 'whitmore',  passion: 'corridor',   delta: -8,  why: "A settler facilitating contact between Californio families and Russian Imperial agents is a problem the federal filing will have to account for." },
        ],
        fameEffects:   { esperanza: +10, solomon: 0, whitmore: 0  },
        infamyEffects: { esperanza: 0,   solomon: 0, whitmore: +8 },
        logHeadline: 'RUSSIAN AGENT MEETS WITH VALLEJO FAMILY — Nature of meeting undisclosed.',
        logBody: 'A representative of the Russian Imperial-American Company met with members of the Vallejo land grant family during a commercial visit to the valley. The substance of the meeting was not reported.',
        echoDef: { years: 5, dateline: 'Alta California · San Francisco', headline: 'FORT ROSS SOLD TO SUTTER — Russian presence in California ends.', body: 'The Russian Imperial-American Company has sold Fort Ross and all associated California holdings to John Sutter. The transaction ends nearly three decades of Russian commercial and territorial presence in Alta California. The Californio families who had dealings with the Russian settlement are watching what replaces it.' },
      },
      {
        id: 'turn_him_away',
        label: 'Tell Him the Valley Is Settled',
        desc: "You are polite but clear. He is not welcome to conduct business here. He goes south without stopping.",
        homesteadNote: 'Turned away the Fort Ross trader. Told him the valley had what it needed.',
        effects: [
          { star: 'whitmore', passion: 'standing', delta: +6,  why: "A settler who turns away Russian commercial agents without incident is one the company can trust near the federal corridor." },
          { star: 'solomon',  passion: 'roots',    delta: -5,  why: "Russian steel was good steel. Refusing trade the valley could use is not what a man building something permanent does." },
        ],
        fameEffects:   { esperanza: 0, solomon: 0, whitmore: +5 },
        infamyEffects: { esperanza: 0, solomon: 0, whitmore: 0  },
        logHeadline: 'RUSSIAN TRADER BYPASSES VALLEY — Continues south.',
        logBody: 'A trader from the Fort Ross settlement passed through the valley without conducting business, continuing south toward Monterey.',
        echoDef: null,
      },
    ],
  },
];
// Historical texture that arrives regardless of player action.
// Fire in the Spring of their target year.

const WORLD_DISPATCHES = [
  { id: 'wd_1812_war',      fireYear: 1812, dateline: 'National Intelligencer · Washington D.C.', headline: 'WAR DECLARED WITH BRITAIN — Congress authorizes force along the northern border.', body: 'Congress has voted to declare war against Great Britain. The border territories are on alert. Trade routes north are uncertain. The valley hears about it three weeks after the fact.' },
  { id: 'wd_1820_comp',     fireYear: 1820, dateline: 'Missouri Gazette · St. Louis', headline: 'MISSOURI COMPROMISE SIGNED — Slavery question deferred, not resolved.', body: 'Congress has drawn a line at 36°30\' north latitude. Slavery permitted below, prohibited above. The men who negotiated this call it a settlement. The people who live under it call it something else.' },
  { id: 'wd_1828_jackson',  fireYear: 1828, dateline: 'United States Telegraph · Washington D.C.', headline: 'JACKSON WINS THE PRESIDENCY — Old Hickory carries the frontier states.', body: 'Andrew Jackson has been elected President. He is popular in the frontier territories. The Californio families in the valley have heard his views on land titles. They are not celebrating.' },
  { id: 'wd_1833_abol',     fireYear: 1833, dateline: 'The Liberator · Boston', headline: 'AMERICAN ANTI-SLAVERY SOCIETY FOUNDED — Garrison calls for immediate emancipation.', body: 'William Lloyd Garrison and Arthur Tappan have founded the American Anti-Slavery Society in Philadelphia. Their papers are circulating in the territories, passed hand to hand.' },
  { id: 'wd_1836_texas',    fireYear: 1836, dateline: 'Telegraph and Texas Register · San Felipe', headline: 'TEXAS DECLARES INDEPENDENCE FROM MEXICO — Republic established.', body: 'The Republic of Texas has declared independence from Mexico. Californio families along the border are watching what happens to land titles when a flag changes.' },
  { id: 'wd_1846_mexico',   fireYear: 1846, dateline: "Niles' National Register · Baltimore", headline: 'UNITED STATES DECLARES WAR ON MEXICO — Polk cites disputed border.', body: 'Congress has declared war on Mexico. California and the northern territories are contested land. What that means for valley claims is being decided by force of arms.' },
  { id: 'wd_1848_gold',     fireYear: 1848, dateline: 'Alta California · San Francisco', headline: "GOLD DISCOVERED AT SUTTER'S MILL — Rush expected. Everything will change.", body: "Gold has been found on the American River. The paper prints this without fully knowing what it means. The valley will know within the season." },
];

// ─── RUIN CHECK ───────────────────────────────────────────────────────────────
// Unified effectiveMP-based comparison. Scales to any number of Stars.
// allies  = Stars where effectiveMP > +15 (Cautious Friend or better)
// enemies = Stars where effectiveMP < -15 (Clear Competitor or worse)
// neutral = excluded from both sides
//
// RUIN fires when: enemies exist AND mean(|enemy emp|) > mean(ally emp)
// The dominant enemy (highest |emp|) provides the authored narrative.

function checkRuin(state) {
  if (state.ruined) return state;
  const starList = Object.values(state.stars);

  const ruinNarratives = {
    esperanza: {
      headline: 'THE VALLEY CLOSES ITS DOORS',
      reason: 'Esperanza Vallejo has named you before the full coalition. The Californio families have withdrawn credit, closed their roads, and filed a formal complaint with the territorial court. You are an enemy of the valley. There is no path forward from here.',
    },
    solomon: {
      headline: 'WORD HAS GONE THROUGH THE NETWORK',
      reason: 'Solomon Reed has passed word through the freedmen network along every route from here to St. Louis. No one who passes through the valley will do business with you. Every door that mattered is closed. This territory is finished for you.',
    },
    whitmore: {
      headline: 'PACIFIC RAILROAD MOVES AGAINST YOUR HOLDINGS',
      reason: "J.T. Whitmore has assigned the railroad's full legal team to your property claims. Every filing is contested within the week. The legal costs are unrelenting and you cannot sustain them. The homestead passes to other hands.",
    },
  };

  const { allyCohesion, enemyCohesion, enemies } = ruinStrengths(state.stars);

  if (enemies.length === 0 || enemyCohesion <= allyCohesion) return state;

  // Ruin fires — dominant enemy provides the narrative
  const dominant = enemies.reduce((a, b) => Math.abs(effectiveMP(a)) >= Math.abs(effectiveMP(b)) ? a : b);
  const narrative = ruinNarratives[dominant.id];
  const ruinHeadline = narrative?.headline ?? `${dominant.name.split(' ')[0].toUpperCase()} — MOVES AGAINST YOU`;
  const ruinReason = narrative?.reason ?? `${dominant.name}'s hostility has reached the point of action. Your alliances are not strong enough to make that action costly. The homestead passes to other hands.`;

  return { ...state, ruined: true, ruinHeadline, ruinReason };
}


// ─── WIN CONDITIONS ───────────────────────────────────────────────────────────
// Three closings, calibrated against real playthrough values.
// A successful ally run produced AC 165.2 / EC 76.1 — EC is ~46% of AC.
// All thresholds read directly from the cohesion bars in the Persons panel.
// Checked in order — first match fires.
//
// win_domination:
//   Enemies exist. AC >= 50 AND EC < AC × 0.5.
//   You are winning 2:1 or better. The playthrough that anchored these values
//   sits just inside this threshold at 165 vs 76.
//
// win_leveraged:
//   No enemies. AC > 45.
//   Built without creating organized opposition, with real cohesion weight.
//
// win_balanced:
//   Enemies exist. AC > EC (leading). EC >= AC × 0.5 (genuinely contested).
//   AC >= 30 (floor — early jitter and thin values don't trigger this).
//   The hardest condition to sustain: winning an active fight without
//   overwhelming it. The opposition is a real counterweight, not a footnote.

const WIN_CONDITIONS = [
  {
    id: 'win_domination',
    condition: (stars, taken) => {
      const { allyCohesion, enemyCohesion, enemies } = ruinStrengths(stars);
      return enemies.length > 0 && allyCohesion >= 50 && enemyCohesion < allyCohesion * 0.5;
    },
    headline: 'THE VALLEY ANSWERS TO YOU',
    subhead: 'Domination',
    prompt: "You have enemies in this valley and they are organized. They don't have enough. Your ally cohesion leads theirs by better than two to one. The bars have not been this far apart by accident. You could name this.",
    acceptLabel: 'Close the Ledger',
    body: "They are still here. The opposition did not dissolve — it was outbuilt. Every decision you made that cost you something with one party bought you something with another, and the arithmetic of those trades has been running in your favor since before anyone noticed the direction it was going.\n\nThe enemy cohesion bar is real. The people behind it made real choices that made them real adversaries. They are simply not enough. What you assembled on the other side of the ledger is heavier, more durable, and more politically relevant than anything they can coordinate.\n\nThis is what a dominant position looks like in a contested territory. Not the end of opposition. The clear, durable preponderance of force that makes opposition academic.",
    declineHeadline: 'THE BARS HOLD — Ally cohesion leads by 2:1. Opposition active but outweighed.',
    declineBody: "The balance of forces in the valley remains as it was. Ally cohesion leads enemy cohesion by a decisive margin. No formal conclusion was drawn. Both sides are watching the bars. The ledger stays open.",
  },
  {
    id: 'win_leveraged',
    condition: (stars, taken) => {
      const { allyCohesion, enemies } = ruinStrengths(stars);
      return enemies.length === 0 && allyCohesion > 45;
    },
    headline: 'THE VALLEY HOLDS WITHOUT A CONTEST',
    subhead: 'Leveraged Position',
    prompt: "No enemies. Real ally cohesion. No one in this valley has organized against you — and your allies have the weight to ensure it stays that way. You could close the ledger on this.",
    acceptLabel: 'Close the Ledger',
    body: "You built something in this valley without making enemies of the people you didn't build it with. That requires a different kind of discipline — knowing which asks to make, which costs to absorb, which relationships to leave cold rather than burn.\n\nThe ally cohesion bar tells the story. Not a single relationship, not a quiet acquaintance — organized support with actual political weight. The kind that shows on the bars and holds when tested.\n\nNo one is moving against you. That is not luck. You made specific decisions that left the valley's most dangerous parties without a reason to organize. The ledger closes on a position that required both halves of that sentence to be true simultaneously.",
    declineHeadline: 'THE POSITION HOLDS — No opposition. Ally cohesion maintained.',
    declineBody: "The current configuration persists. No organized opposition. Ally cohesion above the threshold. The ledger stays open. What this looks like in five years is a different question.",
  },
  {
    id: 'win_balanced',
    condition: (stars, taken) => {
      const { allyCohesion, enemyCohesion, enemies } = ruinStrengths(stars);
      // AC > 30, enemies exist, and ally cohesion is more than 3× enemy cohesion.
      // Enemies are present but too weak to be a genuine counterweight — a clean
      // lead without the overwhelming weight domination requires.
      return enemies.length > 0 && allyCohesion > 30 && enemyCohesion > 0 && allyCohesion / enemyCohesion > 3;
    },
    headline: 'THE CONTEST IS YOURS — FOR NOW',
    subhead: 'Balanced Dominance',
    prompt: "You have enemies and they have weight. Your allies lead — but not by the kind of margin that makes the outcome feel inevitable. You are winning an active fight, and the bars show it. You could call it here.",
    acceptLabel: 'Hold the Position',
    body: "The enemy cohesion bar is not a footnote. The people behind it are organized, and their opposition is real — you can see it in the numbers. What you have built on the other side is heavier, but not so much heavier that the result was ever inevitable.\n\nThat is the record this playthrough will leave. Not domination. Not peace. A hard-fought lead in a valley where the other side was genuinely trying. The decisions that got you here were not easy and they were not free. The balance reflects that.\n\nThe ledger closes on a contested win. The opposition stays. The math is yours.",
    declineHeadline: 'THE CONTEST CONTINUES — Ally cohesion leads. Enemy cohesion within range.',
    declineBody: "The balance of forces in the valley remains close. Ally cohesion leads, but enemy cohesion is within half the ally figure. The ledger stays open. Both sides are watching the bars.",
  },
];

function checkWin(state) {
  if (state.ruined || state.won || state.pendingWin) return state;
  for (const wc of WIN_CONDITIONS) {
    if (state.firedEvents.includes(wc.id)) continue;
    if (!wc.condition(state.stars, state.taken)) continue;
    return { ...state, pendingWin: wc };
  }
  return state;
}
// ─── HELPERS ─────────────────────────────────────────────────────────────────
const SEASONS = SCENARIO.timeUnits;
const SEASON_IDX = { Spring: 0, Summer: 1, Autumn: 2, Winter: 3 };
const dc = x => JSON.parse(JSON.stringify(x));

function seasonsRemaining(year, season, expires, expiresSeason) {
  const expiryTick = expires * 4 + (expiresSeason ? SEASON_IDX[expiresSeason] : 0);
  return Math.max(0, expiryTick - (year * 4 + SEASON_IDX[season]));
}

function applyE(stars, effects, mods = null) {
  const s = dc(stars);
  for (const e of effects) {
    if (!s[e.star]?.passions[e.passion]) continue;
    let delta = e.delta;
    // Apply passion bonus from modifiers — only on positive gains, only from source Star's modifiers
    if (mods && delta > 0 && mods[e.star]) {
      delta = delta + (mods[e.star].passionBonus ?? 0);
    }
    s[e.star].passions[e.passion].value = clamp(s[e.star].passions[e.passion].value + delta);
  }
  return s;
}
// ─── DERIVED FAME / INFAMY ────────────────────────────────────────────────────
// applyFIFromEffects — derives fame/infamy gains from the passion deltas in an
// effects array rather than authored numbers.
//
// For each star touched by the effects:
//   1. Sum all passion deltas for that star
//   2. Divide by that star's total passion count (weighted average)
//   3. Apply cross-compounding modifiers:
//
//      Fame gains:   base × (1 + fame/100) × (1 - infamy/100)
//        — existing fame amplifies further fame gains (snowball)
//        — existing infamy penalises fame gains symmetrically
//        — at infamy 100, fame gains are completely zeroed
//
//      Infamy gains: base × (1 + infamy/100) × (1 - fame/100)
//        — existing infamy amplifies further infamy gains
//        — existing fame dampens infamy gains symmetrically
//        — at fame 100, infamy gains are completely zeroed
//
//   Both are clamped to [0, 100] after application.
//   fameMult / infamyMult from computeModifiers() stack multiplicatively on top.
//
// applyFI remains for convergence/reactive events that use authored fameEffects.

function applyFIFromEffects(stars, effects, tick = null, mods = null) {
  const s = dc(stars);
  const lo = 0, hi = 100;

  const deltasByStar = {};
  for (const e of effects) {
    if (!s[e.star]) continue;
    if (!deltasByStar[e.star]) deltasByStar[e.star] = 0;
    deltasByStar[e.star] += e.delta;
  }

  for (const [starId, sumDeltas] of Object.entries(deltasByStar)) {
    const star = s[starId];
    const passionCount = Object.keys(star.passions).length;
    const weightedAvg = sumDeltas / passionCount;
    if (weightedAvg === 0) continue;

    // Apply fame/infamy multipliers from modifiers
    const fameMult   = mods?.[starId]?.fameMult   ?? 1.0;
    const infamyMult = mods?.[starId]?.infamyMult ?? 1.0;

    if (weightedAvg > 0) {
      // Fame gains compound with existing fame, counter-compounded by infamy
      const modifier = (1 + (star.fame / 100)) * Math.max(0, 1 - (star.infamy / 100));
      star.fame = Math.round(Math.max(lo, Math.min(hi, star.fame + weightedAvg * modifier * fameMult)));
      if (tick) star.fameLastChanged = tick;
    } else {
      // Infamy gains compound with existing infamy, counter-compounded by fame
      const modifier = (1 + (star.infamy / 100)) * Math.max(0, 1 - (star.fame / 100));
      star.infamy = Math.round(Math.max(lo, Math.min(hi, star.infamy + Math.abs(weightedAvg) * modifier * infamyMult)));
      if (tick) star.infamyLastChanged = tick;
    }
  }
  return s;
}

function applyFI(stars, fameEff, infamyEff, tick = null) {
  const s = dc(stars);
  const lo = 0, hi = 100;
  for (const [k, v] of Object.entries(fameEff)) {
    if (!s[k] || v === 0) continue;
    const modifier = (1 + (s[k].fame / 100)) * Math.max(0, 1 - (s[k].infamy / 100));
    s[k].fame = Math.round(Math.max(lo, Math.min(hi, s[k].fame + v * modifier)));
    if (tick) s[k].fameLastChanged = tick;
  }
  for (const [k, v] of Object.entries(infamyEff)) {
    if (!s[k] || v === 0) continue;
    const modifier = (1 + (s[k].infamy / 100)) * Math.max(0, 1 - (s[k].fame / 100));
    s[k].infamy = Math.round(Math.max(lo, Math.min(hi, s[k].infamy + v * modifier)));
    if (tick) s[k].infamyLastChanged = tick;
  }
  return s;
}

// Check reactive and convergence events after any state mutation
function checkEvents(state, prevStars, newLog) {
  let { stars, firedEvents, pendingChoices, unlockedActions, log } = state;
  const newEntries = [...newLog];
  const fired = [...firedEvents];
  const unlocked = [...unlockedActions];

  // Reactive events
  for (const ev of REACTIVE_EVENTS) {
    if (fired.includes(ev.id)) continue;
    const prev = prevStars[ev.star]?.passions[ev.passion]?.value ?? 0;
    const curr = stars[ev.star]?.passions[ev.passion]?.value ?? 0;
    const crossed = ev.direction === 'above' ? (prev < ev.threshold && curr >= ev.threshold)
                                              : (prev > ev.threshold && curr <= ev.threshold);
    if (!crossed) continue;
    // Macropassion gates — a single passion threshold alone isn't sufficient context.
    // requiresMacropassion: minimum — positive unlocks require a warm overall relationship.
    // requiresMacropassionMax: maximum — negative consequences require a cold one.
    if (ev.requiresMacropassion !== undefined) {
      const macro = macropassionValue(stars[ev.star].passions);
      if (macro < ev.requiresMacropassion) continue;
    }
    if (ev.requiresMacropassionMax !== undefined) {
      const macro = macropassionValue(stars[ev.star].passions);
      if (macro > ev.requiresMacropassionMax) continue;
    }
    fired.push(ev.id);
    if (ev.effects.length) stars = applyE(stars, ev.effects);
    stars = applyFI(stars, ev.fameEffects, ev.infamyEffects, `${state.year}-${state.season}`);
    newEntries.push({
      id: `re-${ev.id}`,
      year: state.year, season: state.season,
      headline: ev.headline, body: ev.body,
      decision: null, effects: ev.effects,
      isDeferred: false, isQuiet: false, isReactive: true, isNegative: ev.isNegative,
    });
    for (const aid of ev.unlocksActions) {
      if (!unlocked.includes(aid)) unlocked.push(aid);
    }
  }

  // Convergence events
  const pending = [...pendingChoices];
  for (const ev of CONVERGENCE_EVENTS) {
    if (fired.includes(ev.id)) continue;
    if (pending.find(p => p.id === ev.id)) continue;
    if (!ev.condition(stars, state.taken, state)) continue;
    fired.push(ev.id);
    const resolvedBody = typeof ev.bodyFn === 'function' ? ev.bodyFn(state.taken, state.declined) : ev.body;
    const resolvedChoices = ev.choices.map(c => ({
      ...c,
      label: typeof c.labelFn === 'function' ? c.labelFn(state.taken, state.declined) : c.label,
      desc:  typeof c.descFn  === 'function' ? c.descFn(state.taken, state.declined)  : c.desc,
      effects: c.effects.map(ef => ({
        ...ef,
        why: typeof ef.why === 'function' ? ef.why(state.taken, state.declined) : ef.why,
      })),
    }));
    pending.push({ id: ev.id, headline: ev.headline, body: resolvedBody, choices: resolvedChoices });
  }

  return { ...state, stars, firedEvents: fired, pendingChoices: pending, unlockedActions: unlocked, log: [...newEntries, ...state.log.filter(e => !newEntries.find(n => n.id === e.id))] };
}

const INIT = {
  year: SCENARIO.startYear, season: SCENARIO.startSeason, quietCount: 0,
  stars: INITIAL_STARS,
  taken: [],           // action IDs resolved (accepted, declined, or expired)
  declined: [],        // subset of taken: resolved without the player acting (declined or declined)
  hiddenActions: [],   // mysteryExpiry actions the player declined — removed from Decisions but expiry still fires naturally
  log: [],             // Chronicle entries, newest first
  deferred: [],        // queued future Chronicle entries { fireYear, headline, body, effects, ... }
  firedEvents: [],     // reactive + convergence event IDs already triggered (dedupe guard)
  pendingChoices: [],  // convergence events awaiting player resolution — shown as modal stack
  unlockedActions: [], // action IDs unlocked by reactive events, added to available pool
  seenActions: [],     // action IDs that have appeared in Decisions (used for ● New badge)
  revealedStars: ['esperanza'],  // Esperanza present from tick 0; others added by ADVANCE
  revealedPassions: [],  // "starId:passionKey" strings permanently unlocked (hidden passions)
  pendingReveal: [],     // { key, year } objects queued for the PassionRevealModal
  pendingIntros: ['esperanza'],  // Esperanza intro fires on load; others queued when revealedStars gains new IDs
  pendingCohesionEvents: [], // { type: 'ally'|'enemy', threshold, year, season } queued world-shift events
  firedCohesionEvents: [],   // "ally-20" style keys, prevents re-firing same threshold
  cohesionEverShown: { ally: false, enemy: false }, // latches true once each bar has ever been relevant
  pendingGuest: null,    // current GUEST_POOL entry awaiting player response
  guestHistory: [],      // guest IDs already answered or departed unanswered
  guestCooldown: 0,      // seasons since last guest departed — drives Poisson draw probability
  homesteadLog: [],      // Crossroads ledger entries { year, season, note }
  ruined: false, ruinHeadline: null, ruinReason: null,
  won: false, wonConditionId: null,
  pendingWin: null,   // WIN_CONDITIONS entry awaiting player accept/decline
  obscured: false,    // inactivity ending — world moved on without player
  decisionTick: 0,    // seasons since last player-driven decision; resets on ACT/DECLINE/CHOOSE/deferred fire
};

// ─── COHESION THRESHOLD EVENTS ───────────────────────────────────────────────
// Fires a world-shift modal when ally or enemy cohesion first crosses a
// meaningful threshold. Like character intros, this is presented as a modal
// describing how the world has changed. Thresholds: 10, 25, 50 for each side.
const COHESION_THRESHOLDS = [10, 25, 50];

const COHESION_EVENT_TEXT = {
  ally: {
    10: { headline: 'The Valley Begins to Hold', body: "Something has shifted — quietly, without announcement, but real. The people who have benefited from your choices are beginning to act in coordination. Not a formal alliance; nothing that would hold up in a territorial court. But word travels on roads you helped build, and the people who use those roads have started talking to each other about you. Your standing in the valley has weight now. It can be spent." },
    25: { headline: 'An Alliance Worth Naming', body: "It is no longer possible to pretend this is coincidence. The relationships you have built are functioning as a network — information moves, favors are extended, the valley organizes itself in ways that benefit you. People who have never spoken to each other share a common understanding of where you stand. The valley's judgment has moved in your favor. That judgment has consequences." },
    50: { headline: 'The Valley Speaks as One', body: "What you have built here is not merely a collection of favorable relationships. It is a political fact. The alliance of interests supporting your position in the valley is strong enough that even those who dislike you must calculate its weight before moving against you. You have become load-bearing. The valley would notice your absence in ways it would not have a season ago." },
  },
  enemy: {
    10: { headline: 'Opposition Takes Shape', body: "The resistance to your position in the valley has begun to organize. Not openly — not yet — but the conversations that matter are happening without you in the room. People who have suffered from your choices are starting to compare notes. The shape of what is forming is not yet clear. But the valley's weight has shifted, and you are on the wrong side of it." },
    25: { headline: 'The Opposition Has Found Its Voice', body: "The forces working against you in this valley have reached a threshold of coordination. They are not merely reacting to individual decisions anymore — they are anticipating. The valley's hostile interests have begun to function as something more than a set of separate grievances. They are starting to become a bloc. Your allies are the only thing keeping this from becoming irreversible." },
    50: { headline: 'The Valley Has Turned Against You', body: "The balance of opposition in this valley has become structurally hostile to your position. The network of interests working against you can now act with something approaching unified purpose. Your allies are the only check on what this means in practice. If that check weakens — if their cohesion falls below the enemy's — the valley will move. It is not yet too late. But the window is narrowing." },
  },
};

function checkCohesionThresholds(state, prevStars) {
  const { allyCohesion: prevAlly, enemyCohesion: prevEnemy } = ruinStrengths(prevStars);
  const { allyCohesion: newAlly, enemyCohesion: newEnemy, allies, enemies } = ruinStrengths(state.stars);

  const firedKeys = [...(state.firedCohesionEvents ?? [])];
  const newEvents = [...(state.pendingCohesionEvents ?? [])];

  for (const thresh of COHESION_THRESHOLDS) {
    const allyKey = `ally-${thresh}`;
    if (!firedKeys.includes(allyKey) && prevAlly < thresh && newAlly >= thresh) {
      firedKeys.push(allyKey);
      newEvents.push({ type: 'ally', threshold: thresh, year: state.year, season: state.season });
    }
    const enemyKey = `enemy-${thresh}`;
    if (!firedKeys.includes(enemyKey) && prevEnemy < thresh && newEnemy >= thresh) {
      firedKeys.push(enemyKey);
      newEvents.push({ type: 'enemy', threshold: thresh, year: state.year, season: state.season });
    }
  }

  // Update the persistent latch — once a side has been seen it stays visible
  const prev = state.cohesionEverShown ?? { ally: false, enemy: false };
  const cohesionEverShown = {
    ally:  prev.ally  || allies.length  > 0,
    enemy: prev.enemy || enemies.length > 0,
  };

  return { ...state, firedCohesionEvents: firedKeys, pendingCohesionEvents: newEvents, cohesionEverShown };
}

function reducer(state, action) {
  if (action.type === 'ACT') {
    const act = [...ACTIONS, ...UNLOCKABLE_ACTIONS].find(a => a.id === action.id);
    if (!act || state.taken.includes(act.id)) return state;
    const prevStars = state.stars;

    // Probabilistic outcome — roll at play time if action has successChanceFn.
    // On failure: use failureEffects and failureResult strings; suppress def.
    let effects = act.effects;
    let def = act.def;
    let resultHeadline = act.result;
    let resultBody = act.resultBody;
    if (act.successChanceFn) {
      const success = Math.random() < act.successChanceFn(state.year);
      if (!success) {
        effects = act.failureEffects || [];
        def = null;
        resultHeadline = act.failureResult || act.result;
        resultBody = act.failureResultBody || act.resultBody;
      }
    }

    let stars = applyE(state.stars, effects, computeModifiers(state.stars));
    stars = applyFIFromEffects(stars, effects, `${state.year}-${state.season}`, computeModifiers(state.stars));
    // Reputation-gated bonus effects — fire if player's rep state with the target Star
    // matches the required key at the moment the action is taken (checked pre-application).
    if (act.repBonus) {
      const preRepStars = state.stars; // snapshot before effects
      for (const rb of act.repBonus) {
        if (!preRepStars[rb.star]) continue;
        if (repStateKey(preRepStars[rb.star]) !== rb.repState) continue;
        if (rb.extraEffects?.length) {
          stars = applyE(stars, rb.extraEffects);
          stars = applyFIFromEffects(stars, rb.extraEffects, `${state.year}-${state.season}`);
        }
      }
    }
    const entry = {
      id: `${act.id}-${state.year}-${state.season}`,
      year: state.year, season: state.season,
      headline: resultHeadline, body: resultBody, bodyHidden: act.bodyHidden || null,
      decision: act.dispatch, effects,
      isDeferred: false, isQuiet: false, isReactive: false,
    };
    const deferred = [...state.deferred];
    if (def) deferred.push({ fireYear: state.year + def.years, headline: def.headline, body: def.body, effects: def.effects, originLabel: act.dispatch, originYear: state.year });
    const revealedPassions = checkPassionReveals(stars, state.revealedPassions);
    // Diff before/after to find newly crossed hidden passion thresholds.
    // Each newly revealed key is stamped with the current year so PassionRevealModal
    // can render accurate duration text, then queued for sequential display.
    const newlyRevealed = revealedPassions.filter(k => !state.revealedPassions.includes(k));
    const pendingReveal = [...state.pendingReveal, ...newlyRevealed.map(k => ({ key: k, year: state.year }))];
    const next = { ...state, stars, taken: [...state.taken, act.id], deferred, revealedPassions, pendingReveal, decisionTick: 0 };
    return checkCohesionThresholds(checkWin(checkRuin(checkEvents({ ...next, log: [entry, ...state.log] }, prevStars, []))), prevStars);
  }
  if (action.type === 'CHOOSE') {
    const conv = CONVERGENCE_EVENTS.find(e => e.id === action.eventId);
    const choice = conv?.choices.find(c => c.id === action.choiceId);
    if (!conv || !choice) return state;
    const prevStars = state.stars;
    // Resolve labelFn/descFn — some choices (e.g. answer_solomon) use functions
    // rather than static strings so the text varies based on prior actions taken.
    const choiceLabel = typeof choice.labelFn === 'function' ? choice.labelFn(state.taken, state.declined) : choice.label;
    const choiceDesc  = typeof choice.descFn  === 'function' ? choice.descFn(state.taken, state.declined)  : choice.desc;
    let stars = applyE(state.stars, choice.effects, computeModifiers(state.stars));
    stars = applyFIFromEffects(stars, choice.effects, `${state.year}-${state.season}`, computeModifiers(state.stars));
    const entry = {
      id: `conv-${action.eventId}-${action.choiceId}`,
      year: state.year, season: state.season,
      headline: `${conv.headline} — ${choiceLabel}`,
      body: choiceDesc, decision: choiceLabel,
      effects: choice.effects, isDeferred: false, isQuiet: false, isReactive: true, isNegative: false,
    };
    const pending = state.pendingChoices.filter(p => p.id !== action.eventId);
    const revealedPassions = checkPassionReveals(stars, state.revealedPassions);
    const newlyRevealed = revealedPassions.filter(k => !state.revealedPassions.includes(k));
    const pendingReveal = [...state.pendingReveal, ...newlyRevealed.map(k => ({ key: k, year: state.year }))];
    const next = { ...state, stars, pendingChoices: pending, revealedPassions, pendingReveal, decisionTick: 0 };
    return checkCohesionThresholds(checkWin(checkRuin(checkEvents({ ...next, log: [entry, ...state.log] }, prevStars, []))), prevStars);
  }
  if (action.type === 'ADVANCE') {
    const sIdx = SEASONS.indexOf(state.season);
    const isWinter = sIdx === SEASONS.length - 1;
    const nextSeason = SEASONS[(sIdx + 1) % SEASONS.length];
    const nextYear = isWinter ? state.year + 1 : state.year;
    const prevStars = state.stars;
    let stars = dc(state.stars);
    const newEntries = [], remaining = [];

    // Un-answered guest departs — recorded in homestead ledger only
    let pendingGuest = state.pendingGuest;
    let guestHistory = [...state.guestHistory];
    let homesteadLog = [...state.homesteadLog];
    if (pendingGuest) {
      const firstName = pendingGuest.name.split('—')[0].trim();
      homesteadLog = [{ year: state.year, season: state.season, note: `${firstName} came to the door. No answer was given. They moved on.` }, ...homesteadLog];
      guestHistory = [...guestHistory, pendingGuest.id];
      pendingGuest = null;
    }

    // Inaction consequences — fire when an expiring action passes untaken.
    // Season-level: fires when we cross into expiresSeason within the expiry year.
    // Year-level:   fires on the Winter->Spring boundary entering the expiry year.
    // Pushes to both taken and declined so gate checks (requiresTaken) work correctly
    // and the action can never resurface, while downstream checks can distinguish
    // "accepted" from "resolved without acting."
    let newTaken = [...state.taken];
    let newDeclined = [...state.declined];
    {
      const allKnownActions = [...ACTIONS, ...UNLOCKABLE_ACTIONS];
      for (const act of allKnownActions) {
        if (state.taken.includes(act.id) || !act.inaction) continue;
        const seasonExpired = act.expiresSeason &&
          nextYear === act.expires &&
          nextSeason === act.expiresSeason;
        const yearExpired = !act.expiresSeason && isWinter && act.expires === nextYear;
        if (seasonExpired || yearExpired) {
          stars = applyE(stars, act.inaction.effects);
          newTaken = [...newTaken, act.id];
          newDeclined = [...newDeclined, act.id];
          newEntries.push({
            id: `inaction-${act.id}-${nextYear}-${nextSeason}`,
            year: nextYear, season: nextSeason,
            headline: act.inaction.headline,
            body: act.inaction.body,
            decision: `Inaction: "${act.dispatch}" -- the window closed.`,
            effects: act.inaction.effects,
            isDeferred: false, isQuiet: false, isReactive: false, isDispatch: false, isInaction: true,
          });
        }
      }
    }

    // Deferred consequences — actions and echo dispatches.
    // Fire on the Winter→Spring boundary; stamped as nextSeason (Spring) not 'Winter'
    // so they group under the correct Chronicle season header.
    // A deferred fire resets decisionTick — it is downstream of a player decision.
    let deferredFired = false;
    for (const d of state.deferred) {
      if (isWinter && d.fireYear <= nextYear) {
        if (!d.isDispatch) stars = applyE(stars, d.effects);
        deferredFired = true;
        newEntries.push(d.isDispatch
          ? { id: `dispatch-${d.originYear}-${d.fireYear}-${Math.random().toString(36).slice(2,6)}`, year: nextYear, season: nextSeason, headline: d.headline, body: d.body, decision: null, effects: [], isDeferred: false, isQuiet: false, isReactive: false, isDispatch: true, dateline: d.dateline }
          : { id: `def-${d.originYear}-${d.fireYear}-${Math.random().toString(36).slice(2,6)}`, year: nextYear, season: nextSeason, headline: d.headline, body: d.body, decision: `Consequence of: "${d.originLabel}" (${d.originYear})`, effects: d.effects, isDeferred: true, isQuiet: false, isReactive: false }
        );
      } else remaining.push(d);
    }

    const newDecisionTick = deferredFired ? 0 : state.decisionTick + 1;

    // ── Passion decay ────────────────────────────────────────────────────────────
    // Macropassion-gated, bidirectional. Rates from the design table:
    //
    //  Band           posRate  posFloor  negRate  negFloor
    //  ≥  50          0        null      2.0      -15      deep ally: positives locked, negatives heal fast
    //  ≥  30          0.25     null      1.5      -30      ally: positives barely erode, negatives heal
    //  ≥  15          0.5      null      1.25     -50      cautious: moderate both ways
    //  -15 to +15     0.75     null      0.75     null     neutral: symmetric drift toward zero
    //  ≤ -15          1.0      null      0.5      null     competitor: positives erode, negatives locked
    //  ≤ -30          1.25     null      0.25     null     opponent: positives erode faster, negatives very locked
    //  ≤ -50          2.0      null      0        null     deep enemy: positives deleted fast, negatives permanent
    //
    // negFloor: null on enemy bands means negative passions do NOT auto-repair —
    //   the relationship stays hostile without player action. negFloor on ally bands
    //   means minor negatives heal up to that floor automatically.
    //

    const currentTick = `${state.year}-${state.season}`;
    for (const starId of Object.keys(stars)) {
      const st = stars[starId];
      const macro = macropassionValue(st.passions);

      let posRate  = 0;
      let negRate  = 0;
      let negFloor = null;

      if (macro >= 50) {
        posRate = 0;    negRate = 2.0;  negFloor = -15;
      } else if (macro >= 30) {
        posRate = 0.25; negRate = 1.5;  negFloor = -30;
      } else if (macro >= 15) {
        posRate = 0.5;  negRate = 1.25; negFloor = -50;
      } else if (macro > -15) {
        posRate = 0.75; negRate = 0.75; negFloor = null;
      } else if (macro > -30) {
        posRate = 1.0;  negRate = 0.5;  negFloor = null;
      } else if (macro > -50) {
        posRate = 1.25; negRate = 0.25; negFloor = null;
      } else {
        posRate = 2.0;  negRate = 0;    negFloor = null;
      }

      // Passion values.
      // negFloor semantics: on ally bands it is a repair ceiling (negatives heal up to this floor).
      //   null on ALLY bands (neutral) means repair all the way to 0 — full drift toward zero.
      //   null on ENEMY bands means NO repair at all — hostility is locked without player action.
      // The band table encodes this correctly: ally/neutral bands have negRate > 0 only when
      // negFloor is set OR the band is neutral (repair to 0). Enemy bands have negFloor = null
      // AND we must NOT repair. So the repair rule is: only repair if negFloor is explicitly set
      // (ally bands), OR if we are in the neutral band (macro > -15) where both drift to zero.
      const isNeutralBand = macro > -15 && macro < 15;
      for (const passion of Object.values(st.passions)) {
        const v = passion.value;
        // Positive erosion — always toward 0
        if (v > 0 && posRate > 0) passion.value = Math.max(0, v - posRate);
        // Negative repair — only on ally bands (negFloor set) or neutral band (drift to 0)
        if (v < 0 && negRate > 0) {
          if (negFloor !== null && v > negFloor) {
            // Ally band: repair up to the floor ceiling
            passion.value = Math.min(0, v + negRate);
          } else if (isNeutralBand) {
            // Neutral: drift all the way back to 0
            passion.value = Math.min(0, v + negRate);
          }
          // Enemy bands (negFloor === null, !isNeutralBand): no repair
        }
      }

      // Fame mirrors positive passions: decays at posRate.
      //   Deep ally (posRate = 0): fame locked in place.
      //   Deep enemy (posRate = 2.0): residual fame erodes fast, removing any dampening of enemy cohesion.
      //
      // Infamy mirrors negative passions: only decays when the band allows negative healing.
      //   Enemy bands (negRate = 0, or hostile bands with negFloor = null): infamy locked — as permanent as the hostility.
      //   Ally/neutral bands (negRate > 0): infamy heals at negRate alongside the negative passions.
      //
      // Grace period: no decay the season the value was last set.
      const fameDecayRate = posRate;
      const infamyCanDecay = negRate > 0 && (negFloor !== null || isNeutralBand);
      const infamyDecayRate = infamyCanDecay ? negRate : 0;
      if (st.fame > 0 && fameDecayRate > 0 && st.fameLastChanged !== currentTick) {
        st.fame = Math.max(0, Math.round(st.fame - fameDecayRate));
      }
      if (st.infamy > 0 && infamyDecayRate > 0 && st.infamyLastChanged !== currentTick) {
        st.infamy = Math.max(0, Math.round(st.infamy - infamyDecayRate));
      }
    }

    // World dispatches — arrive in the Spring of their target year
    const updatedFiredEvents = [...state.firedEvents];
    if (nextSeason === 'Spring') {
      for (const wd of WORLD_DISPATCHES) {
        if (wd.fireYear === nextYear && !updatedFiredEvents.includes(wd.id)) {
          updatedFiredEvents.push(wd.id);
          newEntries.push({ id: `wd-${wd.id}`, year: nextYear, season: 'Spring', headline: wd.headline, body: wd.body, decision: null, effects: [], isDeferred: false, isQuiet: false, isReactive: false, isDispatch: true, dateline: wd.dateline });
        }
      }
    }

    // Quiet season — filtered by optional requires(state) predicate.
    // State snapshot used for gating includes taken, revealedStars, year, and live stars.
    const hadAction = state.log.length > 0 && state.log[0].year === state.year && state.log[0].season === state.season && !state.log[0].isQuiet;
    let quietEntry = null;
    if (!hadAction) {
      const gateState = { taken: state.taken, revealedStars: state.revealedStars, year: state.year, season: state.season, stars };
      const rawPool = QUIET_SEASONS_BY_SEASON[state.season] || [];
      const seasonPool = rawPool.filter(e => !e.requires || e.requires(gateState));
      const usedSeasonIds = new Set(state.log.filter(e => e.isQuiet && e.season === state.season).map(e => e.id));
      // Find first eligible entry not yet used this season
      const unusedEntry = seasonPool.find(e => {
        // Build a deterministic id for this entry to check against used
        const entryId = `quiet-${state.season}-${e.h.slice(0, 20).replace(/\s+/g,'-')}`;
        return !usedSeasonIds.has(entryId);
      });
      const genericPool = QUIET_SEASONS_GENERIC.filter(e => !e.requires || e.requires(gateState));
      const qs = unusedEntry ?? genericPool[state.quietCount % genericPool.length];
      const quietId = unusedEntry
        ? `quiet-${state.season}-${qs.h.slice(0, 20).replace(/\s+/g,'-')}`
        : `quiet-${state.year}-${state.season}-${state.quietCount}`;
      quietEntry = { id: quietId, year: state.year, season: state.season, headline: qs.h, body: qs.b, decision: null, effects: [], isDeferred: false, isQuiet: true, isReactive: false };
    }

    // Poisson-style guest draw — probability increases each season without a guest,
    // targeting roughly one visitor every 3–5 years (12–20 seasons).
    // Base probability starts low and rises until a guest fires, then resets.
    // Only draws if no guest is currently pending and the pool has unseen candidates.
    const newGuestCooldown = state.pendingGuest ? state.guestCooldown : state.guestCooldown + 1;
    if (!state.pendingGuest) {
      const availableGuests = GUEST_POOL.filter(g => {
        if (state.guestHistory.includes(g.id)) return false;
        if (g.requiresMacropassion) {
          const macro = macropassionValue(stars[g.requiresMacropassion.star]?.passions ?? {});
          if (macro < g.requiresMacropassion.min) return false;
        }
        return true;
      });
      if (availableGuests.length > 0) {
        // +1% per season, starting 2 seasons after the last guest departed.
        // 0% chance the next season, 0% the season after, then climbs to ~100% at season 100.
        const seasonsEligible = Math.max(0, newGuestCooldown - 2);
        const drawProb = Math.min(1.0, seasonsEligible * 0.01);
        if (Math.random() < drawProb) {
          // Weighted random selection
          const totalWeight = availableGuests.reduce((sum, g) => sum + (g.weight ?? 10), 0);
          let roll = Math.random() * totalWeight;
          for (const g of availableGuests) {
            roll -= (g.weight ?? 10);
            if (roll <= 0) { pendingGuest = g; break; }
          }
        }
      }
    } else {
      pendingGuest = state.pendingGuest;
    }

    const cTick = state.year * 4 + SEASON_IDX[state.season];
    const nextTickVal = nextYear * 4 + SEASON_IDX[nextSeason];

    // ── Star reveal — checks each star against ya tick or spawnCondition.
    // Stars enter revealedStars when their ya/yaSeasonIdx tick is reached,
    // OR when their spawnCondition(state) returns true.
    // New reveals queue an intro modal. This is the authoritative source for
    // Persons column visibility — not derived from actions.
    const newlyRevealedStars = Object.values(stars).filter(star => {
      if (state.revealedStars.includes(star.id)) return false;
      const starTick = (star.ya != null ? star.ya : Infinity) * 4 + (star.yaSeasonIdx ?? 0);
      const timeRevealed = starTick <= nextTickVal;
      const conditionRevealed = typeof star.spawnCondition === 'function'
        ? star.spawnCondition({ ...state, stars, year: nextYear, season: nextSeason })
        : false;
      return timeRevealed || conditionRevealed;
    }).map(s => s.id);
    const revealedStars = [...state.revealedStars, ...newlyRevealedStars];
    const pendingIntros = [...state.pendingIntros, ...newlyRevealedStars.filter(
      id => !state.pendingIntros.includes(id)
    )];
    const allAvailable = [...ACTIONS, ...UNLOCKABLE_ACTIONS.filter(a => state.unlockedActions.includes(a.id))]
      .filter(a => !state.taken.includes(a.id) && !state.hiddenActions.includes(a.id)
        && (a.ya ?? 0) * 4 + (a.yaSeasonIdx ?? 0) <= cTick
        && (!a.expires || a.expires * 4 + (a.expiresSeason ? SEASON_IDX[a.expiresSeason] : 0) > cTick)
        && (!a.requiresPassionVisible || isPassionVisible(stars, a.requiresPassionVisible.star, a.requiresPassionVisible.passion, state.revealedPassions))
        && (!a.requiresTaken || (state.taken.includes(a.requiresTaken) && !state.declined.includes(a.requiresTaken)))
        && (!a.requiresPassionBelow || (stars[a.requiresPassionBelow.star]?.passions[a.requiresPassionBelow.passion]?.value ?? 0) <= a.requiresPassionBelow.threshold)
        && (!a.requiresPassionAbove || (stars[a.requiresPassionAbove.star]?.passions[a.requiresPassionAbove.passion]?.value ?? 0) >= a.requiresPassionAbove.threshold)
        // Sworn Enemy blackout — a Star who has decided against you stops making requests.
        // Reparation-type actions are exempt: you can always attempt repair, even with a Sworn Enemy.
        && (!a.source || a.msgType === 'Reparation' || macropassionValue(stars[a.source]?.passions ?? {}) > -75))
      .map(a => a.id);
    const seenActions = [...new Set([...state.seenActions, ...allAvailable])];

    const revealedPassions = checkPassionReveals(stars, state.revealedPassions);
    const newlyRevealed = revealedPassions.filter(k => !state.revealedPassions.includes(k));
    const pendingReveal = [...state.pendingReveal, ...newlyRevealed.map(k => ({ key: k, year: state.year }))];

    // pendingIntros is now driven by revealedStars (computed above) — no action-derived queuing needed.

    const next = { ...state, year: nextYear, season: nextSeason, stars, taken: newTaken, declined: newDeclined, deferred: remaining, quietCount: state.quietCount + (quietEntry ? 1 : 0), seenActions, pendingGuest, guestHistory, homesteadLog, firedEvents: updatedFiredEvents, revealedPassions, pendingReveal, hiddenActions: state.hiddenActions, decisionTick: newDecisionTick, pendingIntros, revealedStars, guestCooldown: pendingGuest && !state.pendingGuest ? 0 : newGuestCooldown };
    const afterEvents = checkWin(checkRuin(checkEvents({ ...next, log: [...newEntries, ...(quietEntry ? [quietEntry] : []), ...state.log] }, prevStars, [])));
    // Obscurity / ruin-by-neglect check:
    //   Timer fires at 20 seasons of inactivity (doubled from 10).
    // Obscurity check — fires after 20 seasons of inactivity.
    // Suppressed if allies are strong enough (allyCohesion > 50 — embedded).
    // Becomes ruin instead if enemies already outweigh allies.
    if (!afterEvents.ruined && !afterEvents.won && !afterEvents.obscured && newDecisionTick >= 20) {
      if (isRuined(afterEvents.stars)) {
        return checkRuin({ ...afterEvents, ruined: false });
      }
      if (!isObscuritySuppressed(afterEvents.stars)) {
        return { ...afterEvents, obscured: true };
      }
    }
    return checkCohesionThresholds(afterEvents, prevStars);
  }
  if (action.type === 'GUEST_CHOOSE') {
    const guest = GUEST_POOL.find(g => g.id === action.guestId);
    const choice = guest?.choices.find(c => c.id === action.choiceId);
    if (!guest || !choice) return state;
    const prevStars = state.stars;
    let stars = applyE(state.stars, choice.effects, computeModifiers(state.stars));
    stars = applyFIFromEffects(stars, choice.effects, `${state.year}-${state.season}`, computeModifiers(state.stars));
    const entry = {
      id: `guest-${action.guestId}-${action.choiceId}-${state.year}`,
      year: state.year, season: state.season,
      headline: choice.logHeadline, body: choice.logBody,
      decision: `${guest.name} — ${choice.label}`,
      effects: choice.effects, isDeferred: false, isQuiet: false, isReactive: false,
    };
    const homesteadLog = [{ year: state.year, season: state.season, note: choice.homesteadNote }, ...state.homesteadLog];
    const deferred = [...state.deferred];
    if (choice.echoDef) {
      deferred.push({ fireYear: state.year + choice.echoDef.years, headline: choice.echoDef.headline, body: choice.echoDef.body, effects: [], originLabel: `${guest.name}: ${choice.label}`, originYear: state.year, isDispatch: true, dateline: choice.echoDef.dateline });
    }
    const revealedPassions = checkPassionReveals(stars, state.revealedPassions);
    const newlyRevealed = revealedPassions.filter(k => !state.revealedPassions.includes(k));
    const pendingReveal = [...state.pendingReveal, ...newlyRevealed.map(k => ({ key: k, year: state.year }))];
    const next = { ...state, stars, pendingGuest: null, guestHistory: [...state.guestHistory, action.guestId], homesteadLog, deferred, revealedPassions, pendingReveal, guestCooldown: 0 };
    return checkCohesionThresholds(checkWin(checkRuin(checkEvents({ ...next, log: [entry, ...state.log] }, prevStars, []))), prevStars);
  }
  if (action.type === 'DISMISS_REVEAL') {
    return { ...state, pendingReveal: state.pendingReveal.slice(1) };
  }
  if (action.type === 'DISMISS_COHESION_EVENT') {
    return { ...state, pendingCohesionEvents: state.pendingCohesionEvents.slice(1) };
  }
  if (action.type === 'DISMISS_INTRO') {
    return { ...state, pendingIntros: state.pendingIntros.slice(1) };
  }
  // DECLINE — player explicitly refuses an action, firing inaction effects immediately.
  // Marks action as taken so it doesn't recur; if no inaction block, silently removes.
  // Exception: mysteryExpiry actions go to hiddenActions instead — the card disappears
  // from Decisions but the natural expiry still fires at the correct season.
  if (action.type === 'DECLINE') {
    const act = [...ACTIONS, ...UNLOCKABLE_ACTIONS].find(a => a.id === action.id);
    if (!act || state.taken.includes(act.id) || state.hiddenActions.includes(act.id)) return state;
    if (act.mysteryExpiry) {
      return { ...state, hiddenActions: [...state.hiddenActions, act.id] };
    }
    const prevStars = state.stars;
    let stars = dc(state.stars);
    const newEntries = [];
    if (act.inaction) {
      stars = applyE(stars, act.inaction.effects);
      newEntries.push({
        id: `declined-${act.id}-${state.year}-${state.season}`,
        year: state.year, season: state.season,
        headline: act.inaction.headline,
        body: act.inaction.body,
        decision: `Declined: "${act.dispatch}"`,
        effects: act.inaction.effects,
        isDeferred: false, isQuiet: false, isReactive: false, isInaction: true, isDeclined: true,
      });
    }
    const next = { ...state, stars, taken: [...state.taken, act.id], declined: [...state.declined, act.id], decisionTick: 0 };
    return checkWin(checkRuin(checkEvents({ ...next, log: [...newEntries, ...state.log] }, prevStars, [])));
  }
  if (action.type === 'RESET') return INIT;
  if (action.type === 'WIN_ACCEPT') {
    const wc = state.pendingWin;
    if (!wc) return state;
    return {
      ...state,
      won: true, wonConditionId: wc.id,
      pendingWin: null,
      firedEvents: [...state.firedEvents, wc.id],
    };
  }
  if (action.type === 'WIN_DECLINE') {
    const wc = state.pendingWin;
    if (!wc) return state;
    const entry = {
      id: `win-decline-${wc.id}-${state.year}-${state.season}`,
      year: state.year, season: state.season,
      headline: wc.declineHeadline,
      body: wc.declineBody,
      decision: null, effects: [], isDeferred: false, isQuiet: false, isReactive: true,
    };
    return {
      ...state,
      pendingWin: null,
      firedEvents: [...state.firedEvents, wc.id],
      log: [entry, ...state.log],
    };
  }
  return state;
}

// ─── DELTA SYMBOL ─────────────────────────────────────────────────────────────
function deltaSymbol(delta) {
  const abs = Math.abs(delta);
  const ch  = delta > 0 ? '+' : '−';
  if (abs >= 30) return ch + ch + ch + ch;
  if (abs >= 20) return ch + ch + ch;
  if (abs >= 10) return ch + ch;
  return ch;
}

function behaviorKey(v) {
  return v >= 75 ? 75 : v >= 50 ? 50 : v >= 30 ? 30 : v >= 15 ? 15 : v > -15 ? 0 : v > -30 ? '-15' : v > -50 ? '-30' : v > -75 ? '-50' : '-75';
}

// Returns { label, behavior } if the delta crosses into a new threshold band, else null.
function thresholdCrossing(currentVal, delta, passion) {
  const next    = Math.max(-100, Math.min(100, currentVal + delta));
  const currKey = behaviorKey(currentVal);
  const nextKey = behaviorKey(next);
  if (currKey === nextKey) return null;
  return {
    label:    getThreshold(next).label,
    color:    thresholdColor(next),
    behavior: passion?.behaviors[nextKey] ?? null,
  };
}

// ─── PASSION BAR (centered spectrum) ─────────────────────────────────────────
// ─── COHESION BARS ────────────────────────────────────────────────────────────
// Shows ally vs enemy cohesion in the Persons panel.
// Only ally bar renders when at least one ally exists; same for enemy bar.
// Cohesion tooltip rendered via position:absolute inside each label row's
// position:relative container — no coordinate math, scroll-proof by construction.
function CohesionBars({ stars, everShown = { ally: false, enemy: false } }) {
  const T = useContext(ThemeCtx);
  const [hov, setHov] = useState(null);

  const starList = Object.values(stars);
  const allies  = starList.filter(s => macropassionValue(s.passions) > 15);
  const enemies = starList.filter(s => macropassionValue(s.passions) < -15);
  const allyCoh  = allies.length  ? allies.reduce((sum,s)  => sum + effectiveMP(s), 0) / allies.length  : 0;
  const enemyCoh = enemies.length ? enemies.reduce((sum,s) => sum + Math.abs(effectiveMP(s)), 0) / enemies.length : 0;

  const showAlly  = everShown.ally  || allies.length  > 0;
  const showEnemy = everShown.enemy || enemies.length > 0;

  if (!showAlly && !showEnemy) return null;

  const maxCoh = Math.max(Math.abs(allyCoh), Math.abs(enemyCoh), 20);
  const hasEnemies  = enemies.length > 0;
  const ruinWarning = hasEnemies && enemyCoh > allyCoh;

  const allyTip  = `Ally Cohesion measures the combined effective standing of those who stand with you — ${allies.length} ${allies.length === 1 ? 'ally' : 'allies'} currently. When this exceeds enemy cohesion, your standing in the valley is protected.`;
  const enemyTip = `Enemy Cohesion measures the combined force of those working against you — ${enemies.length} ${enemies.length === 1 ? 'enemy' : 'enemies'} currently.${ruinWarning ? ' This exceeds your ally cohesion. Ruin is possible.' : ' Your allies currently hold the balance.'}`;

  const tipStyle = (accentCol, borderCol) => ({
    position: 'absolute', top: '100%', left: 0, marginTop: 5, zIndex: 50,
    width: 220, background: T.hdr,
    border: `1px solid ${borderCol}`,
    borderRadius: T.radius, padding: '10px 12px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.45)', pointerEvents: 'none',
  });

  return (
    <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${T.bdr}` }}>
      {/* Ally bar */}
      {showAlly && (
        <div style={{ marginBottom: showEnemy ? 6 : 0 }}>
          <div
            style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', marginBottom: 2, cursor: 'default' }}
            onMouseEnter={() => setHov('ally')}
            onMouseLeave={() => setHov(null)}>
            <span style={{ fontSize: T.fsXxs, color: '#4a8e42', textTransform: 'uppercase', letterSpacing: T.lsWide, fontFamily: "'Courier Prime', monospace", borderBottom: hov === 'ally' ? '1px solid #4a8e42' : '1px solid transparent', transition: 'border-color 0.15s' }}>Ally Cohesion</span>
            <span style={{ fontSize: T.fsXxs, color: '#4a8e42', fontFamily: "'Courier Prime', monospace" }}>{allyCoh.toFixed(1)}</span>
            {hov === 'ally' && (
              <div style={tipStyle('#4a8e42', '#4a8e4266')}>
                <div style={{ fontSize: T.fsXxs, color: '#4a8e42', textTransform: 'uppercase', letterSpacing: T.lsWide, fontFamily: "'Courier Prime', monospace", marginBottom: 5 }}>Ally Cohesion</div>
                <div style={{ fontSize: T.fsSm, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhRelaxed }}>{allyTip}</div>
              </div>
            )}
          </div>
          <div style={{ position: 'relative', height: 4, background: T.surf, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, width: `${Math.min(100, (allyCoh / maxCoh) * 100)}%`, top: 0, bottom: 0, background: '#4a8e42', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      )}

      {/* Balance divider */}
      {showAlly && showEnemy && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1, height: '0.5px', background: ruinWarning ? '#9e1a1033' : '#4a8e4233' }} />
          <span style={{ fontSize: T.fsXxs, color: ruinWarning ? '#9e1a10' : T.inkFaint, fontFamily: "'Courier Prime', monospace", letterSpacing: T.lsSm }}>
            {ruinWarning ? '⚠ enemy leads' : allyCoh > enemyCoh ? 'ally leads' : allyCoh === enemyCoh ? 'balanced' : '⚠ enemy leads'}
          </span>
          <div style={{ flex: 1, height: '0.5px', background: ruinWarning ? '#9e1a1033' : '#4a8e4233' }} />
        </div>
      )}

      {/* Enemy bar */}
      {showEnemy && (
        <div>
          <div
            style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', marginBottom: 2, cursor: 'default' }}
            onMouseEnter={() => setHov('enemy')}
            onMouseLeave={() => setHov(null)}>
            <span style={{ fontSize: T.fsXxs, color: ruinWarning ? '#9e1a10' : '#be6030', textTransform: 'uppercase', letterSpacing: T.lsWide, fontFamily: "'Courier Prime', monospace", borderBottom: hov === 'enemy' ? `1px solid ${ruinWarning ? '#9e1a10' : '#be6030'}` : '1px solid transparent', transition: 'border-color 0.15s' }}>
              Enemy Cohesion
            </span>
            <span style={{ fontSize: T.fsXxs, color: ruinWarning ? '#9e1a10' : '#be6030', fontFamily: "'Courier Prime', monospace" }}>{enemyCoh.toFixed(1)}</span>
            {hov === 'enemy' && (
              <div style={tipStyle(ruinWarning ? '#9e1a10' : '#be6030', ruinWarning ? '#9e1a1066' : '#be603066')}>
                <div style={{ fontSize: T.fsXxs, color: ruinWarning ? '#9e1a10' : '#be6030', textTransform: 'uppercase', letterSpacing: T.lsWide, fontFamily: "'Courier Prime', monospace", marginBottom: 5 }}>
                  {`Enemy Cohesion${ruinWarning ? ' — ⚠ Warning' : ''}`}
                </div>
                <div style={{ fontSize: T.fsSm, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhRelaxed }}>{enemyTip}</div>
                {ruinWarning && (
                  <div style={{ marginTop: 7, paddingTop: 6, borderTop: `1px solid ${T.bdrSub}`, fontSize: T.fsXxs, color: '#9e1a10', fontFamily: "'Courier Prime', monospace", letterSpacing: T.lsSm }}>
                    Ruin is possible this season.
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ position: 'relative', height: 4, background: T.surf, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, width: `${Math.min(100, (enemyCoh / maxCoh) * 100)}%`, top: 0, bottom: 0, background: ruinWarning ? '#9e1a10' : '#be6030', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      )}
    </div>
  );
}

function PassionBar({ passionKey, p, color }) {
  const T = useContext(ThemeCtx);
  const [labelHov, setLabelHov] = useState(false);
  const [stateHov, setStateHov] = useState(false);
  const v = p.value;
  const t = getThreshold(v);
  const tCol = thresholdColor(v);

  const fillLeft  = v < 0 ? `${50 + v * 0.5}%` : '50%';
  const fillWidth = `${Math.abs(v) * 0.5}%`;
  const fillColor = v >= 0 ? '#3a7e32' : '#8a2818';

  const tickColor   = T.bdrHi;
  const centerColor = T.bdrHi;
  const tickPcts = [12.5, 25, 35, 42.5, 57.5, 65, 75, 87.5];
  const tickGrads = tickPcts.map(pct =>
    `linear-gradient(90deg, transparent calc(${pct}% - 0.5px), ${tickColor} calc(${pct}% - 0.5px), ${tickColor} calc(${pct}% + 0.5px), transparent calc(${pct}% + 0.5px))`
  );
  const centerGrad = `linear-gradient(90deg, transparent calc(50% - 0.5px), ${centerColor} calc(50% - 0.5px), ${centerColor} calc(50% + 0.5px), transparent calc(50% + 0.5px))`;
  const barBg = [...tickGrads, centerGrad, T.surf].join(', ');

  const bKey    = behaviorKey(v);
  const behavior = p.behaviors[bKey];

  // Threshold state tooltip — semantic meaning + mechanical effect
  const stateTooltip = behavior
    ? `${t.label} — ${behavior}`
    : `${t.label} — No significant position formed yet.`;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'baseline' }}>
        <div style={{ position: 'relative', maxWidth: '55%' }} onMouseEnter={() => setLabelHov(true)} onMouseLeave={() => setLabelHov(false)}>
          <span style={{ fontSize: T.fsMd, color: T.inkMid, fontFamily: "'Courier Prime', monospace", cursor: 'default', borderBottom: labelHov ? `1px solid ${T.bdrHi}` : '1px solid transparent', transition: 'border-color 0.15s' }}>{p.label}</span>
          {labelHov && p.desc && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 5, zIndex: 50, width: 170, maxWidth: 'calc(100vw - 20px)', background: T.card, border: `1px solid ${T.bdrHi}`, borderRadius: T.radius, padding: T.padTip, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
              <div style={{ fontSize: T.fsSm, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhNormal }}>{p.desc}</div>
              <div style={{ position: 'absolute', top: -5, left: 10, width: 8, height: 8, background: T.card, border: `1px solid ${T.bdrHi}`, borderBottom: 'none', borderRight: 'none', transform: 'rotate(45deg)' }} />
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }} onMouseEnter={() => setStateHov(true)} onMouseLeave={() => setStateHov(false)}>
          <span style={{ fontSize: T.fsSm, color: tCol, fontFamily: "'Courier Prime', monospace", cursor: 'default', borderBottom: stateHov ? `1px solid ${tCol}` : '1px solid transparent', transition: 'border-color 0.15s' }}>{t.label}</span>
          {stateHov && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 5, zIndex: 50, width: 170, maxWidth: 'calc(100vw - 20px)', background: T.card, border: `1px solid ${T.bdrHi}`, borderRadius: T.radius, padding: T.padTip, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
              <div style={{ fontSize: T.fsXxs, color: tCol, textTransform: 'uppercase', letterSpacing: T.lsWide, fontFamily: "'Courier Prime', monospace", marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: T.fsSm, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhNormal }}>{stateTooltip.split(' — ').slice(1).join(' — ')}</div>
              <div style={{ position: 'absolute', top: -5, right: 10, width: 8, height: 8, background: T.card, border: `1px solid ${T.bdrHi}`, borderBottom: 'none', borderRight: 'none', transform: 'rotate(45deg)' }} />
            </div>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', height: 6, background: barBg, borderRadius: T.radiusSm, overflow: 'visible' }}>
        <div style={{ position: 'absolute', left: fillLeft, width: fillWidth, top: 0, bottom: 0, background: fillColor, transition: 'all 0.6s ease', zIndex: 3 }} />
      </div>
    </div>
  );
}

// ─── HOVER LABEL ─────────────────────────────────────────────────────────────
function HoverLabel({ label, value, valueColor, valueSize = 11, labelSize, tooltip, align = 'left', flipUp = false }) {
  const T = useContext(ThemeCtx);
  const [hov, setHov] = useState(false);
  return (
    <div style={{ position: 'relative', textAlign: align, cursor: 'default' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ fontSize: labelSize ?? T.fsXs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsSm, borderBottom: hov ? `1px solid ${T.bdrHi}` : '1px solid transparent', display: 'inline-block', transition: 'border-color 0.15s' }}>
        {label}
      </div>
      <div style={{ fontSize: valueSize, color: valueColor, fontFamily: valueSize >= 11 ? "'Playfair Display', serif" : "'Courier Prime', monospace", fontStyle: valueSize >= 11 ? 'italic' : 'normal', marginTop: 1 }}>
        {value}
      </div>
      {hov && (
        <div style={{ position: 'absolute', ...(flipUp ? { bottom: '100%', marginBottom: 6 } : { top: '100%', marginTop: 6 }), [align === 'right' ? 'right' : 'left']: 0, width: 160, zIndex: 20, background: T.cardHov, border: `1px solid ${T.bdrHi}`, padding: '7px 9px', borderRadius: T.radius, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: T.fsSm, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhNormal }}>{tooltip}</div>
          <div style={{ position: 'absolute', ...(flipUp ? { bottom: -5, [align === 'right' ? 'right' : 'left']: 10, transform: 'rotate(225deg)' } : { top: -5, [align === 'right' ? 'right' : 'left']: 10, transform: 'rotate(45deg)' }), width: 8, height: 8, background: T.cardHov, border: `1px solid ${T.bdrHi}`, borderBottom: 'none', borderRight: 'none' }} />
        </div>
      )}
    </div>
  );
}

// ─── STAR CARD ────────────────────────────────────────────────────────────────
function StarCard({ star, revealedPassions }) {
  const T = useContext(ThemeCtx);
  const [expanded, setExpanded] = useState(false);
  const [fameInfoTip, setFameInfoTip] = useState(false);
  const mp  = macropassion(star.passions);
  const rep = reputation(star.fame, star.infamy, star.id);

  // Macropassion bar — same geometry as PassionBar
  const mpVal = macropassionValue(star.passions);
  const mpFillLeft  = mpVal < 0 ? `${50 + mpVal * 0.5}%` : '50%';
  const mpFillWidth = `${Math.abs(mpVal) * 0.5}%`;
  const mpFillColor = mpVal >= 0 ? '#3a7e32' : '#8a2818';

  return (
    <div className="star-card-enter" style={{ borderLeft: `3px solid ${star.color}`, background: T.card, padding: '11px 11px 11px 13px', borderRadius: '0 3px 3px 0', marginBottom: 16 }}>
      <div style={{ fontSize: T.fsMdLg, color: star.color, fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: 1 }}>{star.name}</div>
      <div style={{ fontSize: T.fsSm, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsSm, marginBottom: 8 }}>{star.role}</div>

      {/* Macropassion label + bar */}
      <div style={{ marginBottom: 12 }}>
        <HoverLabel
          label="Personal Regard"
          labelSize={T.fsMd}
          tooltip="How they feel towards you."
          align="left"
        />
        {(() => {
          const tickColor = T.bdrHi;
          const tickPcts = [12.5, 25, 35, 42.5, 57.5, 65, 75, 87.5];
          const tickGrads = tickPcts.map(pct =>
            `linear-gradient(90deg, transparent calc(${pct}% - 0.5px), ${tickColor} calc(${pct}% - 0.5px), ${tickColor} calc(${pct}% + 0.5px), transparent calc(${pct}% + 0.5px))`
          );
          const centerGrad = `linear-gradient(90deg, transparent calc(50% - 0.5px), ${tickColor} calc(50% - 0.5px), ${tickColor} calc(50% + 0.5px), transparent calc(50% + 0.5px))`;
          const barBg = [...tickGrads, centerGrad, T.surf].join(', ');
          return (
            <>
              <div style={{ position: 'relative', height: 6, background: barBg, borderRadius: T.radiusSm, marginTop: 4, overflow: 'visible' }}>
                <div style={{ position: 'absolute', left: mpFillLeft, width: mpFillWidth, top: 0, bottom: 0, background: mpFillColor, transition: 'all 0.6s ease', zIndex: 3, borderRadius: T.radiusSm }} />
              </div>
              <div style={{ fontSize: T.fsXs, color: mp.col, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsSm, marginTop: 6 }}>{mp.label}</div>
              {mp.warning && (
                <div style={{ fontSize: T.fsSm, color: mp.col, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', marginTop: 3, lineHeight: T.lhSnug, borderLeft: `2px solid ${mp.col}44`, paddingLeft: 5 }}>
                  {mp.warning}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Passions */}
      {Object.entries(star.passions)
        .filter(([k, p]) => isPassionVisible({ [star.id]: star }, star.id, k, revealedPassions))
        .map(([k, p]) => (
          <PassionBar key={k} passionKey={k} p={p} color={star.color} />
        ))}

      {/* Fame / Infamy — with section tooltip */}
      <div
        style={{ borderTop: `1px solid ${T.bdr}`, paddingTop: 8, marginTop: 4, position: 'relative', cursor: 'default' }}
        onMouseEnter={() => setFameInfoTip(true)}
        onMouseLeave={() => setFameInfoTip(false)}
      >
        {fameInfoTip && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 30, width: 210, background: T.cardHov, border: `1px solid ${T.bdrHi}`, borderRadius: T.radius, padding: T.padCardSm, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
            <div style={{ fontSize: T.fsSm, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhRelaxed }}>
              How much you currently register in their world. Fame tracks active goodwill — the influence that comes from helping, vouching, and being seen on the right side. Infamy tracks notoriety — the weight of what you've done against their interests. Both decay each season without maintenance. Both compound as they rise.
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          {/* Fame */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: T.fsXs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsSm }}>Fame</div>
            <div style={{ height: 3, background: T.bdr, marginTop: 2, borderRadius: T.radiusSm }}>
              <div style={{ height: '100%', width: `${star.fame}%`, background: SCENARIO.accentColor, borderRadius: T.radiusSm, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: T.fsXs, color: T.inkMut, fontFamily: "'Courier Prime', monospace" }}>{Math.floor(star.fame)}</div>
          </div>
          {/* Infamy */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: T.fsXs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsSm }}>Infamy</div>
            <div style={{ height: 3, background: T.bdr, marginTop: 2, borderRadius: T.radiusSm, position: 'relative' }}>
              <div style={{ height: '100%', width: `${star.infamy}%`, background: '#8a1818', borderRadius: T.radiusSm, transition: 'width 0.5s' }} />

            </div>
            <div style={{ fontSize: T.fsXs, color: T.inkMut, fontFamily: "'Courier Prime', monospace" }}>
              {Math.floor(star.infamy)}
            </div>
          </div>
        </div>
      </div>

      {/* Public Perception */}
      <div style={{ marginTop: 8, borderTop: `1px solid ${T.bdr}`, paddingTop: 6 }}>
        <HoverLabel label="Political Standing" value={rep.label} valueColor={T.inkFaint} valueSize={10} tooltip="How your actions have landed in their world — whether you're actively helping, actively harming, or yet to register." align="left" flipUp={true} />
        {rep.behavior && (
          <div style={{ fontSize: T.fsSm, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.45, marginTop: 4, borderLeft: `2px solid ${T.bdrHi}`, paddingLeft: 5 }}>{rep.behavior}</div>
        )}
      </div>

      {/* Community */}
      <div style={{ marginTop: 8, borderTop: `1px solid ${T.bdr}`, paddingTop: 6 }}>
        <div style={{ fontSize: T.fsXs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsSm, marginBottom: 3 }}>Their community</div>
        <div style={{ fontSize: T.fsSm, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.45 }}>{star.community}</div>
      </div>

      {/* Active Effects button */}
      <ActiveEffectsModal star={star} />
    </div>
  );
}

// ─── ACTIVE EFFECTS MODAL ─────────────────────────────────────────────────────
// Shows all currently active buffs and debuffs for a Star, derived from
// computeModifiers using the current macropassion and band-capped dominant passion.
function ActiveEffectsModal({ star }) {
  const T = useContext(ThemeCtx);
  const [open, setOpen] = useState(false);

  const macro = macropassionValue(star.passions);
  const mods = computeModifiers({ [star.id]: star })[star.id];
  const { fameMult, infamyMult, passionBonus, deltaObscured, cap, cappedDomValue } = mods;

  // Determine dominant passion label after capping
  const cappedPassions = Object.entries(star.passions).map(([k, p]) => {
    const v = p.value;
    const capped = macro >= 0 ? Math.min(v, cap) : Math.max(v, cap);
    return [k, { ...p, value: capped }];
  });
  const dominantEntry = cappedPassions.reduce((a, [k, p]) =>
    Math.abs(p.value) > Math.abs(a[1].value) ? [k, p] : a, ['', { value: 0, label: '' }]);
  const dominantPassion = star.passions[dominantEntry[0]];
  const dominantLabel = dominantPassion?.label ?? '—';
  const dominantBehavior = dominantPassion?.behaviors
    ? dominantPassion.behaviors[Object.keys(dominantPassion.behaviors)
        .map(Number).sort((a,b) => a - b)
        .reverse().find(k => cappedDomValue >= k) ?? 0]
    : null;

  const isPositive = macro >= 15;
  const isNegative = macro <= -15;
  const isNeutral  = !isPositive && !isNegative;

  const effects = [];

  if (isPositive) {
    if (fameMult > 1)    effects.push({ label: 'Fame gains', value: `×${fameMult.toFixed(2)}`, col: '#4a8e42', desc: 'Positive actions register more strongly in their world.' });
    if (infamyMult < 1)  effects.push({ label: 'Infamy gains', value: `×${infamyMult.toFixed(2)}`, col: '#4a8e42', desc: 'Negative actions land more softly — they give you the benefit of the doubt.' });
    if (passionBonus > 0) effects.push({ label: 'Passion bonus', value: `+${passionBonus} per gain`, col: '#4a8e42', desc: 'Their goodwill amplifies the impact of actions that serve their interests.' });
    if (!deltaObscured)  effects.push({ label: 'Effect deltas', value: 'Visible', col: '#4a8e42', desc: 'You understand enough about this relationship to read its consequences clearly.' });
    if (cap < 100)       effects.push({ label: 'Passion ceiling', value: `+${cap} band`, col: T.inkDim, desc: `This relationship is not yet deep enough to unlock the full range of ${dominantLabel} behaviors. Deeper trust required.` });
  }

  if (isNegative) {
    if (fameMult < 1)    effects.push({ label: 'Fame gains', value: `×${fameMult.toFixed(2)}`, col: '#9e1a10', desc: 'Your positive actions register less in their world — goodwill is harder to build.' });
    if (infamyMult > 1)  effects.push({ label: 'Infamy gains', value: `×${infamyMult.toFixed(2)}`, col: '#9e1a10', desc: 'Negative actions land harder — they are watching for exactly this.' });
    if (deltaObscured)   effects.push({ label: 'Effect deltas', value: 'Hidden', col: '#9e1a10', desc: 'You cannot read the full consequences of actions involving this person.' });
    if (Math.abs(cap) < 100) effects.push({ label: 'Penalty ceiling', value: `${cap} band`, col: T.inkDim, desc: `Their macropassion hasn't fallen far enough to unlock the full weight of ${dominantLabel} penalties. How far this deteriorates depends on their overall regard for you — not on your other relationships.` });
  }

  if (isNeutral) {
    effects.push({ label: 'Status', value: 'Neutral', col: T.inkDim, desc: 'No active modifiers. This relationship has not moved enough in either direction to produce systematic effects.' });
    // No cap shown for neutral — there are no bonuses to limit
  }

  if (dominantBehavior && !isNeutral) {
    effects.push({ label: `Dominant: ${dominantLabel}`, value: '', col: star.color, desc: dominantBehavior, isNarrative: true });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ marginTop: 10, width: '100%', background: 'none', border: `1px solid ${T.bdrHi}`, borderRadius: T.radius, padding: '4px 0', cursor: 'pointer', fontSize: T.fsXxs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsWide, transition: 'border-color 0.15s, color 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = star.color; e.currentTarget.style.color = star.color; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = T.bdrHi; e.currentTarget.style.color = T.inkDim; }}
      >
        View Modifiers
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.modalBg }} onClick={() => setOpen(false)}>
          <div style={{ background: T.hdr, border: `1px solid ${star.color}55`, borderRadius: T.radius, padding: T.padModal, width: 340, maxHeight: '78vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${T.bdr}` }}>
              <div>
                <div style={{ fontSize: T.fsXxs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsXWide, marginBottom: 4 }}>Active Modifiers</div>
                <div style={{ fontSize: T.fsMdLg, color: star.color, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{star.name}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: T.inkDim, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 0 0 16px', marginTop: -2 }}>×</button>
            </div>

            {/* Relationship context */}
            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${T.bdr}` }}>
              <div style={{ fontSize: T.fsXxs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsWide, marginBottom: 5 }}>Current Standing</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: T.fsMd, color: isPositive ? '#4a8e42' : isNegative ? '#9e1a10' : T.inkDim, fontFamily: "'Courier Prime', monospace", fontWeight: 600 }}>
                  {macropassion(star.passions).label}
                </span>
                <span style={{ fontSize: T.fsSm, color: T.inkFaint, fontFamily: "'Courier Prime', monospace" }}>
                  macro {macropassionValue(star.passions).toFixed(1)}
                </span>
              </div>
              {isNeutral && (
                <div style={{ fontSize: T.fsSm, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', marginTop: 5, lineHeight: T.lhSnug }}>
                  No modifiers active. Neither alliance nor opposition has formed in earnest.
                </div>
              )}
            </div>

            {/* Effect rows */}
            {effects.filter(eff => eff.label !== 'Status' || !isNeutral).length === 0 && isNeutral ? (
              <div style={{ fontSize: T.fsSm, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhRelaxed }}>
                This relationship has not yet produced active mechanical effects in either direction.
              </div>
            ) : (
              effects.map((eff, i) => (
                <div key={i} style={{ marginBottom: 11, paddingBottom: 11, borderBottom: i < effects.length - 1 ? `1px solid ${T.bdrSub}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                    <span style={{ fontSize: T.fsMd, color: eff.col, fontFamily: "'Courier Prime', monospace", fontWeight: eff.isNarrative ? 400 : 600 }}>{eff.label}</span>
                    {eff.value && <span style={{ fontSize: T.fsSm, color: eff.col, fontFamily: "'Courier Prime', monospace" }}>{eff.value}</span>}
                  </div>
                  <div style={{ fontSize: T.fsSm, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhSnug }}>{eff.desc}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── ACTION CARD ──────────────────────────────────────────────────────────────
function ActionCard({ act, stars, dispatch, revealed, revealedPassions, isNew, year, season, animating }) {
  const T = useContext(ThemeCtx);
  const [hov, setHov] = useState(false);
  const [expTip, setExpTip] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const seasonsLeft = act.expires ? seasonsRemaining(year, season, act.expires, act.expiresSeason) : null;
  const sourceStar = act.source ? stars[act.source] : null;
  const sourceLabel = sourceStar ? sourceStar.name.split(' ')[0] + ' ' + (sourceStar.name.split(' ').slice(1).join(' ') || '') : '—';
  const sourceColor = sourceStar?.color || T.inkDim;
  const msgType = act.msgType || 'Dispatch';
  const descText = (act.descRevealed && revealed.includes(act.descRevealed.star)) ? act.descRevealed.text : act.desc;

  const expColor = seasonsLeft === null ? null : seasonsLeft <= 1 ? '#c03018' : seasonsLeft <= 2 ? '#c07020' : '#7a5030';
  const successChance = act.successChanceFn ? act.successChanceFn(year) : null;

  return (
    <div
      className={isNew ? 'action-card-new' : ''}
      style={{ border: `1px solid ${hov ? T.bdrHi : T.bdr}`, background: hov ? T.cardHov : T.card, borderRadius: T.radius, marginBottom: 14, transition: 'border-color 0.15s, background 0.15s', overflow: 'hidden' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setExpTip(false); }}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg, ${sourceColor}22 0%, ${sourceColor} 100%)` }} />
      <div style={{ padding: T.padCard }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: T.gapSm, flex: 1, minWidth: 0 }}>
            <span style={{ color: sourceColor, fontSize: T.fsXxs }}>◆</span>
            <span style={{ fontSize: T.fsXs, color: sourceColor, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsNormal, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sourceLabel}</span>
            <span style={{ fontSize: T.fsXs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", letterSpacing: '0.08em' }}>—</span>
            <span style={{ fontSize: T.fsXs, color: T.inkMut, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{msgType}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {isNew && <div style={{ fontSize: T.fsXxs, color: SCENARIO.accentColor, fontFamily: "'Courier Prime', monospace", letterSpacing: T.lsWide, textTransform: 'uppercase' }}>New</div>}
            {successChance !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: T.padBadge, border: `1px solid ${successChance >= 0.7 ? '#4a8e4255' : successChance >= 0.4 ? '#c0702055' : '#c0301855'}`, borderRadius: T.radius, background: `${successChance >= 0.7 ? '#4a8e42' : successChance >= 0.4 ? '#c07020' : '#c03018'}18` }}>
                <span style={{ fontSize: T.fsXxs, color: successChance >= 0.7 ? '#4a8e42' : successChance >= 0.4 ? '#c07020' : '#c03018', fontFamily: "'Courier Prime', monospace", letterSpacing: T.lsNormal, textTransform: 'uppercase', fontWeight: 700 }}>{Math.round(successChance * 100)}%</span>
              </div>
            )}
            {seasonsLeft !== null && (
              <div style={{ position: 'relative' }} onMouseEnter={() => setExpTip(true)} onMouseLeave={() => setExpTip(false)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'default', padding: T.padBadge, border: `1px solid ${expColor}55`, borderRadius: T.radius, background: `${expColor}18` }}>
                  <span style={{ fontSize: T.fsSm, color: expColor, lineHeight: 1 }}>⏱</span>
                </div>
                {expTip && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100, background: T.hdr, border: `1px solid ${expColor}66`, borderRadius: T.radius, padding: T.padTip, width: 180, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
                    <div style={{ fontSize: T.fsXs, color: expColor, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsMd, fontWeight: 700 }}>
                      {act.mysteryExpiry ? 'Expires eventually.' : seasonsLeft === 1 ? 'Final Season' : `Expires in ${seasonsLeft} seasons`}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={e => { e.stopPropagation(); setCollapsed(c => !c); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkDim, fontSize: T.fsMd, padding: '0 2px', lineHeight: 1, fontFamily: "'Courier Prime', monospace" }}
              title={collapsed ? 'Expand' : 'Collapse'}
            >{collapsed ? '▼' : '▲'}</button>
          </div>
        </div>

        <div
          style={{ fontSize: T.fsMdLg, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 700, lineHeight: 1.3, marginBottom: collapsed ? 0 : 6 }}
        >{act.dispatch}</div>

        {!collapsed && (
          <div>            {act.moral && (
              <div style={{ fontSize: T.fsSm, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.6, marginBottom: 8, borderLeft: `2px solid ${T.bdrHi}`, paddingLeft: 8 }}>{act.moral}</div>
            )}
            <div style={{ fontSize: T.fsMd, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhRelaxed, marginBottom: 10 }}>{descText}</div>
            <div style={{ borderTop: `1px solid ${T.bdr}`, paddingTop: 8 }}>
              <div style={{ fontSize: T.fsXs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: T.lsNormal, marginBottom: 6, fontFamily: "'Courier Prime', monospace" }}>Known Effects & Consequences</div>
              {act.effects.filter(e => revealed.includes(e.star) && isPassionVisible(stars, e.star, e.passion, revealedPassions)).map((e, i, arr) => {
                const star    = stars[e.star];
                const passion = star?.passions[e.passion];
                const ben     = e.delta > 0;
                const vis     = effectVisibility(act.source, e.star, stars);
                const showDelta = vis === 'full';
                const crossing = (showDelta && passion) ? thresholdCrossing(passion.value, e.delta, passion) : null;
                return (
                  <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < arr.length - 1 ? `1px solid ${T.bdrSub}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: T.gapSm, marginBottom: 3 }}>
                      <span style={{ color: star?.color, fontSize: T.fsXxs }}>◆</span>
                      <span style={{ flex: 1, fontFamily: "'Courier Prime', monospace", fontSize: T.fsMd }}>
                        <span style={{ color: T.inkMid }}>{star?.name?.split(' ')[0]} · </span>
                        {showDelta
                          ? <span style={{ color: ben ? '#4a8e42' : '#9a3020', fontWeight: 700 }}>{passion?.label}{deltaSymbol(e.delta)}</span>
                          : <span style={{ color: T.inkDim }}>{passion?.label} <span style={{ opacity: 0.35, fontSize: T.fsXxs }}>——</span></span>
                        }
                      </span>
                    </div>
                    <div style={{ fontSize: T.fsSm, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhSnug, paddingLeft: 12 }}>{e.why}</div>
                    {crossing && (
                      <div style={{ marginTop: 5, paddingLeft: 12 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${crossing.color}18`, border: `1px solid ${crossing.color}44`, borderRadius: T.radius, padding: '2px 6px' }}>
                          <span style={{ fontSize: T.fsXxs, color: crossing.color, letterSpacing: T.lsMd, textTransform: 'uppercase', fontFamily: "'Courier Prime', monospace" }}>
                            Outlook on {passion?.label} becomes {crossing.label}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Reputation-gated bonus effects — shown only when current rep state matches */}
              {act.repBonus && (() => {
                const activeBonus = act.repBonus.filter(rb => stars[rb.star] && repStateKey(stars[rb.star]) === rb.repState);
                if (!activeBonus.length) return null;
                return (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.bdrHi}` }}>
                    <div style={{ fontSize: T.fsXxs, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: T.lsMd, fontFamily: "'Courier Prime', monospace", marginBottom: 5 }}>Additional — your current standing</div>
                    {activeBonus.flatMap((rb, ri) => (rb.extraEffects || []).map((e, i) => {
                      const star = stars[e.star];
                      const passion = star?.passions[e.passion];
                      return (
                        <div key={`${ri}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: T.gapSm, marginBottom: 5 }}>
                          <span style={{ color: star?.color, fontSize: T.fsXxs, marginTop: 2 }}>◈</span>
                          <div>
                            <span style={{ fontSize: T.fsSm, fontFamily: "'Courier Prime', monospace" }}>
                              <span style={{ color: T.inkMid }}>{star?.name?.split(' ')[0]} · </span>
                              <span style={{ color: e.delta > 0 ? '#4a8e42' : '#9a3020', fontWeight: 700 }}>{passion?.label}{deltaSymbol(e.delta)}</span>
                            </span>
                            {e.why && <div style={{ fontSize: T.fsSm, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhSnug, marginTop: 1 }}>{e.why}</div>}
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                );
              })()}
            </div>
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.bdr}`, display: 'flex', gap: T.gapMd }}
              onClick={e => e.stopPropagation()}>
              <button
                disabled={animating}
                onClick={() => { if (!animating) dispatch({ type: 'ACT', id: act.id }); }}
                style={{ background: 'transparent', border: `1px solid ${SCENARIO.accentColor}`, color: SCENARIO.accentColor, padding: T.padBtn, fontFamily: "'Courier Prime', monospace", fontSize: T.fsSm, cursor: animating ? 'default' : 'pointer', letterSpacing: T.lsNormal, textTransform: 'uppercase', borderRadius: T.radius, opacity: animating ? 0.4 : 1 }}
                onMouseEnter={e => { if (!animating) { e.currentTarget.style.background = SCENARIO.accentColor; e.currentTarget.style.color = '#1a1508'; }}}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SCENARIO.accentColor; }}
              >Accept</button>
              <button
                disabled={animating}
                onClick={() => { if (!animating) dispatch({ type: 'DECLINE', id: act.id }); }}
                style={{ background: 'transparent', border: `1px solid ${T.bdrHi}`, color: T.inkMut, padding: T.padBtn, fontFamily: "'Courier Prime', monospace", fontSize: T.fsSm, cursor: animating ? 'default' : 'pointer', letterSpacing: T.lsNormal, textTransform: 'uppercase', borderRadius: T.radius, opacity: animating ? 0.4 : 1 }}
                onMouseEnter={e => { if (!animating) { e.currentTarget.style.background = T.cardSub; e.currentTarget.style.color = T.ink; }}}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.inkMut; }}
              >Decline</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LOG ENTRY ────────────────────────────────────────────────────────────────
function LogEntry({ entry, stars, revealed, revealedPassions, isNew, hideDate = false }) {
  const T = useContext(ThemeCtx);
  if (entry.isQuiet) return (
    <div style={{ borderBottom: `1px solid ${T.bdr}`, paddingBottom: 12, marginBottom: 12, opacity: 0.45 }}>
      {!hideDate && <div style={{ fontSize: T.fsXs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsNormal, marginBottom: 4 }}>{entry.year}, {entry.season}</div>}
      <div style={{ fontSize: T.fsMd, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhNormal }}>— {entry.headline} —</div>
      <div style={{ fontSize: T.fsMd, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhLoose, marginTop: 4 }}>{entry.body}</div>
    </div>
  );

  if (entry.isRuin) return (
    <div style={{ border: '2px solid #8a1818', borderRadius: T.radius, background: T.defBg, padding: '16px 16px 18px', marginBottom: 20 }}>
      <div style={{ fontSize: T.fsXxs, color: '#8a1818', textTransform: 'uppercase', letterSpacing: T.lsXWide, fontFamily: "'Courier Prime', monospace", marginBottom: 8 }}>{entry.year}, {entry.season} — Final Entry</div>
      <div style={{ fontSize: 15, color: '#c04040', fontFamily: "'Playfair Display', serif", fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, marginBottom: 10 }}>{entry.headline}</div>
      <div style={{ fontSize: T.fsBase, color: '#9a5040', fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.7 }}>{entry.body}</div>
    </div>
  );

  if (entry.isDispatch) return (
    <div style={{ borderBottom: `1px solid ${T.bdr}`, paddingBottom: 16, marginBottom: 18 }}>
      <div style={{ background: T.surf, border: `1px solid ${T.bdr}`, borderLeft: `3px solid ${T.bdrHi}`, borderRadius: T.radius, padding: T.padCard }}>
        <div style={{ fontSize: T.fsXxs, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 6, borderBottom: `1px solid ${T.bdr}`, paddingBottom: 5 }}>
          ✦ {entry.dateline || SCENARIO.paperName}
        </div>
        <div style={{ fontSize: T.fsMdLg, color: T.dispInk, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.25, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{entry.headline}</div>
        <div style={{ fontSize: T.fsMd, color: T.dispFaint, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhLoose }}>{entry.body}</div>
      </div>
    </div>
  );

  if (entry.isInaction) return (
    <div style={{ borderBottom: `1px solid ${T.bdr}`, paddingBottom: 16, marginBottom: 18 }}>
      {!hideDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: T.gapMd, marginBottom: 6 }}>
          <span style={{ fontSize: T.fsSm, color: '#7a4030' }}>◌</span>
          <span style={{ fontSize: T.fsXs, color: '#7a4030', fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsNormal }}>{entry.year}, {entry.season} — {entry.isDeclined ? 'Declined' : 'Window Closed'}</span>
          {isNew && <span style={{ fontSize: T.fsXxs, color: SCENARIO.accentColor, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsWide, marginLeft: 'auto' }}>● New</span>}
        </div>
      )}
      <div style={{ background: T.inactBg, border: `1px solid ${T.bdr}`, borderLeft: '3px solid #7a4030', borderRadius: T.radius, padding: T.padCard }}>
        <div style={{ fontSize: T.fsMdLg, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontWeight: 700, lineHeight: 1.25, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{entry.headline}</div>
        <div style={{ fontSize: T.fsMd, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhLoose, marginBottom: entry.effects?.length ? 10 : 0 }}>{entry.body}</div>
        {entry.effects?.filter(e => revealed.includes(e.star)).map((e, i) => {
          const star = stars[e.star];
          const passion = star?.passions[e.passion];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: T.gapSm, marginTop: 4 }}>
              <span style={{ color: star?.color, fontSize: T.fsXxs }}>◆</span>
              <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: T.fsSm }}>
                <span style={{ color: T.inkMid }}>{star?.name?.split(' ')[0]} · </span>
                <span style={{ color: e.delta > 0 ? '#4a8e42' : '#9a3020', fontWeight: 700 }}>{passion?.label}{deltaSymbol(e.delta)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const hasUnknownStar = entry.effects.some(e => e.star && !revealed.includes(e.star));
  const bodyText = (hasUnknownStar && entry.bodyHidden) ? entry.bodyHidden : entry.body;
  const visibleEffects = entry.effects.filter(e => (!e.star || revealed.includes(e.star)) && isPassionVisible(stars, e.star, e.passion, revealedPassions));

  const D = entry.isDeferred;
  const R = entry.isReactive && !D;
  const accentColor = D ? '#8a1818' : R ? '#6a4a9a' : null;
  const bgColor     = D ? T.defBg   : R ? T.reactBg : 'transparent';
  const borderColor = D ? '#501010' : R ? '#3a2060' : T.bdr;
  // showHeaderRow: always show the icon row for deferred (⚡) and reactive (◈) entries
  // so their type indicators are never hidden even when the date is suppressed by hideDate.
  const showHeaderRow = !hideDate || D || R;
  return (
    <div style={{ borderBottom: `1px solid ${borderColor}`, marginBottom: 18, background: bgColor, borderLeft: accentColor ? `3px solid ${accentColor}` : 'none', padding: accentColor ? '12px 14px 14px' : '0 0 16px 0', borderRadius: accentColor ? T.radius : 0 }}>
      {showHeaderRow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          {D && <span style={{ fontSize: 12, color: '#8a1818' }}>⚡</span>}
          {R && <span style={{ fontSize: T.fsMd, color: '#6a4a9a' }}>◈</span>}
          {!hideDate && <span style={{ fontSize: T.fsXs, color: T.inkMut, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsNormal }}>{entry.year}, {entry.season}</span>}
          {R && <span style={{ fontSize: T.fsXxs, color: '#6a4a9a', fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsWide }}>— Narrative Event</span>}
          {!hideDate && isNew && !D && !R && <span style={{ fontSize: T.fsXxs, color: SCENARIO.accentColor, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsWide, marginLeft: 'auto' }}>● New</span>}
        </div>
      )}
      {showHeaderRow && <div style={{ height: '0.5px', background: borderColor, marginBottom: 8 }} />}
      <div style={{ fontSize: 14, lineHeight: 1.3, marginBottom: 6, color: D ? '#c03030' : R ? '#8060c0' : T.ink, fontFamily: "'Playfair Display', serif", fontWeight: (D || R) ? 900 : 700, textTransform: D ? 'uppercase' : 'none', letterSpacing: D ? '0.03em' : 'normal' }}>
        {entry.headline}
      </div>
      <div style={{ fontSize: T.fsBase, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhLoose, marginBottom: 10 }}>{bodyText}</div>
      {D && <div style={{ fontSize: T.fsSm, color: T.inkDim, fontFamily: "'Courier Prime', monospace", marginBottom: 8, borderTop: '1px solid #501010', paddingTop: 6 }}>Origin: {entry.decision}</div>}
      <div>
        {visibleEffects.map((e, i) => {
          const star = stars?.[e.star];
          const ben  = e.delta > 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: T.gapSm, marginBottom: 5 }}>
              <span style={{ color: star?.color || T.inkMut, fontSize: T.fsXxs, marginTop: 3 }}>◆</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: T.fsSm, fontFamily: "'Courier Prime', monospace" }}>
                    <span style={{ color: T.inkMid }}>{star?.name?.split(' ')[0] || '—'} · </span>
                    <span style={{ color: ben ? '#4a8e42' : '#9a3020', fontWeight: 700 }}>{star?.passions[e.passion]?.label || e.passion}{deltaSymbol(e.delta)}</span>
                  </span>
                </div>
                {e.why && <div style={{ fontSize: T.fsSm, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhSnug, marginTop: 1 }}>{e.why}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



// ─── SEASON CONFIG ────────────────────────────────────────────────────────────
const SEASON_VISUALS = {
  Spring: { color: '#7ab84a', symbol: '❧', sub: 'The valley wakes.' },
  Summer: { color: SCENARIO.accentColor, symbol: '☀', sub: 'The heat stays.'   },
  Autumn: { color: '#c87030', symbol: '✦', sub: 'Things turn.'      },
  Winter: { color: '#8ab0c8', symbol: '❄', sub: 'The passes close.' },
};

// ─── CONVERGENCE MODAL ───────────────────────────────────────────────────────
function ConvergenceModal({ event, stars, dispatch }) {
  const T = useContext(ThemeCtx);
  return (
    <div style={{ position: 'fixed', inset: 0, zoom: 0.75, zIndex: 200, background: T.modalBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%', maxHeight: 'calc(70vh * 0.75)', overflowY: 'auto', background: T.hdr, border: `1px solid ${T.bdrHi}`, borderTop: `3px solid ${SCENARIO.accentColor}`, padding: T.padModal, animation: 'fadeInModal 0.45s ease-out forwards', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: T.fsXxs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: T.lsXWide, marginBottom: 10 }}>Convergence — A Forced Choice</div>
        <div style={{ fontSize: 18, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.2, marginBottom: 14 }}>{event.headline}</div>
        <div style={{ fontSize: T.fsBase, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.7, marginBottom: 22, borderBottom: `1px solid ${T.bdr}`, paddingBottom: 18 }}>{event.body}</div>
        <div style={{ fontSize: T.fsXxs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: T.lsWide, marginBottom: 10 }}>How do you stand?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {event.choices.map(choice => (
            <button key={choice.id} onClick={() => dispatch({ type: 'CHOOSE', eventId: event.id, choiceId: choice.id })}
              style={{ background: 'transparent', border: `1px solid ${T.bdr}`, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', borderRadius: T.radius, transition: 'border-color 0.15s, background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = SCENARIO.accentColor; e.currentTarget.style.background = T.cardHov; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.bdr; e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ fontSize: T.fsBase, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 700, lineHeight: 1.3, marginBottom: 5 }}>{choice.label}</div>
              <div style={{ fontSize: T.fsSm, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhNormal }}>{choice.desc}</div>
              {choice.effects.filter(e => stars[e.star]).length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.bdr}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(
                    choice.effects.reduce((acc, e) => {
                      if (!stars[e.star]) return acc;
                      if (!acc[e.star]) acc[e.star] = [];
                      acc[e.star].push(e);
                      return acc;
                    }, {})
                  ).map(([starId, effects]) => {
                    const star = stars[starId];
                    return (
                      <div key={starId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: T.fsXs, fontFamily: "'Courier Prime', monospace", color: star.color, fontWeight: 700 }}>{star.name.split(' ')[0]}:</span>
                        {effects.map((e, i) => {
                          const passion = star.passions[e.passion];
                          return (
                            <span key={i} style={{ fontSize: T.fsXs, fontFamily: "'Courier Prime', monospace", color: e.delta > 0 ? '#4a8e42' : '#9a3020' }}>
                              {passion?.label || e.passion}{deltaSymbol(e.delta)}{i < effects.length - 1 ? ',' : ''}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── STAR INTRO MODAL ─────────────────────────────────────────────────────────
// Fires once per Star when they first enter the player's accounting.
// Period newspaper voice — observational, not addressed to the player directly.
function StarIntroModal({ starId, stars, dispatch }) {
  const T = useContext(ThemeCtx);
  const star = stars[starId];
  if (!star?.intro) return null;
  const { intro } = star;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 210, zoom: 0.75, background: T.modalBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', background: T.hdr, border: `1px solid ${star.color}`, borderTop: `3px solid ${star.color}`, padding: T.padModal, animation: 'fadeInModal 0.45s ease-out forwards', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: T.fsXxs, color: star.color, textTransform: 'uppercase', letterSpacing: T.lsXWide, fontFamily: "'Courier Prime', monospace", marginBottom: 10 }}>
          Met a Person of Interest
        </div>
        <div style={{ fontSize: 22, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.15, marginBottom: 4 }}>{star.name}</div>
        <div style={{ fontSize: T.fsSm, color: star.color, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsWide, marginBottom: 16 }}>{star.role}</div>
        <div style={{ height: '0.5px', background: T.bdr, marginBottom: 16 }} />
        <div style={{ fontSize: 18, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.2, marginBottom: 16 }}>{intro.headline}</div>
        <div style={{ fontSize: T.fsBase, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.75, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.bdr}` }}>{intro.body}</div>
        <div style={{ fontSize: T.fsXs, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhNormal, marginBottom: 20, borderLeft: `2px solid ${T.bdrHi}`, paddingLeft: 8 }}>
          ✦ {intro.paperLine}
        </div>
        <button
          onClick={() => dispatch({ type: 'DISMISS_INTRO' })}
          style={{ background: 'transparent', border: `1px solid ${star.color}`, color: star.color, padding: '10px 18px', fontFamily: "'Courier Prime', monospace", fontSize: T.fsSm, cursor: 'pointer', letterSpacing: T.lsWide, textTransform: 'uppercase', borderRadius: T.radius, width: '100%', transition: 'background 0.15s, color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = star.color; e.currentTarget.style.color = T.hdr; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = star.color; }}>
          {intro.continueLabel} →
        </button>
      </div>
    </div>
  );
}

// ─── PASSION REVEAL MODAL ─────────────────────────────────────────────────────
function PassionRevealModal({ revealKey, dispatch }) {
  const T = useContext(ThemeCtx);
  const { key, year } = revealKey;
  const dialogue = PASSION_REVEAL_DIALOGUES[key];
  if (!dialogue) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zoom: 0.75, zIndex: 210, background: T.modalBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', background: T.hdr, border: `1px solid ${dialogue.starColor}`, borderTop: `3px solid ${dialogue.starColor}`, padding: T.padModal, animation: 'fadeInModal 0.45s ease-out forwards', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>

        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: T.gapMd, marginBottom: 14 }}>
          <div style={{ fontSize: T.fsXxs, color: dialogue.starColor, textTransform: 'uppercase', letterSpacing: T.lsXWide, fontFamily: "'Courier Prime', monospace" }}>
            Hidden Passion Revealed
          </div>
          <div style={{ flex: 1, height: 1, background: dialogue.starColor, opacity: 0.3 }} />
          <div style={{ fontSize: T.fsSm, color: dialogue.starColor, fontFamily: "'Courier Prime', monospace", fontWeight: 700 }}>
            {dialogue.passionLabel}
          </div>
        </div>

        {/* Star name */}
        <div style={{ fontSize: T.fsSm, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsWide, marginBottom: 6 }}>{dialogue.starName}</div>

        {/* Headline */}
        <div style={{ fontSize: 18, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.2, marginBottom: 16 }}>{dialogue.headline}</div>

        {/* Body */}
        <div style={{ fontSize: T.fsBase, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.75, marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${T.bdr}` }}>{dialogue.body(year)}</div>

        {/* Passive signal */}
        <div style={{ fontSize: T.fsXs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.6, marginBottom: 18 }}>
          There may be something you can do about this. Sooner or later.
        </div>

        {/* Continue */}
        <button
          onClick={() => dispatch({ type: 'DISMISS_REVEAL' })}
          style={{ background: 'transparent', border: `1px solid ${dialogue.starColor}`, color: dialogue.starColor, padding: '10px 18px', fontFamily: "'Courier Prime', monospace", fontSize: T.fsSm, cursor: 'pointer', letterSpacing: T.lsWide, textTransform: 'uppercase', borderRadius: T.radius, width: '100%', transition: 'background 0.15s, color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = dialogue.starColor; e.currentTarget.style.color = T.hdr; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = dialogue.starColor; }}>
          {dialogue.continueLabel} →
        </button>

      </div>
    </div>
  );
}

// ─── COHESION EVENT MODAL ─────────────────────────────────────────────────────
// Fires when ally or enemy cohesion first crosses a meaningful threshold.
// Styled like StarIntroModal — newspaper voice, describes world shift.
function CohesionEventModal({ event, dispatch }) {
  const T = useContext(ThemeCtx);
  if (!event) return null;
  const isAlly   = event.type === 'ally';
  const text     = COHESION_EVENT_TEXT[event.type][event.threshold];
  const accentCol = isAlly ? '#4a8e42' : '#9e1a10';
  const borderCol = isAlly ? '#4a8e4299' : '#9e1a1099';
  const label    = isAlly ? 'The Valley Aligns' : 'Opposition Consolidates';
  const dateline = `${SCENARIO.paperName} · ${event.season}, ${event.year}`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 210, zoom: 0.75, background: T.modalBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', background: T.hdr, border: `1px solid ${borderCol}`, borderTop: `3px solid ${accentCol}`, padding: T.padModal, animation: 'fadeInModal 0.45s ease-out forwards', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>

        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: T.gapMd, marginBottom: 14 }}>
          <div style={{ fontSize: T.fsXxs, color: accentCol, textTransform: 'uppercase', letterSpacing: T.lsXWide, fontFamily: "'Courier Prime', monospace" }}>
            {label}
          </div>
          <div style={{ flex: 1, height: 1, background: accentCol, opacity: 0.3 }} />
          <div style={{ fontSize: T.fsSm, color: accentCol, fontFamily: "'Courier Prime', monospace", fontWeight: 700 }}>
            {isAlly ? 'Ally' : 'Enemy'} Cohesion ≥ {event.threshold}
          </div>
        </div>

        {/* Headline */}
        <div style={{ fontSize: 22, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.15, marginBottom: 16 }}>{text.headline}</div>

        {/* Body */}
        <div style={{ fontSize: T.fsBase, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.75, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.bdr}` }}>{text.body}</div>

        {/* Dateline */}
        <div style={{ fontSize: T.fsXs, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.6, marginBottom: 20, borderLeft: `2px solid ${T.bdrHi}`, paddingLeft: 8 }}>
          ✦ {dateline}
        </div>

        {/* Continue */}
        <button
          onClick={() => dispatch({ type: 'DISMISS_COHESION_EVENT' })}
          style={{ background: 'transparent', border: `1px solid ${accentCol}`, color: accentCol, padding: '10px 18px', fontFamily: "'Courier Prime', monospace", fontSize: T.fsSm, cursor: 'pointer', letterSpacing: T.lsWide, textTransform: 'uppercase', borderRadius: T.radius, width: '100%', transition: 'background 0.15s, color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = accentCol; e.currentTarget.style.color = T.hdr; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = accentCol; }}>
          Understood →
        </button>

      </div>
    </div>
  );
}

function GuestModal({ guest, dispatch }) {
  const T = useContext(ThemeCtx);
  return (
    <div style={{ position: 'fixed', inset: 0, zoom: 0.75, zIndex: 200, background: T.modalBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%', background: T.hdr, border: `1px solid ${T.bdrHi}`, borderTop: `3px solid ${T.inkMut}`, padding: T.padModal, animation: 'fadeInModal 0.45s ease-out forwards', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: T.fsXxs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: T.lsXWide, marginBottom: 6 }}>A Visitor at the Door</div>
        <div style={{ fontSize: 20, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.2, marginBottom: 4 }}>{guest.name}</div>
        <div style={{ fontSize: T.fsSm, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsWide, marginBottom: 16 }}>{guest.role}</div>
        <div style={{ fontSize: T.fsBase, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.75, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${T.bdr}` }}>{guest.arrival}</div>
        {guest.moral && (
          <div style={{ fontSize: T.fsSm, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.6, marginBottom: 18, borderLeft: `2px solid ${T.bdrHi}`, paddingLeft: 10 }}>{guest.moral}</div>
        )}
        <div style={{ fontSize: T.fsXxs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: T.lsWide, marginBottom: 10 }}>What do you do?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.gapMd }}>
          {guest.choices.map(choice => (
            <button key={choice.id} onClick={() => dispatch({ type: 'GUEST_CHOOSE', guestId: guest.id, choiceId: choice.id })}
              style={{ background: 'transparent', border: `1px solid ${T.bdr}`, padding: '11px 14px', textAlign: 'left', cursor: 'pointer', borderRadius: T.radius, transition: 'border-color 0.15s, background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.inkMut; e.currentTarget.style.background = T.cardHov; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.bdr; e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ fontSize: T.fsBase, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: 4 }}>{choice.label}</div>
              <div style={{ fontSize: T.fsSm, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhNormal }}>{choice.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HOMESTEAD PANEL ──────────────────────────────────────────────────────────
function HomesteadPanel({ homesteadLog }) {
  const T = useContext(ThemeCtx);
  if (!homesteadLog || homesteadLog.length === 0) return null;
  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.bdr}` }}>
      <div style={{ fontSize: T.fsXxs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: T.lsXWide, marginBottom: 10 }}>The Crossroads — Who Has Passed Through</div>
      {homesteadLog.map((item, i) => (
        <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${T.bdrSub}` }}>
          <div style={{ fontSize: T.fsXxs, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsNormal, marginBottom: 3 }}>{item.year}, {item.season}</div>
          <div style={{ fontSize: T.fsMd, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhRelaxed }}>{item.note}</div>
        </div>
      ))}
    </div>
  );
}

// ─── INTRO SCREEN ─────────────────────────────────────────────────────────────
function IntroScreen({ onBegin, T }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, fontFamily: "'Courier Prime', monospace" }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: T.fsXxs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 20 }}>{`${SCENARIO.paperName} · ${SCENARIO.paperEst}`}</div>
        <div style={{ fontSize: T.fsBase, color: T.inkFaint, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', marginBottom: 16 }}>✦ ✦ ✦</div>
        <div style={{ fontSize: 38, color: SCENARIO.accentColor, fontFamily: "'Playfair Display', serif", fontWeight: 900, letterSpacing: '0.06em', lineHeight: 1, marginBottom: 10 }}>{SCENARIO.gameName}</div>
        <div style={{ fontSize: T.fsSm, color: T.inkMut, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: 32 }}>California Territory · 1810</div>
        <div style={{ fontSize: T.fsBase, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', lineHeight: 1.85, marginBottom: 12, borderTop: `1px solid ${T.bdr}`, borderBottom: `1px solid ${T.bdr}`, padding: '22px 0' }}>
          You have arrived in the valley with land, some money, and a name not yet known.<br /><br />
          Others have arrived before you. What you do here — and to whom — will determine whether you endure.
        </div>
        <div style={{ fontSize: T.fsXs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.6, marginBottom: 32 }}>
          Decisions accumulate. Some arrive as choices. Others arrive as consequences.
        </div>
        <button
          onClick={onBegin}
          style={{ background: 'transparent', border: `1px solid ${SCENARIO.accentColor}`, color: SCENARIO.accentColor, padding: '10px 32px', fontFamily: "'Courier Prime', monospace", fontSize: T.fsMd, cursor: 'pointer', letterSpacing: '0.18em', textTransform: 'uppercase', borderRadius: T.radius }}
          onMouseEnter={e => { e.currentTarget.style.background = SCENARIO.accentColor; e.currentTarget.style.color = T.bg; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SCENARIO.accentColor; }}>
          Begin — 1810 →
        </button>
      </div>
    </div>
  );
}

// ─── RUIN SCREEN ──────────────────────────────────────────────────────────────
function RuinScreen({ state, dispatch }) {
  const T = useContext(ThemeCtx);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: T.ruinBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, fontFamily: "'Courier Prime', monospace" }}>
      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: T.fsXxs, color: '#8a1818', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 20 }}>{state.season}, {state.year} — The Territory Has Spoken</div>
        <div style={{ fontSize: T.fsBase, color: T.inkFaint, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', marginBottom: 14 }}>✦ ✦ ✦</div>
        <div style={{ fontSize: 26, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.15, marginBottom: 24, letterSpacing: '0.02em' }}>{state.ruinHeadline}</div>
        <div style={{ fontSize: 12, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.85, marginBottom: 36, borderTop: `1px solid ${T.bdr}`, borderBottom: `1px solid ${T.bdr}`, padding: '20px 0' }}>{state.ruinReason}</div>
        {state.homesteadLog.length > 0 && (
          <div style={{ marginBottom: 32, textAlign: 'left', background: T.ruinCardBg, border: `1px solid ${T.bdr}`, borderRadius: T.radius, padding: '14px 16px' }}>
            <div style={{ fontSize: T.fsXxs, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: T.lsXWide, marginBottom: 10 }}>Those Who Passed Through the Crossroads</div>
            {state.homesteadLog.slice(0, 6).map((item, i) => (
              <div key={i} style={{ fontSize: T.fsMd, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhRelaxed, marginBottom: 6 }}>
                <span style={{ color: T.bdrHi }}>{item.year} — </span>{item.note}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          style={{ background: 'transparent', border: `1px solid ${T.bdrHi}`, color: SCENARIO.accentColor, padding: '10px 28px', fontFamily: "'Courier Prime', monospace", fontSize: T.fsMd, cursor: 'pointer', letterSpacing: T.lsWide, textTransform: 'uppercase', borderRadius: T.radius }}
          onMouseEnter={e => { e.currentTarget.style.background = SCENARIO.accentColor; e.currentTarget.style.color = T.hdr; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SCENARIO.accentColor; }}>
          Begin Again — 1810
        </button>
      </div>
    </div>
  );
}

// ─── WIN MODAL ────────────────────────────────────────────────────────────────
// Convergence-style interrupt — offered once, decided once.
function WinModal({ condition, dispatch }) {
  const T = useContext(ThemeCtx);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, background: T.modalBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ maxWidth: 520, width: '100%', maxHeight: 'calc(70vh * 0.75)', overflowY: 'auto', background: T.hdr, border: `1px solid ${T.bdrHi}`, borderTop: `3px solid ${SCENARIO.accentColor}`, borderRadius: T.radius, padding: T.padModal, animation: 'fadeInModal 0.45s ease-out forwards', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: T.fsXxs, color: SCENARIO.accentColor, textTransform: 'uppercase', letterSpacing: T.lsXWide, marginBottom: 6, fontFamily: "'Courier Prime', monospace" }}>
          ✦ A Moment of Reckoning
        </div>
        <div style={{ fontSize: T.fsBase, color: T.inkFaint, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', marginBottom: 10 }}>— {condition.subhead} —</div>
        <div style={{ fontSize: 18, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.2, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{condition.headline}</div>
        <div style={{ height: '0.5px', background: T.bdr, marginBottom: 14 }} />
        <div style={{ fontSize: T.fsMd, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhLoose, marginBottom: 20 }}>{condition.prompt}</div>
        <div style={{ display: 'flex', gap: T.gapMd, justifyContent: 'flex-end' }}>
          <button
            onClick={() => dispatch({ type: 'WIN_DECLINE' })}
            style={{ background: 'transparent', border: `1px solid ${T.bdrHi}`, color: T.inkMut, padding: T.padBtn, fontFamily: "'Courier Prime', monospace", fontSize: T.fsSm, cursor: 'pointer', letterSpacing: T.lsNormal, textTransform: 'uppercase', borderRadius: T.radius }}
            onMouseEnter={e => { e.currentTarget.style.background = T.cardSub; e.currentTarget.style.color = T.ink; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.inkMut; }}>
            Find Another Way
          </button>
          <button
            onClick={() => dispatch({ type: 'WIN_ACCEPT' })}
            style={{ background: 'transparent', border: `1px solid ${SCENARIO.accentColor}`, color: SCENARIO.accentColor, padding: T.padBtn, fontFamily: "'Courier Prime', monospace", fontSize: T.fsSm, cursor: 'pointer', letterSpacing: T.lsNormal, textTransform: 'uppercase', borderRadius: T.radius }}
            onMouseEnter={e => { e.currentTarget.style.background = SCENARIO.accentColor; e.currentTarget.style.color = T.hdr; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SCENARIO.accentColor; }}>
            {condition.acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WIN SCREEN ───────────────────────────────────────────────────────────────
function WinScreen({ state, dispatch }) {
  const T = useContext(ThemeCtx);
  const wc = WIN_CONDITIONS.find(w => w.id === state.wonConditionId);
  if (!wc) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, fontFamily: "'Courier Prime', monospace" }}>
      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: T.fsXxs, color: SCENARIO.accentColor, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 20 }}>{state.season}, {state.year} — The Ledger Closes</div>
        <div style={{ fontSize: T.fsBase, color: T.inkFaint, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', marginBottom: 14 }}>✦ ✦ ✦</div>
        <div style={{ fontSize: T.fsBase, color: T.inkDim, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', marginBottom: 8 }}>— {wc.subhead} —</div>
        <div style={{ fontSize: 26, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.15, marginBottom: 24, letterSpacing: '0.02em' }}>{wc.headline}</div>
        <div style={{ fontSize: 12, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.85, marginBottom: 36, borderTop: `1px solid ${T.bdr}`, borderBottom: `1px solid ${T.bdr}`, padding: '20px 0', whiteSpace: 'pre-line', textAlign: 'left' }}>{wc.body}</div>
        {state.homesteadLog.length > 0 && (
          <div style={{ marginBottom: 32, textAlign: 'left', background: T.card, border: `1px solid ${T.bdr}`, borderRadius: T.radius, padding: '14px 16px' }}>
            <div style={{ fontSize: T.fsXxs, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: T.lsXWide, marginBottom: 10 }}>Those Who Passed Through the Crossroads</div>
            {state.homesteadLog.slice(0, 6).map((item, i) => (
              <div key={i} style={{ fontSize: T.fsMd, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhRelaxed, marginBottom: 6 }}>
                <span style={{ color: T.bdrHi }}>{item.year} — </span>{item.note}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          style={{ background: 'transparent', border: `1px solid ${T.bdrHi}`, color: SCENARIO.accentColor, padding: '10px 28px', fontFamily: "'Courier Prime', monospace", fontSize: T.fsMd, cursor: 'pointer', letterSpacing: T.lsWide, textTransform: 'uppercase', borderRadius: T.radius }}
          onMouseEnter={e => { e.currentTarget.style.background = SCENARIO.accentColor; e.currentTarget.style.color = T.hdr; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SCENARIO.accentColor; }}>
          Begin Again — {SCENARIO.startYear}
        </button>
      </div>
    </div>
  );
}
// ─── OBSCURITY SCREEN ─────────────────────────────────────────────────────────
// Fires when the player has gone 10 seasons without a meaningful decision.
// Not ruin — no one moved against you. Not a win — you didn't move decisively.
// The world filled the space you left. The homestead stays yours. Your name stopped
// appearing in anyone else's accounting.
function ObscurityScreen({ state, dispatch }) {
  const T = useContext(ThemeCtx);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, fontFamily: "'Courier Prime', monospace" }}>
      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: T.fsXxs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 20 }}>{state.season}, {state.year} — The Ledger Goes Quiet</div>
        <div style={{ fontSize: T.fsBase, color: T.inkFaint, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', marginBottom: 14 }}>— — —</div>
        <div style={{ fontSize: 26, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.15, marginBottom: 24, letterSpacing: '0.02em' }}>THE VALLEY FOUND ITS OWN ARRANGEMENT</div>
        <div style={{ fontSize: 12, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.85, marginBottom: 36, borderTop: `1px solid ${T.bdr}`, borderBottom: `1px solid ${T.bdr}`, padding: '20px 0', textAlign: 'left' }}>
          The valley continued. The arrangements made here held or didn't, and new parties arrived to test them. The homestead remained in your name. Your name stopped appearing in anyone else's accounting.{'\n\n'}Someone else read the room. The space you left did not stay empty.
        </div>
        {state.homesteadLog.length > 0 && (
          <div style={{ marginBottom: 32, textAlign: 'left', background: T.card, border: `1px solid ${T.bdr}`, borderRadius: T.radius, padding: '14px 16px' }}>
            <div style={{ fontSize: T.fsXxs, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: T.lsXWide, marginBottom: 10 }}>Those Who Passed Through the Crossroads</div>
            {state.homesteadLog.slice(0, 6).map((item, i) => (
              <div key={i} style={{ fontSize: T.fsMd, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhRelaxed, marginBottom: 6 }}>
                <span style={{ color: T.bdrHi }}>{item.year} — </span>{item.note}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          style={{ background: 'transparent', border: `1px solid ${T.bdrHi}`, color: T.inkMut, padding: '10px 28px', fontFamily: "'Courier Prime', monospace", fontSize: T.fsMd, cursor: 'pointer', letterSpacing: T.lsWide, textTransform: 'uppercase', borderRadius: T.radius }}
          onMouseEnter={e => { e.currentTarget.style.background = T.cardSub; e.currentTarget.style.color = T.ink; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.inkMut; }}>
          Begin Again — {SCENARIO.startYear}
        </button>
      </div>
    </div>
  );
}

// ─── HEADER MENU ──────────────────────────────────────────────────────────────
function HeaderMenu({ dispatch, darkMode, setDarkMode }) {
  const T = useContext(ThemeCtx);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: open ? SCENARIO.accentColor : T.inkDim, fontSize: 16, lineHeight: 1, padding: '4px 2px', fontFamily: "'Courier Prime', monospace", transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = SCENARIO.accentColor}
        onMouseLeave={e => e.currentTarget.style.color = open ? SCENARIO.accentColor : T.inkDim}
        title="Menu"
      >☰</button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 50, background: T.hdr, border: `1px solid ${T.bdrHi}`, borderRadius: T.radius, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: T.fsXxs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsWide, padding: '8px 12px 4px', borderBottom: `1px solid ${T.bdr}` }}>Options</div>
            <button
              onClick={() => { setDarkMode(d => !d); setOpen(false); }}
              style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: T.padSection, textAlign: 'left', color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontSize: T.fsMd, letterSpacing: T.lsNormal, textTransform: 'uppercase', borderBottom: `1px solid ${T.bdr}` }}
              onMouseEnter={e => { e.currentTarget.style.background = T.cardHov; e.currentTarget.style.color = T.ink; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.inkMut; }}
            >{darkMode ? '☀ Day Mode' : '☾ Night Mode'}</button>
            <button
              onClick={() => { dispatch({ type: 'RESET' }); setOpen(false); }}
              style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: T.padSection, textAlign: 'left', color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontSize: T.fsMd, letterSpacing: T.lsNormal, textTransform: 'uppercase', borderBottom: `1px solid ${T.bdr}` }}
              onMouseEnter={e => { e.currentTarget.style.background = T.cardHov; e.currentTarget.style.color = T.ink; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.inkMut; }}
            >↺ New Game</button>
            <div style={{ padding: '7px 12px', fontSize: T.fsSm, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhNormal }}>Manifest · 1810–1860</div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function ManifestGame() {
  const [state, dispatch] = useReducer(reducer, INIT);
  const [darkMode, setDarkMode] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const T = mkT(darkMode);
  const [animating, setAnimating] = useState(false);
  const [animPhase, setAnimPhase]     = useState('idle');
  const [animContent, setAnimContent] = useState(null);
  const advancingRef = useRef(false);

  const allActions = [...ACTIONS, ...UNLOCKABLE_ACTIONS.filter(a => state.unlockedActions.includes(a.id))];

  // allPlayable — actions visible in Decisions this season.
  // Filters: not already taken, within ya/expiry window, quest chain satisfied,
  // hidden passion visible, repair/betrayal thresholds met.
  const allPlayable = allActions
    .filter(a => {
      if (state.taken.includes(a.id)) return false;
      if (state.hiddenActions.includes(a.id)) return false;
      const cTick = state.year * 4 + SEASON_IDX[state.season];
      if ((a.ya ?? 0) * 4 + (a.yaSeasonIdx ?? 0) > cTick) return false;
      if (a.expires && a.expires * 4 + (a.expiresSeason ? SEASON_IDX[a.expiresSeason] : 0) <= cTick) return false;
      // Quest chain: a prior action must have been completed before this one surfaces.
      if (a.requiresTaken && !state.taken.includes(a.requiresTaken)) return false;
      // Passion visibility: use isPassionVisible() which correctly averages only the
      // non-hidden passions for the reveal check — NOT macropassionValue(), which
      // would drag the hidden passion's starting value of 0 into the average and
      // silently inflate the effective threshold required to unlock this action.
      if (a.requiresPassionVisible) {
        const { star, passion } = a.requiresPassionVisible;
        if (!isPassionVisible(state.stars, star, passion, state.revealedPassions)) return false;
      }
      // Repair / betrayal gates — action only surfaces when passion has crossed a threshold.
      if (a.requiresPassionBelow) {
        const { star, passion, threshold } = a.requiresPassionBelow;
        if ((state.stars[star]?.passions[passion]?.value ?? 0) > threshold) return false;
      }
      if (a.requiresPassionAbove) {
        const { star, passion, threshold } = a.requiresPassionAbove;
        if ((state.stars[star]?.passions[passion]?.value ?? 0) < threshold) return false;
      }
      return true;
    });
  const newThisTurn = new Set(allPlayable.filter(a => !state.seenActions.includes(a.id)).map(a => a.id));
  // Sort order: new-this-turn first, then by recency of first appearance (position in seenActions,
  // later index = appeared more recently = higher priority), then by ya as tiebreaker.
  const playable = [...allPlayable].sort((a, b) => {
    const aNew = newThisTurn.has(a.id);
    const bNew = newThisTurn.has(b.id);
    // New cards always float to top
    if (aNew !== bNew) return aNew ? -1 : 1;
    // Among seen cards: later seenActions index = more recently surfaced = sort first
    const aIdx = state.seenActions.indexOf(a.id);
    const bIdx = state.seenActions.indexOf(b.id);
    if (aIdx !== bIdx) return bIdx - aIdx;
    // Final tiebreaker: later ya (more recently unlocked by year)
    return (b.ya ?? 0) - (a.ya ?? 0);
  });
  // revealed — authoritative list of star IDs visible to the player.
  // Now driven by state.revealedStars, which is populated in ADVANCE when a Star's
  // ya tick is reached or their spawnCondition fires. No longer derived from actions.
  const revealed = state.revealedStars;

  const SEASONS_LIST = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const nextSeasonIdx = (SEASONS_LIST.indexOf(state.season) + 1) % SEASONS_LIST.length;
  const nextSeason    = SEASONS_LIST[nextSeasonIdx];
  const nextYear      = nextSeasonIdx === 0 ? state.year + 1 : state.year;

  // Clear animation only after the reducer has settled the new season into state.
  // This prevents the static div from briefly flashing the old season during
  // the same render that dispatch fires in.
  useEffect(() => {
    if (!advancingRef.current) return;
    setAnimating(false);
    setAnimPhase('idle');
    setAnimContent(null);
    advancingRef.current = false;
  }, [state.season, state.year]);

  function handleAdvance() {
    if (advancingRef.current || animating) return;
    advancingRef.current = true;
    const vis = SEASON_VISUALS[nextSeason];
    setAnimContent({ ...vis, season: nextSeason, year: nextYear });
    setAnimPhase('rise');
    setAnimating(true);
    setTimeout(() => setAnimPhase('hold'), 400);
    setTimeout(() => setAnimPhase('fall'), 1400);
    setTimeout(() => dispatch({ type: 'ADVANCE' }), 2000);
  }

  const currentVis = SEASON_VISUALS[state.season];

  return (
    <ThemeCtx.Provider value={T}>
    <>
      <style>{SCENARIO.fonts}</style>
      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${T.scrollTrack}; }
        ::-webkit-scrollbar-thumb { background: ${T.scrollThumb}; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: ${T.scrollHover}; }
        @keyframes symbolPulse {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes slideInCard {
          0%   { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInAction {
          0%   { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInModal {
          0%   { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .star-card-enter { animation: slideInCard 0.5s ease-out forwards; }
        .action-card-new { animation: fadeInAction 0.4s ease-out forwards; }
        html, body, #root { height: 100%; margin: 0; padding: 0; overflow: hidden; }
        *, *::before, *::after { box-sizing: border-box; }
      `}</style>

      {showIntro && <IntroScreen onBegin={() => setShowIntro(false)} T={T} />}

      {state.ruined && <RuinScreen state={state} dispatch={dispatch} />}
      {state.won && !state.ruined && <WinScreen state={state} dispatch={dispatch} />}
      {state.obscured && !state.ruined && !state.won && <ObscurityScreen state={state} dispatch={dispatch} />}
      {state.pendingWin && !state.ruined && !state.won && !state.obscured && (
        <WinModal condition={state.pendingWin} dispatch={dispatch} />
      )}
      {state.pendingIntros.length > 0 && !state.ruined && !state.won && !state.obscured && (
        <StarIntroModal starId={state.pendingIntros[0]} stars={state.stars} dispatch={dispatch} />
      )}
      {state.pendingReveal.length > 0 && !state.ruined && !state.won && !state.obscured && (
        <PassionRevealModal revealKey={state.pendingReveal[0]} dispatch={dispatch} />
      )}
      {(state.pendingCohesionEvents?.length ?? 0) > 0 && !state.ruined && !state.won && !state.obscured && !state.pendingIntros.length && !state.pendingReveal.length && (
        <CohesionEventModal event={state.pendingCohesionEvents[0]} dispatch={dispatch} />
      )}
      {state.pendingGuest && !state.ruined && !state.won && !state.obscured && (
        <GuestModal guest={state.pendingGuest} dispatch={dispatch} />
      )}

      {state.pendingChoices.length > 0 && (
        <ConvergenceModal
          event={state.pendingChoices[0]}
          stars={state.stars}
          dispatch={dispatch}
        />
      )}

      <div style={{ background: T.bg, height: '100%', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "'Courier Prime', monospace", transition: 'background 0.35s' }}>

        {/* HEADER */}
        <div style={{ background: T.hdr, borderBottom: `1px solid ${T.bdr}`, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>

          {/* MENU */}
          <HeaderMenu dispatch={dispatch} darkMode={darkMode} setDarkMode={setDarkMode} />

          <div>
            <div style={{ fontSize: T.fsXxs, color: T.inkDim, letterSpacing: T.lsXWide, textTransform: 'uppercase' }}>{`${SCENARIO.paperName} · ${SCENARIO.paperEst}`}</div>
            <div style={{ fontSize: 22, color: SCENARIO.accentColor, fontFamily: "'Playfair Display', serif", fontWeight: 900, letterSpacing: '0.05em', lineHeight: 1 }}>{SCENARIO.gameName}</div>
          </div>
          <div style={{ width: 1, height: 32, background: T.bdr }} />

          {/* SEASON WIDGET */}
          <div style={{ position: 'relative', width: 130, height: 38, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: animating ? 0 : 1, transform: animating ? 'translateY(-6px)' : 'translateY(0)', transition: animating ? 'opacity 0.25s, transform 0.25s' : 'none' }}>
              <div style={{ fontSize: 19, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 700, lineHeight: 1 }}>{state.year}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: T.gapSm, marginTop: 2 }}>
                <span style={{ fontSize: T.fsBase, color: currentVis.color }}>{currentVis.symbol}</span>
                <span style={{ fontSize: T.fsXs, color: T.inkMut, textTransform: 'uppercase', letterSpacing: T.lsNormal }}>{state.season}</span>
              </div>
            </div>
            {animating && animContent && (
              <div style={{ position: 'absolute', inset: 0, opacity: animPhase === 'rise' ? 0 : animPhase === 'hold' ? 1 : 0, transform: animPhase === 'rise' ? 'translateY(10px)' : 'translateY(0)', transition: animPhase === 'rise' ? 'opacity 0.35s, transform 0.35s' : animPhase === 'fall' ? 'opacity 0.5s' : 'none' }}>
                <div style={{ fontSize: 19, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 700, lineHeight: 1 }}>{animContent.year}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: T.gapSm, marginTop: 2 }}>
                  <span style={{ fontSize: T.fsBase, color: animContent.color, display: 'inline-block', animation: animPhase === 'hold' ? 'symbolPulse 0.45s ease-out forwards' : 'none' }}>{animContent.symbol}</span>
                  <span style={{ fontSize: T.fsXs, color: T.inkMut, textTransform: 'uppercase', letterSpacing: T.lsNormal }}>{animContent.season}</span>
                </div>
                <div style={{ fontSize: T.fsXs, color: animContent.color, fontStyle: 'italic', marginTop: 1, fontFamily: "'Playfair Display', serif" }}>{animContent.sub}</div>
              </div>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: T.gapMd }}>
            <button
              onClick={handleAdvance}
              disabled={animating}
              style={{ background: 'transparent', border: '1px solid #c9a14a', color: SCENARIO.accentColor, padding: '6px 14px', fontFamily: "'Courier Prime', monospace", fontSize: T.fsMd, cursor: animating ? 'default' : 'pointer', letterSpacing: T.lsMd, textTransform: 'uppercase', borderRadius: T.radius, opacity: animating ? 0.4 : 1 }}
              onMouseEnter={e => { if (!animating) { e.currentTarget.style.background = SCENARIO.accentColor; e.currentTarget.style.color = T.hdr; }}}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SCENARIO.accentColor; }}>
              {`Advance ${SCENARIO.timeUnitLabel} →`}
            </button>
          </div>
        </div>

        {/* BODY */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* PERSONS */}
          <div style={{ width: 248, borderRight: `1px solid ${T.bdr}`, padding: '14px 10px', overflowY: 'auto', flexShrink: 0, minHeight: 0, background: T.surf }}>
            <div style={{ fontSize: T.fsXxs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: T.lsXWide, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${T.bdr}` }}>{SCENARIO.panelStars}</div>
            {revealed.length > 0 && <CohesionBars stars={state.stars} everShown={state.cohesionEverShown ?? { ally: false, enemy: false }} />}
            {Object.values(state.stars).filter(s => revealed.includes(s.id)).map(s => <StarCard key={s.id} star={s} revealedPassions={state.revealedPassions} />)}
            <HomesteadPanel homesteadLog={state.homesteadLog} />
          </div>

          {/* DECISIONS */}
          <div style={{ width: 320, borderRight: `1px solid ${T.bdr}`, overflowY: 'auto', flexShrink: 0, minHeight: 0, background: T.bg }}>
            <div style={{ padding: '14px 12px 8px', borderBottom: `1px solid ${T.bdr}` }}>
              <div style={{ fontSize: T.fsXxs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: T.lsXWide }}>{SCENARIO.panelDecisions}</div>
            </div>
            {state.pendingGuest && (
              <div style={{ margin: '10px 12px 0', background: T.card, border: `1px solid ${T.bdrHi}`, borderLeft: '3px solid #aa9068', borderRadius: T.radius, padding: T.padCardSm, cursor: 'pointer' }}>
                <div style={{ fontSize: T.fsXxs, color: '#aa9068', textTransform: 'uppercase', letterSpacing: T.lsWide, fontFamily: "'Courier Prime', monospace", marginBottom: 3 }}>⚑ Visitor at the Door</div>
                <div style={{ fontSize: T.fsMd, color: T.inkMid, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{state.pendingGuest.name}</div>
                <div style={{ fontSize: T.fsXs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', marginTop: 2 }}>{state.pendingGuest.role}</div>
              </div>
            )}
            <div style={{ padding: '12px 12px 14px' }}>
              {playable.length === 0 ? (
                <div style={{ border: `1px solid ${T.bdr}`, borderRadius: T.radius, padding: '14px', background: T.surf }}>
                  <div style={{ height: 1, background: T.bdr, marginBottom: 10 }} />
                  <div style={{ fontSize: T.fsXs, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsMd, marginBottom: 6 }}>{state.season}, {state.year}</div>
                  <div style={{ fontSize: 12, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', lineHeight: T.lhRelaxed, marginBottom: 8 }}>Nothing requires your hand this season.</div>
                  <div style={{ fontSize: T.fsMd, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: T.lhLoose }}>Advance the season. What you have set in motion continues whether you attend to it or not.</div>
                  <div style={{ height: 1, background: T.bdr, marginTop: 10 }} />
                </div>
              ) : playable.map(act => (
                <ActionCard key={act.id} act={act} stars={state.stars} dispatch={dispatch} revealed={revealed} revealedPassions={state.revealedPassions} isNew={newThisTurn.has(act.id)} year={state.year} season={state.season} animating={animating} />
              ))}
            </div>
          </div>

          {/* CHRONICLE */}
          <div style={{ flex: 1, padding: '14px 20px', overflowY: 'auto', minHeight: 0, background: T.bg }}>
            <div style={{ fontSize: T.fsXxs, color: T.inkDim, textTransform: 'uppercase', letterSpacing: T.lsXWide, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${T.bdr}` }}>{SCENARIO.chronicleHeader(SCENARIO.paperName)}</div>
            {state.log.length === 0 ? (
              <div style={{ fontSize: T.fsMdLg, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', lineHeight: 1.9 }}>
                {SCENARIO.emptyLedger.split('\n').reduce((acc, line, i, arr) => acc.concat(line, i < arr.length - 1 ? [<br key={'a'+i}/>,<br key={'b'+i}/>] : []), [])}
              </div>
            ) : (() => {
              // Group entries by year+season, preserving log order
              const groupMap = new Map();
              const groupOrder = [];
              for (const entry of state.log) {
                const key = `${entry.year}-${entry.season}`;
                if (!groupMap.has(key)) {
                  groupMap.set(key, { key, year: entry.year, season: entry.season, entries: [] });
                  groupOrder.push(key);
                }
                groupMap.get(key).entries.push(entry);
              }
              const grouped = groupOrder.map(k => groupMap.get(k));
              return grouped.map(group => {
                const isCurrent = group.year === state.year && group.season === state.season;
                const vis = SEASON_VISUALS[group.season];
                return (
                  <div key={group.key} style={{ marginBottom: 28 }}>
                    {/* Season header — renders once per group */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, paddingBottom: 7, borderBottom: `1px solid ${T.bdr}` }}>
                      <span style={{ fontSize: T.fsMd, color: vis.color }}>{vis.symbol}</span>
                      <span style={{ fontSize: T.fsSm, color: T.inkMut, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsMd }}>{group.year}, {group.season}</span>
                      {isCurrent && <span style={{ fontSize: T.fsXxs, color: SCENARIO.accentColor, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: T.lsWide, marginLeft: 'auto' }}>● New</span>}
                    </div>
                    {/* Entries — date row suppressed */}
                    {group.entries.map(entry => (
                      <LogEntry key={entry.id} entry={entry} stars={state.stars} revealed={revealed} revealedPassions={state.revealedPassions} isNew={isCurrent} hideDate={true} />
                    ))}
                  </div>
                );
              });
            })()}
          </div>

        </div>
      </div>
    </>
    </ThemeCtx.Provider>
  );
}
