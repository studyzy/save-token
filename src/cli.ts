#!/usr/bin/env node
import cac from 'cac'
import { version } from '../package.json'
import { setupCommands } from './cli-setup'

async function main(): Promise<void> {
  const cli = cac('st')
  await setupCommands(cli)
  cli.version(version)
  cli.help()
  cli.parse()
}

main().catch(console.error)
