# Un-definer

Primitive Chrome/Chromium extension for Codeforces pages.

It adds a red minus button near every `#define` found inside a code block. Clicking the button turns it into a green plus, hides that macro definition line, and rewrites matching macro usages in the shown code. Clicking again restores the original code.

## Install locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project folder.

## Current limits

- Object-like macros such as `#define int long long` are handled by token replacement.
- Simple function-like macros such as `#define sq(x) ((x)*(x))` are handled for balanced calls.
- Complex C/C++ preprocessor behavior is not fully reversible: comments, strings, `##`, `#`, conditional compilation, recursive macros, multiline macros, include order, redefinitions, compiler extensions, and macro expansion precedence can require a real preprocessor plus source mapping.
