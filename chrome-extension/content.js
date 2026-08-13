(() => {
  if (document.documentElement.dataset.undefinerLoaded === "true") return;
  document.documentElement.dataset.undefinerLoaded = "true";

  const PROCESSED = "undefinerProcessed";
  const DEFINE_RE = /^(\s*)#\s*define\s+([A-Za-z_]\w*)(?:\(([^)]*)\))?(?:\s+(.*))?$/;
  const TYPEDEF_RE = /^\s*typedef\s+(.+?)\s+([A-Za-z_]\w*)\s*;\s*(?:\/\/.*)?$/;
  const USING_RE = /^\s*(?:template\s*<(.+)>\s*)?using\s+([A-Za-z_]\w*)\s*=\s*(.+?)\s*;\s*(?:\/\/.*)?$/;
  const TEMPLATE_ONLY_RE = /^\s*template\s*<(.+)>\s*$/;
  const CODE_SELECTORS = [
    "pre",
    "#program-source-text",
    ".program-source",
    ".source-code",
    "code",
    ".ace_editor"
  ].join(",");
  const SITE_DEFAULTS = {
    atcoder: true,
    codechef: true,
    codeforces: true,
    ojuz: true,
    qoj: true
  };

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const KEYWORDS = new Set([
    "alignas", "alignof", "and", "asm", "auto", "bitand", "bitor", "bool", "break",
    "case", "catch", "char", "class", "compl", "const", "constexpr", "continue",
    "decltype", "default", "delete", "do", "double", "else", "enum", "explicit",
    "extern", "false", "float", "for", "friend", "goto", "if", "inline", "int",
    "long", "mutable", "namespace", "new", "noexcept", "not", "nullptr", "operator",
    "or", "private", "protected", "public", "register", "return", "short", "signed",
    "sizeof", "static", "struct", "switch", "template", "this", "throw", "true",
    "try", "typedef", "typename", "union", "unsigned", "using", "virtual", "void",
    "volatile", "while", "xor"
  ]);
  const TYPES = new Set([
    "int64_t", "int32_t", "uint64_t", "uint32_t", "size_t", "string", "vector",
    "pair", "map", "set", "multiset", "unordered_map", "unordered_set", "queue",
    "deque", "stack", "priority_queue", "bitset"
  ]);

  function appendSpan(fragment, className, text) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    fragment.appendChild(span);
  }

  function tokenClass(profile, kind, value = "") {
    const classes = {
      ace: {
        com: "ace_comment",
        kwd: "ace_keyword",
        lit: "ace_constant ace_numeric",
        pln: /^[A-Za-z_]\w*$/.test(value) ? "ace_identifier" : "",
        pun: "ace_punctuation ace_operator",
        str: "ace_string",
        typ: "ace_storage ace_type"
      },
      prism: {
        com: "token comment",
        kwd: "token keyword",
        lit: "token number",
        pln: "",
        pun: "token punctuation",
        str: "token string",
        typ: "token keyword"
      },
      sh: {
        com: "sh_comment",
        kwd: "sh_keyword",
        lit: "sh_number",
        pln: "",
        pun: "sh_symbol",
        str: "sh_string",
        typ: "sh_type"
      },
      prettify: {
        com: "com",
        kwd: "kwd",
        lit: "lit",
        pln: "pln",
        pun: "pun",
        str: "str",
        typ: "typ"
      }
    };

    return (classes[profile] || classes.prettify)[kind] || "";
  }

  function detectHighlightProfile(node) {
    if (node.closest?.(".ace_editor") || node.querySelector?.(".ace_line")) return "ace";
    if (node.closest?.(".ojuz-prism-code") || node.querySelector?.(".token")) return "prism";
    if (node.closest?.(".sh_sourceCode, .sh_cpp") || node.querySelector?.("[class^='sh_'], [class*=' sh_']")) return "sh";
    return "prettify";
  }

  function currentSiteKey() {
    const host = location.hostname.replace(/^www\./, "");
    if (host === "codeforces.com" || host.endsWith(".codeforces.com")) return "codeforces";
    if (host === "codeforces.ru" || host.endsWith(".codeforces.ru")) return "codeforces";
    if (host === "atcoder.jp" || host.endsWith(".atcoder.jp")) return "atcoder";
    if (host === "qoj.ac" || host.endsWith(".qoj.ac")) return "qoj";
    if (host === "oj.uz" || host.endsWith(".oj.uz")) return "ojuz";
    if (host === "codechef.com" || host.endsWith(".codechef.com")) return "codechef";
    return null;
  }

  function isIgnoredPage() {
    const siteKey = currentSiteKey();
    const path = location.pathname;
    const hasSubmitSegment = /(?:^|\/)submit(?:\/|$)/.test(path);

    if (siteKey === "atcoder") {
      return !/\/submissions\/\d+\/?$/.test(path);
    }

    if (siteKey === "codeforces" && (/\/customtest\/?$/.test(path) || hasSubmitSegment)) return true;
    if ((siteKey === "ojuz" || siteKey === "qoj") && hasSubmitSegment) return true;
    if (siteKey === "codechef") {
      if (/^\/ide\/?$/.test(path)) return true;
      if (/^\/[a-z0-9]+-online-compiler\/?$/i.test(path)) return true;
      if (hasSubmitSegment) return true;
    }

    return false;
  }

  function isCurrentSiteEnabled(callback) {
    const siteKey = currentSiteKey();
    if (!siteKey || isIgnoredPage()) {
      callback(false);
      return;
    }

    chrome.storage.local.get({ enabledSites: SITE_DEFAULTS }, ({ enabledSites }) => {
      callback(({ ...SITE_DEFAULTS, ...enabledSites })[siteKey] !== false);
    });
  }

  function highlightCodeLine(line, profile = "prettify") {
    const fragment = document.createDocumentFragment();
    let index = 0;

    while (index < line.length) {
      const rest = line.slice(index);

      const comment = rest.match(/^\/\/.*/);
      if (comment) {
        appendSpan(fragment, tokenClass(profile, "com"), comment[0]);
        break;
      }

      const stringLiteral = rest.match(/^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
      if (stringLiteral) {
        appendSpan(fragment, tokenClass(profile, "str"), stringLiteral[0]);
        index += stringLiteral[0].length;
        continue;
      }

      const number = rest.match(/^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?)(?:[uUlLfF]*)/);
      if (number) {
        appendSpan(fragment, tokenClass(profile, "lit"), number[0]);
        index += number[0].length;
        continue;
      }

      const word = rest.match(/^[A-Za-z_]\w*/);
      if (word) {
        const value = word[0];
        const className = KEYWORDS.has(value)
          ? tokenClass(profile, "kwd", value)
          : TYPES.has(value) || /^[A-Z]\w*$/.test(value)
            ? tokenClass(profile, "typ", value)
            : tokenClass(profile, "pln", value);
        appendSpan(fragment, className, value);
        index += value.length;
        continue;
      }

      const punct = rest.match(/^[{}()[\];,.<>+\-*/%=&|!?:~^]+/);
      if (punct) {
        appendSpan(fragment, tokenClass(profile, "pun"), punct[0]);
        index += punct[0].length;
        continue;
      }

      appendSpan(fragment, tokenClass(profile, "pln"), line[index]);
      index += 1;
    }

    return fragment;
  }

  function getLineNodes(node) {
    const list = node.querySelector(":scope > ol.linenums");
    if (list) return [...list.children].filter((child) => child.tagName === "LI");
    const aceLayer = node.matches(".ace_text-layer")
      ? node
      : node.querySelector(":scope .ace_text-layer");
    if (aceLayer) {
      const directLines = [...aceLayer.children].filter((child) => child.classList.contains("ace_line"));
      const groupedLines = [...aceLayer.querySelectorAll(":scope > .ace_line_group > .ace_line")];
      return [...directLines, ...groupedLines].sort((a, b) => aceLineTop(a) - aceLineTop(b));
    }
    return [...node.querySelectorAll(":scope li")];
  }

  function cssPx(value) {
    const number = parseFloat(value || "0");
    return Number.isFinite(number) ? number : 0;
  }

  function aceLineHost(lineNode) {
    const parent = lineNode.parentElement;
    return parent?.classList.contains("ace_line_group") ? parent : lineNode;
  }

  function aceLineTop(lineNode) {
    return cssPx(aceLineHost(lineNode).style.top);
  }

  function aceLineHeight(codeNode, lineNodes) {
    const firstLine = lineNodes[0];
    const firstHost = firstLine ? aceLineHost(firstLine) : null;
    const hostHeight = cssPx(firstHost?.style.height);
    if (hostHeight) return hostHeight;

    const scroller = codeNode.querySelector(":scope .ace_scroller");
    const lineHeight = parseFloat(getComputedStyle(scroller || codeNode).lineHeight);
    return Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 17;
  }

  function aceLineIndex(lineNode, lineHeight) {
    return Math.round(aceLineTop(lineNode) / lineHeight);
  }

  function readSource(node) {
    const lineNodes = getLineNodes(node);
    if (lineNodes.length) return lineNodes.map((line) => line.textContent || "").join("\n");
    return node.innerText || node.textContent || "";
  }

  function readNearbyCopySource(codeNode) {
    const visibleSource = readSource(codeNode);
    const copyBlocks = [...document.querySelectorAll("pre[id^='for_copy'], .source-code-for-copy")];
    const candidates = copyBlocks.map((node) => ({
      node,
      source: node.textContent || ""
    })).filter(({ source }) => {
      return /^\s*(?:#\s*define\s+[A-Za-z_]\w*|typedef\s+.+?\s+[A-Za-z_]\w*\s*;\s*(?:\/\/.*)?$|(?:template\s*<.+>\s*)?using\s+[A-Za-z_]\w*\s*=.+?;\s*(?:\/\/.*)?$)/m.test(source)
        && source.split("\n").length >= visibleSource.split("\n").length;
    });

    if (!candidates.length) return "";

    const nearby = candidates.find(({ node }) => {
      const parent = node.parentElement;
      return parent && (parent.contains(codeNode) || codeNode.parentElement?.contains(node));
    });

    return (nearby || candidates[0]).source;
  }

  function readFullSource(codeNode) {
    if (!codeNode.matches(".ace_editor")) return readSource(codeNode);

    const copySource = readNearbyCopySource(codeNode);
    const aceSource = readSource(codeNode);
    return copySource && copySource.split("\n").length > aceSource.split("\n").length
      ? copySource
      : aceSource;
  }

  function findCodeBlocks() {
    const candidates = [...document.querySelectorAll(CODE_SELECTORS)];

    return candidates.filter((node) => {
      if (node.dataset[PROCESSED]) return false;
      if (node.closest(".undefiner-wrap")) return false;
      if (node.closest(".line-numbers-rows, .ace_gutter, .ace_gutter-layer")) return false;
      if (node.matches("[id^='for_copy'], .source-code-for-copy")) return false;
      if (node.offsetParent === null && !node.querySelector(".ace_text-layer")) return false;
      if (!node.matches(".ace_editor") && node.querySelector(":scope .ace_editor")) return false;
      if (!node.matches(".ace_editor") && candidates.some((candidate) => {
        return candidate !== node && candidate.contains(node) && readSource(candidate).includes(readSource(node));
      })) return false;

      const text = readFullSource(node);
      return /^\s*(?:#\s*define\s+[A-Za-z_]\w*|typedef\s+.+?\s+[A-Za-z_]\w*\s*;\s*(?:\/\/.*)?$|(?:template\s*<.+>\s*)?using\s+[A-Za-z_]\w*\s*=.+?;\s*(?:\/\/.*)?$)/m.test(text);
    });
  }

  function continuesToNextLine(line) {
    return /\\\s*$/.test(line);
  }

  function stripContinuation(line) {
    return line.replace(/\\\s*$/, "").trimEnd();
  }

  function splitTopLevelComma(text) {
    const values = [];
    let current = "";
    let angle = 0;
    let paren = 0;
    let bracket = 0;
    let brace = 0;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (char === "<") angle += 1;
      else if (char === ">" && angle > 0) angle -= 1;
      else if (char === "(") paren += 1;
      else if (char === ")" && paren > 0) paren -= 1;
      else if (char === "[") bracket += 1;
      else if (char === "]" && bracket > 0) bracket -= 1;
      else if (char === "{") brace += 1;
      else if (char === "}" && brace > 0) brace -= 1;

      if (char === "," && angle === 0 && paren === 0 && bracket === 0 && brace === 0) {
        values.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    if (current.trim() !== "" || values.length > 0) {
      values.push(current.trim());
    }

    return values;
  }

  function buildLogicalLines(source) {
    const physicalLines = source.split("\n");
    const logicalLines = [];

    for (let index = 0; index < physicalLines.length; index += 1) {
      const start = index;
      const parts = [];

      while (index < physicalLines.length) {
        const line = physicalLines[index];
        parts.push(stripContinuation(line));
        if (!continuesToNextLine(line)) break;
        index += 1;
      }

      logicalLines.push({
        index: start,
        line: parts.join(" ").replace(/\s+/g, " ").trimEnd(),
        lineIndices: Array.from({ length: index - start + 1 }, (_, offset) => start + offset)
      });
    }

    return logicalLines;
  }

  function parseMacroArgs(argsText) {
    if (argsText === undefined) {
      return { args: null, variadic: false, variadicName: null };
    }

    let variadic = false;
    let variadicName = null;
    const args = argsText.split(",").map((arg) => arg.trim()).filter(Boolean).map((arg) => {
      if (arg === "...") {
        variadic = true;
        return "__VA_ARGS__";
      }

      if (arg === "__VA_ARGS__") {
        variadic = true;
        return "__VA_ARGS__";
      }

      const namedVariadic = arg.match(/^([A-Za-z_]\w*)\s*\.\.\.$/);
      if (namedVariadic) {
        variadic = true;
        variadicName = namedVariadic[1];
        return variadicName;
      }

      return arg;
    });

    return { args, variadic, variadicName };
  }

  function parseTemplateParams(paramsText) {
    if (!paramsText) return null;

    const params = splitTopLevelComma(paramsText).map((part) => {
      const withoutDefault = part.replace(/=.*/, "").trim();
      const namedType = withoutDefault.match(/^(?:class|typename)\s+(?:\.\.\.\s*)?([A-Za-z_]\w*)$/);
      if (namedType) return namedType[1];

      const fallback = withoutDefault.match(/([A-Za-z_]\w*)$/);
      return fallback ? fallback[1] : "";
    }).filter(Boolean);

    return params.length ? params : null;
  }

  function pushRule(rules, seen, rule) {
    if (seen.has(rule.id)) return;
    seen.add(rule.id);
    rules.push(rule);
  }

  function expandKnownObjectDefinesForParsing(line, rules) {
    let nextLine = line;

    rules.forEach((rule) => {
      if (rule.kind !== "define" || rule.args) return;
      nextLine = replaceObjectMacro(nextLine, rule);
    });

    return nextLine;
  }

  function parseRules(source) {
    const seen = new Set();
    const rules = [];
    const logicalLines = buildLogicalLines(source);

    logicalLines.forEach(({ line, index, lineIndices }, position) => {
      const defineMatch = line.match(DEFINE_RE);
      if (defineMatch) {
        const { args, variadic, variadicName } = parseMacroArgs(defineMatch[3]);

        const key = `define:${index}:${defineMatch[2]}`;
        pushRule(rules, seen, {
          args,
          body: defineMatch[4] || "",
          id: key,
          index,
          kind: "define",
          lineIndices,
          name: defineMatch[2],
          original: line,
          variadic,
          variadicName
        });
        return;
      }

      const typedefMatch = line.match(TYPEDEF_RE);
      if (typedefMatch && !/[()]/.test(typedefMatch[1])) {
        const key = `typedef:${index}:${typedefMatch[2]}`;
        pushRule(rules, seen, {
          args: null,
          aliasKind: "typedef",
          body: typedefMatch[1].trim(),
          id: key,
          index,
          kind: "typedef",
          lineIndices,
          name: typedefMatch[2],
          original: line
        });
        return;
      }

      const templateOnly = line.match(TEMPLATE_ONLY_RE);
      const nextLine = templateOnly ? logicalLines[position + 1] : null;
      const rawUsingLine = nextLine
        ? `template<${templateOnly[1]}> ${nextLine.line}`
        : line;
      const usingLine = expandKnownObjectDefinesForParsing(rawUsingLine, rules);
      const usingIndex = nextLine ? nextLine.index : index;
      const usingLineIndices = nextLine ? [...lineIndices, ...nextLine.lineIndices] : lineIndices;
      const usingMatch = usingLine.match(USING_RE);
      if (!usingMatch) return;

      const key = `typedef:${usingIndex}:${usingMatch[2]}`;
      pushRule(rules, seen, {
        args: parseTemplateParams(usingMatch[1]),
        aliasKind: "using",
        body: usingMatch[3].trim(),
        id: key,
        index: usingIndex,
        kind: "typedef",
        lineIndices: usingLineIndices,
        name: usingMatch[2],
        original: usingLine
      });
    });

    return rules;
  }

  function replaceObjectMacro(line, macro) {
    return line.replace(new RegExp(`\\b${escapeRegExp(macro.name)}\\b`, "g"), macro.body);
  }

  function readCallArgs(source, start) {
    let depth = 0;
    let current = "";
    const args = [];

    for (let i = start; i < source.length; i += 1) {
      const char = source[i];

      if (char === "(") {
        if (depth > 0) current += char;
        depth += 1;
        continue;
      }

      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          if (current.trim() !== "" || args.length > 0) {
            args.push(current.trim());
          }
          return { args, end: i + 1 };
        }
        current += char;
        continue;
      }

      if (char === "," && depth === 1) {
        args.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    return null;
  }

  function readTemplateArgs(source, start) {
    let depth = 0;
    let current = "";
    const args = [];

    for (let i = start; i < source.length; i += 1) {
      const char = source[i];

      if (char === "<") {
        if (depth > 0) current += char;
        depth += 1;
        continue;
      }

      if (char === ">") {
        depth -= 1;
        if (depth === 0) {
          if (current.trim() !== "" || args.length > 0) {
            args.push(current.trim());
          }
          return { args, end: i + 1 };
        }
        current += char;
        continue;
      }

      if (char === "," && depth === 1) {
        args.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    return null;
  }

  function expandFunctionBody(macro, values) {
    let body = macro.body;

    if (macro.variadic) {
      const fixedCount = Math.max(0, macro.args.length - 1);
      macro.args.slice(0, fixedCount).forEach((name, index) => {
        body = body.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"), values[index] || "");
      });

      const varArgs = values.slice(fixedCount).join(", ");
      body = body.replace(/\b__VA_ARGS__\b/g, varArgs);
      body = body.replace(/\b__VA_OPT__\s*\(([^()]*)\)/g, varArgs ? "$1" : "");
      if (macro.variadicName) {
        body = body.replace(new RegExp(`\\b${escapeRegExp(macro.variadicName)}\\b`, "g"), varArgs);
      }
    } else {
      macro.args.forEach((name, index) => {
        body = body.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"), values[index] || "");
      });
    }

    return body;
  }

  function replaceFunctionMacro(line, macro) {
    const nameRe = new RegExp(`\\b${escapeRegExp(macro.name)}\\s*\\(`, "g");
    let result = "";
    let cursor = 0;
    let match;

    while ((match = nameRe.exec(line)) !== null) {
      const openParen = nameRe.lastIndex - 1;
      const call = readCallArgs(line, openParen);
      if (!call) continue;
      if (macro.variadic) {
        const fixedCount = Math.max(0, macro.args.length - 1);
        if (call.args.length < fixedCount) continue;
      } else if (call.args.length !== macro.args.length) {
        continue;
      }

      result += line.slice(cursor, match.index);
      result += expandFunctionBody(macro, call.args);
      cursor = call.end;
      nameRe.lastIndex = call.end;
    }

    return result + line.slice(cursor);
  }

  function replaceTemplateAlias(line, macro) {
    const nameRe = new RegExp(`\\b${escapeRegExp(macro.name)}\\s*<`, "g");
    let result = "";
    let cursor = 0;
    let match;

    while ((match = nameRe.exec(line)) !== null) {
      const openAngle = nameRe.lastIndex - 1;
      const call = readTemplateArgs(line, openAngle);
      if (!call || call.args.length !== macro.args.length) continue;

      result += line.slice(cursor, match.index);
      result += expandFunctionBody(macro, call.args);
      cursor = call.end;
      nameRe.lastIndex = call.end;
    }

    return result + line.slice(cursor);
  }

  function applyMacro(line, macro) {
    if (macro.kind === "typedef" && macro.args) {
      return replaceTemplateAlias(line, macro);
    }

    return macro.args
      ? replaceFunctionMacro(line, macro)
      : replaceObjectMacro(line, macro);
  }

  function expandActiveMacros(line, active) {
    let nextLine = line;

    for (let pass = 0; pass < 12; pass += 1) {
      const before = nextLine;
      active.forEach((macro) => {
        nextLine = applyMacro(nextLine, macro);
      });

      if (nextLine === before) break;
    }

    return nextLine;
  }

  function transformLine(line, index, defines, activeIds) {
    const active = defines.filter((macro) => {
      return activeIds.has(macro.id) && !macro.lineIndices.includes(index);
    });

    return expandActiveMacros(line, active);
  }

  function renderPlain(codeNode, originalSource, defines, activeIds) {
    const lines = originalSource.split("\n");
    codeNode.textContent = lines.map((line, index) => {
      return transformLine(line, index, defines, activeIds);
    }).join("\n");
  }

  function renderRich(lines, defines, activeIds) {
    lines.forEach((line, index) => {
      const nextText = transformLine(line.originalText, index, defines, activeIds);
      const disabledDefine = defines.some((macro) => {
        return activeIds.has(macro.id) && macro.lineIndices.includes(index);
      });
      const changed = nextText !== line.originalText;

      if (nextText === line.originalText) {
        line.content.innerHTML = line.originalHtml;
      } else {
        line.content.replaceChildren(highlightCodeLine(nextText, line.profile));
      }

      line.node.classList.toggle("undefiner-line-disabled", disabledDefine);
      line.node.classList.toggle("undefiner-line-changed", changed && !disabledDefine);
    });
  }

  function renderAce(codeNode, sourceLines, originalHtmlByIndex, defines, activeIds, lineHeight) {
    getLineNodes(codeNode).forEach((node) => {
      const index = aceLineIndex(node, lineHeight);
      const originalText = sourceLines[index] ?? node.textContent ?? "";
      const originalHtml = originalHtmlByIndex.get(index) ?? node.innerHTML;
      const nextText = transformLine(originalText, index, defines, activeIds);
      const disabledDefine = defines.some((macro) => {
        return activeIds.has(macro.id) && macro.lineIndices.includes(index);
      });
      const defineOnThisLine = defines.find((macro) => macro.lineIndices.includes(index));
      const changed = nextText !== originalText;

      if (changed) {
        node.replaceChildren(highlightCodeLine(nextText, "ace"));
        node.dataset.undefinerChanged = "true";
      } else if (node.dataset.undefinerChanged) {
        node.innerHTML = originalHtml;
        delete node.dataset.undefinerChanged;
      }

      node.classList.toggle("undefiner-define-line", Boolean(defineOnThisLine));
      node.classList.toggle("undefiner-typedef-line", defineOnThisLine?.kind === "typedef");
      node.classList.toggle("undefiner-line-disabled", disabledDefine);
      node.classList.toggle("undefiner-line-changed", changed && !disabledDefine);
    });
  }

  function lineTop(codeNode, lineIndex) {
    const style = getComputedStyle(codeNode);
    const fontSize = parseFloat(style.fontSize) || 13;
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.35;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    return paddingTop + lineIndex * lineHeight;
  }

  function createButton(macro, activeIds, onChange) {
    const button = document.createElement("button");
    button.className = `undefiner-toggle undefiner-toggle-${macro.kind}`;
    button.type = "button";
    button.textContent = "-";
    button.title = macro.kind === "typedef"
      ? `${macro.aliasKind === "using" ? "Un-alias" : "Un-typedef"} ${macro.name}`
      : `Un-define ${macro.name}`;
    button.setAttribute("aria-label", `Toggle ${macro.name}`);
    button.setAttribute("aria-pressed", "false");

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (activeIds.has(macro.id)) {
        activeIds.delete(macro.id);
        button.textContent = "-";
        button.setAttribute("aria-pressed", "false");
      } else {
        activeIds.add(macro.id);
        button.textContent = "+";
        button.setAttribute("aria-pressed", "true");
      }

      onChange();
    });

    return button;
  }

  function cleanupDuplicateButtons(root = document) {
    root.querySelectorAll(".undefiner-gutter").forEach((gutter) => {
      const seen = new Set();

      [...gutter.querySelectorAll(":scope > .undefiner-toggle")].forEach((button) => {
        const key = button.dataset.undefinerKey || button.getAttribute("aria-label") || button.title || "";

        if (seen.has(key)) {
          button.remove();
        } else {
          seen.add(key);
        }
      });
    });
  }

  function installRich(codeNode, defines, lineNodes) {
    codeNode.dataset[PROCESSED] = "true";
    codeNode.classList.add("undefiner-code", "undefiner-rich");
    codeNode.parentElement?.querySelectorAll(":scope > .undefiner-gutter").forEach((node) => node.remove());

    const wrap = document.createElement("div");
    wrap.className = "undefiner-wrap undefiner-rich-wrap";
    codeNode.parentNode.insertBefore(wrap, codeNode);
    wrap.appendChild(codeNode);

    const gutter = document.createElement("div");
    gutter.className = "undefiner-gutter";
    wrap.appendChild(gutter);

    const lines = lineNodes.map((node) => {
      const originalHtml = node.innerHTML;
      const content = document.createElement("span");
      content.className = "undefiner-line-content";
      content.innerHTML = originalHtml;
      node.textContent = "";
      node.appendChild(content);

      return {
        content,
        node,
        originalHtml,
        originalText: content.textContent || "",
        profile: detectHighlightProfile(node)
      };
    });

    const activeIds = new Set();
    const buttons = [];

    const positionButtons = () => {
      const wrapTop = wrap.getBoundingClientRect().top;
      buttons.forEach(({ button, line }) => {
        button.style.top = `${line.node.getBoundingClientRect().top - wrapTop}px`;
      });
    };

    defines.forEach((macro) => {
      const line = lines[macro.index];
      if (!line) return;

      line.node.classList.add("undefiner-define-line", `undefiner-${macro.kind}-line`);
      const button = createButton(macro, activeIds, () => {
        renderRich(lines, defines, activeIds);
        positionButtons();
        cleanupDuplicateButtons();
      });
      button.dataset.undefinerKey = macro.id;

      if (buttons.some((item) => item.button.dataset.undefinerKey === button.dataset.undefinerKey)) return;

      gutter.appendChild(button);
      buttons.push({ button, line });
    });

    positionButtons();
    cleanupDuplicateButtons();
    requestAnimationFrame(() => {
      positionButtons();
      cleanupDuplicateButtons();
    });
    window.addEventListener("resize", positionButtons);
  }

  function installAce(codeNode, originalSource, defines, lineNodes) {
    codeNode.dataset[PROCESSED] = "true";
    codeNode.classList.add("undefiner-code", "undefiner-rich", "undefiner-ace");
    codeNode.parentElement?.querySelectorAll(":scope > .undefiner-gutter").forEach((node) => node.remove());

    const aceGutter = codeNode.querySelector(":scope .ace_gutter");
    const gutterLayer = codeNode.querySelector(":scope .ace_gutter-layer");
    if (!aceGutter || !gutterLayer) return;
    codeNode.querySelectorAll(":scope .undefiner-ace-gutter").forEach((node) => node.remove());

    const gutter = document.createElement("div");
    gutter.className = "undefiner-gutter undefiner-ace-gutter";
    aceGutter.appendChild(gutter);

    const sourceLines = originalSource.split("\n");
    const lineHeight = aceLineHeight(codeNode, lineNodes);
    const originalHtmlByIndex = new Map();

    lineNodes.forEach((node) => {
      originalHtmlByIndex.set(aceLineIndex(node, lineHeight), node.innerHTML);
    });

    const activeIds = new Set();
    const buttons = [];

    const positionButtons = () => {
      const layerTop = cssPx(gutterLayer.style.top);
      buttons.forEach(({ button, lineIndex }) => {
        button.style.top = `${layerTop + lineIndex * lineHeight}px`;
      });
    };

    const refresh = () => {
      renderAce(codeNode, sourceLines, originalHtmlByIndex, defines, activeIds, lineHeight);
      positionButtons();
      cleanupDuplicateButtons(codeNode);
    };

    let refreshFrame = 0;
    let refreshTimer = 0;
    const scheduleRefresh = () => {
      if (!refreshFrame) {
        refreshFrame = requestAnimationFrame(() => {
          refreshFrame = 0;
          refresh();
        });
      }

      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 35);
    };

    defines.forEach((macro) => {
      if (sourceLines[macro.index] === undefined) return;
      const button = createButton(macro, activeIds, () => {
        refresh();
        requestAnimationFrame(refresh);
        setTimeout(refresh, 40);
      });
      button.dataset.undefinerKey = macro.id;

      if (buttons.some((item) => item.button.dataset.undefinerKey === button.dataset.undefinerKey)) return;

      gutter.appendChild(button);
      buttons.push({ button, lineIndex: macro.index });
    });

    refresh();
    requestAnimationFrame(() => {
      refresh();
    });
    codeNode.querySelector(":scope .ace_scroller")?.addEventListener("scroll", scheduleRefresh, { passive: true });
    codeNode.querySelector(":scope .ace_scrollbar-v")?.addEventListener("scroll", scheduleRefresh, { passive: true });
    new MutationObserver(scheduleRefresh).observe(gutterLayer, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", scheduleRefresh);
  }

  function installPlain(codeNode, originalSource, defines) {
    codeNode.dataset[PROCESSED] = "true";
    codeNode.classList.add("undefiner-code");
    codeNode.parentElement?.querySelectorAll(":scope > .undefiner-gutter").forEach((node) => node.remove());

    const wrap = document.createElement("div");
    wrap.className = "undefiner-wrap";
    codeNode.parentNode.insertBefore(wrap, codeNode);
    wrap.appendChild(codeNode);

    const gutter = document.createElement("div");
    gutter.className = "undefiner-gutter";
    wrap.appendChild(gutter);

    const activeIds = new Set();

    defines.forEach((macro) => {
      const button = createButton(macro, activeIds, () => {
        renderPlain(codeNode, originalSource, defines, activeIds);
        cleanupDuplicateButtons();
      });
      button.dataset.undefinerKey = macro.id;
      if (gutter.querySelector(`[data-undefiner-key="${button.dataset.undefinerKey}"]`)) return;
      button.style.top = `${lineTop(codeNode, macro.index)}px`;
      gutter.appendChild(button);
    });

    cleanupDuplicateButtons();
  }

  function createHtmlLineNodes(codeNode) {
    const target = codeNode.matches("pre")
      ? codeNode.querySelector(":scope > code") || codeNode
      : codeNode;

    if (target.querySelector(".ace_text-layer, ol.linenums")) return [];
    if (!target.innerHTML.includes("\n")) return [];
    if (!target.querySelector("span")) return [];

    const lineNumberRows = target.querySelector(":scope > .line-numbers-rows");
    lineNumberRows?.remove();

    const htmlLines = target.innerHTML.split("\n");
    target.textContent = "";

    const lineNodes = htmlLines.map((html) => {
      const line = document.createElement("span");
      line.className = "undefiner-html-line";
      line.innerHTML = html || "&#8203;";
      target.appendChild(line);
      return line;
    });

    if (lineNumberRows) target.appendChild(lineNumberRows);
    return lineNodes;
  }

  function install(codeNode) {
    const originalSource = readFullSource(codeNode);
    const defines = parseRules(originalSource);
    if (!defines.length) return;

    const lineNodes = getLineNodes(codeNode);
    if (codeNode.matches(".ace_editor")) {
      installAce(codeNode, originalSource, defines, lineNodes);
    } else if (lineNodes.length) {
      installRich(codeNode, defines, lineNodes);
    } else {
      const htmlLineNodes = createHtmlLineNodes(codeNode);
      if (htmlLineNodes.length) {
        installRich(codeNode, defines, htmlLineNodes);
      } else {
        installPlain(codeNode, originalSource, defines);
      }
    }
  }

  function scan() {
    findCodeBlocks().forEach(install);
    cleanupDuplicateButtons();
  }

  isCurrentSiteEnabled((enabled) => {
    if (!enabled) return;

    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  });
})();
