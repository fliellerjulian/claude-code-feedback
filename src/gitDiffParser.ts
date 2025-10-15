import * as vscode from "vscode";

export function parseGitDiffForChangedLines(diffText: string): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  const lines = diffText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (!match) continue;

      const hunkStartLine = parseInt(match[1], 10);
      let currentLine = hunkStartLine;
      let rangeStart: number | null = null;
      let rangeEnd: number | null = null;

      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith("@@")) {
        const hunkLine = lines[j];

        if (hunkLine.startsWith("+") && !hunkLine.startsWith("+++")) {
          if (rangeStart === null) rangeStart = currentLine;
          rangeEnd = currentLine;
          currentLine++;
        } else if (hunkLine.startsWith("-")) {
          if (rangeStart !== null && rangeEnd !== null) {
            ranges.push(new vscode.Range(rangeStart - 1, 0, rangeEnd - 1, 0));
            rangeStart = null;
            rangeEnd = null;
          }
        } else {
          if (rangeStart !== null && rangeEnd !== null) {
            ranges.push(new vscode.Range(rangeStart - 1, 0, rangeEnd - 1, 0));
            rangeStart = null;
            rangeEnd = null;
          }
          currentLine++;
        }
        j++;
      }

      if (rangeStart !== null && rangeEnd !== null) {
        ranges.push(new vscode.Range(rangeStart - 1, 0, rangeEnd - 1, 0));
      }
    }
  }

  return ranges;
}

export function extractRelevantDiffHunk(
  fullDiff: string,
  startLine: number,
  endLine: number
): string {
  if (!fullDiff) return "";

  const lines = fullDiff.split("\n");
  const result: string[] = [];
  let inRelevantHunk = false;
  let currentLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (!match) continue;

      currentLine = parseInt(match[1], 10);

      let hunkEnd = currentLine;
      for (let j = i + 1; j < lines.length && !lines[j].startsWith("@@"); j++) {
        if (!lines[j].startsWith("-")) hunkEnd++;
      }

      if (
        (currentLine <= endLine && hunkEnd >= startLine) ||
        (currentLine <= startLine && hunkEnd >= startLine)
      ) {
        inRelevantHunk = true;
        result.push(line);
      } else {
        inRelevantHunk = false;
      }
    } else if (inRelevantHunk) {
      result.push(line);
      if (!line.startsWith("-")) currentLine++;
      if (currentLine > endLine + 5) break;
    }
  }

  return result.join("\n");
}
