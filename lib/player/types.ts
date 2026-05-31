export type PlayerMeta = {
  title: string;
  subtitle?: string;
  artwork?: string;
};

export type PlayerErrorKind = "offline" | "error";

export type PlayerHandlers = {
  onPlaying?: () => void;
  onError?: (kind: PlayerErrorKind) => void;
  onRemoteNext?: () => void;
  onRemotePrev?: () => void;
  onRemotePlay?: () => void;
  onRemotePause?: () => void;
};

export interface RadioPlayer {
  warmUp(url: string, meta: PlayerMeta): Promise<void>;
  play(url: string, meta: PlayerMeta): Promise<void>;
  stop(): void;
  setVolume(v: number): void;
  on(handlers: PlayerHandlers): () => void;
  dispose(): void;
}
