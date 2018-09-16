# @m0dch3n/vue-cli-plugin-cordova
[Vue CLI 3.x](https://github.com/vuejs/vue-cli) plugin for Apache Cordova.

Integrate Cordova into Vue Cli App

## How To
```sh
$ npm install -g cordova # If cordova is not already installed
$ vue add @m0dch3n/cordova
$ npm run cordova-serve-android # Development Android
$ npm run cordova-build-android # Build Android
$ npm run cordova-serve-ios # Development IOS
$ npm run cordova-build-ios # Build IOS
$ npm run cordova-serve-browser # Development Browser
$ npm run cordova-build-browser # Build Browser
```
## What is the plugin doing ?
### During installation

* Setting **baseUrl** in vue.config.js to '' because in cordova production, files are served from **file://android_asset/www/** 
* Setting cordovaPath in **vue.config.js** 
* Checking if **router** is available and modify router mode to **'hash'** if process.env.CORDOVA_PLATFORM is set
* Adding ignore paths for cordova in **.gitignore**
* Executing '**cordova create cordovaPath id appName**' (cordovaPath, id and appName will be **prompted**)
* Executing '**cordova platform add platform**' (platform will be prompted) 

### In development mode

* Adding **cordova.js** to your **index.html**
* Defining **process.env.CORDOVA_PLATFORM** to **android** or **ios**
* Starting the Dev Server
* Pointing the cordova **config.xml** to Dev Server
* Executing '**cordova clean**'
* Executing '**cordova run platform**'

### In Production mode
* Adding **cordova.js** to your **index.html**
* Defining **process.env.CORDOVA_PLATFORM** to **android** or **ios**
* Pointing the cordova **config.xml** to **index.html**
* Building the app, output to **/cordovaPath/www**
* Executing '**cordova clean**'
* Executing '**cordova build platform  --release**'

## Please note

* You need to **manually sign** and **publish** the app in the app store
* You need to handle cordova's **"deviceready"** etc in your app
* **Cordova Plugins** can be added under /cordovaPath by executing '**cordova plugin add PLUGIN**' 
* If you want to **debug** your build app, using **chrome devtools**, build your app with '**cordova build platform --debug**' and make sure /cordovaPath/www has your **latest build**

## License

MIT

## Credits

Credits go to 
* @dekimasoon https://github.com/dekimasoon/vue-cli-plugin-cordova
* @quasarframework https://github.com/quasarframework/quasar-cli

Because my approach for this plugin, was inspired by theirs!
