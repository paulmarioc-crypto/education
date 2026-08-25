// Live retrieval against NCBI's public PubMed E-utilities (no API key
// required for this volume of use). Grounds AI-generated case content in
// real, current, peer-reviewed literature instead of pure model recall.
//
// This is best-effort by design: PubMed being slow, rate-limited, or having
// nothing relevant for a topic must never break case generation — every
// failure path here returns [] and the caller falls back to ungrounded
// generation with an explicit "no sources" instruction.

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export interface PubMedSource {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  abstract: string;
}

interface ESearchResponse {
  esearchresult?: { idlist?: string[] };
}

interface ESummaryResponse {
  result?: Record<string, { title?: string; fulljournalname?: string; source?: string; pubdate?: string }>;
}

function stripXmlTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses efetch's abstract XML into {pmid -> abstract text}, tolerating shape drift. */
function parseAbstracts(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const articles = xml.split("<PubmedArticle>").slice(1);
  for (const block of articles) {
    const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch) continue;
    const abstractParts = [...block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) =>
      stripXmlTags(m[1])
    );
    if (abstractParts.length > 0) {
      out[pmidMatch[1]] = abstractParts.join(" ");
    }
  }
  return out;
}

export async function searchPubMed(query: string, maxResults = 4): Promise<PubMedSource[]> {
  try {
    const searchUrl = `${EUTILS_BASE}/esearch.fcgi?db=pubmed&retmode=json&retmax=${maxResults}&sort=relevance&term=${encodeURIComponent(query)}`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
    if (!searchRes.ok) return [];
    const searchJson = (await searchRes.json()) as ESearchResponse;
    const ids = searchJson.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    const [summaryRes, abstractRes] = await Promise.all([
      fetch(`${EUTILS_BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`, { signal: AbortSignal.timeout(8000) }),
      fetch(`${EUTILS_BASE}/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&id=${ids.join(",")}`, { signal: AbortSignal.timeout(8000) }),
    ]);

    const summaryJson = summaryRes.ok ? ((await summaryRes.json()) as ESummaryResponse) : {};
    const abstractXml = abstractRes.ok ? await abstractRes.text() : "";
    const abstractsById = parseAbstracts(abstractXml);

    return ids
      .map((id): PubMedSource => {
        const s = summaryJson.result?.[id];
        return {
          pmid: id,
          title: s?.title ?? "(untitled)",
          journal: s?.fulljournalname ?? s?.source ?? "",
          year: (s?.pubdate ?? "").slice(0, 4),
          abstract: (abstractsById[id] ?? "").slice(0, 1500),
        };
      })
      .filter((s) => s.abstract.length > 0);
  } catch (err) {
    console.warn("PubMed retrieval failed, falling back to ungrounded generation:", err);
    return [];
  }
}
