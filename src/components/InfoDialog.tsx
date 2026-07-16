import { Dialog } from "@kobalte/core/dialog";
import { Tabs } from "@kobalte/core/tabs";
import {
  ArrowLeftRight,
  Check,
  Flower2,
  Gem,
  Info,
  Sparkles,
  X,
  Zap,
} from "lucide-solid";
import { type JSX, Show } from "solid-js";
import { ACHIEVEMENTS } from "../game/achievements.ts";
import type { PuzzleStats } from "../store/puzzleStore.ts";
import dialogStyles from "../styles/dialogs.module.css";
import puzzleStyles from "../styles/Puzzle.module.css";

export interface InfoDialogProps {
  stats: PuzzleStats;
  unlockedAchievements: string[];
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
  {
    icon: Flower2,
    text: "Match an L or T shape to create a bomb gem - it blooms open across a 3x3 area.",
  },
  {
    icon: Gem,
    text: "Match 5 in a row to create a prism gem - it clears every gem of that color.",
  },
];

const STAT_ROWS: { label: string; key: keyof PuzzleStats }[] = [
  { label: "Total score", key: "totalScore" },
  { label: "Best combo", key: "bestCombo" },
  { label: "Gems cleared", key: "gemsCleared" },
  { label: "Lasers fired", key: "lasersFired" },
  { label: "Times shuffled", key: "gamesShuffled" },
];

// Kobalte Dialog + Tabs (spec/03 §3): "How to Play" (brief step-by-step
// explanation), "Stats" (the 5 PuzzleStats fields), and "Goals" (all
// achievements - spec/01 §9 forbids hidden achievements, so unlocked and
// locked ones both always show their condition).
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
                <Tabs.Trigger class={dialogStyles.tabTrigger} value="goals">
                  Goals
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
              <Tabs.Content class={dialogStyles.tabContent} value="goals">
                <ul class={dialogStyles.goalsList}>
                  {ACHIEVEMENTS.map((achievement) => (
                    <li class={dialogStyles.goalRow}>
                      <Show
                        when={props.unlockedAchievements.includes(
                          achievement.id,
                        )}
                        fallback={
                          <span
                            class={dialogStyles.goalIconSlot}
                            aria-hidden="true"
                          />
                        }
                      >
                        <Check
                          size={18}
                          aria-hidden="true"
                          class={dialogStyles.goalCheck}
                        />
                      </Show>
                      <div class={dialogStyles.goalText}>
                        <span class={dialogStyles.goalTitle}>
                          {achievement.title}
                        </span>
                        <span class={dialogStyles.goalDescription}>
                          {achievement.description}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Tabs.Content>
            </Tabs>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}

export default InfoDialog;
