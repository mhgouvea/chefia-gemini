// Testes simples sem dependências extras: node test.js
const assert = require('assert');
const { validateRecipeRequest } = require('./validators');
const { parseAndValidate } = require('./gemini');

const fails = (fn, status) => { try { fn(); assert.fail('deveria falhar'); } catch (e) { assert.strictEqual(e.status, status); } };

assert.deepStrictEqual(validateRecipeRequest({ ingredients: 'Tomate, Cebola, tomate' }).ingredients, ['tomate', 'cebola']);
fails(() => validateRecipeRequest({ ingredients: ['tomate'] }), 400);
fails(() => validateRecipeRequest({ ingredients: ['tomate', 'abc123'] }), 400);
fails(() => validateRecipeRequest({ ingredients: ['tomate', 'queijo'], restrictions: ['vegano'] }), 422);
fails(() => validateRecipeRequest({ ingredients: ['tomate', 'cebola'], servings: 50 }), 400);
assert.strictEqual(parseAndValidate('```json\n{"title":"a","ingredients":[{"name":"x"}],"steps":["s"]}\n```').title, 'a');
fails(() => parseAndValidate('não é json'), 502);
console.log('Todos os testes passaram ✔');
