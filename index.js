var _       = require('lodash')
var log     = require('blunt-log')
var thru    = require('through')

var o = module.exports = function(socket) {
  var s = thru(function(data) { this.queue(data) })

  var req = { _sok: socket }

  var verbs = ['get','post', 'put', 'del']

  socket.on('json', function(data) {
    var meth  = _.intersection(_.keys(data), verbs)
    req.uri = data[meth]
    req.body = data.body || {}
    req.meth = meth

    //log('REQ setup json', socket.id, req.meth, req.uri, req.body.key)

    s.write(req)
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

  //s.autoDestroy = false
  return s
}

o.rooster = function() {
  var R = require('nym')()
  return R
}

o.router = function(R) {
  var res = thru(function(data) {
    s.queue(data)
  })

  var s = thru(function(req) {
    var self = this
    var ctx = R.test(req.meth, req.uri);
    if(ctx) ctx.fn.call(ctx, req, res)
    else log.err('unknown route', req._sok.id, req.meth, req.uri,req._user)
  })

  return s
}

o.out = function(socket) {
  var ts =  thru(function(res) {
    //log.err('FIRE OUT', socket.id)
    var clients = socket.server.clients
    Object.keys(clients).forEach(function(ck) {
      clients[ck].json(res)
    })
    //socket.json(res)
  })
  return ts
}
