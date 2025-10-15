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

let commentController: vscode.CommentController;

export function activate(context: vscode.ExtensionContext) {
  commentController = vscode.comments.createCommentController(
    "claude-code-feedback",
    "Claude Code Feedback"
  );

  context.subscriptions.push(commentController);

  commentController.options = {
    prompt: "Send feedback to Claude Code",
    placeHolder: "Describe what you want Claude to change...",
  };

  commentController.commentingRangeProvider = {
    provideCommentingRanges: (document: vscode.TextDocument) => {
      if (isModifiedFile(document)) {
        return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
      }
      return null;
    },
  };

  const sendCommand = vscode.commands.registerCommand(
    "claude-code-feedback.send",
    async (reply: vscode.CommentReply) => {
      await handleSendFeedback(reply);
    }
  );
  context.subscriptions.push(sendCommand);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isModifiedFile(editor.document)) {
        addCommentThreadsToChangedLines(commentController, editor.document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document) {
        if (isModifiedFile(event.document)) {
          addCommentThreadsToChangedLines(commentController, event.document);
        }
      }
    })
  );

  if (
    vscode.window.activeTextEditor &&
    isModifiedFile(vscode.window.activeTextEditor.document)
  ) {
    addCommentThreadsToChangedLines(
      commentController,
      vscode.window.activeTextEditor.document
    );
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
  const diffContext = await extractDiffContext(document, reply.thread.range);
  const message = formatMessageForClaudeCode(diffContext, feedback);
  const success = await sendToClaudeCode(message);

  if (success) {
    vscode.window.showInformationMessage("Sent to Claude Code ✓");
    reply.thread.dispose();
    removeCommentThread(reply.thread);
  } else {
    vscode.window.showErrorMessage(
      "Could not find active Claude Code terminal"
    );
  }
}

export function deactivate() {
  if (commentController) {
    commentController.dispose();
  }
}
