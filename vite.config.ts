import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import http from 'node:http'
import https from 'node:https'
import type { Plugin } from 'vite'

// Vite dev middleware：拦截 /v1/embeddings 请求，
// 从 x-embedding-target 头读取用户配置的外部 API，动态代理过去。
// 这样 dev 模式下浏览器只请求同源 Vite，彻底绕过 CORS。
function embeddingProxyPlugin(): Plugin {
  return {
    name: 'embedding-proxy',
    configureServer(server) {
      server.middlewares.use('/v1/embeddings', (req, res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const headers = req.headers as Record<string, string>
        const target = headers['x-embedding-target']

        console.log('[embedding-proxy] 收到请求:', { target, method: req.method })

        if (!target) {
          res.statusCode = 400
          res.end('Missing x-embedding-target header')
          return
        }

        try {
          const urlObj = new URL(target)
          console.log('[embedding-proxy] 解析 URL:', { hostname: urlObj.hostname, path: urlObj.pathname })

          const client = urlObj.protocol === 'https:' ? https.request : http.request

          // 使用解构排除要删除的 header，再用 rest 构建新对象
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { origin, referer, host: _origHost, 'x-embedding-target': _removed, ...forwardHeaders } = headers

          // 浏览器固定请求 /v1/embeddings，target 包含完整 base path（如 /v1 或 /compatible-mode/v1）
          // 用 target.pathname + /embeddings 拼接，避免路径重复
          const targetPath = urlObj.pathname.replace(/\/$/, '') + '/embeddings'
          console.log('[embedding-proxy] 实际转发 path:', targetPath)

          // 收集请求体后再转发
          const chunks: Buffer[] = []
          req.on('data', chunk => chunks.push(chunk))
          req.on('end', () => {
            const rawBody = Buffer.concat(chunks)

            const proxyReq = client({
              hostname: urlObj.hostname,
              port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
              path: targetPath,
              method: req.method,
              headers: {
                ...forwardHeaders,
                host: urlObj.host,
              },
            }, (proxyRes) => {
              console.log('[embedding-proxy] 收到响应:', proxyRes.statusCode)
              res.writeHead(proxyRes.statusCode!, proxyRes.headers)
              proxyRes.pipe(res)
            })

            proxyReq.on('error', (err) => {
              console.error('[embedding-proxy] 代理错误:', err)
              res.statusCode = 502
              res.end('Proxy error: ' + err.message)
            })

            proxyReq.write(rawBody)
            proxyReq.end()
          })
        } catch (err) {
          console.error('[embedding-proxy] 配置错误:', err)
          res.statusCode = 500
          res.end('Config error: ' + (err as Error).message)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), embeddingProxyPlugin()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5400,
    proxy: {
      '/ws': {
        target: 'ws://localhost:5300',
        ws: true,
        timeout: 300_000,
      },
    },
  },
})
