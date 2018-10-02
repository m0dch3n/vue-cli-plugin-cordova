const spawn = require('cross-spawn')
const { info, error } = require('@vue/cli-shared-utils')
const fs = require('fs')
const portfinder = require('portfinder')
const address = require('address')
const defaults = require('./defaults')
const defaultServe = require('./default-serve')

const defaultModes = {
  'cordova-serve-android': 'cordova-serve-android',
  'cordova-build-android': 'cordova-build-android',
  'cordova-serve-ios': 'cordova-serve-ios',
  'cordova-build-ios': 'cordova-build-ios',
  'cordova-serve-browser': 'cordova-serve-browser',
  'cordova-build-browser': 'cordova-build-browser'
}

module.exports = (api, options) => {
  const getPlatform = str => {
    if (str) {
      return str.substring(str.lastIndexOf('-') + 1, str.length)
    } else {
      return defaults.platforms[0]
    }
  }

  const getPlatformPath = platform => {
    return api.resolve(`${cordovaPath}/platforms/${platform}`)
  }

  const getPlatformPathWWW = platform => {
    return api.resolve(`${cordovaPath}/platforms/${platform}/platform_www`)
  }

  const getCordovaPathConfig = () => {
    return api.resolve(`${cordovaPath}/config.xml`)
  }

  const cordovaRun = () => {
    // cordova run platform
    info(`executing "cordova run ${platform}"...`)
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

  const cordovaBuild = (release = true) => {
    // cordova run platform
    const cordovaMode = release ? '--release' : '--debug'
    info(`executing "cordova build ${platform} ${cordovaMode}"...`)
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
    info('executing "cordova clean"...')
    return spawn.sync('cordova', [
      'clean'
    ], {
      cwd: srcCordovaPath,
      env: process.env,
      stdio: 'inherit', // pipe to console
      encoding: 'utf-8'
    })
  }

  const cordovaJSMiddleware = () => {
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

  const cordovaContent = (resetNavigation, url) => {
    const cordovaConfigPath = getCordovaPathConfig()
    let cordovaConfig = fs.readFileSync(cordovaConfigPath, 'utf-8')
    let lines = cordovaConfig.split(/\r?\n/g).reverse()
    const regexContent = /\s+<content/
    const contentIndex = lines.findIndex(line => line.match(regexContent))
    const allowNavigation = `<allow-navigation href="${url}" />`
    if (contentIndex >= 0) {
      if (resetNavigation) {
        lines[contentIndex] = `    <content src="index.html" />`
        lines = lines.filter(line => !line.includes(allowNavigation))
      } else {
        lines[contentIndex] = `    <content src="${url}" />`
        lines.splice(contentIndex, 0, allowNavigation)
      }
    }

    cordovaConfig = lines.reverse().join('\n')
    fs.writeFileSync(cordovaConfigPath, cordovaConfig)
  }

  const runServe = async args => {
    const availablePlatforms = []
    platforms.forEach(platform => {
      const platformPath = getPlatformPath(platform)
      if (fs.existsSync(platformPath)) {
        availablePlatforms.push(platform)
      }
    })

    if (availablePlatforms.includes(platform)) {
      // resolve server options
      const open = false // browser does not need to be opened
      const https = false // cordova webpage must be served via http
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

      // on kill, reset cordova config.xml
      const signals = ['SIGINT', 'SIGTERM']
      signals.forEach(signal => {
        process.on(signal, () => {
          cordovaContent(true, publicUrl)
        })
      })

      // set content url to devServer
      info(`updating cordova config.xml content to ${publicUrl}`)
      cordovaContent(false, publicUrl)

      cordovaClean()

      cordovaRun()

      return server
    } else {
      if (availablePlatforms.length === 0) {
        error(`No platforms installed in '${srcCordovaPath}', please execute "cordova platform add ${platform}" in ${srcCordovaPath}`)
      } else {
        error(`Missing platform '${platform}', please execute "cordova platform add ${platform}" in ${srcCordovaPath}`)
      }
    }
  }

  const runBuild = async args => {
    // set build output folder
    args.dest = cordovaPath + '/www'
    // build
    await api.service.run('build', args)
    // cordova clean
    await cordovaClean()
    // cordova build --release (if you want a build debug build, use cordovaBuild(false)
    await cordovaBuild()
  }

  const projectDevServerOptions = options.devServer || {}
  const cordovaPath = options.pluginOptions.cordovaPath || defaults.cordovaPath
  const srcCordovaPath = api.resolve(cordovaPath)
  const platforms = defaults.platforms
  const platform = getPlatform(api.service.mode)

  api.configureDevServer(app => {
    if (defaultModes[api.service.mode]) {
      // /cordova.js should resolve to platform cordova.js
      app.use(cordovaJSMiddleware())
    }
  })

  api.registerCommand('cordova-serve-android', async args => {
    return await runServe(args)
  })

  api.registerCommand('cordova-build-android', async args => {
    return await runBuild(args)
  })

  api.registerCommand('cordova-serve-ios', async args => {
    return await runServe(args)
  })

  api.registerCommand('cordova-build-ios', async args => {
    return await runBuild(args)
  })

  api.registerCommand('cordova-serve-browser', async args => {
    args.open = true
    return await api.service.run('serve', args)
  })
  api.registerCommand('cordova-build-browser', async args => {
    return await runBuild(args)
  })

  api.chainWebpack(webpackConfig => {
    if (defaultModes[api.service.mode]) {
      // add cordova.js to index.html
      webpackConfig.plugin('cordova')
                .use(require('html-webpack-include-assets-plugin'), [{
                  assets: 'cordova.js',
                  append: false,
                  publicPath: false
                }])

      // process.env.CORDOVA_PLATFORM = platform
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

module.exports.defaultModes = defaultModes
