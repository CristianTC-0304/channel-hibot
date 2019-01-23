const Queue = {
    channel: 'channel-botpress-rabbit',
    
    // function create queue the botpress
    newQueue: function (conn) {
        let newChannel
        console.log('entro a function de object')
        conn.createChannel(function(err, ch) {
            console.log('entro a crear el canal')
            return ch.assertQueue(Queue.channel, { durable: false})
        })
    },

    sendMessageQueue: function (conn) {
        console.log('entro a enviar message')
        conn.createChannel(function (err, ch) {
            console.log('entro a fucntion send')
            ch.sendToQueue(Queue.channel, new Buffer('Enviando Mensaje de Ejemplo'))
            return 'message send'
        })
    },

    receivingMessageQueue: function(conn) {
        console.log('entro a function receive message')
        conn.createChannel(function (err, ch) {
            console.log('entro a fucntion consume')
            ch.consume(Queue.channel, function(msg) {
                return msg.content.toString()
            }, {noAck: true})
        })
    }
}

module.exports = {
    Queue
}