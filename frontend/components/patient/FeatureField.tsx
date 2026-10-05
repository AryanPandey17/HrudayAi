import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fieldError, type FieldState } from "@/lib/form";
import type { Feature } from "@/lib/types";

interface FeatureFieldProps {
  feature: Feature;
  field: FieldState | undefined;
  onChange: (name: string, text: string) => void;
}

// The chosen option gets an inset accent ring and stronger text, so the state reads without colour fill.
const SELECTED_TOGGLE =
  "data-[state=on]:bg-primary/10 data-[state=on]:font-semibold data-[state=on]:shadow-[inset_0_0_0_1px_var(--primary)]";

/** One schema-driven input: number with unit suffix, two-option toggle, or select. */
export function FeatureField({ feature, field, onChange }: FeatureFieldProps) {
  const text = field?.text ?? "";
  const error = text ? fieldError(feature, text) : null;
  const isPlaceholder = field?.source === "placeholder";
  const id = `feature-${feature.name.replace(/\W+/g, "-")}`;
  const typical =
    feature.type === "numeric" ? String(feature.default) : feature.options.find((o) => o.value === feature.default)?.label;
  const dashed = isPlaceholder ? "border-dashed" : "";

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="truncate text-[13px]" title={feature.description ?? feature.label}>
          {feature.label}
        </Label>
        {isPlaceholder && <span className="shrink-0 text-xs text-muted-foreground">placeholder</span>}
      </div>
      {feature.type === "numeric" ? (
        <InputGroup className={`h-8 ${dashed}`}>
          <InputGroupInput
            id={id}
            type="number"
            inputMode="decimal"
            min={feature.min ?? undefined}
            max={feature.max ?? undefined}
            step={feature.step ?? "any"}
            value={text}
            placeholder={`e.g. ${typical}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => onChange(feature.name, event.target.value)}
            className="tabular-nums"
          />
          {feature.unit && (
            <InputGroupAddon align="inline-end">
              <InputGroupText className="text-xs">{feature.unit}</InputGroupText>
            </InputGroupAddon>
          )}
        </InputGroup>
      ) : feature.type === "binary" ? (
        <ToggleGroup
          id={id}
          type="single"
          variant="outline"
          size="sm"
          value={text}
          onValueChange={(value) => value && onChange(feature.name, value)}
          aria-label={feature.label}
          className={`w-full ${dashed}`}
        >
          {feature.options.map((option, index) => (
            <ToggleGroupItem key={option.label} value={String(index)} className={`flex-1 ${SELECTED_TOGGLE}`}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : (
        <Select value={text} onValueChange={(value) => onChange(feature.name, value)}>
          <SelectTrigger id={id} size="sm" className={`w-full ${dashed}`}>
            <SelectValue placeholder={`e.g. ${typical}`} />
          </SelectTrigger>
          <SelectContent>
            {feature.options.map((option, index) => (
              <SelectItem key={option.label} value={String(index)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
