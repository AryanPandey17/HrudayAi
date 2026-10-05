"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";

import { ReliabilityBadge } from "@/components/shared/badges";
import { NoExplanationArt } from "@/components/shared/illustrations";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent, formatPoints } from "@/lib/risk";
import type { Contribution, Feature, FeatureGroup, TargetPrediction } from "@/lib/types";

interface ExplanationTabProps {
  selected: string;
  prediction: TargetPrediction | null;
  stageLabel: string;
  groups: FeatureGroup[];
  features: Feature[];
  /** Names of inputs currently holding a typical placeholder value. */
  placeholderNames: ReadonlySet<string>;
}

const MAX_BARS = 8;
const ROW_HEIGHT = 30;
const LABEL_ROOM = 1.7;
const CONFIG = {
  points: { label: "Contribution (percentage points)" },
} satisfies ChartConfig;

interface Row {
  name: string;
  points: number;
  text: string;
  contribution: Contribution;
}

function ContributionTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const { contribution } = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-medium">{contribution.label}</p>
      <p className="text-muted-foreground">Value: {contribution.display_value}</p>
      <p>
        {contribution.shap_value > 0 ? "Raises" : "Lowers"} the estimate by {formatPoints(Math.abs(contribution.probability_impact)).slice(1)}
      </p>
      <p className="font-mono text-muted-foreground">SHAP {contribution.shap_value.toFixed(3)} log-odds</p>
    </div>
  );
}

/** Diverging bar centred on zero, scaled to the largest contribution. */
function ImpactBar({ impact, scale }: { impact: number; scale: number }) {
  const width = scale > 0 ? (Math.abs(impact) / scale) * 50 : 0;
  const raises = impact >= 0;
  return (
    <span className="relative block h-1.5 w-full rounded-full bg-muted" aria-hidden>
      <span className="absolute left-1/2 top-0 h-full w-px bg-muted-foreground" />
      <span
        className={`absolute top-0 h-full rounded-full ${raises ? "bg-raise" : "bg-lower"}`}
        style={{ width: `${width}%`, left: raises ? "50%" : `${50 - width}%` }}
      />
    </span>
  );
}

/** Why the selected target got its estimate: top SHAP contributions, then every measurement. */
export function ExplanationTab({ selected, prediction, stageLabel, groups, features, placeholderNames }: ExplanationTabProps) {
  const [group, setGroup] = useState("all");
  if (!prediction) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <NoExplanationArt className="h-20 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>Nothing to explain yet</EmptyTitle>
          <EmptyDescription>Once there is an estimate, this tab shows which measurements moved it and by how much.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const rows: Row[] = prediction.contributions.slice(0, MAX_BARS).map((contribution) => ({
    name: `${contribution.label}: ${contribution.display_value}`,
    points: contribution.probability_impact * 100,
    text: formatPoints(contribution.probability_impact),
    contribution,
  }));
  // Pad the axis so value labels at both bar ends stay clear of the category names.
  const points = rows.map((row) => row.points);
  const domain = [Math.floor(Math.min(0, ...points) * LABEL_ROOM), Math.ceil(Math.max(0, ...points) * LABEL_ROOM)];
  const [topRaise] = prediction.top_positive;
  const [topLower] = prediction.top_negative;
  const groupOf = new Map(features.map((feature) => [feature.name, feature.group]));
  const measurements = prediction.contributions.filter((c) => group === "all" || groupOf.get(c.feature) === group);
  const scale = Math.max(0, ...prediction.contributions.map((c) => Math.abs(c.probability_impact)));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-base leading-relaxed">
          The {selected} estimate is <span className="font-semibold tabular-nums">{formatPercent(prediction.probability, 1)}</span>, against{" "}
          <span className="tabular-nums">{formatPercent(prediction.base_probability, 1)}</span> for the average training patient at
          this step ({stageLabel}).
          {topRaise && <> Biggest upward factor: {topRaise.label} ({formatPoints(topRaise.probability_impact)}).</>}
          {topLower && <> Biggest downward factor: {topLower.label} ({formatPoints(topLower.probability_impact)}).</>}
        </p>
        <ReliabilityBadge metrics={prediction.stage_metrics} />
      </div>

      <div>
        <div className="mb-1 flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-raise" aria-hidden /> <ArrowUp className="size-3" aria-hidden /> raises the estimate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-lower" aria-hidden /> <ArrowDown className="size-3" aria-hidden /> lowers it
          </span>
        </div>
        <ChartContainer config={CONFIG} className="aspect-auto w-full" style={{ height: rows.length * ROW_HEIGHT + 28 }}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap={7}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" domain={domain} tickLine={false} axisLine={false} fontSize={12} tickFormatter={(value: number) => `${value > 0 ? "+" : ""}${value}`} />
            <YAxis type="category" dataKey="name" width={168} tickLine={false} axisLine={false} fontSize={12} interval={0} />
            <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ContributionTooltip />} />
            <ReferenceLine x={0} stroke="var(--foreground)" />
            <Bar dataKey="points" radius={3} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell key={row.name} fill={row.points >= 0 ? "var(--raise)" : "var(--lower)"} />
              ))}
              <LabelList dataKey="text" position="right" className="fill-foreground font-mono" fontSize={12} />
            </Bar>
          </BarChart>
        </ChartContainer>
        <p className="mt-2 text-xs text-muted-foreground">
          Bars are percentage points: exact SHAP values (log-odds) rescaled so that all contributions add up to the difference
          from the average patient. They describe how the model weighs each input, not cause and effect.
        </p>
      </div>

      <Separator />
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium">
            All {prediction.contributions.length} measurements at this step
          </p>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger size="sm" aria-label="Filter measurements by group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groups.map(({ id, label }) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="h-80 rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Measurement</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-1/4">Contribution</TableHead>
                <TableHead className="text-right">pp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {measurements.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="font-medium whitespace-normal">{row.label}</TableCell>
                  <TableCell className="tabular-nums">
                    {row.display_value}
                    {placeholderNames.has(row.feature) && <span className="ml-1.5 text-xs text-muted-foreground">placeholder</span>}
                  </TableCell>
                  <TableCell>
                    <ImpactBar impact={row.probability_impact} scale={scale} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatPoints(row.probability_impact)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}
