/**
 * @input synthetic registry files plus mocked sitemap XML responses
 * @output coverage for registry filtering, snapshot normalization, and failure boundaries
 * @pos provider behavior tests for sitemap-watch CLI
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createSitemapClient } from "./provider";

function createRegistryFile(content: unknown) {
  const directory = mkdtempSync(join(tmpdir(), "sitemap-watch-"));
  const file = join(directory, "registry.json");
  writeFileSync(file, JSON.stringify(content, null, 2));
  return { directory, file };
}

function createFetcher(fixtures: Record<string, string>) {
  return (url: string) => {
    const body = fixtures[url];
    if (!body) {
      throw new TypeError("fetch failed");
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      text() {
        return Promise.resolve(body);
      },
    });
  };
}

const directories: string[] = [];

afterEach(() => {
  while (directories.length > 0) {
    const directory = directories.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe("sitemap-watch provider", () => {
  test("lists only active competitors", async () => {
    const registry = createRegistryFile({
      competitors: [
        {
          competitorId: "n8n",
          domain: "n8n.io",
          active: true,
          priority: 1,
          sitemapUrls: ["https://n8n.io/sitemap.xml"],
        },
        {
          competitorId: "zapier",
          domain: "zapier.com",
          active: false,
          priority: 2,
          sitemapUrls: ["https://zapier.com/sitemap.xml"],
        },
      ],
    });
    directories.push(registry.directory);

    const client = createSitemapClient(createFetcher({}));
    const result = await client.listCompetitors({
      registryFile: registry.file,
    });

    expect(result.count).toBe(1);
    expect(result.competitors[0]?.competitorId).toBe("n8n");
  });

  test("expands sitemap index, dedupes pages, and classifies output", async () => {
    const registry = createRegistryFile({
      competitors: [
        {
          competitorId: "n8n",
          domain: "n8n.io",
          active: true,
          priority: 1,
          sitemapUrls: ["https://n8n.io/sitemap.xml"],
          topicRules: [{ pattern: "discord", topicCluster: "discord" }],
        },
      ],
    });
    directories.push(registry.directory);

    const client = createSitemapClient(
      createFetcher({
        "https://n8n.io/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://n8n.io/blog.xml</loc></sitemap>
            <sitemap><loc>https://n8n.io/workflows.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://n8n.io/blog.xml": `
          <urlset>
            <url>
              <loc>https://n8n.io/blog/hello-world/</loc>
              <lastmod>2026-04-10</lastmod>
            </url>
          </urlset>
        `,
        "https://n8n.io/workflows.xml": `
          <urlset>
            <url>
              <loc>https://n8n.io/use-cases/discord-bot/</loc>
            </url>
            <url>
              <loc>https://n8n.io/de/use-cases/discord-agent/</loc>
            </url>
            <url>
              <loc>https://n8n.io/use-cases/discord-bot/</loc>
            </url>
          </urlset>
        `,
      })
    );

    const result = await client.getPages({
      registryFile: registry.file,
      competitor: "n8n",
      capturedAt: "2026-04-12T00:00:00.000Z",
    });

    expect(result.count).toBe(3);
    expect(result.pages).toEqual([
      expect.objectContaining({
        competitorId: "n8n",
        pageType: "blog",
        topicCluster: "unknown",
        url: "https://n8n.io/blog/hello-world/",
      }),
      expect.objectContaining({
        competitorId: "n8n",
        pageType: "use_case",
        topicCluster: "discord",
        url: "https://n8n.io/de/use-cases/discord-agent/",
      }),
      expect.objectContaining({
        competitorId: "n8n",
        pageType: "use_case",
        topicCluster: "discord",
        url: "https://n8n.io/use-cases/discord-bot/",
      }),
    ]);
  });

  test("returns not_found when requested page is absent", async () => {
    const registry = createRegistryFile({
      competitors: [
        {
          competitorId: "n8n",
          domain: "n8n.io",
          active: true,
          priority: 1,
          sitemapUrls: ["https://n8n.io/sitemap.xml"],
        },
      ],
    });
    directories.push(registry.directory);

    const client = createSitemapClient(
      createFetcher({
        "https://n8n.io/sitemap.xml": `
          <urlset>
            <url><loc>https://n8n.io/blog/hello-world/</loc></url>
          </urlset>
        `,
      })
    );

    await expect(
      client.getPage({
        registryFile: registry.file,
        competitor: "n8n",
        url: "https://n8n.io/use-cases/discord-bot/",
        capturedAt: "2026-04-12T00:00:00.000Z",
      })
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  test("fails closed when one sitemap cannot be fetched", async () => {
    const registry = createRegistryFile({
      competitors: [
        {
          competitorId: "n8n",
          domain: "n8n.io",
          active: true,
          priority: 1,
          sitemapUrls: ["https://n8n.io/sitemap.xml"],
        },
      ],
    });
    directories.push(registry.directory);

    const client = createSitemapClient(
      createFetcher({
        "https://n8n.io/sitemap.xml": `
          <sitemapindex>
            <sitemap><loc>https://n8n.io/blog.xml</loc></sitemap>
            <sitemap><loc>https://n8n.io/missing.xml</loc></sitemap>
          </sitemapindex>
        `,
        "https://n8n.io/blog.xml": `
          <urlset>
            <url><loc>https://n8n.io/blog/hello-world/</loc></url>
          </urlset>
        `,
      })
    );

    await expect(
      client.getPages({
        registryFile: registry.file,
        competitor: "n8n",
        capturedAt: "2026-04-12T00:00:00.000Z",
      })
    ).rejects.toMatchObject({
      code: "network_error",
    });
  });
});
