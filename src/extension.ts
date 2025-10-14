import * as vscode from "vscode";
import * as path from "path";

let commentController: vscode.CommentController;

export function activate(context: vscode.ExtensionContext) {
  // Create comment controller
  commentController = vscode.comments.createCommentController(
    "claude-code-feedback",
    "Claude Code Feedback"
  );

  context.subscriptions.push(commentController);

  // Configure comment controller
  commentController.commentingRangeProvider = {
    provideCommentingRanges: (document: vscode.TextDocument) => {
      // Allow comments on any line in git diff views
      if (isGitDiff(document)) {
        return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
      }
      return null;
    },
  };

  // Handle comment creation
  commentController.options = {
    prompt: "Send feedback to Claude Code",
    placeHolder: "Describe what you want Claude to change...",
  };

  // Listen for document changes to add comment threads
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isGitDiff(editor.document)) {
        addCommentThreadsToChangedLines(editor.document);
      }
    })
  );

  // If there's already an active editor with a diff, process it
  if (
    vscode.window.activeTextEditor &&
    isGitDiff(vscode.window.activeTextEditor.document)
  ) {
    addCommentThreadsToChangedLines(vscode.window.activeTextEditor.document);
  }
}

function isGitDiff(document: vscode.TextDocument): boolean {
  // Check if this is a git diff view
  return (
    document.uri.scheme === "git" ||
    (document.uri.scheme === "file" &&
      document.getText().includes("diff --git"))
  );
}

function addCommentThreadsToChangedLines(document: vscode.TextDocument) {
  const text = document.getText();
  const lines = text.split("\n");

  // Parse diff to find changed line ranges
  const changedRanges = parseDiffRanges(lines);

  // Add a comment thread for each changed section
  changedRanges.forEach((range) => {
    const thread = commentController.createCommentThread(
      document.uri,
      range,
      []
    );

    thread.canReply = true;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
    thread.label = "Send to Claude Code";

    // Handle when user adds a comment
    thread.comments = [
      {
        body: new vscode.MarkdownString("💬 Add feedback for this change"),
        mode: vscode.CommentMode.Preview,
        author: { name: "Claude Code" },
      } as vscode.Comment,
    ];
  });
}

function parseDiffRanges(lines: string[]): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  let currentStart = -1;
  let inDiffHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start of a diff hunk
    if (line.startsWith("@@")) {
      inDiffHunk = true;
      currentStart = i;
    }
    // End of current hunk (next hunk or end of changes)
    else if (
      inDiffHunk &&
      (line.startsWith("@@") ||
        line.startsWith("diff --git") ||
        i === lines.length - 1)
    ) {
      if (currentStart !== -1) {
        ranges.push(new vscode.Range(currentStart, 0, i - 1, 0));
      }
      currentStart = line.startsWith("@@") ? i : -1;
      inDiffHunk = line.startsWith("@@");
    }
  }

  // Handle last hunk
  if (currentStart !== -1) {
    ranges.push(new vscode.Range(currentStart, 0, lines.length - 1, 0));
  }

  return ranges;
}

// Register command to send feedback
vscode.commands.registerCommand(
  "claude-code-feedback.send",
  async (reply: vscode.CommentReply) => {
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
    const diffContext = extractDiffContext(document, reply.thread.range);

    // Format message for Claude Code
    const message = formatMessageForClaudeCode(diffContext, feedback);

    // Send to Claude Code terminal
    const success = await sendToClaudeCode(message);

    if (success) {
      vscode.window.showInformationMessage("✓ Feedback sent to Claude Code");

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
    } else {
      vscode.window.showErrorMessage(
        "Could not find active Claude Code terminal"
      );
    }
  }
);

interface DiffContext {
  filePath: string;
  startLine: number;
  endLine: number;
  diffContent: string;
}

function extractDiffContext(
  document: vscode.TextDocument,
  range: vscode.Range
): DiffContext {
  const text = document.getText(range);
  const lines = document.getText().split("\n");

  // Try to find the file path from the diff header
  let filePath = "unknown";
  for (let i = range.start.line; i >= 0; i--) {
    if (lines[i].startsWith("diff --git")) {
      const match = lines[i].match(/b\/(.+)$/);
      if (match) {
        filePath = match[1];
        break;
      }
    }
  }

  return {
    filePath,
    startLine: range.start.line,
    endLine: range.end.line,
    diffContent: text,
  };
}

function formatMessageForClaudeCode(
  context: DiffContext,
  feedback: string
): string {
  return `Please modify only this section:

File: ${context.filePath}
Lines: ${context.startLine}-${context.endLine}

Current diff:
${context.diffContent}

Requested change: ${feedback}`;
}

async function sendToClaudeCode(message: string): Promise<boolean> {
  // Find the Claude Code terminal
  const terminals = vscode.window.terminals;
  let claudeTerminal = terminals.find(
    (t) =>
      t.name.toLowerCase().includes("claude") ||
      t.name.toLowerCase().includes("claude-code")
  );

  // If not found, try to find by checking the most recent terminal
  if (!claudeTerminal && terminals.length > 0) {
    claudeTerminal = terminals[terminals.length - 1];
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
