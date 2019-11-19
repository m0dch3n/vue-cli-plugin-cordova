const fs = require('fs')
const { info } = require('@vue/cli-shared-utils')

const url = process.env.CORDOVA_WEBVIEW_SRC
const cordovaConfigPath = process.env.CORDOVA_PREPARE_CONFIG
if (!url || !cordovaConfigPath) {
  return
}
info(`updating ${cordovaConfigPath} content to ${url}`)

let cordovaConfig = fs.readFileSync(cordovaConfigPath, 'utf-8')
const lines = cordovaConfig.split(/\r?\n/g).reverse()
const regexContent = /\s+<content/
const contentIndex = lines.findIndex(line => line.match(regexContent))
const allowNavigation = `    <allow-navigation href="${url}" />`
if (contentIndex >= 0) {
  lines[contentIndex] = `    <content src="${url}" />`
  if (url) {
    lines.splice(contentIndex, 0, allowNavigation)
  }
  cordovaConfig = lines.reverse().join('\n')
  fs.writeFileSync(cordovaConfigPath, cordovaConfig)
}
