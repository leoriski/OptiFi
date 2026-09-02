import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const PREF_KEY = 'optifi.lock.enabled';
/** Voltar à app passados poucos segundos não devia pedir a cara outra vez. */
const GRACE_MS = 30_000;

export interface LockState {
  /** O aparelho tem leitor E tem biometria registada. Sem isto não há nada a oferecer. */
  available: boolean;
  enabled: boolean;
  locked: boolean;
  unlock: () => Promise<boolean>;
  setEnabled: (on: boolean) => Promise<void>;
}

export function useAppLock(hasSession: boolean): LockState {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [hardware, enrolled, pref] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        AsyncStorage.getItem(PREF_KEY),
      ]);
      const ok = hardware && enrolled;
      const on = ok && pref === '1';
      setAvailable(ok);
      setEnabledState(on);
      // Se o bloqueio está ligado, a app abre trancada — nunca ao contrário.
      setLocked(on);
      setReady(true);
    })();
  }, []);

  const unlock = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear a OptiFi',
      cancelLabel: 'Cancelar',
      // Deixar cair no código do telemóvel: quem não tem a cara reconhecida
      // (óculos de sol, escuro) fica de fora da própria app.
      disableDeviceFallback: false,
    });
    if (res.success) setLocked(false);
    return res.success;
  }, []);

  const setEnabled = useCallback(
    async (on: boolean) => {
      // Ligar exige provar a biometria já: senão bastava alguém com o telemóvel
      // aberto activá-la e ficava com a app trancada sem ninguém saber abri-la.
      if (on) {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirmar para ligar o bloqueio',
        });
        if (!res.success) return;
      }
      await AsyncStorage.setItem(PREF_KEY, on ? '1' : '0');
      setEnabledState(on);
    },
    [],
  );

  // Voltar a trancar ao sair da app — é o único momento em que faz sentido.
  useEffect(() => {
    if (!enabled || !hasSession) return;
    let leftAt = 0;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt = Date.now();
      else if (state === 'active' && leftAt && Date.now() - leftAt > GRACE_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled, hasSession]);

  return { available, enabled, locked: ready && enabled && locked && hasSession, unlock, setEnabled };
}

/**
 * O bloqueio tem de ser um só para a app toda. Enquanto isto era um hook
 * chamado no _layout, o ecrã de Perfil que quisesse o interruptor chamava-o
 * outra vez e ficava com um estado paralelo: o interruptor mudava, mas o ecrã
 * que tranca a app nunca dava por isso. Daí o contexto.
 */
const LockCtx = createContext<LockState | null>(null);

export function LockProvider({ hasSession, children }: { hasSession: boolean; children: ReactNode }) {
  const value = useAppLock(hasSession);
  return <LockCtx.Provider value={value}>{children}</LockCtx.Provider>;
}

export function useLock(): LockState {
  const ctx = useContext(LockCtx);
  if (!ctx) throw new Error('useLock tem de estar dentro do LockProvider');
  return ctx;
}
