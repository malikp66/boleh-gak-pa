import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  // Upgrade to a paid plan to enable AI Gateway for your project.
  // aiGateway: true,
  buckets: {
    neon: { access: "private" },
  },
  functions: {
    api: { name: "api", source: "./hello.ts" },
  },
});
