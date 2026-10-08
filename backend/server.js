// API ChefIA — Node.js puro (sem Express): basta `node server.js`
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Carrega .env manualmente (sem dotenv)
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch { /* sem .env: usa variáveis do sistema */ }

const { AppError } = require('./errors');
const { validateRecipeRequest, RESTRICTIONS } = require('./validators');
const { generateRecipe } = require('./gemini');

// ---- Persistência em arquivo JSON (histórico, máx. 50) ----
const DB = path.join(__dirname, 'data', 'history.json');
const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; } };
const save = (list) => { fs.mkdirSync(path.dirname(DB), { recursive: true }); fs.writeFileSync(DB, JSON.stringify(list.slice(0, 50), null, 2)); };

// ---- Rate limit: 10 req/min por IP nas rotas de IA ----
const hits = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (arr.length >= 10) throw new AppError(429, 'Muitas requisições. Aguarde 1 minuto.');
  arr.push(now); hits.set(ip, arr);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 10240) { reject(new AppError(413, 'Corpo da requisição muito grande.')); req.destroy(); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new AppError(400, 'JSON inválido.')); } });
  });
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': type + '; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
}

async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204);

  if (req.method === 'GET' && (p === '/' || p === '/index.html'))
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8'), 'text/html');
  if (req.method === 'GET' && p === '/api/health')
    return send(res, 200, { status: 'ok', model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', mock: process.env.MOCK_GEMINI === 'true' });
  if (req.method === 'GET' && p === '/api/options') return send(res, 200, { restrictions: RESTRICTIONS });

  if (req.method === 'POST' && p === '/api/recipes') {
    rateLimit(req.socket.remoteAddress);
    const input = validateRecipeRequest(await readJson(req));   // validações + regras de negócio
    const recipe = await generateRecipe(input);                  // integração Gemini
    const item = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), input, recipe };
    save([item, ...load()]);
    return send(res, 201, item);
  }
  if (req.method === 'GET' && p === '/api/recipes') return send(res, 200, load());

  const del = p.match(/^\/api\/recipes\/([\w-]+)$/);
  if (req.method === 'DELETE' && del) {
    const list = load();
    if (!list.some((r) => r.id === del[1])) throw new AppError(404, 'Receita não encontrada.');
    save(list.filter((r) => r.id !== del[1]));
    return send(res, 204);
  }
  throw new AppError(404, 'Rota não encontrada.');
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    send(res, status, { error: status === 500 ? 'Erro interno.' : err.message, details: err.details || [] });
  });
});

if (require.main === module) {
  const port = process.env.PORT || 3001;
  server.listen(port, () => {
    console.log(`ChefIA API rodando em http://localhost:${port}`);
    console.log(process.env.MOCK_GEMINI === 'true' ? 'Modo MOCK (sem chamar o Gemini)'
      : process.env.GEMINI_API_KEY ? 'Gemini real ativo' : '⚠ GEMINI_API_KEY ausente — configure o .env ou use MOCK_GEMINI=true');
  });
}
module.exports = server;
