/**
 * Mirrors GitHub Actions' filter-pattern semantics for the subset used
 * by the workflow tests: "**" matches any characters including "/", "*"
 * matches any characters except "/", and everything else is matched
 * literally.
 *
 * Implemented as a backtracking matcher (no RegExp) so the glob
 * pattern never flows into a dynamically constructed regular
 * expression.
 */
export function matchesBranchFilter(
  branch: string,
  patterns: string[],
): boolean {
  return patterns.some((pattern) => globMatch(branch, 0, pattern, 0));
}

function globMatch(
  text: string,
  textIndex: number,
  pattern: string,
  patternIndex: number,
): boolean {
  if (patternIndex === pattern.length) {
    return textIndex === text.length;
  }

  if (pattern[patternIndex] !== "*") {
    return (
      textIndex < text.length &&
      text[textIndex] === pattern[patternIndex] &&
      globMatch(text, textIndex + 1, pattern, patternIndex + 1)
    );
  }

  if (pattern[patternIndex + 1] === "*") {
    for (let i = textIndex; i <= text.length; i++) {
      if (globMatch(text, i, pattern, patternIndex + 2)) {
        return true;
      }
    }
    return false;
  }

  for (let i = textIndex; i <= text.length; i++) {
    if (globMatch(text, i, pattern, patternIndex + 1)) {
      return true;
    }
    if (text[i] === "/") break;
  }
  return false;
}
