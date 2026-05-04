import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileMusic, FileTxtOne, Music } from "@icon-park/react";
import type { CoverImage, FlacFileInfo, PlaybackSnapshot, Word } from "./vite-env";
import '@icon-park/react/styles/index.css';
import "./App.css";

export async function parseFlac(path: string) {
  return await invoke<FlacFileInfo>("parse_flac", { path });
}

export async function playFlac(path: string) {
  await invoke("play_flac", { path });
}

export async function pausePlayback() {
  await invoke("pause_playback");
}

export async function resumePlayback() {
  await invoke("resume_playback");
}

export async function stopPlayback() {
  await invoke("stop_playback");
}

export async function setVolume(volume: number) {
  await invoke("set_volume", { volume });
}

export async function getVolume() {
  return await invoke<number>("get_volume");
}

export async function seekTo(positionMs: number) {
  await invoke("seek_to", { positionMs });
}

export async function getPlaybackSnapshot() {
  return await invoke<PlaybackSnapshot>("get_playback_snapshot");
}

export async function getFlacCover(path: string) {
  return await invoke<CoverImage | null>("get_flac_cover", { path });
}

function App() {
  const [song, setSong] = useState("");
  const [coverSrc, setCoverSrc] = useState<string>("");
  const [trackInfo, setTrackInfo] = useState<FlacFileInfo | null>(null);
  const [snap, setSnap] = useState<PlaybackSnapshot | null>(null);

  const lrcInputRef = useRef<HTMLInputElement>(null);

  async function loadMetaAndCover(path: string) {
    const info = await parseFlac(path);
    setTrackInfo(info);

    const cover = await getFlacCover(path);
    setCoverSrc(cover ? `data:${cover.mime};base64,${cover.base64}` : "");
  }

  async function togglePlayPause() {
    const s = await getPlaybackSnapshot();
    setSnap(s);

    if (!s.hasTrack) {
      if (!song) return;
      await loadMetaAndCover(song);
      await playFlac(song);
      const s2 = await getPlaybackSnapshot();
      setSnap(s2);
      return;
    }

    if (s.paused) {
      await resumePlayback();
    } else {
      await pausePlayback();
    }

    const s2 = await getPlaybackSnapshot();
    setSnap(s2);
  }

  return (
    <main className="container">
      {coverSrc && (<div className="bg-cover" style={{ backgroundImage: `url(${coverSrc})` }} />)}
      {/* <input type="file" ref={lrcInputRef} onChange={handleLrcFileUpload} accept=".lrc,.txt" className="hidden" /> */}

      <header>
        <div className="header-info">
          {coverSrc ? (
            <img src={coverSrc} alt="Cover" />
          ) : (
            <div className="no-cover">
              <Music theme="outline" size={24} />
            </div>
          )}
          <div className="song-info">
            <h1 className="song-title">{trackInfo?.title}</h1>
            <p className="song-artist">{trackInfo?.artist}</p>
            {trackInfo?.album && (<p className="song-album">{trackInfo?.album}</p>)}
          </div>
        </div>
        <div className="file-uploader">
          <button onClick={() => lrcInputRef.current?.click()} title="Upload LRC Lyrics">
            <FileTxtOne theme="outline" size={18} />
          </button>
          <button onClick={() => fileInputRef.current?.click()} title="Upload Audio">
            <FileMusic theme="outline" size={18} />
          </button>
        </div>
      </header>

      <h1>Welcome to Tauri + React</h1>
      <p>Flac support.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          togglePlayPause();
        }}
      >
        <input
          id="greet-input"
          value={song}
          onChange={(e) => setSong(e.currentTarget.value)}
          placeholder="Enter a flac file path..."
        />
        <button type="submit">
          {snap?.hasTrack ? (snap.paused ? "Resume" : "Pause") : "Play"}
        </button>
        <button
          type="button"
          onClick={async () => {
            await stopPlayback();
            setSnap(await getPlaybackSnapshot());
          }}
        >
          Stop
        </button>
      </form>

      {coverSrc ? (
        <img
          src={coverSrc}
          alt="cover"
          style={{ maxWidth: 240, borderRadius: 12, marginTop: 12 }}
        />
      ) : (
        <div style={{ marginTop: 12, opacity: 0.7 }}>No cover</div>
      )}

      <p>{song}</p>
    </main>
  );
}

export default App;
