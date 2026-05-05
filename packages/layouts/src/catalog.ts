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
      turnouts: 4,
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
];
