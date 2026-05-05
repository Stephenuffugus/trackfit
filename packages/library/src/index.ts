import type { TrackSystem } from "./types.js";

import atlasHoCode100 from "../data/atlas-ho-code-100.json" with { type: "json" };
import atlasHoCode83 from "../data/atlas-ho-code-83.json" with { type: "json" };
import atlasNCode80 from "../data/atlas-n-code-80.json" with { type: "json" };
import atlasOTrueTrack from "../data/atlas-o-true-track.json" with { type: "json" };
import bachmannEzTrackHo from "../data/bachmann-ez-track-ho.json" with { type: "json" };
import bachmannEzTrackN from "../data/bachmann-ez-track-n.json" with { type: "json" };
import hornbyOo from "../data/hornby-oo.json" with { type: "json" };
import katoUnitrackHo from "../data/kato-unitrack-ho.json" with { type: "json" };
import katoUnitrackN from "../data/kato-unitrack-n.json" with { type: "json" };
import lionelFastrack from "../data/lionel-fastrack.json" with { type: "json" };
import lionelO27Tubular from "../data/lionel-o27-tubular.json" with { type: "json" };
import marklinCTrack from "../data/marklin-c-track.json" with { type: "json" };
import marklinKTrack from "../data/marklin-k-track.json" with { type: "json" };
import pecoSetrackCode100 from "../data/peco-setrack-code-100.json" with { type: "json" };
import pecoStreamlineCode100 from "../data/peco-streamline-code-100.json" with { type: "json" };
import pecoStreamlineCode83 from "../data/peco-streamline-code-83.json" with { type: "json" };

/**
 * Every track system shipped with Trackfit, indexed by id.
 * Add new systems by importing them above and adding to this map.
 */
export const SYSTEMS: Record<string, TrackSystem> = {
  "atlas-ho-code-83": atlasHoCode83 as TrackSystem,
  "atlas-ho-code-100": atlasHoCode100 as TrackSystem,
  "atlas-n-code-80": atlasNCode80 as TrackSystem,
  "atlas-o-true-track": atlasOTrueTrack as TrackSystem,
  "bachmann-ez-track-ho": bachmannEzTrackHo as TrackSystem,
  "bachmann-ez-track-n": bachmannEzTrackN as TrackSystem,
  "hornby-oo": hornbyOo as TrackSystem,
  "kato-unitrack-ho": katoUnitrackHo as TrackSystem,
  "kato-unitrack-n": katoUnitrackN as TrackSystem,
  "lionel-fastrack": lionelFastrack as TrackSystem,
  "lionel-o27-tubular": lionelO27Tubular as TrackSystem,
  "marklin-c-track": marklinCTrack as TrackSystem,
  "marklin-k-track": marklinKTrack as TrackSystem,
  "peco-setrack-code-100": pecoSetrackCode100 as TrackSystem,
  "peco-streamline-code-100": pecoStreamlineCode100 as TrackSystem,
  "peco-streamline-code-83": pecoStreamlineCode83 as TrackSystem,
};

/** Ordered for default UI presentation: most-popular first by region. */
export const SYSTEM_DISPLAY_ORDER: string[] = [
  "lionel-fastrack",
  "lionel-o27-tubular",
  "atlas-ho-code-83",
  "atlas-ho-code-100",
  "atlas-n-code-80",
  "atlas-o-true-track",
  "kato-unitrack-n",
  "kato-unitrack-ho",
  "bachmann-ez-track-ho",
  "bachmann-ez-track-n",
  "marklin-c-track",
  "marklin-k-track",
  "peco-setrack-code-100",
  "peco-streamline-code-100",
  "peco-streamline-code-83",
  "hornby-oo",
];

export function getSystem(id: string): TrackSystem | undefined {
  return SYSTEMS[id];
}

export function listSystems(): TrackSystem[] {
  return SYSTEM_DISPLAY_ORDER.map((id) => SYSTEMS[id]).filter(
    (s): s is TrackSystem => s !== undefined,
  );
}

export type { TrackPiece, TrackSystem, TrackKind, Scale, DataQuality } from "./types.js";
