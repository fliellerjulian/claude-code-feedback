import * as vscode from "vscode";
import * as path from "path";
import { parseGitDiffForChangedLines } from "./gitDiffParser";

const threadsByDocument = new Map<string, vscode.CommentThread[]>();

export function isModifiedFile(document: vscode.TextDocument): boolean {
  if (document.uri.scheme !== "file") return false;

  const gitExtension = vscode.extensions.getExtension("vscode.git");
  return !!gitExtension;
}

export async function addCommentThreadsToChangedLines(
  controller: vscode.CommentController,
  document: vscode.TextDocument
) {
  try {
    const gitExtension = vscode.extensions.getExtension("vscode.git");
    if (!gitExtension) return;

    const git = gitExtension.isActive
      ? gitExtension.exports
      : await gitExtension.activate();
    const api = git.getAPI(1);

    if (api.repositories.length === 0) return;

    const repo = api.repositories.find((r: any) =>
      document.uri.fsPath.startsWith(r.rootUri.fsPath)
    );
    if (!repo) return;

    const relativePath = path.relative(
      repo.rootUri.fsPath,
      document.uri.fsPath
    );

    const diff = await repo.diff(false, relativePath);
    if (!diff) return;

    const ranges = parseGitDiffForChangedLines(diff);
    const docUri = document.uri.toString();

    const existing = threadsByDocument.get(docUri) || [];
    existing.forEach((t) => t.dispose());

    const threads = ranges.map((range) => {
      const thread = controller.createCommentThread(document.uri, range, []);
      thread.canReply = true;
      thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
      return thread;
    });

    threadsByDocument.set(docUri, threads);
  } catch (error) {
    console.error("Error adding comment threads:", error);
  }
}

export function removeCommentThread(thread: vscode.CommentThread) {
  const docUri = thread.uri.toString();
  const threads = threadsByDocument.get(docUri);
  if (!threads) return;

  const index = threads.indexOf(thread);
  if (index > -1) threads.splice(index, 1);
}
