import 'bluebird-global'
import * as sdk from 'botpress/sdk'
import api from './api'
import HibotchatDatabase from './db'
import { MQConnection } from "./rabbitHibot";
import socket from './socket'
let connRabHibot
const onServerStarted = async (bp: typeof sdk) => {
  connRabHibot = new MQConnection()
  await connRabHibot.connect();

  await connRabHibot.receiveMessages()
  const db = new HibotchatDatabase(bp)
  await db.initialize()

  await api(bp, db)
  await socket(bp, db)
  await connRabHibot.sendMessageChannel(bp)

}

const onServerReady = async (bp: typeof sdk) => {
  //const example = new MQConnection()
  /*await connRabHibot.receiveMessages()
    .then(message => console.log('message index', message))
  /*await connRabHibot.receiveMessages()
    .then(message => console.log('message index', message));*/
}

const entryPoint: sdk.ModuleEntryPoint = {
  onServerStarted,
  onServerReady,
  definition: {
    name: 'channel-hibot',
    menuIcon: 'chrome_reader_mode',
    fullName: 'Channel Hibot',
    homepage: 'https://botpress.io',
    noInterface: true,
    plugins: [{ entry: 'WebBotpressUIInjection', position: 'overlay' }]
  }
}

export default entryPoint
