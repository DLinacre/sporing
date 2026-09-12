'use strict';
/* =====================================================================
   Sporing — England foraging chance map
   Model estimate: season × habitat × climate (no field data).
   ===================================================================== */

const D = window.SPORING_DATA;
const NS = 'http://www.w3.org/2000/svg';
const W = D.W, H = D.H, S = D.S, PAD = D.PAD, LONL = D.lonLeft, MERC_TOP = D.mercTop, HS = D.hexSize;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MSHT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------------- projection (matches data.js exactly) ---------------- */
function mercDeg(lat) { return 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); }
function toXY(lon, lat) { return [(lon - LONL) * S + PAD, (MERC_TOP - mercDeg(lat)) * S + PAD]; }
function toLonLat(x, y) {
  const lon = (x - PAD) / S + LONL;
  const m = MERC_TOP - (y - PAD) / S;
  const lat = (2 * Math.atan(Math.exp(m * Math.PI / 180)) - Math.PI / 2) * 180 / Math.PI;
  return [lon, lat];
}
function insideEngland(lon, lat) {
  let inside = false;
  for (const ring of D.rings) {
    let j = ring.length - 1;
    for (let i = 0; i < ring.length; i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
      j = i;
    }
  }
  return inside;
}
function distKm(lat1, lon1, lat2, lon2) {
  const mid = (lat1 + lat2) / 2 * Math.PI / 180;
  return Math.hypot((lon1 - lon2) * 111.32 * Math.cos(mid), (lat1 - lat2) * 110.57);
}
function hash01(i) { const s = Math.sin(i * 127.1 + 13.7) * 43758.5453; return s - Math.floor(s); }

/* ---------------- species ----------------
   season: 12 values (Jan..Dec) 0..1
   spots: [lat, lon, sigmaDeg, weight]  (classic habitat hotspots)
   clim: latitude adjustment per degree from 52.8N
--------------------------------------------*/
const SPECIES = [
  { id: 'oyster', name: 'Oyster mushroom', latin: 'Pleurotus ostreatus', color: '#5f8896', clim: 0.02,
    season: [0.35, 0.30, 0.25, 0.25, 0.30, 0.35, 0.55, 0.75, 0.90, 0.90, 0.65, 0.45],
    spots: [[53.35, -1.85, 0.60, 0.80], [53.10, -1.40, 0.50, 0.70], [50.90, -1.50, 0.50, 0.70],
            [51.85, -2.40, 0.50, 0.60], [54.10, -2.20, 0.60, 0.60], [51.50, -0.30, 0.70, 0.70],
            [53.20, -2.70, 0.50, 0.55], [51.10, -3.80, 0.50, 0.55], [54.55, -1.60, 0.50, 0.50]],
    tip: 'Shelf clusters on dead and dying hardwoods — willow, poplar, sycamore — in woodlands, hedgerows and even big city parks. Great in autumn and after cold snaps.' },
  { id: 'cep', name: 'Cep (Porcini)', latin: 'Boletus edulis', color: '#7a4f24', clim: 0.04,
    season: [0.05, 0.05, 0.10, 0.25, 0.40, 0.55, 0.80, 0.95, 0.95, 0.70, 0.30, 0.10],
    spots: [[53.30, -1.80, 0.50, 0.90], [54.10, -2.30, 0.55, 0.70], [51.85, -2.40, 0.45, 0.80],
            [53.10, -1.35, 0.45, 0.60], [50.90, -1.55, 0.45, 0.80], [51.20, -2.90, 0.45, 0.60],
            [53.90, -2.40, 0.45, 0.50], [54.50, -2.50, 0.60, 0.45], [51.15, -3.70, 0.45, 0.50]],
    tip: 'The classic woodlands: oak, birch and Scots pine. Look after summer rain, in moss and leaf litter — the fat ones hide shallow. Check the pore layer, not gills.' },
  { id: 'chanterelle', name: 'Chanterelle', latin: 'Cantharellus cibarius', color: '#e2a33c', clim: 0.05,
    season: [0.05, 0.05, 0.35, 0.55, 0.40, 0.15, 0.10, 0.30, 0.85, 0.90, 0.45, 0.15],
    spots: [[54.45, -1.00, 0.55, 0.85], [54.60, -2.00, 0.50, 0.40], [53.85, -0.30, 0.50, 0.60],
            [55.10, -2.60, 0.60, 0.60], [52.30, 1.40, 0.50, 0.55], [53.90, -2.40, 0.45, 0.50],
            [52.60, 0.30, 0.60, 0.50], [51.10, -3.80, 0.50, 0.35]],
    tip: 'Favours heathland, sandy soils and old conifer plantations — the North York Moors and East Anglia are classic ground. Spring and autumn flushes; beware the false chanterelle.' },
  { id: 'morel', name: 'Morel', latin: 'Morchella esculenta', color: '#c08a3e', clim: 0.03,
    season: [0.10, 0.15, 0.55, 0.90, 0.95, 0.50, 0.10, 0.05, 0.05, 0.10, 0.25, 0.30],
    spots: [[51.50, 0.00, 0.90, 0.80], [52.80, 0.00, 0.90, 0.60], [53.80, -1.20, 0.90, 0.50],
            [53.30, -1.80, 0.60, 0.60], [52.40, 1.30, 0.60, 0.70], [51.80, -1.40, 0.50, 0.60],
            [50.90, -1.50, 0.50, 0.60]],
    tip: 'Disturbed ground: old gardens, fire burns, cut tree stumps, old chalk pits and roadside verges. Spring is the season — always cook them well and confirm the cap is hollow.' },
  { id: 'hedgehog', name: 'Hedgehog mushroom', latin: 'Hydnum repandum', color: '#cfae7f', clim: 0,
    season: [0.05, 0.05, 0.10, 0.15, 0.25, 0.35, 0.55, 0.75, 0.90, 0.90, 0.70, 0.40],
    spots: [[50.90, -1.50, 0.50, 0.90], [51.20, -2.90, 0.45, 0.70], [51.85, -2.40, 0.50, 0.70],
            [53.35, -1.90, 0.50, 0.70], [54.10, -2.30, 0.55, 0.60], [53.90, -2.40, 0.45, 0.55],
            [51.10, -3.70, 0.50, 0.60], [52.30, 1.30, 0.40, 0.40]],
    tip: 'Beachy and beech woods are prime — the New Forest and Quantock do very well. Under the moss after rain; no look-alikes of real concern, a gentle first forage.' },
  { id: 'field', name: 'Field mushroom', latin: 'Agaricus campestris', color: '#a3946a', clim: 0.05,
    season: [0.05, 0.05, 0.15, 0.40, 0.75, 0.85, 0.85, 0.80, 0.65, 0.45, 0.20, 0.10],
    spots: [[50.90, -0.60, 0.50, 0.90], [51.20, 0.10, 0.50, 0.70], [51.80, -1.40, 0.45, 0.70],
            [51.90, -1.90, 0.45, 0.50], [51.80, -0.70, 0.45, 0.60], [51.10, -1.80, 0.45, 0.60],
            [51.20, -2.90, 0.40, 0.50], [52.50, 0.70, 0.50, 0.50]],
    tip: 'Grassland and chalk downland — the South Downs and North Downs are the best country. Smell test: pear-like. Never take an unknown agaric from grassland without a full ID.' },
  { id: 'honey', name: 'Honey fungus', latin: 'Armillaria mellea', color: '#d4a24e', clim: 0,
    season: [0.10, 0.10, 0.15, 0.20, 0.30, 0.40, 0.60, 0.80, 0.90, 0.90, 0.75, 0.50],
    spots: [[53.35, -1.85, 0.60, 0.80], [53.10, -1.40, 0.50, 0.70], [50.90, -1.50, 0.50, 0.80],
            [51.85, -2.40, 0.50, 0.70], [54.10, -2.30, 0.60, 0.60], [51.20, -2.90, 0.45, 0.60],
            [51.10, -3.70, 0.50, 0.60], [53.90, -2.40, 0.45, 0.50]],
    tip: 'Autumn rings around stumps, roots and tree bases in most native woodland — look for the white mycelial cords and stringy volva. Cook thoroughly; mild on some people.' },
  { id: 'waxcap', name: 'Wax caps & bonnets', latin: 'Hygrocybe & Hygrophorus', color: '#d1495b', clim: 0.04,
    season: [0.05, 0.05, 0.15, 0.35, 0.45, 0.30, 0.25, 0.45, 0.85, 0.90, 0.60, 0.25],
    spots: [[54.45, -1.00, 0.55, 0.85], [54.10, -2.20, 0.55, 0.70], [53.85, -0.30, 0.50, 0.60],
            [51.10, -3.80, 0.50, 0.65], [53.30, -1.80, 0.50, 0.55], [55.10, -2.60, 0.55, 0.55],
            [52.50, 1.50, 0.50, 0.60], [52.70, 1.30, 0.40, 0.50]],
    tip: 'Damp unimproved acid grass — moorland margins and heath pastures in the north and on Exmoor. Autumn bonnets and winter wax caps. Not for eating; these are a spotting pleasure.' },
];
const spById = id => SPECIES.find(s => s.id === id);

