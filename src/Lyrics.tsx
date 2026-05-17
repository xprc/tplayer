import { useEffect, useMemo, useRef, useState } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LyricLine } from "./vite-env";
import { parseLyrics } from "./utils";
import LyricsWord from './LyricsWord';
import "./App.css";

type LyricsState = {
  rawLyrics: string;
  currentTime: number;
  activeLineIndex: number;
};

type LyricsTime = {
  currentTime: number;
  activeLineIndex: number;
};

function Lyrics() {
  const [rawLyrics, setRawLyrics] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);

  const lyrics: LyricLine[] = useMemo(() => parseLyrics(rawLyrics), [rawLyrics]);

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    emit("lyrics:ready");
  }, []);

  const handleMouseDown = async () => {
    await getCurrentWindow().startDragging();
  };

  useEffect(() => {
    let un1: null | (() => void) = null;
    let un2: null | (() => void) = null;
    (async () => {
      un1 = await listen<LyricsState>("lyrics:state", (e) => {
        setRawLyrics(e.payload.rawLyrics ?? "");
        setCurrentTime(e.payload.currentTime ?? 0);
        setActiveLineIndex(e.payload.activeLineIndex ?? -1);
      });
      un2 = await listen<LyricsTime>("lyrics:time", (e) => {
        setCurrentTime(e.payload.currentTime ?? 0);
        setActiveLineIndex(e.payload.activeLineIndex ?? -1);
      });
    })();

    return () => {
      un1?.();
      un2?.();
    };
  }, []);

  useEffect(() => {
    if (activeLineIndex < 0) return;
    const el = lineRefs.current[activeLineIndex];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLineIndex]);

  return (
    <div className="lyrics-bar" onMouseDown={handleMouseDown}>
      <div ref={containerRef} className="lyrics-container">
        <ul className="song-lyrics-ul">
          {lyrics.map((line, index) => {
            const isActive = index === activeLineIndex;
            return (
              <li key={index} ref={(el) => {lineRefs.current[index] = el}} className={isActive ? "active" : ""}>
                <div className="lyrics-line">
                  {line.words.map((word, wIndex) => (
                    <LyricsWord key={`${index}-${wIndex}`} word={word} currentTime={currentTime} active={isActive} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default Lyrics;
