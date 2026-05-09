import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Back, FileMusic, FileTxtOne, Music, Next, Pause, Play, VolumeMute, VolumeNotice } from "@icon-park/react";
import type { CoverImage, FlacFileInfo, LyricLine, PlaybackSnapshot, Word } from "./vite-env";
import LyricsWord from "./LyricsWord";
import { formatTime, parseLyrics } from "./utils";
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

export async function readLyricsFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    title: "Please open an Lyrics file,,,",
    filters: [
      { name: "Lyrics", extensions: ["lrc", "txt"] },
      { name: "All", extensions: ["*"] }
    ]
  });
  if(!selected) return null;

  const realPath = 
    typeof selected === "string" && selected.startsWith("file://")
    ? new URL(selected) : selected;
  const content = await readTextFile(realPath);
  return content;
}

export async function readAudioFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    title: "Please open an Audio file.,",
    filters: [
      { name: "Audio", extensions: ["flac", "mp3", "m4a"] },
      { name: "All", extensions: ["*"] }
    ]
  });
  if(!selected) return null;
  return selected;
}

function App() {
  const [song, setSong] = useState("");
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [coverSrc, setCoverSrc] = useState<string>("");
  const [trackInfo, setTrackInfo] = useState<FlacFileInfo | null>(null);
  const [snap, setSnap] = useState<PlaybackSnapshot | null>(null);
  const [rawLyrics, setRawLyrics] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const lyrics: LyricLine[] = useMemo(() => parseLyrics(rawLyrics), [rawLyrics]);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLLIElement | null)[]>([]);
  const userScrollTimeoutRef = useRef<number>(0);

  async function loadMetaAndCover(path: string) {
    const info = await parseFlac(path);
    setTrackInfo(info);
    const cover = await getFlacCover(path);
    setCoverSrc(cover ? `data:${cover.mime};base64,${cover.base64}` : "");
  }

  const uploadLyrics = async () => {
    const lyrics = await readLyricsFile();
    if (!lyrics) return;
    setRawLyrics(lyrics);
  };

  const uploadAudio = async () => {
    const path = await readAudioFile();
    if (!path) return;
    const s = await getPlaybackSnapshot();
    if (s.hasTrack) await stopPlayback();
    setSong(path);
    loadMetaAndCover(path);
  };

  // --- Auto Scrolling ---
  useEffect(() => {
    if (isUserScrolling) return;

    if (activeLineIndex >= 0 && lineRefs.current[activeLineIndex] && containerRef.current) {
      const lineEl = lineRefs.current[activeLineIndex];
      lineEl?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    } else if (activeLineIndex === -1 && containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeLineIndex, isUserScrolling]);

  // Listen to wheel/touch events on the container
  const handleUserInteraction = () => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = window.setTimeout(() => {
      setIsUserScrolling(false);
    }, 2000);
  };

  // Click on a lyric line to jump to that time
  const handleLineClick = (startTime: number) => {
    // Jump slightly before the line starts (e.g. 100ms) to ensure the first word isn't cut off visually
    const seekTime = Math.max(0, startTime);
    setCurrentTime(seekTime);
    
    // if (audioSrc && audioRef.current) {
    //     audioRef.current.currentTime = seekTime / 1000;
    // }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    
    // if (audioSrc && audioRef.current) {
    //     audioRef.current.currentTime = newTime / 1000;
    // }
  };

  const skipTime = (ms: number) => {
    let newTime = currentTime + ms;
    newTime = Math.max(0, Math.min(newTime, audioDuration));
      
    setCurrentTime(newTime);
    // if (audioSrc && audioRef.current) {
    //   audioRef.current.currentTime = newTime / 1000;
    // }
  };

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
          <button onClick={() => uploadLyrics()} title="Upload LRC Lyrics">
            <FileTxtOne theme="outline" size={18} />
          </button>
          <button onClick={() => uploadAudio()} title="Upload Audio">
            <FileMusic theme="outline" size={18} />
          </button>
        </div>
      </header>

      <div className="lyrics-panel">
        <div>
          <div ref={containerRef} className="lyrics-container" onWheel={handleUserInteraction} onTouchStart={handleUserInteraction}>
            <div>
              {lyrics.length === 0 ? (
                <div className="no-lyrics">
                  <Music size={48} className="opacity-50" />
                  <p>No lyrics loaded.</p>
                  <button onClick={() => uploadAudio()}>Upload a song to start</button>
                </div>
              ) : (
                <ul className="song-lyrics-ul">
                  {lyrics.map((line, index) => {
                    const isActive = index === activeLineIndex;
                    return (
                      <li key={index} ref={el => {lineRefs.current[index] = el}} onClick={() => handleLineClick(line.startTime)} className={`${isActive ? 'active' : ''}`}>
                        <div className="lyrics-line">
                          {line.words.map((word, wIndex) => (
                            <LyricsWord key={`${index}-${wIndex}`} word={word} currentTime={currentTime} active={isActive} />
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer>
        <div>
          <div className="timebar">
            <span className="left-time">{formatTime(currentTime)}</span>
            <div className="timebar-div">
              <div className="progress-div">
                <div style={{ width: `${Math.min(100, (currentTime / audioDuration) * 100)}%` }}></div>
              </div>
              <input type="range" min="0" max={audioDuration} value={currentTime} onChange={handleSeek} />
              <div className="progress-ball" style={{ left: `${Math.min(100, (currentTime / audioDuration) * 100)}%` }}></div>
            </div>
            <span className="right-time">{formatTime(audioDuration)}</span>
          </div>
          <div className="player-controls">
            <div className="controls-padding"></div>
            <div className="controls-buttons">
              <button className="back-button" onClick={() => skipTime(-5000)} title="Back 5s"><Back size={24} /></button>
              <button onClick={togglePlayPause} className="start-button">
                {isPlaying ? <Pause fill="white" size={28} /> : <Play fill="white" className="ml-1" size={28} />}
              </button>
              <button className="forward-button" onClick={() => skipTime(5000)} title="Forward 5s"><Next size={24} /></button>
            </div>
            <div className="volume-div">
              <button onClick={() => setIsMuted(!isMuted)} title={isMuted ? "Unmute" : "Mute"}>
                {isMuted || volume === 0 ? <VolumeMute size={20} /> : <VolumeNotice size={20} />}
              </button>
              <div>
                <div className="volume-bar">
                    <div style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}></div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    if (isMuted) setIsMuted(false);
                  }}
                  className="volume-input"
                />
                <div className="volume-ball" style={{ left: `${(isMuted ? 0 : volume) * 100}%`, transform: 'translateX(-50%)' }}></div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default App;
