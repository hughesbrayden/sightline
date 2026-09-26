// Sightline components: window.Sightline, React 18. Types are documentation only.

/** The 8 puzzle colors, by index. Image content only, never UI state. */
export type PixelColor = "void" | "paper" | "red" | "orange" | "yellow" | "green" | "blue" | "brown";
export type Pixel = PixelColor | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export declare const PALETTE: PixelColor[];

export interface PuzzleGridProps {
  /** Grid side in cells. 16 for the evolution loop, 32 for showcase puzzles. Default 16. */
  size?: 16 | 32 | number;
  /** size*size pixels, row-major: the guess (or the truth when showing the answer). */
  cells: Pixel[];
  /** 0..1 per cell. Drawn as opacity: conf-floor + (1 - conf-floor) * confidence. Omit for the answer. */
  confidence?: number[];
  /** The answer, row-major. With showErrors, cells that differ get an outline. */
  truth?: Pixel[];
  showErrors?: boolean;
  /** Cell size in px. Default 12 (the cell token); 24 for showcase. */
  cellSize?: number;
  /** Default 0.15, the conf-floor token. */
  confidenceFloor?: number;
  /** Uppercase label under the grid, e.g. "Gen 14". */
  caption?: string;
  /** Right-aligned number under the grid, e.g. "231/256 right". */
  meta?: string;
  /** Accessible name. Default "16 by 16 puzzle". */
  label?: string;
  className?: string;
}
export declare function PuzzleGrid(props: PuzzleGridProps): JSX.Element;

export type BadgeKind = "passed" | "rejected" | "skipped" | "denied" | "running";
export interface StatusBadgeProps {
  kind: BadgeKind;
  /** Overrides the default text ("Gate passed", "Rejected", "Skipped · seen before", "Read denied", "Running"). */
  children?: React.ReactNode;
  className?: string;
}
export declare function StatusBadge(props: StatusBadgeProps): JSX.Element;

export type NodeStatus = "accepted" | "rejected" | "pending" | "skipped";
export interface LineageNodeProps {
  gen: number;
  status: NodeStatus;
  /** Training score 0..1, shown as a percentage with one decimal. */
  score?: number;
  /** Change vs parent, 0..1 scale (0.038 shows "+3.8"). */
  delta?: number;
  /** The generation currently selected or on screen. */
  active?: boolean;
  /** When set, the node renders as a button. */
  onClick?: () => void;
  className?: string;
}
export declare function LineageNode(props: LineageNodeProps): JSX.Element;

export interface ScoreCurveProps {
  /** Mean training score per generation, 0..1. */
  train: number[];
  /** Held-out score per generation, 0..1. Never used for selection. */
  heldout?: number[];
  /** Baseline score, drawn dashed. */
  baseline?: number;
  width?: number;
  height?: number;
  /** Y-axis domain, 0..1. Default 0.4..1. */
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}
export declare function ScoreCurve(props: ScoreCurveProps): JSX.Element;

export type Knob = "retrieve" | "derive" | "suppress" | "represent";
export interface GenomeChange {
  knob: Knob;
  op?: "add" | "remove" | "change";
  text: string;
}
export interface DiffCardProps {
  gen: number;
  parent?: number;
  changes: GenomeChange[];
  /** Mutator's prediction, 0..1 scale (0.05 shows "+5.0 pts"). */
  predicted?: number;
  /** Measured change on the training set, same scale. */
  actual?: number;
  status?: BadgeKind;
  className?: string;
}
export declare function DiffCard(props: DiffCardProps): JSX.Element;
