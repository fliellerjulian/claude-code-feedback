import * as vscode from "vscode";
import * as path from "path";
import { parseGitDiffForChangedLines } from "./gitDiffParser";

const documentThreads = new Map<string, vscode.CommentThread[]>();

/**
 * Checks if a document is a file in a git repository.
 */
export function isModifiedFile(document: vscode.TextDocument): boolean {
  if (document.uri.scheme !== "file") {
    return false;
  }

  const gitExtension = vscode.extensions.getExtension("vscode.git");
  if (!gitExtension) {
    return false;
  }

  return true;
}

/**
 * Adds comment threads to changed lines in a document.
 * Parses the git diff to find added lines and creates comment threads on them.
 */
export async function addCommentThreadsToChangedLines(
  commentController: vscode.CommentController,
  document: vscode.TextDocument
) {
  try {
    const gitExtension = vscode.extensions.getExtension("vscode.git");
    if (!gitExtension) {
      return;
    }

    const git = gitExtension.isActive
      ? gitExtension.exports
      : await gitExtension.activate();
    const api = git.getAPI(1);

    if (api.repositories.length === 0) {
      return;
    }

    const repo = api.repositories.find((r: any) =>
      document.uri.fsPath.startsWith(r.rootUri.fsPath)
    );

    if (!repo) {
      return;
    }

    const relativePath = path.relative(
      repo.rootUri.fsPath,
      document.uri.fsPath
    );

    const diff = await repo.diff(false, relativePath);

    if (!diff) {
      return;
    }

    const changedRanges = parseGitDiffForChangedLines(diff);

    const documentUri = document.uri.toString();
    const existingThreads = documentThreads.get(documentUri) || [];
    existingThreads.forEach((thread) => thread.dispose());

    const newThreads: vscode.CommentThread[] = [];

    changedRanges.forEach((range) => {
      const thread = commentController.createCommentThread(
        document.uri,
        range,
        []
      );

      thread.canReply = true;
      thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
      thread.comments = [];

      newThreads.push(thread);
    });

    documentThreads.set(documentUri, newThreads);
  } catch (error) {
    console.error("Error adding comment threads:", error);
  }
}

/**
 * Removes a comment thread from tracking.
 */
export function removeCommentThread(thread: vscode.CommentThread) {
  const documentUri = thread.uri.toString();
  const threads = documentThreads.get(documentUri);
  if (threads) {
    const index = threads.indexOf(thread);
    if (index > -1) {
      threads.splice(index, 1);
    }
  }
}
