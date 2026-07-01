import { beforeAll } from 'vitest'
import { initI18n } from '../src/i18n'

beforeAll(async () => {
  await initI18n('en')
})
