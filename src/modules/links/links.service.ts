// Encurta URLs via TinyURL — usado pro link do relatório (Drive) que vai
// junto de cada ocorrência no relatório diário pros gestores (WhatsApp).
// Roda no backend (não no browser) porque o endpoint público do TinyURL não
// manda header CORS — chamar direto do front trava na resposta.
//
// Cache em memória (processo do servidor) — evita rechamar o TinyURL pro
// mesmo link a cada relatório gerado no mesmo dia.
const cache = new Map<string, string>();

export async function shortenUrl(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached) return cached;

  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`TinyURL respondeu ${res.status}`);
    const short = (await res.text()).trim();
    // TinyURL às vezes devolve HTML de erro em vez do link — se não parecer
    // uma URL válida, cai pro link original (nunca quebra o envio por isso).
    if (!/^https?:\/\//.test(short)) throw new Error("resposta inesperada do TinyURL");
    cache.set(url, short);
    return short;
  } catch (err) {
    console.warn("[links] falha ao encurtar, mandando link original:", err);
    return url;
  }
}
