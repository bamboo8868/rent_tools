const express = require('express');
const SteamCommunity = require('steamcommunity');
const app = express()
const port = 8888;
const bodyParser = require('body-parser');

// 解析 application/x-www-form-urlencoded 格式的数据
app.use(bodyParser.urlencoded({ extended: false }));
// 解析 application/json 格式的数据
app.use(bodyParser.json());


SteamCommunity.prototype.flushAll = function (sessionID, cookies) {
    this.httpRequestPost({
        "uri": "https://store.steampowered.com/twofactor/manage_action",
        "formData": {
            "action": 'deauthorize',
            "sessionid": sessionID
        },
    }, function (err, resposne, body) {
        // console.log(resposne);
        if (err) {
            console.log("flush err")
            // console.log(err);
        } else {
            console.log("flush success",sessionID)
            this.httpRequestPost({
                uri: 'https://store.steampowered.com/logout',
                form: {
                    sessionid: sessionID
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }, function (err) {
                if (err) {
                    console.log("logout error")
                } else {
                    console.log("logout success");
                }
            })

        }

    }
    )
};

app.post('/rent_logout', (req, res) => {
    console.log(req.body);
    let account = req.body.account;
    let password = req.body.password;
    let guard = req.body.guard;
    if (!account || !password || !guard) {
        res.send('Hello World!')
    } else {
        let steamObj = new SteamCommunity();
        steamObj.login({
            accountName: account,
            password: password,
            twoFactorCode: guard
        }, (err, sessionId) => {
            if (err) {
                console.log("login error",err)
            } else {
                if(sessionId && typeof sessionId == 'string' && sessionId.includes(';')) {
                    sessionId =  sessionId.split(';')[0];
                }
                console.log("login success",sessionId);
                setTimeout(() => {
                    steamObj.flushAll(sessionId);
                }, 2000);
            }

        })
        res.send("success");
    }

})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})