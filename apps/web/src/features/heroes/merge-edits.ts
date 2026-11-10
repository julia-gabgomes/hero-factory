// Função pura: nenhuma dependência de React ou da API. Resolve o merge de
// três vias quando um PATCH leva 409 VERSION_CONFLICT.
//
// Regras (apps/web/CLAUDE.md):
// - Campo que só a outra pessoa mudou (eu não toquei) recebe o valor dela.
// - Campo que só eu mudei mantém o que eu digitei.
// - Campo que os dois mudaram, com valores diferentes, mantém o que eu
//   digitei mas entra em `conflicts`, para a tela destacar e a pessoa
//   escolher.
export interface MergeResult<T> {
  merged: T;
  conflicts: Array<keyof T>;
}

export function mergeEdits<T extends object>(
  base: T,
  mine: T,
  theirs: T,
  fields: Array<keyof T>,
): MergeResult<T> {
  const merged = { ...mine };
  const conflicts: Array<keyof T> = [];

  for (const field of fields) {
    const baseValue = base[field];
    const mineValue = mine[field];
    const theirsValue = theirs[field];

    const iChangedIt = mineValue !== baseValue;
    const theyChangedIt = theirsValue !== baseValue;

    if (!iChangedIt && theyChangedIt) {
      merged[field] = theirsValue;
    } else if (iChangedIt && theyChangedIt && mineValue !== theirsValue) {
      conflicts.push(field);
    }
  }

  return { merged, conflicts };
}
