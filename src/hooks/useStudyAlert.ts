import { useCallback, useEffect, useState } from 'react';
import { formatDateKey } from '../data/alepaSyllabus';
import { CampusLevel } from '../types';

export interface StudyAlertSettings {
  enabled: boolean;
  reminderTime: string; // HH:MM
  soundEnabled: boolean;
  lastTriggeredDateKey: string | null;
  reminderEmail: string;
  whatsappNumber: string;
}

const STORAGE_KEY = 'meu_campus_alepa_study_alert_v1';

const DEFAULT_SETTINGS: StudyAlertSettings = {
  enabled: true,
  reminderTime: '19:00',
  soundEnabled: true,
  lastTriggeredDateKey: null,
  reminderEmail: '',
  whatsappNumber: '',
};

function loadSettings(): StudyAlertSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<StudyAlertSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function playStudyChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.36);
    });
  } catch {
    // ignore Web Audio autoplay restrictions
  }
}

export function useStudyAlert(minutesToday: number, dailyGoal: number, campus: CampusLevel = 'superior') {
  const [settings, setSettings] = useState<StudyAlertSettings>(loadSettings);
  const [activeAlertMessage, setActiveAlertMessage] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const updateSettings = useCallback((patch: Partial<StudyAlertSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  }, []);

  const fireStudyAlert = useCallback(
    (customMessage?: string, isManualTest = false) => {
      const remaining = Math.max(0, dailyGoal - minutesToday);
      const campusLabel = campus === 'medio' ? 'Nível Médio · Edital 001/2026' : 'Nível Superior · Cargo 03';
      const body =
        customMessage ||
        (remaining > 0
          ? `Hora do seu ciclo diário ALEPA (${campusLabel}): faltam ${remaining} min para bater a meta de 2h hoje.`
          : 'Parabéns! Meta diária de 2h concluída hoje. Aproveite para revisar o Caderno de Erros.');

      setActiveAlertMessage(body);
      if (settings.soundEnabled) {
        playStudyChime();
      }
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Concurso ALEPA 2026 · Lembrete de Estudo', {
            body,
          });
        } catch {
          // ignore notification error in sandboxed contexts
        }
      }
      if (!isManualTest) {
        updateSettings({ lastTriggeredDateKey: formatDateKey(new Date()) });
      }
    },
    [dailyGoal, minutesToday, campus, settings.soundEnabled, updateSettings]
  );

  useEffect(() => {
    if (!settings.enabled) return;

    const checkSchedule = () => {
      const now = new Date();
      const todayKey = formatDateKey(now);
      if (settings.lastTriggeredDateKey === todayKey) return;
      if (minutesToday >= dailyGoal) return;

      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (currentHHMM >= settings.reminderTime) {
        fireStudyAlert();
      }
    };

    checkSchedule();
    const timer = window.setInterval(checkSchedule, 30000);
    return () => window.clearInterval(timer);
  }, [settings.enabled, settings.reminderTime, settings.lastTriggeredDateKey, minutesToday, dailyGoal, fireStudyAlert]);

  return {
    settings,
    updateSettings,
    activeAlertMessage,
    dismissAlert: () => setActiveAlertMessage(null),
    notificationPermission,
    requestNotificationPermission,
    fireStudyAlert,
  };
}
