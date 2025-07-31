import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWebFonts,
  presetWind4,
} from 'unocss'

export default defineConfig({
  shortcuts: [
    ['btn', 'px-3 py-1 rounded-md bg-gray-200 cursor-pointer dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95'],
  ],
  presets: [
    presetWind4(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
    }),
  ],
})