/* ---------------- field guide ---------------- */
const GUIDES = {
  oyster: {
    inat: 'Pleurotus ostreatus',
    id: 'Fan-shaped caps with shelf-like ridges running from the stem; gills run down the stem; bluish tinge where bruised; grows on wood, never from the ground.',
    look: 'Dead or dying hardwoods — willow, poplar, sycamore, lime — in woods, hedgerows and river banks. Best after autumn leaf-fall and after hard frosts.',
    watch: 'Only take from clearly dead wood. Ground-growing look-alikes exist — if it’s on soil, put it back and ID properly.' },
  cep: {
    inat: 'Boletus edulis',
    id: 'Spongy pores under the cap (no gills); pale cream pores, flesh does not stain; fat white stalk; sweet, nutty smell.',
    look: 'Leaf litter under oak, birch and Scots pine; mossy clearing edges. Check 24–72 h after heavy rain, late summer into autumn.',
    watch: 'Avoid boletes with red pores or flesh staining blue — Saddle, Fly and Red-billed Boletes are all harmful and young ones look similar.' },
  chanterelle: {
    inat: 'Cantharellus cibarius',
    id: 'Egg-yolk to golden, trumpet-shaped, blunt false ridges running down the stem, solid flesh, apricot scent.',
    look: 'Mossy ground under beech and oak, heathland and sandy soils. In South Yorkshire the Dales and moors to the north are the best bet.',
    watch: 'False chanterelles have orange ridges that stop at the stem or a white spore print (Omphalotus is poisonous). When in doubt, leave it.' },
  morel: {
    inat: 'Morchella',
    id: 'Honeycombed conical cap, hollow all the way through to the base, stalk attached, no brain-like lobes.',
    look: 'April–May on disturbed ground: old gardens, burn sites, cut stumps, old pits, verges. The more the ground was disturbed, the better.',
    watch: 'False morels (Gyromitra) are brain-lobed, solid inside, and poisonous. Cut any morel lengthways: it must be empty.' },
  hedgehog: {
    inat: 'Hydnum repandum',
    id: 'Cream to tan, round cap with soft spines on the underside, solid flesh, turns pinkish-brown with age.',
    look: 'Mossy beech and oak woods — local old woodland does well; the New Forest and Quantock are famous. Autumn, after rain.',
    watch: 'No serious toxic look-alikes — one of the safer first picks, but still confirm with more than one guide.' },
  field: {
    inat: 'Agaricus campestris',
    id: 'Small white cap, gills going pink then chocolate-brown, white spore print, pear-like smell, bruises brown.',
    look: 'Mature grassland, best on chalk downland in the south. Summer–autumn after a wet spell; morning picking.',
    watch: 'Grass Agaricus is the hardest ID group in foraging — lethal look-alikes exist. Take only with a full 4-part check (gill colour, spore print, smell, bruising).' },
  honey: {
    inat: 'Armillaria mellea',
    id: 'Honey-brown cap with dark scales, pink gills, white ring, anise smell; white mycelial cords at the base.',
    look: 'Rings around stumps, roots and tree bases in autumn. The white cords at ground level are your confirmation of a stump colony.',
    watch: 'Young Death Caps can resemble young honey fungus. Only take mature specimens at stumps where you can see the cords — never buttons.' },
  waxcap: {
    inat: 'Hygrocybe',
    id: 'Jelly-like, brightly coloured (red, orange, yellow), small, on grass — gel in a hat.',
    look: 'Damp unimproved acid grass: heath edges and moorland pastures in autumn. A spotting pleasure — not for eating.',
    watch: 'Not eaten (small, fragile). A handful of waxcaps in one pasture tells you the field is clean and well-managed — a sign of good habitat.' },
};

