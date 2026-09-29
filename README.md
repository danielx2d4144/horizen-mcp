# Horizen Docs MCP Server

A stdio MCP server that exposes one read-only tool per Horizen documentation page.

## Install

```bash
npm install
```

### Use anywhere on your machine

Install it globally once or link it locally:

```bash
npm install -g .
```

or

```bash
npm link
```

After that, the command `horizen-docs-mcp` is available in any workspace.

## Run

```bash
npm start
```

Or, when installed globally or linked:

```bash
horizen-docs-mcp
```

## What it does

- Loads `horizen-documentation-toolset.mci.json`
- Registers each page as an MCP tool
- Fetches the page over HTTP and returns cleaned text for the model

## Notes

- The server is read-only.
- Tool names and descriptions come from the MCI toolset file.
- Override the bundled toolset with `HORIZEN_TOOLSET_PATH` if you want to point the server at a different `.mci.json` file.
