/**
 * Math Normalization Utility
 * 
 * Converts ALL LaTeX math formats into $...$ and $$...$$ 
 * that remark-math + rehype-katex can render.
 * 
 * Key fix: Detects BARE LaTeX commands in plain text and wraps them.
 */

// ── All known LaTeX math commands ──
const LATEX_MATH_COMMANDS = new Set([
  // Arithmetic
  'frac', 'dfrac', 'tfrac', 'sqrt', 'boxed', 'cancel', 'cancelto',
  'displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle',
  // Functions
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'exp', 'det', 'dim', 'mod', 'gcd', 'max', 'min',
  'lim', 'limsup', 'liminf', 'sup', 'inf',
  'int', 'iint', 'iiint', 'oint', 'sum', 'prod', 'coprod',
  // Greek letters
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon',
  'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda',
  'mu', 'nu', 'xi', 'omicron', 'pi', 'varpi', 'rho', 'varrho',
  'sigma', 'varsigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi',
  'psi', 'omega', 'digamma',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma',
  'Upsilon', 'Phi', 'Psi', 'Omega',
  // Accents
  'hat', 'widehat', 'check', 'tilde', 'widetilde', 'acute', 'grave',
  'dot', 'ddot', 'breve', 'bar', 'vec', 'overrightarrow', 'overleftarrow',
  'overline', 'underline', 'overbrace', 'underbrace', 'overset', 'underset',
  'stackrel',
  // Font
  'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'mathcal', 'mathbb',
  'mathfrak', 'mathscr', 'text', 'textbf', 'textit', 'textrm',
  'boldsymbol', 'boldmath', 'bm',
  // Operators & relations
  'leq', 'geq', 'neq', 'equiv', 'approx', 'cong', 'sim', 'simeq',
  'propto', 'll', 'gg', 'prec', 'succ', 'preceq', 'succeq',
  'subset', 'supset', 'subseteq', 'supseteq', 'sqsubset', 'sqsupset',
  'in', 'notin', 'ni', 'emptyset', 'varnothing',
  'forall', 'exists', 'nexists', 'neg', 'land', 'lor', 'implies',
  'top', 'bot', 'vdash', 'dashv', 'models',
  'perp', 'parallel', 'angle', 'measuredangle', 'sphericalangle',
  'triangle', 'square', 'lozenge', 'star', 'clubsuit', 'diamondsuit',
  // Arrows
  'rightarrow', 'leftarrow', 'leftrightarrow', 'Rightarrow', 'Leftarrow',
  'Leftrightarrow', 'longrightarrow', 'longleftarrow', 'uparrow', 'downarrow',
  'Uparrow', 'Downarrow', 'nearrow', 'searrow', 'swarrow', 'nwarrow',
  'mapsto', 'longmapsto', 'hookrightarrow', 'hookleftarrow',
  'rightharpoonup', 'rightharpoondown', 'leftharpoonup', 'leftharpoondown',
  'rightleftharpoons', 'xrightarrow', 'xleftarrow',
  // Big operators
  'bigcap', 'bigcup', 'bigsqcup', 'bigvee', 'bigwedge', 'bigodot',
  'bigoplus', 'bigotimes', 'biguplus',
  // Spacing & formatting
  'left', 'right', 'Big', 'bigg', 'Bigg', 'big', 'Bigm',
  'quad', 'qquad', ',', ';', '!', ':',
  'begin', 'end',
  // Misc
  'infty', 'partial', 'nabla', 'triangleq',
  'times', 'div', 'pm', 'mp', 'cdot', 'cdots', 'ldots', 'vdots', 'ddots',
  'circ', 'bullet', 'oplus', 'ominus', 'otimes', 'oslash', 'odot',
  'dagger', 'ddagger', 'aleph', 'hbar', 'ell', 'wp', 'Re', 'Im',
  'prime', 'backprime',
  'binom', 'choose', 'tbinom', 'dbinom',
  'color', 'textcolor', 'colorbox', 'fcolorbox',
  'overleftarrow', 'overrightarrow', 'overleftrightarrow',
  'xrightarrow', 'xleftarrow',
  'differential', 'dd',
]);

