import { useSyncExternalStore } from "react";

export type SfxKind = "click" | "navigate" | "success" | "danger";
export type SfxSettings = { enabled: boolean; volume: number };

const STORAGE_KEY = "bt-panel-sfx";
const DEFAULT_SFX: SfxSettings = { enabled: true, volume: 0.28 };
const listeners = new Set<() => void>();
let audioContext: AudioContext | null = null;

function loadSettings(): SfxSettings {
  if (typeof window === "undefined") return DEFAULT_SFX;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      enabled: value.enabled !== false,
      volume: Math.min(1, Math.max(0, Number(value.volume) || DEFAULT_SFX.volume)),
    };
  } catch {
    return DEFAULT_SFX;
  }
}

let settings = loadSettings();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Local preferences still work for this session when storage is unavailable.
  }
}

export function setSfxEnabled(enabled: boolean) {
  settings = { ...settings, enabled };
  persist();
  emit();
  if (enabled) playSfx("success", true);
}

export function setSfxVolume(volume: number) {
  settings = { ...settings, volume: Math.min(1, Math.max(0, volume)) };
  persist();
  emit();
}

export function playSfx(kind: SfxKind = "click", force = false) {
  if (typeof window === "undefined" || (!settings.enabled && !force) || settings.volume <= 0) return;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  try {
    audioContext ??= new AudioContextClass();
    if (audioContext.state === "suspended") void audioContext.resume();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const presets: Record<SfxKind, [number, number, OscillatorType]> = {
      click: [420, 0.045, "sine"],
      navigate: [560, 0.065, "sine"],
      success: [720, 0.11, "triangle"],
      danger: [190, 0.09, "sawtooth"],
    };
    const [frequency, duration, type] = presets[kind];
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (kind === "success") oscillator.frequency.exponentialRampToValueAtTime(960, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, settings.volume * 0.11), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  } catch {
    // Audio feedback is optional and should never interrupt the interface.
  }
}

export function useSfxSettings() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => settings,
    () => DEFAULT_SFX,
  );
}
