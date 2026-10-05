"use client";

import { Activity, ChartColumn, ChartNoAxesCombined } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Feature, FeatureGroup, LadderResponse, MetricsResponse } from "@/lib/types";

import { ExplanationTab } from "./ExplanationTab";
import { PerformanceTab } from "./PerformanceTab";
import { PredictionTab, type PredictionTabProps } from "./PredictionTab";

interface ResultsPanelProps extends PredictionTabProps {
  ladder: LadderResponse;
  metrics: MetricsResponse;
  groups: FeatureGroup[];
  features: Feature[];
  placeholderNames: ReadonlySet<string>;
  error: string | null;
}

// Radix wraps scroll content in a table-display div that grows to its widest child; make it a
// block so wide tables scroll inside their own container instead of stretching the panel.
const BLOCK_VIEWPORT = "[&_[data-slot=scroll-area-viewport]>div]:!block";

const TABS = [
  { value: "prediction", label: "Prediction", icon: Activity },
  { value: "explanation", label: "Explanation", icon: ChartColumn },
  { value: "performance", label: "Model performance", icon: ChartNoAxesCombined },
];

/** Right zone: target selector plus the Prediction / Explanation / Model performance tabs. */
export function ResultsPanel(props: ResultsPanelProps) {
  const { targets, selected, onSelect, byStage, activeStage, stages } = props;
  const prediction = byStage[activeStage]?.predictions[selected] ?? null;
  const stageLabel = stages.find((stage) => stage.id === activeStage)?.label ?? "";

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Results">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b py-3 pl-4 pr-12 lg:pr-4">
        <h2 className="text-lg font-semibold tracking-tight">Results</h2>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={selected}
          onValueChange={(value: string) => value && onSelect(value)}
          aria-label="Target"
        >
          {targets.map((target) => (
            <ToggleGroupItem key={target.name} value={target.name}>
              {target.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </header>
      <Tabs defaultValue="prediction" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="shrink-0 border-b px-4 py-2">
          <TabsList className="w-full">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="text-xs sm:text-sm">
                <Icon aria-hidden className="hidden sm:block" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <ScrollArea className={`min-h-0 flex-1 ${BLOCK_VIEWPORT}`}>
          <div className="p-4">
            {props.error && (
              <p role="alert" className="mb-4 rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive">
                Prediction failed: {props.error}
              </p>
            )}
            <TabsContent value="prediction">
              <PredictionTab {...props} />
            </TabsContent>
            <TabsContent value="explanation">
              <ExplanationTab
                selected={selected}
                prediction={prediction}
                stageLabel={stageLabel}
                groups={props.groups}
                features={props.features}
                placeholderNames={props.placeholderNames}
              />
            </TabsContent>
            <TabsContent value="performance">
              <PerformanceTab targets={targets} ladder={props.ladder} metrics={props.metrics} selected={selected} activeStage={activeStage} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </section>
  );
}