const LOCAL_PLACES = [
  { name: 'River Don & Dearne willow belts', dist: 'around the town',
    what: 'Oyster mushrooms on dead willow and poplar along the banks — check every dead snag after leaf-fall.',
    when: 'autumn–winter, big flushes after hard frost',
    perm: 'Riverside access varies by reach — check each spot and local bylaws.' },
  { name: 'Rosthorn Common & woods', dist: '~1 mi S',
    what: 'Open moor and birch/oak woods on old peat — morels in old ditches & hollows (spring), oysters on dead birch, waxcaps on damp open ground after rain.',
    when: 'spring for morels; autumn for the rest',
    perm: 'Common land — personal foraging is traditional but check Barnsley MBC bylaws; keep to paths on wet peat.' },
  { name: 'RSPB Old Moor', dist: '~2 mi E',
    what: 'Heath and birch woodland — good for scouting what grows (waxcaps, autumn bonnets) and learning the habitat.',
    when: 'autumn',
    perm: 'RSPB rules: no picking — scouting only.' },
  { name: 'Old village greens, churchyards & hedgerows', dist: 'Barnsley, Sprotbrough, Penistone, Wentworth',
    what: 'Old trees, stumps and damp corners — morels around old trees in spring, oysters on old stumps in autumn.',
    when: 'spring morels; autumn oysters',
    perm: 'Ask first on managed churchyards; greens are usually public realm.' },
  { name: 'Blackburn Meadows / Cank Hill / Blacker Hill', dist: '1–2 mi NE',
    what: 'Parkland, old orchards and mixed woods — morels, oysters, honey fungus at old stumps.',
    when: 'spring + autumn, after rain',
    perm: 'Check park rules with the council; orchards may be private land.' },
  { name: 'East Peak (Hope Valley)', dist: '25–35 min drive',
    what: 'Proper big woods — oak, beech, pine. Your best local chance at ceps, chanterelles, hedgehogs and birch boletes.',
    when: 'Sep–Oct after rain',
    perm: 'National Park commons — personal foraging generally OK; keep off SSSIs.' },
  { name: 'Yorkshire Dales', dist: '~1 hr',
    what: 'Heathland and dale edges — the region’s classic chanterelle and waxcap country.',
    when: 'autumn',
    perm: 'National Park — same rules; watch bracken depth and stock routes.' },
];

const TIMING = [
  '<b>The magic window:</b> 24–72 h after 5 mm+ of rain for woodland species (ceps, chanterelles, hedgehogs).',
  'Grassland species (field mushrooms, waxcaps) come up 1–2 days after lighter rain.',
  'Go in the <b>morning</b> — soft light reveals colour, and mushrooms are firmest before the heat.',
  'Oysters ignore the rain calendar: they run through autumn and winter, and a hard frost often triggers the big flushes.',
  'Morels: 2–4 weeks after the last hard frost, first warm spell of April–May.',
  'Mushrooms fruit in clusters — find one, mark the spot, go back tomorrow. Same wood, same corner.',
  'Leave the small and the old to drop spores; take what you need from a healthy patch.',
  'Local foragers’ consensus: South Yorkshire is birch-bolete, oyster and morel country — chanterelles are rarer here; the Dales and East Peak are where you go for a big flush.',
];

