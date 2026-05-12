/// <reference types="vite/client" />

export type FlacFileInfo = {
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  genre: string | null;
  durationSecs: number;
  sampleRate: number | null;
  bitDepth: number | null;
  channels: number | null;
  overallBitrateKbps: number | null;
  audioBitrateKbps: number | null;
  pictureCount: number;
  codec: string;
  symphoniaSampleRate: number | null;
  symphoniaChannels: number | null;
};

export type PlaybackSnapshot = {
  trackPath: string | null;
  positionMs: number;
  durationMs: number | null;
  volume: number;
  paused: boolean;
  ended: boolean;
  hasTrack: boolean;
  serverTsMs: number;
};

export type CoverImage = {
  mime: string;
  base64: string;
};

export type Word = {
  content: string;
  startTime: number;
  duration: number;
  endTime: number;
};

export type LyricLine = {
  startTime: number;
  duration: number;
  endTime: number;
  content: string;
  words: Word[];
};
