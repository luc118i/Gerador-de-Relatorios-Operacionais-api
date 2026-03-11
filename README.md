🚀 Gerador de Relatórios Operacionais - API
Backend robusto desenvolvido em Node.js e TypeScript para gestão de ocorrências logísticas e geração automatizada de relatórios operacionais.

🛠️ Tecnologias e Ferramentas
Runtime: Node.js v20+

Framework: Express

Linguagem: TypeScript

Banco de Dados: Supabase (PostgreSQL)

Validação: Zod

Processamento de Imagem: Sharp

Geração de Documentos: Puppeteer

Upload de Arquivos: Multer

📂 Estrutura de Pastas
A aplicação segue uma arquitetura modular baseada em domínios:


```
src/
├── core/            # Configurações globais (HTTP, Infra, Env)
├── modules/         # Módulos de negócio independentes
│   ├── drivers/     # Gestão e lógica de motoristas
│   ├── occurrences/ # Repositórios e regras de ocorrências
│   ├── reports/     # Geração de texto e PDF para relatórios
│   └── evidences/   # Manipulação de evidências e metadados
├── validators/      # Schemas de validação de entrada (Zod)
└── index.ts         # Ponto de entrada (Boot da aplicação)
```
⚙️ Como Executar
Pré-requisitos
Node.js instalado

Variáveis de ambiente configuradas no arquivo .env (Supabase URL/Key)

Instalação
Bash
npm install
Desenvolvimento
O projeto utiliza tsx para um ciclo de feedback rápido:

Bash
npm run dev
Produção (Docker)
A API conta com um Dockerfile otimizado que já inclui todas as dependências necessárias para o motor do Puppeteer (Chromium):

Bash
docker build -t gerador-relatorios-api .
docker run -p 3000:3000 gerador-relatorios-api
📡 Endpoints Principais
Relatórios
GET /reports/daily?date=YYYY-MM-DD

Gera um resumo textual formatado de todas as ocorrências do dia.

Exemplo de Resposta:

```JSON

{
  "text": "22367 – JOÃO PAULO – SALVADOR – DESCUMP.OP - 11.03.26...",
  "count": 1
}
```

💡 Detalhes de Implementação
Processamento de Datas: A API trata datas no formato ISO (YYYY-MM-DD) e realiza a conversão automática para o padrão brasileiro (DD/MM/YYYY) na montagem do texto final.

Sanitização: Implementada via regex e Zod para garantir que filtros de data sejam sempre válidos antes de atingirem a camada de serviço.

Relatórios Customizados: O reports.service.ts formata blocos de texto prontos para uso operacional, incluindo lógica para múltiplos motoristas por veículo.