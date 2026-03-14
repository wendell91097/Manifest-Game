import { useState, useReducer, useRef, useEffect, createContext, useContext } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');`;

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
  return dm ? {
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
  };
}

// ─── FAME / INFAMY SYSTEM ─────────────────────────────────────────────────────
// Fame and Infamy measure political/power relevance — not a permanent ledger,
// but how much you currently register in each Star's world.
//
// Decay: both values degrade each season via  decay = DECAY_BASE * (1 - value/100).
// High values decay slowly (entrenched notoriety has inertia); low values fade fast.
// Any action that touches a Star's fame/infamy resets them back up the slow-decay zone.
//
// Fame-as-buffer: a Star who has publicly vouched for you has skin in the game.
// Ruin checks use the relative gap rule: ruin triggers when infamy ≥ 65 AND fame < infamy × FAME_BUFFER_RATIO.

const DECAY_BASE        = 4;    // max points lost per season (at value 0)
const FAME_BUFFER_RATIO = 0.80; // fame must be ≥ infamy × this to suppress ruin

function decayRate(value) {
  // Returns how many points value will fall this season.
  return DECAY_BASE * (1 - value / 100);
}

// Ruin is suppressed when fame ≥ infamy × FAME_BUFFER_RATIO.
// A Star who has publicly backed you won't burn you while they still have skin in the game.
function isRuinBuffered(star) {
  return star.fame >= star.infamy * FAME_BUFFER_RATIO;
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
    color: '#c87830',
    community: 'The Californio families of the valley and their servants — 47 people whose livelihoods depend on the Vallejo grant.',
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
          0:   'She is watching. No commitment in either direction.',
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
          0:   'She extends neither warmth nor coldness. You are unproven.',
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
          0:   'The coalition takes no position on you.',
          '-15': 'You are discussed, not favorably, at meetings you are not invited to.',
          '-30': 'The coalition treats you as a hostile interest.',
          '-50': 'They organize specifically against your land transactions.',
          '-75': 'Every legal move you make in the valley is contested.',
        },
      },
    },
    fame: 0, infamy: 0,
  },

  solomon: {
    id: 'solomon', name: 'Solomon Reed', role: 'Freedman & Trader',
    color: '#5a8e52',
    community: 'The freedmen, mixed-race families, and independent traders who orbit Reed\'s post — 31 people with no other reliable anchor in the valley.',
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
          0:   'He is cordial. He does not extend trust he hasn\'t tested.',
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
          0:   'He is watching to see which kind of person you are.',
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
          0:   'He holds this close. You are not inside it yet.',
          '-15': 'He stops mentioning Caleb around you.',
          '-30': 'He believes you complicated the search.',
          '-50': 'He holds you responsible for time lost.',
          '-75': 'This is the thing he does not forgive.',
        },
      },
    },
    fame: 0, infamy: 0,
  },

  whitmore: {
    id: 'whitmore', name: 'J.T. Whitmore', role: 'Railroad Surveyor',
    color: '#3e6e9a',
    community: 'The survey crews, company agents, and federal contacts working the northern corridor — 89 people whose livelihoods run through Pacific Railroad.',
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
          0:   'Your land is neither inside nor outside his calculation. Yet.',
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
          0:   'You are useful or you are not. He hasn\'t decided.',
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
          0:   'He gives nothing away. The work is the work.',
          '-15': 'He has stopped writing letters east. The survey crew has noticed the change in him.',
          '-30': 'He takes risks with the survey timeline the company hasn\'t sanctioned. He is trying to finish and go home and it is making him sloppy.',
          '-50': 'He is making commitments he cannot keep. The company will notice before she does.',
          '-75': 'He has stopped mentioning going home. Something has broken in him that the corridor will not fix.',
        },
      },
    },
    fame: 0, infamy: 0,
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
    LL: { label: 'Quiet Stranger',   behavior: "She neither advances nor obstructs you. You have not yet made enough of an impression, in either direction, to register in her accounting." },
  },
  solomon: {
    HH: { label: 'Double-Sided Coin', behavior: "He trades with you but rarely in front of witnesses. Useful, watchful, noncommittal. You are neither inside the circle nor outside it — something more ambiguous than either." },
    HL: { label: 'Good Credit',       behavior: "He routes valuable information your way first and extends terms without being asked. His people treat your name as a reference. The post works with you." },
    LH: { label: 'Shadowed Account',  behavior: "He serves you across the counter but won't be seen standing beside you. Others at the post notice. His name won't appear next to yours in any record that matters." },
    LL: { label: 'Passing Through',   behavior: "Cordial. Transactional. He extends no unusual courtesy and registers no particular caution. You have not yet mattered enough to be trusted or feared." },
  },
  whitmore: {
    HH: { label: 'Useful Enemy',       behavior: "He works against your interests in court while privately respecting your competence. The company knows your name as a complication worth accounting for — which is its own kind of standing." },
    HL: { label: 'Company Man',        behavior: "His legal office treats your filings as friendly. Federal contacts in Sacramento smooth your paperwork without requiring explanation. You are on the right side of the company's ledger." },
    LH: { label: 'Liable Obstruction', behavior: "Survey crews have been briefed on your parcels. Every filing you make draws a counter within the week. The railroad's legal resources are pointed at your land specifically." },
    LL: { label: 'Irrelevant',         behavior: "He neither routes resources toward you nor against you. You have not made enough of an impression on the company's interests to register as either asset or threat." },
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
      { star: 'esperanza', passion: 'land',     delta: +18, why: "A formal survey is the first legal protection the grant has had. It makes dispossession harder." },
      { star: 'esperanza', passion: 'trust',    delta: +12, why: "You acted in her interest without being asked and without asking for anything." },
      { star: 'whitmore',  passion: 'corridor', delta: -14, why: "The documented boundary complicates the corridor survey and legitimizes a competing land claim." },
    ],
    repBonus: [
      { star: 'esperanza', repState: 'HL', extraEffects: [{ star: 'esperanza', passion: 'coalition', delta: +8, why: "Your standing with the families gives the survey more legitimacy than the document alone would carry." }] },
    ],
    fame:   { esperanza: +10, solomon: +5,  whitmore: -5  },
    infamy: { esperanza:   0, solomon:  0,  whitmore: +5  },
    def: {
      years: 7,
      headline: 'VALLEJO GRANT SURVIVES SACRAMENTO TRIBUNAL — Documented boundaries upheld. Competing railroad survey dismissed as defective.',
      body: "Seven years after the original filing, Sacramento's land court ruled in favor of the Vallejo survey record. The railroad's competing plat was struck for irregularities. What had seemed a paper gesture in 1810 held the land in 1817.",
      effects: [
        { star: 'esperanza', passion: 'land',  delta: +15, why: "The court decision is now part of the permanent record." },
        { star: 'whitmore',  passion: 'corridor', delta: -18, why: "The corridor is legally obstructed by the upheld boundary." },
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
      { star: 'solomon', passion: 'autonomy', delta: +8, why: "You accepted a quiet ask without pressing for an explanation. That is the kind of trust he does not take for granted." },
      { star: 'solomon', passion: 'caleb',    delta: +8, why: "The letter was for his brother. He does not know yet whether it will reach him. You made it possible." },
    ],
    fame:   { esperanza: 0, solomon: +3, whitmore: 0 },
    infamy: { esperanza: 0, solomon:  0, whitmore: 0 },
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
      { star: 'whitmore',  passion: 'margaret', delta:  +8, why: "A life with weight here gives him something to describe in letters home. The work is not only exile. He has written more this month than in the previous three." },
      { star: 'esperanza', passion: 'trust',    delta: -10, why: "You socially sponsored the man whose surveys threaten her land. She does not separate the person from the instrument." },
      { star: 'solomon',   passion: 'autonomy', delta:  -6, why: "The railroad's man is now comfortable in the valley. Comfort has a way of becoming permanence." },
    ],
    fame:   { esperanza: -6, solomon: -4, whitmore: +10 },
    infamy: { esperanza: +8, solomon:  0, whitmore:   0 },
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
    id: 'federal_claim', ya: 1811, source: 'whitmore', expires: 1812, msgType: 'Proposal',
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
      { star: 'esperanza', passion: 'trust',    delta: -15, why: "You sided with the federal apparatus against valley interests. She noticed." },
      { star: 'esperanza', passion: 'land',     delta: -10, why: "The corridor filing encroaches on the grant's northern boundary." },
      { star: 'whitmore',  passion: 'margaret', delta:  -5, why: "Helping the railroad is helping the machine. He is grateful but it deepens the trench." },
    ],
    fame:   { esperanza: -5, solomon:  0, whitmore: +12 },
    infamy: { esperanza:  0, solomon: +8, whitmore:   0 },
    def: {
      years: 9,
      headline: 'NORTHERN CORRIDOR DECLARED FEDERAL LAND — Old grant claims extinguished. Railroad holds clear title.',
      body: "Nine years after the original filing, Washington's ruling is final. The corridor is federal. Every claim predating the 1811 joint filing is now void. What the settler's signature enabled in a single morning took nearly a decade to be fully understood.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: +20, why: "The company awarded him the credit for delivering the corridor." },
        { star: 'esperanza', passion: 'land',     delta: -25, why: "The federal ruling directly voids portions of the Vallejo grant." },
        { star: 'solomon',   passion: 'autonomy', delta: -20, why: "The federal presence in the valley is now permanent." },
      ],
    },
    inaction: {
      headline: 'FEDERAL CORRIDOR FILING STALLS — Railroad unable to secure local co-signature for northern route claim.',
      body: "Pacific Railroad's proposed federal filing for the northern corridor has been set aside for want of a credible local co-signatory. J.T. Whitmore has not commented publicly. The valley road is quiet, for now.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: -8,  why: "He was sent here to secure local signatures. He did not." },
        { star: 'esperanza', passion: 'trust',    delta: +6,  why: "You did not lend your name to the railroad's filing. She noticed the absence." },
      ],
    },
  },
  {
    id: 'lend_solomon', ya: 1812, source: 'solomon', msgType: 'Request',
    dispatch: "Back Solomon's Warehouse with a Private Loan",
    desc: "Solomon needs capital for the new warehouse but wants no federal paper trail. You can extend a private note — no government strings, no Pacific Railroad bank, no record that anyone else can touch. He has asked no one else. He will not ask twice.",
    result: "REED'S TRADING POST EXPANDS — Private investment backs new warehouse construction on valley road.",
    resultBody: "Solomon Reed broke ground this week on a substantial warehouse addition to his trading post on the valley road. The project is privately financed. Reed would not name the backer. Whitmore's survey crew was observed marking the adjacent road corridor the same afternoon.",
    bodyHidden:  "Solomon Reed broke ground this week on a substantial warehouse addition to his trading post on the valley road. The project is privately financed. Reed would not name the backer. A survey crew was observed marking the adjacent road corridor the same afternoon. Their employer's name was not given to this paper.",
    effects: [
      { star: 'solomon', passion: 'roots',    delta: +22, why: "The warehouse makes his presence in the valley harder to uproot." },
      { star: 'solomon', passion: 'autonomy', delta: +10, why: "A private loan with no federal strings is exactly the kind of help he can accept." },
      { star: 'solomon', passion: 'caleb',    delta:  +5, why: "A stable base gives Caleb somewhere to come back to." },
      { star: 'whitmore',passion: 'standing', delta:  -8, why: "A thriving independent post complicates the railroad's commercial ambitions in the valley." },
    ],
    fame:   { esperanza: +5, solomon: +14, whitmore:  0 },
    infamy: { esperanza:  0, solomon:   0, whitmore: +5 },
    def: {
      years: 6,
      headline: "REED'S POST NAMED COUNTY'S LEADING TRADING HUB — Warehouse expansion draws commerce from three counties.",
      body: "Six years after the expansion, Solomon Reed's post has become the valley's commercial anchor. Whitmore's planned company depot at the same junction was never built. The private loan has paid back in ways that cannot be counted in coin.",
      effects: [
        { star: 'solomon',  passion: 'roots',   delta: +18, why: "The post is now too established to displace quietly." },
        { star: 'whitmore', passion: 'corridor', delta: -8, why: "The commercial corridor bypasses the railroad's preferred path." },
      ],
    },
  },
  {
    id: 'testify_whitmore', ya: 1813, source: 'whitmore', expires: 1814, msgType: 'Demand',
    moral: '"In the mouth of two or three witnesses shall every word be established." — 2 Corinthians 13:1',
    dispatch: "Give Sworn Testimony for Whitmore in Land Court",
    desc: "Whitmore's land case hinges on a credible local witness. He needs someone who can say under oath that they saw the survey markers, that the route was established. Render unto Caesar what is Caesar's — but a false oath is a different matter than a true one. Your word carries weight precisely because it is not yet spent.",
    result: "SETTLER TESTIFIES FOR RAILROAD IN DISPUTED SURVEY CASE — Sworn statement validates Pacific Railroad corridor claim.",
    resultBody: "A local landholder provided sworn testimony this week in the Sacramento land tribunal, affirming the validity of Pacific Railroad's northern survey. Esperanza Vallejo, present in the gallery, departed before the reading was concluded. The case continues.",
    effects: [
      { star: 'whitmore',  passion: 'corridor', delta: +18, why: "Your testimony is the credible local corroboration the case needed." },
      { star: 'whitmore',  passion: 'standing', delta: +15, why: "He delivered a witness. The company pays attention to that." },
      { star: 'esperanza', passion: 'trust',    delta: -25, why: "She was in the room when you testified. There is no interpretation that spares you." },
      { star: 'esperanza', passion: 'land',     delta: -18, why: "Your testimony directly supports the claim that threatens the grant." },
      { star: 'solomon',   passion: 'autonomy', delta: -10, why: "You participated in the federal legal system against valley interests. He did not miss it." },
      { star: 'whitmore',  passion: 'margaret', delta: +10, why: "You came when he needed someone to stand with him. That is not nothing, whatever your reasons." },
    ],
    repBonus: [
      { star: 'whitmore', repState: 'HL', extraEffects: [{ star: 'whitmore', passion: 'standing', delta: +8, why: "Your existing reputation with the company amplifies the value of your word. He can point to a track record." }] },
    ],
    fame:   { esperanza: -12, solomon: -6, whitmore: +16 },
    infamy: { esperanza: +14, solomon:  0, whitmore:   0 },
    def: {
      years: 4,
      headline: 'TRIBUNAL VERDICT FINAL: RAILROAD PREVAILS — Settler testimony cited as decisive. Disputed parcels awarded.',
      body: "Four years after the testimony, Sacramento's ruling is entered into the record. The disputed parcels pass to railroad title. The judge cited the local witness account as the deciding evidence. Esperanza Vallejo has not spoken to the settler since the day of testimony.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: +25, why: "He won the case. The company made him a district supervisor." },
        { star: 'esperanza', passion: 'land',     delta: -30, why: "The ruling extinguishes the disputed parcels. She lost them in court, with your help." },
      ],
    },
    inaction: {
      headline: 'RAILROAD SURVEY CASE WEAKENED — Local witness declines to appear. Tribunal questions corridor claim.',
      body: "Pacific Railroad's land tribunal case has been significantly weakened after an expected local witness did not appear to give testimony. J.T. Whitmore requested a continuance. The disputed parcels remain in question. The case continues without the corroboration he had anticipated.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: -12, why: "The case faltered without the local witness he promised the company he could deliver." },
        { star: 'whitmore',  passion: 'corridor', delta: -8,  why: "The corridor claim is legally weakened without sworn corroboration." },
        { star: 'esperanza', passion: 'land',     delta: +10, why: "The disputed parcels were not awarded. The threat recedes, for now." },
        { star: 'esperanza', passion: 'trust',    delta: +8,  why: "You were asked to testify against her interests. You did not come." },
      ],
    },
  },
  {
    id: 'find_brother', ya: 1814, source: 'solomon', msgType: 'Appeal', requiresPassionVisible: { star: 'solomon', passion: 'caleb' },
    dispatch: "Use Your Contacts to Search for Caleb Reed",
    desc: "Solomon has asked nothing of you. But you have riders and contacts across the territories and he does not. You can put word out carefully — staying off federal record, avoiding anything that draws official attention. This will cost you time, favors, and some exposure you cannot fully control.",
    result: "CALEB REED SOUGHT IN NEVADA TERRITORY — Valley merchant's brother believed to be in Comstock district.",
    resultBody: "Inquiries conducted through private channels have placed Caleb Reed, brother of Solomon Reed of this valley, in the vicinity of the Comstock silver district. The search was conducted outside federal record at the family's request. No further details at this time.",
    effects: [
      { star: 'solomon', passion: 'caleb',    delta: +28, why: "You put real effort into finding someone he had given up finding on his own." },
      { star: 'solomon', passion: 'roots',    delta:  +8, why: "The fact that someone worked for his family's benefit matters." },
      { star: 'solomon', passion: 'autonomy', delta: +12, why: "You did this outside federal channels, the way he needed it done." },
    ],
    fame:   { esperanza: 0, solomon: +16, whitmore: 0 },
    infamy: { esperanza: 0, solomon:   0, whitmore: 0 },
    def: {
      years: 3,
      headline: 'CALEB REED FOUND ALIVE IN COMSTOCK — Brother of valley merchant located after three years.',
      body: "Three years after the search began, Caleb Reed has been found working a claim near Virginia City. He is alive and in reasonable health. Solomon Reed received the news at his post and closed the store for the remainder of the day. The search succeeded because it was conducted quietly.",
      effects: [
        { star: 'solomon', passion: 'caleb',    delta: +35, why: "Caleb is found. Solomon knows who made that possible." },
        { star: 'solomon', passion: 'roots',    delta: +15, why: "His brother coming back changes what the valley means to him." },
        { star: 'solomon', passion: 'autonomy', delta:  -8, why: "Caleb's arrival draws some outside attention he hadn't planned for." },
      ],
    },
  },
  {
    id: 'water_rights', ya: 1815, source: 'whitmore', msgType: 'Offer',
    moral: '"The earth is the LORD\'s, and the fulness thereof; the world, and they that dwell therein." — Psalm 24:1',
    dispatch: "Sell the Creek Easements to Pacific Railroad",
    desc: "Whitmore's company has made a substantial offer for the water rights over the creek corridor. The money is real. The valley farms that depend on that water for irrigation are also real. You can have the money or the valley can have the water. You cannot arrange both.",
    result: "CREEK CORRIDOR WATER RIGHTS SOLD TO PACIFIC RAILROAD — Valley easements transferred in private transaction.",
    resultBody: "Pacific Railroad has acquired the water rights to the upper creek corridor in a transaction concluded this month. Esperanza Vallejo called the sale 'a theft wearing a deed.' Farmers downstream have begun inquiring about alternative water sources.",
    effects: [
      { star: 'whitmore',  passion: 'corridor', delta: +25, why: "The creek corridor is now cleared for grading. The route is materially closer to complete." },
      { star: 'whitmore',  passion: 'standing', delta: +12, why: "Acquiring the water rights was his assignment. He delivered." },
      { star: 'esperanza', passion: 'land',     delta: -22, why: "Valley water rights are inseparable from land security. You sold them." },
      { star: 'esperanza', passion: 'trust',    delta: -18, why: "You chose the railroad's money over the valley's water. In her accounting, that is definitive." },
      { star: 'solomon',   passion: 'roots',    delta: -15, why: "A valley without reliable water is a valley that cannot sustain what he has built." },
      { star: 'whitmore',  passion: 'margaret', delta:  -8, why: "You helped him deliver the assignment. Neither of you spoke of what delivering it costs him." },
    ],
    fame:   { esperanza: -14, solomon: -8, whitmore: +18 },
    infamy: { esperanza: +16, solomon: +8, whitmore:   0 },
    def: {
      years: 8,
      headline: 'RAIL LINE REACHES SHASTA — Creek corridor complete. Valley farms report third consecutive year of irrigation failure.',
      body: "Eight years after the easement sale, the railroad's northern line has reached Shasta. Three farms in the lower valley have been abandoned this season for want of water. The money spent well. The valley spent harder.",
      effects: [
        { star: 'whitmore',  passion: 'standing', delta: +30, why: "Delivering the Shasta line made his career." },
        { star: 'esperanza', passion: 'land',     delta: -35, why: "Three abandoned farms near the grant have been absorbed by railroad land claims." },
        { star: 'solomon',   passion: 'roots',    delta: -15, why: "The commercial ecosystem his post depended on is contracting." },
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
      { star: 'esperanza', passion: 'coalition', delta: +22, why: "A meeting that actually happened, in a safe venue, with the right families present." },
      { star: 'esperanza', passion: 'trust',     delta: +10, why: "You created conditions for her community to organize. That counts." },
      { star: 'solomon',   passion: 'roots',     delta:  +8, why: "The post has become a place of consequence. He understands the value of that." },
      { star: 'solomon',   passion: 'autonomy',  delta: -15, why: "The political exposure you created will follow him. Whitmore filed an inquiry the same week." },
      { star: 'whitmore',  passion: 'corridor',  delta: -18, why: "A coordinated coalition is precisely what he was sent here to prevent." },
    ],
    fame:   { esperanza: +12, solomon: +8, whitmore: -10 },
    infamy: { esperanza:   0, solomon:  0, whitmore: +10 },
    def: {
      years: 5,
      headline: 'CALIFORNIO COALITION FILES SUIT IN SACRAMENTO — Coordinated legal challenge targets railroad survey practices.',
      body: "Five years after the valley meeting, the coalition has filed a coordinated legal challenge against Pacific Railroad's survey methodology. Eight families are named as plaintiffs. The meeting you hosted in 1817 is now a lawsuit.",
      effects: [
        { star: 'esperanza', passion: 'land',      delta: +20, why: "The lawsuit has suspended railroad action on the disputed parcels." },
        { star: 'whitmore',  passion: 'corridor',  delta: -22, why: "The litigation has halted the northern corridor for at least a season." },
        { star: 'solomon',   passion: 'autonomy',  delta: -12, why: "The inquiry Whitmore filed in 1817 is now a deposition request." },
      ],
    },
  },
  {
    id: 'report_trespass', ya: 1818, source: 'esperanza', expires: 1819, msgType: 'Appeal',
    dispatch: "File a Formal Trespass Complaint Against the Railroad",
    desc: "Whitmore's survey crew has crossed the Vallejo parcel without legal authorization, again. You can file a formal complaint with the territorial magistrate. Bearing false witness is a sin; so is silence in the face of wrong. He will not forget the name on the filing — but you will know what you did and did not do.",
    result: "TRESPASS COMPLAINT FILED AGAINST PACIFIC RAILROAD — Settler charges survey crew with unlawful entry on Vallejo parcel.",
    resultBody: "A formal trespass complaint has been filed with the territorial magistrate against Pacific Railroad survey personnel, alleging unlawful entry on the Vallejo parcel. J.T. Whitmore dismissed the filing as 'a nuisance action by a landowner with no standing.' The complaint has been accepted for review.",
    effects: [
      { star: 'esperanza', passion: 'land',     delta: +14, why: "The complaint creates a legal record of unauthorized survey entry." },
      { star: 'esperanza', passion: 'trust',    delta: +15, why: "You filed against the railroad on her land's behalf, at cost to yourself." },
      { star: 'whitmore',  passion: 'corridor', delta: -14, why: "The complaint delays survey work on the parcel." },
      { star: 'whitmore',  passion: 'standing', delta: -10, why: "His crew was named in a public filing. The company noticed." },
    ],
    fame:   { esperanza: +14, solomon: +6, whitmore: -12 },
    infamy: { esperanza:   0, solomon:  0, whitmore: +12 },
    def: null,
    inaction: {
      headline: 'RAILROAD SURVEY CREWS CONTINUE UNCHALLENGED ON VALLEJO PARCEL — No complaint filed. Work proceeds.',
      body: "Pacific Railroad survey personnel have continued operations on the Vallejo parcel without formal challenge. Esperanza Vallejo had sought a trespass filing. None was made. Whitmore's crew finished the season's marking work before the first snow.",
      effects: [
        { star: 'esperanza', passion: 'trust',    delta: -12, why: "She came to you with a specific ask. You said nothing." },
        { star: 'esperanza', passion: 'land',     delta: -8,  why: "No legal record of unauthorized entry. The crews continue." },
        { star: 'whitmore',  passion: 'corridor', delta: +6,  why: "Unchallenged survey progress. The season's marking work is complete." },
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
      { star: 'solomon', passion: 'roots',    delta: +14, why: "Two Reeds in the valley is harder to uproot than one." },
      { star: 'solomon', passion: 'autonomy', delta:  -8, why: "You spent social capital on his behalf. He is now, in some sense, obligated. He knows it and doesn't entirely like it." },
    ],
    fame:   { esperanza: 0, solomon: +18, whitmore: 0 },
    infamy: { esperanza: 0, solomon:   0, whitmore: 0 },
    def: {
      years: 4,
      headline: "REED BROTHERS EXPAND — New trading company formally registered. Valley's largest independent merchant concern.",
      body: "Four years after Caleb's arrival, the Reed brothers have incorporated under territorial law. Solomon manages the post; Caleb runs the Nevada routes. The introduction cost you standing at the Merchant's Association. It built something that will outlast the railroad's corridor planning.",
      effects: [
        { star: 'solomon',  passion: 'roots',   delta: +25, why: "The incorporated company is now a permanent valley institution." },
        { star: 'whitmore', passion: 'corridor', delta: -12, why: "An independent trading company of this scale complicates railroad commerce claims in the corridor." },
      ],
    },
  },
  {
    id: 'deed_esperanza', ya: 1820, source: 'esperanza', expires: 1822, msgType: 'Request',
    dispatch: "Help Esperanza Secure the Deed in Her Own Name",
    desc: "The Vallejo grant is held under her late father's estate. She cannot navigate the territorial recorder's office without an Anglo intermediary — the law, in practice, requires one. You can serve that function. It is a half-day's work and it will bind you to her cause in ways that are not undone by subsequent choices.",
    result: "VALLEJO LAND GRANT RE-RECORDED UNDER ESPERANZA VALLEJO — Old Californio claim formally transferred to surviving heir.",
    resultBody: "The Vallejo land grant has been re-recorded in the name of Esperanza Vallejo following action at the territorial recorder's office. A local settler is noted as the filing intermediary. The grant is now formally held in a living name for the first time in fourteen years. Whitmore has been informed.",
    effects: [
      { star: 'esperanza', passion: 'land',      delta: +28, why: "The grant is now held in a living name that can actively defend it in court." },
      { star: 'esperanza', passion: 'trust',     delta: +22, why: "You navigated a system that is designed to exclude her, on her behalf. She will not forget." },
      { star: 'esperanza', passion: 'coalition', delta: +14, why: "Her secure title gives the coalition a concrete legal anchor." },
      { star: 'whitmore',  passion: 'corridor',  delta: -24, why: "A title in a living name both strengthens the boundary against encroachment and is far harder to challenge in court." },
    ],
    repBonus: [
      { star: 'esperanza', repState: 'HH', extraEffects: [{ star: 'esperanza', passion: 'trust', delta: +10, why: "Given the complicated history between you, this action lands differently. She did not expect it and says so." }] },
    ],
    fame:   { esperanza: +22, solomon: +6, whitmore: -16 },
    infamy: { esperanza:   0, solomon:  0, whitmore: +16 },
    def: {
      years: 6,
      headline: "VALLEJO DEED UPHELD AGAINST RAILROAD CHALLENGE — Court affirms Californio heir's title. Railroad appeal denied.",
      body: "Six years after the re-recording, Pacific Railroad's legal challenge to the Vallejo title has been denied at final appeal. The grant stands. Esperanza Vallejo's name is in the record and will remain there. The intermediary who made the filing possible was not mentioned in the court's opinion. They did not need to be.",
      effects: [
        { star: 'esperanza', passion: 'land',      delta: +25, why: "Final appeal denial. The title is permanent." },
        { star: 'whitmore',  passion: 'corridor',  delta: -20, why: "The corridor's northern segment is now legally obstructed by an unassailable claim." },
        { star: 'esperanza', passion: 'coalition', delta: +18, why: "A won case is more valuable to the coalition than any amount of organizing." },
      ],
    },
    inaction: {
      headline: 'VALLEJO DEED REMAINS IN ESTATE LIMBO — Re-recording effort abandoned. Title legally vulnerable.',
      body: "Efforts to re-record the Vallejo land grant under a living name have not proceeded. The title remains held under the original estate filing. Territorial law does not require the error to be corrected. Pacific Railroad's attorneys are aware of the situation.",
      effects: [
        { star: 'esperanza', passion: 'land',      delta: -15, why: "A title in estate limbo cannot actively defend itself in court. The vulnerability is known." },
        { star: 'esperanza', passion: 'trust',     delta: -14, why: "She needed an intermediary. The law required one. You did not come." },
        { star: 'esperanza', passion: 'coalition', delta: -8,  why: "The coalition needed a secured title as its legal anchor. It did not materialize." },
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
      { star: 'esperanza', passion: 'trust',     delta: +22, why: "A public declaration is not the same as undoing the damage. But it is a formal record, and she knows the cost." },
      { star: 'esperanza', passion: 'coalition', delta: +10, why: "The coalition treats a public Anglo declaration as a meaningful shift in the political landscape." },
      { star: 'whitmore',  passion: 'corridor',  delta: -14, why: "A declaration of this kind directly complicates the corridor's legal position." },
      { star: 'whitmore',  passion: 'standing',  delta:  -8, why: "The company will note your reversal. Whitmore answers for the people he recommended." },
    ],
    fame:   { esperanza: +14, solomon: +6, whitmore: -10 },
    infamy: { esperanza:  -8, solomon:  0, whitmore: +10 },
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
      { star: 'whitmore', passion: 'corridor', delta: -12, why: "Losing a co-filer complicates the corridor's commercial claims." },
      { star: 'whitmore', passion: 'standing', delta:  -8, why: "He vouched for you. Your reversal reflects on him. The company will notice." },
    ],
    fame:   { esperanza: +6, solomon: +12, whitmore:  -8 },
    infamy: { esperanza:  0, solomon:  -6, whitmore:  +8 },
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
      { star: 'whitmore',  passion: 'standing', delta: +25, why: "The audit resolved in his favor. His position in the company is restored." },
      { star: 'whitmore',  passion: 'corridor', delta: +10, why: "With the audit cleared, survey work resumes at full pace." },
      { star: 'esperanza', passion: 'trust',    delta: -16, why: "You handed Whitmore the evidence that protects the railroad. She knows what that means for the valley." },
      { star: 'esperanza', passion: 'land',     delta: -10, why: "A restored Whitmore is a more effective adversary against the grant." },
    ],
    fame:   { esperanza: -8, solomon: 0, whitmore: +16 },
    infamy: { esperanza: +8, solomon: 0, whitmore:   0 },
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
      { star: 'esperanza', passion: 'trust',     delta: -35, why: "She gave you those records for one purpose. What you did with them is a kind of theft that cannot be undone." },
      { star: 'esperanza', passion: 'coalition', delta: -20, why: "Coalition members who learn how the records were used hold her responsible for the exposure." },
      { star: 'solomon',   passion: 'autonomy',  delta: -10, why: "Using someone's trust as a legal instrument without their knowledge is the kind of thing he files and doesn't forgive." },
    ],
    fame:   { esperanza: -16, solomon: -8, whitmore: +6 },
    infamy: { esperanza: +20, solomon: +8, whitmore:  0 },
    def: null,
  },
  {
    id: 'call_solomon_loan', ya: 1824, source: 'solomon', msgType: 'Claim',
    requiresPassionAbove: { star: 'solomon', passion: 'roots', threshold: 45 },
    dispatch: "Demand Public Repayment of the Warehouse Loan",
    desc: "The private note on Solomon's warehouse expansion is yours to call in whenever you choose. Demanding repayment publicly — through the territorial bank rather than privately, as the agreement specified — turns a private debt into a public instrument. The money will come. Solomon built his entire operation by staying off the federal record. You are about to put him onto it.",
    result: "REED'S TRADING POST DEBT CALLED — Private warehouse note enters public territorial record.",
    resultBody: "A private loan note backing the expansion of Reed's Trading Post has been formally called for repayment through the territorial bank. Solomon Reed is expected to meet the obligation. He declined to comment. The loan's terms, previously unrecorded, are now a matter of public record.",
    effects: [
      { star: 'solomon', passion: 'roots',    delta: -25, why: "Calling the note publicly puts his most important holding into a federal record he spent years keeping it out of." },
      { star: 'solomon', passion: 'autonomy', delta: -20, why: "A private arrangement made public against his wishes is a violation he will not separate from the person who did it." },
      { star: 'solomon', passion: 'caleb',    delta: -10, why: "Caleb's future at the post is now entangled with a federal debt record he didn't choose." },
    ],
    fame:   { esperanza: -6, solomon: -20, whitmore: +8 },
    infamy: { esperanza: +6, solomon: +22, whitmore:  0 },
    def: null,
  },
];

