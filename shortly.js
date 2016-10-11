var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var passport = require('passport');
var GitHubStrategy = require('passport-github2').Strategy;

var GITHUB_CLIENT_ID = 'b250111c0c4e6562bc55';
var GITHUB_CLIENT_SECRET = '139f702a6399364e89c2f01e745d2608b97efbba';

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

/* Setup passport */
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
  clientID: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  callbackURL: 'http://127.0.0.1:4568/auth/github/callback'
}, function(accessToken, refreshToken, profile, done) {
  process.nextTick(function() {
    return done(null, profile);
  });
}));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: 'riyaz\'s secret key',
  cookie: { }
}));
app.use(passport.initialize());
app.use(passport.session());

/* Setup route for github auth */
app.get('/auth/github',
  passport.authenticate('github', {scope: ['user:email']}), function(req, res) {

  });

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    req.session.username = 'github';
    res.redirect('/');
  });

app.get('/', 
function(req, res) {
  util.checkUser(req, res);
  res.render('index');
});

app.get('/create', 
function(req, res) {
  util.checkUser(req, res);
  res.render('index');
});

app.get('/links', 
function(req, res) {
  util.checkUser(req, res);

  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', 
function(req, res) {
  util.checkUser(req, res);

  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/signup', function(req, res) {
  util.checkUserLoggedin(req, res);
  res.render('signup');  
});

app.post('/signup', function(req, res) {
  var userData = req.body;
  var username = userData.username;
  var password = userData.password;

  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      // Need to handle if the user already exists
      res.redirect('/signup');
    } else {
      Users.create({
        username: username,
        password: password
      })
      .then(function(newUser) {
        // after signed up and log in directly the user by setting the session with the username
        req.session.username = username;
        res.redirect('/');
        // need to handler redirection to the landing page with the user logged in.
      });
    }
  });
});

app.get('/login', function(req, res) {
  util.checkUserLoggedin(req, res);
  res.render('login');
});

app.post('/login', function(req, res) {
  var userData = req.body;
  var username = userData.username;
  var password = userData.password;

  new User({ username: username }).fetch().then(function(found) {
    if (found && util.validateCredential(password, found.attributes)) {
      req.session.username = username;
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  });

});

app.get('/logout', function(req, res) {
  req.session.username = undefined;
  res.redirect('/login');
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
