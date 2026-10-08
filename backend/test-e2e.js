// Teste de ponta a ponta sem internet: sobe um Gemini falso e a API do ChefIA
const http = require('http');
const assert = require('assert');
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    assert.ok(req.headers['x-goog-api-key'] === 'chave-teste' && JSON.parse(b).generationConfig.responseMimeType === 'application/json');
    const recipe = { title: 'Omelete de tomate', description: 'Rápida', difficulty: 'facil', prepTimeMinutes: 10, caloriesPerServing: 600,
      ingredients: [{ name: 'ovo', quantity: '2' }], steps: ['Bata', 'Frite'], tips: 'Sirva quente' };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(recipe) }] } }] }));
  });
});
fake.listen(0, async () => {
  process.env.GEMINI_BASE_URL = `http://localhost:${fake.address().port}/v1beta`;
  process.env.GEMINI_API_KEY = 'chave-teste';
  process.env.MOCK_GEMINI = 'false';
  const server = require('./server');
  server.listen(0, async () => {
    const base = `http://localhost:${server.address().port}`;
    const call = async (m, p, body) => { const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }); return [r.status, r.status === 204 ? null : await r.json()]; };
    let [s, d] = await call('GET', '/api/health'); assert.strictEqual(s, 200);
    [s, d] = await call('POST', '/api/recipes', { ingredients: ['tomate', 'ovo'], maxCalories: 500 });
    assert.strictEqual(s, 201); assert.strictEqual(d.recipe.title, 'Omelete de tomate'); assert.ok(d.recipe.warning);
    const id = d.id;
    [s, d] = await call('POST', '/api/recipes', { ingredients: ['tomate', 'queijo'], restrictions: ['vegano'] }); assert.strictEqual(s, 422);
    [s, d] = await call('POST', '/api/recipes', { ingredients: ['x1'] }); assert.strictEqual(s, 400);
    [s, d] = await call('GET', '/api/recipes'); assert.ok(d.some((r) => r.id === id));
    [s] = await call('DELETE', '/api/recipes/' + id); assert.strictEqual(s, 204);
    [s] = await call('DELETE', '/api/recipes/' + id); assert.strictEqual(s, 404);
    console.log('Teste ponta a ponta (API + Gemini simulado) passou ✔');
    server.close(); fake.close(); process.exit(0);
  });
});
