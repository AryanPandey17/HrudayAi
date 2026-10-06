"use client";

import { PersonStanding, Rotate3d, RotateCcw, Tag } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ThemeTokens } from "@/hooks/useThemeTokens";
import { VESSELS } from "@/lib/heart/anatomy";
import type { RiskBand } from "@/lib/types";

import type { VesselState } from "./HeartScene";
import { RiskLegend } from "./RiskLegend";

const HeartScene = dynamic(() => import("./HeartScene"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

interface HeartViewerProps {
  vessels: Record<string, VesselState>;
  tokens: ThemeTokens;
  bands: RiskBand[];
  /** Selected vessel id, or null when the overall (whole-heart) target is selected. */
  selected: string | null;
  onSelectVessel: (id: string) => void;
  onSelectHeart: () => void;
}

/** 3D canvas with its toolbar, hover read-out, model credit and colour legend. */
export function HeartViewer({ vessels, tokens, bands, selected, onSelectVessel, onSelectHeart }: HeartViewerProps) {
  const drawable = VESSELS.filter(({ id }) => id in vessels);
  const [shown, setShown] = useState(() => drawable.map(({ id }) => id));
  const [showLabels, setShowLabels] = useState(true);
  const [showTorso, setShowTorso] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [viewKey, setViewKey] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const hidden = new Set(drawable.map(({ id }) => id).filter((id) => !shown.includes(id)));
  const focus = VESSELS.find(({ id }) => id === (hovered ?? selected));
  const resetView = () => {
    onSelectHeart();
    setViewKey((key) => key + 1);
  };

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="3D heart viewer">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <ToggleGroup type="multiple" variant="outline" size="sm" value={shown} onValueChange={setShown} aria-label="Vessels shown">
          {drawable.map(({ id, name }) => (
            <ToggleGroupItem key={id} value={id} aria-label={`Show ${name}`}>
              <span className="size-2 rounded-full" style={{ background: vessels[id].color }} aria-hidden />
              {id}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-1">
          <Toggle size="sm" pressed={showLabels} onPressedChange={setShowLabels} aria-label="Vessel labels">
            <Tag /> Labels
          </Toggle>
          <Toggle size="sm" pressed={showTorso} onPressedChange={setShowTorso} aria-label="Torso outline">
            <PersonStanding /> Torso
          </Toggle>
          {!reducedMotion && (
            <Toggle size="sm" pressed={autoRotate} onPressedChange={setAutoRotate} aria-label="Slow rotation">
              <Rotate3d /> Rotate
            </Toggle>
          )}
          <Button variant="outline" size="sm" onClick={resetView}>
            <RotateCcw /> Reset view
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-canvas">
        <HeartScene
          vessels={vessels}
          tokens={tokens}
          hidden={hidden}
          selected={selected}
          showLabels={showLabels}
          showTorso={showTorso}
          autoRotate={autoRotate}
          reducedMotion={reducedMotion}
          viewKey={viewKey}
          onSelectVessel={onSelectVessel}
          onSelectHeart={onSelectHeart}
          onHover={setHovered}
        />
        <div className="pointer-events-none absolute inset-x-3 bottom-2 flex flex-wrap items-end justify-between gap-2 text-xs text-muted-foreground">
          <p className={`rounded-md bg-background/90 px-2 py-1 ${focus ? "" : "hidden sm:block"}`}>
            {focus ? (
              <>
                <span className="font-medium text-foreground">{focus.id}</span> · {focus.name} · supplies the {focus.territory}
              </>
            ) : (
              "Drag to rotate, scroll to zoom, click a vessel"
            )}
          </p>
          <p className="rounded-md bg-background/90 px-2 py-1">Reference anatomy, not patient imaging</p>
        </div>
      </div>
      <div className="shrink-0 border-t px-5 py-3">
        <RiskLegend bands={bands} steps={tokens.risk} idleColor={tokens.vesselIdle} />
      </div>
    </section>
  );
}
