/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '5mb',
        },
    },
    webpack: (config, { isServer, nextRuntime }) => {
        // Supress "A Node.js API is used..." warnings for Edge Runtime
        if (nextRuntime === 'edge') {
            config.resolve.alias = {
                ...config.resolve.alias,
                'bufferutil': false,
                'utf-8-validate': false,
            };
        }
        return config;
    },
};

export default nextConfig;