/* ---------------- regions (nearest-centre labelling) ---------------- */
const REGIONS = [
  ['Northumberland', 55.25, -2.50],
  ['North York Moors', 54.50, -1.10],
  ['Yorkshire Dales', 54.15, -2.30],
  ['Lincolnshire Wolds', 53.75, -0.40],
  ['South Yorkshire & Barnsley', 53.52, -1.48],
  ['Peak District', 53.28, -1.90],
  ['Cheshire & Merseyside', 53.30, -2.70],
  ['Sherwood & East Midlands', 52.95, -1.20],
  ['East Anglia', 52.45, 0.60],
  ['London & Home Counties', 51.55, -0.20],
  ['Wychwood & Oxfordshire', 51.85, -1.40],
  ['Cotswolds & Forest of Dean', 51.85, -2.40],
  ['South Downs & Sussex', 50.95, -0.60],
  ['Wessex & New Forest', 51.00, -1.60],
  ['Somerset & Quantock', 51.20, -2.90],
  ['Devon & Exmoor', 51.00, -3.80],
  ['Cornwall', 50.40, -4.90],
  ['Shropshire & Welsh Border', 52.65, -2.70],
  ['Lancashire & Pennines', 53.80, -2.60],
];
function regionName(lat, lon) {
  let best = null, bd = 1e9;
  for (const [name, lat2, lon2] of REGIONS) {
    const d = (lat - lat2) ** 2 + (lon - lon2) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return bd > 1.4 ? 'Elsewhere in England' : best;
}

/* ---------------- chance model ---------------- */
function chanceAt(lat, lon, sp, month, idx) {
  const seasonal = sp.season[month];
  if (seasonal <= 0.02) return 0;
  let habitat = 0.06;
  for (const h of sp.spots) {
    const dlat = lat - h[0], dlon = lon - h[1];
    habitat += h[3] * Math.exp(-(dlat * dlat + dlon * dlon) / (2 * h[2] * h[2]));
  }
  let clim = 1 + sp.clim * (lat - 52.8);
  if (clim < 0.7) clim = 0.7;
  if (clim > 1.35) clim = 1.35;
  const noise = idx < 0 ? 1 : 0.85 + 0.30 * hash01(idx);
  return 1 - Math.exp(-3.2 * seasonal * habitat * clim * noise);
}
function chanceColor(t) {
  const hue = 45 - 33 * t;
  const sat = 75 - 5 * t;
  const lit = 78 - 34 * t;
  const alpha = 0.10 + 0.60 * t;
  return `hsla(${hue.toFixed(1)},${sat.toFixed(1)}%,${lit.toFixed(1)}%,${alpha.toFixed(3)})`;
}
const cache = {};
function chancesFor(sp, month) {
  const key = sp.id + ':' + month;
  if (cache[key]) return cache[key];
  const arr = new Float32Array(D.hexes.length);
  let max = 0, mi = 0;
  for (let i = 0; i < D.hexes.length; i++) {
    const h = D.hexes[i];
    const t = chanceAt(h[0], h[1], sp, month, i);
    arr[i] = t;
    if (t > max) { max = t; mi = i; }
  }
  const out = { arr, max, mi };
  cache[key] = out;
  return out;
}

/* ---------------- DOM refs ---------------- */
const $ = id => document.getElementById(id);
const svg = $('map'), world = $('world'), land = $('land'),
  hexLayer = $('hexLayer'), spotLayer = $('spotLayer'), homeMarker = $('homeMarker'),
  mapWrap = $('mapWrap'), tipEl = $('hexTip'), toastEl = $('toast'),
  spotCard = $('spotCard'), formEl = $('spotForm'), formBack = $('formBack'),
  bannerEl = $('addBanner');

svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
land.setAttribute('d', D.path);

const [BX, BY] = toXY(D.barnsley[1], D.barnsley[0]);

/* home marker (Barnsley) */
homeMarker.innerHTML =
  `<path d="M0 0 C -8 -9 -12 -15 -12 -21 A 12 12 0 1 1 12 -21 C 12 -15 8 -9 0 0 Z"
        fill="#2f5233" stroke="#fffdf7" stroke-width="1.6"/>
   <circle cx="0" cy="-21" r="5" fill="#fffdf7"/>
   <text x="0" y="-38" text-anchor="middle" font-size="11" font-weight="700"
         fill="#2b3327" stroke="#f7f2e6" stroke-width="3" paint-order="stroke">Barnsley · home</text>`;

/* "you are here" crosshair marker */
const locMarker = document.createElementNS(NS, 'g');
locMarker.id = 'locMarker';
locMarker.innerHTML =
  `<circle r="10" fill="rgba(217,119,6,0.18)" stroke="#d97706" stroke-width="2"/>
   <circle r="2.8" fill="#d97706"/>
   <text x="0" y="-16" text-anchor="middle" font-size="10" font-weight="700"
         fill="#8a4d05" stroke="#f7f2e6" stroke-width="3" paint-order="stroke">you</text>`;
locMarker.classList.add('hidden');
world.appendChild(locMarker);

/* ---------------- view (pan/zoom) ---------------- */
let view = { x: 0, y: 0, k: 1 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function applyView() {
  world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  const s = 1 / view.k;
  homeMarker.setAttribute('transform', `translate(${BX} ${BY}) scale(${s})`);
  if (!locMarker.classList.contains('hidden') && locMarker.dataset.x) {
    locMarker.setAttribute('transform', `translate(${locMarker.dataset.x} ${locMarker.dataset.y}) scale(${s})`);
  }
  spotLayer.querySelectorAll('.marker').forEach(m => {
    m.setAttribute('transform', `translate(${m.dataset.x} ${m.dataset.y}) scale(${s})`);
  });
}
function setView(x, y, k, ax, ay) {
  k = clamp(k, 1, 10);
  if (ax !== undefined) {
    const wx = (ax - x) / view.k, wy = (ay - y) / view.k;
    x = ax - wx * k;
    y = ay - wy * k;
  }
  view = { x: clamp(x, W - W * k, 0), y: clamp(y, H - H * k, 0), k };
  applyView();
}
function homeView(k = 2.4) {
  setView(W / 2 - k * BX, H / 2 - k * BY, k);
}
function clientToView(cx, cy) {
  const ctm = svg.getScreenCTM ? svg.getScreenCTM() : null;
  if (!ctm) return [W / 2, H / 2];
  const inv = ctm.inverse();
  return [inv.a * cx + inv.c * cy + inv.e, inv.b * cx + inv.d * cy + inv.f];
}

/* pointer pan / pinch / tap */
const pointers = new Map();
let pinch = null, downPos = null, moved = 0;

svg.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  downPos = { x: e.clientX, y: e.clientY };
  moved = 0;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
  }
});
svg.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  moved += Math.hypot(dx, dy);
  if (pointers.size === 1) {
    const ctm = svg.getScreenCTM();
    const sc = ctm ? ctm.a : 1;
    setView(view.x + dx / sc, view.y + dy / sc, view.k);
  } else if (pointers.size === 2 && pinch) {
    const [a, b] = [...pointers.values()];
    const nd = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    const [vx, vy] = clientToView(mid[0], mid[1]);
    setView(view.x, view.y, clamp(pinch.k * nd / pinch.d, 1, 10), vx, vy);
  }
});
function endPointer(e) {
  const wasTap = downPos && moved < 7 && pointers.size === 1 && !pinch;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (wasTap && pointers.size === 0) onTap(e.clientX, e.clientY);
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; });

mapWrap.addEventListener('wheel', e => {
  e.preventDefault();
  const [vx, vy] = clientToView(e.clientX, e.clientY);
  setView(view.x, view.y, view.k * Math.exp(-e.deltaY * 0.0016), vx, vy);
}, { passive: false });

svg.addEventListener('dblclick', e => {
  const [vx, vy] = clientToView(e.clientX, e.clientY);
  setView(view.x, view.y, view.k * 1.8, vx, vy);
});

$('zoomIn').addEventListener('click', () => setView(view.x, view.y, view.k * 1.6, W / 2, H / 2));
$('zoomOut').addEventListener('click', () => setView(view.x, view.y, view.k / 1.6, W / 2, H / 2));
$('zoomHome').addEventListener('click', () => { homeView(); hideTip(); hideSpotCard(); });

/* ---------------- hex layer ---------------- */
let hexEls = [];
(function buildHexes() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < D.hexes.length; i++) {
    const h = D.hexes[i];
    const pts = [];
    for (let a = 0; a < 6; a++) {
      const ang = Math.PI / 180 * (60 * a + 30);
      pts.push((h[2] + HS * Math.cos(ang)).toFixed(1) + ',' + (h[3] + HS * Math.sin(ang)).toFixed(1));
    }
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', pts.join(' '));
    poly.setAttribute('class', 'hex');
    poly.setAttribute('vector-effect', 'non-scaling-stroke');
    poly.setAttribute('fill', 'hsla(45,75%,78%,0.1)');
    frag.appendChild(poly);
    hexEls.push(poly);
  }
  hexLayer.appendChild(frag);
})();

/* ---------------- state ---------------- */
let month = new Date().getMonth();
let selSpecies = null;
let addMode = false;
let pending = null;        // {lat, lon} while placing
let previewEl = null;

function topSpeciesFor(m) {
  return SPECIES
    .map(sp => ({ sp, c: chancesFor(sp, m).max }))
    .sort((a, b) => b.c - a.c);
}
function initSpecies() {
  selSpecies = topSpeciesFor(month)[0].sp.id;
}

