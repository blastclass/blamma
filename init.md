#### broker.mjs
```javascript
var db
var clients = []
var req = indexedDB.open('blamma',1)
req.onupgradeneeded = function ( e ) {
  var idb = e.target.result
  idb.createObjectStore('uns',{keyPath:'topic'})
}
req.onsuccess = function ( e ) {
  db = e.target.result
}
onconnect = function ( e ) {
  var port = e.ports[0]
  clients.push(port)
  port.onmessage = function ( evt ) {
    handleMessage( evt.data, port )
  }
  port.start()
}
function handleMessage ( msg, port ) {
  if ( msg.type == 'PUB' ) {
    save( msg.topic, msg.payload, function () {
      broadcast( msg )
    })
  }
  if ( msg.type == 'GET' ) {
    get( msg.topic, function ( value ) {
      port.postMessage({type:'SYS',topic:msg.topic,payload:value})
    })
  }
  if ( msg.type == 'SUB' ) {
    port.postMessage({type:'SYS',topic:'subscribed',payload:msg.topic})
  }
}
function save ( topic, payload, cb ) {
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
  var tx = db.transaction('uns')
  var store = tx.objectStore('uns')
  var r = store.get(topic)
  r.onsuccess = function () {
    cb(r.result && r.result.payload)
  }
}
function broadcast ( msg ) {
  for ( var i = 0; i < clients.length; i++ ) {
    clients[i].postMessage(msg)
  }
}
``` 
#### client.mjs
```javascript
var worker = new SharedWorker('broker.mjs')
var port = worker.port
port.start()
export function send ( msg ) {
  port.postMessage(msg)
}
export function onMessage ( fn ) {
  port.onmessage = function ( e ) {
    fn(e.data)
  }
}
``` 
#### shared-checkbox.js
```javascript
import {send,onMessage} from './client.mjs'
class SharedCheckbox extends HTMLElement {
  constructor () {
    super()
    var shadow = this.attachShadow({mode:'open'})
    var cb = document.createElement('input')
    cb.type = 'checkbox'
    this.appendChild(shadow)
    shadow.appendChild(cb)
    cb.addEventListener('change',function () {
      send({type:'PUB',topic:this.id+'/checked',payload:this.checked})
      send({type:'GET',topic:this.id+'/checked'})
    }.bind(this))
    onMessage(function ( msg ) {
      if ( msg.topic == this.id+'/checked' ) {
        cb.checked = msg.payload
      }
    }.bind(this))
  }
  connectedCallback () {
    var t = this.id+'/checked'
    send({type:'GET',topic:t})
    send({type:'SUB',topic:t})
  }
}
customElements.define('shared-checkbox',SharedCheckbox)
``` 
#### shared-debug.js
```javascript
import {send,onMessage} from './client.mjs'
class SharedDebug extends HTMLElement {
  constructor () {
    super()
    var shadow = this.attachShadow({mode:'open'})
    var wrap = document.createElement('div')
    wrap.style.cssText = 'position:fixed;bottom:0;height:30%;width:100%;opacity:0.5;background:#000'
    var ta = document.createElement('textarea')
    ta.style.width = '100%'
    ta.style.height = '100%'
    wrap.appendChild(ta)
    shadow.appendChild(wrap)
    wrap.addEventListener('click',function () { wrap.style.display = wrap.style.display=='none'? 'block':'none' })
    onMessage(function ( msg ) {
      if ( msg.type=='BIR'||msg.type=='BYE'||msg.type=='ERR' ) {
        ta.value += JSON.stringify(msg)+'\n'
      }
    })
  }
}
customElements.define('shared-debug',SharedDebug)
``` 
#### shared-selectMultiple.js
```javascript
import {send,onMessage}from './client.mjs'
class SharedSelectMultiple extends HTMLElement {
  constructor () {
    super()
    var sel = document.createElement('select')
    sel.multiple = true
    this.appendChild(sel)
    onMessage(function ( msg ) {
      if ( msg.topic=='HOT' ) {
        sel.innerHTML = msg.payload.map(function ( t ) { return '<option>'+t+'</option>' }).join('')
      }
    })
    sel.addEventListener('change',function () {
      Array.from(sel.selectedOptions).forEach(function ( opt ) {
        send({type:'SUB',topic:opt.value})
      })
    })
  }
  connectedCallback () {
    send({type:'GET',topic:'HOT'})
  }
}
customElements.define('shared-selectMultiple',SharedSelectMultiple)
``` 
#### shared-tabs.js
```javascript
import {send,onMessage}from './client.mjs'
class SharedTabs extends HTMLElement {
  constructor () {
    super()
    var div = document.createElement('div')
    this.appendChild(div)
    onMessage(function ( msg ) {
      if ( msg.topic=='BIR' ) {
        var id = msg.payload.clientID
        div.innerHTML += '<button>'+id+'</button>'
      }
    })
  }
  connectedCallback () {
    send({type:'GET',topic:'clients'})
    send({type:'SUB',topic:'BIR'})
  }
}
customElements.define('shared-tabs',SharedTabs)
``` 
#### broker-telemetry.js
```javascript
import {send,onMessage}from './client.mjs'
class BrokerTelemetry extends HTMLElement {
  constructor () {
    super()
    var pre = document.createElement('pre')
    this.appendChild(pre)
    send({type:'SUB',pattern:'$SYS/*'})
    onMessage(function ( msg ) {
      if ( msg.topic.indexOf('$SYS/')==0 ) {
        pre.textContent = JSON.stringify(msg)+'\n'+pre.textContent
      }
    })
  }
}
customElements.define('broker-telemetry',BrokerTelemetry)
``` 
#### shared-toast.js
```javascript
import {send,onMessage}from './client.mjs'
class SharedToast extends HTMLElement {
  constructor () {
    super()
    onMessage(function ( msg ) {
      if ( msg.topic=='toast' ) {
        var d = document.createElement('div')
        d.textContent = msg.payload
        document.body.appendChild(d)
        setTimeout(function () { document.body.removeChild(d) },3000)
      }
    })
    send({type:'SUB',topic:'toast'})
  }
}
customElements.define('shared-toast',SharedToast)
``` 
#### mode-line.js
```javascript
import {send}from './client.mjs'
class ModeLine extends HTMLElement {
  constructor () {
    super()
    var inp = document.createElement('input')
    inp.placeholder = 'topic'
    this.appendChild(inp)
    inp.addEventListener('keydown',function ( e ) {
      if ( e.key=='Enter' ) {
        send({type:'PUB',topic:inp.value,payload:null})
      }
    })
  }
}
customElements.define('mode-line',ModeLine)
``` 
#### shared-slider.js
```javascript
import {send,onMessage}from './client.mjs'
class SharedSlider extends HTMLElement {
  constructor () {
    super()
    var s = document.createElement('input')
    s.type = 'range'
    this.appendChild(s)
    s.addEventListener('input',function () {
      send({type:'PUB',topic:this.id+'/value',payload:s.value})
    }.bind(this))
    onMessage(function ( msg ) {
      if ( msg.topic==this.id+'/value' ) {
        s.value = msg.payload
      }
    }.bind(this))
  }
  connectedCallback () {
    send({type:'GET',topic:this.id+'/value'})
    send({type:'SUB',topic:this.id+'/value'})
  }
}
customElements.define('shared-slider',SharedSlider)
``` 
#### shared-theme.js
```javascript
import {send,onMessage}from './client.mjs'
class SharedTheme extends HTMLElement {
  constructor () {
    super()
    var sel = document.createElement('select')
    ['gruvbox','light','dark'].forEach(function ( t ) {
      sel.innerHTML += '<option>'+t+'</option>'
    })
    this.appendChild(sel)
    sel.addEventListener('change',function () {
      send({type:'PUB',topic:'theme',payload:sel.value})
    })
    onMessage(function ( msg ) {
      if ( msg.topic=='theme' ) {
        document.documentElement.setAttribute('data-theme',msg.payload)
      }
    })
    send({type:'GET',topic:'theme'})
    send({type:'SUB',topic:'theme'})
  }
}
customElements.define('shared-theme',SharedTheme)
``` 
#### mouse-sensor.js
```javascript
import {send}from './client.mjs'
var evs = ['click','mousemove','mousedown','mouseup']
class MouseSensor extends HTMLElement {
  constructor () {
    super()
    evs.forEach(function ( e ) {
      window.addEventListener(e,function ( ev ) {
        send({type:'PUB',topic:'mouse/'+e,payload:{x:ev.clientX,y:ev.clientY}})
      })
    })
  }
}
customElements.define('mouse-sensor',MouseSensor)
``` 
#### hotkey-sensor.js
```javascript
import {send}from './client.mjs'
class HotkeySensor extends HTMLElement {
  constructor () {
    super()
    var combo = this.getAttribute('combo')
    window.addEventListener('keydown',function ( e ) {
      if ( e.key == combo ) {
        send({type:'PUB',topic:'hotkey/'+combo,payload:{}})
      }
    })
  }
}
customElements.define('hotkey-sensor',HotkeySensor)
``` 
#### demo.html
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SCADA MQTT UI Demo</title>
  <script type="module" src="client.mjs"></script>
  <script type="module" src="shared-checkbox.js"></script>
  <script type="module" src="shared-debug.js"></script>
  <script type="module" src="shared-selectMultiple.js"></script>
  <script type="module" src="shared-tabs.js"></script>
  <script type="module" src="broker-telemetry.js"></script>
  <script type="module" src="shared-toast.js"></script>
  <script type="module" src="mode-line.js"></script>
  <script type="module" src="shared-slider.js"></script>
  <script type="module" src="shared-theme.js"></script>
  <script type="module" src="mouse-sensor.js"></script>
  <script type="module" src="hotkey-sensor.js"></script>
  <script type="module" src="demo.js"></script>
