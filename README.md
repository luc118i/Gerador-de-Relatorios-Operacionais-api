<div align="center">

# Gerador de Relatórios Operacionais — API

**Backend para gestão de ocorrências operacionais, geração de PDF e análise assistida por IA.**

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)

</div>

---

## Sobre o projeto

API REST construída com Node.js e TypeScript para registro e acompanhamento de ocorrências operacionais em frotas de transporte público. A plataforma automatiza a geração de relatórios em PDF, integra análise de texto por IA e envia documentos diretamente ao Google Drive.

---

## Funcionalidades

- **Registro de ocorrências** com validação de dados, vínculos de motoristas e snapshots históricos
- **Geração de PDF** via Puppeteer com suporte a múltiplos templates, cabeçalho/rodapé e imagens embutidas
- **Análise por IA** — correção ortográfica (Groq LLaMA 3.3 70B + LanguageTool) e sumarização de relatos
- **Gestão de evidências** com otimização automática de imagens (Sharp) e URLs assinadas (Supabase Storage)
- **Exportação para Google Drive** via integração com a API do Google
- **Notificações em tempo real** via Google Apps Script para atualização de planilhas
- **Geração híbrida de PDF** — Chrome local para PDFs pequenos, Browserless remoto para volumes maiores

---

## Stack de tecnologias

**Runtime e linguagem**
- Node.js 20+ · TypeScript 5.9

**Framework e validação**
- Express 5 · Zod

**Banco de dados e armazenamento**
- Supabase (PostgreSQL + Storage)

**Geração de documentos**
- Puppeteer · Browserless · Sharp

**Integrações externas**
- Google Drive API · Google Apps Script · Groq SDK · LanguageTool

**Infraestrutura**
- Docker

---

## Arquitetura

O projeto segue uma arquitetura modular orientada a domínios com separação clara entre camadas:

```
src/
├── core/
│   ├── config/       # Variáveis de ambiente e cliente Supabase
│   ├── http/         # App Express, roteador central e handler de erros
│   └── infra/        # Serviços de infraestrutura (Apps Script)
│
├── modules/
│   ├── occurrences/  # Ocorrências — regras de negócio, repositório e rotas
│   ├── reports/      # Relatórios diários e geração de PDF
│   │   └── pdf/      # Puppeteer, templates, storage e Drive
│   ├── drivers/      # Cadastro e gestão de motoristas
│   ├── evidences/    # Upload, otimização e metadados de evidências
│   ├── trips/        # Linhas e viagens
│   ├── locais/       # Locais de ocorrência
│   └── ai/           # Correção e sumarização por IA
│
├── validators/       # Schemas Zod reutilizáveis
└── index.ts          # Ponto de entrada
```

**Padrão de cada módulo:** `routes` → `service` → `repo` → Supabase

---

## Como executar

### Pré-requisitos

- Node.js 20+
- Arquivo `.env` configurado (veja abaixo)

### Variáveis de ambiente

```env
PORT=3333
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_SERVICE_ACCOUNT_JSON=
GROQ_API_KEY=
APPS_SCRIPT_URL=
BROWSERLESS_URL=          # opcional
```

### Instalação e desenvolvimento

```bash
npm install
npm run dev
```

### Build e produção

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t gerador-relatorios-api .
docker run -p 3333:3333 --env-file .env gerador-relatorios-api
```

---

## Endpoints

<details>
<summary><strong>Status</strong></summary>

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/` | Informações da API |
| `GET` | `/health` | Health check |

</details>

<details>
<summary><strong>Ocorrências</strong></summary>

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/occurrences?date=YYYY-MM-DD` | Lista ocorrências do dia |
| `POST` | `/occurrences` | Cria ocorrência |
| `GET` | `/occurrences/:id` | Busca ocorrência |
| `PUT` | `/occurrences/:id` | Atualiza ocorrência |
| `DELETE` | `/occurrences/:id` | Remove ocorrência |

</details>

<details>
<summary><strong>Evidências</strong></summary>

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/occurrences/:id/evidences` | Upload de evidências (até 30 arquivos) |
| `GET` | `/occurrences/:id/evidences` | Lista evidências |
| `GET` | `/occurrences/:id/evidences/signed-urls` | URLs de acesso temporário |
| `PATCH` | `/occurrences/:id/evidences/:evidenceId` | Atualiza metadados |

</details>

<details>
<summary><strong>Relatórios e PDF</strong></summary>

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/reports/daily?date=YYYY-MM-DD` | Relatório diário consolidado |
| `GET` | `/reports/occurrences/:id/pdf` | Gera PDF da ocorrência |
| `POST` | `/reports/occurrences/:id/drive` | Exporta PDF para o Google Drive |

</details>

<details>
<summary><strong>Cadastros auxiliares</strong></summary>

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/drivers` | Lista motoristas |
| `POST` | `/drivers` | Cadastra motorista |
| `PATCH` | `/drivers/:id` | Atualiza motorista |
| `DELETE` | `/drivers/:id` | Remove motorista |
| `GET` | `/trips` | Lista viagens |
| `POST` | `/trips` | Cadastra viagem |
| `GET` | `/locais` | Lista locais |

</details>

<details>
<summary><strong>IA</strong></summary>

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/ai/correct` | Corrige texto de ocorrência |
| `POST` | `/ai/summarize` | Gera resumo executivo |

</details>

---

## Destaques de implementação

**Geração de PDF híbrida**
PDFs são renderizados localmente via Puppeteer. Para arquivos acima de 1 MB, a geração é delegada a uma instância Browserless remota, evitando sobrecarga de memória no servidor.

**Pipeline de IA**
O texto de um relato passa por detecção de erros via LanguageTool antes de ser enviado ao Groq (LLaMA 3.3 70B), reduzindo tokens consumidos e aumentando a precisão da correção. A sumarização usa temperatura baixa (0.3) para respostas objetivas.

**Snapshots de motoristas**
Ao vincular um motorista a uma ocorrência, um trigger de banco cria um snapshot imutável dos dados do motorista naquele momento, garantindo integridade histórica dos relatórios.

**Tratamento centralizado de erros**
Um único middleware converte erros do Zod, erros de domínio (`AppError`) e códigos de erro do PostgreSQL (23505, 23503, PGRST116) em respostas HTTP padronizadas.

**Otimização de evidências**
Imagens enviadas são redimensionadas para até 1200px e recomprimidas em JPEG (75–80% de qualidade) antes do armazenamento, equilibrando qualidade e custo de storage.
