import * as vscode from "vscode";

/**
 * Sends a message to the Claude Code terminal.
 * Uses multiple strategies to detect the correct terminal:
 * 1. User-configured terminal name pattern
 * 2. Common Claude Code terminal names (claude, node)
 * 3. Single terminal if only one exists
 * 4. User selection via quick pick
 */
export async function sendToClaudeCode(message: string): Promise<boolean> {
  const terminals = vscode.window.terminals;

  if (terminals.length === 0) {
    vscode.window.showErrorMessage("No terminals found");
    return false;
  }

  let claudeTerminal: vscode.Terminal | undefined;

  const config = vscode.workspace.getConfiguration("claude-code-feedback");
  const terminalPattern = config.get<string>("terminalNamePattern");

  if (terminalPattern) {
    claudeTerminal = terminals.find((t) =>
      t.name.toLowerCase().includes(terminalPattern.toLowerCase())
    );
  }

  if (!claudeTerminal) {
    const matchingTerminals = terminals.filter(
      (t) =>
        t.name.toLowerCase().includes("claude") ||
        t.name.toLowerCase().includes("node")
    );

    if (matchingTerminals.length === 1) {
      claudeTerminal = matchingTerminals[0];
    }
  }

  if (!claudeTerminal && terminals.length === 1) {
    claudeTerminal = terminals[0];
  }

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
      return false;
    }

    claudeTerminal = selected.terminal;
  }

  if (!claudeTerminal) {
    return false;
  }

  claudeTerminal.sendText(message, true);

  return true;
}
