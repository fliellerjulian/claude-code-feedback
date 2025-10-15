# Changelog

All notable changes to the "Claude Code Diff Feedback" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-10-14

### Added
- Initial release
- Inline comment threads on git diff additions
- Send feedback directly to Claude Code terminal
- Smart terminal detection with manual selection fallback
- File path tagging with `@file:line` syntax
- Contextual diff extraction for relevant code hunks
- Configuration option for terminal name pattern
- Comment threads automatically collapse after sending
- Support for VS Code and Cursor editors

### Features
- Automatic detection of changed lines from git diff
- Only shows comment threads on added lines (not context)
- Clean message format optimized for Claude Code
- Terminal detection strategies: configured pattern, common names, single terminal, user selection
- Non-intrusive: doesn't steal focus when sending feedback

## [Unreleased]

### Planned
- Extension icon
- Screenshots and demo GIF
- Support for modified lines (not just additions)
- Configuration for message format customization
