import {
  Bot,
  Braces,
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  GitBranch,
  ImageUp,
  Layers3,
  Route,
  ShieldCheck,
  Sparkles,
  Cpu,
  HardDrive,
} from "lucide-react";

const modules = [
  {
    title: "Ocorrências",
    text: "CRUD operacional com validação Zod, snapshot imutável de motoristas, derivação de base e notificação externa via webhook para parada fora do programado.",
    icon: Route,
  },
  {
    title: "Evidências",
    text: "Upload multipart em memória, limite de 30 arquivos, metadados por evidência, URL assinada com TTL configurável e edição de legenda.",
    icon: ImageUp,
  },
  {
    title: "Relatórios PDF",
    text: "Renderização HTML com Puppeteer, compressão de imagens com Sharp, cache no Supabase Storage e exportação para Google Drive.",
    icon: FileText,
  },
  {
    title: "IA operacional",
    text: "Revisão gramatical controlada e resumo executivo usando Groq (LLaMA 3.3 70B), com foco em preservar o significado e a estrutura HTML do relato.",
    icon: Bot,
  },
];

const endpoints = [
  ["GET", "/health", "Verifica disponibilidade da API."],
  ["GET", "/occurrences?date=YYYY-MM-DD", "Lista ocorrências por data operacional."],
  ["POST", "/occurrences", "Cria ocorrência com motoristas, dados da viagem e campos customizados."],
  ["PUT", "/occurrences/:id", "Atualiza a ocorrência mantendo as mesmas regras de validação."],
  ["DELETE", "/occurrences/:id", "Remove uma ocorrência."],
  ["POST", "/occurrences/:id/evidences", "Envia até 30 arquivos com metadados opcionais."],
  ["GET", "/reports/daily?date=YYYY-MM-DD", "Gera resumo textual diário das ocorrências."],
  ["GET", "/reports/occurrences/:id/pdf", "Gera ou reutiliza PDF cacheado com URL assinada."],
  ["POST", "/reports/occurrences/:id/drive", "Publica o PDF no Google Drive."],
  ["POST", "/ai/correct", "Corrige texto HTML de relato operacional."],
  ["POST", "/ai/summarize", "Gera resumo executivo em até três frases."],
  ["GET", "/drivers", "Busca motoristas ativos por nome, código ou base."],
  ["GET", "/trips", "Busca linhas e viagens cadastradas."],
  ["GET", "/locais", "Busca locais operacionais."],
];

const stack = [
  "Node.js 20+",
  "Express 5",
  "TypeScript 5.9",
  "Zod",
  "Supabase / PostgreSQL",
  "Supabase Storage",
  "Puppeteer",
  "Browserless",
  "Sharp",
  "Google Drive API",
  "Groq SDK",
  "LanguageTool",
];

const highlights = [
  "Separação por domínio em modules/, com rotas, services, repositórios e schemas independentes.",
  "Contratos de entrada validados com Zod antes de chegar na camada de negócio.",
  "Tratamento centralizado para erros Zod, AppError e códigos comuns do Postgres/Supabase.",
  "Fluxo de PDF com cache, TTL configurável e limite defensivo de evidências por upload.",
  "Integrações externas isoladas em infra/services para facilitar substituição e testes.",
];

