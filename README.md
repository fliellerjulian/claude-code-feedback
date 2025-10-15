
# Claude Code Diff Feedback

Send inline feedback on git diffs directly to Claude Code from VS Code/Cursor.

![G3RNu2XbEAAUYEH](https://github.com/user-attachments/assets/b59d390c-b81b-4051-8d61-0d82f1ca5dee)

## Features

- **Inline Comments on Changed Lines**: Comment threads automatically appear on git diff additions
- **Send to Claude Code**: Click "Send" to submit feedback directly to your Claude Code terminal
- **Smart Terminal Detection**: Automatically finds your Claude Code terminal or lets you choose
- **Proper File References**: Uses `@file:line` syntax for accurate code navigation
- **Contextual Diffs**: Includes only relevant diff hunks with your feedback

## Requirements

- VS Code or Cursor 1.85.0 or higher
- Git extension enabled
- Claude Code running in a terminal

## Installation

### From the marketplace

1. just download via this link: https://marketplace.visualstudio.com/items?itemName=fliellerjulian.claude-code-feedback
   
### From VSIX

1. Download the latest `.vsix` file from releases
2. Run: `code --install-extension claude-code-feedback-0.0.1.vsix`
3. Reload VS Code/Cursor

### From Source

```bash
git clone https://github.com/yourusername/claude-code-feedback
cd claude-code-feedback
npm install
npm run compile
vsce package
code --install-extension claude-code-feedback-0.0.1.vsix 
```

## Usage

1. **Make changes** to files in a git repository
2. **Comment threads** will appear on added lines (look for the `+` icon)
3. **Click the comment icon** and type your feedback
4. **Click "Send"** to submit to Claude Code
5. **Claude Code receives** your message with file context and starts working

## License

MIT

## Credits

Created for use with [Claude Code](https://claude.com/claude-code) by Anthropic.

## Support

- [Report issues](https://github.com/yourusername/claude-code-feedback/issues)
- [Request features](https://github.com/yourusername/claude-code-feedback/issues/new)
