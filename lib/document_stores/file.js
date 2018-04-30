var fs = require('fs');
var redis = require('redis');
var crypto = require('crypto');

var winston = require('winston');

// For storing in files
// options[type] = file
// options[path] - Where to store

var FileDocumentStore = function (options) {
    this.basePath = options.path || './data';
    this.expire = options.expire;
};

// Generate md5 of a string
FileDocumentStore.md5 = function (str) {
    var md5sum = crypto.createHash('md5');
    md5sum.update(str);
    return md5sum.digest('hex');
};

// Save data in a file, key as md5 - since we don't know what we could
// be passed here
FileDocumentStore.prototype.set = function (key, data, callback, skipExpire) {
    try {
        var _this = this;
        fs.mkdir(this.basePath, '700', function () {
            var fn = _this.basePath + '/' + FileDocumentStore.md5(key);
            fs.writeFile(fn, data, 'utf8', function (err) {
                if (err) {
                    callback(false);
                } else {
                    callback(true);
                }
            });
        });
    } catch (err) {
        callback(false);
    }
};

// Get data from a file from key
FileDocumentStore.prototype.get = function (key, callback, skipExpire) {
    var _this = this;
    var fn = this.basePath + '/' + FileDocumentStore.md5(key);
    fs.readFile(fn, 'utf8', function (err, data) {
        if (err) {
            callback(false);
        } else {
            callback(data);
            if (_this.expire && !skipExpire) {
                winston.warn('file store cannot set expirations on keys');
            }
        }
    });
};

// Get data from a file from key
FileDocumentStore.prototype.getAll = function (callback) {
    var fn = this.basePath + '/';
    fs.readdir(fn, 'utf8', function (err, files) {
        if (err) {
            callback(false);
        } else {
            callback(files);
        }
    });
};

var RedisDocumentStore = function (options, client) {
    if (client) {
        winston.info('using predefined redis client');
        RedisDocumentStore.client = client;
    } else if (!RedisDocumentStore.client) {
        winston.info('configuring redis');
        RedisDocumentStore.connect(options);
    }
};

// Create a connection according to config
RedisDocumentStore.connect = function (options) {
    var host = options.host || '127.0.0.1';
    var port = options.port || 6379;
    var index = options.db || 0;
    RedisDocumentStore.client = redis.createClient(port, host);
    // authenticate if password is provided
    if (options.password) {
        RedisDocumentStore.client.auth(options.password);
    }
    RedisDocumentStore.client.select(index, function (err) {
        if (err) {
            winston.error(
                    'error connecting to redis index ' + index,
                    {error: err}
            );
            process.exit(1);
        } else {
            winston.info('connected to redis on ' + host + ':' + port + '/' + index);
        }
    });
};

module.exports = FileDocumentStore;
