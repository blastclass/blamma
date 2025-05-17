var worker, port
try {
  worker = new SharedWorker('broker.mjs')
  port = worker.port
  port.start()
} catch (e) {
  console.error("SharedWorker failed to start:", e)
}
export function send ( msg ) {
  if (!port) return
  try {
    port.postMessage(msg)
  } catch (e) {
    console.error("Error posting message to SharedWorker:", e)
  }
}
export function onMessage ( fn ) {
  if (!port) return
  port.onmessage = function ( e ) {
    fn(e.data)
  }
}