var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  initialize: function() {
    this.on('creating', function(model, attrs, options) {
      var salt = bcrypt.genSaltSync(10);
      var hashedPassword = bcrypt.hashSync(model.get('password'), salt);
      model.set('password', hashedPassword);
      model.set('salt', salt);
    });
  }
});

module.exports = User;