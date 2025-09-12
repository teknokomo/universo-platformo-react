---
applyTo: '**'
---
# PNPM... not npm/yarn

We are using PNPM in our current project not npm/yarn.

IMPORTANT: Run PNPM commands ONLY in the root directory of the project.
Do not run commands in packages/server, packages/ui, packages/components directories.
All package management should be handled from the project root.

In this project, running `pnpm dev` takes a lot of resources, use it only if it is absolutely necessary, for example, in complex cases of troubleshooting and only with the user's permission. In all other cases, use `pnpm build`.

This project has complex relationships between individual parts of the project, between individual packages and applications, so use building individual packages, for example `pnpm build --filter publish-frt` only in cases when you need to check the build of this package, check whether the necessary files are created there, to check for errors, and so on. But in order to make the final application of code changes even in one package, always do a full build of the entire project `pnpm build`.