// ── Unicode to LaTeX mapping ──
const UNICODE_MAP: [RegExp, string][] = [
  [/\u00B2/g, '^{2}'],       // ²
  [/\u00B3/g, '^{3}'],       // ³
  [/\u00B9/g, '^{1}'],       // ¹
  [/\u2070/g, '^{0}'],       // ⁰
  [/\u2074/g, '^{4}'],       // ⁴
  [/\u2075/g, '^{5}'],       // ⁵
  [/\u2076/g, '^{6}'],       // ⁶
  [/\u2077/g, '^{7}'],       // ⁷
  [/\u2078/g, '^{8}'],       // ⁸
  [/\u2079/g, '^{9}'],       // ⁹
  [/\u00D7/g, '\\times'],    // ×
  [/\u00F7/g, '\\div'],      // ÷
  [/\u2212/g, '-'],          // − (minus sign)
  [/\u2260/g, '\\neq'],      // ≠
  [/\u2264/g, '\\leq'],      // ≤
  [/\u2265/g, '\\geq'],      // ≥
  [/\u00B1/g, '\\pm'],       // ±
  [/\u221A/g, '\\sqrt'],     // √
  [/\u2211/g, '\\sum'],      // ∑
  [/\u220F/g, '\\prod'],     // ∏
  [/\u222B/g, '\\int'],      // ∫
  [/\u221E/g, '\\infty'],    // ∞
  [/\u03B1/g, '\\alpha'],    // α
  [/\u03B2/g, '\\beta'],     // β
  [/\u03B3/g, '\\gamma'],    // γ
  [/\u03B4/g, '\\delta'],    // δ
  [/\u03B5/g, '\\epsilon'],  // ε
  [/\u03B8/g, '\\theta'],    // θ
  [/\u03BB/g, '\\lambda'],   // λ
  [/\u03BC/g, '\\mu'],       // μ
  [/\u03C0/g, '\\pi'],       // π
  [/\u03C3/g, '\\sigma'],    // σ
  [/\u03C9/g, '\\omega'],    // ω
  [/\u03A6/g, '\\Phi'],      // Φ
  [/\u03A8/g, '\\Psi'],      // Ψ
  [/\u03A9/g, '\\Omega'],    // Ω
  [/\u2202/g, '\\partial'],  // ∂
  [/\u2207/g, '\\nabla'],    // ∇
  [/\u2192/g, '\\rightarrow'], // →
  [/\u2190/g, '\\leftarrow'],  // ←
  [/\u21D2/g, '\\Rightarrow'], // ⇒
  [/\u2208/g, '\\in'],        // ∈
  [/\u2209/g, '\\notin'],     // ∉
  [/\u2229/g, '\\cap'],       // ∩
  [/\u222A/g, '\\cup'],       // ∪
  [/\u2282/g, '\\subset'],    // ⊂
  [/\u2283/g, '\\supset'],    // ⊃
  [/\u2205/g, '\\emptyset'],  // ∅
  [/\u22C5/g, '\\cdot'],      // ⋅
];