// ─── QUIET SEASONS ────────────────────────────────────────────────────────────
const QUIET_SEASONS_BY_SEASON = {
  Spring: [
    { h: "SPRING PASSES WITHOUT INCIDENT",       b: "The valley road is muddy with snowmelt. No surveys are filed. No court dates are pending. You spend three weeks repairing fences and attending to correspondence that requires nothing of consequence." },
    { h: "A QUIET SPRING ON THE LAND",            b: "The rains come and go without consequence. No riders arrive with letters. No surveyors on the road. You note the absence of urgency and are not sure what to make of it." },
  ],
  Summer: [
    { h: "A QUIET SUMMER IN THE VALLEY",          b: "The heat comes early and stays. Whitmore's crew is not seen on the roads this month. Solomon's post is busy with travelers. You have time to think, which is its own kind of discomfort." },
    { h: "MIDSUMMER — NO WORD FROM THE TERRITORY", b: "Nothing arrives by stage or rider that requires action. The valley bakes. You watch the road and wait for something that does not come." },
  ],
  Autumn: [
    { h: "AUTUMN: NO WORD FROM SACRAMENTO",       b: "The leaves turn. The stage brings no letters requiring action. You attend a dinner at the Merchant's Association and say nothing of consequence to anyone." },
    { h: "A STILL AUTUMN IN THE VALLEY",          b: "The harvest moves without incident. No filings, no summons, no visitors at the door. The quiet accumulates like sediment." },
  ],
  Winter: [
    { h: "WINTER CLOSES THE PASSES",              b: "Snow on the northern route. Survey work is halted. Nothing needs to be done. You wait and watch the deferred things accumulate." },
    { h: "WINTER — THE ROAD GOES QUIET",          b: "Nothing moves through the valley that wasn't already moving. You tend to small obligations and wait for the ground to thaw." },
  ],
};
const QUIET_SEASONS_GENERIC = [
  { h: "THE SEASON OFFERS NOTHING TO DECIDE",   b: "There are days when history moves without you. This appears to be one of them. The valley persists. The people in it persist. You note the quiet and are not certain whether to be grateful or suspicious." },
  { h: "QUIET WEEKS ON THE LAND",               b: "No summons. No surveyors. No letters requiring a signature. The work of the land goes on. You begin to suspect the calm." },
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
  if (avg >= 30)  return { label: 'Trusted Ally',       col: '#8aae42' };
  if (avg >= 15)  return { label: 'Cautious Friend',    col: '#9aae52' };
  if (avg > -15)  return { label: 'Known Acquaintance', col: '#8a8060' };
  if (avg > -30)  return { label: 'Wary Stranger',      col: '#be8040' };
  if (avg > -50)  return { label: 'Open Opponent',      col: '#be6030' };
  if (avg > -75)  return { label: 'Active Adversary',   col: '#be3820' };
  return              { label: 'Sworn Enemy',           col: '#9e1a10' };
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

// ─── PASSION REVEAL DIALOGUES ─────────────────────────────────────────────────
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
    headline: 'VALLEJO FILES FORMAL COMPLAINT — Settler named in public land dispute.',
    body: "Esperanza Vallejo has filed a formal complaint with the territorial court naming a local landholder as party to disputed boundary claims. She cited a pattern of actions working against Californio land interests. The filing is now public record.",
    effects: [
      { star: 'esperanza', passion: 'land', delta: +8, why: "Filing publicly shifts legal ground in her favor." },
    ],
    fameEffects:   { esperanza: 0, solomon: 0, whitmore: 0 },
    infamyEffects: { esperanza: +20, solomon: +5, whitmore: -5 },
    unlocksActions: [],
    isNegative: true,
  },
  {
    id: 're_esperanza_trust_ally',
    star: 'esperanza', passion: 'trust', threshold: 50, direction: 'above',
    headline: 'VALLEJO OPENS COALITION ARCHIVE — Settler granted access to Californio land records.',
    body: "Esperanza Vallejo has granted a local settler access to the coalition's private land archive — the first Anglo to be so trusted. The records document boundary claims predating American annexation. What is done with them is yet to be seen.",
    effects: [],
    fameEffects:   { esperanza: +10, solomon: +5, whitmore: 0 },
    infamyEffects: { esperanza: 0, solomon: 0, whitmore: 0 },
    unlocksActions: ['archive_leverage', 'archive_share'],
    isNegative: false,
  },
  {
    id: 're_solomon_autonomy_hostile',
    star: 'solomon', passion: 'autonomy', threshold: -50, direction: 'below',
    headline: "REED'S POST RESTRICTS CERTAIN ACCOUNTS — Trader quietly closes access to known railroad associates.",
    body: "Solomon Reed has quietly stopped doing business with several valley landholders, citing concerns about federal entanglement. He did not publish a list. He did not need to. People who trade at the post know who is no longer welcome.",
    effects: [],
    fameEffects:   { esperanza: 0, solomon: 0, whitmore: 0 },
    infamyEffects: { esperanza: 0, solomon: +15, whitmore: 0 },
    unlocksActions: [],
    isNegative: true,
  },
  {
    id: 're_solomon_caleb_found',
    star: 'solomon', passion: 'caleb', threshold: 50, direction: 'above',
    headline: "CALEB REED RETURNS TO THE VALLEY — Freedman's brother arrives with Nevada contacts.",
    body: "Solomon Reed has word that his brother Caleb is alive and located in the Nevada silver territory — and that he knows men who move money outside federal channels. The contacts exist. Solomon is not yet sharing them freely, but for the right person, the door is open.",
    effects: [],
    fameEffects:   { esperanza: 0, solomon: +8, whitmore: 0 },
    infamyEffects: { esperanza: 0, solomon: 0, whitmore: 0 },
    unlocksActions: ['nevada_contacts'],
    isNegative: false,
  },
  {
    id: 're_whitmore_standing_promoted',
    star: 'whitmore', passion: 'standing', threshold: 75, direction: 'above',
    headline: 'WHITMORE NAMED DISTRICT SUPERVISOR — Pacific Railroad elevates northern corridor lead.',
    body: "J.T. Whitmore has been named District Supervisor for the northern corridor, bringing with him full company authority over land filings in the valley. His promotion is a direct consequence of his progress here. The company now acts through him with considerably more force.",
    effects: [
      { star: 'whitmore', passion: 'corridor', delta: +15, why: "Supervisory authority expands his ability to suppress competing claims." },
    ],
    fameEffects:   { esperanza: 0, solomon: 0, whitmore: +15 },
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
    infamyEffects: { esperanza: 0, solomon: 0, whitmore: +6 },
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
      { star: 'esperanza', passion: 'coalition', delta: +15, why: "Using the records publicly affirms the coalition's strategy." },
      { star: 'whitmore',  passion: 'corridor',  delta: -25, why: "Pre-annexation records are the most dangerous thing the railroad's surveyors can face." },
      { star: 'whitmore',  passion: 'standing',  delta: -12, why: "The company will hold him responsible for this exposure." },
    ],
    fame:   { esperanza: +14, solomon: +5, whitmore: -18 },
    infamy: { esperanza:  0,  solomon:  0, whitmore: +18 },
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
      { star: 'solomon',   passion: 'roots',    delta: +18, why: "Documents that legitimize Californio claims also protect his post's adjacent land." },
      { star: 'solomon',   passion: 'autonomy', delta: +10, why: "Information this valuable, obtained outside federal channels, is exactly what he values." },
      { star: 'esperanza', passion: 'trust',    delta: +12, why: "You trusted her records to someone she hasn't fully vetted. She notices, ambivalently." },
      { star: 'esperanza', passion: 'coalition',delta:  -8, why: "Coalition documents outside coalition control is not what she intended." },
    ],
    fame:   { esperanza: +5, solomon: +14, whitmore: 0 },
    infamy: { esperanza: +5, solomon:   0, whitmore: 0 },
    def: null,
  },
  {
    id: 'nevada_contacts',
    source: 'solomon',
    msgType: 'Opportunity',
    dispatch: "Meet Caleb's Nevada Contacts Outside Federal Record",
    desc: "The men Caleb knows move silver, information, and influence through channels that don't appear in any federal register. A meeting — arranged quietly, off the valley road — could open possibilities that the official economy cannot.",
    result: "SETTLER MEETS WITH NEVADA INTERESTS — Private arrangement concluded outside territorial record.",
    resultBody: "A discreet meeting between a local settler and associates of Caleb Reed was concluded this week at an undisclosed location. No record was filed. No names were published. The valley road trading post was busy the same afternoon.",
    effects: [
      { star: 'solomon', passion: 'roots',    delta: +12, why: "A settler plugged into his brother's network is a settler with skin in Solomon's game." },
      { star: 'solomon', passion: 'autonomy', delta: +15, why: "Operating outside federal record together creates a kind of trust that legal dealings cannot." },
      { star: 'whitmore', passion: 'standing', delta: -10, why: "Off-record commerce in his corridor is a problem he will eventually be held accountable for." },
    ],
    fame:   { esperanza: +5, solomon: +16, whitmore: -8 },
    infamy: { esperanza:  0, solomon:   0, whitmore: +8 },
    def: null,
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
          { star: 'esperanza', passion: 'land',     delta: +22, why: "Your statement gives the survey legal standing it didn't have on its own." },
          { star: 'esperanza', passion: 'trust',    delta: +18, why: "When it came to a direct choice, you chose her." },
          { star: 'whitmore',  passion: 'corridor', delta: -20, why: "The statement directly obstructs his filing." },
          { star: 'whitmore',  passion: 'standing', delta: -15, why: "Losing a local ally publicly is a failure the company will notice." },
        ],
        fameEffects:   { esperanza: +18, solomon: +8, whitmore: -14 },
        infamyEffects: { esperanza:   0, solomon:  0, whitmore: +14 },
      },
      {
        id: 'side_whitmore',
        label: "Stand with Whitmore — the federal filing supersedes the old grant",
        desc: "You confirm that the federal filing is the controlling document. You have seen the survey. You believe the corridor is legitimate. Esperanza will hear what you said within the week.",
        effects: [
          { star: 'whitmore',  passion: 'corridor', delta: +22, why: "Your confirmation shores up the filing's local legitimacy." },
          { star: 'whitmore',  passion: 'standing', delta: +15, why: "He delivered a local endorsement under pressure. The company approves." },
          { star: 'esperanza', passion: 'trust',    delta: -28, why: "Direct opposition at the moment of confrontation. She will not forget." },
          { star: 'esperanza', passion: 'land',     delta: -18, why: "Your confirmation weakens the survey's legal position." },
        ],
        fameEffects:   { esperanza: -16, solomon: -8, whitmore: +18 },
        infamyEffects: { esperanza: +18, solomon:  0, whitmore:   0 },
      },
      {
        id: 'side_neither',
        label: "Refuse to take a position — let the court decide",
        desc: "You tell both parties that the matter belongs before a judge. You will not add your name to either filing. You will not appear at the tribunal. Both will resent your absence. Neither will forgive the neutrality.",
        effects: [
          { star: 'esperanza', passion: 'trust',    delta: -12, why: "Neutrality at the moment she needed support reads as abandonment." },
          { star: 'whitmore',  passion: 'standing', delta:  -8, why: "He expected you to deliver. You didn't show." },
        ],
        fameEffects:   { esperanza: -8, solomon: 0, whitmore: -8 },
        infamyEffects: { esperanza:  8, solomon: 0, whitmore:  8 },
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
          { star: 'solomon',   passion: 'autonomy',  delta: +18, why: "Coalition legal cover is exactly the kind of protection he couldn't build alone." },
          { star: 'solomon',   passion: 'roots',     delta: +12, why: "An alliance this useful makes the post harder to uproot." },
          { star: 'whitmore',  passion: 'corridor',  delta: -20, why: "A coordinated Californio-freedmen alliance is his worst outcome in this valley." },
        ],
        fameEffects:   { esperanza: +12, solomon: +12, whitmore: -14 },
        infamyEffects: { esperanza:   0, solomon:   0, whitmore: +14 },
      },
      {
        id: 'block_meeting',
        label: "Decline to arrange it — tell each of them the other isn't ready",
        desc: "You tell Esperanza that Solomon is cautious about coalition entanglement. You tell Solomon that Esperanza is not yet comfortable with the exposure. Both are partially true. The alliance doesn't form. You remain neutral. You remain alone.",
        effects: [
          { star: 'esperanza', passion: 'trust',    delta: -14, why: "She suspects you had more influence over this than you let on." },
          { star: 'solomon',   passion: 'autonomy', delta:  -8, why: "A door you could have opened, you left closed. He files that." },
        ],
        fameEffects:   { esperanza: -8, solomon: -8, whitmore: +5 },
        infamyEffects: { esperanza:  8, solomon:  8, whitmore:  0 },
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
          { star: 'whitmore', passion: 'margaret', delta: +18, why: "You helped him say something he couldn't say alone. He will not forget that." },
          { star: 'whitmore', passion: 'corridor', delta: -10, why: "He postponed the filing to deal with something the company doesn't recognize as important. They noticed the delay." },
          { star: 'whitmore', passion: 'standing', delta:  -6, why: "A delayed filing is a mark against him in the company ledger." },
        ],
        fameEffects:   { esperanza: +4, solomon: +4, whitmore: +10 },
        infamyEffects: { esperanza:  0, solomon:  0, whitmore:   0 },
      },
      {
        id: 'push_filing_first',
        label: "Redirect him to the filing — the letter can wait",
        desc: "You tell him the Sacramento deadline is real and the letter can be written after. He signs the filing. He does not write the letter that week, or the week after.",
        effects: [
          { star: 'whitmore', passion: 'corridor', delta: +12, why: "The filing went through on time. The company is satisfied." },
          { star: 'whitmore', passion: 'standing', delta:  +8, why: "He delivered again. The company pays attention to that." },
          { star: 'whitmore', passion: 'margaret', delta: -18, why: "You were part of why he chose the route over the letter. He knows it. So does she, eventually." },
        ],
        fameEffects:   { esperanza: -4, solomon: -4, whitmore: +12 },
        infamyEffects: { esperanza:  0, solomon:  0, whitmore:   0 },
      },
      {
        id: 'attempt_both',
        label: "Promise to help with both — the letter and the filing",
        desc: "You tell him you'll manage both. The letter is short and impersonal. The filing goes through with a procedural objection. Neither is done well. She doesn't write back.",
        effects: [
          { star: 'whitmore', passion: 'corridor', delta: +5,  why: "The filing went through, technically, but it drew a procedural objection the company had to clear." },
          { star: 'whitmore', passion: 'margaret', delta: -6,  why: "The letter was not what he needed to send. He knew it when he read it back." },
          { star: 'whitmore', passion: 'standing', delta: -4,  why: "The procedural objection created paperwork. Minor, but noted." },
        ],
        fameEffects:   { esperanza: 0, solomon: 0, whitmore: +4 },
        infamyEffects: { esperanza: 0, solomon: 0, whitmore:  0 },
      },
    ],
  },
  {
    id: 'conv_three_star_reckoning',
    condition: (stars, taken) => {
      const absMacro = s => Math.abs(macropassionValue(s.passions));
      return absMacro(stars.esperanza) >= 20 && absMacro(stars.solomon) >= 20 && absMacro(stars.whitmore) >= 20;
    },
    headline: 'THREE LETTERS IN ONE WEEK — All of them need something.',
    bodyFn: (taken) => taken.includes('lend_solomon')
      ? "Three letters arrive in the same week. Esperanza Vallejo needs a witness at a boundary hearing in Sacramento — the case that will determine whether the grant survives the decade. Solomon Reed needs help navigating a federal challenge to his warehouse deed before the territorial office closes its docket; the post he built with your loan is now at legal risk. J.T. Whitmore needs your name on a critical corridor extension before it lapses. Each of them knows you are the right person for what they need. None of them knows about the other two letters. You cannot be in three places at once. The two you don't answer will remember your absence in different ways."
      : "Three letters arrive in the same week. Esperanza Vallejo needs a witness at a boundary hearing in Sacramento — the case that will determine whether the grant survives the decade. Solomon Reed needs your name on a territorial filing that has come due without warning; he cannot navigate it alone and he will not ask twice. J.T. Whitmore needs your name on a critical corridor extension before it lapses. Each of them knows you are the right person for what they need. None of them knows about the other two letters. You cannot be in three places at once. The two you don't answer will remember your absence in different ways.",
    choices: [
      {
        id: 'answer_esperanza',
        label: "Answer Esperanza — appear at the boundary hearing",
        descFn: (taken) => taken.includes('lend_solomon')
          ? "You go to Sacramento. The hearing goes better with you there. Solomon's deed challenge draws an adverse ruling without you. Whitmore's corridor extension lapses and has to be re-filed at cost."
          : "You go to Sacramento. The hearing goes better with you there. Solomon's filing goes uncontested without you. Whitmore's corridor extension lapses and has to be re-filed at cost.",
        effects: [
          { star: 'esperanza', passion: 'land',     delta: +20, why: "Your presence at the hearing gave the Vallejo survey its best legal day." },
          { star: 'esperanza', passion: 'trust',    delta: +14, why: "When it came to a direct choice across three demands, you came." },
          { star: 'solomon',   passion: 'roots',    delta: -14, why: (taken) => taken.includes('lend_solomon')
              ? "The adverse ruling while you were absent has put his warehouse deed in question."
              : "The filing went badly without you. His footing in the valley is less certain." },
          { star: 'whitmore',  passion: 'standing', delta: -12, why: "The lapsed corridor extension is a failure he has to explain to the company." },
        ],
        fameEffects:   { esperanza: +16, solomon:  -8, whitmore: -10 },
        infamyEffects: { esperanza:   0, solomon:  +6, whitmore: +10 },
      },
      {
        id: 'answer_solomon',
        labelFn: (taken) => taken.includes('lend_solomon')
          ? "Answer Solomon — defend the warehouse deed"
          : "Answer Solomon — help navigate the territorial filing",
        descFn: (taken) => taken.includes('lend_solomon')
          ? "You go to the territorial office with Solomon. The deed challenge is turned back. The post you helped build is secure. Esperanza's hearing in Sacramento proceeds without its expected witness. Whitmore's extension lapses."
          : "You go to the territorial office with Solomon. The filing is resolved in his favor. Esperanza's hearing in Sacramento proceeds without its expected witness. Whitmore's extension lapses.",
        effects: [
          { star: 'solomon',   passion: 'roots',    delta: +18, why: (taken) => taken.includes('lend_solomon')
              ? "The deed challenge was turned back. The post is secure."
              : "The filing resolved in his favor. His position in the valley is firmer." },
          { star: 'solomon',   passion: 'autonomy', delta: +10, why: "You navigated federal process on his behalf without entangling him in it further." },
          { star: 'esperanza', passion: 'trust',    delta: -16, why: "She had asked specifically for you. You sent word you couldn't come. She went alone." },
          { star: 'whitmore',  passion: 'standing', delta: -12, why: "The lapsed extension is another failure on his record with the company." },
        ],
        fameEffects:   { esperanza: -10, solomon: +16, whitmore: -10 },
        infamyEffects: { esperanza: +10, solomon:   0, whitmore: +10 },
      },
      {
        id: 'answer_whitmore',
        label: "Answer Whitmore — sign the corridor extension",
        descFn: (taken) => taken.includes('lend_solomon')
          ? "You sign the extension and it goes through. Esperanza's hearing draws a split ruling — not a loss, but not the win she needed. Solomon's deed challenge draws an adverse ruling."
          : "You sign the extension and it goes through. Esperanza's hearing draws a split ruling — not a loss, but not the win she needed. Solomon's filing goes against him.",
        effects: [
          { star: 'whitmore',  passion: 'corridor', delta: +16, why: "The extension went through. The corridor is secured for another season." },
          { star: 'whitmore',  passion: 'standing', delta: +10, why: "He delivered again. The company notes the name on the filing." },
          { star: 'esperanza', passion: 'trust',    delta: -18, why: "She had asked specifically for you. You were at Whitmore's office. She understands exactly what that means." },
          { star: 'solomon',   passion: 'roots',    delta: -14, why: (taken) => taken.includes('lend_solomon')
              ? "The adverse ruling on his deed has put the warehouse in question. He knows where you were."
              : "The filing went against him. He knows where you were." },
        ],
        fameEffects:   { esperanza: -12, solomon: -10, whitmore: +18 },
        infamyEffects: { esperanza: +12, solomon: +10, whitmore:   0 },
      },
    ],
  },
];

