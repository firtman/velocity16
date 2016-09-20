var https  = require("https");
var nedb   = require("nedb");
var url    = require("url");
var crypto = require("crypto");
var ece    = require("http_ece");
var fs     = require("fs");
var urlBase64 = require("urlsafe-base64");

var db    = new nedb({ filename: "users.db", autoload: true });

var GCMKey = "AIzaSyBuoU-dxhfGuB7geAi4TgqIy4viLxwxJLE";
var GCMProject = "733792651336";

// Save message
var message = process.argv[2];
fs.writeFile("public/message.txt", JSON.stringify({text: message}));

db.find({}, function(err, users) {
    users.forEach(function(user) {
        switch (user.type) {
            case "chrome":
                sendToChrome(user);
                break;
            case "webpush":
                sendToWebPush(user);
                break;
            case "safari":
                
                break;
        }
        
    });
});

function sendToWebPush(user) {
    var encrypted = encrypt(user.key, JSON.stringify({text: message}));
    
    var parsedUrl = url.parse(user.endpoint);
    var options = {
      hostname: parsedUrl.host,
      port: 443,
      path: parsedUrl.path,
      method: "POST",
      headers: {
        "Encryption-Key": "keyid=p256dh;dh=" + urlBase64.encode(encrypted.localPublicKey),
        "Encryption": "keyid=p256dh;salt=" + urlBase64.encode(encrypted.salt),   
        "Content-Encoding": "aesgcm128",
        "Content-Type": "application/octet-stream",
        "Content-Length": encrypted.cipherText.length
      }
    };
    var request = https.request(options, function(res) {
       if (res.statusCode==200 || res.statusCode==201) {
           console.log("User was notified!");                  
       } else {
           // TODO
           console.log("Code: " + res.statusCode);
       }
    });    
    request.on("error", function(e) {
        //TODO
      console.error(e);
    });    
    request.write(encrypted.cipherText);
    request.end();     
}


function sendToChrome(user) {
    var options = {
      hostname: "android.googleapis.com",
      port: 443,
      path: "/gcm/send",
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "Authorization": "key=" + GCMKey
      }
    };
    var request = https.request(options, function(res) {
        var responseString = "";
        res.on("data", function(d) {
            responseString += d.toString();
        });
        res.on("end", function() {
            var response = JSON.parse(responseString);
            if (response.success==1) {
                console.log("User was notified!");   
            } else {
                try {
                    if (response.results[0].error=="NotRegistered") {
                        // We need to remove the user
                        db.remove({ endpoint: user.endpoint });
                        console.log("User removed");                           
                    }
                } catch (e) {
                    console.log("Error sending notification");   
                }
            }
        });
    });
    var data = {
        "to": user.id,
       // "registration_ids": [],  // for broadcast (up to 1000)
        "time_to_live": 86400, // in seconds
    }
    request.write(JSON.stringify(data));
    
    request.on("error", function(e) {
      console.error(e);
    });
    
    request.end();
}

// Based on https://github.com/marco-c/web-push
function encrypt(userPublicKey, payload) {
  var localCurve = crypto.createECDH("prime256v1");

  var localPublicKey = localCurve.generateKeys();
  var localPrivateKey = localCurve.getPrivateKey();

  var sharedSecret = localCurve.computeSecret(urlBase64.decode(userPublicKey));

  var salt = crypto.randomBytes(16);

  ece.saveKey("webpushKey", sharedSecret);

  var cipherText = ece.encrypt(payload, {
    keyid: "webpushKey",
    salt: urlBase64.encode(salt),
  });

  return {
    localPublicKey: localPublicKey,
    salt: salt,
    cipherText: cipherText,
  };
}