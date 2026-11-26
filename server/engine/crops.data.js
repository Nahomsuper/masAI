/**
 * Agronomic knowledge base. Every number here is a mid-range value that holds up
 * across common varieties and is used to build a care plan when Gemini is offline.
 * Water is expressed in litres per square metre per day at full canopy.
 */
export const CROPS = {
  tomato: {
    label: 'Tomato',
    type: 'fruit',
    days: 90,
    water: 4.5,
    spacingCm: 60,
    ph: [6.0, 6.8],
    pests: [
      { name: 'Late blight', signs: 'Dark water-soaked patches on leaves, white fuzz under the leaf', treatment: 'Remove infected leaves, improve airflow, apply copper-based fungicide' },
      { name: 'Hornworm', signs: 'Chewed leaves and holes in fruit with dark droppings', treatment: 'Hand-pick at dusk, apply Bt spray' },
      { name: 'Blossom end rot', signs: 'Black sunken patch at the bottom of the fruit', treatment: 'Steady watering and a calcium foliar feed' },
    ],
    harvestSigns: ['Fruit turns fully coloured and twists off the vine easily', 'Skin is firm and glossy'],
    stages: ['fruit'],
  },
  onion: {
    label: 'Onion',
    type: 'root',
    days: 120,
    water: 3.0,
    spacingCm: 12,
    ph: [6.0, 7.0],
    pests: [
      { name: 'Thrips', signs: 'Silvery streaks on leaves, curling tips', treatment: 'Neem spray every 7 days, keep field free of weeds' },
      { name: 'Purple blotch', signs: 'Purple-centred lesions on leaves', treatment: 'Reduce overhead watering, apply mancozeb' },
    ],
    harvestSigns: ['Tops fall over and start to yellow', 'Neck is soft and skin is papery'],
    stages: ['root'],
  },
  potato: {
    label: 'Potato',
    type: 'root',
    days: 100,
    water: 4.0,
    spacingCm: 30,
    ph: [5.2, 6.2],
    pests: [
      { name: 'Late blight', signs: 'Brown lesions spreading fast in cool wet weather', treatment: 'Destroy infected haulm, apply protective fungicide' },
      { name: 'Aphids', signs: 'Sticky leaves, curled shoots, ants present', treatment: 'Soap spray, encourage ladybirds' },
    ],
    harvestSigns: ['Haulm dies back and stems separate from tubers', 'Skin does not rub off easily'],
    stages: ['root'],
  },
  maize: {
    label: 'Maize',
    type: 'cereal',
    days: 110,
    water: 5.0,
    spacingCm: 75,
    ph: [5.8, 7.0],
    pests: [
      { name: 'Fall armyworm', signs: 'Ragged holes in whorl leaves with moist sawdust frass', treatment: 'Scout twice a week, apply Bt or emamectin at early whorl' },
      { name: 'Stalk borer', signs: 'Dead heart in young plants, tunnels in stem', treatment: 'Remove affected plants, rotate next season' },
    ],
    harvestSigns: ['Husks turn brown and dry', 'Kernel is hard and dents with a fingernail'],
    stages: ['cereal'],
  },
  wheat: { label: 'Wheat', type: 'cereal', days: 120, water: 4.0, spacingCm: 15, ph: [6.0, 7.5], pests: [{ name: 'Rust', signs: 'Orange-brown powdery pustules on leaves', treatment: 'Apply triazole fungicide at first sign' }], harvestSigns: ['Grain is hard and straw turns golden'], stages: ['cereal'] },
  teff: { label: 'Teff', type: 'cereal', days: 100, water: 3.5, spacingCm: 10, ph: [5.5, 7.0], pests: [{ name: 'Shoot fly', signs: 'Dead central shoots in young stands', treatment: 'Early sowing and field sanitation' }], harvestSigns: ['Panicles turn straw yellow'], stages: ['cereal'] },
  rice: { label: 'Rice', type: 'cereal', days: 130, water: 8.0, spacingCm: 20, ph: [5.5, 6.5], pests: [{ name: 'Stem borer', signs: 'Dead heart and white head', treatment: 'Drain field briefly, apply recommended insecticide' }], harvestSigns: ['Grains are hard and panicle bends down'], stages: ['cereal'] },
  barley: { label: 'Barley', type: 'cereal', days: 100, water: 3.5, spacingCm: 15, ph: [6.0, 7.5], pests: [{ name: 'Net blotch', signs: 'Net-like brown markings on leaves', treatment: 'Crop rotation and foliar fungicide' }], harvestSigns: ['Awns dry and grain resists fingernail'], stages: ['cereal'] },
  sorghum: { label: 'Sorghum', type: 'cereal', days: 120, water: 3.5, spacingCm: 60, ph: [5.5, 7.5], pests: [{ name: 'Shoot fly', signs: 'Dead heart in seedlings', treatment: 'Timely sowing and seed treatment' }], harvestSigns: ['Grains hard and head turns brown'], stages: ['cereal'] },
  coffee: { label: 'Coffee', type: 'tree', days: 240, water: 5.0, spacingCm: 200, ph: [6.0, 6.5], pests: [{ name: 'Berry borer', signs: 'Small holes at the tip of cherries', treatment: 'Pick and destroy infested cherries, keep floor clean' }, { name: 'Coffee leaf rust', signs: 'Yellow-orange powder under leaves', treatment: 'Prune for airflow, apply copper fungicide' }], harvestSigns: ['Cherries turn deep red and give under slight pressure'], stages: ['tree'] },
  banana: { label: 'Banana', type: 'tree', days: 270, water: 6.0, spacingCm: 250, ph: [5.8, 7.0], pests: [{ name: 'Panama disease', signs: 'Yellowing older leaves collapsing around the pseudostem', treatment: 'Remove and destroy the mat, do not replant in the same spot' }], harvestSigns: ['Fingers are full and round with faded ridges'], stages: ['tree'] },
  avocado: { label: 'Avocado', type: 'tree', days: 300, water: 5.0, spacingCm: 500, ph: [5.5, 6.5], pests: [{ name: 'Root rot', signs: 'Wilting with yellow leaves while soil is wet', treatment: 'Improve drainage, reduce irrigation, mulch away from trunk' }], harvestSigns: ['Skin loses shine and stem end browns'], stages: ['tree'] },
  mango: { label: 'Mango', type: 'tree', days: 150, water: 4.5, spacingCm: 800, ph: [5.5, 7.0], pests: [{ name: 'Fruit fly', signs: 'Soft brown patches with maggots inside', treatment: 'Bag fruit, collect and bury fallen fruit' }], harvestSigns: ['Shoulders fill out and fruit smells sweet'], stages: ['tree'] },
  cabbage: { label: 'Cabbage', type: 'leafy', days: 75, water: 4.0, spacingCm: 40, ph: [6.0, 7.0], pests: [{ name: 'Diamondback moth', signs: 'Small holes and pale larvae on leaf undersides', treatment: 'Bt spray weekly, remove crop debris' }], harvestSigns: ['Head is firm and tight when squeezed'], stages: ['leafy'] },
  kale: { label: 'Kale', type: 'leafy', days: 60, water: 4.0, spacingCm: 40, ph: [6.0, 7.0], pests: [{ name: 'Aphids', signs: 'Clusters on new growth with sticky residue', treatment: 'Strong water jet, soap spray' }], harvestSigns: ['Leaves are dark green and palm-sized'], stages: ['leafy'] },
  lettuce: { label: 'Lettuce', type: 'leafy', days: 45, water: 3.5, spacingCm: 25, ph: [6.0, 7.0], pests: [{ name: 'Slugs', signs: 'Ragged holes and silver trails at night', treatment: 'Ash or copper barrier, evening hand-pick' }], harvestSigns: ['Heart is filled but before bolting'], stages: ['leafy'] },
  spinach: { label: 'Spinach', type: 'leafy', days: 40, water: 3.5, spacingCm: 15, ph: [6.0, 7.0], pests: [{ name: 'Leaf miner', signs: 'Pale winding trails inside leaves', treatment: 'Remove mined leaves, use row cover' }], harvestSigns: ['Leaves are broad and tender before flowering'], stages: ['leafy'] },
  carrot: { label: 'Carrot', type: 'root', days: 80, water: 3.0, spacingCm: 8, ph: [6.0, 6.8], pests: [{ name: 'Root fly', signs: 'Rusty tunnels in the root', treatment: 'Thin seedlings, keep rows covered' }], harvestSigns: ['Shoulder of the root shows at soil level and is 2 cm wide'], stages: ['root'] },
  beetroot: { label: 'Beetroot', type: 'root', days: 70, water: 3.0, spacingCm: 10, ph: [6.0, 7.0], pests: [{ name: 'Leaf spot', signs: 'Brown spots with grey centres', treatment: 'Improve airflow, remove affected leaves' }], harvestSigns: ['Root is golf-ball sized and sits proud of the soil'], stages: ['root'] },
  pepper: { label: 'Pepper', type: 'fruit', days: 95, water: 4.0, spacingCm: 50, ph: [6.0, 6.8], pests: [{ name: 'Thrips', signs: 'Curled new leaves with silvery scar', treatment: 'Blue sticky traps and neem spray' }], harvestSigns: ['Fruit is firm and full sized, colour breaking'], stages: ['fruit'] },
  chilli: { label: 'Chilli', type: 'fruit', days: 95, water: 3.5, spacingCm: 45, ph: [6.0, 6.8], pests: [{ name: 'Anthracnose', signs: 'Sunken dark spots on ripening fruit', treatment: 'Remove infected fruit, avoid overhead watering' }], harvestSigns: ['Pods are firm and fully coloured'], stages: ['fruit'] },
  cucumber: { label: 'Cucumber', type: 'fruit', days: 60, water: 5.0, spacingCm: 60, ph: [6.0, 7.0], pests: [{ name: 'Powdery mildew', signs: 'White powder on upper leaf surface', treatment: 'Milk spray at dawn, prune dense leaves' }], harvestSigns: ['Fruit is uniform green and snaps cleanly from the vine'], stages: ['fruit'] },
  beans: { label: 'Beans', type: 'legume', days: 70, water: 3.5, spacingCm: 20, ph: [6.0, 7.0], pests: [{ name: 'Bean fly', signs: 'Yellow seedlings with damaged stems', treatment: 'Seed treatment and early sowing' }], harvestSigns: ['Pods fill out and snap crisply'], stages: ['legume'] },
  chickpea: { label: 'Chickpea', type: 'legume', days: 100, water: 2.5, spacingCm: 20, ph: [6.0, 8.0], pests: [{ name: 'Pod borer', signs: 'Holes in pods with larvae inside', treatment: 'Pheromone traps, timely spray at flowering' }], harvestSigns: ['Plants dry and pods rattle'], stages: ['legume'] },
  soybean: { label: 'Soybean', type: 'legume', days: 105, water: 3.5, spacingCm: 20, ph: [6.0, 7.0], pests: [{ name: 'Soybean rust', signs: 'Tiny brown spots spreading under leaves', treatment: 'Fungicide at first sign, rotate crop' }], harvestSigns: ['Pods turn brown and seeds rattle'], stages: ['legume'] },
  lentil: { label: 'Lentil', type: 'legume', days: 100, water: 2.5, spacingCm: 15, ph: [6.0, 8.0], pests: [{ name: 'Wilt', signs: 'Sudden drooping and yellowing patches', treatment: 'Rotate crop, avoid reusing seed from sick plants' }], harvestSigns: ['Plant dries and lower pods turn brown'], stages: ['legume'] },
  sugarcane: { label: 'Sugarcane', type: 'cereal', days: 330, water: 6.0, spacingCm: 100, ph: [6.0, 7.5], pests: [{ name: 'Stalk borer', signs: 'Dead heart and tunnels in cane', treatment: 'Remove affected canes, apply recommended granules' }], harvestSigns: ['Canes are thick at the base and juicy when tapped'], stages: ['cereal'] },
};

