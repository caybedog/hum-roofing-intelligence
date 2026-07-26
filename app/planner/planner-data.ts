export type PlannerMode = "photo" | "guided";

export type PlannerCategory = {
  id: string;
  name: string;
  icon: string;
  description: string;
  variants: Array<{
    id: string;
    name: string;
    quantityLabel: string;
    quantityUnit: string;
    quantityHelp: string;
    quantityPlaceholder: string;
    defaultQuantity?: number;
  }>;
  photoTips: string[];
};

export const PROJECT_CATEGORIES: PlannerCategory[] = [
  {
    id: "roofing",
    name: "Roofing",
    icon: "⌂",
    description: "Repairs and asphalt roof replacement",
    variants: [
      {
        id: "asphalt_replacement",
        name: "Replace an asphalt roof",
        quantityLabel: "Approximate roof area",
        quantityUnit: "square feet",
        quantityHelp:
          "Use your home footprint as a starting point. HUM widens the range for pitch and waste.",
        quantityPlaceholder: "Example: 1,800",
      },
    ],
    photoTips: [
      "Take one photo showing each roof slope from the ground.",
      "Include damaged areas, valleys, chimneys and skylights.",
      "Never climb onto the roof for HUM.",
    ],
  },
  {
    id: "gutters",
    name: "Gutters",
    icon: "⌁",
    description: "Seamless gutters and downspouts",
    variants: [
      {
        id: "seamless_aluminum",
        name: "Replace or install gutters",
        quantityLabel: "Total gutter length",
        quantityUnit: "linear feet",
        quantityHelp:
          "Measure the roof edges that need gutters, or estimate each straight run.",
        quantityPlaceholder: "Example: 160",
      },
    ],
    photoTips: [
      "Photograph every gutter run and downspout.",
      "Include corners, high sections and visible rot.",
      "A wide photo helps HUM understand access.",
    ],
  },
  {
    id: "windows",
    name: "Windows",
    icon: "▦",
    description: "Standard replacement windows",
    variants: [
      {
        id: "standard_replacement",
        name: "Replace windows",
        quantityLabel: "Number of windows",
        quantityUnit: "windows",
        quantityHelp:
          "Count each separate framed opening. A bay window may count as one complex opening.",
        quantityPlaceholder: "Example: 8",
      },
    ],
    photoTips: [
      "Take one straight-on exterior photo per window type.",
      "Include interior trim or water damage.",
      "Show unusual shapes and second-story access.",
    ],
  },
  {
    id: "doors",
    name: "Doors",
    icon: "▯",
    description: "Exterior entry doors",
    variants: [
      {
        id: "exterior_door",
        name: "Replace exterior doors",
        quantityLabel: "Number of doors",
        quantityUnit: "doors",
        quantityHelp:
          "Count each door opening. Sidelights, double doors and custom sizes increase complexity.",
        quantityPlaceholder: "Example: 2",
      },
    ],
    photoTips: [
      "Photograph the whole door from inside and outside.",
      "Include the threshold, trim and any rot.",
      "Show sidelights or double-door openings.",
    ],
  },
  {
    id: "plumbing",
    name: "Plumbing",
    icon: "◒",
    description: "Fixtures, water heaters and repiping",
    variants: [
      {
        id: "fixture_work",
        name: "Repair or replace fixtures",
        quantityLabel: "Number of fixtures",
        quantityUnit: "fixtures",
        quantityHelp:
          "Count toilets, sinks, faucets, tubs or other separate fixtures involved.",
        quantityPlaceholder: "Example: 3",
      },
      {
        id: "water_heater",
        name: "Replace a water heater",
        quantityLabel: "Number of water heaters",
        quantityUnit: "units",
        quantityHelp: "Most homes have one. Note gas, electric or heat-pump in your description.",
        quantityPlaceholder: "Usually 1",
        defaultQuantity: 1,
      },
      {
        id: "repipe",
        name: "Repipe a home",
        quantityLabel: "Home area served",
        quantityUnit: "square feet",
        quantityHelp:
          "Use the approximate conditioned floor area of the part of the home being repiped.",
        quantityPlaceholder: "Example: 1,600",
      },
    ],
    photoTips: [
      "Photograph the fixture or equipment and nearby connections.",
      "Include labels on a water heater or pump.",
      "Do not touch leaking gas lines or exposed wiring.",
    ],
  },
  {
    id: "painting",
    name: "Painting",
    icon: "◩",
    description: "Interior and exterior painting",
    variants: [
      {
        id: "interior",
        name: "Paint an interior",
        quantityLabel: "Approximate painted area",
        quantityUnit: "square feet",
        quantityHelp:
          "For a quick plan, use the room floor area. Describe ceilings, trim and number of rooms.",
        quantityPlaceholder: "Example: 1,200",
      },
      {
        id: "exterior",
        name: "Paint an exterior",
        quantityLabel: "Approximate wall area",
        quantityUnit: "square feet",
        quantityHelp:
          "Estimate exterior wall length × wall height, then subtract only very large openings.",
        quantityPlaceholder: "Example: 2,400",
      },
    ],
    photoTips: [
      "Show all surfaces and the worst peeling or damage.",
      "Include tall walls, stairs and difficult access.",
      "Mention homes built before 1978 because lead-safe work may apply.",
    ],
  },
  {
    id: "flooring",
    name: "Flooring",
    icon: "▥",
    description: "Installed finish flooring",
    variants: [
      {
        id: "installed",
        name: "Replace flooring",
        quantityLabel: "Floor area",
        quantityUnit: "square feet",
        quantityHelp:
          "Measure room length × width and add the rooms together. HUM carries a waste allowance.",
        quantityPlaceholder: "Example: 900",
      },
    ],
    photoTips: [
      "Show the existing floor and transitions.",
      "Include stairs and damaged or uneven areas.",
      "Mention the finish you want, such as vinyl, laminate, tile or hardwood.",
    ],
  },
  {
    id: "electrical",
    name: "Electrical",
    icon: "ϟ",
    description: "Fixtures, circuits and panels",
    variants: [
      {
        id: "fixture_or_circuit",
        name: "Add or repair fixtures and circuits",
        quantityLabel: "Number of work items",
        quantityUnit: "items",
        quantityHelp:
          "Count each fixture, outlet, circuit or separate repair you want priced.",
        quantityPlaceholder: "Example: 6",
      },
      {
        id: "panel",
        name: "Replace an electrical panel",
        quantityLabel: "Number of panels",
        quantityUnit: "panels",
        quantityHelp: "Most homes have one main panel. Describe the amperage if it is visible.",
        quantityPlaceholder: "Usually 1",
        defaultQuantity: 1,
      },
    ],
    photoTips: [
      "Photograph the closed panel and its label.",
      "Do not remove panel covers.",
      "Stop and call an electrician for heat, smoke, sparks or exposed live wiring.",
    ],
  },
  {
    id: "hvac",
    name: "Heating & cooling",
    icon: "❉",
    description: "Residential heat-pump systems",
    variants: [
      {
        id: "heat_pump",
        name: "Install or replace a heat pump",
        quantityLabel: "Number of systems",
        quantityUnit: "systems",
        quantityHelp:
          "Use one for a typical central system. Describe the home area and whether ducts exist.",
        quantityPlaceholder: "Usually 1",
        defaultQuantity: 1,
      },
    ],
    photoTips: [
      "Photograph existing indoor and outdoor equipment labels.",
      "Show the electrical panel and thermostat from a safe distance.",
      "Mention rooms that are difficult to heat or cool.",
    ],
  },
  {
    id: "siding",
    name: "Siding",
    icon: "▤",
    description: "Exterior siding replacement",
    variants: [
      {
        id: "replacement",
        name: "Replace siding",
        quantityLabel: "Approximate wall area",
        quantityUnit: "square feet",
        quantityHelp:
          "Estimate exterior wall length × height. Include gables and tell HUM how many stories.",
        quantityPlaceholder: "Example: 2,200",
      },
    ],
    photoTips: [
      "Photograph every side of the home.",
      "Include damaged trim, rot and utility penetrations.",
      "Show second-story or steep-slope access.",
    ],
  },
  {
    id: "deck",
    name: "Deck",
    icon: "▰",
    description: "New residential decks",
    variants: [
      {
        id: "new_deck",
        name: "Build a new deck",
        quantityLabel: "Deck area",
        quantityUnit: "square feet",
        quantityHelp: "Multiply the planned deck length × width.",
        quantityPlaceholder: "Example: 240",
      },
    ],
    photoTips: [
      "Show the full build area and how high it is above grade.",
      "Include the home connection and slope below.",
      "Describe stairs, rails and desired decking material.",
    ],
  },
  {
    id: "bathroom",
    name: "Bathroom",
    icon: "◫",
    description: "Bathroom remodeling",
    variants: [
      {
        id: "remodel",
        name: "Remodel a bathroom",
        quantityLabel: "Number of bathrooms",
        quantityUnit: "rooms",
        quantityHelp:
          "Use one unless multiple rooms are part of the same project. Describe layout changes.",
        quantityPlaceholder: "Usually 1",
        defaultQuantity: 1,
      },
    ],
    photoTips: [
      "Take a wide photo from each corner.",
      "Include the shower or tub, vanity and floor.",
      "Mention layout changes, leaks or soft flooring.",
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    icon: "▣",
    description: "Kitchen remodeling",
    variants: [
      {
        id: "remodel",
        name: "Remodel a kitchen",
        quantityLabel: "Number of kitchens",
        quantityUnit: "rooms",
        quantityHelp:
          "Use one for a normal project. Describe cabinets, counters, appliances and layout changes.",
        quantityPlaceholder: "Usually 1",
        defaultQuantity: 1,
      },
    ],
    photoTips: [
      "Take a wide photo of every wall.",
      "Show cabinets, counters, appliances and flooring.",
      "Mention if plumbing, gas or walls will move.",
    ],
  },
  {
    id: "fencing",
    name: "Fencing",
    icon: "╫",
    description: "Wood privacy fencing",
    variants: [
      {
        id: "wood_fence",
        name: "Build or replace a wood fence",
        quantityLabel: "Fence length",
        quantityUnit: "linear feet",
        quantityHelp:
          "Measure or pace the full fence line. Count gates in your description.",
        quantityPlaceholder: "Example: 120",
      },
    ],
    photoTips: [
      "Photograph the full fence line in sections.",
      "Show slopes, trees, old concrete and access.",
      "Include gates and property corners.",
    ],
  },
  {
    id: "concrete",
    name: "Concrete",
    icon: "▱",
    description: "Walkways, patios and flatwork",
    variants: [
      {
        id: "flatwork",
        name: "Install concrete flatwork",
        quantityLabel: "Concrete area",
        quantityUnit: "square feet",
        quantityHelp: "Multiply length × width for each slab and add them together.",
        quantityPlaceholder: "Example: 400",
      },
    ],
    photoTips: [
      "Show the full area and access from the street.",
      "Include slopes, demolition and drainage.",
      "Describe thickness or vehicle use if known.",
    ],
  },
  {
    id: "landscaping",
    name: "Landscaping",
    icon: "♧",
    description: "Labor-based landscape planning",
    variants: [
      {
        id: "labor_project",
        name: "Plan landscape work",
        quantityLabel: "Estimated crew hours",
        quantityUnit: "labor hours",
        quantityHelp:
          "Estimate total people × hours. Example: three people for two days at eight hours each is 48 hours.",
        quantityPlaceholder: "Example: 48",
      },
    ],
    photoTips: [
      "Take wide photos of the whole work area.",
      "Show access, slopes, vegetation and debris.",
      "Describe desired plants, hardscape and equipment needs.",
    ],
  },
];

export const CONDITION_OPTIONS = [
  ["good", "Good", "Little visible damage"],
  ["typical", "Typical", "Normal wear for its age"],
  ["worn", "Worn", "Visible deterioration or repairs"],
  ["damaged", "Damaged", "Leaks, rot, failure or major damage"],
  ["unknown", "Not sure", "HUM will widen the range"],
] as const;

export const ACCESS_OPTIONS = [
  ["easy", "Easy", "Ground-level and open access"],
  ["normal", "Normal", "Typical residential access"],
  ["difficult", "Difficult", "Tall, steep, tight or remote"],
  ["unknown", "Not sure", "HUM will widen the range"],
] as const;

export const COMPLEXITY_OPTIONS = [
  ["simple", "Simple", "Straightforward shape and scope"],
  ["standard", "Standard", "A normal residential project"],
  ["complex", "Complex", "Custom details, many corners or multiple trades"],
  ["unknown", "Not sure", "HUM will widen the range"],
] as const;

export function categoryById(id: string) {
  return PROJECT_CATEGORIES.find((category) => category.id === id);
}

export function variantFor(categoryId: string, variantId: string) {
  return categoryById(categoryId)?.variants.find((variant) => variant.id === variantId);
}
