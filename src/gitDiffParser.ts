import * as vscode from "vscode";

/**
 * Parses git diff output to find line ranges that were added.
 * Only returns ranges for added lines (lines starting with +), not context lines.
 */
export function parseGitDiffForChangedLines(diffText: string): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  const lines = diffText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        const hunkStartLine = parseInt(match[1], 10);
        let currentLineNumber = hunkStartLine;
        let addedRangeStart: number | null = null;
        let addedRangeEnd: number | null = null;

        let j = i + 1;
        while (j < lines.length && !lines[j].startsWith("@@")) {
          const hunkLine = lines[j];

          if (hunkLine.startsWith("+") && !hunkLine.startsWith("+++")) {
            if (addedRangeStart === null) {
              addedRangeStart = currentLineNumber;
            }
            addedRangeEnd = currentLineNumber;
            currentLineNumber++;
          } else if (hunkLine.startsWith("-")) {
            if (addedRangeStart !== null && addedRangeEnd !== null) {
              ranges.push(
                new vscode.Range(addedRangeStart - 1, 0, addedRangeEnd - 1, 0)
              );
              addedRangeStart = null;
              addedRangeEnd = null;
            }
          } else {
            if (addedRangeStart !== null && addedRangeEnd !== null) {
              ranges.push(
                new vscode.Range(addedRangeStart - 1, 0, addedRangeEnd - 1, 0)
              );
              addedRangeStart = null;
              addedRangeEnd = null;
            }
            currentLineNumber++;
          }

          j++;
        }

        if (addedRangeStart !== null && addedRangeEnd !== null) {
          ranges.push(
            new vscode.Range(addedRangeStart - 1, 0, addedRangeEnd - 1, 0)
          );
        }
      }
    }
  }

  return ranges;
}

/**
 * Extracts only the relevant diff hunk that overlaps with the specified line range.
 */
export function extractRelevantDiffHunk(
  fullDiff: string,
  startLine: number,
  endLine: number
): string {
  if (!fullDiff) return "";

  const lines = fullDiff.split("\n");
  let result: string[] = [];
  let inRelevantHunk = false;
  let currentNewLineNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        currentNewLineNumber = parseInt(match[1], 10);

        let hunkEndLine = currentNewLineNumber;
        for (
          let j = i + 1;
          j < lines.length && !lines[j].startsWith("@@");
          j++
        ) {
          if (!lines[j].startsWith("-")) {
            hunkEndLine++;
          }
        }

        if (
          (currentNewLineNumber <= endLine && hunkEndLine >= startLine) ||
          (currentNewLineNumber <= startLine && hunkEndLine >= startLine)
        ) {
          inRelevantHunk = true;
          result.push(line);
        } else {
          inRelevantHunk = false;
        }
      }
    } else if (inRelevantHunk) {
      result.push(line);

      if (!line.startsWith("-")) {
        currentNewLineNumber++;
      }

      if (currentNewLineNumber > endLine + 5) {
        break;
      }
    }
  }

  return result.length > 0 ? result.join("\n") : "";
}
