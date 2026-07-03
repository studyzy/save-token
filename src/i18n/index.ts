import type { i18n as I18nInstance } from 'i18next'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import i18next from 'i18next'
import Backend from 'i18next-fs-backend'
import { dirname, join } from 'pathe'

export type SupportedLang = 'zh-CN' | 'en'

export const i18n: I18nInstance = i18next.createInstance()

const NAMESPACES = ['common', 'errors'] as const

export function ensureI18nInitialized(): void {
  if (!i18n.isInitialized) {
    throw new Error(
      'i18n is not initialized. Call initI18n() in CLI command before using utility functions.',
    )
  }
}

export async function initI18n(language: SupportedLang = 'zh-CN'): Promise<void> {
  if (i18n.isInitialized) {
    if (i18n.language !== language) {
      await i18n.changeLanguage(language)
    }
    return
  }

  await i18n.use(Backend).init({
    lng: language,
    fallbackLng: 'en',
    ns: NAMESPACES,
    defaultNS: 'common',
    preload: [language],
    backend: {
      loadPath: (() => {
        const currentDir = dirname(fileURLToPath(import.meta.url))
        const possibleBasePaths = [
          join(currentDir, 'locales'),
          join(process.cwd(), 'dist/i18n/locales'),
          join(currentDir, '../../../dist/i18n/locales'),
          join(currentDir, '../../i18n/locales'),
        ]
        for (const basePath of possibleBasePaths) {
          const testFile = join(basePath, 'zh-CN/common.json')
          if (existsSync(testFile)) {
            return join(basePath, '{{lng}}/{{ns}}.json')
          }
        }
        return join(process.cwd(), 'dist/i18n/locales/{{lng}}/{{ns}}.json')
      })(),
    },
    interpolation: { escapeValue: false },
    keySeparator: false,
    nsSeparator: ':',
    debug: false,
  })

  for (const ns of NAMESPACES) {
    if (ns !== 'common') {
      await i18n.loadNamespaces(ns)
    }
  }
}

export async function changeLanguage(lng: SupportedLang): Promise<void> {
  await i18n.changeLanguage(lng)
}

export function getCurrentLanguage(): SupportedLang {
  return i18n.language as SupportedLang
}

export function format(template: string, values?: Record<string, string>): string {
  if (!values) return template
  return Object.keys(values).reduce(
    (result, key) => result.replace(new RegExp(`{${key}}`, 'g'), values[key]),
    template,
  )
}
