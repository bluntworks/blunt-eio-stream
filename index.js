var thru    = require('through')
var eiojson = require('eiojson')

var o = module.exports = function(socket) {
  //simple pass through of json
  var s = thru(function(data) { this.queue(data) })
  eiojson(socket)
  socket.on('json', function(data) {
    if(!data._sok) data._sok = socket
    s.write(data)
  })
  return s
}



//Get Session info
//TODO move this to sep module
var cookie = require('cookie')

function getsid(cookies, cfg) {
  var sid = cookies['connect.sid']
  return 0 == sid.indexOf('s:')
    ? sig.unsign(sid.slice(2), cfg.session.secret)
    : sid
}


o.session = function(app) {
  var s = thru(function(o) {
    var _sok    = o._sok
    var cookies = cookie.parse(_sok.request.headers.cookie)
    var sid     = getsid(cookies, app.cfg)
    var sdb     = app.sdb.sublevel('sessions')
    var users   = app.users

    sdb.get(sid, function(err, sess) {
      if(err || !sess) return self.emit('error', new Error('no session'))
      users.get(sess.user, function(err, u) {
        if(err || !u) return self.emit('error', new Error('no user'))
        delete u.salt
        o._user = u
        //pass it on
        self.queue(o)
      })
    })
  })

  return s
}



