<!-- markdownlint-disable MD030 -->

# Flowise - Low-Code LLM apps builder

![Flowise](https://github.com/FlowiseAI/Flowise/blob/main/images/flowise.gif?raw=true)

Drag & drop UI to build your customized LLM flow

## ⚡Quick Start

1. Install Flowise
    ```bash
    npm install -g flowise
    ```
2. Start Flowise

    ```bash
    npx flowise start
    ```

3. Open [http://localhost:3000](http://localhost:3000)

## 🔒 Authentication

Universo Platformo now relies on Passport.js sessions backed by Supabase. Add the following variables to `packages/flowise-server/.env` (or provide them via CLI flags) to enable the built-in login flow exposed at `/api/v1/auth`:

```
SESSION_SECRET=replace-with-strong-secret
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=public-anon-key
SUPABASE_JWT_SECRET=service-jwt-secret
```

Optional cookie hardening:

```
SESSION_COOKIE_NAME=up.session
SESSION_COOKIE_MAXAGE=86400000
SESSION_COOKIE_SAMESITE=lax
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_PARTITIONED=false
```

- Use `SESSION_COOKIE_PARTITIONED=true` when deploying behind cross-site iframes in Chrome Privacy Sandbox.
- Setting `SESSION_COOKIE_SAMESITE=none` automatically forces `SESSION_COOKIE_SECURE=true`.

## 🌱 Env Variables

Flowise support different environment variables to configure your instance. You can specify the following variables in the `.env` file inside `packages/flowise-server` folder. Read [more](https://github.com/FlowiseAI/Flowise/blob/main/CONTRIBUTING.md#-env-variables)

You can also specify the env variables when using `npx`. For example:

```
npx flowise start --PORT=3000 --DEBUG=true
```

## � Production Deployment with Rate Limiting

For production deployments with Redis-based rate limiting, refer to the comprehensive guide:

**[Rate Limiting Deployment Guide](../universo-utils/base/DEPLOYMENT.md)**

This guide covers:
-   Redis configuration and connection setup (`REDIS_URL`)
-   Docker, Kubernetes, and PM2 deployment examples
-   Health checks and monitoring
-   Troubleshooting common issues (connection timeouts, high 429 errors, memory leaks)
-   Security best practices (TLS, authentication, network isolation)

Quick start: Set `REDIS_URL` environment variable to enable distributed rate limiting across multiple instances:

```bash
# Development (local Redis)
REDIS_URL=redis://localhost:6379

# Production with authentication
REDIS_URL=redis://:your-password@redis.example.com:6379

# TLS-enabled (recommended for production)
REDIS_URL=rediss://:your-password@redis.example.com:6380
```

## �📖 Tests

We use [Cypress](https://github.com/cypress-io) for our e2e testing. If you want to run the test suite in dev mode please follow this guide:

```sh
cd Flowise/packages/flowise-server
pnpm install
./node_modules/.bin/cypress install
pnpm build
#Only for writting new tests on local dev -> pnpm run cypress:open
pnpm run e2e
```

## 📖 Documentation

[Flowise Docs](https://docs.flowiseai.com/)

## 🌐 Self Host

-   [AWS](https://docs.flowiseai.com/deployment/aws)
-   [Azure](https://docs.flowiseai.com/deployment/azure)
-   [Digital Ocean](https://docs.flowiseai.com/deployment/digital-ocean)
-   [GCP](https://docs.flowiseai.com/deployment/gcp)
-   <details>
      <summary>Others</summary>

    -   [Railway](https://docs.flowiseai.com/deployment/railway)

        [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/pn4G8S?referralCode=WVNPD9)

    -   [Render](https://docs.flowiseai.com/deployment/render)

        [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://docs.flowiseai.com/deployment/render)

    -   [HuggingFace Spaces](https://docs.flowiseai.com/deployment/hugging-face)

        <a href="https://huggingface.co/spaces/FlowiseAI/Flowise"><img src="https://huggingface.co/datasets/huggingface/badges/raw/main/open-in-hf-spaces-sm.svg" alt="HuggingFace Spaces"></a>

    -   [Elestio](https://elest.io/open-source/flowiseai)

        [![Deploy on Elestio](https://elest.io/images/logos/deploy-to-elestio-btn.png)](https://elest.io/open-source/flowiseai)

    -   [Sealos](https://cloud.sealos.io/?openapp=system-template%3FtemplateName%3Dflowise)

        [![](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://cloud.sealos.io/?openapp=system-template%3FtemplateName%3Dflowise)

    -   [RepoCloud](https://repocloud.io/details/?app_id=29)

        [![Deploy on RepoCloud](https://d16t0pc4846x52.cloudfront.net/deploy.png)](https://repocloud.io/details/?app_id=29)

      </details>

## ☁️ Flowise Cloud

[Get Started with Flowise Cloud](https://flowiseai.com/)

## 🙋 Support

Feel free to ask any questions, raise problems, and request new features in [discussion](https://github.com/FlowiseAI/Flowise/discussions)

## 🙌 Contributing

See [contributing guide](https://github.com/FlowiseAI/Flowise/blob/master/CONTRIBUTING.md). Reach out to us at [Discord](https://discord.gg/jbaHfsRVBW) if you have any questions or issues.

## 📄 License

Source code in this repository is made available under the Apache License Version 2.0.
