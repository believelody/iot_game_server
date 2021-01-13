const http = require('http');
const mosca = require('mosca');
// const express = require('express'), bodyParser = require('body-parser'),
const Serial = require('serialport');
const Readline = require('@serialport/parser-readline');

let tmp = -1;
let i = 0;
let state = false;

const settings = {
    port: 5000,
    http: {
        port: 5002,
        bundle: true,
        static: './'
    }
};
const httpServer = http.createServer();
const mqttServer = new mosca.Server(settings);

const port = new Serial("/dev/ttyUSB0", { baudRate: 9600, autoOpen: false });

const serialState = error => {
    if (error) state = false;
    else state = true;
    console.log(error);

    mqttServer.publish({
        topic: "/iot_gime/serial",
        payload: state,
        qos: 0
    });
}

port.open(err => serialState(err));

const parser = new Readline();
port.pipe(parser);

port.on("close", close => {
    mqttServer.publish({
        topic: "/iot_gime/serial",
        payload: "false",
        qos: 1
    });

    const interval = setInterval(() => {
        if (!port.isOpen) port.open(err => serialState(err));
    }, 1000);
});

port.on("error", err => console.log("On error event: ", err));

parser.on("data", line => {
    if (line !== "") {
        const lineSplit = line.split("/");
        if (lineSplit[1] !== undefined && lineSplit[2] !== undefined) {

            mqttServer.publish({
                topic: '/iot_gime/joystick',
                payload: JSON.stringify({ x: lineSplit[1], y: lineSplit[2].slice(0, lineSplit[2].indexOf("/")), serial: state }),
                qos: 1
            });
        }

        if (lineSplit[0] == 1) {
            mqttServer.publish({
                topic: '/iot_gime/btn',
                payload: lineSplit[0],
                qos: 1
            });
        }

    }
    else {
        console.log("empty")
    }
},
error => {
    console.log("error")
});
// Attach HTTP to MQTT
// mqttServer.attachHttpServer(httpServer);

mqttServer.on('ready', ready);

// fired when the mqtt server is ready
function ready() {
    console.log('Mosca server is up and running')
}

// fired when a  client is connected
mqttServer.on('clientConnected', function (client) {
    if (client.id === 'client-iot-gime') {
        console.log('client connected', client.id);
        mqttServer.publish({
            topic: "/iot_gime/serial",
            payload: `${state}`,
            qos: 1
        });
    }
});

// fired when a message is received
mqttServer.on('published', function (packet, client) {
    console.log('Published : ', packet);
});

// fired when a client subscribes to a topic
mqttServer.on('subscribed', function (topic, client) {
    // console.log('subscribed : ', topic);
});

// fired when a client unsubscribes to a topic
mqttServer.on('unsubscribed', function (topic, client) {
    console.log('unsubscribed : ', topic);
});

// fired when a client is disconnecting
// mqttServer.on('clientDisconnecting', function (client) {
//     console.log('clientDisconnecting : ', client.id);
// });

// fired when a client is disconnected
// mqttServer.on('clientDisconnected', function (client) {
//     console.log('clientDisconnected : ', client.id);
// });