/* ---------------- overlay + panel ---------------- */
function paintOverlay() {
  const c = chancesFor(spById(selSpecies), month);
  for (let i = 0; i < D.hexes.length; i++) {
    hexEls[i].setAttribute('fill', chanceColor(c.arr[i]));
  }
  $('legendCap').innerHTML =
    `<b>${spById(selSpecies).name}</b> · ${MONTHS[month]}<br>chance by hex — model estimate`;
}
function bestMonthsLabel(sp) {
  const idx = sp.season.map((v, i) => (v >= 0.6 ? i : -1)).filter(i => i >= 0);
  if (!idx.length) return '—';
  const ranges = [];
  let s = idx[0], e = idx[0];
  for (let i = 1; i <= idx.length; i++) {
    if (i < idx.length && idx[i] === idx[i - 1] + 1) { e = idx[i]; continue; }
    ranges.push(s === e ? MSHT[s] : `${MSHT[s]} – ${MSHT[e]}`);
    if (i < idx.length) { s = idx[i]; e = idx[i]; }
  }
  return ranges.join(', ');
}
function renderPicks() {
  const top = topSpeciesFor(month).slice(0, 3);
  $('picksTitle').textContent = `Best picks in ${MONTHS[month]}`;
  $('picks').innerHTML = '';
  top.forEach(({ sp, c }) => {
    const b = document.createElement('button');
    b.className = 'pick' + (sp.id === selSpecies ? ' on' : '');
    b.innerHTML = `<span class="dot" style="background:${sp.color}"></span>
      <span class="nm">${sp.name}</span><span class="pc">${Math.round(c * 100)}%</span>`;
    b.addEventListener('click', () => { selSpecies = sp.id; renderAll(); });
    $('picks').appendChild(b);
  });
}
function renderChips() {
  const box = $('speciesList');
  box.innerHTML = '';
  for (const sp of SPECIES) {
    const c = chancesFor(sp, month).max;
    const b = document.createElement('button');
    b.className = 'chip' + (sp.id === selSpecies ? ' on' : '');
    b.innerHTML = `<span class="dot" style="background:${sp.color}"></span>
      <span>${sp.name}</span><span class="pc">${Math.round(c * 100)}%</span>`;
    b.addEventListener('click', () => { selSpecies = sp.id; renderAll(); });
    box.appendChild(b);
  }
}
function renderDetail() {
  const sp = spById(selSpecies);
  const c = chancesFor(sp, month);
  const best = D.hexes[c.mi];
  const near = D.hexes
    .map((h, i) => ({ t: c.arr[i], d: distKm(h[0], h[1], D.barnsley[0], D.barnsley[1]), h }))
    .filter(o => o.d <= 40 && o.t > 0.04)
    .sort((a, b) => b.t - a.t)
    .slice(0, 4);
  $('detail').innerHTML = `
    <h2><span class="dot" style="background:${sp.color};width:15px;height:15px"></span>${sp.name}</h2>
    <div class="latin">${sp.latin}</div>
    <div class="months">Peak: <b>${bestMonthsLabel(sp)}</b></div>
    <div class="bigrow">
      <div class="big">${Math.round(c.max * 100)}%</div>
      <div class="biglbl">best chance in England in ${MONTHS[month]}<br>
        <b>${regionName(best[0], best[1])}</b></div>
    </div>
    <div class="barwrap"><div class="barfill" style="width:${Math.round(c.max * 100)}%"></div></div>
    <div class="tip">${sp.tip}</div>
    ${near.length ? `
    <div id="near">
      <h3>Near Barnsley (≤ 25 mi)</h3>
      ${near.map(o => `
        <div class="row">
          <span class="nm">${regionName(o.h[0], o.h[1])}</span>
          <span class="mi">${Math.round(o.d * 0.6214)} mi</span>
          <span class="pc">${Math.round(o.t * 100)}%</span>
        </div>`).join('')}
    </div>` : ''}
    <div class="tip" style="border-top:1px dashed var(--line);margin-top:12px;padding-top:10px">
      <b style="color:var(--amber)">Look for:</b> ${GUIDES[sp.id].look}
      <div style="margin-top:6px"><a href="https://www.inaturalist.org/search?q=${encodeURIComponent(GUIDES[sp.id].inat)}"
        target="_blank" rel="noopener" style="color:var(--green-2);font-weight:600">Verified records near you: iNaturalist ↗</a></div>
    </div>`;
}
function renderMonthStrip() {
  const box = $('monthStrip');
  box.innerHTML = '';
  MSHT.forEach((m, i) => {
    const b = document.createElement('button');
    b.textContent = m;
    b.className = i === month ? 'on' : '';
    b.addEventListener('click', () => { month = i; renderAll(); });
    box.appendChild(b);
  });
  $('monthTitle').textContent = 'Season — tap a month';
}
function renderAll() {
  paintOverlay();
  renderPicks();
  renderChips();
  renderDetail();
  renderMonthStrip();
  renderNearYou();
  if (spotCard && !spotCard.classList.contains('hidden')) {
    const f = finds.find(x => x.id === openSpotId);
    if (f) showSpotPopup(f);
  }
}

/* ---------------- hex tooltip ---------------- */
let tipTimer = null;
function showHexTip(clientX, clientY, hexIdx) {
  const h = D.hexes[hexIdx];
  const sp = spById(selSpecies);
  const t = chanceAt(h[0], h[1], sp, month, hexIdx);
  tipEl.innerHTML = `<div class="pct">${Math.round(t * 100)}%</div>
    <div class="reg">${regionName(h[0], h[1])}</div>
    <div>${sp.name} · ${MONTHS[month]}</div>
    <div style="color:var(--muted);font-size:11px">model estimate — not a guarantee</div>`;
  tipEl.classList.remove('hidden');
  const r = mapWrap.getBoundingClientRect();
  const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
  let left = clientX - r.left + 14;
  let top = clientY - r.top - th - 10;
  if (left + tw > r.width - 8) left = clientX - r.left - tw - 14;
  if (left < 8) left = 8;
  if (top < 8) top = clientY - r.top + 14;
  tipEl.style.left = left + 'px';
  tipEl.style.top = top + 'px';
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, 3400);
}
function hideTip() {
  tipEl.classList.add('hidden');
  clearTimeout(tipTimer);
}

