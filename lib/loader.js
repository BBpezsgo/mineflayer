const mc = require('minecraft-protocol')
const { EventEmitter } = require('events')
const pluginLoader = require('./plugin_loader')
const plugins = Object.freeze({
  get bed () { return require('./plugins/bed') },
  get title () { return require('./plugins/title') },
  get block_actions () { return require('./plugins/block_actions') },
  get blocks () { return require('./plugins/blocks') },
  get book () { return require('./plugins/book') },
  get boss_bar () { return require('./plugins/boss_bar') },
  get breath () { return require('./plugins/breath') },
  get chat () { return require('./plugins/chat') },
  get chest () { return require('./plugins/chest') },
  get command_block () { return require('./plugins/command_block') },
  get craft () { return require('./plugins/craft') },
  get creative () { return require('./plugins/creative') },
  get digging () { return require('./plugins/digging') },
  get enchantment_table () { return require('./plugins/enchantment_table') },
  get entities () { return require('./plugins/entities') },
  get experience () { return require('./plugins/experience') },
  get explosion () { return require('./plugins/explosion') },
  get fishing () { return require('./plugins/fishing') },
  get furnace () { return require('./plugins/furnace') },
  get game () { return require('./plugins/game') },
  get health () { return require('./plugins/health') },
  get inventory () { return require('./plugins/inventory') },
  get kick () { return require('./plugins/kick') },
  get physics () { return require('./plugins/physics') },
  get place_block () { return require('./plugins/place_block') },
  get rain () { return require('./plugins/rain') },
  get ray_trace () { return require('./plugins/ray_trace') },
  get resource_pack () { return require('./plugins/resource_pack') },
  get scoreboard () { return require('./plugins/scoreboard') },
  get team () { return require('./plugins/team') },
  get settings () { return require('./plugins/settings') },
  get simple_inventory () { return require('./plugins/simple_inventory') },
  get sound () { return require('./plugins/sound') },
  get spawn_point () { return require('./plugins/spawn_point') },
  get tablist () { return require('./plugins/tablist') },
  get time () { return require('./plugins/time') },
  get villager () { return require('./plugins/villager') },
  get anvil () { return require('./plugins/anvil') },
  get place_entity () { return require('./plugins/place_entity') },
  get generic_place () { return require('./plugins/generic_place') },
  get particle () { return require('./plugins/particle') },
  get brewing_stand () { return require('./plugins/brewing_stand') }
})

/**
 * @typedef {keyof plugins} InternalPlugin
 */

const minecraftData = require('minecraft-data')
const { testedVersions, latestSupportedVersion, oldestSupportedVersion } = require('./version')

module.exports = {
  createBot,
  latestSupportedVersion,
  oldestSupportedVersion,
  testedVersions,
  supportFeature: (feature, version) => minecraftData(version).supportFeature(feature)
}

function createBot (options = {}) {
  options.username = options.username ?? 'Player'
  options.version = options.version ?? false
  options.plugins = options.plugins ?? {}
  options.hideErrors = options.hideErrors ?? false
  options.logErrors = options.logErrors ?? true
  options.loadInternalPlugins = options.loadInternalPlugins ?? true
  options.client = options.client ?? null
  options.brand = options.brand ?? 'vanilla'
  options.respawn = options.respawn ?? true
  const bot = new EventEmitter()
  bot._client = options.client
  bot.end = (reason) => bot._client.end(reason)
  if (options.logErrors) {
    bot.on('error', err => {
      if (!options.hideErrors) {
        console.log(err)
      }
    })
  }

  pluginLoader(bot, options)
  const internalPlugins = Object.keys(plugins)
    .filter(key => {
      if (typeof options.plugins[key] === 'function') return false
      if (options.plugins[key] === false) return false
      return options.plugins[key] || options.loadInternalPlugins
    }).map(key => plugins[key])
  const externalPlugins = Object.keys(options.plugins)
    .filter(key => {
      return typeof options.plugins[key] === 'function'
    }).map(key => options.plugins[key])
  bot.loadPlugins([...internalPlugins, ...externalPlugins])

  options.validateChannelProtocol = false
  bot._client = bot._client ?? mc.createClient(options)
  bot._client.on('connect', () => {
    bot.emit('connect')
  })
  bot._client.on('error', (err) => {
    bot.emit('error', err)
  })
  bot._client.on('end', (reason) => {
    bot.emit('end', reason)
  })
  if (!bot._client.wait_connect) next()
  else bot._client.once('connect_allowed', next)
  function next () {
    const serverPingVersion = bot._client.version
    bot.registry = require('prismarine-registry')(serverPingVersion)
    if (!bot.registry?.version) throw new Error(`Server version '${serverPingVersion}' is not supported, no data for version`)

    const versionData = bot.registry.version
    if (versionData['>'](latestSupportedVersion)) {
      throw new Error(`Server version '${serverPingVersion}' is not supported. Latest supported version is '${latestSupportedVersion}'.`)
    } else if (versionData['<'](oldestSupportedVersion)) {
      throw new Error(`Server version '${serverPingVersion}' is not supported. Oldest supported version is '${oldestSupportedVersion}'.`)
    }

    bot.protocolVersion = versionData.version
    bot.majorVersion = versionData.majorVersion
    bot.version = versionData.minecraftVersion
    options.version = versionData.minecraftVersion
    bot.supportFeature = bot.registry.supportFeature
    setTimeout(() => bot.emit('inject_allowed'), 0)
  }
  return bot
}
