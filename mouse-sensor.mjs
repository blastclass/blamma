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