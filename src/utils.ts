import { LyricLine, Word } from "./vite-env";

/**
 * 将mm:ss.xxx转换为ms
 * © 2026 TomsProject Inc.
 * 
 * @param {string} timeStr - mm:ss.xxx格式的时间
 * @returns {number} - 时间(单位ms)
 */
export const timeToMs = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [minStr, secStr] = timeStr.split(':');
    const min = parseInt(minStr, 10);
    const sec = parseFloat(secStr);
    return Math.round((min * 60 + sec) * 1000);
};

/**
 * lrc歌词解析函数
 * 支持增强lrc格式([mm:ss]<mm:ss>Word)
 * © 2026 TomsProject Inc.
 * 
 * @param {string} raw - 原始lrc文件
 * @returns {LyricLine[]} - 歌词数据结构
 */
export const parseLyrics = (raw: string): LyricLine[] => {
    const lines = raw.trim().split("\n");
    if (lines.length === 0) return [];
    const parsedLines: LyricLine[] = [];

    // 匹配行首时间戳：[mm:ss.SS]正文
    const lineStartRegex = /^\[(\d{2}:\d{2}\.\d{2,3})\](.*)/;
    // 按单词时间戳切分：<mm:ss.SS>
    const tagSplitRegex = /<(\d{2}:\d{2}\.\d{2,3})>/;

    for (const line of lines) {
        const headerMatch = line.match(lineStartRegex);
        if (!headerMatch) continue;

        const lineStartTime = timeToMs(headerMatch[1]);
        const contentPart = headerMatch[2];
        const parts = contentPart.split(tagSplitRegex);
        const words: Word[] = [];

        for (let i = 1; i < parts.length; i += 2) {
            const currentTimeStr = parts[i];
            const content = parts[i + 1] || "";
            if (!currentTimeStr) continue;

            const startTime = timeToMs(currentTimeStr);
            let endTime = startTime;
            let duration = 0;
            // 下一个时间戳在 i + 2
            if (i + 2 < parts.length) {
                const nextTimeStr = parts[i + 2];
                const nextTime = timeToMs(nextTimeStr);
                endTime = nextTime;
                duration = nextTime - startTime;
            }
            // 只有有内容时才算一个词
            if (content.length > 0) {
                words.push({
                    content: content,
                    startTime: startTime,
                    duration: duration,
                    endTime: endTime
                });
            }
        }

        if (words.length > 0) {
            const lastWord = words[words.length - 1];
            const lineEndTime = lastWord.endTime;
            parsedLines.push({
                startTime: lineStartTime,
                duration: lineEndTime - lineStartTime,
                endTime: lineEndTime,
                content: words.map(w => w.content).join(''),
                words: words
            });
        }
    }

    return parsedLines.sort((a, b) => a.startTime - b.startTime);
};