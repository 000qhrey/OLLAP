/**
 * LaTeX cleaning utility for converting <<< formula >>> delimiters to LaTeX $ delimiters
 * The backend uses <<< >>> delimiters to mark formulas, which we convert to standard LaTeX format
 */

export function cleanLaTeX(content: string): string {
  let cleaned = content;
  
  // Step 0: Convert <<< formula >>> delimiters to LaTeX $ delimiters
  // This is the primary way formulas are marked from the backend
  cleaned = cleaned.replace(/<<<([^>]+)>>>/g, (match, formula) => {
    const trimmed = formula.trim();
    
    // Determine if it should be display math ($$) or inline math ($)
    // Display math for: fractions, sums, bars, equations with =, long formulas, or formulas with line breaks
    const isDisplayMath = trimmed.includes('\\frac') || 
                          trimmed.includes('\\sum') || 
                          trimmed.includes('\\bar') ||
                          trimmed.includes('\\times') ||
                          trimmed.includes('\\rightarrow') ||
                          trimmed.includes('\\cdot') ||
                          (trimmed.includes('=') && trimmed.length > 15) ||
                          trimmed.includes('\n') ||
                          trimmed.length > 40;
    
    if (isDisplayMath) {
      return `$$${trimmed}$$`;
    } else {
      return `$${trimmed}$`;
    }
  });
  
  // Step 1: Remove "assistant:" prefix if present
  cleaned = cleaned.replace(/^(assistant|Assistant):\s*/i, '');
  cleaned = cleaned.replace(/\n(assistant|Assistant):\s*/gi, '\n');
  
  // Step 2: Fix mismatched dollar signs - ensure proper pairing
  // Pattern 1: $$...$ (display math with single closing $) -> $$...$$
  cleaned = cleaned.replace(/\$\$([^$]+)\$(?!\$)/g, (match, content) => {
    return `$$${content}$$`;
  });
  
  // Pattern 2: $...$$ (inline math with double closing $) -> $...$
  cleaned = cleaned.replace(/([^$]|^)\$([^$]+)\$\$/g, (match, before, content) => {
    return `${before}$${content}$`;
  });
  
  // Pattern 3: $$... (display math without any closing $) -> $$...$$
  // Find $$ that isn't properly closed - iterate through all occurrences
  let searchFrom = 0;
  while (true) {
    const dollarIndex = cleaned.indexOf('$$', searchFrom);
    if (dollarIndex === -1) break;
    
    // Check what comes after this $$
    const afterDollar = cleaned.substring(dollarIndex + 2);
    
    // If it starts with $$, this is a closing, skip it
    if (afterDollar.startsWith('$$')) {
      searchFrom = dollarIndex + 4;
      continue;
    }
    
    // Check if there's a closing $ or $$
    const nextDollar = afterDollar.indexOf('$');
    
    if (nextDollar === -1) {
      // No closing $ found - add closing $$
      // Find where content should end (whitespace, punctuation, or end)
      const contentMatch = afterDollar.match(/^([^$\n]+?)(?=\s|$|[.,;:!?\)\]\}])/);
      if (contentMatch) {
        const content = contentMatch[1];
        const insertPos = dollarIndex + 2 + content.length;
        cleaned = cleaned.substring(0, insertPos) + '$$' + cleaned.substring(insertPos);
        searchFrom = insertPos + 2;
      } else {
        // Add closing at end of string
        cleaned = cleaned + '$$';
        break;
      }
    } else if (nextDollar > 0 && nextDollar < afterDollar.length - 1 && afterDollar[nextDollar + 1] !== '$') {
      // Single $ found - should have been fixed by pattern 1, but ensure it's closed
      searchFrom = dollarIndex + 2 + nextDollar + 1;
    } else {
      // Properly closed or other case, move on
      if (nextDollar >= 0 && nextDollar < afterDollar.length - 1 && afterDollar[nextDollar + 1] === '$') {
        // Found closing $$
        searchFrom = dollarIndex + 2 + nextDollar + 2;
      } else {
        searchFrom = dollarIndex + 2;
      }
    }
  }
  
  // Step 3: Clean up any remaining nested $ signs in display math
  cleaned = cleaned.replace(/\$\$([^$]*)\$([^$]*)\$\$/g, (match, part1, part2) => {
    return `$$${part1}${part2}$$`;
  });
  
  // Step 4: Fix display math that should be inline: $$x$$ -> $x$ (for single variables)
  cleaned = cleaned.replace(/\$\$([a-z])\$\$/g, (match, variable) => {
    return '$' + variable + '$';
  });
  
  return cleaned.trim();
}
