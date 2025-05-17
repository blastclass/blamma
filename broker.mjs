var db
var clients = []
var msgQueue = []
var req = indexedDB.open('blamma',1)
req.onupgradeneeded = function ( e ) {
  var idb = e.target.result
  idb.createObjectStore('uns',{keyPath:'topic'})
}
req.onsuccess = function ( e ) {
  db = e.target.result
  // Flush any queued messages now that db is ready
  msgQueue.forEach(({msg, port}) => handleMessage(msg, port))
  msgQueue = []
}
onconnect = function ( e ) {
  var port = e.ports[0]
  clients.push(port)
  port.onmessage = function ( evt ) {
    if (!db) {
      msgQueue.push({msg: evt.data, port})
    } else {
      handleMessage( evt.data, port )
    }
  }
  port.start()
}
function handleMessage ( msg, port ) {
  if(msg == null || typeof msg !== 'object') return
  if ( msg.type == 'PUB' ) {
    if (!db) return msgQueue.push({msg, port})
    save( msg.topic, msg.payload, function () {
      broadcast( msg )
    })
  }
  if ( msg.type == 'GET' ) {
    if (!db) return msgQueue.push({msg, port})
    get( msg.topic, function ( value ) {
      port.postMessage({type:'SYS',topic:msg.topic,payload:value})
    })
  }
  if ( msg.type == 'SUB' ) {
    port.postMessage({type:'SYS',topic:'subscribed',payload:msg.topic})
  }
}
function save ( topic, payload, cb ) {
  if (!db) return typeof cb === "function" && cb(false)
  var tx = db.transaction('uns','readwrite')
  var store = tx.objectStore('uns')
  var r = store.put({topic:topic,payload:payload})
  r.onsuccess = function () {
    cb()
  }
  r.onerror = function () {
    broadcast({type:'ERR',topic:topic})
  }
}
function get ( topic, cb ) {
  if (!db) return typeof cb === "function" && cb(undefined)
  var tx = db.transaction('uns')
  var store = tx.objectStore('uns')
  var r = store.get(topic)
  r.onsuccess = function () {
    cb(r.result && r.result.payload)
  }
}
function broadcast ( msg ) {
  for ( var i = 0; i < clients.length; i++ ) {
    try { clients[i].postMessage(msg) } catch (e) {/* ignore */}
  }
}