# @deniffer/google-ads-cli

Google Ads raw-data CLI for product growth and paid search workflows.

```bash
bunx @deniffer/google-ads-cli --schema
bunx @deniffer/google-ads-cli doctor dataset readiness --pretty
```

Install the Python provider dependencies before live Google Ads queries:

```bash
bun run provider:install
```

Credentials are loaded from CLI flags or local environment files. Do not commit credentials.
