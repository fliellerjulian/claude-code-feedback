import * as vscode from "vscode";
import * as path from "path";

let commentController: vscode.CommentController;
// Track comment threads by document URI to prevent duplicates
const documentThreads = new Map<string, vscode.CommentThread[]>();

export function activate(context: vscode.ExtensionContext) {
  // Create comment controller
  commentController = vscode.comments.createCommentController(
    "claude-code-feedback",
    "Claude Code Feedback"
  );

  context.subscriptions.push(commentController);

  // Configure comment controller with submit button
  commentController.options = {
    prompt: "Send feedback to Claude Code",
    placeHolder: "Describe what you want Claude to change...",
    // This command is triggered when the user submits a comment
    // @ts-ignore - acceptInputCommand might not be in older type definitions
    acceptInputCommand: {
      title: "Send",
      command: "claude-code-feedback.send",
    },
  };

  // Configure comment controller
  commentController.commentingRangeProvider = {
    provideCommentingRanges: (document: vscode.TextDocument) => {
      // Allow comments on any line in modified files
      if (isModifiedFile(document)) {
        return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
      }
      return null;
    },
  };

  // Register command to send feedback
  const sendCommand = vscode.commands.registerCommand(
    "claude-code-feedback.send",
    async (reply: vscode.CommentReply) => {
      await handleSendFeedback(reply);
    }
  );
  context.subscriptions.push(sendCommand);

  // Listen for document changes to add comment threads
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isModifiedFile(editor.document)) {
        addCommentThreadsToChangedLines(editor.document);
      }
    })
  );

  // Listen for text document changes to detect new modifications
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document) {
        if (isModifiedFile(event.document)) {
          addCommentThreadsToChangedLines(event.document);
        }
      }
    })
  );

  // If there's already an active editor with a modified file, process it
  if (
    vscode.window.activeTextEditor &&
    isModifiedFile(vscode.window.activeTextEditor.document)
  ) {
    addCommentThreadsToChangedLines(vscode.window.activeTextEditor.document);
  }
}

function isModifiedFile(document: vscode.TextDocument): boolean {
  // Check if this is a file that has git modifications
  // VS Code's git extension uses the 'file' scheme for working tree files
  if (document.uri.scheme !== "file") {
    return false;
  }

  // Check if file is in a git repository by checking if git extension is tracking it
  const gitExtension = vscode.extensions.getExtension("vscode.git");
  if (!gitExtension) {
    return false;
  }

  return true; // Allow comments on any file in a git repo
}

async function addCommentThreadsToChangedLines(
  document: vscode.TextDocument
) {
  try {
    // Get the git extension
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

    // Find the repository for this document
    const repo = api.repositories.find((r: any) =>
      document.uri.fsPath.startsWith(r.rootUri.fsPath)
    );

    if (!repo) {
      return;
    }

    // Get the relative path
    const relativePath = path.relative(
      repo.rootUri.fsPath,
      document.uri.fsPath
    );

    // Get the diff for this file using git diff command
    const diff = await repo.diff(false, relativePath);

    if (!diff) {
      return;
    }

    // Parse the diff to find changed line ranges in the current file
    const changedRanges = parseGitDiffForChangedLines(diff);

    // Remove old comment threads for this document
    const documentUri = document.uri.toString();
    const existingThreads = documentThreads.get(documentUri) || [];
    existingThreads.forEach((thread) => thread.dispose());

    // Create new threads for this document
    const newThreads: vscode.CommentThread[] = [];

    // Add a comment thread for each changed section
    changedRanges.forEach((range) => {
      const thread = commentController.createCommentThread(
        document.uri,
        range,
        []
      );

      thread.canReply = true; // Enable reply functionality
      thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
      thread.label = "Send to Claude Code";

      // Add a custom command button to the thread
      thread.comments = [];

      newThreads.push(thread);
    });

    // Store the new threads
    documentThreads.set(documentUri, newThreads);
  } catch (error) {
    console.error("Error adding comment threads:", error);
  }
}

function parseGitDiffForChangedLines(diffText: string): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  const lines = diffText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Parse hunk header: @@ -old_start,old_count +new_start,new_count @@
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        const newStart = parseInt(match[1], 10);

        // Find the end of this hunk
        let j = i + 1;
        let linesInHunk = 0;

        while (j < lines.length && !lines[j].startsWith("@@")) {
          const hunkLine = lines[j];
          // Count added or unchanged lines (not removed lines which start with -)
          if (!hunkLine.startsWith("-")) {
            linesInHunk++;
          }
          j++;
        }

        if (linesInHunk > 0) {
          // VS Code uses 0-based line numbers
          const startLine = newStart - 1;
          const endLine = startLine + linesInHunk - 1;
          ranges.push(new vscode.Range(startLine, 0, endLine, 0));
        }
      }
    }
  }

  return ranges;
}

