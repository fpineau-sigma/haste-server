var winston = require('winston');
var Busboy = require('busboy');
var Promise = require('promise');

// For handling serving stored documents

var DocumentHandler = function (options) {
    if (!options) {
        options = {};
    }
    this.keyLength = options.keyLength || DocumentHandler.defaultKeyLength;
    this.maxLength = options.maxLength; // none by default
    this.store = options.store;
    this.keyGenerator = options.keyGenerator;
};

DocumentHandler.defaultKeyLength = 10;

// Handle retrieving all documents
DocumentHandler.prototype.handleGetAll = function (response) {
    this.store.getAll(function (ret) {
        if (ret) {
            winston.verbose('retrieved all documents.');
            response.writeHead(200, {'content-type': 'application/json'});
            response.end(JSON.stringify({data: ret}));
        } else {
            winston.warn('documents not found');
            response.writeHead(404, {'content-type': 'application/json'});
            response.end(JSON.stringify({message: 'Documents not found.'}));
        }
    });
};

// Handle retrieving all tags
DocumentHandler.prototype.handleGetAllTags = function (response) {
    this.store.getAllTags(function (ret) {
        if (ret) {
            winston.verbose('retrieved all document');
            response.writeHead(200, {'content-type': 'application/json'});
            response.end(JSON.stringify({data: ret}));
        } else {
            winston.warn('documents not found');
            response.writeHead(404, {'content-type': 'application/json'});
            response.end(JSON.stringify({message: 'Documents not found.'}));
        }
    });
};

// Handle search elements in files
DocumentHandler.prototype.handleSearch = function (request, response) {
    var _this = this;
    var promiseKey = function (_key) {
        return new Promise(function (resolve, reject) {
            _this.store.search(_key, function (res) {
                if (res) {
                    winston.verbose('Promise 1 : search in key', {key: _key, res: res});
                    resolve(res);
                } else {
                    winston.verbose('error getting element');
                    reject(false);
                }
            });
        });
    };

    var promiseTag = function (_key) {
        return new Promise(function (resolve, reject) {
            _this.store.searchTag(_key, function (res) {
                if (res) {
                    resolve(res);
                } else {
                    winston.verbose('error getting element');
                    reject(false);
                }
            });
        });
    };


    var _promises = [];
    //Check Input
    request.on('data', function (data) {
        var data_json = JSON.parse(data);
        if (data_json.keys[0] !== "") {
            data_json.keys.forEach(function (key) {
                _promises.push(promiseKey(key));
            });
        }
        if (data_json.tags !== null) {
            data_json.tags.forEach(function (tag) {
                _promises.push(promiseTag(tag));
            });
        }
    });

    request.on('end', function () {
        Promise.all(_promises).then(values => {
            winston.verbose('retrieved all searches documents', values);
            response.writeHead(200, {'content-type': 'application/json'});
            response.end(JSON.stringify({key : values[0], tags : values[1]}));
        }, reason => {
            winston.warn('documents not found');
            response.writeHead(404, {'content-type': 'application/json'});
            response.end(JSON.stringify({message: 'Documents not found.'}));
        });
    });
};

// Handle retrieving all tags for cloud tag
DocumentHandler.prototype.getAllCloudTags = function (response) {
    this.store.getAllCloudTags(function (ret) {
        if (ret) {
            winston.verbose('retrieved all document');
            response.writeHead(200, {'content-type': 'application/json'});
            response.end(JSON.stringify({data: ret}));
        } else {
            winston.warn('documents not found');
            response.writeHead(404, {'content-type': 'application/json'});
            response.end(JSON.stringify({message: 'Documents not found.'}));
        }
    });
};

// Handle retrieving a document
DocumentHandler.prototype.handleGet = function (key, response) {
    var _this = this;
    var promise1 = function (_key) {
        return new Promise(function (resolve, reject) {
            _this.store.get(_key, function (res) {
                if (res) {
                    resolve(res);
                } else {
                    winston.verbose('error getting document');
                    reject(false);
                }
            });
        });
    };

    var promise2 = function (_key) {
        return new Promise(function (resolve, reject) {
            _this.store.getTags(_key, function (res) {
                if (res) {
                    resolve(res);
                } else {
                    winston.verbose('error getting element');
                    reject(false);
                }
            });
        });
    };

    Promise.all([promise1(key), promise2(key)]).then(values => {
        response.writeHead(200, {'content-type': 'application/json'});
        response.end(JSON.stringify({key: key, data: values[0], tags: values[1]}));
    }, reason => {
        winston.verbose('error getting document');
        response.writeHead(500, {'content-type': 'application/json'});
        response.end(JSON.stringify({message: 'Error getting document.'}));
    });

};

