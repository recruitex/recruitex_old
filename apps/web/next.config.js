/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ['@repo/ui'],
  experimental: {
    reactCompiler: true,
    ppr: 'incremental',
    after: true,
  },
};
