const hasbin = require('hasbin')
const defaults = require('./defaults')
const hasCordova = hasbin.sync('cordova')

const prompts = [
  {
    name: 'cordovaPath',
    type: 'string',
    message: 'Name of folder where cordova should be installed',
    default: defaults.cordovaPath,
    validate: opt => opt && opt.length >= 0
  },
  {
    name: 'id',
    type: 'string',
    message: 'ID of the app',
    default: defaults.id,
    validate: opt => opt && opt.length >= 0
  },
  {
    name: 'appName',
    type: 'string',
    message: 'Name of the app',
    default: defaults.appName,
    validate: opt => opt && opt.length >= 0
  },
  {
    name: 'platforms',
    type: 'checkbox',
    message: 'Select Platforms:',
    choices: [
      {
        name: 'Android',
        value: 'android',
        checked: !!defaults.platforms['android']
      },
      {
        name: 'iOS',
        value: 'ios',
        checked: !!defaults.platforms['ios']
      },
      {
        name: 'Browser',
        value: 'browser',
        checked: !!defaults.platforms['browser']
      }
    ]
  }
]

module.exports = hasCordova ? prompts : null
