import { useEffect, useRef } from "react";

/**
 * A single keybind entry: the key to listen for and the action to run.
 * `key` is matched case-insensitively against `KeyboardEvent.key`.
 */
export interface Keybind {
  /** The key value (e.g. "r", "H", "6", "0"). Matched case-insensitively. */
  key: string;
  /** Callback fired when the key is pressed. */
  action: () => void;
}

export interface UseKeybindsOptions {
  /** The list of keybinds to register. */
  binds: Keybind[];
  /** Only listen when this is true (default: true). */
  enabled?: boolean;
  /**
   * Ignore key events originating from input/textarea/select elements
   * so users can still type normally (default: true).
   */
  ignoreInputs?: boolean;
  /**
   * Ignore key events with modifier keys held (ctrl, alt, meta, shift).
   * Prevents collisions with browser/system shortcuts (default: true).
   */
  ignoreWithModifiers?: boolean;
}

/**
 * Registers global keyboard shortcuts.
 *
 * Usage:
 * ```ts
 * useKeybinds({
 *   binds: [
 *     { key: "r", action: () => selectPreset("Last 30 min") },
 *     { key: "w", action: () => selectPreset("Last 7 days") },
 *   ],
 *   enabled: isDatePickerOpen,
 * });
 * ```
 */
export function useKeybinds(options: UseKeybindsOptions) {
  const {
    binds,
    enabled = true,
    ignoreInputs = true,
    ignoreWithModifiers = true,
  } = options;

  // Keep binds in a ref so the event handler always sees the latest list
  // without needing to re-attach the listener on every render.
  const bindsRef = useRef(binds);
  bindsRef.current = binds;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enabledRef.current) return;

      // Skip when a modifier is held (unless the bind IS a modifier, which we don't support).
      if (ignoreWithModifiers && (event.ctrlKey || event.altKey || event.metaKey)) {
        return;
      }

      // Skip when focus is inside a form control.
      if (ignoreInputs) {
        const tag = (event.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
          return;
        }
        // Also skip contenteditable elements.
        if ((event.target as HTMLElement)?.isContentEditable) {
          return;
        }
      }

      const pressed = event.key.toLowerCase();

      for (const bind of bindsRef.current) {
        if (bind.key.toLowerCase() === pressed) {
          event.preventDefault();
          bind.action();
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [ignoreInputs, ignoreWithModifiers]);
}
