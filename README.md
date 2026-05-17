# JPFitness

Aplicacao web fitness com foco em treinos personalizados, controle de evolucao e suporte inteligente para treino.

## Visao Geral

O JPFitness foi construido para centralizar em um unico lugar:
- criacao de treinos manuais por dia da semana
- geracao de planos com IA
- execucao de treino com registro de series, reps e peso real (kg)
- monitoramento de carga e evolucao por usuario
- controle de progresso por metricas de treino
- autenticacao e persistencia via Supabase

## Stack

- React 18
- Vite 5
- Tailwind CSS
- Supabase (Auth + Postgres)
- Recharts
- Groq API (chat e geracao de treino)
- FastAPI (motor Python local para fallback de treino/chat)

## Funcionalidades Principais

- Autenticacao de usuario com sessao persistente
- Biblioteca de exercicios em portugues
- Treinos manuais e treinos gerados por IA
- Execucao de treino com check de series
- Registro de carga real por serie (kg e reps)
- Historico de treinos e evolucao de carga por usuario
- Dashboard com indicadores de atividade e progresso
- PWA com instalacao no navegador

## Estrutura do Projeto

```text
src/
  components/
  context/
  pages/
  services/
public/
supabase/
  schema.sql
  migrations/
```

## Variaveis de Ambiente

Crie um arquivo .env com base no .env.example.

Variaveis obrigatorias:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_GROQ_API_KEY

Variaveis opcionais:
- VITE_PYTHON_API_URL (padrao: http://localhost:8000)

## Rodando Localmente

1. Instale dependencias:

```bash
npm install
```

2. Configure o .env:

```bash
cp .env.example .env
```

3. Rode em desenvolvimento:

```bash
npm run dev
```

4. Build de producao:

```bash
npm run build
```

5. Preview local da build:

```bash
npm run preview
```

## Banco de Dados (Supabase)

Antes de usar monitoramento completo de carga/evolucao, execute as migracoes no SQL Editor do Supabase:

1. Schema base (se necessario):
- supabase/schema.sql

2. Migracao de carga por treino:
- supabase/migrations/20260516_add_workout_load_tracking.sql

Essa migracao adiciona campos de carga em workout_logs e index para consultas por usuario.

## Motor Python Local (Opcional e Recomendado)

Para reduzir dependencia de provedores externos de IA, o projeto inclui um motor Python em [python_backend/app.py](python_backend/app.py).

Funcionalidades atuais:
- fallback de respostas de chat
- fallback de geracao de treino semanal

Como rodar:

1. Acesse [python_backend](python_backend)
2. Crie e ative um ambiente virtual
3. Instale dependencias com [python_backend/requirements.txt](python_backend/requirements.txt)
4. Inicie: `uvicorn app:app --reload --host 0.0.0.0 --port 8000`

## Deploy na Vercel

### 1. Importar projeto

- Acesse o painel da Vercel
- Import Project
- Selecione o repositorio GitHub

### 2. Configuracao de build

A Vercel identifica Vite automaticamente. Se precisar setar manualmente:
- Build Command: npm run build
- Output Directory: dist

### 3. Variaveis de ambiente na Vercel

Adicione no projeto (Environment Variables):
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_GROQ_API_KEY

### 4. Rotas SPA

O arquivo vercel.json ja esta configurado para fallback de rotas do React Router para index.html.

### 5. Deploy

A cada push na branch principal, a Vercel gera novo deploy automaticamente.

## Observacoes Importantes

- Nao commitar .env com chaves reais.
- O app utiliza dados por usuario com RLS no Supabase.
- Historicos antigos sem peso por serie podem aparecer sem metricas completas de carga.

## Roadmap Sugerido

- filtros de evolucao por exercicio (7/30/90 dias)
- comparativo de PR por exercicio
- exportacao de historico em CSV
- metas de progressao automatica por perfil

## Licenca

Uso interno/proprietario do projeto JPFitness.
