module.exports = function(RED) {
    class QbusBistabielNode {
        constructor(n) {
            RED.nodes.createNode(this,n);

            var node = this
            node.config = n;

            node.client = node.config.client
            node.clientConn = RED.nodes.getNode(node.client) 

            if (node.clientConn != null) {
                node.server     = node.clientConn.server
                node.serverConn = RED.nodes.getNode(node.server) 

                node.qid = node.config.qid
                node.ctdQid = node.clientConn.ctdQid
                
                if (node.qid != '' ) {
                    node.qid = node.config.qid
                    node.ctdQid = node.clientConn.ctdQid

                    node.listener_onMQTTMessage = function(data) { node.onMQTTMessage(data); }
                    node.serverConn.on('onMQTTMessage', node.listener_onMQTTMessage);

                    node.listener_onStateUpdate = function(state) { node.onStateUpdate(state); }
                    node.clientConn.on('onStateUpdate', node.listener_onStateUpdate);

                    if (node.serverConn){
                        subscribe()
                        requestState()
                        node.on("input", function(msg) {
                            var cmd = '{"id":"' + node.qid + '","type":"state","properties":{"' + msg.topic + '":' + msg.payload + '}}'
                            var topic = "cloudapp/QBUSMQTTGW/" + node.ctdQid + "/" + node.qid + "/setState"
                            node.serverConn.mqtt.publish(topic, cmd,
                                    {'qos':parseInt(node.serverConn.config.mqtt_qos||0)},
                                    function(err) {
                                        if (err) {
                                            node.error(err);
                                        }
                            });
                        })

                        node.on('close', function(done) {
                            done();
                        })
                    } 

                    function requestState() {
                        var devs = []
                        devs.push(node.qid)
                        var cmd = JSON.stringify(devs);
                        var topic = "cloudapp/QBUSMQTTGW/getState"

                        node.serverConn.mqtt.publish(topic, cmd,
                                {'qos':parseInt(node.serverConn.config.mqtt_qos||0)},
                                function(err) {
                                    if (err) {
                                        node.error(err);
                                    }
                        });
                    }

                    function subscribe() {
                        node.serverConn.subscribeMQTT("cloudapp/QBUSMQTTGW/" + node.ctdQid + "/" + node.qid + "/state")
                        node.serverConn.subscribeMQTT("cloudapp/QBUSMQTTGW/" + node.ctdQid + "/" + node.qid + "/event")
                    }
                } else {
                    node.status({fill:"red", shape:"dot", text:"No output selected."})
                }
            }else {
                node.status({fill:"red", shape:"dot", text:"No controller configured."})
            }
        }

        onStateUpdate(state) {
            var node = this;
            var  msg = {}
            msg.payload = state.payload;
            
            if (state.state === true){
                node.status({fill:"green", shape:"dot", text:"Connected."});
            } else if (state.payload == "No connection with MQTT Server"){
                node.status({fill:"red", shape:"dot", text:"No connection with MQTT Server."});
            } else if (state.payload == "Connected with MQTT Server"){
                node.status({fill:"red", shape:"dot", text:"Connected with MQTT Server."});
            } else if (state.state === false){
                node.status({fill:"red", shape:"dot", text:"No connection with controller."});
            }
        }
    
        onMQTTMessage(topic, message) {
            var node = this;
            var pl = JSON.parse(topic.payload)
            var  msg = {}
            if (node.qid === pl.id) {
                if (pl.properties.hasOwnProperty("value")){
                    msg.topic = "value";
                    msg.payload = pl.properties.value;
                    node.status({fill:"green", shape:"ring", text:"Value: " + msg.payload});
                }
                node.send(msg);
            }
        }
}
    RED.nodes.registerType("qbus-bistabiel",QbusBistabielNode);
}