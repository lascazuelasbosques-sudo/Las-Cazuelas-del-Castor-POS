export interface MeatIngredientDetail {
  isMeat: boolean;
  isBistec: boolean;
  isPollo: boolean;
  isLonganiza: boolean;
  isCampechano: boolean;
  label: string;
  badgeText: string;
  details: string[];
}

export function analyzeMeatIngredients(item: { name?: string; notes?: string; station?: string }): MeatIngredientDetail {
  if (!item) {
    return {
      isMeat: false,
      isBistec: false,
      isPollo: false,
      isLonganiza: false,
      isCampechano: false,
      label: '',
      badgeText: '',
      details: []
    };
  }

  const nameStr = (item.name || '').toLowerCase();
  const notesStr = (item.notes || '').toLowerCase();
  const fullText = `${nameStr} ${notesStr}`;

  const hasExplicitCampechano = fullText.includes('campechan') || fullText.includes('mixto') || fullText.includes('mixta');

  const isBistec = fullText.includes('bistec') || 
                  fullText.includes('bistek') || 
                  fullText.includes('(c/b)') || 
                  fullText.includes('c/b') || 
                  fullText.includes('con bistec') ||
                  fullText.includes('c/ bistec');

  const isPollo = fullText.includes('pollo') || 
                 fullText.includes('pechuga') || 
                 fullText.includes('(c/p)') || 
                 fullText.includes('c/p') || 
                 fullText.includes('con pollo') ||
                 fullText.includes('c/ pollo') ||
                 fullText.includes('deshebrada');

  const isLonganiza = fullText.includes('longaniza') || 
                      fullText.includes('chorizo') || 
                      fullText.includes('(c/l)') || 
                      fullText.includes('c/l') || 
                      fullText.includes('con longaniza') ||
                      fullText.includes('c/ longaniza');

  const detected: string[] = [];
  if (isBistec) detected.push('Bistec');
  if (isLonganiza) detected.push('Longaniza');
  if (isPollo) detected.push('Pollo');

  const isCampechano = hasExplicitCampechano || detected.length >= 2;

  if (isCampechano) {
    const listStr = detected.length > 0 ? ` (${detected.join(', ')})` : '';
    return {
      isMeat: true,
      isBistec,
      isPollo,
      isLonganiza,
      isCampechano: true,
      label: 'CAMPECHANO',
      badgeText: `🔥 CAMPECHANO${listStr}`,
      details: detected.length > 0 ? detected : ['Campechano']
    };
  }

  if (isBistec) {
    return {
      isMeat: true,
      isBistec: true,
      isPollo: false,
      isLonganiza: false,
      isCampechano: false,
      label: 'BISTEC',
      badgeText: '🥩 BISTEC EN PARRILLA',
      details: ['Bistec']
    };
  }

  if (isLonganiza) {
    return {
      isMeat: true,
      isBistec: false,
      isPollo: false,
      isLonganiza: true,
      isCampechano: false,
      label: 'LONGANIZA',
      badgeText: '🌭 LONGANIZA EN PARRILLA',
      details: ['Longaniza']
    };
  }

  if (isPollo) {
    return {
      isMeat: true,
      isBistec: false,
      isPollo: true,
      isLonganiza: false,
      isCampechano: false,
      label: 'POLLO',
      badgeText: '🍗 POLLO',
      details: ['Pollo']
    };
  }

  return {
    isMeat: false,
    isBistec: false,
    isPollo: false,
    isLonganiza: false,
    isCampechano: false,
    label: '',
    badgeText: '',
    details: []
  };
}

export function checkIsBistec(item: { name?: string; notes?: string; station?: string }): boolean {
  const analysis = analyzeMeatIngredients(item);
  return analysis.isBistec || analysis.isLonganiza || analysis.isCampechano;
}

