var log     = require('bitlog')
var thru    = require('through')
var eiojson = require('eiojson')

var o = module.exports = function(socket) {
  //simple pass through of json
  var s = thru(function(data) { this.queue(data) })
  eiojson(socket)
  socket.on('json', function(data) {
    var o = {
      _sok: socket,
      body: data
    }
    s.write(o)
  })
  return s
}



//Get Session info
//TODO move this to sep module
var cookie = require('cookie')
var sig    = require('cookie-signature')

function getsid(cookies, cfg) {
  var sid = cookies['connect.sid']
  return 0 == sid.indexOf('s:')
    ? sig.unsign(sid.slice(2), cfg.session.secret)
    : sid
}

o.session = function(app) {
  var s = thru(function(req) {
    var _sok    = req._sok
    var cookies = cookie.parse(_sok.request.headers.cookie)
    var sid     = getsid(cookies, app.cfg)
    var sdb     = app.sdb.sublevel('sessions')
    var users   = app.users

    var self = this
    sdb.get(sid, function(err, sess) {
      if(err || !sess) return self.emit('error', new Error('no session'))
      users.get(sess.user, function(err, u) {
        if(err || !u) return self.emit('error', new Error('no user'))
        delete u.salt
        req._user = u
        req.app = app
        //pass it on
        self.queue(req)
      })
    })
  })

  return s
}

o.router = function() {
  var rooster = require('rooster')()

  var res = thru(function(data) {
    log('res', data)
    s.queue(data)
  })

  var s = thru(function(req) {
    var self = this
    Object.keys(req.body).forEach(function(verb) {
      //log('loop over verbs', verb)
      var ctx = rooster.test(verb, req.body[verb]);
      if(ctx) ctx.fn.call(ctx, req, res)
      else log.err('unknown route', req._sok.id, req.body, req._user)
    })
  })

  s.api = rooster
  return s
}

o.out = function(socket) {
  //eiojson(socket)
  return thru(function(res) {
    log('out', res)
    socket.json(res)
  })

}


