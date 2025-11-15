/**
 * Comprehensive LaTeX cleaning utility for fixing malformed math formulas
 * Handles nested $ signs, unwrapped formulas, and common formatting issues
 */

export function cleanLaTeX(content: string): string {
  let cleaned = content;
  
  // Step 1: Remove "assistant:" prefix if present
  cleaned = cleaned.replace(/^(assistant|Assistant):\s*/i, '');
  cleaned = cleaned.replace(/\n(assistant|Assistant):\s*/gi, '\n');
  
  // Step 2: Fix nested $ signs inside math blocks
  // Pattern: $$...$...$$ or $...$...$ where middle $ should be removed
  cleaned = cleaned.replace(/\$\$([^$]*)\$([^$]*)\$\$/g, (match, part1, part2) => {
    return `$$${part1}${part2}$$`;
  });
  
  // Pattern: $...$...$ where both parts are part of the same formula
  cleaned = cleaned.replace(/\$([^$]*)\$([^$]*)\$/g, (match, part1, part2) => {
    // Only merge if part2 contains LaTeX commands or math notation
    if (part2.match(/[\\_^+\-=×÷→]/) && !match.includes('$$')) {
      return `$${part1}${part2}$`;
    }
    return match;
  });
  
  // Step 3: Remove $ signs inside braces (like in subscripts/superscripts)
  // Pattern: { $...$ } -> { ... }
  cleaned = cleaned.replace(/\{(\s*\$[^$]*\$\s*)\}/g, (match, content) => {
    return `{${content.replace(/\$/g, '').trim()}}`;
  });
  
  // Step 4: Fix \frac patterns with nested $ signs
  // Pattern: \frac{$...$}{$...$} -> \frac{...}{...}
  cleaned = cleaned.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, (match, num, den) => {
    // Remove all $ signs and trim whitespace
    const cleanNum = num.replace(/\$/g, '').trim();
    const cleanDen = den.replace(/\$/g, '').trim();
    return `\\frac{${cleanNum}}{${cleanDen}}`;
  });
  
  // Step 5: Fix formulas split by operators (like =, +, -, ×, →)
  // Pattern: $...$ = $...$ or $...$ \times $...$
  cleaned = cleaned.replace(/\$\$?([^$]*?)\$\$?\s*([=\+\-×→]|\\times|\\rightarrow|\\cdot)\s*\$\$?([^$]*?)\$\$?/g, (match, left, op, right) => {
    // Only merge if both parts contain LaTeX commands or math notation
    const leftHasMath = left.includes('\\') || left.includes('_') || left.includes('^') || left.match(/[A-Z][a-z]?\d*/);
    const rightHasMath = right.includes('\\') || right.includes('_') || right.includes('^') || right.match(/[A-Z][a-z]?\d*/);
    
    if (leftHasMath && rightHasMath) {
      const cleanLeft = left.trim().replace(/\$/g, '');
      const cleanRight = right.trim().replace(/\$/g, '');
      const cleanOp = op.replace(/\$/g, '').trim();
      
      // Use display math for complex formulas
      if (cleanLeft.includes('\\frac') || cleanRight.includes('\\frac') || 
          cleanOp.includes('\\times') || cleanOp.includes('\\rightarrow') || 
          cleanLeft.length > 30 || cleanRight.length > 30) {
        return `$$${cleanLeft} ${cleanOp} ${cleanRight}$$`;
      }
      return `$${cleanLeft} ${cleanOp} ${cleanRight}$`;
    }
    return match;
  });
  
  // Step 6: Fix formulas with units or states outside math blocks
  // Pattern: $...$(g) or $...$^{-1} -> $... (g)$ or $...^{-1}$
  cleaned = cleaned.replace(/\$\$?([^$]*?)\$\$?\s*\(([glsaq]+)\)/g, (match, formula, unit) => {
    if (formula.includes('\\text') || formula.includes('_') || formula.includes('^')) {
      return `$${formula.replace(/\$/g, '')} (${unit})$`;
    }
    return match;
  });
  
  // Pattern: $...$^{-1} -> $...^{-1}$
  cleaned = cleaned.replace(/\$\$?([^$]*?)\$\$?\s*\^\{?([^}]+)\}?/g, (match, formula, exp) => {
    if (formula.includes('\\text') || formula.includes('_') || formula.includes('^')) {
      return `$${formula.replace(/\$/g, '')}^{${exp}}$`;
    }
    return match;
  });
  
  // Step 7: Convert arrow symbols (→) to \rightarrow in math blocks
  cleaned = cleaned.replace(/\$\$?([^$]*?)\$\$?\s*→\s*\$\$?([^$]*?)\$\$?/g, (match, part1, part2) => {
    const cleanPart1 = part1.replace(/\$/g, '').trim();
    const cleanPart2 = part2.replace(/\$/g, '').trim();
    if (cleanPart1.includes('\\text') || cleanPart2.includes('\\text') || 
        cleanPart1.includes('_') || cleanPart2.includes('_') ||
        cleanPart1.includes('\\') || cleanPart2.includes('\\')) {
      return `$$${cleanPart1} \\rightarrow ${cleanPart2}$$`;
    }
    return match;
  });
  
  // Step 8: Ensure formulas with \frac, \times, or long content use display math ($$)
  cleaned = cleaned.replace(/\$([^$]*(?:\\frac|\\times|\\rightarrow|\\cdot|\\text\{[^}]+\})[^$]*)\$/g, (match, content) => {
    // Convert to display math if it's a complex formula
    if (content.length > 40 || content.includes('\\frac') || content.includes('\\times') || content.includes('\\text')) {
      return `$$${content}$$`;
    }
    return match;
  });
  
  // Step 9: Fix missing closing braces in \text commands
  // Pattern: \text{products}) -> \text{products}}
  cleaned = cleaned.replace(/\\text\{([^}]+)\}\)/g, (match, content) => {
    return `\\text{${content}}`;
  });
  
  // Pattern: H_{\text{products}) -> H_{\text{products}}
  cleaned = cleaned.replace(/_\{?\\text\{([^}]+)\}\)/g, (match, content) => {
    return `_{\\text{${content}}}`;
  });
  
  // Step 10: Fix subscripts to use proper braces (S_xy -> S_{xy}) outside math blocks
  // Only process text that's not already in math blocks
  cleaned = cleaned.replace(/([^$])([A-Za-z])_([A-Za-z0-9]+)([^$A-Za-z0-9_])/g, (match, before, base, sub, after) => {
    // Only fix if not already in braces and not inside a math block
    if (before !== '$' && after !== '$' && !match.includes('{')) {
      return `${before}${base}_{${sub}}${after}`;
    }
    return match;
  });
  
  // Step 11: Fix subscripts inside math blocks that aren't properly formatted
  cleaned = cleaned.replace(/\$([^$]*)([A-Za-z])_([A-Za-z0-9]+)([^$]*)\$/g, (match, before, base, sub, after) => {
    // Only fix if subscript isn't already in braces
    if (!match.includes(`${base}_{${sub}}`) && !match.includes(`${base}_${sub}`)) {
      return `$${before}${base}_{${sub}}${after}$`;
    }
    return match;
  });
  
  // Step 12: Wrap unwrapped \frac commands
  cleaned = cleaned.replace(/([^$])(\\frac\{[^}]+\}\{[^}]+\})([^$])/g, (match, before, frac, after) => {
    // Wrap \frac commands that aren't already in math blocks
    if (before !== '$' && after !== '$') {
      return `${before}$$${frac}$$${after}`;
    }
    return match;
  });
  
  // Step 13: Wrap unwrapped formulas with subscripts (like S_xy/S_xx)
  cleaned = cleaned.replace(/([^$])([A-Z]\s*_\s*\{?[A-Za-z0-9]+\}?)\s*\/\s*([A-Z]\s*_\s*\{?[A-Za-z0-9]+\}?)([^$])/g, (match, before, num, den, after) => {
    // Only wrap if both have subscripts and not already in math block
    if ((num.includes('_') || num.includes('{')) && (den.includes('_') || den.includes('{')) && before !== '$' && after !== '$') {
      const cleanNum = num.replace(/\s/g, '').replace(/\$/g, '');
      const cleanDen = den.replace(/\s/g, '').replace(/\$/g, '');
      return `${before}$$\\frac{${cleanNum}}{${cleanDen}}$$${after}`;
    }
    return match;
  });
  
  // Step 14: Wrap standalone variables with subscripts (like S_xy, S_xx)
  cleaned = cleaned.replace(/([^$A-Za-z0-9_])([A-Z]\s*_\s*\{?[A-Za-z0-9]+\}?)([^$A-Za-z0-9_])/g, (match, before, variable, after) => {
    // Only wrap if it has subscript and not already in math block
    if (variable.includes('_') && before !== '$' && after !== '$') {
      return `${before}$${variable.replace(/\s/g, '')}$$${after}`;
    }
    return match;
  });
  
  // Step 15: Fix patterns like H_{\text{reactants} -> H_{\text{reactants}} (missing closing brace)
  cleaned = cleaned.replace(/_\{?\\text\{([^}]+)\}(?!\})/g, (match, content) => {
    return `_{\\text{${content}}}`;
  });
  
  // Step 16: Fix double parentheses notation like ((H)) to $H$
  cleaned = cleaned.replace(/\(\(([^)]+)\)\)/g, (match, content) => {
    return `$${content}$`;
  });
  
  // Step 17: Clean up any remaining nested $ signs in display math
  cleaned = cleaned.replace(/\$\$([^$]*)\$([^$]*)\$\$/g, (match, part1, part2) => {
    return `$$${part1}${part2}$$`;
  });
  
  // Step 18: Ensure proper spacing around display math (but don't break existing spacing)
  // This step is optional and can be skipped if it causes issues
  
  return cleaned.trim();
}

