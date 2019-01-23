import * as amqp from 'amqplib/callback_api';
import { start } from 'repl';
//let connection

export class MQConnection {
    private connection: any;
    private channel: any;
    example: any
    constructor() {

    }

    connect() { 
        const optionConnection = {
            protocol: 'amqp',
            hostname: '35.225.84.79',
            username: 'user',
            password: '*N6Z}Jsy#@Yb@zR9',
            locale: 'en_US',
            vhost: 'nataly',
        }

        return new Promise((resolve, reject) => { 
            amqp.connect(optionConnection, (err, conn) => {
                if (err) {
                    console.log('mal')
                    reject(err)
                } else {
                    console.log('bien')
                        conn.createChannel( (err, channel) => {
                            if (err) {
                                console.log('channel mal')
                                reject(err)
                            } else {
                                this.connection = conn 
                                console.log('this', this.connection)
                                this.declareResources(channel)
                                resolve ()
                                console.log('channel bien')
                            }
                        })
                }
            })
        })

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
        console.log('entras a resources')
        return channel.assertQueue("hibot-connect-botpress", { durable: true })
    }


    receiveMessages() {
        console.log('entro a message')
        return this.connection.createChannel(function (err, channel) {
            if (err) {
                console.error('error')
            } else {
                channel.consume("hibot-connect-botpress", function(msg) {
                    console.log(" [x] Received %s", msg.content.toString());
                })
            }
        })
        /*.then(channel => channel.consume("channel-botpress-rabbit", {noAck: true}))
        .then(message => console.log('message', message.content.toString()))*/
    }
}

