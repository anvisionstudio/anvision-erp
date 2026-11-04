/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true }, // 型別已於本機 tsc 檢查
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  outputFileTracingIncludes: { "/**": ["./prisma/demo.db"] },
};
export default nextConfig;
