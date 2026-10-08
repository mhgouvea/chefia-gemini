const { AppError } = require('./errors');

const RESTRICTIONS = {
  'vegetariano': ['carne', 'frango', 'peixe', 'porco', 'bacon', 'presunto', 'linguiça', 'atum', 'camarão', 'bife'],
  'vegano': ['carne', 'frango', 'peixe', 'porco', 'bacon', 'presunto', 'linguiça', 'atum', 'camarão', 'bife',
             'leite', 'queijo', 'manteiga', 'ovo', 'iogurte', 'requeijão', 'mel', 'creme'],
  'sem glúten': ['trigo', 'macarrão', 'pão', 'farinha', 'aveia', 'cevada'],
  'sem lactose': ['leite', 'queijo', 'manteiga', 'iogurte', 'requeijão', 'creme'],
  'low carb': ['açúcar', 'arroz', 'macarrão', 'pão', 'batata', 'farinha'],
};
const DIFFICULTIES = ['facil', 'medio', 'dificil'];
const stem = (w) => w.replace(/s$/, '');

function validateRecipeRequest(body = {}) {
  const errors = [];

  // 1) Ingredientes: aceita array ou string separada por vírgula
  let raw = Array.isArray(body.ingredients) ? body.ingredients
          : typeof body.ingredients === 'string' ? body.ingredients.split(',') : null;
  let ingredients = [];
  if (!raw) errors.push('ingredients deve ser uma lista de ingredientes.');
  else {
    ingredients = [...new Set(raw.map((i) => String(i).trim().replace(/\s+/g, ' ').toLowerCase()).filter(Boolean))];
    if (ingredients.length < 2) errors.push('Informe pelo menos 2 ingredientes diferentes.');
    if (ingredients.length > 15) errors.push('Máximo de 15 ingredientes.');
    // Somente letras: remove números/símbolos e reduz risco de prompt injection
    const bad = ingredients.filter((i) => !/^[\p{L}][\p{L}\s-]{1,39}$/u.test(i));
    if (bad.length) errors.push(`Ingredientes inválidos (use só letras, 2-40 caracteres): ${bad.join(', ')}`);
  }

  // 2) Restrições alimentares (lista fechada)
  const restrictions = [...new Set((body.restrictions || []).map((r) => String(r).toLowerCase()))];
  const unknown = restrictions.filter((r) => !RESTRICTIONS[r]);
  if (unknown.length) errors.push(`Restrições não suportadas: ${unknown.join(', ')}`);

  // 3) Porções, calorias, dificuldade
  const servings = body.servings === undefined ? 2 : Number(body.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > 10) errors.push('servings deve ser inteiro entre 1 e 10.');
  let maxCalories = null;
  if (body.maxCalories !== undefined && body.maxCalories !== null && body.maxCalories !== '') {
    maxCalories = Number(body.maxCalories);
    if (!Number.isInteger(maxCalories) || maxCalories < 100 || maxCalories > 2000) errors.push('maxCalories deve ser inteiro entre 100 e 2000.');
  }
  const difficulty = body.difficulty ? String(body.difficulty).toLowerCase() : null;
  if (difficulty && !DIFFICULTIES.includes(difficulty)) errors.push(`difficulty deve ser: ${DIFFICULTIES.join(', ')}.`);

  if (errors.length) throw new AppError(400, 'Dados inválidos.', errors);

  // 4) Regra de negócio: ingrediente conflita com a restrição escolhida
  const conflicts = [];
  for (const r of restrictions)
    for (const ing of ingredients)
      if (ing.split(/[\s-]+/).some((w) => RESTRICTIONS[r].map(stem).includes(stem(w))))
        conflicts.push(`"${ing}" não é compatível com a restrição "${r}".`);
  if (conflicts.length) throw new AppError(422, 'Ingredientes incompatíveis com as restrições.', conflicts);

  return { ingredients, restrictions, servings, maxCalories, difficulty };
}

module.exports = { validateRecipeRequest, RESTRICTIONS: Object.keys(RESTRICTIONS), DIFFICULTIES };
