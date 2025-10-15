import * as vscode from "vscode";
import * as path from "path";
import { DiffContext } from "./types";
import { extractRelevantDiffHunk } from "./gitDiffParser";

export async function extractDiffContext(
  document: vscode.TextDocument,
  range: vscode.Range
): Promise<DiffContext> {
  const selectedCode = document.getText(range);
  const filePath = document.uri.fsPath;
  let fullDiff = "";
  let relativePath = filePath;

  try {
    const gitExtension = vscode.extensions.getExtension("vscode.git");
    if (gitExtension) {
      const git = gitExtension.isActive
        ? gitExtension.exports
        : await gitExtension.activate();
      const api = git.getAPI(1);

      const repo = api.repositories.find((r: any) =>
        filePath.startsWith(r.rootUri.fsPath)
      );

      if (repo) {
        relativePath = path.relative(repo.rootUri.fsPath, filePath);
        fullDiff = (await repo.diff(false, relativePath)) || "";
      }
    }
  } catch (error) {
    console.error("Error getting diff context:", error);
  }

  const relevantDiffHunk = extractRelevantDiffHunk(
    fullDiff,
    range.start.line + 1,
    range.end.line + 1
  );

  return {
    filePath,
    relativePath,
    startLine: range.start.line + 1,
    endLine: range.end.line + 1,
    selectedCode,
    relevantDiffHunk,
  };
}

export function formatMessageForClaudeCode(
  context: DiffContext,
  feedback: string
): string {
  const fileRef = `${context.relativePath}:${context.startLine}${
    context.endLine !== context.startLine ? `-${context.endLine}` : ""
  }`;

  let message = `@${fileRef}\n\nChange request: ${feedback}`;

  if (context.relevantDiffHunk) {
    message += `\n\n\`\`\`diff\n${context.relevantDiffHunk}\n\`\`\``;
  }

  return message;
}
