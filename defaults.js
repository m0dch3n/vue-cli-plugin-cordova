module.exports = {
  cordovaPath: 'src-cordova',
  cordovaConfigPaths: {
    android: 'app/src/main/res/xml/config.xml',
    ios: 'VueExampleAppName/config.xml',
    osx: 'config.xml',
  },
  id: 'com.vue.example.app',
  appName: 'VueExampleAppName',
  platforms: ['android', 'ios', 'browser', 'osx'],
  routerMode: 'hash'
}
