/**
 * Hand-authored layout templates. Numbers are intentionally
 * plausible-not-precise — these are conceptual templates, not blueprints.
 * The suggester rewards inventories that meet or exceed each minimum.
 *
 * When adding a template:
 *  - keep ASCII sketches ≤ 8 lines, mono-friendly, no Unicode tricks.
 *  - prefer round numbers in mm; the matcher tolerates rounding.
 *  - if the layout truly needs a scale-specific footprint, pin scales.
 *  - leave footprint generous; the user is matching capacity, not fit.
 */
import type { LayoutTemplate } from "./types.js";

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "simple-oval",
    name: "Simple oval",
    description:
      "A continuous loop you can run on a 4×6 sheet of plywood. The classic first layout — set it down, hook up the controller, watch the train go.",
    scales: null,
    requirements: {
      straight_length_mm: 1000,
      curve_total_degrees: 360,
    },
    footprint: { width_mm: 1830, depth_mm: 1220 },
    ascii_sketch: [
      "    ___________________",
      "   /                   \\",
      "  |                     |",
      "  |                     |",
      "   \\___________________/",
    ].join("\n"),
    style: "continuous-loop",
    complexity: 1,
    appeal: "The hands-down easiest layout to build and run.",
  },

  {
    id: "small-dogbone",
    name: "Small dogbone",
    description:
      "Two reverse loops connected by a straight run, shaped like a dog bone. The train turns itself around at each end so it always heads back the way it came.",
    scales: null,
    requirements: {
      straight_length_mm: 1500,
      curve_total_degrees: 720,
    },
    footprint: { width_mm: 2400, depth_mm: 900 },
    ascii_sketch: [
      "   _____           _____",
      "  /     \\_________/     \\",
      " |                       |",
      "  \\_____/         \\_____/",
    ].join("\n"),
    style: "continuous-loop",
    complexity: 2,
    appeal: "A long shelf-friendly run that turns the train around at each end.",
  },

  {
    id: "folded-dogbone",
    name: "Folded dogbone",
    description:
      "Same dogbone idea, folded back on itself to fit a tighter footprint — good for a shelf along a wall or a narrower table.",
    scales: null,
    requirements: {
      straight_length_mm: 1800,
      curve_total_degrees: 720,
    },
    footprint: { width_mm: 1800, depth_mm: 1100 },
    ascii_sketch: [
      "    _______________",
      "   /  ___________  \\",
      "  | /             \\ |",
      "  | \\_____________/ |",
      "   \\_______________/",
    ].join("\n"),
    style: "continuous-loop",
    complexity: 3,
    appeal: "Dogbone running length packed into a narrower footprint.",
  },

  {
    id: "twice-around",
    name: "Twice-around",
    description:
      "A figure-8-ish loop where the train passes itself on the same footprint as a simple oval — twice the run-time, more interesting to watch. Needs one crossing where the tracks intersect.",
    scales: null,
    requirements: {
      straight_length_mm: 1400,
      curve_total_degrees: 720,
      crossings: 1,
    },
    footprint: { width_mm: 1830, depth_mm: 1220 },
    ascii_sketch: [
      "    ___________________",
      "   /     ___________   \\",
      "  |     /           \\   |",
      "  |     \\_____X_____/   |",
      "   \\___________________/",
    ].join("\n"),
    style: "showcase",
    complexity: 3,
    appeal: "More visual interest in the same footprint.",
  },

  {
    id: "loop-with-siding",
    name: "Loop with siding",
    description:
      "An oval plus a stub siding for parking a second train or a string of cars. The two turnouts let you switch a train onto the siding while another keeps running on the main.",
    scales: null,
    requirements: {
      straight_length_mm: 1400,
      curve_total_degrees: 360,
      turnouts: 2,
    },
    footprint: { width_mm: 1830, depth_mm: 1220 },
    ascii_sketch: [
      "    ___________________",
      "   /                   \\",
      "  |   ____Y__________   |",
      "  |                     |",
      "   \\__Y________________/",
    ].join("\n"),
    style: "continuous-loop",
    complexity: 3,
    appeal: "A plain oval that lets you stash a second train without unhooking.",
  },

  {
    id: "point-to-point-passing",
    name: "Point-to-point with passing siding",
    description:
      "Two end stubs joined by a straight run, with a passing siding in the middle so two trains can meet and pass. Operations-friendly — there's actual switching to do, not just watching loops.",
    scales: null,
    requirements: {
      straight_length_mm: 2000,
      curve_total_degrees: 0,
      turnouts: 2,
    },
    footprint: { width_mm: 2400, depth_mm: 600 },
    ascii_sketch: [
      "  ===========Y============Y===========",
      "             |            |",
      "             ==============",
    ].join("\n"),
    style: "switching",
    complexity: 4,
    appeal: "Real operations: meet, pass, and reverse — not just laps.",
  },

  {
    id: "reverse-loop",
    name: "Out-and-back / reverse loop",
    description:
      "A single balloon-shaped loop that turns the train around so it can run back the way it came. One turnout at the throat, then 360° of curve to swing through the loop.",
    scales: null,
    requirements: {
      straight_length_mm: 600,
      curve_total_degrees: 360,
      turnouts: 1,
    },
    footprint: { width_mm: 1500, depth_mm: 1000 },
    ascii_sketch: [
      "             _________",
      "            /         \\",
      "  =========Y           |",
      "            \\_________/",
    ].join("\n"),
    style: "showcase",
    complexity: 4,
    appeal: "Watch the train turn itself around — the visual trick of model railroading.",
  },

  {
    id: "yard-ladder",
    name: "Yard ladder",
    description:
      "A series of parallel sidings fed by a ladder of turnouts. If you've got lots of turnouts and straight track, this is where they belong — for storing strings of cars and switching operations.",
    scales: null,
    requirements: {
      straight_length_mm: 2400,
      curve_total_degrees: 0,
      turnouts: 6,
    },
    footprint: { width_mm: 2400, depth_mm: 800 },
    ascii_sketch: [
      "  ==Y==============================",
      "     \\=Y============================",
      "        \\=Y==========================",
      "           \\=Y========================",
      "              \\======================",
    ].join("\n"),
    style: "switching",
    complexity: 5,
    appeal: "A switcher's playground — every turnout you own gets a job.",
  },

  {
    id: "christmas-tree-loop-ho",
    name: "Christmas tree loop (HO)",
    description:
      "A small oval sized to fit under a Christmas tree. HO-scale footprint — about 1.5 m × 1 m. Tight curves, short straights.",
    scales: ["HO", "OO"],
    requirements: {
      straight_length_mm: 600,
      curve_total_degrees: 360,
      max_curve_radius_mm: 500,
    },
    footprint: { width_mm: 1500, depth_mm: 1000 },
    ascii_sketch: [
      "       _____________",
      "      /             \\",
      "     |       *       |",
      "     |      /|\\      |",
      "      \\_____|_______/",
    ].join("\n"),
    style: "starter",
    complexity: 1,
    appeal: "A holiday classic — set it up in an afternoon, leave it for the season.",
  },

  {
    id: "christmas-tree-loop-n",
    name: "Christmas tree loop (N)",
    description:
      "A small oval sized for N scale under a Christmas tree — fits in a 900 mm × 600 mm footprint. Tight curves so it tucks neatly around the tree skirt.",
    scales: ["N", "Z"],
    requirements: {
      straight_length_mm: 300,
      curve_total_degrees: 360,
      max_curve_radius_mm: 300,
    },
    footprint: { width_mm: 900, depth_mm: 600 },
    ascii_sketch: [
      "      ___________",
      "     /           \\",
      "    |     *       |",
      "    |    /|\\      |",
      "     \\___|_______/",
    ].join("\n"),
    style: "starter",
    complexity: 1,
    appeal: "Tucks around the tree skirt and runs all month.",
  },

  {
    id: "l-shape-switching",
    name: "L-shaped switching layout",
    description:
      "An L-shaped industrial switching layout — mostly straights with a handful of turnouts feeding spurs to imaginary industries. No continuous loop; the fun is in the switching puzzles.",
    scales: null,
    requirements: {
      straight_length_mm: 2200,
      curve_total_degrees: 90,
      turnouts: 3,
    },
    footprint: { width_mm: 2400, depth_mm: 1200 },
    ascii_sketch: [
      "  ===Y=========Y===========Y====",
      "      |         |           |",
      "      |         |           \\__",
      "      |         |              \\",
      "      |         |               \\",
      "      |_________|_______________/",
    ].join("\n"),
    style: "switching",
    complexity: 4,
    appeal: "Industrial switching puzzles — no loop, just operations.",
  },

  {
    id: "around-the-walls",
    name: "Around-the-walls shelf",
    description:
      "A long continuous loop that hugs the perimeter of a room — runs along three or four walls on a narrow shelf, with curved corners tying it together. Great if you have a basement or spare room and want a long mainline run.",
    scales: null,
    requirements: {
      straight_length_mm: 9000,
      curve_total_degrees: 360,
      max_curve_radius_mm: 700,
    },
    footprint: { width_mm: 4000, depth_mm: 3000 },
    ascii_sketch: [
      "    ___________________________",
      "   /                           \\",
      "  |                             |",
      "  |                             |",
      "  |                             |",
      "   \\___________________________/",
    ].join("\n"),
    style: "continuous-loop",
    complexity: 4,
    appeal: "A long mainline that wraps the whole room — the train is always going somewhere.",
  },

  {
    id: "branching-dogbone",
    name: "Branching dogbone",
    description:
      "A dogbone mainline with a branch line peeling off at one end into a small yard. The train can run laps on the dogbone or duck off into the yard for switching — best of both worlds.",
    scales: null,
    requirements: {
      straight_length_mm: 2200,
      curve_total_degrees: 720,
      turnouts: 2,
    },
    footprint: { width_mm: 2700, depth_mm: 1100 },
    ascii_sketch: [
      "   _____           _____",
      "  /     \\_________/     \\",
      " |              Y         |",
      "  \\_____/    Y   \\_____/",
      "             |_________",
      "             |_________ yard",
    ].join("\n"),
    style: "continuous-loop",
    complexity: 4,
    appeal: "Run laps or switch the yard — the dogbone with somewhere to go.",
  },

  {
    id: "helix-staging",
    name: "Helix with hidden staging",
    description:
      "A single visible loop on top, with a hidden helix — a corkscrew of curve — taking the train down to a staging level underneath. Lets you double the run length and stash trains out of sight. Build it if you have the patience for a multi-level layout.",
    scales: ["HO", "OO", "N"],
    requirements: {
      straight_length_mm: 2000,
      curve_total_degrees: 1440,
      turnouts: 2,
      max_curve_radius_mm: 600,
    },
    footprint: { width_mm: 2400, depth_mm: 1500 },
    ascii_sketch: [
      "    ___________________",
      "   /                   \\",
      "  |    ___________      |",
      "  |   /  helix    \\     |",
      "  |  |   (down)    |    |",
      "  |   \\___________/     |",
      "   \\_______Y___________/",
      "          to staging",
    ].join("\n"),
    style: "showcase",
    complexity: 5,
    appeal: "Twice the run length and trains that vanish off-stage — model railroading at its most ambitious.",
  },

  {
    id: "mountain-switchback",
    name: "Mountain switchback",
    description:
      "A point-to-point layout climbing a mountainside by zig-zagging back and forth — the train pulls forward, stops, switches direction, and reverses up to the next leg. No loop, all operation. Modeled after real narrow-gauge logging and mining lines.",
    scales: null,
    requirements: {
      straight_length_mm: 3000,
      curve_total_degrees: 0,
      turnouts: 3,
    },
    footprint: { width_mm: 2400, depth_mm: 1500 },
    ascii_sketch: [
      "                       ====Y===",
      "                      /",
      "             ====Y===/",
      "            /",
      "   ====Y===/",
      "  /",
      "  ===========",
    ].join("\n"),
    style: "switching",
    complexity: 5,
    appeal: "Climb the grade the way the old logging lines did — forward, reverse, repeat.",
  },

  {
    id: "t-trak-module",
    name: "T-Trak module",
    description:
      "A single tabletop module built to the T-Trak modular standard — 308 mm wide and 355 mm deep, with two parallel tracks across the front. On its own it's a tiny diorama; bring it to a club meet and it joins up with everyone else's modules into a giant layout.",
    scales: ["N"],
    requirements: {
      straight_length_mm: 600,
      curve_total_degrees: 0,
      max_curve_radius_mm: 300,
    },
    footprint: { width_mm: 308, depth_mm: 355 },
    ascii_sketch: [
      "  ======================",
      "  ======================",
      "                        ",
      "  [ scenery / industry ]",
    ].join("\n"),
    style: "showcase",
    complexity: 2,
    appeal: "Build one tabletop square — bring it to a club meet, snap it into a hundred-foot layout.",
  },

  {
    id: "inglenook-siding",
    name: "Inglenook siding",
    description:
      "The classic 5-3-3 switching puzzle — three short stub tracks holding 5, 3, and 3 cars, fed by a lead long enough to handle them. Shuffle the cars into a target order. Famously addictive and fits on a bookshelf.",
    scales: null,
    requirements: {
      straight_length_mm: 1500,
      curve_total_degrees: 0,
      turnouts: 3,
    },
    footprint: { width_mm: 1500, depth_mm: 400 },
    ascii_sketch: [
      "  ===========Y=================",
      "              \\=Y==============",
      "                 \\=Y===========",
      "                    \\==========",
    ].join("\n"),
    style: "switching",
    complexity: 3,
    appeal: "The puzzle that fits on a bookshelf — five cars, three sidings, hours gone.",
  },

  {
    id: "timesaver",
    name: "Timesaver",
    description:
      "John Allen's famous switching puzzle — a tangle of five turnouts and short sidings where the goal is to sort cars into specific spots in as few moves as possible. Bigger than an Inglenook and meaner; a stopwatch helps.",
    scales: null,
    requirements: {
      straight_length_mm: 2000,
      curve_total_degrees: 0,
      turnouts: 5,
    },
    footprint: { width_mm: 1800, depth_mm: 500 },
    ascii_sketch: [
      "  ====Y========Y==============",
      "       \\        \\=Y===========",
      "        \\=Y========\\==========",
      "           \\=Y================",
      "              \\===============",
    ].join("\n"),
    style: "switching",
    complexity: 5,
    appeal: "John Allen's stopwatch puzzle — five turnouts, ruthless geometry.",
  },

  {
    id: "mining-branchline",
    name: "Mining branchline",
    description:
      "A short themed switching layout — a mainline with a runaround for the road engine, a kickback spur climbing up to a mine, and a couple of industries to spot cars at. Fits on a hollow-core door, plays for hours.",
    scales: null,
    requirements: {
      straight_length_mm: 2000,
      curve_total_degrees: 90,
      turnouts: 4,
    },
    footprint: { width_mm: 2000, depth_mm: 800 },
    ascii_sketch: [
      "                       ___ mine",
      "                      /",
      "  ====Y=======Y======Y",
      "       \\       \\======\\",
      "        \\=Y============",
      "           \\===========",
    ].join("\n"),
    style: "switching",
    complexity: 4,
    appeal: "A themed switching layout with a mine on the hill — operations with a story.",
  },

  {
    id: "double-tracked-oval",
    name: "Double-tracked oval",
    description:
      "Two concentric ovals with crossover turnouts between them, so a train can swap from the inner main to the outer main mid-run. Lets two trains run at once without crashing, and gives you something to actually do with the throttle.",
    scales: null,
    requirements: {
      straight_length_mm: 2000,
      curve_total_degrees: 720,
      turnouts: 4,
    },
    footprint: { width_mm: 2100, depth_mm: 1400 },
    ascii_sketch: [
      "    _________________________",
      "   /    _________________    \\",
      "  |    /                 \\    |",
      "  |   |    Y=========Y    |   |",
      "  |    \\_________________/    |",
      "   \\_________________________/",
    ].join("\n"),
    style: "continuous-loop",
    complexity: 4,
    appeal: "Two trains, two mains, and a crossover so they can swap lanes.",
  },
];
