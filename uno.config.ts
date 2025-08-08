import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWebFonts,
  presetWind4,
} from 'unocss'

export default defineConfig({
  shortcuts: [
    ['click-feedback', 'transition-all duration-200 active:scale-95'],
    ['btn', 'px-3 py-1 rounded-md bg-gray-200 cursor-pointer dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 click-feedback disabled:opacity-50'],
    ['ipt', 'bg-gray-200 dark:bg-gray-800 px2 border-1 border-gray-500 rounded-md outline-none hover:bg-gray-300 dark:hover:bg-gray-700 click-feedback disabled:opacity-50'],
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
