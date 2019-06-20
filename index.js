const spawn = require('cross-spawn')
const { info, error } = require('@vue/cli-shared-utils')
const fs = require('fs')
const portfinder = require('portfinder')
const address = require('address')
const defaults = require('./defaults')
const defaultServe = require('./default-serve')

const defaultModes = {
  'cordova-serve-android': 'development',
  'cordova-build-android': 'production',
  'cordova-serve-ios': 'development',
  'cordova-build-ios': 'production',
  'cordova-serve-browser': 'development',
  'cordova-build-browser': 'production',
  'cordova-serve-osx': 'development',
  'cordova-build-osx': 'production',
  'cordova-build-only-www-ios': 'production',
  'cordova-build-only-www-android': 'production',
  'cordova-build-only-www-browser': 'production',
  'cordova-build-only-www-osx': 'production',
  'cordova-prepare': 'production'
}

module.exports = (api, options) => {
  const cordovaPath = options.pluginOptions.cordovaPath || defaults.cordovaPath
  const srcCordovaPath = api.resolve(cordovaPath)

  const getPlatformPath = platform => {
    return api.resolve(`${cordovaPath}/platforms/${platform}`)
  }

  const getPlatformPathWWW = platform => {
    return api.resolve(`${cordovaPath}/platforms/${platform}/platform_www`)
  }

  const getCordovaPathConfig = platform => {
    let cordovaConfigPathToUpdate
    if (platform === 'android') {
      cordovaConfigPathToUpdate = 'app/src/main/res/xml/config.xml'
    } else if (platform === 'ios' || platform === 'osx') {
      const cordovaConfigPath = api.resolve(`${cordovaPath}/config.xml`)
      const cordovaConfig = fs.readFileSync(cordovaConfigPath, 'utf-8')
      const regexAppName = /\s+<name>(.*)<\/name>/
      const appNameMatch = cordovaConfig.match(regexAppName)
      if (appNameMatch.length >= 2) {
        const appName = appNameMatch[1]
        cordovaConfigPathToUpdate = `${appName}/config.xml`
      } else {
        error('Unable to detect AppName!')
      }
    } else {
      cordovaConfigPathToUpdate = 'config.xml'
    }
    return api.resolve(`${cordovaPath}/platforms/${platform}/${cordovaConfigPathToUpdate}`)
  }

  const cordovaRun = platform => {
    // cordova run platform
    info(`executing "cordova run ${platform}" in folder ${srcCordovaPath}`)
    return spawn.sync('cordova', [
      'run',
      platform
    ], {
      cwd: srcCordovaPath,
      env: process.env,
      stdio: 'inherit', // pipe to console
      encoding: 'utf-8'
    })
  }

  const cordovaPrepare = () => {
    // cordova run platform
    info(`executing "cordova prepare in folder ${srcCordovaPath}`)
    return spawn.sync('cordova', [
      'prepare'
    ], {
      cwd: srcCordovaPath,
      env: process.env,
      stdio: 'inherit', // pipe to console
      encoding: 'utf-8'
    })
  }

  const cordovaBuild = (platform, release = true) => {
    // cordova run platform
    const cordovaMode = release ? '--release' : '--debug'
    info(`executing "cordova build ${platform} ${cordovaMode}" in folder ${srcCordovaPath}`)
    return spawn.sync('cordova', [
      'build',
      platform,
      cordovaMode
    ], {
      cwd: srcCordovaPath,
      env: process.env,
      stdio: 'inherit', // pipe to console
      encoding: 'utf-8'
    })
  }

  const cordovaClean = () => {
    // cordova clean
    info(`executing "cordova clean" in folder ${srcCordovaPath}`)
    return spawn.sync('cordova', [
      'clean'
    ], {
      cwd: srcCordovaPath,
      env: process.env,
      stdio: 'inherit', // pipe to console
      encoding: 'utf-8'
    })
  }

  const cordovaJSMiddleware = platform => {
    return (req, res, next) => {
      if (req.url !== '/') {
        const filePath = getPlatformPathWWW(platform) + req.url
        try {
          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8')
            res.send(fileContent)
            return
          }
        } catch (err) {
        }
      }
      next()
    }
  }

  const runServe = async (platform, args) => {
    const availablePlatforms = []
    const platforms = defaults.platforms

    platforms.forEach(platform => {
      const platformPath = getPlatformPath(platform)
      if (fs.existsSync(platformPath)) {
        availablePlatforms.push(platform)
      }
    })

    if (availablePlatforms.includes(platform)) {
      // add cordova.js, define process.env.CORDOVA_PLATFORM
      chainWebPack(platform)
      // Add js middleware
      configureDevServer(platform)

      const projectDevServerOptions = options.devServer || {}
      // resolve server options
      const open = false // browser does not need to be opened
      const https = options.devServer.https || false // check devServer.options for user defined https setting
      const protocol = https ? 'https' : 'http'
      const host = args.host || process.env.HOST || projectDevServerOptions.host || defaultServe.host
      let port = args.port || process.env.PORT || projectDevServerOptions.port || defaultServe.port
      portfinder.basePort = port
      port = await portfinder.getPortPromise()
      const publicArg = args.public || projectDevServerOptions.public
      const defaultPublicURL = `${protocol}://${address.ip()}:${port}`
      const rawPublicUrl = publicArg || defaultPublicURL
      const publicUrl = rawPublicUrl
        ? /^[a-zA-Z]+:\/\//.test(rawPublicUrl)
          ? rawPublicUrl
          : `${protocol}://${rawPublicUrl}`
        : null

      const serveArgs = {
        open,
        host,
        port,
        https,
        public: publicArg
      }
      // npm run serve
      const server = await api.service.run('serve', serveArgs)

      // set content url to devServer
      process.env.CORDOVA_WEBVIEW_SRC = publicUrl
      process.env.CORDOVA_PREPARE_CONFIG = getCordovaPathConfig(platform)

      cordovaClean()

      cordovaRun(platform)

      return server
    } else {
      if (availablePlatforms.length === 0) {
        error(`No platforms installed in '${srcCordovaPath}', please execute "cordova platform add ${platform}" in ${srcCordovaPath}`)
      } else {
        error(`Missing platform '${platform}', please execute "cordova platform add ${platform}" in ${srcCordovaPath}`)
      }
    }
  }

  const runBuild = async (platform, args) => {
    // build WWW
    await runWWWBuild(platform, args)
    // cordova clean
    await cordovaClean()
    // cordova build --release (if you want a build debug build, use cordovaBuild(platform, false)
    await cordovaBuild(platform)
  }

  const addGitIgnoreToWWW = () => {
    const wwwIgnorePath = api.resolve(`${cordovaPath}/www/.gitignore`)
    fs.writeFileSync(wwwIgnorePath, defaults.gitIgnoreContent)
  }

  const runPrepare = async (args) => {
    // build WWW
    await runWWWBuild(null, args)
    // add www/.gitignore again (because build will delete it)
    addGitIgnoreToWWW()
    // cordova prepare
    await cordovaPrepare()
  }

  const runWWWBuild = async (platform, args) => {
    // add cordova.js, define process.env.CORDOVA_PLATFORM
    chainWebPack(platform)
    // set build output folder
    args.dest = cordovaPath + '/www'
    // build
    await api.service.run('build', args)
    // add www/.gitignore again (because build will delete it)
    addGitIgnoreToWWW()
  }

  const configureDevServer = platform => {
    api.configureDevServer(app => {
      // /cordova.js should resolve to platform cordova.js
      app.use(cordovaJSMiddleware(platform))
    })
  }

  const chainWebPack = platform => {
    api.chainWebpack(webpackConfig => {
      // add cordova.js to index.html
      webpackConfig.plugin('cordova')
        .use(require('html-webpack-include-assets-plugin'), [{
          assets: 'cordova.js',
          append: false,
          publicPath: false
        }])

      // process.env.CORDOVA_PLATFORM = platform
      if (platform !== null) {
        webpackConfig.plugin('define')
          .tap(args => {
            const { 'process.env': env, ...rest } = args[0]
            return [{
              'process.env': Object.assign(
                {},
                env,
                {
                  CORDOVA_PLATFORM: '\'' + platform + '\''
                }
              ),
              ...rest
            }]
          })
      }
    })
  }

  api.registerCommand('cordova-serve-android', async args => {
    return await runServe('android', args)
  })

  api.registerCommand('cordova-build-android', async args => {
    return await runBuild('android', args)
  })

  api.registerCommand('cordova-serve-ios', async args => {
    return await runServe('ios', args)
  })

  api.registerCommand('cordova-build-ios', async args => {
    return await runBuild('ios', args)
  })

  api.registerCommand('cordova-serve-osx', async args => {
    return await runServe('osx', args)
  })

  api.registerCommand('cordova-build-osx', async args => {
    return await runBuild('osx', args)
  })

  api.registerCommand('cordova-build-only-www-ios', async args => {
    return await runWWWBuild('ios', args)
  })

  api.registerCommand('cordova-build-only-www-android', async args => {
    return await runWWWBuild('android', args)
  })

  api.registerCommand('cordova-build-only-www-browser', async args => {
    return await runWWWBuild('browser', args)
  })

  api.registerCommand('cordova-build-only-www-osx', async args => {
    return await runWWWBuild('osx', args)
  })

  api.registerCommand('cordova-prepare', async args => {
    return await runPrepare(args)
  })

  api.registerCommand('cordova-serve-browser', async args => {
    args.open = true
    const platform = 'browser'
    chainWebPack(platform)
    configureDevServer(platform)
    return await api.service.run('serve', args)
  })
  api.registerCommand('cordova-build-browser', async args => {
    return await runBuild('browser', args)
  })
}

module.exports.defaultModes = defaultModes