// ─── TRANSIENT GUESTS ─────────────────────────────────────────────────────────
// One-off visitors who appear for a window of seasons. The player must respond
// before advancing, or they depart unanswered. Fates echo through the papers.

const GUESTS = [
  {
    id: 'comanche_night',
    ya: 1811, expires: 1814,
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
          { star: 'esperanza', passion: 'trust',    delta: +8,  why: "You defied the federal marshal. That is the kind of action she has been watching for." },
          { star: 'solomon',   passion: 'autonomy', delta: +8,  why: "You acted outside federal record and said nothing. He will hear about this." },
          { star: 'solomon',   passion: 'caleb',    delta: +6,  why: "You sheltered a man crossing three territories to find his sister. He knows what that costs." },
          { star: 'whitmore',  passion: 'corridor', delta: -6,  why: "The marshal left the crossroads empty-handed. Word of that travels." },
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
          { star: 'solomon',   passion: 'autonomy', delta: -6,  why: "You turned away someone the network would have helped. He will file that." },
          { star: 'esperanza', passion: 'trust',    delta: -4,  why: "You had a chance to act against the federal apparatus. You didn't." },
        ],
        fameEffects:   { esperanza: 0, solomon: -8, whitmore: 0 },
        infamyEffects: { esperanza: 0, solomon: +5, whitmore: 0 },
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
          { star: 'solomon',   passion: 'autonomy', delta: -16, why: "You handed someone over to the federal apparatus. That is not a neutral act in his accounting." },
          { star: 'solomon',   passion: 'caleb',    delta: -10, why: "You sent a man searching for his sister into custody. He knows what that means." },
          { star: 'esperanza', passion: 'trust',    delta: -12, why: "You cooperated with federal authority against an outsider. She is taking notes." },
          { star: 'whitmore',  passion: 'corridor', delta: +8,  why: "You upheld the federal order when it cost you something. He respects that." },
        ],
        fameEffects:   { esperanza: -8, solomon: -18, whitmore: +5 },
        infamyEffects: { esperanza: +6, solomon: +14, whitmore: 0 },
        logHeadline: 'COMANCHE MAN TAKEN INTO FEDERAL CUSTODY — Settler provides information leading to arrest.',
        logBody: 'A Comanche man traveling through the valley was taken into federal custody after a local settler provided the territorial marshal with directional intelligence. He was transported east. His sister\'s whereabouts remain unknown.',
        echoDef: { years: 3, dateline: 'Sacramento Union · California', headline: 'COMANCHE PRISONER DIES IN FEDERAL CUSTODY — No next of kin located.', body: 'A Comanche man held in federal custody since his arrest in the valley territories has died of illness at the territorial detention facility. His name, if it was ever recorded accurately, does not appear in the official ledger.' },
      },
    ],
  },
  {
    id: 'underground_conductor',
    ya: 1816, expires: 1819,
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
          { star: 'solomon',   passion: 'autonomy', delta: +12, why: 'Word travels in the freedmen network. What you did here will be known to those who need to know it.' },
          { star: 'esperanza', passion: 'trust',    delta: +7,  why: "You opened your door against the federal order. That is the kind of thing that travels in the right channels." },
          { star: 'whitmore',  passion: 'corridor', delta: -8,  why: "A settler running an unsanctioned operation out of the crossroads is a problem the railroad will eventually have to account for." },
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
          { star: 'solomon', passion: 'autonomy', delta: -8, why: "You turned away the freedmen network when it needed a door opened. He will hear about it." },
        ],
        fameEffects:   { esperanza: 0, solomon: -14, whitmore: 0 },
        infamyEffects: { esperanza: 0, solomon: +8,  whitmore: 0 },
        logHeadline: 'NO REPORT — Crossroads quiet.',
        logBody: 'Nothing of note was reported at the valley crossroads this week.',
        echoDef: null,
      },
    ],
  },
  {
    id: 'the_teacher',
    ya: 1820, expires: 1823,
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
          { star: 'solomon',   passion: 'roots',     delta: +4, why: "A settled, working valley is better for the post. You acted like someone who intends to stay." },
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
          { star: 'esperanza', passion: 'trust',    delta: -8, why: "An Anglo settler deceived a woman who trusted him with her life. This is the pattern she has been describing." },
          { star: 'solomon',   passion: 'roots',    delta: -4, why: "Death on the roads unsettles everything. The valley is harder to build in when it is that kind of place." },
        ],
        fameEffects:   { esperanza: -6, solomon: -6, whitmore: 0 },
        infamyEffects: { esperanza: +6, solomon: +6, whitmore: 0 },
        logHeadline: 'WOMAN MISSING ON NORTHERN ROAD — Last seen at valley crossroads.',
        logBody: 'A schoolteacher reported heading to the northern mining camps has not arrived at her destination. The territorial office has been notified. A search is being organized.',
        echoDef: { years: 1, dateline: 'Sacramento Union · California', headline: 'BODY RECOVERED ON NORTHERN PASS — Identified as Ohio schoolteacher.', body: 'The remains of a woman identified as Clara Finch of Medina, Ohio, were recovered on the northern pass road this week. She had been heading to the Northgate mining camp. No next of kin has been located. The camp she was heading for has no school.' },
      },
    ],
  },
];

