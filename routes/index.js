var express = require('express');
var router = express.Router();
var url = 'mongodb://127.0.0.1:27017/sanyidb';

/* GET home page. */
router.get('/points/:userid', function(req, res, next) {
	var result = {};
	var mongodb = require('mongodb');
	var MongoClient = mongodb.MongoClient;
	var points = 0;
	MongoClient.connect(url, function (err, db) {
		var result;
		if (err) {
			console.log('Unable to connect to the mongoDB server. Error:', err);
			result = {"result":"failed", "cause": "db issue" + err};
		} else {
			console.log('Connection established to', url);
			db.collection('users',function(err,users){
				if(err){
					res.render('index', { title: 'Takemytrash', 'points': -1 });
				} else {
					users.find({userID: req.params.userid }).toArray(function(err, docs) {
						console.log("err",err);
						console.log("token",docs);
						if(docs.length){
							points = docs[0].points;
							console.log(points);
							res.render('index', { title: 'Takemytrash', 'points': points, error: false, 'userid': req.params.userid });
						} else {
							res.render('index', { title: 'Takemytrash', 'points': -2, error: true, 'userid': req.params.userid });
						}
					});
				}
			});
		}
	});
});

router.get('/', function(req, res, next) {
	res.render('help', { title: 'Takemytrash Server on Azure' });
});

router.get('/trashevent', function(req, res, next) {
	var result = {"result":"error", "cause": "requires a trash count and bin ID parameter: /trashevent/1/2"};
	res.json(result);
});

function addBinStat(db, trashcount, binid){
	db.collection('binstats',function(err,collection){
		var obj = {
			"createdAt": new Date(),
			"trashCount": trashcount,
			"binID": binid,
			"capacity": 100
		};

		collection.insert(obj, function (err, result) {
			if (err) {
				console.log(err);
			} else {
				console.log('Inserted %d documents into the "binstats" collection. The documents inserted with "_id" are:', result.length, result);
			}
		});
	});
}

function registerUserPoints(db, userid, points){
	console.log("registerUserPoints userid: " + userid + " points: " + points);
	var points = parseInt(points);
	db.collection('users',function(err,collection){
		console.log("err",err);
		if(!err){
			collection.find({userID: userid }).toArray(function(err, docs) {
				if(docs.length < 1){
					console.log("user not found, creating: ", userid);
					var obj = {
						'userID': userid,
						points: 0
					};
					collection.insert(obj, function (err, result) {
						if (err) {
							console.log(err);
						} else {
							console.log('Inserted %d documents into the "token" collection. The documents inserted with "_id" are:', result.length, result);
						}
					});
				}

				console.log("user found, updating: ", userid);
				collection.update({"userID": userid}, {$inc: {"points": points}}, function (err, result) {
					if (err) {
						console.log(err);
					} else {
						console.log('Updated user points: ' + userid + " with " + points + " points.");
					}
				});

			});
		}
	});
}

router.get('/trashevent/:trashcount/:binid', function(req, res, next) {
	var crypto = require('crypto')
  	, shasum = crypto.createHash('sha1');
  	var str = new Date().getTime().toString();
	shasum.update(str);
	var hash = shasum.digest('hex');

	var mongodb = require('mongodb');
	var MongoClient = mongodb.MongoClient;
	MongoClient.connect(url, function (err, db) {
		if (err) {
			console.log('Unable to connect to the mongoDB server. Error:', err);
		} else {
			console.log('Connection established to', url);

			db.collection('tokens',function(err,collection){
				collection.createIndex( { "createdAt": 1 }, { expireAfterSeconds: 30 } );
				var obj = {
					"createdAt": new Date(),
					"trashCount": req.params.trashcount,
					"binID": req.params.binid,
					"code": hash
				};

				collection.insert(obj, function (err, result) {
					if (err) {
						console.log(err);
					} else {
						console.log('Inserted %d documents into the "token" collection. The documents inserted with "_id" are:', result.length, result);
					}
				});
			});

			addBinStat(db, req.params.trashcount, req.params.binid);
		}
	});
	var result = {"result":"success", "code": hash, "trashcount": req.params.trashcount };

	res.json(result);
});

