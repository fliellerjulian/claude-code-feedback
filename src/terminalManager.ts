import * as vscode from "vscode";

export async function sendToClaudeCode(message: string): Promise<boolean> {
  const terminals = vscode.window.terminals;

  if (terminals.length === 0) {
    vscode.window.showErrorMessage("No terminals found");
    return false;
  }

  let terminal = await selectTerminal(terminals);
  if (!terminal) return false;

  terminal.sendText(message, true);
  return true;
}

async function selectTerminal(
  terminals: readonly vscode.Terminal[]
): Promise<vscode.Terminal | undefined> {
  const config = vscode.workspace.getConfiguration("claude-code-feedback");
  const pattern = config.get<string>("terminalNamePattern");

  if (pattern) {
    const match = terminals.find((t) =>
      t.name.toLowerCase().includes(pattern.toLowerCase())
    );
    if (match) return match;
  }

  const matches = terminals.filter(
    (t) =>
      t.name.toLowerCase().includes("claude") ||
      t.name.toLowerCase().includes("node")
  );

  if (matches.length === 1) return matches[0];
  if (terminals.length === 1) return terminals[0];

  const options = terminals.map((t, i) => ({
    label: t.name,
    description: `Terminal ${i + 1}`,
    terminal: t,
  }));

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: "Select which terminal is running Claude Code",
    title: "Send to Claude Code Terminal",
  });

  return selected?.terminal;
}
