import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import neon from './neon-vite-plugin.ts'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    rolldownOptions: {
      // Base UI ships 'use client' directives for React Server Components. This app doesn't use RSC, so the
      // bundler can't keep them and warns hundreds of times. Hide only that warning; everything else still logs.
      onLog(level, log, defaultHandler) {
        if (log.code === 'MODULE_LEVEL_DIRECTIVE') return
        defaultHandler(level, log)
      },
    },
  },
  plugins: [
    devtools(),
    nitro(),
    neon,
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})

export default config
