import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prototype 100 % côté client (données fictives en localStorage) :
  // pas besoin de cacheComponents / partialPrefetching.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
