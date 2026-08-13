# Codeforces Un-definer

Primitive Chrome/Chromium extension for supported competitive programming pages.

It adds a red minus button near every supported `#define` and an orange minus button near every simple `typedef` found inside a code block. Clicking a button turns it into a plus, strikes through the declaration line, and rewrites matching usages in the shown code.

Version 0.1.9 adds best-effort support for multiline macro definitions and variadic macros using `__VA_ARGS__`.

Version 0.2.0 adds a popup menu for enabling/disabling supported sites. All sites are enabled by default.

Version 0.2.1 removes trap.jp and improves color preservation for Ace, Prism, and SHJS code viewers.

Version 0.2.2 keeps Ace editors in place on AtCoder and CodeChef to avoid layout/scroll instability.

Version 0.2.3 attaches buttons to the Ace gutter and supports CodeChef grouped Ace lines.

Version 0.2.4 keeps Ace buttons in a separate overlay so AtCoder and CodeChef redraws do not reorder or remove them.

Version 0.2.5 anchors Ace buttons by source line number and refreshes changed Ace lines after editor redraws.

Version 0.2.6 reads full AtCoder copy-source for Ace editors and keeps disabled Ace lines fully colored.

Version 0.2.7 refreshes Ace lines after scroll/redraw so offscreen defines get crossed out when they become visible.

Version 0.2.8 adds support for simple `using` aliases and template aliases such as `template<class T> using vc = vector<T>;`.

Version 0.2.9 accepts trailing `//` comments after `using` and `typedef` aliases.

Version 0.3.0 expands active aliases inside other alias declarations and ignores compiler/custom-test pages.

Version 0.3.1 ignores submit pages on Codeforces, QOJ, OJUZ, and CodeChef, and only runs on AtCoder submission URLs.

Supported sites:
- Codeforces
- AtCoder
- QOJ
- OJUZ
- CodeChef