function replaceUnicodeMath(text: string): string {
  let result = text;
  for (const [regex, replacement] of UNICODE_MAP) {
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Check if a backslash command is a LaTeX math command
 */
function isLatexMathCommand(cmd: string): boolean {
  return LATEX_MATH_COMMANDS.has(cmd);
}

/**
 * Find the end of a LaTeX expression starting at position `start` in `text`.
 * Handles nested braces: \frac{a+b}{c+d} or \sqrt{b^2-4ac}
 * Returns the index right after the expression ends.
 */
function findLatexExprEnd(text: string, start: number): number {
  let i = start;
  
  // Skip the command name
  while (i < text.length && /[a-zA-Z]/.test(text[i])) i++;
  
  // Skip optional arguments [...]
  if (i < text.length && text[i] === '[') {
    let depth = 1;
    i++;
    while (i < text.length && depth > 0) {
      if (text[i] === '[') depth++;
      if (text[i] === ']') depth--;
      i++;
    }
  }
  
  // Skip brace arguments { } (could be multiple: \frac{a}{b})
  let braceCount = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      braceCount++;
      i++;
      // Find matching }
      let depth = 1;
      while (i < text.length && depth > 0) {
        if (text[i] === '{' && text[i-1] !== '\\') depth++;
        if (text[i] === '}') depth--;
        i++;
      }
      braceCount++;
    } else if (text[i] === '\\' && i + 1 < text.length && /[a-zA-Z]/.test(text[i+1])) {
      // Next argument could be another LaTeX command
      const cmdStart = i;
      let j = i + 1;
      while (j < text.length && /[a-zA-Z]/.test(text[j])) j++;
      const cmd = text.substring(i + 1, j);
      if (isLatexMathCommand(cmd)) {
        // This is a continuation of the math expression
        i = findLatexExprEnd(text, cmdStart);
      } else {
        break;
      }
    } else if (text[i] === '_' || text[i] === '^') {
      // Subscript/superscript — part of math
      i++;
      if (i < text.length && text[i] === '{') {
        let depth = 1;
        i++;
        while (i < text.length && depth > 0) {
          if (text[i] === '{') depth++;
          if (text[i] === '}') depth--;
          i++;
        }
      } else {
        // Single char subscript/superscript
        i++;
      }
    } else if (text[i] === ' ' || text[i] === '\t') {
      // Space — might be end of expression or just spacing
      // If followed by more math, continue
      let j = i;
      while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++;
      if (j < text.length && (text[j] === '\\' || text[j] === '_' || text[j] === '^' || text[j] === '{')) {
        i = j;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  return i;
}

// findLatexExprStart removed — not needed

// ── Main normalization function ──
export function normalizeMath(text: string): string {
  if (!text) return text;

  let result = text;

  // 1. Fix backtick-wrapped math: `$x^2$` → $x^2$
  result = result.replace(/`+(\$\$[\s\S]*?\$\$)`+/g, '$1');
  result = result.replace(/`+(\$[^$\n]+?\$)`+/g, '$1');

  // 2. Convert \[...\] → $$...$$  (display math)
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    return `$$${math}$$`;
  });

  // 3. Convert \(...\) → $...$  (inline math)
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
    return `$${math}$`;
  });

  // 4. Convert \begin{equation}...\end{equation} → $$...$$
  result = result.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (_, math) => {
    return `$$${math}$$`;
  });

  // 5. Convert \begin{align}...\end{align} → $$...$$
  result = result.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (_, math) => {
    return `$$${math}$$`;
  });

  // 6. Convert \begin{aligned}...\end{aligned} → $$...$$
  result = result.replace(/\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}/g, (_, math) => {
    return `$$${math}$$`;
  });

  // 7. Convert \begin{cases}...\end{cases} → $$...$$
  result = result.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_, math) => {
    return `$$${math}$$`;
  });

  // 8. Convert \begin{matrix/pmatrix/bmatrix/vmatrix}...\\end{} → $$...$$
  result = result.replace(/\\begin\{(pmatrix|bmatrix|vmatrix|Vmatrix|matrix)\}([\s\S]*?)\\end\{\1\}/g, (_, env, math) => {
    return `$$\\begin{${env}}${math}\\end{${env}}$$`;
  });

  // 9. Convert \begin{gather}...\end{gather} → $$...$$
  result = result.replace(/\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g, (_, math) => {
    return `$$${math}$$`;
  });

  // 10. Convert \begin{multline}...\end{multline} → $$...$$
  result = result.replace(/\\begin\{multline\*?\}([\s\S]*?)\\end\{multline\*?\}/g, (_, math) => {
    return `$$${math}$$`;
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 11. ★ THE KEY FIX: Detect BARE LaTeX in plain text ★
  //     Find LaTeX commands NOT inside $...$, $$...$$, or code blocks
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  result = wrapBareLatex(result);

  // 12. Convert unicode math in $ delimiters (only inside math, not in code blocks)
  const parts = result.split(/(```[\s\S]*?```)/g);
  result = parts.map((part, i) => {
    if (i % 2 === 1) return part;
    if (part.startsWith('`') && part.endsWith('`') && !part.startsWith('```')) return part;
    
    return part.replace(/(\$[^$]+?\$)/g, (match) => {
      return replaceUnicodeMath(match);
    }).replace(/(\$\$[\s\S]+?\$\$)/g, (match) => {
      return replaceUnicodeMath(match);
    });
  }).join('');

  // 13. Ensure display math is on its own line for proper rendering
  result = result.replace(/([^\n])\$\$/g, '$1\n\n$$');
  result = result.replace(/\$\$([^\n])/g, '$$\n\n$1');

  return result;
}

/**
 * ★ THE KEY FIX: Detect bare LaTeX commands in plain text and wrap them in $...$
 * 
 * Strategy:
 * 1. Split text into segments: code blocks, existing math ($...$, $$...$$), and plain text
 * 2. In plain text segments, find bare LaTeX commands and wrap them
 * 3. Rejoin everything
 */
function wrapBareLatex(text: string): string {
  // Split by code blocks and existing math to protect them
  const segments: Array<{ type: 'code' | 'math' | 'displaymath' | 'plain'; text: string }> = [];
  
  // Tokenize: extract code blocks, display math, inline math first
  let remaining = text;
  const tokens: Array<{ start: number; end: number; type: string; text: string }> = [];
  
  // Find code blocks
  let m;
  const codeBlockRegex = /```[\s\S]*?```/g;
  while ((m = codeBlockRegex.exec(remaining)) !== null) {
    tokens.push({ start: m.index, end: m.index + m[0].length, type: 'code', text: m[0] });
  }
  
  // Find inline code
  const inlineCodeRegex = /`[^`\n]+`/g;
  while ((m = inlineCodeRegex.exec(remaining)) !== null) {
    // Only if not inside a code block
    const insideCode = tokens.some(t => t.type === 'code' && m!.index >= t.start && m!.index < t.end);
    if (!insideCode) {
      tokens.push({ start: m.index, end: m.index + m[0].length, type: 'code', text: m[0] });
    }
  }
  
  // Sort tokens by position
  tokens.sort((a, b) => a.start - b.start);
  
  // Build segments array
  let lastEnd = 0;
  for (const token of tokens) {
    if (token.start > lastEnd) {
      segments.push({ type: 'plain', text: remaining.slice(lastEnd, token.start) });
    }
    segments.push({ type: 'code' as const, text: token.text });
    lastEnd = token.end;
  }
  if (lastEnd < remaining.length) {
    segments.push({ type: 'plain', text: remaining.slice(lastEnd) });
  }
  
  // Now process each plain text segment
  const result: string[] = [];
  for (const seg of segments) {
    if (seg.type !== 'plain') {
      result.push(seg.text);
      continue;
    }
    
    result.push(wrapBareLatexInSegment(seg.text));
  }
  
  return result.join('');
}

function wrapBareLatexInSegment(text: string): string {
  // First, protect existing $...$ and $$...$$ math
  // Split into: math segments and true plain text
  const fragments: Array<{ isMath: boolean; text: string }> = [];
  
  let remaining = text;
  const mathTokens: Array<{ index: number; length: number; text: string }> = [];
  
  // Find $$...$$ (display math)
  const displayMathRegex = /\$\$[\s\S]*?\$\$/g;
  let m;
  while ((m = displayMathRegex.exec(remaining)) !== null) {
    mathTokens.push({ index: m.index, length: m[0].length, text: m[0] });
  }
  
  // Find $...$ (inline math) — but not $$
  const inlineMathRegex = /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g;
  while ((m = inlineMathRegex.exec(remaining)) !== null) {
    // Check not inside a display math
    const insideDisplay = mathTokens.some(t => 
      t.text.startsWith('$$') && m!.index >= t.index && m!.index < t.index + t.length
    );
    if (!insideDisplay) {
      mathTokens.push({ index: m.index, length: m[0].length, text: m[0] });
    }
  }
  
  // Sort and build fragments
  mathTokens.sort((a, b) => a.index - b.index);
  let lastEnd = 0;
  for (const token of mathTokens) {
    if (token.index > lastEnd) {
      fragments.push({ isMath: false, text: remaining.slice(lastEnd, token.index) });
    }
    fragments.push({ isMath: true, text: token.text });
    lastEnd = token.index + token.length;
  }
  if (lastEnd < remaining.length) {
    fragments.push({ isMath: false, text: remaining.slice(lastEnd) });
  }
  
  // Now wrap bare LaTeX in non-math fragments
  const output: string[] = [];
  for (const frag of fragments) {
    if (frag.isMath) {
      output.push(frag.text);
    } else {
      output.push(detectAndWrapBareLatex(frag.text));
    }
  }
  
  return output.join('');
}

/**
 * Detect bare LaTeX commands in a truly plain text segment and wrap them.
 * Uses a single-pass approach: scan for \command patterns.
 */
function detectAndWrapBareLatex(text: string): string {
  // Scan for backslash followed by a known math command
  const result: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    // Detect \command pattern
    if (text[i] === '\\' && i + 1 < text.length && /[a-zA-Z]/.test(text[i + 1])) {
      // Extract command name
      let j = i + 1;
      while (j < text.length && /[a-zA-Z]/.test(text[j])) j++;
      const cmd = text.substring(i + 1, j);
      
      if (isLatexMathCommand(cmd)) {
        // Found a bare LaTeX command!
        // Find the start of this math expression (look backwards for connected math)
        let exprStart = i;
        // Look back for connected expressions like x^{2} before \frac
        let bs = i - 1;
        while (bs >= 0) {
          if (text[bs] === ' ') break;
          if (text[bs] === '\n') break;
          // Check if we're at a natural word boundary
          if (bs > 0 && /[a-zA-Z0-9]/.test(text[bs]) && /[^a-zA-Z0-9\\{}_^]/.test(text[bs-1])) break;
          // Don't go before the start of a line
          exprStart = bs;
          bs--;
        }
        
        // Find the end of this math expression
        const exprEnd = findLatexExprEnd(text, i + 1);
        
        // Also look ahead after the initial command for more connected math
        let finalEnd = exprEnd;
        // Continue scanning forward for more connected LaTeX
        let scan = finalEnd;
        let foundMore = true;
        while (foundMore) {
          foundMore = false;
          // Skip spaces
          while (scan < text.length && text[scan] === ' ') scan++;
          if (scan < text.length) {
            if (text[scan] === '\\' && scan + 1 < text.length && /[a-zA-Z]/.test(text[scan + 1])) {
              let j2 = scan + 1;
              while (j2 < text.length && /[a-zA-Z]/.test(text[j2])) j2++;
              const nextCmd = text.substring(scan + 1, j2);
              if (isLatexMathCommand(nextCmd)) {
                finalEnd = findLatexExprEnd(text, scan + 1);
                scan = finalEnd;
                foundMore = true;
              }
            } else if (text[scan] === '=' || text[scan] === '+' || text[scan] === '-' || 
                       text[scan] === ',' || text[scan] === '.') {
              // These could be part of an equation: \frac{a}{b} = c + d
              // Look ahead for more LaTeX
              let peek = scan + 1;
              while (peek < text.length && text[peek] === ' ') peek++;
              if (peek < text.length && text[peek] === '\\' && peek + 1 < text.length && /[a-zA-Z]/.test(text[peek + 1])) {
                let j3 = peek + 1;
                while (j3 < text.length && /[a-zA-Z]/.test(text[j3])) j3++;
                const peekCmd = text.substring(peek + 1, j3);
                if (isLatexMathCommand(peekCmd)) {
                  finalEnd = findLatexExprEnd(text, peek + 1);
                  scan = finalEnd;
                  foundMore = true;
                } else {
                  break;
                }
              } else {
                // Include the operator and regular variables
                finalEnd = scan + 1;
                scan = finalEnd;
                // But stop if we hit a period that looks like end of sentence
                if (text[scan - 1] === '.' && scan < text.length && text[scan] === ' ') break;
                foundMore = true;
              }
            }
          }
        }
        
        // Determine if this should be display ($$) or inline ($) math
        const expr = text.substring(exprStart, finalEnd);
        const isDisplay = expr.includes('\\\\') || expr.includes('\\begin') || 
                          expr.includes('\\int') || expr.includes('\\sum') ||
                          expr.includes('\\frac{\\frac') || expr.length > 60;
        
        if (isDisplay) {
          result.push(`\n\n$$${expr}$$\n\n`);
        } else {
          result.push(`$${expr}$`);
        }
        
        i = finalEnd;
        continue;
      }
    }
    
    result.push(text[i]);
    i++;
  }
  
  return result.join('');
}

// ── Quick check if text contains any math ──
export function containsMath(text: string): boolean {
  return /\$[^$]+\$|\\\[[\s\S]*?\\\]|\\begin\{|\\frac|\\sqrt|\\int|\\sum|\\boxed/.test(text);
}

// ── Strip all LaTeX/math for speech synthesis ──
export function stripLatexForSpeech(text: string): string {
  let clean = text;

  // Remove display math first
  clean = clean.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    return ' ' + mathToSpeech(math) + ' ';
  });

  // Remove inline math
  clean = clean.replace(/\$([^$\n]+?)\$/g, (_, math) => {
    return ' ' + mathToSpeech(math) + ' ';
  });

  // Remove any remaining LaTeX commands
  clean = clean.replace(/\\[a-zA-Z]+/g, '');
  clean = clean.replace(/[{}]/g, '');
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

function mathToSpeech(math: string): string {
  let speech = math;

  const speechMap: [RegExp, string][] = [
    [/\\frac\{([^}]*)}\{([^}]*)}/g, '$1 over $2'],
    [/\\sqrt\{([^}]*)}/g, 'square root of $1'],
    [/\\sqrt\[(\d+)\]\{([^}]*)}/g, '$1th root of $2'],
    [/\\int/g, 'integral of'],
    [/\\sum/g, 'sum of'],
    [/\\prod/g, 'product of'],
    [/\\lim/g, 'limit'],
    [/\\infty/g, 'infinity'],
    [/\\alpha/g, 'alpha'],
    [/\\beta/g, 'beta'],
    [/\\gamma/g, 'gamma'],
    [/\\delta/g, 'delta'],
    [/\\theta/g, 'theta'],
    [/\\lambda/g, 'lambda'],
    [/\\mu/g, 'mu'],
    [/\\pi/g, 'pi'],
    [/\\sigma/g, 'sigma'],
    [/\\omega/g, 'omega'],
    [/\\phi/g, 'phi'],
    [/\\epsilon/g, 'epsilon'],
    [/\\nabla/g, 'nabla'],
    [/\\partial/g, 'partial'],
    [/\\times/g, 'times'],
    [/\\div/g, 'divided by'],
    [/\\pm/g, 'plus minus'],
    [/\\cdot/g, 'dot'],
    [/\\leq/g, 'less than or equal to'],
    [/\\geq/g, 'greater than or equal to'],
    [/\\neq/g, 'not equal to'],
    [/\\approx/g, 'approximately'],
    [/\\rightarrow/g, 'implies'],
    [/\\Rightarrow/g, 'therefore'],
    [/\\leftarrow/g, 'from'],
    [/\\vec\{([^}]*)}/g, 'vector $1'],
    [/\\hat\{([^}]*)}/g, '$1 hat'],
    [/\\bar\{([^}]*)}/g, '$1 bar'],
    [/\\dot\{([^}]*)}/g, '$1 dot'],
    [/\\ddot\{([^}]*)}/g, '$1 double dot'],
    [/\\text\{([^}]*)}/g, '$1'],
    [/\\mathrm\{([^}]*)}/g, '$1'],
    [/\\mathbf\{([^}]*)}/g, '$1'],
    [/\\mathbb\{([^}]*)}/g, '$1'],
    [/\\sin/g, 'sin'],
    [/\\cos/g, 'cos'],
    [/\\tan/g, 'tan'],
    [/\\log/g, 'log'],
    [/\\ln/g, 'natural log'],
    [/\\exp/g, 'e to the'],
    [/\\to/g, 'to'],
    [/\\in/g, 'in'],
    [/\\cup/g, 'union'],
    [/\\cap/g, 'intersection'],
    [/\\subset/g, 'subset of'],
    [/\\emptyset/g, 'empty set'],
    [/\\forall/g, 'for all'],
    [/\\exists/g, 'there exists'],
    [/\\Delta/g, 'delta'],
    [/\\Omega/g, 'omega'],
    [/\\Phi/g, 'phi'],
    [/\\Psi/g, 'psi'],
    [/\^{([^}]*)}/g, 'to the power $1'],
    [/\^(\d)/g, 'to the power $1'],
    [/_\{([^}]*)}/g, ' sub $1'],
    [/_(\w)/g, ' sub $1'],
    [/\\begin\{[^}]*}/g, ''],
    [/\\end\{[^}]*}/g, ''],
    [/\\left/g, ''],
    [/\\right/g, ''],
    [/\\,/g, ''],
    [/\\;/g, ''],
    [/\\!/g, ''],
    [/\\quad/g, ''],
    [/\\qquad/g, ''],
    [/\\&/g, ''],
    [/\\\\/g, ', '],
    [/[{}\[\]]/g, ''],
  ];

  for (const [regex, replacement] of speechMap) {
    speech = speech.replace(regex, replacement);
  }

  speech = speech.replace(/\s+/g, ' ').trim();
  return speech;
}