// Handle retrieving the raw version of a document
DocumentHandler.prototype.handleRawGet = function (key, response, skipExpire) {
    this.store.get(key, function (ret) {
        if (ret) {
            response.writeHead(200, {'content-type': 'text/plain'});
            response.end(ret);
        } else {
            winston.warn('raw document not found', {key: key});
            response.writeHead(404, {'content-type': 'application/json'});
            response.end(JSON.stringify({message: 'Document not found.'}));
        }
    }, skipExpire);
};

// Handle adding a new Document
DocumentHandler.prototype.handlePost = function (request, response) {
    var _this = this;
    var buffer; // Données à intégrer
    var tags; // Tags liées aux données
    var title; // Titre des données
    var cancelled = false;

    var promise2 = function (_key, _buffer) {
        return new Promise(function (resolve, reject) {
            _this.store.set(_key, _buffer, function (res) {
                if (res) {
                    winston.verbose('Promise 2 : added document', {key: _key});
                    resolve("Tag success added");
                } else {
                    winston.verbose('error adding document');
                    reject("Error adding tag");
                }
            });
        });
    };

    var promise1 = function (_key, _tags) {
        return new Promise(function (resolve, reject) {
            _this.store.setTag(_key, _tags, function (res) {
                if (res) {
                    winston.verbose('Promise 1 : added tag', {key: _key});
                    resolve("Tag success added");
                } else {
                    winston.verbose('error adding tag');
                    reject("Error adding tag");
                }
            });
        });
    };

    var promise3 = function (_key) {
        return new Promise(function (resolve, reject) {
            _this.store.setDocument(_key, function (res) {
                if (res) {
                    winston.verbose('Promise 3 : added document to list', {key: _key});
                    resolve("Tag success added");
                } else {
                    winston.verbose('error adding document to list');
                    reject("Error adding document to list");
                }
            });
        });
    };


    // What to do when done
    var onSuccess = function () {
        // Check length
        if (_this.maxLength && buffer.length > _this.maxLength) {
            cancelled = true;
            winston.warn('document >maxLength', {maxLength: _this.maxLength});
            response.writeHead(400, {'content-type': 'application/json'});
            response.end(JSON.stringify({message: 'Document exceeds maximum length.'}));
            return;
        }

        // And then save if we should
        //_this.chooseKey(function (key) {
        Promise.all([promise1(title, tags), promise2(title, buffer), promise3(title)]).then(values => {
            winston.verbose('Promises All added document', {key: title});
            response.writeHead(200, {'content-type': 'application/json'});
            response.end(JSON.stringify({key: title}));
        }, reason => {
            winston.verbose('error adding document');
            response.writeHead(500, {'content-type': 'application/json'});
            response.end(JSON.stringify({message: 'Error adding document.'}));
        });
        //});

    };

    // If we should, parse a form to grab the data
    var ct = request.headers['content-type'];
    if (ct && ct.split(';')[0] === 'multipart/form-data') {
        var busboy = new Busboy({headers: request.headers});
        busboy.on('field', function (fieldname, val) {
            if (fieldname === 'data') {
                buffer = val;
            }
        });
        busboy.on('finish', function () {
            onSuccess();
        });
        request.pipe(busboy);
        // Otherwise, use our own and just grab flat data from POST body
    } else {
        request.on('data', function (data) {
            var data_json = JSON.parse(data);
            buffer = data_json.data;
            tags = data_json.tags;
            title = data_json.title;
        });
        request.on('end', function () {
            if (cancelled) {
                return;
            }
            onSuccess();
        });
        request.on('error', function (error) {
            winston.error('connection error: ' + error.message);
            response.writeHead(500, {'content-type': 'application/json'});
            response.end(JSON.stringify({message: 'Connection error.'}));
            cancelled = true;
        });
    }
};

// Keep choosing keys until one isn't taken
DocumentHandler.prototype.chooseKey = function (callback) {
    var key = this.acceptableKey();
    var _this = this;
    this.store.get(key, function (ret) {
        if (ret) {
            _this.chooseKey(callback);
        } else {
            callback(key);
        }
    }, true); // Don't bump expirations when key searching
};

DocumentHandler.prototype.acceptableKey = function () {
    return this.keyGenerator.createKey(this.keyLength);
};

module.exports = DocumentHandler;
