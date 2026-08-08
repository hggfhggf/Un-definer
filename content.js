(() => {
  if (document.documentElement.dataset.undefinerLoaded === "true") return;
  document.documentElement.dataset.undefinerLoaded = "true";

  const PROCESSED = "undefinerProcessed";
  const DEFINE_RE = /^(\s*)#\s*define\s+([A-Za-z_]\w*)(?:\(([^)]*)\))?(?:\s+(.*))?$/;
  const TYPEDEF_RE = /^\s*typedef\s+(.+?)\s+([A-Za-z_]\w*)\s*;\s*$/;
  const CODE_SELECTORS = [
    "pre",
    "#program-source-text",
    ".program-source",
    ".source-code",
    "code"
  ].join(",");

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

  function highlightCodeLine(line) {
    const fragment = document.createDocumentFragment();
    let index = 0;

    while (index < line.length) {
      const rest = line.slice(index);

      const comment = rest.match(/^\/\/.*/);
      if (comment) {
        appendSpan(fragment, "com", comment[0]);
        break;
      }

      const stringLiteral = rest.match(/^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
      if (stringLiteral) {
        appendSpan(fragment, "str", stringLiteral[0]);
        index += stringLiteral[0].length;
        continue;
      }

      const number = rest.match(/^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?)(?:[uUlLfF]*)/);
      if (number) {
        appendSpan(fragment, "lit", number[0]);
        index += number[0].length;
        continue;
      }

      const word = rest.match(/^[A-Za-z_]\w*/);
      if (word) {
        const value = word[0];
        const className = KEYWORDS.has(value)
          ? "kwd"
          : TYPES.has(value) || /^[A-Z]\w*$/.test(value)
            ? "typ"
            : "pln";
        appendSpan(fragment, className, value);
        index += value.length;
        continue;
      }

      const punct = rest.match(/^[{}()[\];,.<>+\-*/%=&|!?:~^]+/);
      if (punct) {
        appendSpan(fragment, "pun", punct[0]);
        index += punct[0].length;
        continue;
      }

      appendSpan(fragment, "pln", line[index]);
      index += 1;
    }

    return fragment;
  }

  function getLineNodes(node) {
    const list = node.querySelector(":scope > ol.linenums");
    if (list) return [...list.children].filter((child) => child.tagName === "LI");
    return [...node.querySelectorAll(":scope li")];
  }

  function readSource(node) {
    const lineNodes = getLineNodes(node);
    if (lineNodes.length) return lineNodes.map((line) => line.textContent || "").join("\n");
    return node.innerText || node.textContent || "";
  }

  function findCodeBlocks() {
    return [...document.querySelectorAll(CODE_SELECTORS)].filter((node) => {
      if (node.dataset[PROCESSED]) return false;
      if (node.closest(".undefiner-wrap")) return false;

      const text = readSource(node);
      return /^\s*(?:#\s*define\s+[A-Za-z_]\w*|typedef\s+.+?\s+[A-Za-z_]\w*\s*;)/m.test(text);
    });
  }

  function parseRules(source) {
    const seen = new Set();

    return source.split("\n").flatMap((line, index) => {
      const defineMatch = line.match(DEFINE_RE);
      if (defineMatch) {
        const args = defineMatch[3] === undefined
          ? null
          : defineMatch[3].split(",").map((arg) => arg.trim()).filter(Boolean);

        const key = `define:${index}:${defineMatch[2]}`;
        if (seen.has(key)) return [];
        seen.add(key);

        return [{
          args,
          body: defineMatch[4] || "",
          id: key,
          index,
          kind: "define",
          name: defineMatch[2],
          original: line
        }];
      }

      const typedefMatch = line.match(TYPEDEF_RE);
      if (!typedefMatch || /[()]/.test(typedefMatch[1])) return [];

      const key = `typedef:${index}:${typedefMatch[2]}`;
      if (seen.has(key)) return [];
      seen.add(key);

      return [{
        args: null,
        body: typedefMatch[1].trim(),
        id: key,
        index,
        kind: "typedef",
        name: typedefMatch[2],
        original: line
      }];
    });
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
          args.push(current.trim());
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
    macro.args.forEach((name, index) => {
      body = body.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"), values[index] || "");
    });
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
      if (!call || call.args.length !== macro.args.length) continue;

      result += line.slice(cursor, match.index);
      result += expandFunctionBody(macro, call.args);
      cursor = call.end;
      nameRe.lastIndex = call.end;
    }

    return result + line.slice(cursor);
  }

  function applyMacro(line, macro) {
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
    const active = defines.filter((macro) => activeIds.has(macro.id));
    const defineOnThisLine = defines.find((macro) => macro.index === index);

    if (defineOnThisLine) {
      return line;
    }

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
      const disabledDefine = defines.some((macro) => activeIds.has(macro.id) && macro.index === index);
      const changed = nextText !== line.originalText;

      if (nextText === line.originalText) {
        line.content.innerHTML = line.originalHtml;
      } else {
        line.content.replaceChildren(highlightCodeLine(nextText));
      }

      line.node.classList.toggle("undefiner-line-disabled", disabledDefine);
      line.node.classList.toggle("undefiner-line-changed", changed && !disabledDefine);
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
      ? `Un-typedef ${macro.name}`
      : `Un-define ${macro.name}`;
    button.setAttribute("aria-label", `Toggle ${macro.name}`);
    button.setAttribute("aria-pressed", "false");

    button.addEventListener("click", () => {
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

  function cleanupDuplicateButtons() {
    const seen = new Set();

    [...document.querySelectorAll(".undefiner-toggle")].forEach((button) => {
      const rect = button.getBoundingClientRect();
      const key = [
        button.getAttribute("aria-label") || button.title || "",
        Math.round(rect.top)
      ].join(":");

      if (seen.has(key)) {
        button.remove();
      } else {
        seen.add(key);
      }
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
        originalText: content.textContent || ""
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

  function install(codeNode) {
    const originalSource = readSource(codeNode);
    const defines = parseRules(originalSource);
    if (!defines.length) return;

    const lineNodes = getLineNodes(codeNode);
    if (lineNodes.length) {
      installRich(codeNode, defines, lineNodes);
    } else {
      installPlain(codeNode, originalSource, defines);
    }
  }

  function scan() {
    findCodeBlocks().forEach(install);
    cleanupDuplicateButtons();
  }

  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
