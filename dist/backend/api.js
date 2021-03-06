"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _moment = _interopRequireDefault(require("moment"));

var _multer = _interopRequireDefault(require("multer"));

var _multerS = _interopRequireDefault(require("multer-s3"));

var _path = _interopRequireDefault(require("path"));

var _awsSdk = _interopRequireDefault(require("aws-sdk"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const ERR_USER_ID_REQ = '`userId` is required and must be valid';
const ERR_MSG_TYPE = '`type` is required and must be valid';
const ERR_CONV_ID_REQ = '`conversationId` is required and must be valid';

var _default = async (bp, db) => {
  console.log('cuantas veces entras a la api');

  const diskStorage = _multer.default.diskStorage({
    limits: {
      files: 1,
      fileSize: 5242880 // 5MB

    },
    filename: function (req, file, cb) {
      const userId = _lodash.default.get(req, 'params.userId') || 'anonymous';

      const ext = _path.default.extname(file.originalname);

      cb(undefined, `${userId}_${new Date().getTime()}${ext}`);
    }
  });

  const globalConfig = await bp.config.getModuleConfig('channel-hibot');
  let upload = (0, _multer.default)({
    storage: diskStorage
  });

  if (globalConfig.uploadsUseS3) {
    /*
      You can override AWS's default settings here. Example:
      { region: 'us-east-1', apiVersion: '2014-10-01', credentials: {...} }
     */
    const awsConfig = {
      region: globalConfig.uploadsS3Region,
      credentials: {
        accessKeyId: globalConfig.uploadsS3AWSAccessKey,
        secretAccessKey: globalConfig.uploadsS3AWSAccessSecret
      }
    };

    if (!awsConfig.credentials.accessKeyId && !awsConfig.credentials.secretAccessKey) {
      delete awsConfig.credentials;
    }

    if (!awsConfig.region) {
      delete awsConfig.region;
    }

    const s3 = new _awsSdk.default.S3(awsConfig);
    const s3Storage = (0, _multerS.default)({
      s3: s3,
      bucket: globalConfig.uploadsS3Bucket || 'uploads',
      contentType: _multerS.default.AUTO_CONTENT_TYPE,
      cacheControl: 'max-age=31536000',
      // one year caching
      acl: 'public-read',
      key: function (req, file, cb) {
        const userId = _lodash.default.get(req, 'params.userId') || 'anonymous';

        const ext = _path.default.extname(file.originalname);

        cb(undefined, `${userId}_${new Date().getTime()}${ext}`);
      }
    });
    upload = (0, _multer.default)({
      storage: s3Storage
    });
  }

  const router = bp.http.createRouterForBot('channel-hibot', {
    checkAuthentication: false,
    enableJsonBodyParser: true
  });

  const asyncApi = fn => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      bp.logger.attachError(err).error('HTTP Handling Error');
      res.status(500).send(err && err.message);
    }
  };

  router.post('/messages/:userId', asyncApi(async (req, res) => {
    const {
      botId,
      userId = undefined
    } = req.params;

    if (!validateUserId(userId)) {
      return res.status(400).send(ERR_USER_ID_REQ);
    }

    await bp.users.getOrCreateUser('hibot', userId); // Create the user if it doesn't exist

    const payload = req.body || {};
    let {
      conversationId = undefined
    } = req.query || {};
    conversationId = conversationId && parseInt(conversationId);

    if (!_lodash.default.includes(['text', 'quick_reply', 'form', 'login_prompt', 'visit'], payload.type)) {
      // TODO: Support files
      return res.status(400).send(ERR_MSG_TYPE);
    }

    if (!conversationId) {
      conversationId = await db.getOrCreateRecentConversation(botId, userId, {
        originatesFromUserMessage: true
      });
    }

    await sendNewMessage(botId, userId, conversationId, payload);
    return res.sendStatus(200);
  }));
  router.post('/messages/:userId/files', upload.single('file'), asyncApi(async (req, res) => {
    const {
      botId = undefined,
      userId = undefined
    } = req.params || {};

    if (!validateUserId(userId)) {
      return res.status(400).send(ERR_USER_ID_REQ);
    }

    await bp.users.getOrCreateUser('hibot', userId); // Just to create the user if it doesn't exist

    let {
      conversationId = undefined
    } = req.query || {};
    conversationId = conversationId && parseInt(conversationId);

    if (!conversationId) {
      return res.status(400).send(ERR_CONV_ID_REQ);
    }

    const payload = {
      text: `Uploaded a file [${req.file.originalname}]`,
      type: 'file',
      data: {
        storage: req.file.location ? 's3' : 'local',
        url: req.file.location || undefined,
        name: req.file.originalname,
        mime: req.file.contentType || req.file.mimetype,
        size: req.file.size
      }
    };
    console.log('payload hibot', payload);
    await sendNewMessage(botId, userId, conversationId, payload);
    return res.sendStatus(200);
  }));
  router.get('/conversations/:userId/:conversationId', async (req, res) => {
    console.log('cuando entras a router the hibot conversarionID', res);
    const {
      userId,
      conversationId,
      botId
    } = req.params;

    if (!validateUserId(userId)) {
      return res.status(400).send(ERR_USER_ID_REQ);
    }

    const conversation = await db.getConversation(userId, conversationId, botId);
    return res.send(conversation);
  });
  router.get('/conversations/:userId', async (req, res) => {
    const {
      botId = undefined,
      userId = undefined
    } = req.params || {};

    if (!validateUserId(userId)) {
      return res.status(400).send(ERR_USER_ID_REQ);
    }

    await bp.users.getOrCreateUser('hibot', userId);
    const conversations = await db.listConversations(userId, botId);
    const config = await bp.config.getModuleConfigForBot('channel-hibot', botId);
    return res.send({
      conversations: [...conversations],
      startNewConvoOnTimeout: config.startNewConvoOnTimeout,
      recentConversationLifetime: config.recentConversationLifetime
    });
  });

  function validateUserId(userId) {
    return /[a-z0-9-_]+/i.test(userId);
  }

  async function sendNewMessage(botId, userId, conversationId, payload) {
    console.log('sendNewMessage channel-hibot', botId, userId, conversationId, payload);

    if (!payload.text || !_lodash.default.isString(payload.text) || payload.text.length > 360) {
      throw new Error('Text must be a valid string of less than 360 chars');
    }

    const sanitizedPayload = _lodash.default.pick(payload, ['text', 'type', 'data', 'raw']); // let the bot programmer make extra cleanup
    // if (bp.webchat.sanitizeIncomingMessage) {
    // FIXME
    // sanitizedPayload = bp.webchat.sanitizeIncomingMessage(sanitizedPayload) || sanitizedPayload
    // }
    // Because we don't necessarily persist what we emit/received


    const persistedPayload = { ...sanitizedPayload
    }; // We remove the password from the persisted messages for security reasons

    if (payload.type === 'login_prompt') {
      persistedPayload.data = _lodash.default.omit(persistedPayload.data, ['password']);
    }

    if (payload.type === 'form') {
      persistedPayload.data.formId = payload.formId;
    }

    const {
      result: user
    } = await bp.users.getOrCreateUser('hibot', userId);
    const event = bp.IO.Event({
      botId,
      channel: 'hibot',
      direction: 'incoming',
      payload,
      target: userId,
      threadId: conversationId,
      type: payload.type
    });
    console.log('este es el event no se donde invoca hibot', event);
    const message = await db.appendUserMessage(botId, userId, conversationId, persistedPayload);
    bp.realtime.sendPayload(bp.RealTimePayload.forVisitor(userId, 'hibotchat.message', message));
    return bp.events.sendEvent(event);
  }

  router.post('/events/:userId', asyncApi(async (req, res) => {
    const {
      type = undefined,
      payload = undefined
    } = req.body || {};
    const {
      userId = undefined
    } = req.params || {};
    const {
      result: user
    } = await bp.users.getOrCreateUser('hibot', userId);
    bp.events.sendEvent({
      channel: 'hibot',
      type,
      user,
      text: payload.text,
      raw: _lodash.default.pick(payload, ['text', 'type', 'data']),
      ...payload.data
    });
    res.status(200).send({});
  })), router.post('/conversations/:userId/:conversationId/reset', asyncApi(async (req, res) => {
    const {
      botId,
      userId,
      conversationId
    } = req.params;
    const {
      result: user
    } = await bp.users.getOrCreateUser('hibot', userId);
    const payload = {
      text: `Reset the conversation`,
      type: 'session_reset'
    };
    await sendNewMessage(botId, userId, conversationId, payload);
    await bp.dialog.deleteSession(userId);
    res.status(200).send({});
  })), router.post('/conversations/:userId/new', async (req, res) => {
    const {
      userId,
      botId
    } = req.params;
    await db.createConversation(botId, userId);
    res.sendStatus(200);
  }), router.get('/:userId/reference', async (req, res) => {
    try {
      const {
        params: {
          userId
        },
        query: {
          ref: webchatUrlQuery
        }
      } = req; // FIXME
      // const state = await bp.dialogEngine.stateManager.getState(userId)
      // const newState = { ...state, webchatUrlQuery }
      // FIXME
      // await bp.dialogEngine.stateManager.setState(userId, newState)

      res.status(200);
    } catch (error) {
      res.status(500);
    }
  });

  const getMessageContent = message => {
    switch (message.message_type) {
      case 'file':
        return message.message_data.url;

      case 'text':
        return message.message_text;

      default:
        return `Event (${message.message_type})`;
    }
  };

  const convertToTxtFile = async conversation => {
    const {
      messages
    } = conversation;
    const {
      result: user
    } = await bp.users.getOrCreateUser('hibot', conversation.userId);
    const timeFormat = 'MM/DD/YY HH:mm';
    const fullName = `${user.attributes['first_name'] || ''} ${user.attributes['last_name'] || ''}`;
    const metadata = `Title: ${conversation.title}\r\nCreated on: ${(0, _moment.default)(conversation.created_on).format(timeFormat)}\r\nUser: ${fullName}\r\n-----------------\r\n`;
    const messagesAsTxt = messages.map(message => {
      if (message.message_type === 'session_reset') {
        return '';
      }

      const userName = message.full_name.indexOf('undefined') > -1 ? 'User' : message.full_name;
      return `[${(0, _moment.default)(message.sent_on).format(timeFormat)}] ${userName}: ${getMessageContent(message)}\r\n`;
    });
    return [metadata, ...messagesAsTxt].join('');
  };

  router.get('/conversations/:userId/:conversationId/download/txt', async (req, res) => {
    const {
      userId,
      conversationId,
      botId
    } = req.params;

    if (!validateUserId(userId)) {
      return res.status(400).send(ERR_USER_ID_REQ);
    }

    const conversation = await db.getConversation(userId, conversationId, botId);
    const txt = await convertToTxtFile(conversation);
    res.send({
      txt,
      name: `${conversation.title}.txt`
    });
  });
};

exports.default = _default;