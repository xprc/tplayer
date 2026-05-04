import React from "react";
import { Word } from "./vite-env";

interface LyricsWordProps {
  word: Word;
  currentTime: number;
  active: boolean;
}

function LyricsWord({ word, currentTime, active }: LyricsWordProps) {
  let percentage = 0, curTime = currentTime * 1000;
  const activeColor = '#24abff';
  const inactiveColor = 'rgba(255, 255, 255, 0.8)';
  const style: React.CSSProperties = {};
  if (curTime >= word.endTime) {
    percentage = 100;
  } else if (curTime <= word.startTime) {
    percentage = 0;
  } else {
    percentage = ((curTime - word.startTime) / word.duration) * 100;
  }

  if (percentage <= 0) {
    style.color = inactiveColor;
  } else if (percentage >= 100 && !active) {
    style.color = activeColor;
  } else {
    // 动态歌词效果
    style.backgroundImage = `linear-gradient(90deg, ${activeColor} ${percentage}%, ${inactiveColor} ${percentage}%)`;
    style.WebkitBackgroundClip = 'text';
    style.WebkitTextFillColor = 'transparent';
    style.backgroundClip = 'text';
    style.color = 'transparent';
  }

  return (
    <span className="lyrics-word" style={style}>{word.content}</span>
  );
};

export default React.memo(LyricsWord);