/** Stage blueprints keyed by crop type; percentages of the total growing cycle. */
export const STAGE_BLUEPRINTS = {
  fruit: [
    { key: 'establishment', label: 'Establishment', from: 0, to: 15, water: 0.75, focus: 'Root settling and transplant shock' },
    { key: 'vegetative', label: 'Vegetative growth', from: 15, to: 45, water: 1.0, focus: 'Building strong stems and leaf canopy' },
    { key: 'flowering', label: 'Flowering', from: 45, to: 65, water: 1.15, focus: 'Pollination and flower retention' },
    { key: 'fruiting', label: 'Fruit set', from: 65, to: 88, water: 1.2, focus: 'Continuous water and calcium for even fruit' },
    { key: 'maturity', label: 'Ripening', from: 88, to: 100, water: 0.85, focus: 'Ease off water to concentrate flavour' },
  ],
  leafy: [
    { key: 'establishment', label: 'Germination', from: 0, to: 20, water: 0.8, focus: 'Even moisture for emergence' },
    { key: 'vegetative', label: 'Leaf growth', from: 20, to: 70, water: 1.1, focus: 'Nitrogen and consistent water' },
    { key: 'fruiting', label: 'Heading up', from: 70, to: 100, water: 1.0, focus: 'Firm heart before harvest' },
  ],
  root: [
    { key: 'establishment', label: 'Establishment', from: 0, to: 20, water: 0.8, focus: 'Fine roots into moist soil' },
    { key: 'vegetative', label: 'Top growth', from: 20, to: 55, water: 1.05, focus: 'Healthy leaf canopy feeding the root' },
    { key: 'fruiting', label: 'Root bulking', from: 55, to: 90, water: 1.1, focus: 'Steady water, never let the soil crack' },
    { key: 'maturity', label: 'Maturity', from: 90, to: 100, water: 0.7, focus: 'Stop watering to harden for storage' },
  ],
  cereal: [
    { key: 'establishment', label: 'Emergence', from: 0, to: 18, water: 0.85, focus: 'Even stand establishment' },
    { key: 'vegetative', label: 'Tillering', from: 18, to: 50, water: 1.05, focus: 'Weed-free early growth' },
    { key: 'flowering', label: 'Heading and flowering', from: 50, to: 75, water: 1.15, focus: 'Water at heading decides yield' },
    { key: 'maturity', label: 'Grain fill and dry-down', from: 75, to: 100, water: 0.6, focus: 'Dry field before harvest' },
  ],
  legume: [
    { key: 'establishment', label: 'Emergence', from: 0, to: 20, water: 0.85, focus: 'Inoculant and even moisture' },
    { key: 'vegetative', label: 'Vegetative growth', from: 20, to: 50, water: 1.0, focus: 'Nodulation and branching' },
    { key: 'flowering', label: 'Flowering and pod set', from: 50, to: 78, water: 1.1, focus: 'Do not stress at flowering' },
    { key: 'maturity', label: 'Pod fill', from: 78, to: 100, water: 0.7, focus: 'Let pods dry on the plant' },
  ],
  tree: [
    { key: 'establishment', label: 'Establishment', from: 0, to: 25, water: 0.9, focus: 'Deep roots, mulch heavily' },
    { key: 'vegetative', label: 'Canopy growth', from: 25, to: 55, water: 1.05, focus: 'Structure pruning and feeding' },
    { key: 'flowering', label: 'Flowering', from: 55, to: 72, water: 1.1, focus: 'Pollination and pest watch' },
    { key: 'fruiting', label: 'Fruit development', from: 72, to: 92, water: 1.15, focus: 'Even moisture, no waterlogging' },
    { key: 'maturity', label: 'Ripening', from: 92, to: 100, water: 0.8, focus: 'Slight stress sweetens the crop' },
  ],
};

export const GENERIC_CROP = {
  label: 'Crop',
  type: 'fruit',
  days: 90,
  water: 4.0,
  spacingCm: 50,
  ph: [6.0, 7.0],
  pests: [],
  harvestSigns: ['Colour, firmness and size match a mature crop', 'Fruit or leaf releases easily from the plant'],
  stages: ['fruit'],
};

/** Fuzzy lookup so "Tomatoes", "tomato (Roma)" and "TOMATO" all resolve. */
export function matchCrop(name) {
  const key = String(name ?? '').toLowerCase().trim();
  if (!key) return { key: 'generic', entry: GENERIC_CROP };
  if (CROPS[key]) return { key, entry: CROPS[key] };
  const singular = key.replace(/s$/, '');
  if (CROPS[singular]) return { key: singular, entry: CROPS[singular] };
  const found = Object.keys(CROPS).find((cropKey) => key.includes(cropKey));
  if (found) return { key: found, entry: CROPS[found] };
  return { key: 'generic', entry: GENERIC_CROP };
}

export const listCrops = () =>
  Object.entries(CROPS).map(([key, crop]) => ({
    key,
    label: crop.label,
    days: crop.days,
    water: crop.water,
    type: crop.type,
  }));
