import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CoverImage, FlacFileInfo, PlaybackSnapshot } from "./vite-env";
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
  const [snap, setSnap] = useState<PlaybackSnapshot | null>(null);

  async function loadMetaAndCover(path: string) {
    const info = await parseFlac(path);
    console.log("FLAC info:", info);

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