// ─── WORLD DISPATCHES ─────────────────────────────────────────────────────────
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
// Called after every state mutation. Returns state unchanged, or with ruined=true
// and a final chronicle entry.

function checkRuin(state) {
  if (state.ruined) return state;
  const starList = Object.values(state.stars);
  let ruinHeadline = null, ruinReason = null;

  // Single-star infamy ruin — suppressed if fame ≥ infamy × FAME_BUFFER_RATIO.
  // A Star who has publicly backed you has skin in the game; burning you costs them too.
  const ruinPaths = {
    esperanza: { headline: 'THE VALLEY CLOSES ITS DOORS', reason: 'Esperanza Vallejo has named you before the full coalition. The Californio families have withdrawn credit, closed their roads, and filed a formal complaint with the territorial court. You are an enemy of the valley. There is no path forward from here.' },
    solomon:   { headline: 'WORD HAS GONE THROUGH THE NETWORK', reason: 'Solomon Reed has passed word through the freedmen network along every route from here to St. Louis. No one who passes through the valley will do business with you. Every door that mattered is closed. This territory is finished for you.' },
    whitmore:  { headline: 'PACIFIC RAILROAD MOVES AGAINST YOUR HOLDINGS', reason: "J.T. Whitmore has assigned the railroad's full legal team to your property claims. Every filing is contested within the week. The legal costs are unrelenting and you cannot sustain them. The homestead passes to other hands." },
  };
  for (const star of starList) {
    if (star.infamy >= 65 && !isRuinBuffered(star) && ruinPaths[star.id]) {
      ({ headline: ruinHeadline, reason: ruinReason } = ruinPaths[star.id]);
      break;
    }
  }

  // Two-star combined infamy — buffered individually by the same fame ratio
  if (!ruinHeadline) {
    const high = starList.filter(s => s.infamy >= 45 && !isRuinBuffered(s));
    if (high.length >= 2) {
      const names = high.slice(0, 2).map(s => s.name.split(' ')[0]).join(' and ');
      ruinHeadline = 'TOO MANY ENEMIES — THE TERRITORY TURNS';
      ruinReason = `${names} have both turned against you in earnest. This territory does not leave room for that many enemies at once. What you built here cannot be sustained. The homestead passes to other hands.`;
    }
  }

  // All passions hostile for any star
  if (!ruinHeadline) {
    for (const star of starList) {
      const vals = Object.values(star.passions).map(p => p.value);
      if (vals.every(v => v <= -50)) {
        ruinHeadline = `${star.name.split(' ')[0].toUpperCase()} — IRRECONCILABLE`;
        ruinReason = `Every dimension of your relationship with ${star.name} has passed the point of repair. They have made it their purpose to see you gone from this valley. The effort, sustained over seasons, succeeds.`;
        break;
      }
    }
  }

  if (!ruinHeadline) return state;

  const ruinEntry = {
    id: `ruin-${state.year}-${state.season}`,
    year: state.year, season: state.season,
    headline: ruinHeadline, body: ruinReason,
    decision: null, effects: [], isDeferred: false, isQuiet: false, isReactive: true, isRuin: true,
  };
  return { ...state, ruined: true, ruinHeadline, ruinReason, log: [ruinEntry, ...state.log] };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SEASON_IDX = { Spring: 0, Summer: 1, Autumn: 2, Winter: 3 };
const dc = x => JSON.parse(JSON.stringify(x));

function seasonsRemaining(year, season, expires, expiresSeason) {
  const expiryTick = expires * 4 + (expiresSeason ? SEASON_IDX[expiresSeason] : 0);
  return Math.max(0, expiryTick - (year * 4 + SEASON_IDX[season]));
}

function applyE(stars, effects) {
  const s = dc(stars);
  for (const e of effects)
    if (s[e.star]?.passions[e.passion])
      s[e.star].passions[e.passion].value = clamp(s[e.star].passions[e.passion].value + e.delta);
  return s;
}
// Logarithmic compounding modifier — equal value intervals give equal gain ratios,
// like the Richter scale. 0 → +0%, 50 → +24%, 100 → +100%.
// Formula: (10^(value/100) − 1) / 9
function fiModifier(value) {
  return (Math.pow(10, value / 100) - 1) / 9;
}

function applyFI(stars, fameEff, infamyEff) {
  const s = dc(stars);
  const lo = 0, hi = 100;
  // Compounding on positive deltas only — gaining fame/infamy accelerates logarithmically.
  // Losing fame/infamy is not amplified; high values are already sticky via slow decay.
  for (const [k, v] of Object.entries(fameEff)) {
    if (!s[k]) continue;
    const modifier = v > 0 ? 1 + fiModifier(s[k].fame) : 1;
    s[k].fame = Math.round(Math.max(lo, Math.min(hi, s[k].fame + v * modifier)));
  }
  for (const [k, v] of Object.entries(infamyEff)) {
    if (!s[k]) continue;
    const modifier = v > 0 ? 1 + fiModifier(s[k].infamy) : 1;
    s[k].infamy = Math.round(Math.max(lo, Math.min(hi, s[k].infamy + v * modifier)));
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
    fired.push(ev.id);
    if (ev.effects.length) stars = applyE(stars, ev.effects);
    stars = applyFI(stars, ev.fameEffects, ev.infamyEffects);
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
    if (!ev.condition(stars, state.taken)) continue;
    fired.push(ev.id);
    const resolvedBody = typeof ev.bodyFn === 'function' ? ev.bodyFn(state.taken) : ev.body;
    const resolvedChoices = ev.choices.map(c => ({
      ...c,
      label: typeof c.labelFn === 'function' ? c.labelFn(state.taken) : c.label,
      desc:  typeof c.descFn  === 'function' ? c.descFn(state.taken)  : c.desc,
      effects: c.effects.map(ef => ({
        ...ef,
        why: typeof ef.why === 'function' ? ef.why(state.taken) : ef.why,
      })),
    }));
    pending.push({ id: ev.id, headline: ev.headline, body: resolvedBody, choices: resolvedChoices });
  }

  return { ...state, stars, firedEvents: fired, pendingChoices: pending, unlockedActions: unlocked, log: [...newEntries, ...state.log.filter(e => !newEntries.find(n => n.id === e.id))] };
}

const INIT = {
  year: 1810, season: 'Spring', quietCount: 0,
  stars: INITIAL_STARS,
  taken: [],           // action IDs the player has completed
  log: [],             // Chronicle entries, newest first
  deferred: [],        // queued future Chronicle entries { fireYear, headline, body, effects, ... }
  firedEvents: [],     // reactive + convergence event IDs already triggered (dedupe guard)
  pendingChoices: [],  // convergence events awaiting player resolution — shown as modal stack
  unlockedActions: [], // action IDs unlocked by reactive events, added to available pool
  seenActions: [],     // action IDs that have appeared in Decisions (used for ● New badge)
  seenStars: [],       // star IDs whose source actions have appeared (drives Persons reveal)
  revealedPassions: [],  // "starId:passionKey" strings permanently unlocked (hidden passions)
  pendingReveal: [],     // { key, year } objects queued for the PassionRevealModal
  pendingGuest: null,    // current GUESTS entry awaiting player response
  guestHistory: [],      // guest IDs already answered or departed unanswered
  homesteadLog: [],      // Crossroads ledger entries { year, season, note }
  ruined: false, ruinHeadline: null, ruinReason: null,
};

function reducer(state, action) {
  if (action.type === 'ACT') {
    const act = [...ACTIONS, ...UNLOCKABLE_ACTIONS].find(a => a.id === action.id);
    if (!act || state.taken.includes(act.id)) return state;
    const prevStars = state.stars;
    let stars = applyE(state.stars, act.effects);
    stars = applyFI(stars, act.fame, act.infamy);
    // Reputation-gated bonus effects — fire if player's rep state with the target Star
    // matches the required key at the moment the action is taken (checked pre-application).
    if (act.repBonus) {
      const preRepStars = state.stars; // snapshot before effects
      for (const rb of act.repBonus) {
        if (!preRepStars[rb.star]) continue;
        if (repStateKey(preRepStars[rb.star]) !== rb.repState) continue;
        if (rb.extraEffects?.length) stars = applyE(stars, rb.extraEffects);
        if (rb.extraFame) stars = applyFI(stars, rb.extraFame, {});
        if (rb.extraInfamy) stars = applyFI(stars, {}, rb.extraInfamy);
      }
    }
    const entry = {
      id: `${act.id}-${state.year}-${state.season}`,
      year: state.year, season: state.season,
      headline: act.result, body: act.resultBody, bodyHidden: act.bodyHidden || null,
      decision: act.dispatch, effects: act.effects,
      isDeferred: false, isQuiet: false, isReactive: false,
    };
    const deferred = [...state.deferred];
    if (act.def) deferred.push({ fireYear: state.year + act.def.years, headline: act.def.headline, body: act.def.body, effects: act.def.effects, originLabel: act.dispatch, originYear: state.year });
    const revealedPassions = checkPassionReveals(stars, state.revealedPassions);
    // Diff before/after to find newly crossed hidden passion thresholds.
    // Each newly revealed key is stamped with the current year so PassionRevealModal
    // can render accurate duration text, then queued for sequential display.
    const newlyRevealed = revealedPassions.filter(k => !state.revealedPassions.includes(k));
    const pendingReveal = [...state.pendingReveal, ...newlyRevealed.map(k => ({ key: k, year: state.year }))];
    const next = { ...state, stars, taken: [...state.taken, act.id], deferred, revealedPassions, pendingReveal };
    return checkRuin(checkEvents({ ...next, log: [entry, ...state.log] }, prevStars, []));
  }
  if (action.type === 'CHOOSE') {
    const conv = CONVERGENCE_EVENTS.find(e => e.id === action.eventId);
    const choice = conv?.choices.find(c => c.id === action.choiceId);
    if (!conv || !choice) return state;
    const prevStars = state.stars;
    let stars = applyE(state.stars, choice.effects);
    stars = applyFI(stars, choice.fameEffects, choice.infamyEffects);
    const entry = {
      id: `conv-${action.eventId}-${action.choiceId}`,
      year: state.year, season: state.season,
      headline: `${conv.headline} — ${choice.label}`,
      body: choice.desc, decision: choice.label,
      effects: choice.effects, isDeferred: false, isQuiet: false, isReactive: true, isNegative: false,
    };
    const pending = state.pendingChoices.filter(p => p.id !== action.eventId);
    const revealedPassions = checkPassionReveals(stars, state.revealedPassions);
    const newlyRevealed = revealedPassions.filter(k => !state.revealedPassions.includes(k));
    const pendingReveal = [...state.pendingReveal, ...newlyRevealed.map(k => ({ key: k, year: state.year }))];
    const next = { ...state, stars, pendingChoices: pending, revealedPassions, pendingReveal };
    return checkRuin(checkEvents({ ...next, log: [entry, ...state.log] }, prevStars, []));
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
    {
      const allKnownActions = [...ACTIONS, ...UNLOCKABLE_ACTIONS];
      for (const act of allKnownActions) {
        if (state.taken.includes(act.id) || !act.inaction) continue;
        const seasonExpired = act.expiresSeason &&
          nextYear === act.expires &&
          nextSeason === act.expiresSeason
        const yearExpired = !act.expiresSeason && isWinter && act.expires === nextYear;
        if (seasonExpired || yearExpired) {
          stars = applyE(stars, act.inaction.effects);
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
    for (const d of state.deferred) {
      if (isWinter && d.fireYear <= nextYear) {
        if (!d.isDispatch) stars = applyE(stars, d.effects);
        newEntries.push(d.isDispatch
          ? { id: `dispatch-${d.originYear}-${d.fireYear}-${Math.random().toString(36).slice(2,6)}`, year: nextYear, season: nextSeason, headline: d.headline, body: d.body, decision: null, effects: [], isDeferred: false, isQuiet: false, isReactive: false, isDispatch: true, dateline: d.dateline }
          : { id: `def-${d.originYear}-${d.fireYear}-${Math.random().toString(36).slice(2,6)}`, year: nextYear, season: nextSeason, headline: d.headline, body: d.body, decision: `Consequence of: "${d.originLabel}" (${d.originYear})`, effects: d.effects, isDeferred: true, isQuiet: false, isReactive: false }
        );
      } else remaining.push(d);
    }

    // Fame / Infamy decay — relevance fades without active maintenance.
    // Higher values decay slower (inertia of notoriety); formula: decay = DECAY_BASE × (1 − value/100).
    // Any action that generates fame/infamy this turn already pushed the value back up,
    // so the "restart the clock" effect is naturally captured: interact → value rises →
    // you re-enter the slow-decay zone. Go quiet → value falls faster as you approach 0.
    for (const starId of Object.keys(stars)) {
      const st = stars[starId];
      if (st.fame > 0) {
        st.fame = Math.max(0, Math.round(st.fame - decayRate(st.fame)));
      }
      if (st.infamy > 0) {
        st.infamy = Math.max(0, Math.round(st.infamy - decayRate(st.infamy)));
      }
    }

    // Passion neglect decay — relationships not actively tended lose ground slowly.
    // For each Star, scan the last 8 log entries (roughly 2 years). If none involve
    // that Star's effects, positive passions drift down by 1 point per season.
    // Only positive passions decay (negative ones require active repair to shift).
    // The floor is 0 — neglect can fully erode a relationship, but slowly.
    for (const starId of Object.keys(stars)) {
      const recentInteraction = state.log.slice(0, 8).some(
        e => !e.isQuiet && !e.isDeferred && e.effects?.some(ef => ef.star === starId)
      );
      if (!recentInteraction) {
        for (const passion of Object.values(stars[starId].passions)) {
          if (passion.value > 0) {
            passion.value = Math.max(0, passion.value - 1);
          }
        }
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

    // Quiet season
    const hadAction = state.log.length > 0 && state.log[0].year === state.year && state.log[0].season === state.season && !state.log[0].isQuiet;
    let quietEntry = null;
    if (!hadAction) {
      const seasonPool = QUIET_SEASONS_BY_SEASON[state.season] || [];
      const usedSeasonCount = state.log.filter(e => e.isQuiet && e.season === state.season).length;
      const qs = usedSeasonCount < seasonPool.length
        ? seasonPool[usedSeasonCount]
        : QUIET_SEASONS_GENERIC[state.quietCount % QUIET_SEASONS_GENERIC.length];
      quietEntry = { id: `quiet-${state.year}-${state.season}`, year: state.year, season: state.season, headline: qs.h, body: qs.b, decision: null, effects: [], isDeferred: false, isQuiet: true, isReactive: false };
    }

    // Surface next available guest for the incoming season
    pendingGuest = GUESTS.find(g => g.ya <= nextYear && g.expires > nextYear && !guestHistory.includes(g.id)) || null;

    const cTick = state.year * 4 + SEASON_IDX[state.season];
    const allAvailable = [...ACTIONS, ...UNLOCKABLE_ACTIONS.filter(a => state.unlockedActions.includes(a.id))]
      .filter(a => !state.taken.includes(a.id)
        && (a.ya ?? 0) * 4 + (a.yaSeasonIdx ?? 0) <= cTick
        && (!a.expires || a.expires * 4 + (a.expiresSeason ? SEASON_IDX[a.expiresSeason] : 0) > cTick)
        && (!a.requiresPassionVisible || isPassionVisible(stars, a.requiresPassionVisible.star, a.requiresPassionVisible.passion, state.revealedPassions))
        && (!a.requiresTaken || state.taken.includes(a.requiresTaken))
        && (!a.requiresPassionBelow || (stars[a.requiresPassionBelow.star]?.passions[a.requiresPassionBelow.passion]?.value ?? 0) <= a.requiresPassionBelow.threshold)
        && (!a.requiresPassionAbove || (stars[a.requiresPassionAbove.star]?.passions[a.requiresPassionAbove.passion]?.value ?? 0) >= a.requiresPassionAbove.threshold))
      .map(a => a.id);
    const seenActions = [...new Set([...state.seenActions, ...allAvailable])];
    const revealedStarIds = [...ACTIONS, ...UNLOCKABLE_ACTIONS.filter(a => state.unlockedActions.includes(a.id))]
      .filter(a => (a.ya ?? 0) * 4 + (a.yaSeasonIdx ?? 0) <= cTick)
      .map(a => a.source).filter(Boolean);
    const seenStars = [...new Set([...state.seenStars, ...revealedStarIds])];

    const revealedPassions = checkPassionReveals(stars, state.revealedPassions);
    const newlyRevealed = revealedPassions.filter(k => !state.revealedPassions.includes(k));
    const pendingReveal = [...state.pendingReveal, ...newlyRevealed.map(k => ({ key: k, year: state.year }))];
    const next = { ...state, year: nextYear, season: nextSeason, stars, deferred: remaining, quietCount: state.quietCount + (quietEntry ? 1 : 0), seenActions, pendingGuest, guestHistory, homesteadLog, firedEvents: updatedFiredEvents, revealedPassions, pendingReveal };
    return checkRuin(checkEvents({ ...next, log: [...newEntries, ...(quietEntry ? [quietEntry] : []), ...state.log] }, prevStars, []));
  }
  if (action.type === 'GUEST_CHOOSE') {
    const guest = GUESTS.find(g => g.id === action.guestId);
    const choice = guest?.choices.find(c => c.id === action.choiceId);
    if (!guest || !choice) return state;
    const prevStars = state.stars;
    let stars = applyE(state.stars, choice.effects);
    stars = applyFI(stars, choice.fameEffects, choice.infamyEffects);
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
    const next = { ...state, stars, pendingGuest: null, guestHistory: [...state.guestHistory, action.guestId], homesteadLog, deferred, revealedPassions, pendingReveal };
    return checkRuin(checkEvents({ ...next, log: [entry, ...state.log] }, prevStars, []));
  }
  if (action.type === 'DISMISS_REVEAL') {
    return { ...state, pendingReveal: state.pendingReveal.slice(1) };
  }
  if (action.type === 'RESET') return INIT;
  return state;
}

// ─── DELTA SYMBOL ─────────────────────────────────────────────────────────────
function deltaSymbol(delta) {
  const abs = Math.abs(delta);
  const ch  = delta > 0 ? '+' : '−';
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
function PassionBar({ passionKey, p, color }) {
  const T = useContext(ThemeCtx);
  const [labelHov, setLabelHov] = useState(false);
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

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'baseline' }}>
        <div style={{ position: 'relative' }} onMouseEnter={() => setLabelHov(true)} onMouseLeave={() => setLabelHov(false)}>
          <span style={{ fontSize: 10, color: T.inkMid, fontFamily: "'Courier Prime', monospace", cursor: 'default', borderBottom: labelHov ? `1px solid ${T.bdrHi}` : '1px solid transparent', transition: 'border-color 0.15s' }}>{p.label}</span>
          {labelHov && p.desc && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 5, zIndex: 50, width: 200, background: T.card, border: `1px solid ${T.bdrHi}`, borderRadius: 2, padding: '7px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
              <div style={{ fontSize: 9, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.5 }}>{p.desc}</div>
              <div style={{ position: 'absolute', top: -5, left: 10, width: 8, height: 8, background: T.card, border: `1px solid ${T.bdrHi}`, borderBottom: 'none', borderRight: 'none', transform: 'rotate(45deg)' }} />
            </div>
          )}
        </div>
        <span style={{ fontSize: 9, color: tCol, fontFamily: "'Courier Prime', monospace" }}>{t.label}</span>
      </div>
      <div style={{ position: 'relative', height: 6, background: barBg, borderRadius: 1, overflow: 'visible' }}>
        <div style={{ position: 'absolute', left: fillLeft, width: fillWidth, top: 0, bottom: 0, background: fillColor, transition: 'all 0.6s ease', zIndex: 3 }} />
      </div>
      {behavior && (
        <div style={{ fontSize: 9, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', marginTop: 3, lineHeight: 1.4, borderLeft: `2px solid ${tCol}44`, paddingLeft: 5 }}>
          {behavior}
        </div>
      )}
    </div>
  );
}

// ─── HOVER LABEL ─────────────────────────────────────────────────────────────
function HoverLabel({ label, value, valueColor, valueSize = 11, tooltip, align = 'left', flipUp = false }) {
  const T = useContext(ThemeCtx);
  const [hov, setHov] = useState(false);
  return (
    <div style={{ position: 'relative', textAlign: align, cursor: 'default' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: hov ? `1px solid ${T.bdrHi}` : '1px solid transparent', display: 'inline-block', transition: 'border-color 0.15s' }}>
        {label}
      </div>
      <div style={{ fontSize: valueSize, color: valueColor, fontFamily: valueSize >= 11 ? "'Playfair Display', serif" : "'Courier Prime', monospace", fontStyle: valueSize >= 11 ? 'italic' : 'normal', marginTop: 1 }}>
        {value}
      </div>
      {hov && (
        <div style={{ position: 'absolute', ...(flipUp ? { bottom: '100%', marginBottom: 6 } : { top: '100%', marginTop: 6 }), [align === 'right' ? 'right' : 'left']: 0, width: 160, zIndex: 20, background: T.cardHov, border: `1px solid ${T.bdrHi}`, padding: '7px 9px', borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: 9, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.5 }}>{tooltip}</div>
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
  const mp  = macropassion(star.passions);
  const rep = reputation(star.fame, star.infamy, star.id);

  return (
    <div className="star-card-enter" style={{ borderLeft: `3px solid ${star.color}`, background: T.card, padding: '11px 11px 11px 13px', borderRadius: '0 3px 3px 0', marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: star.color, fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: 1 }}>{star.name}</div>
      <div style={{ fontSize: 9, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{star.role}</div>

      {/* Macropassion */}
      <div style={{ marginBottom: 10 }}>
        <HoverLabel
          label="Personal Regard"
          value={mp.label}
          valueColor={mp.col}
          tooltip="How they feel toward you personally — what your actions have earned."
          align="left"
        />
      </div>

      {/* Passions — hidden ones revealed only once macropassion threshold is met */}
      {Object.entries(star.passions)
        .filter(([k, p]) => isPassionVisible({ [star.id]: star }, star.id, k, revealedPassions))
        .map(([k, p]) => (
          <PassionBar key={k} passionKey={k} p={p} color={star.color} />
        ))}

      {/* Fame / Infamy */}
      <div style={{ borderTop: `1px solid ${T.bdr}`, paddingTop: 8, marginTop: 4 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {/* Fame */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.07em' }}>Fame</div>
            <div style={{ height: 3, background: T.bdr, marginTop: 2, borderRadius: 1 }}>
              <div style={{ height: '100%', width: `${star.fame}%`, background: '#c9a14a', borderRadius: 1, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 8, color: T.inkMut, fontFamily: "'Courier Prime', monospace" }}>{Math.floor(star.fame)}</div>
          </div>
          {/* Infamy — show effective infamy (buffered by fame) */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.07em' }}>Infamy</div>
            <div style={{ height: 3, background: T.bdr, marginTop: 2, borderRadius: 1, position: 'relative' }}>
              <div style={{ height: '100%', width: `${star.infamy}%`, background: '#8a1818', borderRadius: 1, transition: 'width 0.5s' }} />
              {/* Fame buffer overlay — shows the fame coverage against infamy */}
              {star.fame > 0 && star.infamy > 0 && (
                <div
                  title={`Fame covers ${Math.round((star.fame / star.infamy) * 100)}% of infamy (need ≥80% to buffer ruin)`}
                  style={{
                    position: 'absolute', top: 0, bottom: 0,
                    right: `${100 - star.infamy}%`,
                    width: `${Math.min(star.fame * FAME_BUFFER_RATIO, star.infamy)}%`,
                    background: '#c9a14a55', borderRadius: '0 1px 1px 0',
                    transition: 'all 0.5s', cursor: 'default',
                  }}
                />
              )}
            </div>
            <div style={{ fontSize: 8, color: T.inkMut, fontFamily: "'Courier Prime', monospace" }}>
              {Math.floor(star.infamy)}
              {star.fame > 0 && star.infamy > 0 && (
                <span
                  title={`Ruin triggers at infamy ≥65 unless fame ≥ infamy×0.8. Currently: fame ${Math.floor(star.fame)} / need ${Math.ceil(star.infamy * 0.8)}.`}
                  style={{ color: star.fame >= star.infamy * FAME_BUFFER_RATIO ? '#c9a14a99' : '#8a181866', marginLeft: 3, cursor: 'default' }}
                >
                  {star.fame >= star.infamy * FAME_BUFFER_RATIO ? '(buffered)' : `(need ${Math.ceil(star.infamy * 0.8)} fame)`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Community */}
      <div style={{ marginTop: 8, borderTop: `1px solid ${T.bdr}`, paddingTop: 6 }}>
        <div style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Their community</div>
        <div style={{ fontSize: 9, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.45 }}>{star.community}</div>
      </div>

      {/* Public Character */}
      <div style={{ marginTop: 8, borderTop: `1px solid ${T.bdr}`, paddingTop: 6 }}>
        <HoverLabel label="Public Perception" value={rep.label} valueColor={T.inkFaint} valueSize={10} tooltip="What they say about you in rooms you're not in." align="left" flipUp={true} />
        {rep.behavior && (
          <div style={{ fontSize: 9, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.45, marginTop: 4, borderLeft: `2px solid ${T.bdrHi}`, paddingLeft: 5 }}>{rep.behavior}</div>
        )}
      </div>
    </div>
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
  const inactionNote = act.inaction ? 'Consequences follow inaction.' : 'This matter will pass without record.';

  return (
    <div
      className={isNew ? 'action-card-new' : ''}
      style={{ border: `1px solid ${hov ? T.bdrHi : T.bdr}`, background: hov ? T.cardHov : T.card, borderRadius: 2, marginBottom: 14, transition: 'border-color 0.15s, background 0.15s', overflow: 'hidden' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setExpTip(false); }}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg, ${sourceColor}22 0%, ${sourceColor} 100%)` }} />
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
            <span style={{ color: sourceColor, fontSize: 7 }}>◆</span>
            <span style={{ fontSize: 8, color: sourceColor, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sourceLabel}</span>
            <span style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", letterSpacing: '0.08em' }}>—</span>
            <span style={{ fontSize: 8, color: T.inkMut, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{msgType}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {isNew && <div style={{ fontSize: 7, color: '#c9a14a', fontFamily: "'Courier Prime', monospace", letterSpacing: '0.15em', textTransform: 'uppercase' }}>New</div>}
            {seasonsLeft !== null && (
              <div style={{ position: 'relative' }} onMouseEnter={() => setExpTip(true)} onMouseLeave={() => setExpTip(false)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'default', padding: '1px 5px', border: `1px solid ${expColor}55`, borderRadius: 2, background: `${expColor}18` }}>
                  <span style={{ fontSize: 9, color: expColor, lineHeight: 1 }}>⏱</span>
                  <span style={{ fontSize: 7, color: expColor, fontFamily: "'Courier Prime', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{seasonsLeft}S</span>
                </div>
                {expTip && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100, background: T.hdr, border: `1px solid ${expColor}66`, borderRadius: 2, padding: '7px 10px', width: 180, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
                    <div style={{ fontSize: 8, color: expColor, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4, fontWeight: 700 }}>
                      {seasonsLeft === 1 ? 'Final Season' : `Expires in ${seasonsLeft} seasons`}
                    </div>
                    <div style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.5 }}>{inactionNote}</div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={e => { e.stopPropagation(); setCollapsed(c => !c); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkDim, fontSize: 10, padding: '0 2px', lineHeight: 1, fontFamily: "'Courier Prime', monospace" }}
              title={collapsed ? 'Expand' : 'Collapse'}
            >{collapsed ? '▼' : '▲'}</button>
          </div>
        </div>

        <div
          style={{ fontSize: 13, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 700, lineHeight: 1.3, marginBottom: collapsed ? 0 : 6, cursor: animating ? 'default' : 'pointer', opacity: animating ? 0.5 : 1 }}
          onClick={() => { if (!animating) dispatch({ type: 'ACT', id: act.id }); }}
        >{act.dispatch}</div>

        {!collapsed && (
          <div onClick={() => { if (!animating) dispatch({ type: 'ACT', id: act.id }); }} style={{ cursor: animating ? 'default' : 'pointer' }}>
            {act.moral && (
              <div style={{ fontSize: 9, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.6, marginBottom: 8, borderLeft: `2px solid ${T.bdrHi}`, paddingLeft: 8 }}>{act.moral}</div>
            )}
            <div style={{ fontSize: 10, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.55, marginBottom: 10 }}>{descText}</div>
            <div style={{ borderTop: `1px solid ${T.bdr}`, paddingTop: 8 }}>
              <div style={{ fontSize: 8, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontFamily: "'Courier Prime', monospace" }}>Known Effects & Consequences</div>
              {act.effects.filter(e => revealed.includes(e.star) && isPassionVisible(stars, e.star, e.passion, revealedPassions)).map((e, i, arr) => {
                const star    = stars[e.star];
                const passion = star?.passions[e.passion];
                const ben     = e.delta > 0;
                const crossing = passion ? thresholdCrossing(passion.value, e.delta, passion) : null;
                return (
                  <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < arr.length - 1 ? `1px solid ${T.bdrSub}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <span style={{ color: star?.color, fontSize: 7 }}>◆</span>
                      <span style={{ flex: 1, fontFamily: "'Courier Prime', monospace", fontSize: 10 }}>
                        <span style={{ color: T.inkMid }}>{star?.name?.split(' ')[0]} · </span>
                        <span style={{ color: ben ? '#4a8e42' : '#9a3020', fontWeight: 700 }}>{passion?.label}{deltaSymbol(e.delta)}</span>
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.4, paddingLeft: 12 }}>{e.why}</div>
                    {crossing && (
                      <div style={{ marginTop: 5, paddingLeft: 12 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${crossing.color}18`, border: `1px solid ${crossing.color}44`, borderRadius: 2, padding: '2px 6px', marginBottom: crossing.behavior ? 3 : 0 }}>
                          <span style={{ fontSize: 7, color: crossing.color, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Courier Prime', monospace" }}>
                            Outlook on {passion?.label} becomes {crossing.label}
                          </span>
                        </div>
                        {crossing.behavior && (
                          <div style={{ fontSize: 9, color: crossing.color, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.4, opacity: 0.85 }}>{crossing.behavior}</div>
                        )}
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
                    <div style={{ fontSize: 7, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Courier Prime', monospace", marginBottom: 5 }}>Additional — your current standing</div>
                    {activeBonus.flatMap((rb, ri) => (rb.extraEffects || []).map((e, i) => {
                      const star = stars[e.star];
                      const passion = star?.passions[e.passion];
                      return (
                        <div key={`${ri}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 5 }}>
                          <span style={{ color: star?.color, fontSize: 7, marginTop: 2 }}>◈</span>
                          <div>
                            <span style={{ fontSize: 9, fontFamily: "'Courier Prime', monospace" }}>
                              <span style={{ color: T.inkMid }}>{star?.name?.split(' ')[0]} · </span>
                              <span style={{ color: e.delta > 0 ? '#4a8e42' : '#9a3020', fontWeight: 700 }}>{passion?.label}{deltaSymbol(e.delta)}</span>
                            </span>
                            {e.why && <div style={{ fontSize: 9, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.4, marginTop: 1 }}>{e.why}</div>}
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                );
              })()}
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
      {!hideDate && <div style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{entry.year}, {entry.season}</div>}
      <div style={{ fontSize: 10, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.5 }}>— {entry.headline} —</div>
      <div style={{ fontSize: 10, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.65, marginTop: 4 }}>{entry.body}</div>
    </div>
  );

  if (entry.isRuin) return (
    <div style={{ border: '2px solid #8a1818', borderRadius: 2, background: T.defBg, padding: '16px 16px 18px', marginBottom: 20 }}>
      <div style={{ fontSize: 7, color: '#8a1818', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: "'Courier Prime', monospace", marginBottom: 8 }}>{entry.year}, {entry.season} — Final Entry</div>
      <div style={{ fontSize: 15, color: '#c04040', fontFamily: "'Playfair Display', serif", fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, marginBottom: 10 }}>{entry.headline}</div>
      <div style={{ fontSize: 11, color: '#9a5040', fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.7 }}>{entry.body}</div>
    </div>
  );

  if (entry.isDispatch) return (
    <div style={{ borderBottom: `1px solid ${T.bdr}`, paddingBottom: 16, marginBottom: 18 }}>
      <div style={{ background: T.surf, border: `1px solid ${T.bdr}`, borderLeft: `3px solid ${T.bdrHi}`, borderRadius: 2, padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 7, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 6, borderBottom: `1px solid ${T.bdr}`, paddingBottom: 5 }}>
          ✦ {entry.dateline || 'The Territorial Standard'}
        </div>
        <div style={{ fontSize: 13, color: T.dispInk, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.25, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{entry.headline}</div>
        <div style={{ fontSize: 10, color: T.dispFaint, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.65 }}>{entry.body}</div>
      </div>
    </div>
  );

  if (entry.isInaction) return (
    <div style={{ borderBottom: `1px solid ${T.bdr}`, paddingBottom: 16, marginBottom: 18 }}>
      {!hideDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: '#7a4030' }}>◌</span>
          <span style={{ fontSize: 8, color: '#7a4030', fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>{entry.year}, {entry.season} — Window Closed</span>
          {isNew && <span style={{ fontSize: 7, color: '#c9a14a', fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.15em', marginLeft: 'auto' }}>● New</span>}
        </div>
      )}
      <div style={{ background: T.inactBg, border: `1px solid ${T.bdr}`, borderLeft: '3px solid #7a4030', borderRadius: 2, padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 7, color: '#7a4030', fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 5 }}>◌ Window Closed — No Action Taken</div>
        <div style={{ fontSize: 13, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontWeight: 700, lineHeight: 1.25, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{entry.headline}</div>
        <div style={{ fontSize: 10, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.65, marginBottom: entry.effects?.length ? 10 : 0 }}>{entry.body}</div>
        {entry.effects?.filter(e => revealed.includes(e.star)).map((e, i) => {
          const star = stars[e.star];
          const passion = star?.passions[e.passion];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <span style={{ color: star?.color, fontSize: 7 }}>◆</span>
              <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 9 }}>
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
  const accentColor = D ? '#8a1818' : R ? '#6a4a9a' : isNew ? '#c9a14a' : null;
  const bgColor     = D ? T.defBg   : R ? T.reactBg : isNew ? T.newBg  : 'transparent';
  const borderColor = D ? '#501010' : R ? '#3a2060' : isNew ? T.bdrHi  : T.bdr;
  // showHeaderRow: always show the icon row for deferred (⚡) and reactive (◈) entries
  // so their type indicators are never hidden even when the date is suppressed by hideDate.
  const showHeaderRow = !hideDate || D || R;
  return (
    <div style={{ borderBottom: `1px solid ${borderColor}`, marginBottom: 18, background: bgColor, borderLeft: accentColor ? `3px solid ${accentColor}` : 'none', padding: (accentColor || isNew) ? '12px 14px 14px' : '0 0 16px 0', borderRadius: (accentColor || isNew) ? 2 : 0 }}>
      {showHeaderRow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          {D && <span style={{ fontSize: 12, color: '#8a1818' }}>⚡</span>}
          {R && <span style={{ fontSize: 10, color: '#6a4a9a' }}>◈</span>}
          {!hideDate && <span style={{ fontSize: 8, color: T.inkMut, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.1em' }}>{entry.year}, {entry.season}</span>}
          {R && <span style={{ fontSize: 7, color: '#6a4a9a', fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.15em' }}>— Narrative Event</span>}
          {!hideDate && isNew && !D && !R && <span style={{ fontSize: 7, color: '#c9a14a', fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.15em', marginLeft: 'auto' }}>● New</span>}
        </div>
      )}
      {showHeaderRow && <div style={{ height: '0.5px', background: borderColor, marginBottom: 8 }} />}
      <div style={{ fontSize: 14, lineHeight: 1.3, marginBottom: 6, color: D ? '#c03030' : R ? '#8060c0' : T.ink, fontFamily: "'Playfair Display', serif", fontWeight: (D || R) ? 900 : 700, textTransform: D ? 'uppercase' : 'none', letterSpacing: D ? '0.03em' : 'normal' }}>
        {entry.headline}
      </div>
      <div style={{ fontSize: 11, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.65, marginBottom: 10 }}>{bodyText}</div>
      {D && <div style={{ fontSize: 9, color: T.inkDim, fontFamily: "'Courier Prime', monospace", marginBottom: 8, borderTop: '1px solid #501010', paddingTop: 6 }}>Origin: {entry.decision}</div>}
      <div>
        {visibleEffects.map((e, i) => {
          const star = stars?.[e.star];
          const ben  = e.delta > 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 5 }}>
              <span style={{ color: star?.color || T.inkMut, fontSize: 7, marginTop: 3 }}>◆</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontFamily: "'Courier Prime', monospace" }}>
                    <span style={{ color: T.inkMid }}>{star?.name?.split(' ')[0] || '—'} · </span>
                    <span style={{ color: ben ? '#4a8e42' : '#9a3020', fontWeight: 700 }}>{star?.passions[e.passion]?.label || e.passion}{deltaSymbol(e.delta)}</span>
                  </span>
                </div>
                {e.why && <div style={{ fontSize: 9, color: T.inkWhy, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.4, marginTop: 1 }}>{e.why}</div>}
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
  Summer: { color: '#c9a14a', symbol: '☀', sub: 'The heat stays.'   },
  Autumn: { color: '#c87030', symbol: '✦', sub: 'Things turn.'      },
  Winter: { color: '#8ab0c8', symbol: '❄', sub: 'The passes close.' },
};

// ─── CONVERGENCE MODAL ───────────────────────────────────────────────────────
function ConvergenceModal({ event, stars, dispatch }) {
  const T = useContext(ThemeCtx);
  return (
    <div style={{ position: 'fixed', inset: 0, zoom: 0.75, zIndex: 200, background: T.modalBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%', background: T.hdr, border: `1px solid ${T.bdrHi}`, borderTop: '3px solid #c9a14a', padding: '28px 28px 24px', animation: 'fadeInModal 0.45s ease-out forwards', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 7, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 10 }}>Convergence — A Forced Choice</div>
        <div style={{ fontSize: 18, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.2, marginBottom: 14 }}>{event.headline}</div>
        <div style={{ fontSize: 11, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.7, marginBottom: 22, borderBottom: `1px solid ${T.bdr}`, paddingBottom: 18 }}>{event.body}</div>
        <div style={{ fontSize: 7, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10 }}>How do you stand?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {event.choices.map(choice => (
            <button key={choice.id} onClick={() => dispatch({ type: 'CHOOSE', eventId: event.id, choiceId: choice.id })}
              style={{ background: 'transparent', border: `1px solid ${T.bdr}`, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', borderRadius: 2, transition: 'border-color 0.15s, background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#c9a14a'; e.currentTarget.style.background = T.cardHov; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.bdr; e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ fontSize: 11, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 700, lineHeight: 1.3, marginBottom: 5 }}>{choice.label}</div>
              <div style={{ fontSize: 9, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.5 }}>{choice.desc}</div>
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
                        <span style={{ fontSize: 8, fontFamily: "'Courier Prime', monospace", color: star.color, fontWeight: 700 }}>{star.name.split(' ')[0]}:</span>
                        {effects.map((e, i) => {
                          const passion = star.passions[e.passion];
                          return (
                            <span key={i} style={{ fontSize: 8, fontFamily: "'Courier Prime', monospace", color: e.delta > 0 ? '#4a8e42' : '#9a3020' }}>
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

// ─── PASSION REVEAL MODAL ─────────────────────────────────────────────────────
function PassionRevealModal({ revealKey, dispatch }) {
  const T = useContext(ThemeCtx);
  const { key, year } = revealKey;
  const dialogue = PASSION_REVEAL_DIALOGUES[key];
  if (!dialogue) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zoom: 0.75, zIndex: 210, background: T.modalBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', background: T.hdr, border: `1px solid ${dialogue.starColor}`, borderTop: `3px solid ${dialogue.starColor}`, padding: '28px 28px 24px', animation: 'fadeInModal 0.45s ease-out forwards', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>

        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 7, color: dialogue.starColor, textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: "'Courier Prime', monospace" }}>
            Hidden Passion Revealed
          </div>
          <div style={{ flex: 1, height: 1, background: dialogue.starColor, opacity: 0.3 }} />
          <div style={{ fontSize: 9, color: dialogue.starColor, fontFamily: "'Courier Prime', monospace", fontWeight: 700 }}>
            {dialogue.passionLabel}
          </div>
        </div>

        {/* Star name */}
        <div style={{ fontSize: 9, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>{dialogue.starName}</div>

        {/* Headline */}
        <div style={{ fontSize: 18, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.2, marginBottom: 16 }}>{dialogue.headline}</div>

        {/* Body */}
        <div style={{ fontSize: 11, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.75, marginBottom: 22, paddingBottom: 18, borderBottom: `1px solid ${T.bdr}` }}>{dialogue.body(year)}</div>

        {/* Passive signal */}
        <div style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.6, marginBottom: 18 }}>
          There may be something you can do about this. Sooner or later.
        </div>

        {/* Continue */}
        <button
          onClick={() => dispatch({ type: 'DISMISS_REVEAL' })}
          style={{ background: 'transparent', border: `1px solid ${dialogue.starColor}`, color: dialogue.starColor, padding: '10px 18px', fontFamily: "'Courier Prime', monospace", fontSize: 9, cursor: 'pointer', letterSpacing: '0.15em', textTransform: 'uppercase', borderRadius: 2, width: '100%', transition: 'background 0.15s, color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = dialogue.starColor; e.currentTarget.style.color = T.hdr; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = dialogue.starColor; }}>
          {dialogue.continueLabel} →
        </button>

      </div>
    </div>
  );
}

function GuestModal({ guest, dispatch }) {
  const T = useContext(ThemeCtx);
  return (
    <div style={{ position: 'fixed', inset: 0, zoom: 0.75, zIndex: 200, background: T.modalBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, width: '100%', background: T.hdr, border: `1px solid ${T.bdrHi}`, borderTop: `3px solid ${T.inkMut}`, padding: '28px 28px 24px', animation: 'fadeInModal 0.45s ease-out forwards', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 7, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 6 }}>A Visitor at the Door</div>
        <div style={{ fontSize: 20, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.2, marginBottom: 4 }}>{guest.name}</div>
        <div style={{ fontSize: 9, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>{guest.role}</div>
        <div style={{ fontSize: 11, color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.75, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${T.bdr}` }}>{guest.arrival}</div>
        {guest.moral && (
          <div style={{ fontSize: 9, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.6, marginBottom: 18, borderLeft: `2px solid ${T.bdrHi}`, paddingLeft: 10 }}>{guest.moral}</div>
        )}
        <div style={{ fontSize: 7, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10 }}>What do you do?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {guest.choices.map(choice => (
            <button key={choice.id} onClick={() => dispatch({ type: 'GUEST_CHOOSE', guestId: guest.id, choiceId: choice.id })}
              style={{ background: 'transparent', border: `1px solid ${T.bdr}`, padding: '11px 14px', textAlign: 'left', cursor: 'pointer', borderRadius: 2, transition: 'border-color 0.15s, background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.inkMut; e.currentTarget.style.background = T.cardHov; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.bdr; e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ fontSize: 11, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 700, marginBottom: 4 }}>{choice.label}</div>
              <div style={{ fontSize: 9, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.5 }}>{choice.desc}</div>
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
      <div style={{ fontSize: 7, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 10 }}>The Crossroads — Who Has Passed Through</div>
      {homesteadLog.map((item, i) => (
        <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${T.bdrSub}` }}>
          <div style={{ fontSize: 7, color: T.inkFaint, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{item.year}, {item.season}</div>
          <div style={{ fontSize: 10, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.55 }}>{item.note}</div>
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
        <div style={{ fontSize: 7, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 20 }}>The Territorial Standard · Est. 1810</div>
        <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', marginBottom: 16 }}>✦ ✦ ✦</div>
        <div style={{ fontSize: 38, color: '#c9a14a', fontFamily: "'Playfair Display', serif", fontWeight: 900, letterSpacing: '0.06em', lineHeight: 1, marginBottom: 10 }}>MANIFEST</div>
        <div style={{ fontSize: 9, color: T.inkMut, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: 32 }}>California Territory · 1810</div>
        <div style={{ fontSize: 11, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', lineHeight: 1.85, marginBottom: 12, borderTop: `1px solid ${T.bdr}`, borderBottom: `1px solid ${T.bdr}`, padding: '22px 0' }}>
          You have arrived in the valley with land, some money, and a name not yet known.<br /><br />
          Others have arrived before you. What you do here — and to whom — will determine whether you endure.
        </div>
        <div style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.6, marginBottom: 32 }}>
          Decisions accumulate. Some arrive as choices. Others arrive as consequences.
        </div>
        <button
          onClick={onBegin}
          style={{ background: 'transparent', border: `1px solid #c9a14a`, color: '#c9a14a', padding: '10px 32px', fontFamily: "'Courier Prime', monospace", fontSize: 10, cursor: 'pointer', letterSpacing: '0.18em', textTransform: 'uppercase', borderRadius: 2 }}
          onMouseEnter={e => { e.currentTarget.style.background = '#c9a14a'; e.currentTarget.style.color = T.bg; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9a14a'; }}>
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
        <div style={{ fontSize: 7, color: '#8a1818', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 20 }}>{state.season}, {state.year} — The Territory Has Spoken</div>
        <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', marginBottom: 14 }}>✦ ✦ ✦</div>
        <div style={{ fontSize: 26, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontWeight: 900, lineHeight: 1.15, marginBottom: 24, letterSpacing: '0.02em' }}>{state.ruinHeadline}</div>
        <div style={{ fontSize: 12, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.85, marginBottom: 36, borderTop: `1px solid ${T.bdr}`, borderBottom: `1px solid ${T.bdr}`, padding: '20px 0' }}>{state.ruinReason}</div>
        {state.homesteadLog.length > 0 && (
          <div style={{ marginBottom: 32, textAlign: 'left', background: T.ruinCardBg, border: `1px solid ${T.bdr}`, borderRadius: 2, padding: '14px 16px' }}>
            <div style={{ fontSize: 7, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 10 }}>Those Who Passed Through the Crossroads</div>
            {state.homesteadLog.slice(0, 6).map((item, i) => (
              <div key={i} style={{ fontSize: 10, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.55, marginBottom: 6 }}>
                <span style={{ color: T.bdrHi }}>{item.year} — </span>{item.note}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          style={{ background: 'transparent', border: `1px solid ${T.bdrHi}`, color: '#c9a14a', padding: '10px 28px', fontFamily: "'Courier Prime', monospace", fontSize: 10, cursor: 'pointer', letterSpacing: '0.15em', textTransform: 'uppercase', borderRadius: 2 }}
          onMouseEnter={e => { e.currentTarget.style.background = '#c9a14a'; e.currentTarget.style.color = T.hdr; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9a14a'; }}>
          Begin Again — 1810
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
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: open ? '#c9a14a' : T.inkDim, fontSize: 16, lineHeight: 1, padding: '4px 2px', fontFamily: "'Courier Prime', monospace", transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = '#c9a14a'}
        onMouseLeave={e => e.currentTarget.style.color = open ? '#c9a14a' : T.inkDim}
        title="Menu"
      >☰</button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 50, background: T.hdr, border: `1px solid ${T.bdrHi}`, borderRadius: 2, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 7, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.15em', padding: '8px 12px 4px', borderBottom: `1px solid ${T.bdr}` }}>Options</div>
            <button
              onClick={() => { setDarkMode(d => !d); setOpen(false); }}
              style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', textAlign: 'left', color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: `1px solid ${T.bdr}` }}
              onMouseEnter={e => { e.currentTarget.style.background = T.cardHov; e.currentTarget.style.color = T.ink; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.inkMut; }}
            >{darkMode ? '☀ Day Mode' : '☾ Night Mode'}</button>
            <button
              onClick={() => { dispatch({ type: 'RESET' }); setOpen(false); }}
              style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', textAlign: 'left', color: T.inkMut, fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: `1px solid ${T.bdr}` }}
              onMouseEnter={e => { e.currentTarget.style.background = T.cardHov; e.currentTarget.style.color = T.ink; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.inkMut; }}
            >↺ New Game</button>
            <div style={{ padding: '7px 12px', fontSize: 9, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.5 }}>Manifest · 1810–1860</div>
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
  const playable = [...allPlayable].sort((a, b) => {
    const aNew = newThisTurn.has(a.id) ? 1 : 0;
    const bNew = newThisTurn.has(b.id) ? 1 : 0;
    if (bNew !== aNew) return bNew - aNew;
    return (b.ya ?? 0) - (a.ya ?? 0);
  });
  // revealed — star IDs shown in the Persons column and in Chronicle effect rows.
  // A star becomes visible as soon as any of their source actions enters the timeline,
  // whether or not the player has taken it. Unlockable actions that are in
  // state.unlockedActions are also included so their star surfaces immediately on unlock.
  const revealed = [...new Set(
    allActions.filter(a => {
      const cTick = state.year * 4 + SEASON_IDX[state.season];
      return (a.ya ?? 0) * 4 + (a.yaSeasonIdx ?? 0) <= cTick || state.unlockedActions.includes(a.id);
    }).map(a => a.source).filter(Boolean)
  )];

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
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
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
      {state.pendingReveal.length > 0 && !state.ruined && (
        <PassionRevealModal revealKey={state.pendingReveal[0]} dispatch={dispatch} />
      )}
      {state.pendingGuest && !state.ruined && (
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
            <div style={{ fontSize: 7, color: T.inkDim, letterSpacing: '0.2em', textTransform: 'uppercase' }}>The Territorial Standard · Est. 1810</div>
            <div style={{ fontSize: 22, color: '#c9a14a', fontFamily: "'Playfair Display', serif", fontWeight: 900, letterSpacing: '0.05em', lineHeight: 1 }}>MANIFEST</div>
          </div>
          <div style={{ width: 1, height: 32, background: T.bdr }} />

          {/* SEASON WIDGET */}
          <div style={{ position: 'relative', width: 130, height: 38, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: animating ? 0 : 1, transform: animating ? 'translateY(-6px)' : 'translateY(0)', transition: animating ? 'opacity 0.25s, transform 0.25s' : 'none' }}>
              <div style={{ fontSize: 19, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 700, lineHeight: 1 }}>{state.year}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: currentVis.color }}>{currentVis.symbol}</span>
                <span style={{ fontSize: 8, color: T.inkMut, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{state.season}</span>
              </div>
            </div>
            {animating && animContent && (
              <div style={{ position: 'absolute', inset: 0, opacity: animPhase === 'rise' ? 0 : animPhase === 'hold' ? 1 : 0, transform: animPhase === 'rise' ? 'translateY(10px)' : 'translateY(0)', transition: animPhase === 'rise' ? 'opacity 0.35s, transform 0.35s' : animPhase === 'fall' ? 'opacity 0.5s' : 'none' }}>
                <div style={{ fontSize: 19, color: T.ink, fontFamily: "'Playfair Display', serif", fontWeight: 700, lineHeight: 1 }}>{animContent.year}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: animContent.color, display: 'inline-block', animation: animPhase === 'hold' ? 'symbolPulse 0.45s ease-out forwards' : 'none' }}>{animContent.symbol}</span>
                  <span style={{ fontSize: 8, color: T.inkMut, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{animContent.season}</span>
                </div>
                <div style={{ fontSize: 8, color: animContent.color, fontStyle: 'italic', marginTop: 1, fontFamily: "'Playfair Display', serif" }}>{animContent.sub}</div>
              </div>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleAdvance}
              disabled={animating}
              style={{ background: 'transparent', border: '1px solid #c9a14a', color: '#c9a14a', padding: '6px 14px', fontFamily: "'Courier Prime', monospace", fontSize: 10, cursor: animating ? 'default' : 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase', borderRadius: 2, opacity: animating ? 0.4 : 1 }}
              onMouseEnter={e => { if (!animating) { e.currentTarget.style.background = '#c9a14a'; e.currentTarget.style.color = T.hdr; }}}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9a14a'; }}>
              Advance Season →
            </button>
          </div>
        </div>

        {/* BODY */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* PERSONS */}
          <div style={{ width: 248, borderRight: `1px solid ${T.bdr}`, padding: '14px 10px', overflowY: 'auto', flexShrink: 0, minHeight: 0, background: T.surf }}>
            <div style={{ fontSize: 7, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${T.bdr}` }}>Persons of Interest</div>
            {Object.values(state.stars).filter(s => revealed.includes(s.id)).map(s => <StarCard key={s.id} star={s} revealedPassions={state.revealedPassions} />)}
            <HomesteadPanel homesteadLog={state.homesteadLog} />
          </div>

          {/* DECISIONS */}
          <div style={{ width: 320, borderRight: `1px solid ${T.bdr}`, overflowY: 'auto', flexShrink: 0, minHeight: 0, background: T.bg }}>
            <div style={{ padding: '14px 12px 8px', borderBottom: `1px solid ${T.bdr}` }}>
              <div style={{ fontSize: 7, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Matters Requiring Decision</div>
            </div>
            {state.pendingGuest && (
              <div style={{ margin: '10px 12px 0', background: T.card, border: `1px solid ${T.bdrHi}`, borderLeft: '3px solid #aa9068', borderRadius: 2, padding: '8px 10px', cursor: 'pointer' }}>
                <div style={{ fontSize: 7, color: '#aa9068', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: "'Courier Prime', monospace", marginBottom: 3 }}>⚑ Visitor at the Door</div>
                <div style={{ fontSize: 10, color: T.inkMid, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{state.pendingGuest.name}</div>
                <div style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', marginTop: 2 }}>{state.pendingGuest.role}</div>
              </div>
            )}
            <div style={{ padding: '12px 12px 14px' }}>
              {playable.length === 0 ? (
                <div style={{ border: `1px solid ${T.bdr}`, borderRadius: 2, padding: '14px', background: T.surf }}>
                  <div style={{ height: 1, background: T.bdr, marginBottom: 10 }} />
                  <div style={{ fontSize: 8, color: T.inkDim, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{state.season}, {state.year}</div>
                  <div style={{ fontSize: 12, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', lineHeight: 1.55, marginBottom: 8 }}>Nothing requires your hand this season.</div>
                  <div style={{ fontSize: 10, color: T.inkDim, fontFamily: "'Courier Prime', monospace", fontStyle: 'italic', lineHeight: 1.65 }}>Advance the season. What you have set in motion continues whether you attend to it or not.</div>
                  <div style={{ height: 1, background: T.bdr, marginTop: 10 }} />
                </div>
              ) : playable.map(act => (
                <ActionCard key={act.id} act={act} stars={state.stars} dispatch={dispatch} revealed={revealed} revealedPassions={state.revealedPassions} isNew={newThisTurn.has(act.id)} year={state.year} season={state.season} animating={animating} />
              ))}
            </div>
          </div>

          {/* CHRONICLE */}
          <div style={{ flex: 1, padding: '14px 20px', overflowY: 'auto', minHeight: 0, background: T.bg }}>
            <div style={{ fontSize: 7, color: T.inkDim, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${T.bdr}` }}>The Territorial Standard — Chronicle</div>
            {state.log.length === 0 ? (
              <div style={{ fontSize: 13, color: T.inkMut, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', lineHeight: 1.9 }}>
                The ledger is empty.<br/><br/>You have land, some money, and a series of obligations not yet named.
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
                      <span style={{ fontSize: 10, color: vis.color }}>{vis.symbol}</span>
                      <span style={{ fontSize: 9, color: T.inkMut, fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.12em' }}>{group.year}, {group.season}</span>
                      {isCurrent && <span style={{ fontSize: 7, color: '#c9a14a', fontFamily: "'Courier Prime', monospace", textTransform: 'uppercase', letterSpacing: '0.15em', marginLeft: 'auto' }}>● New</span>}
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