/* ---------------- finds (spots) ---------------- */
let finds = loadFinds();
function loadFinds() {
  try { return JSON.parse(localStorage.getItem('sporing.finds.v1')) || []; }
  catch { return []; }
}
function saveFinds() {
  try { localStorage.setItem('sporing.finds.v1', JSON.stringify(finds)); } catch { /* private mode */ }
}
const CONF = { 1: 'Low', 2: 'Medium', 3: 'High' };
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MSHT[m - 1]} ${y}`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function renderSpots() {
  spotLayer.innerHTML = '';
  const s = 1 / view.k;
  finds.forEach(f => {
    const sp = spById(f.sp);
    if (!sp) return;
    const [x, y] = toXY(f.lon, f.lat);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'marker' + (f.sp === selSpecies ? '' : ' dim'));
    g.style.cursor = 'pointer';
    g.dataset.x = x; g.dataset.y = y; g.dataset.id = f.id;
    g.setAttribute('transform', `translate(${x} ${y}) scale(${s})`);
    g.innerHTML =
      `<circle r="15" fill="rgba(0,0,0,0)"/>
       <path d="M -9 0 A 9 9 0 0 1 9 0 Z" fill="${sp.color}" stroke="#fffdf7" stroke-width="1.3"/>
       <path d="M -3 0 h 6 v 6.5 a 3 3 0 0 1 -6 0 Z" fill="#f2e8d5" stroke="#fffdf7" stroke-width="1"/>
       <circle cx="-3.8" cy="-4" r="1.7" fill="#fff" opacity="0.9"/>
       <circle cx="2.4" cy="-5.6" r="1.4" fill="#fff" opacity="0.9"/>`;
    spotLayer.appendChild(g);
  });
  $('findCount').textContent = finds.length ? `(${finds.length})` : '';
  renderFindsList();
}
function renderFindsList() {
  const box = $('findsList');
  box.innerHTML = '';
  if (!finds.length) {
    box.innerHTML = '<div class="empty">No finds logged yet. Pick a mushroom, then tap <b>Log a find</b> and drop a pin where you found it.</div>';
    return;
  }
  const sorted = [...finds].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 40);
  sorted.forEach(f => {
    const sp = spById(f.sp);
    const b = document.createElement('button');
    b.className = 'find';
    b.innerHTML = `<span class="dot" style="background:${sp.color}"></span>
      <span class="fmeta"><span class="fnm">${sp.name}</span><br>
      <span class="fsub">${regionName(f.lat, f.lon)} · ${fmtDate(f.date)}</span></span>
      <span class="fconf">${CONF[f.conf] || ''}</span>`;
    b.addEventListener('click', () => {
      const [x, y] = toXY(f.lon, f.lat);
      const k = Math.max(view.k, 3.2);
      setView(W / 2 - k * x, H / 2 - k * y, k);
      showSpotPopup(f);
    });
    box.appendChild(b);
  });
}

/* spot popup */
let openSpotId = null;
function showSpotPopup(f) {
  const sp = spById(f.sp);
  const t = chanceAt(f.lat, f.lon, sp, month, -1);
  openSpotId = f.id;
  spotCard.innerHTML = `
    <h3><span class="dot" style="background:${sp.color};width:14px;height:14px"></span>${sp.name}</h3>
    <div class="srow"><b>${regionName(f.lat, f.lon)}</b> · ${fmtDate(f.date)} · ID: ${CONF[f.conf] || '—'}</div>
    <div class="srow">Chance here in ${MONTHS[month]}: <b>${Math.round(t * 100)}%</b> (model estimate)</div>
    ${f.note ? `<div class="snote">“${esc(f.note)}”</div>` : ''}
    <div class="sbtns">
      <button class="btn del" id="spotDel">Delete</button>
      <button class="btn" id="spotClose">Close</button>
    </div>`;
  spotCard.classList.remove('hidden');
  $('spotDel').addEventListener('click', () => {
    finds = finds.filter(x => x.id !== f.id);
    saveFinds();
    renderSpots();
    hideSpotCard();
    toast('Find deleted');
  });
  $('spotClose').addEventListener('click', hideSpotCard);
}
function hideSpotCard() {
  spotCard.classList.add('hidden');
  openSpotId = null;
}

/* ---------------- add-spot flow ---------------- */
function setAddMode(on) {
  addMode = on;
  bannerEl.classList.toggle('hidden', !on);
  const b = $('btnAdd');
  b.classList.toggle('adding', on);
  b.textContent = on ? 'Cancel' : '+ Log a find';
  if (!on) clearPreview();
}
function clearPreview() {
  if (previewEl) { previewEl.remove(); previewEl = null; }
  closeForm();
}
function onTap(cx, cy) {
  const el = document.elementFromPoint(cx, cy);
  const marker = el && el.closest ? el.closest('.marker') : null;
  const hex = el && el.closest ? el.closest('.hex') : null;

  if (addMode) {
    const [vx, vy] = clientToView(cx, cy);
    const wx = (vx - view.x) / view.k, wy = (vy - view.y) / view.k;
    const [lon, lat] = toLonLat(wx, wy);
    if (!insideEngland(lon, lat)) {
      toast('That’s outside England — pick a spot on the map');
      return;
    }
    pending = { lat, lon };
    showPreview(wx, wy);
    openForm();
    return;
  }
  if (marker) {
    const f = finds.find(x => x.id === marker.dataset.id);
    if (f) { hideTip(); showSpotPopup(f); }
    return;
  }
  if (hex && hexEls.indexOf(hex) >= 0) {
    showHexTip(cx, cy, hexEls.indexOf(hex));
    return;
  }
  hideTip();
}
function showPreview(wx, wy) {
  clearPreviewNode();
  previewEl = document.createElementNS(NS, 'g');
  previewEl.setAttribute('transform', `translate(${wx} ${wy}) scale(${1 / view.k})`);
  previewEl.innerHTML =
    `<circle r="11" fill="rgba(217,119,6,0.25)" stroke="#d97706" stroke-width="2" stroke-dasharray="4 3"/>
     <circle r="3.5" fill="#d97706"/>`;
  world.appendChild(previewEl);
}
function clearPreviewNode() {
  if (previewEl) { previewEl.remove(); previewEl = null; }
}
let conf = 2;
function openForm() {
  const sp = spById(selSpecies);
  const p = pending;
  $('formTitle').textContent = `Log a find — ${sp.name}`;
  $('formLoc').textContent = `${regionName(p.lat, p.lon)} · ${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}`;
  $('fDate').value = new Date().toISOString().slice(0, 10);
  $('fNote').value = '';
  conf = 2;
  document.querySelectorAll('#confSeg button').forEach(b => b.classList.toggle('on', +b.dataset.c === conf));
  formBack.classList.remove('hidden');
  formEl.classList.remove('hidden');
}
function closeForm() {
  formBack.classList.add('hidden');
  formEl.classList.add('hidden');
}
$('btnAdd').addEventListener('click', () => setAddMode(!addMode));
document.querySelectorAll('#confSeg button').forEach(b => {
  b.addEventListener('click', () => {
    conf = +b.dataset.c;
    document.querySelectorAll('#confSeg button').forEach(x => x.classList.toggle('on', x === b));
  });
});
formEl.addEventListener('submit', e => {
  e.preventDefault();
  if (!pending) return;
  finds.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    sp: selSpecies,
    lat: pending.lat, lon: pending.lon,
    date: $('fDate').value || new Date().toISOString().slice(0, 10),
    note: $('fNote').value.trim(),
    conf,
  });
  saveFinds();
  pending = null;
  setAddMode(false);
  renderSpots();
  toast('Find logged 🍄');
});
$('fCancel').addEventListener('click', () => {
  pending = null;
  setAddMode(false);
  toast('Cancelled');
});
formBack.addEventListener('click', () => { pending = null; setAddMode(false); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!formEl.classList.contains('hidden')) { pending = null; setAddMode(false); }
    hideSpotCard();
    hideTip();
  }
});

/* ---------------- toast ---------------- */
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  toastEl.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.style.opacity = '0';
    setTimeout(() => toastEl.classList.add('hidden'), 220);
  }, 1900);
}

/* ---------------- info dialog + install ---------------- */
const infoDlg = $('infoDlg');
$('btnInfo').addEventListener('click', () => infoDlg.showModal());
$('btnCloseInfo').addEventListener('click', () => infoDlg.close());
infoDlg.addEventListener('click', e => { if (e.target === infoDlg) infoDlg.close(); });

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
$('btnInstall').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  } else {
    toast('Menu (⋮) → “Add to Home screen”');
  }
});

/* ---------------- near-you: location, postcode, nearest spots ---------------- */
let userLoc = null; // {lat, lon, label}
try {
  const saved = JSON.parse(localStorage.getItem('sporing.loc.v1'));
  if (saved && saved.lat) userLoc = saved;
} catch { /* ignore */ }

function saveLoc() {
  try { if (userLoc) localStorage.setItem('sporing.loc.v1', JSON.stringify(userLoc)); } catch { /* ignore */ }
}
function setLoc(lat, lon, label) {
  userLoc = { lat, lon, label };
  saveLoc();
  const [x, y] = toXY(lon, lat);
  locMarker.dataset.x = x; locMarker.dataset.y = y;
  locMarker.classList.remove('hidden');
  applyView();
  renderNearYou();
  updateLocName();
  toast(`Near <b>${esc(label)}</b>`);
}
function updateLocName() {
  const el = document.getElementById('locName');
  if (!el) return;
  el.innerHTML = userLoc
    ? `Showing distances from <b>${esc(userLoc.label)}</b> (${userLoc.lat.toFixed(3)}, ${userLoc.lon.toFixed(3)})`
    : `Showing distances from <b>Barnsley</b> (your home). Use your location or a postcode to personalise it.`;
}
function distBearing(aLat, aLon, bLat, bLon) {
  const dLat = (bLat - aLat) * 110.57;
  const dLon = (bLon - aLon) * 111.32 * Math.cos((aLat + bLat) / 2 * Math.PI / 180);
  const d = Math.hypot(dLat, dLon);
  let brg = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return { d, dir: dirs[Math.round(brg / 22.5) % 16] };
}
function fmtMi(km) { return km < 1 ? '<1 mi' : Math.round(km * 0.6214) + ' mi'; }

function renderNearYou() {
  const box = document.getElementById('nearYou');
  if (!box) return;
  const base = userLoc || { lat: D.barnsley[0], lon: D.barnsley[1] };
  const sp = spById(selSpecies);
  const c = chancesFor(sp, month);

  // closest logged finds
  const findsSorted = finds
    .map(f => ({ f, ...distBearing(base.lat, base.lon, f.lat, f.lon) }))
    .sort((a, b) => a.d - b.d).slice(0, 4);

  // best model hexes near the base point
  const spots = D.hexes
    .map((h, i) => ({ t: c.arr[i], h, ...distBearing(base.lat, base.lon, h[0], h[1]) }))
    .filter(o => o.d <= 50 && o.t > 0.12)
    .sort((a, b) => b.t - a.t).slice(0, 5);

  let html = `
    <div class="locrow">
      <button class="btn" id="btnLoc" type="button">📍 Use my location</button>
    </div>
    <form id="pcForm" autocomplete="off">
      <input id="pcInput" placeholder="Postcode, e.g. S70 2TA" maxlength="8">
      <button class="btn" type="submit">Find</button>
    </form>
    <div class="locname" id="locName"></div>`;

  if (findsSorted.length) {
    html += `<div class="nearhint" style="margin-top:4px"><b>Your closest finds</b> (${sp.name} highlighted):</div>`;
    html += findsSorted.map(o => {
      const fs = spById(o.f.sp);
      const dim = o.f.sp !== selSpecies ? 'style="opacity:.55"' : '';
      return `<div class="nearrow" ${dim}>
        <span class="dot" style="background:${fs.color}"></span>
        <span class="nm">${fs.name}<small>${regionName(o.f.lat, o.f.lon)} · ${fmtDate(o.f.date)}</small></span>
        <span class="mi">${o.dir} ${fmtMi(o.d)}</span></div>`;
    }).join('');
  } else {
    html += `<div class="nearhint" style="margin-top:4px">No finds logged yet — your closest finds will appear here.</div>`;
  }

  if (spots.length) {
    html += `<div class="nearhint" style="margin-top:8px"><b>Best ${sp.name.toLowerCase()} ground near you</b> — ${MONTHS[month]}:</div>`;
    html += spots.map(o => `
      <div class="nearrow">
        <span class="dot" style="background:${chanceColor(o.t)}"></span>
        <span class="nm">${regionName(o.h[0], o.h[1])}<small>${o.dir} · best ${Math.round(o.t * 100)}%</small></span>
        <span class="mi">${fmtMi(o.d)}</span>
        <button class="go" data-lat="${o.h[0]}" data-lon="${o.h[1]}">Go</button>
      </div>`).join('');
  } else {
    html += `<div class="nearhint" style="margin-top:8px">No strong ${sp.name.toLowerCase()} ground within 50 mi this month — try another month or species.</div>`;
  }
  const rkey = rainKey(base.lat, base.lon);
  html += `<div class="raincard" id="rainCard">${rainState.key === rkey && rainState.html ? rainState.html
    : '<div class="rt">Rain window — foraging timing</div><span class="nearhint">Checking the last 10 days of rain for this area…</span>'}</div>`;
  box.innerHTML = html;

  document.getElementById('btnLoc').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Location not available on this device');
    toast('Locating…');
    navigator.geolocation.getCurrentPosition(
      pos => setLoc(pos.coords.latitude, pos.coords.longitude, 'your location'),
      () => toast('Location unavailable — try a postcode'),
      { timeout: 10000, maximumAge: 300000 }
    );
  });
  document.getElementById('pcForm').addEventListener('submit', e => {
    e.preventDefault();
    const pc = document.getElementById('pcInput').value.trim().toUpperCase();
    if (!pc) return;
    fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`)
      .then(r => r.json())
      .then(j => {
        const r = j && j.result ? (Array.isArray(j.result) ? j.result[0] : j.result) : null;
        if (r && r.latitude != null) {
          setLoc(r.latitude, r.longitude, r.postcode || pc);
        } else toast('Postcode not found');
      })
      .catch(() => toast('Postcode lookup failed — check connection'));
  });
  box.querySelectorAll('.go').forEach(b => {
    b.addEventListener('click', () => {
      const lat = parseFloat(b.dataset.lat), lon = parseFloat(b.dataset.lon);
      const [x, y] = toXY(lon, lat);
      const k = Math.max(view.k, 3.4);
      setView(W / 2 - k * x, H / 2 - k * y, k);
    });
  });
  updateLocName();
  if (rainState.key !== rkey) fetchRain(base.lat, base.lon);
}

