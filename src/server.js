#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const toolsetPath = process.env.HORIZEN_TOOLSET_PATH
  ? path.resolve(process.env.HORIZEN_TOOLSET_PATH)
  : path.join(projectRoot, 'horizen-documentation-toolset.mci.json');

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return stripHtml(titleMatch[1]);
  }

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) {
    return stripHtml(h1Match[1]);
  }

  return '';
}

function pageTextFromHtml(url, html) {
  const title = htmlTitle(html);
  const text = stripHtml(html);
  const body = text.length > 20000 ? `${text.slice(0, 20000)}...` : text;

  return [
    `URL: ${url}`,
    title ? `Title: ${title}` : null,
    '',
    body
  ].filter(Boolean).join('\n');
}

async function loadToolset() {
  const raw = await fs.readFile(toolsetPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed?.tools || !Array.isArray(parsed.tools)) {
    throw new Error('Horizen toolset JSON is missing a tools array.');
  }
  return parsed.tools;
}

function toMcpTool(tool) {
  return {
    name: tool.name,
    description: tool.description || tool.annotations?.title || tool.name,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  };
}

async function fetchToolResult(tool) {
  const execution = tool.execution || {};
  if (execution.type !== 'http' || !execution.url) {
    throw new Error(`Tool ${tool.name} is not configured for HTTP page fetches.`);
  }

  const response = await fetch(execution.url, {
    method: execution.method || 'GET',
    headers: {
      Accept: 'text/html',
      ...(execution.headers || {})
    }
  });

  const text = await response.text();
  if (!response.ok) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Request failed for ${execution.url}: ${response.status} ${response.statusText}`
        }
      ]
    };
  }

  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: pageTextFromHtml(execution.url, text)
      }
    ]
  };
}

async function main() {
  const tools = await loadToolset();
  const toolByName = new Map(tools.map((tool) => [tool.name, tool]));

  const server = new Server(
    {
      name: 'horizen-docs-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(toMcpTool)
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = toolByName.get(request.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${request.params.name}`
          }
        ]
      };
    }

    return fetchToolResult(tool);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Horizen Docs MCP server failed to start:', error);
  process.exit(1);
});
