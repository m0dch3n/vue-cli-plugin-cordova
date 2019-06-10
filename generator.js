const fs = require('fs')
const hasbin = require('hasbin')
const defaults = require('./defaults')
const spawn = require('cross-spawn')
const { info } = require('@vue/cli-shared-utils')

module.exports = (api, options) => {
  // early return if cordova binary is not found
  const hasCordova = hasbin.sync('cordova')
  if (!hasCordova) {
    api.exitLog(`Unable to find cordova binary, make sure it's installed.`, 'error')
    return
  }

  // cordova options
  const cordovaPath = options.cordovaPath || defaults.cordovaPath
  const id = options.id || defaults.id
  const appName = options.appName || defaults.appName
  const platforms = options.platforms || defaults.platforms
  const cordovaConfigPaths = {}
  defaults.platforms.forEach((platform) => {
    const platformPath = defaults.cordovaConfigPaths[platform]
    if (platformPath) {
      cordovaConfigPaths[platform] = platformPath.replace(/VueExampleAppName/, appName)
    }
  })

  api.extendPackage({
    scripts: {
      'cordova-serve-android': 'vue-cli-service cordova-serve-android',
      'cordova-build-android': 'vue-cli-service cordova-build-android',
      'cordova-serve-ios': 'vue-cli-service cordova-serve-ios',
      'cordova-build-ios': 'vue-cli-service cordova-build-ios',
      'cordova-serve-browser': 'vue-cli-service cordova-serve-browser',
      'cordova-build-browser': 'vue-cli-service cordova-build-browser',
      'cordova-serve-osx': 'vue-cli-service cordova-serve-osx',
      'cordova-build-osx': 'vue-cli-service cordova-build-osx',
      'cordova-prepare': 'vue-cli-service cordova-prepare'
    },
    vue: {
      publicPath: '',
      pluginOptions: {
        cordovaPath,
        cordovaConfigPaths
      }
    }
  })

  api.postProcessFiles(files => {
    const hasTS = api.hasPlugin('typescript')

    // router
    if (api.hasPlugin('router')) {
      let cordovaRouterMode = `process.env.CORDOVA_PLATFORM ? 'hash' : `
      const routerFilePath = `src/router.${hasTS ? 'ts' : 'js'}`
      const routerFile = files[routerFilePath]
      if (routerFile) {
        const lines = routerFile.split(/\r?\n/g).reverse()
        const regex = /\s+mode:\s('|"?\w+'|"?)/
        const modeIndex = lines.findIndex(line => line.match(regex))
        if (modeIndex >= 0) {
          const matches = lines[modeIndex].match(regex)
          const routerMode = matches[1]
          if (routerMode.includes('"')) {
            cordovaRouterMode = cordovaRouterMode.replace(`'hash'`, `"hash"`)
          }
          const newRouterMode = cordovaRouterMode + routerMode
          lines[modeIndex] = lines[modeIndex].replace(routerMode, newRouterMode)
          api.exitLog('Updated ' + routerFilePath + ' : ' + newRouterMode)
        } else {
          if (routerFile.includes('mode:')) {
            api.exitLog(`Unable to modify current router mode, make sure it's 'hash'`, 'warn')
          }
        }
        files[routerFilePath] = lines.reverse().join('\n')
      } else {
        api.exitLog(`Unable to find router file, make sure router mode is 'hash'`, 'warn')
      }
    }
  })

  api.onCreateComplete(() => {
    // .gitignore - not included in files on postProcessFiles
    const ignorePath = '.gitignore'
    const ignoreCompletePath = api.resolve(ignorePath)
    const ignore = fs.existsSync(ignoreCompletePath)
      ? fs.readFileSync(ignoreCompletePath, 'utf-8')
      : ''
    var ignoreContent = '\n# Cordova\n'
    const folders = ['platforms', 'plugins']
    folders.forEach(folder => {
      ignoreContent += `/${cordovaPath}/${folder}\n`
    })
    ignoreContent += '/public/cordova.js\n'

    fs.writeFileSync(ignoreCompletePath, ignore + ignoreContent)
    api.exitLog(`Updated ${ignorePath} : ${ignoreContent}`)

    // config.xml - add hook
    const configPath = `${cordovaPath}/config.xml`
    const configCompletePath = api.resolve(configPath)
    let cordovaConfig = fs.existsSync(configCompletePath)
      ? fs.readFileSync(configCompletePath, 'utf-8')
      : ''
    const lines = cordovaConfig.split(/\r?\n/g)
    const regexContent = /\s+<content/
    const contentIndex = lines.findIndex(line => line.match(regexContent))
    const hook = '    <hook type="after_prepare" src="node_modules/vue-cli-plugin-cordova/serve-config-hook.js" />'
    if (contentIndex >= 0) {
      lines.splice(contentIndex, 0, hook)
      cordovaConfig = lines.join('\n')
      fs.writeFileSync(configCompletePath, cordovaConfig)
      api.exitLog(`Updated ${configPath}`)
    }

    // cordova
    spawn.sync('cordova', [
      'create',
      cordovaPath,
      id,
      appName
    ], {
      env: process.env,
      stdio: 'inherit', // pipe to console
      encoding: 'utf-8'
    })
    api.exitLog(`Executed 'cordova create ${cordovaPath} ${id} ${appName}'`)

    const wwwIgnorePath = api.resolve(`${cordovaPath}/www/.gitignore`)
    api.exitLog(`Creating file: ${wwwIgnorePath}`)
    fs.writeFileSync(wwwIgnorePath, '*\n*/\n!.gitignore')

    // platforms
    const srcCordovaPath = api.resolve(cordovaPath)
    platforms.forEach(platform => {
      info(`Adding platform ${platform}`)
      spawn.sync('cordova', [
        'platform',
        'add',
        platform
      ], {
        cwd: srcCordovaPath,
        env: process.env,
        stdio: 'inherit', // pipe to console
        encoding: 'utf-8'
      })
      api.exitLog(`Executed 'cordova platform add ${platform}' in folder ${srcCordovaPath}`)
    })
  })
}
