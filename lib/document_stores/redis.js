var redis = require('redis');
var winston = require('winston');
var fs = require('fs');

// For storing in redis
// options[type] = redis
// options[host] - The host to connect to (default localhost)
// options[port] - The port to connect to (default 5379)
// options[db] - The db to use (default 0)
// options[expire] - The time to live for each key set (default never)

var RedisDocumentStore = function (options, client) {
    this.basePath = options.path || './data';
    this.keySetTag = options.keySetTag || 'tag';
    this.keySetDocument = options.keySetDocument || 'documents';
    this.expire = options.expire;
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
// Save file in a key
RedisDocumentStore.prototype.set = function (key, data, callback) {
    var _this = this;
    RedisDocumentStore.client.set(key, data, function (err) {
        if (err) {
            callback(false);
        } else {
            fs.mkdir(_this.basePath, '700', function () {
                var fn = _this.basePath + '/' + key;
                fs.writeFile(fn, data, 'utf8', function (err) {
                    callback(err ? false : true);
                });
                winston.info('file : ' + key + ' created in hierarchy');
            });
        }
    });
};

// Search data in files
RedisDocumentStore.prototype.search = function (data, callback) {
    var _result = [];
    RedisDocumentStore.client.keys("*" + data + "*", function (err, reply) {
        if (err) {
            callback(err);
        } else {
            var itemsProcessed = 0;
            reply.forEach(function (element) {
                itemsProcessed++;
                if (element.indexOf(":") === -1 ) {
                    _result.push(element);
                }
                if (itemsProcessed === reply.length) {
                    callback(_result);
                }
            });
        }
    });
};

// Search Tag in database
RedisDocumentStore.prototype.searchTag = function (data, callback) {
     RedisDocumentStore.client.llen("tag:"+ data, function (err, res) {
        if (err) {
            callback(false);
        } else {
            RedisDocumentStore.client.lrange("tag:"+data, 0, res, function (err, keys) {
                callback(err ? false : keys);
            });
        }
    });
};

// Save file in a key
RedisDocumentStore.prototype.setDocument = function (key, callback) {
    var _this = this;
    RedisDocumentStore.client.lpush(_this.keySetDocument, key, function (err) {
        callback(err ? false : true);
    });
};


// Save associate tag of the document
RedisDocumentStore.prototype.setTag = function (key, data, callback) {
    var _this = this;
    data.forEach(function (element) {
        // On ajoute le document au set du tag        
        RedisDocumentStore.client.lpush(_this.keySetTag + ":" + element, key, function (err) {
            if (err) {
                callback(false);
            }
            ;
        });
    });
    data.forEach(function (element) {
        // Puis on ajoute la liste de tags au set du document
        RedisDocumentStore.client.lpush(key + ":" + _this.keySetTag, element, function (err) {
            callback(err ? false : true);
        });
    });
};



// Expire a key in expire time if set
RedisDocumentStore.prototype.setExpiration = function (key) {
    if (this.expire) {
        RedisDocumentStore.client.expire(key, this.expire, function (err) {
            if (err) {
                winston.error('failed to set expiry on key: ' + key);
            }
        });
    }
};
// Get a file from a key
RedisDocumentStore.prototype.get = function (key, callback, skipExpire) {
    var _this = this;
    RedisDocumentStore.client.get(key, function (err, reply) {
        if (!err && !skipExpire) {
            _this.setExpiration(key);
        }
        callback(err ? false : reply);
    });
};
// Get all 
RedisDocumentStore.prototype.getAll = function (callback) {
    var _this = this;
    RedisDocumentStore.client.lrange(_this.keySetDocument, 0, 10, function (err, keys) {
        callback(err ? false : keys);
    });
};

// Get all tags for clouds
RedisDocumentStore.prototype.getAllCloudTags = function (callback) {
    var _result = [];
    RedisDocumentStore.client.keys("tag:*", function (err, keys) {
        if (err) {
            callback(false);
        } else {
            var itemsProcessed = 0;
            keys.forEach(function (element) {
                RedisDocumentStore.client.llen(element, function (err, res) {
                    _result.push({text: element.substring(4, element.lenght), weight: res});
                    itemsProcessed++;
                    if (itemsProcessed === keys.length) {
                        callback(_result);
                    }
                });
            });
        }
    });
};

// Get all tags
RedisDocumentStore.prototype.getAllTags = function (callback) {
    var _result = [];
    RedisDocumentStore.client.keys("tag:*", function (err, keys) {
        if (err) {
            callback(false);
        } else {
            var itemsProcessed = 0;
            keys.forEach(function (element) {
                _result.push(element.substring(4, element.lenght));
                itemsProcessed++;
                if (itemsProcessed === keys.length) {
                    callback(_result);
                }
            });
        }
    });
};


// Get all tags of a element
RedisDocumentStore.prototype.getTags = function (key, callback) {
    RedisDocumentStore.client.llen(key + ":tag", function (err, res) {
        if (err) {
            callback(false);
        } else {
            RedisDocumentStore.client.lrange(key + ":tag", 0, res, function (err, keys) {
                callback(err ? false : keys);
            });
        }
    });
};

module.exports = RedisDocumentStore;
