/**
 * Cache de traduções IA (PRD projeto 11, §2.5 / D6).
 * Vive FORA do AppState: `localStorage["pte-plus-ai-cache"]`, versionado, LRU
 * com limites próprios — o backup do usuário nunca inflaciona por causa dele.
 */
import type { AiPhraseResult, AiWordResult } from "@/lib/plus/aiSchemas";

export const AI_CACHE_KEY = "pte-plus-ai-cache";
export const AI_CACHE_VERSION = 1;
export const AI_CACHE_LIMITS = { words: 1500, phrases: 600 } as const;

interface CacheEntry<T> {
  result: T;
  at: number;
}

export interface AiCacheState {
  version: number;
  words: Record<string, CacheEntry<AiWordResult>>;
  phrases: Record<string, CacheEntry<AiPhraseResult>>;
}

export const emptyAiCache = (): AiCacheState => ({
  version: AI_CACHE_VERSION,
  words: {},
  phrases: {},
});

/** FNV-1a 32 bits, saída hex — determinístico, testado contra vetores fixos. */
export function hashKey(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Palavra: chave = token + contexto da frase (a frase carrega o sentido). */
export const wordCacheKey = (word: string, sentence: string): string =>
  `w:${word.toLowerCase()}::${hashKey(sentence)}`;

/** Frase: chave = tipo + texto (o foco do tipo muda o resultado). */
export const phraseCacheKey = (taskType: string, sentence: string): string =>
  `p:${taskType}::${hashKey(sentence)}`;

/** Carrega o cache tolerando JSON inválido ou versão diferente (recomeço vazio). */
export function loadAiCache(storage: Pick<Storage, "getItem"> = localStorage): AiCacheState {
  try {
    const raw = storage.getItem(AI_CACHE_KEY);
    if (!raw) return emptyAiCache();
    const parsed = JSON.parse(raw) as AiCacheState;
    if (parsed?.version !== AI_CACHE_VERSION) return emptyAiCache();
    return {
      version: AI_CACHE_VERSION,
      words: typeof parsed.words === "object" && parsed.words !== null ? parsed.words : {},
      phrases: typeof parsed.phrases === "object" && parsed.phrases !== null ? parsed.phrases : {},
    };
  } catch {
    return emptyAiCache();
  }
}

/** Grava de forma tolerante: modo privado pode bloquear — falha é silenciosa. */
export function saveAiCache(
  state: AiCacheState,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(AI_CACHE_KEY, JSON.stringify(state));
  } catch {
    // cache é descartável; nada a fazer
  }
}

/** Despeja as entradas mais antigas até respeitar os limites de LRU. */
export function cachePrune(
  state: AiCacheState,
  limits: { words: number; phrases: number } = AI_CACHE_LIMITS,
): AiCacheState {
  const pruneRecord = <T>(record: Record<string, CacheEntry<T>>, limit: number) => {
    const entries = Object.entries(record);
    if (entries.length <= limit) return record;
    const ordered = entries.sort((a, b) => (a[1]?.at ?? 0) - (b[1]?.at ?? 0));
    return Object.fromEntries(ordered.slice(entries.length - limit));
  };
  return {
    version: AI_CACHE_VERSION,
    words: pruneRecord(state.words, limits.words),
    phrases: pruneRecord(state.phrases, limits.phrases),
  };
}

/** Leituras de cache: `getWord`/`getPhrase` devolvem o resultado ou null. */
export function getWord(state: AiCacheState, key: string): AiWordResult | null {
  return state.words[key]?.result ?? null;
}

export function getPhrase(state: AiCacheState, key: string): AiPhraseResult | null {
  return state.phrases[key]?.result ?? null;
}

/** Gravação (em memória) com timestamp; chame `saveAiCache` para persistir. */
export function putWord(state: AiCacheState, key: string, result: AiWordResult): AiCacheState {
  return cachePrune({ ...state, words: { ...state.words, [key]: { result, at: Date.now() } } });
}

export function putPhrase(state: AiCacheState, key: string, result: AiPhraseResult): AiCacheState {
  return cachePrune({ ...state, phrases: { ...state.phrases, [key]: { result, at: Date.now() } } });
}
