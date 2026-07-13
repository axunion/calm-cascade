import { Dialog } from "@kobalte/core/dialog";
import { Switch } from "@kobalte/core/switch";
import { Settings, X } from "lucide-solid";
import type { SetStoreFunction } from "solid-js/store";
import type { PuzzleSettings, PuzzleState } from "../store/puzzleStore.ts";
import dialogStyles from "../styles/dialogs.module.css";
import puzzleStyles from "../styles/Puzzle.module.css";

export interface SettingsDialogProps {
  settings: PuzzleSettings;
  setStore: SetStoreFunction<PuzzleState>;
}

interface SwitchRowProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
}

function SwitchRow(props: SwitchRowProps) {
  return (
    <Switch
      class={dialogStyles.switchRow}
      checked={props.checked}
      onChange={props.onChange}
    >
      <Switch.Label class={dialogStyles.switchLabel}>
        {props.label}
      </Switch.Label>
      <Switch.Input />
      <Switch.Control class={dialogStyles.switchControl}>
        <Switch.Thumb class={dialogStyles.switchThumb} />
      </Switch.Control>
    </Switch>
  );
}

// Kobalte Dialog with 6 Switch toggles (spec/03 §3): theme / reduced motion /
// haptics / color-blind shapes / sound / particles.
function SettingsDialog(props: SettingsDialogProps) {
  return (
    <Dialog>
      <Dialog.Trigger class={puzzleStyles.iconButton} aria-label="Settings">
        <Settings size={24} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class={dialogStyles.overlay} />
        <div class={dialogStyles.positioner}>
          <Dialog.Content class={dialogStyles.content}>
            <div class={dialogStyles.header}>
              <Dialog.Title class={dialogStyles.title}>Settings</Dialog.Title>
              <Dialog.CloseButton
                class={dialogStyles.closeButton}
                aria-label="Close"
              >
                <X size={20} aria-hidden="true" />
              </Dialog.CloseButton>
            </div>
            <div class={dialogStyles.toggleList}>
              <SwitchRow
                label="Dark theme"
                checked={props.settings.theme === "dark"}
                onChange={(checked) =>
                  props.setStore(
                    "settings",
                    "theme",
                    checked ? "dark" : "light",
                  )
                }
              />
              <SwitchRow
                label="Reduce motion"
                checked={props.settings.reducedMotion}
                onChange={(checked) =>
                  props.setStore("settings", "reducedMotion", checked)
                }
              />
              <SwitchRow
                label="Haptics"
                checked={props.settings.haptics}
                onChange={(checked) =>
                  props.setStore("settings", "haptics", checked)
                }
              />
              <SwitchRow
                label="Color-blind shapes"
                checked={props.settings.colorBlindShapes}
                onChange={(checked) =>
                  props.setStore("settings", "colorBlindShapes", checked)
                }
              />
              <SwitchRow
                label="Sound"
                checked={props.settings.sound}
                onChange={(checked) =>
                  props.setStore("settings", "sound", checked)
                }
              />
              <SwitchRow
                label="Particles"
                checked={props.settings.particles}
                onChange={(checked) =>
                  props.setStore("settings", "particles", checked)
                }
              />
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}

export default SettingsDialog;
