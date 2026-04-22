// ── Strip LaTeX to spoken text ──
export function stripLatex(latex: string): string {
  return latex
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 over $2')
    .replace(/\\sqrt\{([^}]*)\}/g, 'square root of $1')
    .replace(/\\int[_^]\{([^}]*)\}[_^]\{([^}]*)\}/g, 'integral from $1 to $2 of')
    .replace(/\\int/g, 'integral of')
    .replace(/\\sum[_^]\{([^}]*)\}[_^]\{([^}]*)\}/g, 'sum from $1 to $2 of')
    .replace(/\\sum/g, 'sum of')
    .replace(/\\lim[_^]\{([^}]*)\}/g, 'limit as $1')
    .replace(/\\lim/g, 'limit of')
    .replace(/\\infty/g, 'infinity')
    .replace(/\\partial/g, 'partial')
    .replace(/\\nabla/g, 'nabla')
    .replace(/\\times/g, 'times')
    .replace(/\\cdot/g, 'times')
    .replace(/\\div/g, 'divided by')
    .replace(/\\pm/g, 'plus or minus')
    .replace(/\\neq/g, 'not equal to')
    .replace(/\\leq/g, 'less than or equal to')
    .replace(/\\geq/g, 'greater than or equal to')
    .replace(/\\approx/g, 'approximately')
    .replace(/\\rightarrow/g, 'goes to')
    .replace(/\\Rightarrow/g, 'implies')
    .replace(/\\vec\{([^}]*)\}/g, 'vector $1')
    .replace(/\\hat\{([^}]*)\}/g, '$1 hat')
    .replace(/\\bar\{([^}]*)\}/g, '$1 bar')
    .replace(/\\dot\{([^}]*)\}/g, '$1 dot')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\mathbb\{([^}]*)\}/g, '$1')
    .replace(/\\left[\\(|\\|\\{]/g, '')
    .replace(/\\right[\\)|\\|\\}]/g, '')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/\{([^}]*)\}/g, '$1')
    .replace(/[_^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Clean text for speech synthesis ──
export function cleanForSpeech(text: string): string {
  return text
    // Strip display math $$...$$
    .replace(/\$\$([\s\S]*?)\$\$/g, (_m: any, inner: string) => {
      const spoken = stripLatex(inner);
      return spoken ? `. ${spoken}. ` : '';
    })
    // Strip inline math $...$
    .replace(/\$([^$]+)\$/g, (_m: any, inner: string) => {
      return stripLatex(inner);
    })
    // Strip emojis
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    // Strip markdown
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/\*{1,2}(.*?)\*{1,2}/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/^[-*]\s/gm, '')
    .replace(/^>\s/gm, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
