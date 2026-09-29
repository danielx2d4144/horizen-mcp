import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolsetPath = path.resolve(__dirname, '..', 'horizen-documentation-toolset.mci.json');

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(text) {
  const m = text.match(/([^.!?]+[.!?])\s*/);
  return m ? m[1].trim() : text.trim();
}

function firstParagraphAfterH1(html) {
  const h1Match = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i);
  let rest = html;
  if (h1Match) {
    rest = html.slice(html.indexOf(h1Match[0]) + h1Match[0].length);
  }
  const pMatch = rest.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (pMatch && pMatch[1]) return stripHtml(pMatch[1]);
  // fallback: first sentence from the rest
  const stripped = stripHtml(rest);
  return firstSentence(stripped);
}

async function main() {
  const raw = await fs.readFile(toolsetPath, 'utf8');
  const parsed = JSON.parse(raw);
  const tools = parsed.tools || [];
  console.log('Tools available:', tools.length);

  const multisigTool = tools.find(t => t.name === 'horizen_overview_multisig_wallets');
  if (!multisigTool) {
    console.error('Multisig tool not found in toolset');
    process.exit(2);
  }

  console.log('Found multisig tool:', multisigTool.name);
  const url = multisigTool.execution?.url;
  if (!url) {
    console.error('No URL for multisig tool');
    process.exit(3);
  }

  const res = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!res.ok) {
    console.error('Failed to fetch page:', res.status, res.statusText);
    process.exit(4);
  }
  const html = await res.text();
  const sentence = firstParagraphAfterH1(html);
  console.log('First sentence on Multisig Wallets page:');
  console.log(sentence);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