router.get('/initbin', function(req, res, next) {
	var result = {"result":"error", "cause": "requires a bin id parameter: /initbin/1"};
	res.json(result);
});

router.get('/initbin/:binid', function(req, res, next) {
	var mongodb = require('mongodb');
	var MongoClient = mongodb.MongoClient;
	MongoClient.connect(url, function (err, db) {
		if (err) {
			console.log('Unable to connect to the mongoDB server. Error:', err);
		} else {
			console.log('Connection established to', url);

			db.collection('bins',function(err,collection){
				if(err){
					console.log("err",err);
				}
				var obj = {
					"createdAt": new Date(),
					"binID": req.params.binid,
					"binIP": req.headers['x-forwarded-for'] || req.connection.remoteAddress
				};

				collection.insert(obj, function (err, result) {
					if (err) {
						console.log(err);
					} else {
						console.log('Inserted %d documents into the "bins" collection. The documents inserted with "_id" are:', result.length, result);
					}
				});
			});
		}
	});
	var result = {"result":"success"};

	res.json(result);
});

router.get('/submitqr', function(req, res, next) {
	var result = {"result":"error", "cause": "requires code parameter: /submitqr/1"};
	res.json(result);
});

router.get('/submitqrt/:code', function(req, res, next) {
	var randPoints = Math.floor(Math.random() * 6) + 1;

	var result = {"result":"success", "points": randPoints};
	if(req.params.code % 2){
		result = {"result":"failed", "cause": "invalid code"};
	}
	res.json(result);
});

router.get('/submitqr/:code/:userid/:token', function(req, res, next) {
	var result = {};
	var mongodb = require('mongodb');
	var MongoClient = mongodb.MongoClient;
	MongoClient.connect(url, function (err, db) {
		if (err) {
			console.log('Unable to connect to the mongoDB server. Error:', err);
			result = {"result":"failed", "cause": "db issue" + err};
		} else {
			console.log('Connection established to', url);

			db.collection('tokens',function(err,collection){
				var token = collection.find({ "code": req.params.code }).toArray(function(err, docs){
					if( docs.length ){
						result = {"result":"success", "points": docs[0].trashCount};
						collection.remove( { "_id": docs[0]._id }, { justOne: true } );
						registerUserPoints(db,  req.params.userid, docs[0].trashCount);
						res.json(result);
						
					} else {
						result = {"result":"failed", "cause": "invalid code"};
						res.json(result);
					}

				});
			});
			
		}
	});
});

router.get('/tokens/', function(req, res, next) {
	var result = {};
	var mongodb = require('mongodb');
	var MongoClient = mongodb.MongoClient;
	MongoClient.connect(url, function (err, db) {
		var result;
		if (err) {
			console.log('Unable to connect to the mongoDB server. Error:', err);
			result = {"result":"failed", "cause": "db issue" + err};
		} else {
			console.log('Connection established to', url);

			db.collection('tokens',function(err,tokens){
				tokens.find().toArray(function(err, docs) {
					console.log("err",err);
					console.log("token",docs);
					result = docs;
					res.json(result);
				});
			});
		}
	});
});

router.get('/bins/', function(req, res, next) {
	var result = {};
	var mongodb = require('mongodb');
	var MongoClient = mongodb.MongoClient;
	MongoClient.connect(url, function (err, db) {
		var result;
		if (err) {
			console.log('Unable to connect to the mongoDB server. Error:', err);
			result = {"result":"failed", "cause": "db issue" + err};
		} else {
			console.log('Connection established to', url);

			db.collection('bins',function(err,tokens){
				tokens.find().toArray(function(err, docs) {
					console.log("err",err);
					console.log("bin",docs);
					result = docs;
					res.json(result);
				});
			});
		}
	});
});

router.get('/ad',function(req, res, next){
	var fs = require('fs');
	fs.readdir('./public/images/ad', function(err, items) {
		var adNumber =  Math.floor(Math.random() * (items.length));
		console.log(adNumber);
		var result = {
			result: 'success',
			url: '/images/ad/' + items[adNumber]
		};
			res.setHeader('Access-Control-Allow-Origin', '*');
		    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
		    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
		    res.setHeader('Access-Control-Allow-Credentials', true);
		res.json(result);
	});
});

module.exports = router;
