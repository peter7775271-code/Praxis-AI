export type CriteriaDisplayItem = {
  type: 'heading' | 'criteria';
  text: string;
  marks?: string | null;
  subpart?: string | null;
  key: string;
};

export function stripOuterBraces(s: string): string {
  const t = s.trim();
  if (t.startsWith('{') && t.endsWith('}') && t.length >= 2) return t.slice(1, -1).trim();
  return s;
}

export const parseCriteriaForDisplay = (criteriaText: string): CriteriaDisplayItem[] => {
  if (!criteriaText) return [];
  const lines = criteriaText.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const items: CriteriaDisplayItem[] = [];

  lines.forEach((line, idx) => {
    const cleaned = line.replace(/^\s*[•\-]\s*/, '').trim();
    if (!cleaned) return;

    if (/^PART\s+/i.test(cleaned)) {
      items.push({
        type: 'heading',
        text: cleaned.replace(/^PART\s+/i, '').trim(),
        key: `part-${idx}`,
      });
      return;
    }

    const subpartMatch = cleaned.match(/^\((i{1,3}|iv|v|vi|vii|viii|ix|x)\)\s+/i);
    const subpart = subpartMatch ? subpartMatch[1].toLowerCase() : null;
    const rest = subpartMatch ? cleaned.slice(subpartMatch[0].length).trim() : cleaned;

    const marksPrefixMatch = rest.match(/^MARKS_([\d.]+)\s+(.*)$/i);
    const underscoreMatch = rest.match(/^(.*)_([\d.]+)$/);
    const markMatch = marksPrefixMatch || underscoreMatch || rest.match(/([\d.]+)\s*marks?\b/i) || rest.match(/\b([\d.]+)\s*$/);

    if (!markMatch) return;

    const markValue = marksPrefixMatch
      ? marksPrefixMatch[1]
      : underscoreMatch
        ? underscoreMatch[2]
        : markMatch[1];

    const criteriaOnly = marksPrefixMatch
      ? marksPrefixMatch[2].trim()
      : underscoreMatch
        ? underscoreMatch[1].trim()
        : rest
          .replace(/[\d.]+\s*marks?/gi, '')
          .replace(/\b[\d.]+\s*$/, '')
          .replace(/:\s*$/, '')
          .trim();

    items.push({
      type: 'criteria',
      text: criteriaOnly,
      marks: markValue,
      subpart,
      key: `crit-${idx}`,
    });
  });

  return items;
};