/* rain-window tracker (Open-Meteo, no key, CORS) */
let rainState = { key: '', html: '' };
const rainKey = (lat, lon) => lat.toFixed(2) + ',' + lon.toFixed(2) + ':' + new Date().getUTCHours();
async function fetchRain(lat, lon) {
  const rkey = rainKey(lat, lon);
  const card = document.getElementById('rainCard');
  if (!card) return;
  const set = (h, memo) => {
    card.innerHTML = `<div class="rt">Rain window — foraging timing</div>${h}`;
    if (memo) rainState = { key: rkey, html: card.innerHTML };
  };
  set('<span class="nearhint">Checking the last 10 days of rain for this area…</span>', false);
  if (typeof fetch !== 'function') {
    set('<span class="nearhint">Offline — rule of thumb: 24–72 h after 5 mm+ rain is the woodland window.</span>', true);
    return;
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&daily=precipitation_sum&past_days=10&forecast_days=4&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    const days = j.daily.time, pr = j.daily.precipitation_sum;
    const past = days.slice(0, 10), ppr = pr.slice(0, 10);
    const fc = days.slice(10), fpr = pr.slice(10);
    let heavy = -1, light = -1;
    for (let i = past.length - 1; i >= 0; i--) if (ppr[i] >= 5) { heavy = i; break; }
    for (let i = past.length - 1; i >= 0; i--) if (ppr[i] >= 2) { light = i; break; }
    const last = heavy >= 0 ? { i: heavy, mm: ppr[heavy], kind: 'heavy' }
      : light >= 0 ? { i: light, mm: ppr[light], kind: 'light' } : null;
    let msg = '';
    if (last) {
      const ago = past.length - 1 - last.i;
      if (last.kind === 'heavy') {
        if (ago <= 1) msg = `Heavy rain ${ago === 0 ? 'today' : 'yesterday'} (${Math.round(last.mm)} mm) — grassland species (field mushrooms, waxcaps) are on <span class="good">now</span>; the woods are starting.`;
        else if (ago <= 4) msg = `Heavy rain ${ago} days ago (${Math.round(last.mm)} mm) — <span class="good">prime woodland window</span>: ceps, chanterelles, hedgehogs. Go look.`;
        else msg = `Last heavy rain ${ago} days ago — window closing; check the oldest, dampest woods before the next shower.`;
      } else {
        msg = `Light rain ${ago} days ago — expect a mild flush; wet corners and shady woods first.`;
      }
    } else {
      msg = `No meaningful rain in 10 days — dry spell. Best bets: stream sides, shaded ditches, or wait for the forecast.`;
    }
    const f = fpr.findIndex(v => v >= 5);
    if (f >= 0) msg += ` Rain of ~${Math.round(fpr[f])} mm forecast <b>${fc[f].slice(5)}</b> — plan your hunt.`;
    msg += ` <span class="nearhint">Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Open-Meteo</span>`;
    set(msg, true);
  } catch (e) {
    set('<span class="nearhint">Weather check unavailable (offline?) — rule of thumb: 24–72 h after 5 mm+ rain is the woodland window.</span>', false);
  }
}

