"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("bluebird-global");

var _api = _interopRequireDefault(require("./api"));

var _db = _interopRequireDefault(require("./db"));

var _rabbitHibot = require("./rabbitHibot");

var _socket = _interopRequireDefault(require("./socket"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let connRabHibot;

const onServerStarted = async bp => {
  connRabHibot = new _rabbitHibot.MQConnection();
  await connRabHibot.connect();
  await connRabHibot.receiveMessages();
  const db = new _db.default(bp);
  await db.initialize();
  await (0, _api.default)(bp, db);
  await (0, _socket.default)(bp, db);
};

const onServerReady = async bp => {//const example = new MQConnection()

  /*await connRabHibot.receiveMessages()
    .then(message => console.log('message index', message))
  /*await connRabHibot.receiveMessages()
    .then(message => console.log('message index', message));*/
};

const entryPoint = {
  onServerStarted,
  onServerReady,
  definition: {
    name: 'channel-hibot',
    menuIcon: 'chrome_reader_mode',
    fullName: 'Channel Hibot',
    homepage: 'https://botpress.io',
    noInterface: true,
    plugins: [{
      entry: 'WebBotpressUIInjection',
      position: 'overlay'
    }]
  }
};
var _default = entryPoint;
exports.default = _default;