# 🍳 ChefIA — Gerador de receitas com Google Gemini

Produto desenvolvido para o projeto **"Criação de um Produto com Integração à API Gemini"**.
O usuário informa os ingredientes que tem em casa (e restrições alimentares); o backend valida os dados,
aplica regras de negócio e usa o **Gemini** para criar uma receita estruturada, exibida em uma interface **React Native** (web/mobile).

## Mapeamento com os requisitos do PDF
| Requisito | Onde está |
|---|---|
| 1. API (Node.js) | `backend/server.js` (Node.js puro, sem frameworks) |
| 2. Regras de negócio, validações, tratamento de dados | `backend/validators.js`, `backend/gemini.js`, `server.js` |
| 3. Integração com Gemini | `backend/gemini.js` |
| 4. Interface em React Native (web) | `frontend/App.js` (Expo + react-native-web) |
| 5. Apresentação PowerPoint | `ChefIA_Apresentacao.pptx` |

## Arquitetura
```
React Native (Expo, web/mobile) --HTTP/JSON--> API Node.js --HTTPS--> Gemini API (generateContent)
                                                    |
                                          history.json (persistência)
```
A chave do Gemini fica **apenas no backend** (`.env`), nunca no app.

## Como executar
Pré-requisitos: **Node.js 18+** e uma chave gratuita em https://aistudio.google.com/apikey

**1) Backend** (sem dependências: não precisa de `npm install`)
```bash
cd backend
cp .env.example .env      # edite e cole sua GEMINI_API_KEY (ou use MOCK_GEMINI=true)
npm test                  # testes unitários + ponta a ponta (Gemini simulado)
npm start                 # http://localhost:3001
```
Abra **http://localhost:3001** no navegador: a API já serve uma página web simples para testar tudo.
Só quer ver funcionando sem chave? Rode `MOCK_GEMINI=true node server.js` (no Windows PowerShell: `$env:MOCK_GEMINI="true"; node server.js`).

**2) Frontend** (outro terminal)
```bash
cd frontend
npm install
npx expo install --fix    # alinha versões das dependências ao Expo
npm run web               # abre no navegador
```
Celular físico: em `App.js`, troque `localhost` pelo IP do seu computador.

## Endpoints
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Status da API |
| POST | `/api/recipes` | Valida, chama o Gemini e salva a receita |
| GET | `/api/recipes` | Histórico (últimas 50) |
| DELETE | `/api/recipes/:id` | Remove do histórico |

Exemplo:
```bash
curl -X POST localhost:3001/api/recipes -H "Content-Type: application/json" \
  -d '{"ingredients":["tomate","ovo","cebola"],"restrictions":["vegetariano"],"servings":2,"maxCalories":500}'
```

## Regras de negócio e validações
- 2 a 15 ingredientes, únicos, apenas letras (2–40 caracteres) → também reduz risco de *prompt injection*.
- Restrições só da lista: vegetariano, vegano, sem glúten, sem lactose, low carb.
- Porções 1–10; calorias 100–2000; dificuldade facil/medio/dificil.
- **Conflito ingrediente × restrição** (ex.: queijo + vegano) → HTTP 422 antes de gastar a API.
- Resposta da IA é validada (JSON, campos obrigatórios); se `kcal` > limite, devolve `warning`.
- Rate limit: 10 req/min por IP. Timeout de 30 s no Gemini.
- Erros mapeados: 400 (dados), 422 (regra/segurança), 429, 502/503/504 (IA).

## Integração com o Gemini
`gemini.js` envia `POST .../models/gemini-2.5-flash:generateContent` com:
- `systemInstruction`: persona de chef/nutricionista e formato JSON obrigatório;
- `contents`: ingredientes, restrições, porções e limite de calorias;
- `generationConfig.responseMimeType = "application/json"` para saída estruturada.

O modelo pode ser trocado em `GEMINI_MODEL`.

## Roteiro da demonstração
1. Adicione `tomate`, `ovo`, `cebola` → marque *vegetariano* → **Gerar receita**.
2. Mostre a receita e o histórico.
3. Adicione `queijo` + marque *vegano* → mostre o erro de regra de negócio.
4. (Opcional) `npm test` no terminal.
