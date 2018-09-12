const { spawnSync } = require('child_process')
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
  'cordova-build-ios': 'cordova-build-ios'
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
    return api.resolve(cordovaPath + '/platforms/' + platform)
  }

  const getPlatformPathCordovaJS = platform => {
    return api.resolve(cordovaPath + '/platforms/' + platform + '/platform_www/cordova.js')
  }

  const getCordovaPathConfig = () => {
    return api.resolve(cordovaPath + '/config.xml')
  }

  const cordovaRun = () => {
    // cordova run platform
    info('executing "cordova run ' + platform + '"...')
    return spawnSync('cordova', [
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
    info('executing "cordova build ' + platform + ' ' + cordovaMode + '"...')
    return spawnSync('cordova', [
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
    return spawnSync('cordova', [
      'clean'
    ], {
      cwd: srcCordovaPath,
      env: process.env,
      stdio: 'inherit', // pipe to console
      encoding: 'utf-8'
    })
  }

  const cordovaJSMiddleware = () => {
    const cordovaJSPath = getPlatformPathCordovaJS(platform)
    const cordovaJS = fs.readFileSync(cordovaJSPath, 'utf-8')
    return (req, res, next) => {
      if (req.url === '/cordova.js') {
        res.setHeader('Content-Type', 'text/javascript')
        res.send(cordovaJS)
      } else {
        next()
      }
    }
  }

  const cordovaContent = url => {
    const cordovaConfigPath = getCordovaPathConfig()
    let cordovaConfig = fs.readFileSync(cordovaConfigPath, 'utf-8')
    const lines = cordovaConfig.split(/\r?\n/g).reverse()
    const regex = /\s+<content/
    const contentIndex = lines.findIndex(line => line.match(regex))
    if (contentIndex >= 0) {
      lines[contentIndex] = '    <content src="' + url + '" />'
      cordovaConfig = lines.reverse().join('\n')
    }

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
          cordovaContent('index.html')
        })
      })

      // set content url to devServer
      info('updating cordova config.xml content to ' + publicUrl)
      cordovaContent(publicUrl)

      cordovaClean()

      cordovaRun()

      return server
    } else {
      if (availablePlatforms.length === 0) {
        error('No platforms installed in \'' + srcCordovaPath + '\', please execute "cordova platform add ' + platform + '" in ' + srcCordovaPath)
      } else {
        error('Missing platform \'' + platform + '\', please execute "cordova platform add ' + platform + '" in ' + srcCordovaPath)
      }
    }
  }

  const runBuild = async args => {
    // set index.html as cordova content
    cordovaContent('index.html')
    // set build output folder
    args.dest = cordovaPath + '/www'
    // build
    await api.service.run('build', args)
    // cordova clean
    await cordovaClean()
    // cordova build --release (if you want a build debug build, use cordovaBuild(false)
    await cordovaBuild(false)
  }

  const projectDevServerOptions = options.devServer || {}
  const cordovaPath = options.pluginOptions.cordovaPath || defaults.cordovaPath
  const srcCordovaPath = api.resolve(cordovaPath)
  const platforms = defaults.platforms
  const platform = getPlatform(api.service.mode)

  api.configureDevServer(app => {
    // /cordova.js should resolve to platform cordova.js
    app.use(cordovaJSMiddleware())
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