async function handleSendFeedback(reply: vscode.CommentReply) {
  const feedback = reply.text.trim();
  if (!feedback) {
    vscode.window.showWarningMessage("Please enter feedback before sending");
    return;
  }

  // Check if thread has a range
  if (!reply.thread.range) {
    vscode.window.showErrorMessage("Could not determine comment location");
    return;
  }

  // Extract the diff context
  const document = await vscode.workspace.openTextDocument(reply.thread.uri);
  const diffContext = await extractDiffContext(document, reply.thread.range);

  // Format message for Claude Code
  const message = formatMessageForClaudeCode(diffContext, feedback);

  // Send to Claude Code terminal
  const success = await sendToClaudeCode(message);

  if (success) {
    vscode.window.showInformationMessage("Feedback sent to Claude Code");

    // Add the comment to the thread
    reply.thread.comments = [
      ...reply.thread.comments,
      {
        body: new vscode.MarkdownString(
          `**Sent to Claude Code:**\n\n${feedback}`
        ),
        mode: vscode.CommentMode.Preview,
        author: { name: "You" },
      } as vscode.Comment,
    ];

    // Collapse the thread after sending
    reply.thread.collapsibleState =
      vscode.CommentThreadCollapsibleState.Collapsed;
  } else {
    vscode.window.showErrorMessage(
      "Could not find active Claude Code terminal"
    );
  }
}

interface DiffContext {
  filePath: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  selectedCode: string;
  diffContent: string;
}

async function extractDiffContext(
  document: vscode.TextDocument,
  range: vscode.Range
): Promise<DiffContext> {
  const selectedCode = document.getText(range);
  const filePath = document.uri.fsPath;

  // Get git diff for this file
  let diffContent = "";
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
        diffContent = (await repo.diff(false, relativePath)) || "";
      }
    }
  } catch (error) {
    console.error("Error getting diff context:", error);
  }

  return {
    filePath,
    relativePath,
    startLine: range.start.line + 1, // Convert to 1-based
    endLine: range.end.line + 1,
    selectedCode,
    diffContent,
  };
}

function formatMessageForClaudeCode(
  context: DiffContext,
  feedback: string
): string {
  let message = `File: ${context.relativePath}\nLines: ${context.startLine}-${context.endLine}\n\n`;

  if (context.diffContent) {
    message += `Git diff:\n\`\`\`diff\n${context.diffContent}\n\`\`\`\n\n`;
  }

  message += `Selected code:\n\`\`\`\n${context.selectedCode}\n\`\`\`\n\n`;
  message += `Change request: ${feedback}`;

  return message;
}

async function sendToClaudeCode(message: string): Promise<boolean> {
  const terminals = vscode.window.terminals;

  if (terminals.length === 0) {
    vscode.window.showErrorMessage("No terminals found");
    return false;
  }

  let claudeTerminal: vscode.Terminal | undefined;

  // Strategy 1: Check for user-configured terminal name pattern
  const config = vscode.workspace.getConfiguration("claude-code-feedback");
  const terminalPattern = config.get<string>("terminalNamePattern");

  if (terminalPattern) {
    claudeTerminal = terminals.find((t) =>
      t.name.toLowerCase().includes(terminalPattern.toLowerCase())
    );
  }

  // Strategy 2: Look for common Claude Code terminal names
  if (!claudeTerminal) {
    const matchingTerminals = terminals.filter(
      (t) =>
        t.name.toLowerCase().includes("claude") ||
        t.name.toLowerCase().includes("node")
    );

    // If exactly one match, use it
    if (matchingTerminals.length === 1) {
      claudeTerminal = matchingTerminals[0];
    }
  }

  // Strategy 3: If only one terminal exists, use it
  if (!claudeTerminal && terminals.length === 1) {
    claudeTerminal = terminals[0];
  }

  // Strategy 4: Ask the user to select a terminal if we couldn't determine automatically
  if (!claudeTerminal) {
    const terminalOptions = terminals.map((t, i) => ({
      label: t.name,
      description: `Terminal ${i + 1}`,
      terminal: t,
    }));

    const selected = await vscode.window.showQuickPick(terminalOptions, {
      placeHolder: "Select which terminal is running Claude Code",
      title: "Send to Claude Code Terminal",
    });

    if (!selected) {
      return false; // User cancelled
    }

    claudeTerminal = selected.terminal;
  }

  if (!claudeTerminal) {
    return false;
  }

  // Show the terminal
  claudeTerminal.show(false); // false = don't steal focus

  // Send the message
  claudeTerminal.sendText(message, true); // true = add newline (submit)

  return true;
}

export function deactivate() {
  if (commentController) {
    commentController.dispose();
  }
}
