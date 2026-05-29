import { useEffect, useRef, useState } from "react";
import type { PaperSize } from "@trackfit/cut-templates";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { loadPersisted } from "../hooks/usePersistedState";
import { downloadPdf } from "../lib/download";
import { FEEDBACK, PREMIUM } from "../lib/env";
import {
  buildImportConfirmMessage,
  exportInventory,
  importInventory,
  readBackupFile,
} from "../lib/inventory-io";
import {
  applyPrefsToDocument,
  loadPrefs,
  type Prefs,
  savePrefs,
  setOnboarded,
} from "../lib/prefs";
import {
  deactivate as deactivatePremium,
  isPremium,
  loadPremium,
} from "../lib/premium";
import type { InventoryRow } from "../lib/types";
import { LicenseActivation } from "./LicenseActivation";
import { PremiumModal } from "./PremiumModal";

// pdf-lib is ~250KB. The cut-template button already lazy-loads it for the
// flex-cut PDF; reuse the same pattern here so we don't pull pdf-lib into
// the main bundle just because someone opened the settings menu.
const renderInventoryReport = async (
  ...args: Parameters<
    typeof import("@trackfit/cut-templates").renderInventoryReport
  >
) => {
  const mod = await import("@trackfit/cut-templates");
  return mod.renderInventoryReport(...args);
};

interface SettingsMenuProps {
  /** Current inventory rows, used by the "Print inventory report" action. */
  inventory: InventoryRow[];
}

/**
 * Comfort-settings panel. A small gear button in the header opens a
 * dropdown panel with the user's "I might want to do this once" controls:
 *
 *   - Bigger text       (toggles `data-large-text` on <html>)
 *   - High contrast     (toggles `data-high-contrast` on <html>)
 *   - Export / import   (JSON backup file)
 *   - Print inventory   (insurance-grade PDF binder)
 *   - Show intro again  (clears the onboarding flag and reloads)
 *
 * Toggle state persists to `trackfit.prefs.v1`. Initial application
 * happens at boot in main.tsx so the document never flashes the
 * default theme.
 *
 * The print-inventory action lives here, not in the inventory header,
 * because it's a once-a-year action for insurance / estate documentation —
 * not a daily-use button that should crowd the main surface.
 */
