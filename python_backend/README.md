# Python Backend (Motor Local)

API local em FastAPI para reduzir dependencia de IA externa.

## Endpoints

- GET /health
- POST /api/chat/reply
- GET /api/motivation/quote
- POST /api/workouts/generate

## Rodar localmente

```bash
cd python_backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

No frontend, configure:

- VITE_PYTHON_API_URL=http://localhost:8000

## CORS em producao (Vercel)

No servico Python (Render, Railway, Fly, etc.), configure a variavel de ambiente:

- ALLOWED_ORIGINS=https://seu-app.vercel.app

Se voce tiver mais de um dominio (ex.: producao + preview), use lista separada por virgula:

- ALLOWED_ORIGINS=https://seu-app.vercel.app,https://seu-app-git-main-seu-time.vercel.app

Opcional para previews dinamicos da Vercel (subdominios):

- ALLOWED_ORIGIN_REGEX=^https:\/\/seu-app-.*\.vercel\.app$

Observacoes:

- Nao use `*` em producao.
- Sempre use protocolo completo (`https://...`).
- Reinicie/redeploy o servico Python apos alterar variaveis de ambiente.
