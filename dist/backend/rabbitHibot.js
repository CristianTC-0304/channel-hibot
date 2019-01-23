"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MQConnection = void 0;

var amqp = _interopRequireWildcard(require("amqplib/callback_api"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

//let connection
class MQConnection {
  constructor() {
    _defineProperty(this, "connection", void 0);

    _defineProperty(this, "channel", void 0);

    _defineProperty(this, "example", void 0);
  }

  connect() {
    const optionConnection = {
      protocol: 'amqp',
      hostname: '35.225.84.79',
      username: 'user',
      password: '*N6Z}Jsy#@Yb@zR9',
      locale: 'en_US',
      vhost: 'nataly'
    };
    return new Promise((resolve, reject) => {
      amqp.connect(optionConnection, (err, conn) => {
        if (err) {
          console.log('mal');
          reject(err);
        } else {
          console.log('bien');
          conn.createChannel((err, channel) => {
            if (err) {
              console.log('channel mal');
              reject(err);
            } else {
              this.connection = conn;
              this.declareResources(channel);
              resolve();
              console.log('channel bien');
            }
          });
        }
      });
    });
    /*return amqp.connect(optionConnection, function(err, conn) {
        if (err) {
            console.error('Error', err)
        } else {
            this.connection = conn
            console.log('conexion full', this.connection)
            conn.createChannel(function(err, channel) {
                if (err) {
                    console.error('Error Channel', err)
                } else {
                    //console.log('bien channel', channel)
                    this.declareResources(channel)
                }
            })
        }
    })*/
  }

  declareResources(channel) {
    console.log('entras a resources');
    return channel.assertQueue("hibot-connect-botpress", {
      durable: true
    });
  }

  receiveMessages() {
    console.log('entro a message');
    return this.connection.createChannel(function (err, channel) {
      if (err) {
        console.error('error');
      } else {
        channel.consume("hibot-connect-botpress", function (msg) {
          console.log(" [x] Received %s", msg.content.toString());
        });
      }
    });
    /*.then(channel => channel.consume("channel-botpress-rabbit", {noAck: true}))
    .then(message => console.log('message', message.content.toString()))*/
  }

}

exports.MQConnection = MQConnection;