export function SettingsMenu({ inventory }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Print-inventory sub-state. Kept inside this component so the popover
  // closes cleanly when the menu closes.
  const [printOpen, setPrintOpen] = useState(false);
  const [paper, setPaper] = useState<PaperSize>("letter");
  const [printBusy, setPrintBusy] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  // Premium upsell modal. Whole feature is gated by VITE_PREMIUM_ENABLED;
  // when the flag is off the row never renders, so this state never flips.
  const [premiumOpen, setPremiumOpen] = useState(false);

  // License activation modal — separate from the upsell modal so the
  // user can land here directly via the "I have a license code" row.
  const [licenseOpen, setLicenseOpen] = useState(false);

  // Cached premium snapshot. We re-read on every render of this panel
  // to keep the row label in sync with activation events. The reads
  // are cheap (a single localStorage hit) and only happen while the
  // panel is open.
  const [premiumState, setPremiumState] = useState(() => loadPremium());
  const refreshPremium = () => setPremiumState(loadPremium());

  // Listen for the global "open upgrade" event fired by <PremiumGate>
  // instances scattered through the app. Keeps the modal's open state
  // co-located with its host (Settings) without prop-drilling through
  // four layers of children. Documented in PremiumGate's call-sites.
  useEffect(() => {
    if (!PREMIUM.enabled) return;
    const onUpgrade = () => setPremiumOpen(true);
    window.addEventListener("trackfit:open-upgrade", onUpgrade);
    return () => window.removeEventListener("trackfit:open-upgrade", onUpgrade);
  }, []);

  // Focus trap. Even though the panel is technically a popover (not a
  // full modal), the same accessibility rules apply once it's open:
  // Tab cycling stays inside, ESC closes, focus returns to the gear
  // button on close. The trap's onEscape replaces the previous
  // standalone keydown listener so we don't double-handle the key.
  const panelRef = useFocusTrap<HTMLDivElement>({
    enabled: open,
    onEscape: () => {
      setOpen(false);
      setPrintOpen(false);
    },
  });

  // Persist + reflect to the document on every change.
  useEffect(() => {
    applyPrefsToDocument(prefs);
    savePrefs(prefs);
  }, [prefs]);

  // Click-outside to close. Also closes the print sub-popover so we never
  // have a hidden popover open after the menu collapses. ESC handling
  // moved to the focus-trap hook above.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
        setPrintOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [open, panelRef]);

  const replayIntro = () => {
    setOnboarded(false);
    // Easiest way to re-trigger the first-run modal cleanly is to
    // reload — App reads the flag once at mount.
    window.location.reload();
  };

  const handleExport = () => {
    // Pull the latest persisted state straight from localStorage so any
    // un-debounced edits in flight are still captured. loadPersisted()
    // returns null when the user has never typed anything; in that case
    // we ship an empty inventory rather than confusing them with an alert.
    const state = loadPersisted() ?? {
      unit: "in" as const,
      inventory: [],
      gapPhoto: null,
      target: "",
      tolerance: "0",
      gap_shape: "straight" as const,
      gap_arc_degrees: "",
      gap_offset: "",
    };
    exportInventory(state, prefs);
    setOpen(false);
  };

  const handleImportClick = () => {
    // Trigger the hidden <input type="file">. The actual work happens in
    // handleFileChange when the browser's picker resolves.
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file fires onChange again.
    e.target.value = "";
    if (!file) return;
    try {
      const backup = await readBackupFile(file);
      const ok = window.confirm(buildImportConfirmMessage(backup));
      if (!ok) return;
      // importInventory() reloads the page on success; nothing after this
      // line will run in the success path.
      importInventory(backup);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not import that file.";
      window.alert(`Import failed: ${message}`);
    }
  };

  const inventoryEmpty = inventory.length === 0;

  const onPrintInventory = async () => {
    // Insurance-grade PDF report is a Premium feature. The button
    // stays visible (discoverability matters — older audiences scan
    // the menu before tapping anything), but the PDF generation is
    // gated. Tapping while non-premium opens the upgrade modal.
    if (PREMIUM.enabled && !isPremium(premiumState)) {
      setPrintOpen(false);
      setPremiumOpen(true);
      return;
    }
    setPrintBusy(true);
    setPrintError(null);
    try {
      // Map the app's InventoryRow shape onto the renderer's row shape.
      // The renderer accepts `kind?: string` so we don't have to leak the
      // library's TrackKind union into pdf-land. We sanitize numeric
      // fields here so the renderer never sees NaN/undefined arithmetic.
      const rows = inventory.map((r) => ({
        label: r.label,
        kind: r.kind,
        length_mm:
          typeof r.length_mm === "number" && Number.isFinite(r.length_mm)
            ? r.length_mm
            : null,
        radius_mm:
          typeof r.radius_mm === "number" && Number.isFinite(r.radius_mm)
            ? r.radius_mm
            : null,
        arc_degrees:
          typeof r.arc_degrees === "number" && Number.isFinite(r.arc_degrees)
            ? r.arc_degrees
            : null,
        qty: r.qty,
        photo: r.photo,
        product_code: r.product_code ?? null,
      }));
      const isoDate = new Date().toISOString().slice(0, 10);
      const result = await renderInventoryReport({
        rows,
        paper_size: paper,
        generated_at: isoDate,
      });
      downloadPdf(result.pdf, `trackfit-inventory-${isoDate}.pdf`);
      setPrintOpen(false);
      setOpen(false);
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : String(e));
    } finally {
      setPrintBusy(false);
    }
  };

  return (
    <div className="settings-menu">
      <button
        ref={buttonRef}
        type="button"
        className="settings-trigger"
        aria-label="Open settings"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <GearIcon />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="settings-panel"
          role="dialog"
          aria-label="Comfort settings"
        >
          <p className="settings-panel__title">Comfort settings</p>
          <label className="settings-row">
            <span className="settings-row__label">
              <span className="settings-row__name">Bigger text</span>
              <span className="settings-row__hint">
                Increases body text by 25%.
              </span>
            </span>
            <input
              type="checkbox"
              checked={prefs.largeText}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, largeText: e.target.checked }))
              }
            />
          </label>
          <label className="settings-row">
            <span className="settings-row__label">
              <span className="settings-row__name">High contrast</span>
              <span className="settings-row__hint">
                Crisper black-on-white for bright rooms.
              </span>
            </span>
            <input
              type="checkbox"
              checked={prefs.highContrast}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, highContrast: e.target.checked }))
              }
            />
          </label>
          <label className="settings-row">
            <span className="settings-row__label">
              <span className="settings-row__name">Auto-identify photos</span>
              <span className="settings-row__hint">
                Guess what you photographed and fill the row for you.
              </span>
            </span>
            <input
              type="checkbox"
              checked={prefs.identify_on_capture}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  identify_on_capture: e.target.checked,
                }))
              }
            />
          </label>
          <button
            type="button"
            className="settings-row settings-row--button"
            onClick={handleExport}
          >
            <span className="settings-row__label">
              <span className="settings-row__name">Export my inventory</span>
              <span className="settings-row__hint">
                Save a backup file you can email to yourself.
              </span>
            </span>
          </button>
          <button
            type="button"
            className="settings-row settings-row--button"
            onClick={handleImportClick}
          >
            <span className="settings-row__label">
              <span className="settings-row__name">Import inventory…</span>
              <span className="settings-row__hint">
                Replace your inventory from a saved backup file.
              </span>
            </span>
          </button>
          {/* Hidden picker — the visible button above clicks it. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="settings-row settings-row--button"
            disabled={inventoryEmpty}
            aria-disabled={inventoryEmpty}
            onClick={() => {
              if (inventoryEmpty) return;
              // Insurance-grade PDF is a Premium feature. The button
              // stays visible at all times (discoverability), but
              // tapping it without an active license opens the
              // upgrade modal directly — skipping the paper-size
              // popover, which would otherwise tease them only to
              // hit the gate one click later.
              if (PREMIUM.enabled && !isPremium(premiumState)) {
                setOpen(false);
                setPrintOpen(false);
                setPremiumOpen(true);
                return;
              }
              setPrintOpen((v) => !v);
              setPrintError(null);
            }}
          >
            <span className="settings-row__label">
              <span className="settings-row__name">Print inventory report</span>
              <span className="settings-row__hint">
                {inventoryEmpty
                  ? "Add some pieces first"
                  : "PDF binder of every piece you own."}
              </span>
            </span>
          </button>
          {printOpen && !inventoryEmpty ? (
            <div className="cut-template-popover settings-print-popover">
              <p className="field-label">Paper</p>
              <div className="unit-toggle cut-template-paper">
                <button
                  type="button"
                  className={paper === "letter" ? "active" : ""}
                  onClick={() => setPaper("letter")}
                >
                  Letter
                </button>
                <button
                  type="button"
                  className={paper === "a4" ? "active" : ""}
                  onClick={() => setPaper("a4")}
                >
                  A4
                </button>
              </div>
              {printError ? (
                <p className="cut-template-error">{printError}</p>
              ) : null}
              <div className="cut-template-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPrintOpen(false)}
                  disabled={printBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn cut-template-submit"
                  onClick={onPrintInventory}
                  disabled={printBusy}
                >
                  {printBusy ? "Generating…" : "Generate PDF"}
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="settings-row settings-row--button"
            onClick={replayIntro}
          >
            <span className="settings-row__label">
              <span className="settings-row__name">Show intro again</span>
              <span className="settings-row__hint">
                Replay the welcome cards.
              </span>
            </span>
          </button>
          {/* Discord feedback link — gated on VITE_DISCORD_FEEDBACK_URL.
              When the env var isn't set, the row simply doesn't render,
              keeping the menu clean before the server exists. */}
          {FEEDBACK.discordUrl.length > 0 ? (
            <a
              href={FEEDBACK.discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="settings-row settings-row--button"
            >
              <span className="settings-row__label">
                <span className="settings-row__name">Give feedback on Discord</span>
                <span className="settings-row__hint">
                  Tell us what worked, what didn't, what's missing.
                </span>
              </span>
            </a>
          ) : null}
          {/* Report-an-issue mailto. Always shown — email is the lowest-
              friction channel for this audience and doubles as the support
              path the launch strategy leans on (reply within a day). */}
          <a
            href="mailto:stevieweedseed@gmail.com?subject=Trackfit%20issue%20or%20feedback"
            className="settings-row settings-row--button"
          >
            <span className="settings-row__label">
              <span className="settings-row__name">Report an issue</span>
              <span className="settings-row__hint">
                Spotted a wrong number or something confusing? Email me and
                I&apos;ll take a look.
              </span>
            </span>
          </a>
          {PREMIUM.enabled ? (
            isPremium(premiumState) ? (
              // Active-license display row. Not a button — the user
              // shouldn't accidentally tap into the upsell flow when
              // they're already paid up. The "Deactivate" link below
              // is the only interactive element.
              <div className="settings-row">
                <span className="settings-row__label">
                  <span
                    className="settings-row__name"
                    style={{ color: "var(--good)" }}
                  >
                    Premium ✦ active
                  </span>
                  <span className="settings-row__hint">
                    {premiumState.activated_at
                      ? `Activated ${premiumState.activated_at.slice(0, 10)}.`
                      : "All paid features unlocked."}
                    {" "}
                    <button
                      type="button"
                      // Reuse the .btn styling but inline-size it like
                      // a link. No new CSS — the only inline tweaks are
                      // padding/border/font reset to make it look like
                      // body copy, all using existing tokens.
                      onClick={() => {
                        const ok = window.confirm(
                          "Turn off Premium on this device? You can re-activate later with the same code.",
                        );
                        if (!ok) return;
                        deactivatePremium();
                        refreshPremium();
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        font: "inherit",
                        color: "var(--accent)",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Deactivate
                    </button>
                  </span>
                </span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="settings-row settings-row--button"
                  onClick={() => {
                    // Close the panel before opening the modal so we
                    // don't stack two focus traps. The modal owns
                    // focus from the moment it opens.
                    setOpen(false);
                    setLicenseOpen(true);
                  }}
                >
                  <span className="settings-row__label">
                    <span className="settings-row__name">
                      I have a license code
                    </span>
                    <span className="settings-row__hint">
                      Activate Trackfit Premium with your TFP-XXXX code.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="settings-row settings-row--button"
                  onClick={() => {
                    setOpen(false);
                    setPremiumOpen(true);
                  }}
                >
                  <span className="settings-row__label">
                    <span className="settings-row__name">Trackfit Premium</span>
                    <span className="settings-row__hint">
                      Photo-ID, cloud sync, and printable cut templates.
                    </span>
                  </span>
                </button>
              </>
            )
          ) : null}
        </div>
      )}
      {PREMIUM.enabled ? (
        <>
          <PremiumModal
            open={premiumOpen}
            onClose={() => setPremiumOpen(false)}
          />
          <LicenseActivation
            open={licenseOpen}
            onClose={() => setLicenseOpen(false)}
            onActivated={refreshPremium}
          />
        </>
      ) : null}
    </div>
  );
}

function GearIcon() {
  // Inline SVG — no icon library. Stroke uses currentColor so the
  // CSS rule on `.settings-trigger` paints it.
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
