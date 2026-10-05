"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { VESSELS } from "@/lib/heart/anatomy";
import type { RiskBand } from "@/lib/types";

import type { VesselState } from "./HeartScene";
import { RiskLegend } from "./RiskLegend";

const HeartScene = dynamic(() => import("./HeartScene"), {
  ssr: false,
  loading: () => <p className="grid size-full place-items-center text-sm text-muted">Loading 3D heart…</p>,
});

interface HeartViewerProps {
  vessels: Record<string, VesselState>;
  bands: RiskBand[];
  /** Selected vessel id, or null when the overall (whole-heart) target is selected. */
  selected: string | null;
  onSelectVessel: (id: string) => void;
  onSelectHeart: () => void;
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  swatch?: string;
}

function Toggle({ label, checked, onChange, swatch }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface/85 px-2 py-1 text-xs font-medium backdrop-blur">
      <input type="checkbox" className="accent-(--accent)" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {swatch && <span className="size-2 rounded-full" style={{ background: swatch }} />}
      {label}
    </label>
  );
}

/** 3D canvas plus its on-canvas controls, hover read-out and colour legend. */
export function HeartViewer({ vessels, bands, selected, onSelectVessel, onSelectHeart }: HeartViewerProps) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [showTorso, setShowTorso] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [viewKey, setViewKey] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  const drawable = VESSELS.filter(({ id }) => id in vessels);
  const focus = VESSELS.find(({ id }) => id === (hovered ?? selected));
  const sceneVessels = Object.fromEntries(
    Object.entries(vessels).map(([id, state]) => [id, { ...state, pulsing: state.pulsing && pulse }]),
  );
  const setVisible = (id: string, visible: boolean) =>
    setHidden((current) => {
      const next = new Set(current);
      if (visible) next.delete(id);
      else next.add(id);
      return next;
    });
  const resetView = () => {
    onSelectHeart();
    setViewKey((key) => key + 1);
  };

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface" aria-label="3D heart viewer">
      <div
        className="relative h-[420px] sm:h-[520px] xl:h-[560px]"
        style={{ background: "linear-gradient(var(--canvas-top), var(--canvas-bottom))" }}
      >
        <HeartScene
          vessels={sceneVessels}
          hidden={hidden}
          selected={selected}
          showLabels={showLabels}
          showTorso={showTorso}
          viewKey={viewKey}
          onSelectVessel={onSelectVessel}
          onSelectHeart={onSelectHeart}
          onHover={setHovered}
        />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <fieldset className="pointer-events-auto flex flex-wrap gap-1.5">
            <legend className="sr-only">Show vessels</legend>
            {drawable.map(({ id }) => (
              <Toggle key={id} label={id} swatch={vessels[id].color} checked={!hidden.has(id)} onChange={(on) => setVisible(id, on)} />
            ))}
          </fieldset>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
            <Toggle label="Labels" checked={showLabels} onChange={setShowLabels} />
            <Toggle label="Torso" checked={showTorso} onChange={setShowTorso} />
            <Toggle label="Pulse high" checked={pulse} onChange={setPulse} />
            <button
              type="button"
              onClick={resetView}
              className="rounded-md border border-border bg-surface/85 px-2.5 py-1 text-xs font-semibold backdrop-blur hover:bg-surface-2"
            >
              Reset view
            </button>
          </div>
        </div>
        <p className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2 text-[11px] text-muted">
          <span className="rounded-md bg-surface/85 px-2 py-1 backdrop-blur">
            {focus ? (
              <>
                <strong className="text-fg">{focus.id}</strong> · {focus.name} · supplies: {focus.territory.toLowerCase()}
              </>
            ) : (
              "Drag to rotate · scroll to zoom · right-drag to pan · click a vessel to inspect it"
            )}
          </span>
          <span className="rounded-md bg-surface/85 px-2 py-1 backdrop-blur">Stylised procedural anatomy, not patient imaging</span>
        </p>
      </div>
      <div className="border-t border-border px-4 py-3">
        <RiskLegend bands={bands} />
      </div>
    </section>
  );
}