/* ---------------- field guide dialog ---------------- */
function buildGuide() {
  const body = document.getElementById('guideBody');
  if (!body) return;
  let html = '';
  html += `<div class="gsec"><h3>When &amp; where the mushrooms appear</h3>
    <ul class="timing">${TIMING.map(t => `<li>${t}</li>`).join('')}</ul></div>`;
  html += `<div class="gsec"><h3>What to look for — each species</h3>`;
  for (const sp of SPECIES) {
    const g = GUIDES[sp.id];
    html += `<div class="gcard">
      <h4><span class="dot" style="background:${sp.color}"></span>${sp.name}
        <span class="gk" style="margin-left:auto">${sp.latin}</span></h4>
      <div><b class="k">Look:</b> ${g.id}</div>
      <div><b class="k">Where &amp; when:</b> ${g.look}</div>
      <div class="warn"><b>Watch out:</b> ${g.watch}</div>
      <div style="margin-top:5px"><a href="https://www.inaturalist.org/search?q=${encodeURIComponent(g.inat)}" target="_blank" rel="noopener">See verified local records on iNaturalist ↗</a></div>
    </div>`;
  }
  html += `</div>`;
  html += `<div class="gsec"><h3>Around Barnsley — places worth walking</h3>`;
  for (const p of LOCAL_PLACES) {
    html += `<div class="gcard">
      <h4>${p.name} <span class="gk" style="margin-left:auto">${p.dist}</span></h4>
      <div><b class="k">Look for:</b> ${p.what}</div>
      <div><b class="k">When:</b> ${p.when} · <b class="k">Access:</b> ${p.perm}</div></div>`;
  }
  html += `</div>`;
  body.innerHTML = html;
}
const guideDlg = document.getElementById('guideDlg');
document.getElementById('btnGuide').addEventListener('click', () => { buildGuide(); guideDlg.showModal(); });
document.getElementById('btnCloseGuide').addEventListener('click', () => guideDlg.close());
guideDlg.addEventListener('click', e => { if (e.target === guideDlg) guideDlg.close(); });

/* ---------------- service worker ---------------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline preview etc. */ });
  });
}

/* ---------------- go ---------------- */
initSpecies();
renderMonthStrip();
renderAll();
renderSpots();
homeView();
