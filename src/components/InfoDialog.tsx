import { Dialog } from "@kobalte/core/dialog";
import { Tabs } from "@kobalte/core/tabs";
import { ArrowLeftRight, Info, Sparkles, X, Zap } from "lucide-solid";
import type { JSX } from "solid-js";
import type { PuzzleStats } from "../store/puzzleStore.ts";
import dialogStyles from "../styles/dialogs.module.css";
import puzzleStyles from "../styles/Puzzle.module.css";

export interface InfoDialogProps {
  stats: PuzzleStats;
}

interface HowToStep {
  icon: (props: { size: number; "aria-hidden": true }) => JSX.Element;
  text: string;
}

const HOW_TO_STEPS: HowToStep[] = [
  {
    icon: ArrowLeftRight,
    text: "Swipe or tap two adjacent gems to swap them.",
  },
  {
    icon: Sparkles,
    text: "Line up 3 or more matching gems in a row or column to clear them.",
  },
  {
    icon: Zap,
    text: "Match 4 in a row to create a laser gem - swap two lasers for a cross-clear.",
  },
];

const STAT_ROWS: { label: string; key: keyof PuzzleStats }[] = [
  { label: "Total score", key: "totalScore" },
  { label: "Best combo", key: "bestCombo" },
  { label: "Gems cleared", key: "gemsCleared" },
  { label: "Lasers fired", key: "lasersFired" },
  { label: "Times shuffled", key: "gamesShuffled" },
];

// Kobalte Dialog + Tabs (spec/03 §3): "How to Play" (brief 3-step
// explanation) and "Stats" (the 5 PuzzleStats fields).
function InfoDialog(props: InfoDialogProps) {
  return (
    <Dialog>
      <Dialog.Trigger
        class={puzzleStyles.iconButton}
        aria-label="How to play and stats"
      >
        <Info size={24} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class={dialogStyles.overlay} />
        <div class={dialogStyles.positioner}>
          <Dialog.Content class={dialogStyles.content}>
            <div class={dialogStyles.header}>
              <Dialog.Title class={dialogStyles.title}>Info</Dialog.Title>
              <Dialog.CloseButton
                class={dialogStyles.closeButton}
                aria-label="Close"
              >
                <X size={20} aria-hidden="true" />
              </Dialog.CloseButton>
            </div>
            <Tabs class={dialogStyles.tabs} defaultValue="how-to-play">
              <Tabs.List class={dialogStyles.tabList}>
                <Tabs.Trigger
                  class={dialogStyles.tabTrigger}
                  value="how-to-play"
                >
                  How to Play
                </Tabs.Trigger>
                <Tabs.Trigger class={dialogStyles.tabTrigger} value="stats">
                  Stats
                </Tabs.Trigger>
                <Tabs.Indicator class={dialogStyles.tabIndicator} />
              </Tabs.List>
              <Tabs.Content class={dialogStyles.tabContent} value="how-to-play">
                <ol class={dialogStyles.stepList}>
                  {HOW_TO_STEPS.map((step) => (
                    <li class={dialogStyles.step}>
                      <step.icon size={20} aria-hidden={true} />
                      <span>{step.text}</span>
                    </li>
                  ))}
                </ol>
              </Tabs.Content>
              <Tabs.Content class={dialogStyles.tabContent} value="stats">
                <dl class={dialogStyles.statsList}>
                  {STAT_ROWS.map((row) => (
                    <div class={dialogStyles.statRow}>
                      <dt>{row.label}</dt>
                      <dd>{props.stats[row.key]}</dd>
                    </div>
                  ))}
                </dl>
              </Tabs.Content>
            </Tabs>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}

export default InfoDialog;