const decisions = [
  {
    icon: HardDrive,
    title: "PDF híbrido",
    text: "Chrome local via Puppeteer para arquivos pequenos. Para PDFs acima de 1 MB, a geração é delegada a uma instância Browserless remota, evitando pico de memória no servidor.",
  },
  {
    icon: Database,
    title: "Snapshot de motoristas",
    text: "Ao vincular um motorista a uma ocorrência, um trigger de banco grava um snapshot imutável dos dados naquele instante, garantindo integridade histórica mesmo após atualizações cadastrais.",
  },
  {
    icon: Cpu,
    title: "Pipeline de IA em dois estágios",
    text: "O texto passa primeiro pelo LanguageTool, que detecta os erros. Somente os trechos problemáticos são enviados ao Groq, reduzindo tokens consumidos e aumentando a precisão da correção.",
  },
  {
    icon: Cloud,
    title: "Cache inteligente de PDF",
    text: "PDFs gerados são armazenados no Supabase Storage com URL assinada. Solicitações repetidas reutilizam o arquivo em cache, evitando renderizações desnecessárias.",
  },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Navegação da documentação">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            API
          </div>
          <div>
            <strong>API Docs</strong>
            <span>Relatórios Operacionais</span>
          </div>
        </div>

        <nav>
          <a href="#visao">Visão</a>
          <a href="#arquitetura">Arquitetura</a>
          <a href="#endpoints">Endpoints</a>
          <a href="#payload">Payload</a>
          <a href="#decisoes">Decisões</a>
        </nav>
      </aside>

      <section className="content">
        <header className="hero" id="visao">
          <div className="hero-copy">
            <p className="eyebrow">Documentação técnica</p>
            <h1>Gerador de Relatórios Operacionais API</h1>
            <p>
              Backend em Node.js e TypeScript para registrar ocorrências
              operacionais, anexar evidências, gerar PDFs formais e apoiar a
              revisão de relatos com inteligência artificial. Integra Supabase,
              Google Drive e Groq em uma arquitetura modular orientada a
              domínios.
            </p>
          </div>

          <div className="scoreboard" aria-label="Resumo técnico">
            <div>
              <strong>14+</strong>
              <span>rotas mapeadas</span>
            </div>
            <div>
              <strong>6</strong>
              <span>domínios principais</span>
            </div>
            <div>
              <strong>30</strong>
              <span>evidências por upload</span>
            </div>
          </div>
        </header>

        <section className="panel" id="arquitetura">
          <div className="section-title">
            <Layers3 aria-hidden />
            <div>
              <p className="eyebrow">Arquitetura</p>
              <h2>Organização modular orientada ao domínio</h2>
            </div>
          </div>

          <div className="module-grid">
            {modules.map((item) => {
              const Icon = item.icon;
              return (
                <article className="module-card" key={item.title}>
                  <Icon aria-hidden />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="split">
          <div className="panel">
            <div className="section-title">
              <Database aria-hidden />
              <div>
                <p className="eyebrow">Stack</p>
                <h2>Tecnologias utilizadas</h2>
              </div>
            </div>
            <div className="chips">
              {stack.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="section-title">
              <ShieldCheck aria-hidden />
              <div>
                <p className="eyebrow">Qualidade</p>
                <h2>Boas práticas visíveis no código</h2>
              </div>
            </div>
            <ul className="check-list">
              {highlights.map((item) => (
                <li key={item}>
                  <CheckCircle2 aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel" id="endpoints">
          <div className="section-title">
            <Braces aria-hidden />
            <div>
              <p className="eyebrow">Contrato HTTP</p>
              <h2>Endpoints principais</h2>
            </div>
          </div>

          <div className="endpoint-table">
            {endpoints.map(([method, path, description]) => (
              <div className="endpoint-row" key={`${method}-${path}`}>
                <code className={`method ${method.toLowerCase()}`}>
                  {method}
                </code>
                <code className="path">{path}</code>
                <span>{description}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" id="payload">
          <div className="section-title">
            <GitBranch aria-hidden />
            <div>
              <p className="eyebrow">Exemplo real</p>
              <h2>Payload de criação de ocorrência</h2>
            </div>
          </div>

          <pre className="code-block">
            <code>{`POST /occurrences
{
  "typeCode": "DESCUMP_OP_PARADA_FORA",
  "eventDate": "2026-05-08",
  "tripDate": "2026-05-08",
  "startTime": "13:20",
  "endTime": "13:45",
  "vehicleNumber": "22367",
  "tripId": "LINHA-001",
  "place": "Terminal Rodoviário",
  "drivers": [
    {
      "position": 1,
      "driverId": "uuid-do-motorista"
    }
  ]
}`}</code>
          </pre>
        </section>

        <section className="decisions-section" id="decisoes">
          <div className="decisions-header">
            <Sparkles aria-hidden />
            <div>
              <p className="eyebrow">Engenharia</p>
              <h2>Decisões de arquitetura</h2>
              <p>
                Escolhas técnicas que moldam o comportamento do sistema em
                produção — onde cada decisão reflete uma restrição real ou um
                problema concreto.
              </p>
            </div>
          </div>

          <div className="decisions-grid">
            {decisions.map((item) => {
              const Icon = item.icon;
              return (
                <article className="decision-card" key={item.title}>
                  <Icon aria-hidden />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
