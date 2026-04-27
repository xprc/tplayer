import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FlacFileInfo, PlaybackSnapshot } from "./vite-env";
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

function App() {
  const [song, setSong] = useState("");

  async function greet() {
    const info = await parseFlac(song);
    console.log("FLAC info:", info);
    await playFlac(song);
  }

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
      </div>
      <p>Flac support.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setSong(e.currentTarget.value)}
          placeholder="Enter a flac file url..."
        />
        <button type="submit">Play</button>
      </form>
      <p>{song}</p>
    </main>
  );
}

export default App;
