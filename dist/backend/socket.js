"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _mime = _interopRequireDefault(require("mime"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const outgoingTypes = ['text', 'typing', 'login_prompt', 'file', 'carousel', 'custom'];

var _default = async (bp, db) => {
  console.log('entro a sokect de hibot');
  const config = {}; // FIXME

  const {
    botName = 'Bot',
    botAvatarUrl = undefined
  } = config || {}; // FIXME

  bp.events.registerMiddleware({
    description: 'Sends out messages that targets platform = hibotchat.' + ' This middleware should be placed at the end as it swallows events once sent.',
    direction: 'outgoing',
    handler: outgoingHandler,
    name: 'hibot.sendMessages',
    order: 100
  });

  async function outgoingHandler(event, next) {
    if (event.channel !== 'hibot') {
      return next();
    }

    const messageType = event.type === 'default' ? 'text' : event.type;
    const userId = event.target;
    const conversationId = event.threadId || (await db.getOrCreateRecentConversation(event.botId, userId));

    if (!_lodash.default.includes(outgoingTypes, messageType)) {
      return next(new Error('Unsupported event type: ' + event.type));
    }

    if (messageType === 'typing') {
      const typing = parseTyping(event.payload.value);
      const payload = bp.RealTimePayload.forVisitor(userId, 'hibotchat.typing', {
        timeInMs: typing,
        conversationId
      }); // Don't store "typing" in DB

      bp.realtime.sendPayload(payload);
      await Promise.delay(typing);
    } else if (messageType === 'text' || messageType === 'carousel') {
      const message = await db.appendBotMessage(botName, botAvatarUrl, conversationId, {
        data: event.payload,
        raw: event.payload,
        text: event.preview,
        type: messageType
      });
      bp.realtime.sendPayload(bp.RealTimePayload.forVisitor(userId, 'hibotchat.message', message));
    } else if (messageType === 'file') {
      const extension = _path.default.extname(event.payload.url);

      const mimeType = _mime.default.getType(extension);

      const basename = _path.default.basename(event.payload.url, extension);

      const message = await db.appendBotMessage(botName, botAvatarUrl, conversationId, {
        data: {
          storage: 'storage',
          mime: mimeType,
          name: basename,
          ...event.payload
        },
        raw: event.payload,
        text: event.preview,
        type: messageType
      });
      bp.realtime.sendPayload(bp.RealTimePayload.forVisitor(userId, 'hibotchat.message', message));
    } else {
      throw new Error(`Message type "${messageType}" not implemented yet`);
    }

    console.log('event channel', event.channel);
    next(undefined, false);
  }
};

exports.default = _default;

function parseTyping(typing) {
  if (isNaN(typing)) {
    return 1000;
  }

  return Math.max(typing, 500);
}