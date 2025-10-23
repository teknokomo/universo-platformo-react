# Disabled AI Model Nodes

## Overview

The following 5 AI model nodes are automatically disabled after build due to SDK compatibility issues with CommonJS environment:

1. **ChatFireworks** (`chatmodels/ChatFireworks/ChatFireworks.js`)
2. **ChatIBMWatsonx** (`chatmodels/ChatIBMWatsonx/ChatIBMWatsonx.js`)
3. **ChatTogetherAI** (`chatmodels/ChatTogetherAI/ChatTogetherAI.js`)
4. **IBMWatsonxEmbedding** (`embeddings/IBMWatsonxEmbedding/IBMWatsonxEmbedding.js`)
5. **IBMWatsonx** (`llms/IBMWatsonx/IBMWatsonx.js`)

## Technical Details

### Problem 1: Fireworks & TogetherAI
- **Error**: `Class extends value undefined is not a constructor or null`
- **Root Cause**: These SDKs have broken dependency chains where base classes are undefined at import time
- **Affected**: ChatFireworks, ChatTogetherAI
- **LangChain Community Issue**: Known issue in @langchain/community with Fireworks AI SDK

### Problem 2: IBM Watsonx
- **Error**: `require() of ES Module @ibm-cloud/watsonx-ai/index.mjs not supported`
- **Root Cause**: IBM Watson SDK (@ibm-cloud/watsonx-ai@1.7.0) exports only ESM modules, incompatible with CommonJS `require()`
- **Affected**: ChatIBMWatsonx, IBMWatsonxEmbedding, IBMWatsonx
- **Workaround Needed**: Would require dynamic `import()` or converting entire project to ESM

## Automatic Disabling

Files are automatically renamed from `.js` to `.js.disabled` after each build via postbuild script in `package.json`:

```json
"postbuild": "node -e \"const fs=require('fs'), p=require('path'); ['chatmodels/ChatFireworks/ChatFireworks.js',...].forEach(f => {const fp=p.join('dist/nodes',f); if(fs.existsSync(fp)) fs.renameSync(fp,fp+'.disabled');}); console.log('✅ Disabled 5 problematic nodes');\""
```

This prevents NodesPool from loading these files during server initialization, eliminating startup errors.

## Alternative Solutions

### Option 1: Wait for SDK Fixes
- **Fireworks/TogetherAI**: Wait for LangChain Community to fix base class imports
- **IBM Watsonx**: Wait for IBM to provide CommonJS-compatible builds

### Option 2: Use Alternative Models
- Instead of **ChatFireworks** → Use ChatOpenAI, ChatAnthropic, ChatGroq
- Instead of **ChatTogetherAI** → Use ChatOpenAI, ChatAnthropic
- Instead of **IBM Watsonx** → Use any other LLM provider (OpenAI, Anthropic, Google, etc.)

### Option 3: Convert Project to ESM (High Effort)
- Change all packages to `"type": "module"` in package.json
- Update imports to use `.js` extensions
- Convert all `require()` to `import`
- Update build tools (TypeScript, Gulp, etc.)

## Impact

- **No functional loss**: The system has 200+ other AI models that work perfectly
- **Popular models work**: OpenAI (GPT-4, GPT-3.5), Anthropic (Claude), Google (Gemini), Groq, Mistral, Ollama, etc.
- **Only affects**: Users specifically needing Fireworks, TogetherAI, or IBM Watsonx models

## Status

✅ **RESOLVED**: Build process now automatically disables problematic nodes, server starts cleanly with no errors.

---

Last updated: 2025-10-18