</head>
<body>
  <h1>SCADA MQTT UI Demo</h1>
  <section>
    <h2>Checkbox</h2>
    <shared-checkbox id="ck1"></shared-checkbox>
    <label for="ck1">Checkbox 1</label>
  </section>
  <section>
    <h2>Select Multiple</h2>
    <shared-selectMultiple></shared-selectMultiple>
  </section>
  <section>
    <h2>Tabs</h2>
    <shared-tabs></shared-tabs>
  </section>
  <section>
    <h2>Broker Telemetry</h2>
    <broker-telemetry></broker-telemetry>
  </section>
  <section>
    <h2>Debug Panel</h2>
    <shared-debug></shared-debug>
  </section>
  <section>
    <h2>Toast</h2>
    <shared-toast></shared-toast>
    <button id="toastBtn">Trigger Toast</button>
  </section>
  <section>
    <h2>Mode Line</h2>
    <mode-line></mode-line>
  </section>
  <section>
    <h2>Slider</h2>
    <shared-slider id="slider1"></shared-slider>
  </section>
  <section>
    <h2>Theme Selector</h2>
    <shared-theme></shared-theme>
  </section>
  <section>
    <h2>Mouse Sensor</h2>
    <mouse-sensor></mouse-sensor>
  </section>
  <section>
    <h2>Hotkey Sensor (Enter)</h2>
    <hotkey-sensor combo="Enter"></hotkey-sensor>
  </section>
</body>
</html>
``` 
#### demo.js
```javascript
import {send} from './client.mjs'

document.addEventListener('DOMContentLoaded', function () {
  var clientID = window.location.pathname.split('/').pop()
  send({type:'BIR',payload:{clientID}})
  send({type:'GET',topic:'HOT'})

  var btn = document.getElementById('toastBtn')
  btn.addEventListener('click', function () {
    send({type:'PUB',topic:'toast',payload:'Hello from Demo!'})
  })
})
```
