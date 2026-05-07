export function parseSrtTime(t: string): number {
  const cleaned = t.replace(",", ".");
  const parts = cleaned.split(":");
  if (parts.length < 3) return 0;
  const [h, m, rest] = parts;
  const [s, ms = "0"] = rest.split(".");
  return (
    (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000 +
    parseInt(ms.padEnd(3, "0").slice(0, 3))
  );
}

export function parseSrt(content: string): { start: number; end: number; text: string }[] {
  const cues: { start: number; end: number; text: string }[] = [];
  const blocks = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const timingIdx = lines.findIndex((l) => l.includes("-->"));
    if (timingIdx < 0) continue;
    const match = lines[timingIdx].match(
      /(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/
    );
    if (!match) continue;
    const start = parseSrtTime(match[1]);
    const end = parseSrtTime(match[2]);
    const text = lines
      .slice(timingIdx + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}
