import * as vscode from "vscode";
import {
  isModifiedFile,
  addCommentThreadsToChangedLines,
  removeCommentThread,
} from "./commentThreadManager";
import {
  extractDiffContext,
  formatMessageForClaudeCode,
} from "./diffContextExtractor";
import { sendToClaudeCode } from "./terminalManager";

let controller: vscode.CommentController;

export function activate(context: vscode.ExtensionContext) {
  controller = vscode.comments.createCommentController(
    "claude-code-feedback",
    "Claude Code Feedback"
  );

  controller.options = {
    prompt: "Send feedback to Claude Code",
    placeHolder: "Describe what you want Claude to change...",
  };

  controller.commentingRangeProvider = {
    provideCommentingRanges: (document) => {
      if (!isModifiedFile(document)) return null;
      return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
    },
  };

  context.subscriptions.push(
    controller,
    vscode.commands.registerCommand(
      "claude-code-feedback.send",
      handleSendFeedback
    ),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document && isModifiedFile(editor.document)) {
        addCommentThreadsToChangedLines(controller, editor.document);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor?.document === event.document && isModifiedFile(event.document)) {
        addCommentThreadsToChangedLines(controller, event.document);
      }
    })
  );

  const editor = vscode.window.activeTextEditor;
  if (editor?.document && isModifiedFile(editor.document)) {
    addCommentThreadsToChangedLines(controller, editor.document);
  }
}

async function handleSendFeedback(reply: vscode.CommentReply) {
  const feedback = reply.text.trim();
  if (!feedback) {
    vscode.window.showWarningMessage("Please enter feedback before sending");
    return;
  }

  if (!reply.thread.range) {
    vscode.window.showErrorMessage("Could not determine comment location");
    return;
  }

  const document = await vscode.workspace.openTextDocument(reply.thread.uri);
  const context = await extractDiffContext(document, reply.thread.range);
  const message = formatMessageForClaudeCode(context, feedback);

  if (await sendToClaudeCode(message)) {
    vscode.window.showInformationMessage("Sent to Claude Code ✓");
    reply.thread.dispose();
    removeCommentThread(reply.thread);
  } else {
    vscode.window.showErrorMessage("Could not find Claude Code terminal");
  }
}

export function deactivate() {
  controller?.dispose();
}
